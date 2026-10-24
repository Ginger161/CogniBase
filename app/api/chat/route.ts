import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';
import { resolveScopedDocs } from '@/lib/scope';
import { classifyAiError } from '@/lib/ai-errors';
import { z } from 'zod';

export const maxDuration = 60;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const MAX_HISTORY = 30;

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  if (!last) return '';
  return last.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim();
}

export async function POST(req: Request) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (!user) return authResponse;
    const limited = rateLimit(user.id, LIMITS.chat);
    if (limited) return limited;


    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const { messages, userProfile } = body as { messages?: UIMessage[]; userProfile?: unknown };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Missing messages.' }, { status: 400 });
    }

    const workspaceId: string | undefined =
      body.data?.workspaceId || url.searchParams.get('workspaceId') || body.workspaceId || undefined;
    const requestedIds: unknown = body.data?.activeSources || body.activeSources;
    const documentIds = Array.isArray(requestedIds)
      ? requestedIds.map((s: unknown) => (typeof s === 'string' ? s : (s as { id?: string })?.id)).filter(Boolean)
      : [];

    if (workspaceId) {
      const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return ownerResp;
    }

    // What the assistant may read. No scope sent = everything the user owns.
    const hasScope = documentIds.length > 0 || !!workspaceId;
    const scopedDocs = hasScope ? await resolveScopedDocs(user.id, { workspaceId, documentIds }) : [];
    const scopeIds = scopedDocs.map((d) => d.id);
    const scopeNames = scopedDocs.map((d) => d.name);

    const userQueryText = lastUserText(messages);
    if (workspaceId && userQueryText) {
      try {
        await prisma.message.create({ data: { role: 'user', text: userQueryText, workspaceId } });
      } catch (e) {
        console.error('Failed to save user message:', e);
      }
    }

    const profileText = JSON.stringify(userProfile ?? {}).slice(0, 2000);

    const systemPrompt = `You are CogniBase, an elite academic tutor and exam strategist for university students. You are empathetic, proactive and highly structured.

${hasScope
  ? `The student has scoped this conversation to these sources: [${scopeNames.join(', ') || 'none found'}].`
  : `The student has not narrowed the sources, so you may search all of their uploaded materials.`}

Rule 1: For anything about the student's materials, call searchSources first and answer strictly from what it returns. Mention specific details present in the text rather than generic subject talk.
Rule 2: If the question needs knowledge beyond the sources, say "This information is not explicitly found in your uploaded materials, but based on general best practices..." before answering. Never present outside knowledge as if it came from the documents.
Rule 3: Keep continuity with the conversation history; resolve pronouns like "that rule" from earlier turns.
Rule 4: When a statement is drawn directly from a source, add a citation right after it in exactly this markdown form: [•](cite:EXACT_DOCUMENT_NAME), using the filename from the [Source Document: ...] tag. At most one citation per distinct claim or paragraph. No citations on general-knowledge statements.
Use getUserTimetable or getDailyMetrics only when the student asks about their schedule or focus.

Student context (use silently to calibrate tone and examples): ${profileText}`;

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages.slice(-MAX_HISTORY)),
      stopWhen: stepCountIs(5),
      tools: {
        getUserTimetable: tool({
          description: "Get the user's timetable/schedule data. Use this when the user asks about their classes or timings.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
              return timetable ? timetable.data : { error: 'No timetable found' };
            } catch {
              return { error: 'Failed to fetch timetable' };
            }
          },
        }),
        getDailyMetrics: tool({
          description: "Get the user's daily performance metrics for today (focus minutes, tasks completed, accuracy). Use this when the user asks for coaching feedback or focus metrics.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);
              const metric = await prisma.dailyMetric.findFirst({
                where: { userId: user.id, date: { gte: startOfDay } },
              });
              return metric || { error: 'No metrics recorded for today.' };
            } catch {
              return { error: 'Failed to fetch metrics' };
            }
          },
        }),
        searchSources: tool({
          description: "Search the contents of the student's selected study sources (or all their sources if none are selected). Use this whenever the question is about their documents, notes, videos or lecture materials.",
          inputSchema: z.object({
            query: z.string().describe('The specific search query to run against the source contents'),
          }),
          execute: async ({ query }) => {
            if (hasScope && scopeIds.length === 0) {
              return { error: 'No readable sources are selected for this conversation.' };
            }
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
                  AND (cardinality(${scopeIds}::text[]) = 0 OR d."id" = ANY(${scopeIds}::text[]))
                ORDER BY c."embedding" <=> CAST(${embeddingString} AS vector)
                LIMIT 12
              `;

              if (!matches || matches.length === 0) return { result: 'No matching content found in the sources.' };
              return matches.map((m) => `[Source Document: ${m.documentName}]\n${m.content}`).join('\n\n---\n\n');
            } catch (e) {
              console.error('Vector search error in tool', e);
              return { error: 'Search failed. Please try again.' };
            }
          },
        }),
      },
      async onFinish({ text }) {
        if (workspaceId && text) {
          try {
            await prisma.message.create({ data: { role: 'assistant', text, workspaceId } });
          } catch (e) {
            console.error('Failed to save assistant message:', e);
          }
        }
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
