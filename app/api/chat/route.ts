import { streamText, tool, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const urlWorkspaceId = url.searchParams.get('workspaceId');
    const urlSources = url.searchParams.get('sources');
    const { messages, data, activeSources: bodyActiveSources, workspaceId: bodyWorkspaceId, userProfile } = await req.json();
    
    const workspaceId = data?.workspaceId || urlWorkspaceId || bodyWorkspaceId;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Please log in." }), { status: 401 });
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

    // Agentic Tool-Calling: System Prompt focuses strictly on identity and tool delegation
    const systemPrompt = `You are CogniBase, an elite academic AI co-pilot. Here is your current user context, which you must use silently to calibrate your responses, unless explicitly helpful to bring up:
${JSON.stringify(userProfile)}

If the user asks a general question unrelated to this context, ignore the context and answer directly. Use your tools to fetch their timetable, metrics, or search their workspace files when appropriate. Maintain continuity across the conversation history.`;

    const result = streamText({
      model: google('gemini-3.5-flash'),
      system: systemPrompt,
      messages: normalizedMessages,
      stopWhen: stepCountIs(5),
      tools: {
        getUserTimetable: tool({
          description: "Get the user's timetable/schedule data. Use this when the user asks about their classes or timings.",
          inputSchema: z.object({}),
          execute: async () => {
             try {
               const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
               return timetable ? timetable.data : { error: "No timetable found" };
             } catch(e) { return { error: "Failed to fetch timetable" }; }
          }
        }),
        getDailyMetrics: tool({
          description: "Get the user's daily performance metrics for today (focus hours, tasks completed, accuracy). Use this when the user asks for coaching feedback or focus metrics.",
          inputSchema: z.object({}),
          execute: async () => {
             try {
               const startOfDay = new Date();
               startOfDay.setHours(0, 0, 0, 0);
               const metric = await prisma.dailyMetric.findFirst({
                 where: { userId: user.id, date: { gte: startOfDay } }
               });
               return metric || { error: "No metrics recorded for today." };
             } catch(e) { return { error: "Failed to fetch metrics" }; }
          }
        }),
        searchWorkspaceFiles: tool({
          description: "Search the contents of the user's uploaded workspace files. Use this when the user asks questions about the content of their documents.",
          inputSchema: z.object({
            query: z.string().describe("The specific search query to run against the document contents")
          }),
          execute: async ({ query }) => {
            if (!workspaceId) return { error: "No active workspace. Please open a workspace to search files." };
            try {
              const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
              const queryResult = await embeddingModel.embedContent(query);
              let queryEmbedding = queryResult.embedding.values;
              if (queryEmbedding.length > 768) {
                queryEmbedding = queryEmbedding.slice(0, 768);
              }
              const embeddingString = `[${queryEmbedding.join(',')}]`;

              // SECURE: Parameterized Prisma.$queryRaw
              const matches: any[] = await prisma.$queryRaw`
                SELECT c."content", d."name" as "documentName", 1 - (c."embedding" <=> CAST(${embeddingString} AS vector)) as similarity
                FROM "DocumentChunk" c
                JOIN "Document" d ON c."documentId" = d."id"
                WHERE d."workspaceId" = ${workspaceId}
                ORDER BY c."embedding" <=> CAST(${embeddingString} AS vector)
                LIMIT 10
              `;
              
              if (!matches || matches.length === 0) return { result: "No matching content found in workspace files." };
              return matches.map(m => `[Source Document: ${m.documentName}]\n${m.content}`).join("\n\n---\n\n");
            } catch(e: any) {
              console.error("Vector search error in tool", e);
              return { error: e.message };
            }
          }
        })
      },
      async onFinish({ text }) {
        if (workspaceId && text) {
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
