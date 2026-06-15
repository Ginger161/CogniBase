import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PDFParser = require("pdf2json");
const officeParser = require("officeparser");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
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

function chunkText(text: string, maxChunkSize: number = 1000) {
  const words = text.replace(/\s+/g, " ").split(" ");
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + word.length > maxChunkSize) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(word);
    currentLength += word.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
  return chunks;
}

export async function POST(req: Request) {
  try {
    const { fileUrl, fileName, docId, userId } = await req.json();

    if (!fileUrl || !fileName || !userId) {
      return NextResponse.json({ error: "Missing required file data." }, { status: 400 });
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
    const index = pc.index(process.env.PINECONE_INDEX as string);

    const vectors = await Promise.all(
      validChunks.map(async (chunk: string, i: number) => {
        const result = await embeddingModel.embedContent(chunk);
        const embedding = result.embedding.values;
        return {
          id: `${docId}-chunk-${i}`,
          values: embedding,
          metadata: {
            text: chunk,
            fileName: fileName,
            userId: userId,
            docId: docId
          }
        };
      })
    );

    // SAFEGUARD: Final check before Pinecone
    if (vectors.length === 0) {
       return NextResponse.json({ error: "Failed to generate AI data from this file." }, { status: 400 });
    }

    await index.upsert({ records: vectors });
    
    return NextResponse.json({ success: true, chunksProcessed: validChunks.length });

  } catch (error: any) {
    console.error("Engine Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process document." }, { status: 500 });
  }
}
