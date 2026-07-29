import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const body = await req.json();
    const { workspaceId, documentText } = body;

    if (workspaceId) {
      const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return wsResp;
    }

    let textToAnalyze = documentText;

    if (!textToAnalyze && workspaceId) {
      // Fetch all document chunks for this workspace
      const documents = await prisma.document.findMany({
        where: { workspaceId: workspaceId },
        include: { chunks: true }
      });

      let combinedContent = '';
      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          combinedContent += chunk.content + '\n';
        });
      });
      textToAnalyze = combinedContent;
    }

    if (!textToAnalyze || textToAnalyze.trim() === '') {
      return NextResponse.json({ error: "No text provided or found in the workspace." }, { status: 400 });
    }

    // Limit text to avoid exceeding token limits (rough approximation)
    if (textToAnalyze.length > 50000) {
      textToAnalyze = textToAnalyze.substring(0, 50000);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemPrompt = `You are an expert presentation designer. Analyze the text and create a 5-slide presentation outline. Output strictly as a JSON object with a slides array. Each slide object must have a title (string) and bulletPoints (array of strings, max 4 per slide). Do not include markdown formatting.`;
    
    const finalPrompt = `${systemPrompt}\n\nText to analyze:\n${textToAnalyze}`;

    const backoffDelays = [1000, 2000, 4000];
    let result;
    let lastError: any;
    for (let attempt = 0; attempt <= backoffDelays.length; attempt++) {
      try {
        result = await model.generateContent(finalPrompt);
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || err);
        if (attempt < backoffDelays.length && (msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded'))) {
          await new Promise(res => setTimeout(res, backoffDelays[attempt]));
        } else {
          throw err;
        }
      }
    }
    if (!result) throw lastError;
    const responseText = result.response.text();
    
    // Parse the JSON object to ensure it's valid before sending it back
    let presentationData;
    try {
      presentationData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response into presentation data." }, { status: 500 });
    }

    return NextResponse.json(presentationData);

  } catch (error: any) {
    console.error("Presentation Generation Error:", error);
    
    // Clean standard message for all downstream errors (including 429, 503, quotas)
    return NextResponse.json({ 
      error: "The AI servers are currently busy or out of quota. Please try again later.",
      isCongested: true
    }, { status: 503 });
  }
}
