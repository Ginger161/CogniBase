import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const url = new URL(req.url);
    const urlWorkspaceId = url.searchParams.get('workspaceId');
    const urlSources = url.searchParams.get('sources');
    const { messages, data, activeSources: bodyActiveSources, workspaceId: bodyWorkspaceId, userProfile } = await req.json();

    const workspaceId = data?.workspaceId || urlWorkspaceId || bodyWorkspaceId;

    if (workspaceId) {
      const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return ownerResp;
    }

    const explicitlyPassedDocIds = (data?.activeSources || bodyActiveSources || []).map((s: any) => s.id).filter(Boolean);
    if (explicitlyPassedDocIds.length === 0 && urlSources) {
      explicitlyPassedDocIds.push(...urlSources.split(',').filter(Boolean));
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages." }), { status: 400 });
    }

    const normalizedMessages = messages.map((msg: any) => ({
      ...msg,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text || '').join('') : '')
    }));

    const userQueryText = normalizedMessages[normalizedMessages.length - 1]?.content || "";

    if (workspaceId) {
      try {
        await prisma.message.create({
          data: {
            role: 'user',
            text: userQueryText,
            workspaceId
          }
        });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    }

    let docNames = "";
    let targetDocIds: string[] = [];
    let fetchedDocs: any[] = [];

    // Ownership is always enforced here, whether or not workspaceId was passed
    if (explicitlyPassedDocIds.length > 0) {
      fetchedDocs = await prisma.document.findMany({
        where: {
          id: { in: explicitlyPassedDocIds },
          workspace: { userId: user.id },
          ...(workspaceId ? { workspaceId } : {})
        }
      });
    } else if (workspaceId) {
      fetchedDocs = await prisma.document.findMany({
        where: { workspaceId, workspace: { userId: user.id } }
      });
    }

    docNames = fetchedDocs.map((d: any) => d.name).join(', ');
    targetDocIds = fetchedDocs.map((d: any) => d.id);

    let searchContext = "";

    if (targetDocIds.length > 0 && userQueryText.trim().length > 0) {
      try {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedBackoff = [1000, 2000];
        let queryResult;
        for (let attempt = 0; attempt <= embedBackoff.length; attempt++) {
          try {
            queryResult = await embeddingModel.embedContent(userQueryText);
            break;
          } catch (err: any) {
            const msg = String(err.message || err);
            if (attempt < embedBackoff.length && (msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded'))) {
              await new Promise(res => setTimeout(res, embedBackoff[attempt]));
            } else {
              throw err;
            }
          }
        }
        let queryEmbedding = queryResult!.embedding.values;
        if (queryEmbedding.length > 768) {
          queryEmbedding = queryEmbedding.slice(0, 768);
          const norm = Math.sqrt(queryEmbedding.reduce((sum, v) => sum + v * v, 0));
          queryEmbedding = queryEmbedding.map(v => v / norm);
        }

        const docIdsParam = targetDocIds.map(id => `'${id}'`).join(',');
        const embeddingParam = `[${queryEmbedding.join(',')}]`;

        const matches: any[] = workspaceId
          ? await prisma.$queryRawUnsafe(`
              SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> $1::vector) as similarity
              FROM "DocumentChunk" c
              JOIN "Document" d ON c."documentId" = d."id"
              WHERE c."documentId" IN (${docIdsParam}) AND d."workspaceId" = $2
              ORDER BY c."embedding" <=> $1::vector
              LIMIT 20
            `, embeddingParam, workspaceId)
          : await prisma.$queryRawUnsafe(`
              SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> $1::vector) as similarity
              FROM "DocumentChunk" c
              JOIN "Document" d ON c."documentId" = d."id"
              WHERE c."documentId" IN (${docIdsParam})
              ORDER BY c."embedding" <=> $1::vector
              LIMIT 20
            `, embeddingParam);

        const highestSimilarity = matches.length > 0 ? matches[0].similarity : 0;

        if (highestSimilarity < 0.65 || matches.length === 0) {
          const fallbackChunks: any[] = await prisma.$queryRawUnsafe(`
            SELECT sub."content", d."name" as "documentName"
            FROM (
              SELECT "content", "documentId",
                     ROW_NUMBER() OVER(PARTITION BY "documentId" ORDER BY "id" ASC) as rn
              FROM "DocumentChunk"
              WHERE "documentId" IN (${docIdsParam})
            ) sub
            JOIN "Document" d ON sub."documentId" = d."id"
            WHERE sub.rn <= 3
          `);
          searchContext += fallbackChunks.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
        } else {
          searchContext += matches.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
        }
      } catch (err) {
        console.error("Vector search error:", err);
      }
    }



    const systemPrompt = `CRITICAL CONTEXT: The user is currently inside a workspace that contains the following uploaded study documents: [${docNames}]. You have full access to these materials via the injected chunks below. Never say you do not have access to these files.

YOU ARE AN ELITE ACADEMIC TUTOR AND EXAM STRATEGIST. Your sole purpose is to help university students master their course materials, synthesize complex information, and ace their exams. You are empathetic, proactive, and highly structured.

Rule 1: Your primary knowledge must come strictly from the provided DocumentChunks. If the user asks what the materials are about, analyze the text and mention the specific details present (e.g., specific instructors, specific technical indicators like Dojis or Ema mentioned in the text). Do not speak in broad, generic subject terms if they aren't in the chunks.

Rule 2: If the user asks a question that requires external knowledge or goes beyond what is written in the document, you MUST explicitly state: "This information is not explicitly found in your uploaded materials, but based on general best practices..." before providing the answer. Never hallucinate that external information is part of the document.

Rule 3: You must maintain perfect continuity across the entire conversation history. When the user uses pronouns or references previous explanations (e.g., "explain that rule further"), cross-reference the chat history to identify the exact topic before querying the vector database or answering.

[WORKSPACE METADATA]
User Profile Context (Name, School, Department, Courses):
${JSON.stringify(userProfile)}

[VECTOR CHUNKS]
Extracted Context from Workspace Files:
${searchContext ? searchContext : "No relevant content found in the files for this specific query."}`;

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: normalizedMessages,
      async onFinish({ text }) {
        if (workspaceId) {
          try {
            await prisma.message.create({
              data: {
                role: 'assistant',
                text,
                workspaceId
              }
            });
          } catch (e) {
            console.error("Failed to save assistant message:", e);
          }
        }
      }
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Query Error:", error);
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return new Response("The AI servers are currently experiencing high demand. Please try again in a few minutes.", { status: 503 });
    }
    return new Response(error.message || "Failed to generate response", { status: 500 });
  }
}
