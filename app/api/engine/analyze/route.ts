import { NextResponse } from "next/server";
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { randomUUID } from "crypto";
import { classifyAiError } from '@/lib/ai-errors';
import { extractOfficeText, extractPDFText } from '@/lib/parse';
import { readStoredFile } from '@/lib/storage';
import { prisma } from "@/lib/prisma";
import { requireUser, requireDocumentOwnership, requireWorkspaceOwnership, isTrustedStorageUrl, badFileUrlResponse } from '@/lib/api-auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 200) {
  const words = text.replace(/\s+/g, " ").split(" ");
  const chunks = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > maxChunkSize) {
      chunks.push(currentChunk.join(" "));
      
      const overlapChunk: string[] = [];
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
    const limited = rateLimit(user.id, LIMITS.index);
    if (limited) return limited;


    const { fileUrl, fileName, docId, workspaceId, workspaceName } = await req.json().catch(() => ({}));

    if (!docId || typeof docId !== 'string') {
      return NextResponse.json({ error: "Missing docId." }, { status: 400 });
    }

    const { doc: document, response: docResp } = await requireDocumentOwnership(docId, user.id);
    if (!document) return docResp;

    if (workspaceId) {
      const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return wsResp;
    }

    // Prefer the text stored when the source was added (works for files, videos, web pages and pasted text).
    let extractedText = (document.textContent || "").trim();

    if (!extractedText) {
      // Older documents without stored text: fall back to re-reading the file.
      if (!fileName || typeof fileName !== 'string') {
        return NextResponse.json({ error: "This source has no readable text." }, { status: 400 });
      }
      if (!isTrustedStorageUrl(fileUrl)) return badFileUrlResponse();

      const stored = await readStoredFile(fileUrl);
      if (!stored) return NextResponse.json({ error: "Could not read the original file." }, { status: 400 });
      const buffer = stored.buffer;

      const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'unknown';

      if (extension === "pdf") {
        extractedText = await extractPDFText(buffer);
      } else if (extension === "docx" || extension === "pptx") {
        extractedText = await extractOfficeText(buffer, extension);
      } else if (extension === "txt") {
        extractedText = buffer.toString("utf-8");
      } else if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension as string)) {
        try {
          const generativeModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
          const prompt = "Please extract all text from this image accurately. If there are diagrams, describe them in text. If there is no text or diagrams, just describe the visual content in detail so a student can study it.";
          const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
          const result = await generativeModel.generateContent([
            prompt,
            { inlineData: { data: buffer.toString("base64"), mimeType } }
          ]);
          extractedText = result.response.text();
        } catch (err) {
          console.error("Gemini Vision Error:", err);
          return NextResponse.json({ error: "Failed to process image with AI Vision." }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: `Unsupported file extension: .${extension}` }, { status: 400 });
      }
    }

    // Clean up the text
    if (!extractedText) extractedText = "";
    // Decode URI components that some parsers leave behind (like %20 for spaces)
    try { extractedText = decodeURIComponent(extractedText); } catch { /* not URI-encoded */ }

    const chunks = chunkText(extractedText);
    
    // SAFEGUARD: Filter out empty chunks
    const validChunks = chunks.filter(c => c.trim().length > 0);

    if (validChunks.length === 0) {
      return NextResponse.json({ error: "No readable text found. If this is a scanned document, the AI cannot read the images yet." }, { status: 400 });
    }
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        try {
          const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

          let chunksInserted = 0;
          let failedBatches = 0;
          const batchSize = 5;
          const allEmbeddings: { id: string; content: string; embeddingStr: string }[] = [];
          const totalBatches = Math.ceil(validChunks.length / batchSize);

          for (let i = 0; i < validChunks.length; i += batchSize) {
            const batchNumber = Math.floor(i / batchSize) + 1;
            send({ type: 'progress', message: `Analyzing section ${batchNumber} of ${totalBatches}...`, percent: Math.round((batchNumber / totalBatches) * 90) });

            const batchChunks = validChunks.slice(i, i + batchSize);
            try {
              const batchResults = await Promise.all(
                batchChunks.map(async (chunk, batchIdx) => {
                  const result = await embeddingModel.embedContent(chunk);
                  let embedding = result.embedding.values;
                  if (embedding.length > 768) {
                    embedding = embedding.slice(0, 768);
                    const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
                    embedding = embedding.map((v: number) => v / norm);
                  }
                  return {
                    // Sortable by position so chunks read back in document order.
                    id: `${docId}-c${String(i + batchIdx).padStart(5, '0')}-${randomUUID().slice(0, 8)}`,
                    content: chunk,
                    embeddingStr: `[${embedding.join(',')}]`
                  };
                })
              );
              allEmbeddings.push(...batchResults);
            } catch (e) {
              console.error(`Failed to process embedding batch starting at ${i}:`, e);
              failedBatches++;
            }
          }

          if (failedBatches > 0) {
            send({ type: 'error', error: `Could not index ${failedBatches} of ${totalBatches} sections. Nothing was saved; please try again.` });
            controller.close();
            return;
          }

          if (allEmbeddings.length > 0) {
            send({ type: 'progress', message: 'Saving to your vault...', percent: 92 });

            const values: string[] = [];
            const parameters: string[] = [];
            let paramIndex = 1;

            for (const item of allEmbeddings) {
              values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}::vector)`);
              parameters.push(item.id, docId, item.content, item.embeddingStr);
              paramIndex += 4;
            }

            const query = `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding") VALUES ${values.join(', ')}`;

            try {
              // Re-analysing a document replaces its previous chunks atomically.
              await prisma.$transaction([
                prisma.documentChunk.deleteMany({ where: { documentId: docId } }),
                prisma.$executeRawUnsafe(query, ...parameters),
              ]);
              chunksInserted = allEmbeddings.length;
            } catch (e) {
              console.error("Bulk insert failed:", e);
            }
          }

          if (chunksInserted === 0) {
            send({ type: 'error', error: "Failed to generate AI data from this file." });
            controller.close();
            return;
          }

          let generatedTitle = null;

          if (workspaceId && (!workspaceName || workspaceName.toLowerCase().includes('untitled') || workspaceName.toLowerCase().includes('optimizing academic'))) {
            try {
              send({ type: 'progress', message: 'Naming your study desk...', percent: 97 });
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

          send({ type: 'done', success: true, chunksProcessed: chunksInserted, workspaceTitle: generatedTitle, percent: 100 });
          controller.close();

        } catch (error) {
          console.error("Engine Error:", error);
          const failure = classifyAiError(error);
          const errorMessage = failure.kind === 'other' ? "Indexing failed. Please try again." : failure.message;
          send({ type: 'error', error: errorMessage });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error("Engine Error (pre-stream):", error);
    return NextResponse.json({ error: "Could not process this document. Please try again." }, { status: 500 });
  }
}
