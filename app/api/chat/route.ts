import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, activeSources, userProfile, workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing workspaceId" }), { status: 401 });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages." }), { status: 400 });
    }

    const normalizedMessages = messages.map((msg: any) => ({
      ...msg,
      content: msg.content || (msg.parts ? msg.parts.map((p: any) => p.text || '').join('') : '')
    }));

    const userQueryText = normalizedMessages[normalizedMessages.length - 1]?.content || "";
    
    // 1. Fetch Workspace Metadata First
    // Prioritize activeSources (which are the files the user specifically clicked in their workspace UI)
    let docNames = "";
    let targetDocIds: string[] = [];
    
    if (activeSources && activeSources.length > 0) {
      const activeIds = activeSources.map((d: any) => d.id).filter(Boolean);
      const dbDocs = await prisma.document.findMany({
        where: { id: { in: activeIds }, workspaceId: workspaceId }
      });
      docNames = dbDocs.map((d: any) => d.name || d.title).join(', ');
      targetDocIds = dbDocs.map((d: any) => d.id);
    } else {
      // Fallback to fetching all workspace docs
      const workspaceDocs = await prisma.document.findMany({
        where: { workspaceId }
      });
      docNames = workspaceDocs.map((d: any) => d.name).join(', ');
      targetDocIds = workspaceDocs.map((d: any) => d.id);
    }

    let searchContext = "";

    // 2. pgvector similarity search
    if (targetDocIds.length > 0 && userQueryText.trim().length > 0) {
      try {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const queryResult = await embeddingModel.embedContent(userQueryText);
        let queryEmbedding = queryResult.embedding.values;
        if (queryEmbedding.length > 768) {
          queryEmbedding = queryEmbedding.slice(0, 768);
        }

        const docIdsParam = targetDocIds.map(id => `'${id}'`).join(',');
        
        const matches: any[] = await prisma.$queryRawUnsafe(`
          SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> $1::vector) as similarity
          FROM "DocumentChunk" c
          JOIN "Document" d ON c."documentId" = d."id"
          WHERE c."documentId" IN (${docIdsParam}) AND d."workspaceId" = '${workspaceId}'
          ORDER BY c."embedding" <=> $1::vector
          LIMIT 20
        `, `[${queryEmbedding.join(',')}]`);

        // 3. Build a Meta-Query Fallback
        const highestSimilarity = matches.length > 0 ? matches[0].similarity : 0;
        
        if (highestSimilarity < 0.65 || matches.length === 0) {
          // Fallback: If similarity is low, it's likely a meta-question like "what is this about?"
          // Pull the first 3 chunks of each document to summarize
          const fallbackChunks: any[] = await prisma.$queryRawUnsafe(`
            SELECT "content"
            FROM (
              SELECT "content", "documentId",
                     ROW_NUMBER() OVER(PARTITION BY "documentId" ORDER BY "id" ASC) as rn
              FROM "DocumentChunk"
              WHERE "documentId" IN (${docIdsParam})
            ) sub
            WHERE rn <= 3
          `);
          searchContext = fallbackChunks.map(m => m.content).join("\n\n");
        } else {
          // Use the high-confidence vector matches
          searchContext = matches.map(m => m.content).join("\n\n");
        }
      } catch (err) {
        console.error("Vector search error:", err);
      }
    }

    // 3. Format Conversation History for Strict Memory Tracking
    let formattedConversationHistory = "";
    normalizedMessages.slice(0, -1).forEach((msg: any, index: number) => {
      formattedConversationHistory += `[interaction_id: ${index + 1}]`;
      if (index > 0) {
        formattedConversationHistory += ` [previous_interaction_id: ${index}]\n`;
      } else {
        formattedConversationHistory += `\n`;
      }
      formattedConversationHistory += `Role: ${msg.role}\nMessage: ${msg.content}\n\n`;
    });

    // 4. Hard-Inject File Awareness into the System Prompt
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
${searchContext ? searchContext : "No relevant content found in the files for this specific query."}

[LINKED CONVERSATION HISTORY]
${formattedConversationHistory ? formattedConversationHistory : "No previous conversation history."}`;

    // 5. Stream response using Vercel AI SDK
    const result = streamText({
      model: google('gemini-3.1-flash-lite'),
      system: systemPrompt,
      messages: normalizedMessages,
    });

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Query Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to generate response" }), { status: 500 });
  }
}
