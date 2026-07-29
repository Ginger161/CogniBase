import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireUser, requireDocumentOwnership, requireStudyGuideOwnership } from '@/lib/api-auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { documentId, text } = await req.json();

    if (!documentId || !text) {
      return NextResponse.json({ error: "Missing documentId or text" }, { status: 400 });
    }

    const { doc: document, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!document) return ownerResp;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { responseMimeType: "application/json" } });

    const systemPrompt = `You are a tactical academic strategist. Analyze the document and create an actionable study plan. Output strictly as a JSON object containing a 'phases' array. Each phase object must have a 'phaseTitle' (e.g., "Phase 1: High-Yield Concepts", "Phase 2: Rote Memorization") and a 'tasks' array. Each task must be an object with:
- id (a unique string)
- text (the actionable study instruction)
- isCompleted (boolean, default false)
- knowledgeCheck: an object containing:
  - question (string: a quick multiple-choice question to test the specific task)
  - options (array of exactly 4 strings)
  - correctAnswer (string: exact match to the correct option)

Do not use markdown formatting. Output strictly JSON.`;

    const prompt = `${systemPrompt}\n\nDocument Text:\n${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const strategyData = JSON.parse(responseText);

    const studyGuide = await prisma.studyGuide.create({
      data: {
        userId: user.id,
        sourceDocumentId: documentId,
        sourceDocumentName: document.name,
        title: `Interactive Guide: ${document.name}`,
        strategyData,
      }
    });

    return NextResponse.json({ studyGuide });

  } catch (error: any) {
    console.error("Generate Study Guide Error:", error);
    return NextResponse.json({
      error: "The AI servers are currently busy or out of quota. Please try again later.",
      isCongested: true
    }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { id, strategyData } = await req.json();

    if (!id || !strategyData) {
      return NextResponse.json({ error: "Missing id or strategyData" }, { status: 400 });
    }

    const { guide, response: ownerResp } = await requireStudyGuideOwnership(id, user.id);
    if (!guide) return ownerResp;

    const studyGuide = await prisma.studyGuide.update({
      where: { id },
      data: { strategyData }
    });

    return NextResponse.json({ studyGuide });

  } catch (error: any) {
    console.error("Update Study Guide Error:", error);
    return NextResponse.json({ error: "Failed to save progress. Please try again later." }, { status: 500 });
  }
}
