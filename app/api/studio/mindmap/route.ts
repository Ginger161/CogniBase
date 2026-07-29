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

    const systemPrompt = `You are an expert visual educator. Analyze the provided text and map out the core concepts and their relationships using standard Mermaid.js flowchart syntax. You MUST use graph TD. You MUST create a deep, vertical, hierarchical tree with a single root node at the top, branching downwards into sub-topics. Do NOT create a flat horizontal list of disconnected nodes. Keep the node text concise. Output strictly as a JSON object with a single key "mermaidCode" containing the raw Mermaid syntax string. Do not include markdown backticks (like \`\`\`mermaid), HTML, or conversational filler.`;
    
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
    let mindmapData;
    try {
      mindmapData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      return NextResponse.json({ error: "Failed to parse AI response into mindmap data." }, { status: 500 });
    }

    return NextResponse.json(mindmapData);

  } catch (error: any) {
    console.error("Mindmap Generation Error:", error);
    
    if (error.message?.includes("503") || error.message?.includes("high demand") || error.message?.includes("Service Unavailable")) {
      return NextResponse.json({ 
        error: "The AI servers are currently experiencing high demand. Please try again in a few minutes.",
        isCongested: true
      }, { status: 503 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate mindmap." }, { status: 500 });
  }
}
