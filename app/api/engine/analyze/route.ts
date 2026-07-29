import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser, requireDocumentOwnership, requireWorkspaceOwnership } from '@/lib/api-auth';

const PDFParser = require("pdf2json");
const officeParser = require("officeparser");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 200) {
  const words = text.replace(/\s+/g, " ").split(" ");
  const chunks = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > maxChunkSize) {
      chunks.push(currentChunk.join(" "));
      
      let overlapChunk: string[] = [];
      let overlapLength = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const overlapWord = currentChunk[j];
        if (overlapLength + overlapWord.length > overlapSize) break;
        overlapChunk.unshift(overlapWord);
        overlapLength += overlapWord.length + 1;
      }
      currentChunk = [...overlapChunk];
      currentLength = overlapLength;
    }
    currentChunk.push(word);
    currentLength += word.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
  return chunks;
}

export async function POST(req: Request) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (!user) return authResponse;

    const { fileUrl, fileName, docId, workspaceId, workspaceName } = await req.json();

    if (!fileUrl || !fileName) {
      return NextResponse.json({ error: "Missing required file data." }, { status: 400 });
    }

    if (docId) {
      const { doc: document, response: docResp } = await requireDocumentOwnership(docId, user.id);
      if (!document) return docResp;
    }

    if (workspaceId) {
      const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return wsResp;
    }

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'unknown';

    if (extension === "pdf") {
      extractedText = await extractPDFText(buffer);
    } else if (["docx", "pptx"].includes(extension as string)) {
      if (typeof officeParser.parseOffice === 'function') {
        const ast = await officeParser.parseOffice(buffer, { fileType: extension });
        extractedText = typeof ast === 'string' ? ast : (ast.toText ? ast.toText() : JSON.stringify(ast));
      } else if (typeof officeParser.parseOfficeAsync === 'function') {
        extractedText = await officeParser.parseOfficeAsync(buffer);
      } else {
        return NextResponse.json({ error: "The server's document parsing engine is missing a valid parsing method." }, { status: 500 });
      }
    } else if (extension === "txt") {
      extractedText = buffer.toString("utf-8");
    } else if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension as string)) {
      try {
        const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const prompt = "Please extract all text from this image accurately. If there are diagrams, describe them in text. If there is no text or diagrams, just describe the visual content in detail so a student can study it.";
        const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
        
        const result = await generativeModel.generateContent([
          prompt,
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType
            }
          }
        ]);
        extractedText = result.response.text();
      } catch (err) {
        console.error("Gemini Vision Error:", err);
        return NextResponse.json({ error: "Failed to process image with AI Vision." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: `Unsupported file extension: .${extension}` }, { status: 400 });
    }

    // Clean up the text
    if (!extractedText) extractedText = "";
    // Decode URI components that some parsers leave behind (like %20 for spaces)
    try { extractedText = decodeURIComponent(extractedText); } catch(e) {}

    const chunks = chunkText(extractedText);
    
    // SAFEGUARD: Filter out empty chunks
    const validChunks = chunks.filter(c => c.trim().length > 0);

    if (validChunks.length === 0) {
      return NextResponse.json({ error: "No readable text found. If this is a scanned document, the AI cannot read the images yet." }, { status: 400 });
    }
    
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    // Generate embeddings and insert into Postgres via Prisma
    let chunksInserted = 0;
    const batchSize = 5;
    const allEmbeddings: { id: string; content: string; embeddingStr: string }[] = [];

    for (let i = 0; i < validChunks.length; i += batchSize) {
      const batchChunks = validChunks.slice(i, i + batchSize);
      try {
        const batchResults = await Promise.all(
          batchChunks.map(async (chunk, batchIdx) => {
            const result = await embeddingModel.embedContent(chunk);
            let embedding = result.embedding.values;
            if (embedding.length > 768) embedding = embedding.slice(0, 768);
            return {
              id: `${docId}-chunk-${i + batchIdx}`,
              content: chunk,
              embeddingStr: `[${embedding.join(',')}]`
            };
          })
        );
        allEmbeddings.push(...batchResults);
      } catch (e) {
        console.error(`Failed to process embedding batch starting at ${i}:`, e);
      }
    }

    if (allEmbeddings.length > 0) {
      // Build a single bulk insert query
      const values: string[] = [];
      const parameters: any[] = [];
      let paramIndex = 1;

      for (const item of allEmbeddings) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}::vector)`);
        parameters.push(item.id, docId, item.content, item.embeddingStr);
        paramIndex += 4;
      }

      const query = `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding") VALUES ${values.join(', ')}`;
      
      try {
        await prisma.$executeRawUnsafe(query, ...parameters);
        chunksInserted = allEmbeddings.length;
      } catch (e) {
        console.error("Bulk insert failed:", e);
      }
    }

    if (chunksInserted === 0) {
       return NextResponse.json({ error: "Failed to generate AI data from this file." }, { status: 400 });
    }

    let generatedTitle = null;
    
    // Only generate a title if it's the default or generic name, or if we want to auto-update
    if (workspaceId && (!workspaceName || workspaceName.toLowerCase().includes('untitled') || workspaceName.toLowerCase().includes('optimizing academic'))) {
      try {
        const titleModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const titlePrompt = `Based on the following academic text, generate a short, highly relevant title (3 to 5 words maximum) for a study workspace. Do not use quotes or special characters. Text excerpt: ${extractedText.substring(0, 1500)}`;
        const titleResult = await titleModel.generateContent(titlePrompt);
        generatedTitle = titleResult.response.text().trim().replace(/^["'](.*)["']$/, '$1');
        
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { title: generatedTitle }
        });
      } catch (titleErr) {
        console.error("Failed to generate workspace title:", titleErr);
      }
    }

    return NextResponse.json({ success: true, chunksProcessed: chunksInserted, workspaceTitle: generatedTitle });

  } catch (error: any) {
    console.error("Engine Error:", error);
    
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand from students. Please try again in a few minutes.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: error.message || "Failed to process document." }, { status: 500 });
  }
}
