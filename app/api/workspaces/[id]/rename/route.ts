import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;
    const { fileName, manualTitle } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    let cleanTitle = "";
    if (manualTitle) {
      cleanTitle = manualTitle.trim();
    } else {
      const { text } = await generateText({
        model: google('gemini-3.1-flash-lite'),
        prompt: `Generate a highly professional, short academic title (max 4 words) for a study workspace based on this material: ${fileName || 'General academic study notes'}. Respond ONLY with the generated title.`,
      });
      cleanTitle = text.trim().replace(/^["'](.*)["']$/, '$1');
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { title: cleanTitle }
    });

    return NextResponse.json({ title: updatedWorkspace.title });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
