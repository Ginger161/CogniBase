import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { resolveScopedDocs } from '@/lib/scope';
import { classifyAiError } from '@/lib/ai-errors';
import { z } from 'zod';

export const maxDuration = 60;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const MAX_HISTORY = 30;

export async function POST(req: Request) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (!user) return authResponse;
    const limited = rateLimit(user.id, LIMITS.chat);
    if (limited) return limited;


    const body = await req.json().catch(() => ({}));
    const { messages, userProfile } = body as { messages?: UIMessage[]; userProfile?: unknown };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Missing messages.' }, { status: 400 });
    }

    const requestedIds: unknown = body.data?.activeSources || body.activeSources;
    const documentIds = Array.isArray(requestedIds)
      ? requestedIds.map((s: unknown) => (typeof s === 'string' ? s : (s as { id?: string })?.id)).filter(Boolean)
      : [];

    // What the assistant may read: only the source(s) named by id, and only if the user owns them.
    const scopedDocs = documentIds.length > 0 ? await resolveScopedDocs(user.id, { documentIds }) : [];
    const scopeIds = scopedDocs.map((d) => d.id);
    const scopeNames = scopedDocs.map((d) => d.name);

    // The console lives inside a single source. When that source can't be read, the assistant says why
    // and what to do instead of the request failing with a bare error.
    let problem: string | null = null;
    if (documentIds.length === 0) {
      problem = 'NO_SOURCE: no source is attached to this console, so the request carried no source id. This usually means the page was opened without a source or the connection to it was lost.';
    } else if (scopeIds.length === 0) {
      problem = 'SOURCE_NOT_FOUND: the source this console was opened on could not be found in the student’s library. It was most likely deleted, or belongs to another account.';
    } else {
      const chunkCount = await prisma.documentChunk.count({ where: { documentId: { in: scopeIds } } });
      if (chunkCount === 0) {
        problem = `NOT_INDEXED: "${scopeNames.join(', ')}" exists but has not been indexed yet, so it cannot be searched. Indexing may still be running, or it may have failed.`;
      }
    }

    const profileText = JSON.stringify(userProfile ?? {}).slice(0, 2000);

    const systemPrompt = `You are CogniBase, an elite academic tutor and exam strategist for university students. You are empathetic, proactive and highly structured.

The student is reading a source and has opened its console: [${scopeNames.join(', ') || 'none'}]. Answer about this source only.

Rule 1: For anything about the source, call searchSources first and answer strictly from what it returns. Mention specific details present in the text rather than generic subject talk.
Rule 2: If the question needs knowledge beyond the source, say "This information is not explicitly found in your uploaded materials, but based on general best practices..." before answering. Never present outside knowledge as if it came from the document.
Rule 3: Keep continuity with the conversation history; resolve pronouns like "that rule" from earlier turns.
Rule 4: When a statement is drawn directly from the source, add a citation right after it in exactly this markdown form: [•](cite:EXACT_DOCUMENT_NAME), using the filename from the [Source Document: ...] tag. At most one citation per distinct claim or paragraph. No citations on general-knowledge statements.
Rule 5: The student's timetable and daily metrics are available across the whole app through getUserTimetable and getDailyMetrics. Use them only when asked about schedule, classes or focus, and always say which resource you used, for example "From your timetable" or "From today's metrics". Never mix them up with what the source says.
Rule 6: If anything stops you from answering (the situation below, a tool error, or an empty result), tell the student in plain language: what is wrong, why it happened, and what they can do next. Keep it short and kind, never blame them, never show technical jargon or error codes, and never invent source content to fill the gap.
${problem ? `
CURRENT SITUATION: ${problem}
Do not try to answer questions about the source. Explain this to the student using Rule 6. Suggested next steps: for NO_SOURCE, go back to the Library and open the source again; for SOURCE_NOT_FOUND, return to the Library and check the source still exists, or add it again; for NOT_INDEXED, open the source's menu in the Library and choose "Retry indexing", or wait a moment if indexing is still running. You may still help with schedule or focus questions.
` : ''}
Student context (use silently to calibrate tone and examples): ${profileText}`;

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages.slice(-MAX_HISTORY)),
      stopWhen: stepCountIs(5),
      tools: {
        getUserTimetable: tool({
          description: "Get the student's timetable (their classes, days and times). Use this only when they ask about their schedule or classes.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
              return timetable ? { resource: 'Timetable', data: timetable.data } : { resource: 'Timetable', error: 'No timetable has been added yet. They can add one under Schedule in the Library.' };
            } catch {
              return { resource: 'Timetable', error: 'The timetable could not be loaded just now. Trying again in a moment should work.' };
            }
          },
        }),
        getDailyMetrics: tool({
          description: "Get the student's focus metrics for today (focus minutes, tasks completed, accuracy). Use this only when they ask about focus or coaching feedback.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);
              const metric = await prisma.dailyMetric.findFirst({ where: { userId: user.id, date: { gte: startOfDay } } });
              return metric ? { resource: 'Daily metrics', data: metric } : { resource: 'Daily metrics', error: 'Nothing has been recorded for today yet. Metrics appear after they study or read.' };
            } catch {
              return { resource: 'Daily metrics', error: 'Metrics could not be loaded just now. Trying again in a moment should work.' };
            }
          },
        }),
        ...(problem ? {} : { searchSources: tool({
          description: "Search the contents of the student's open study source (the one they have open). Use this whenever the question is about their documents, notes, videos or lecture materials.",
          inputSchema: z.object({
            query: z.string().describe('The specific search query to run against the source contents'),
          }),
          execute: async ({ query }) => {
            try {
              const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
              const queryResult = await embeddingModel.embedContent(query);
              let queryEmbedding = queryResult.embedding.values;
              if (queryEmbedding.length > 768) {
                queryEmbedding = queryEmbedding.slice(0, 768);
                const norm = Math.sqrt(queryEmbedding.reduce((sum, v) => sum + v * v, 0));
                queryEmbedding = queryEmbedding.map((v) => v / norm);
              }
              const embeddingString = `[${queryEmbedding.join(',')}]`;

              // Parameterized: ownership is always enforced; scope narrows it further.
              const matches = await prisma.$queryRaw<Array<{ content: string; documentName: string }>>`
                SELECT c."content", d."name" AS "documentName"
                FROM "DocumentChunk" c
                JOIN "Document" d ON c."documentId" = d."id"
                JOIN "Workspace" w ON d."workspaceId" = w."id"
                WHERE w."userId" = ${user.id}
                  AND d."id" = ANY(${scopeIds}::text[])
                ORDER BY c."embedding" <=> CAST(${embeddingString} AS vector)
                LIMIT 12
              `;

              if (!matches || matches.length === 0) return { error: 'Nothing in this source matched that question. Suggest rephrasing it with words the source uses, or asking about a section it covers.' };
              return matches.map((m) => `[Source Document: ${m.documentName}]\n${m.content}`).join('\n\n---\n\n');
            } catch (e) {
              console.error('Vector search error in tool', e);
              return { error: 'The search could not run just now, likely a temporary problem reaching the AI service. Suggest trying again in a moment.' };
            }
          },
        }) }),
      },
    });

    // Without onError the stream hides the reason behind a generic message.
    return result.toUIMessageStreamResponse({ onError: (e) => classifyAiError(e).message });
  } catch (error) {
    console.error('Chat Error:', error);
    const failure = classifyAiError(error);
    return new Response(failure.message, { status: failure.status });
  }
}
