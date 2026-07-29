import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { parseOffice } from "officeparser";
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { fileUrl, sectionConstraint } = await req.json();

    if (!fileUrl || typeof fileUrl !== 'string') {
      return NextResponse.json({ error: "Missing or invalid fileUrl." }, { status: 400 });
    }

    if (!sectionConstraint || typeof sectionConstraint !== 'string') {
      return NextResponse.json({ error: "Missing or invalid sectionConstraint." }, { status: 400 });
    }

    console.log("Fetching fileUrl for Study Guide:", fileUrl);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);
      if (fileRes.status === 404) {
        return NextResponse.json({ error: "The file could not be found on the storage server. It may have been deleted or expired." }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to fetch file from storage provider. Status: ${fileRes.status}` }, { status: fileRes.status });
    }
    
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
    const mimeType = rawContentType.split(';')[0].trim();
    
    let text = '';
    let ext: any = mimeType.includes("csv") ? "csv" 
              : mimeType.includes("spreadsheetml") ? "xlsx" 
              : mimeType.includes("officedocument.presentationml") ? "pptx"
              : mimeType.includes("officedocument.wordprocessingml") ? "docx"
              : mimeType.includes("text/plain") ? "txt"
              : "pdf";
              
    try {
      if (ext === 'txt') {
        text = buffer.toString('utf-8');
      } else {
        const doc = await parseOffice(buffer, { fileType: ext });
        text = typeof doc === 'string' ? doc : (doc.toText ? doc.toText() : JSON.stringify(doc));
      }
    } catch (err) {
      console.error("Parser error:", err);
      text = "Attached document content for extraction.";
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Document text could not be extracted or downloaded from storage. Please try again." }, { status: 400 });
    }

    const model = getAIModel('complex');
    
    const prompt = `You are a master tutor. Create a highly structured JSON study guide based on the following document content, strictly adhering to the user's Study Brief Configuration parameters.
Study Brief Configuration: ${sectionConstraint}

You MUST return a raw JSON object that EXACTLY matches this schema. Do not include markdown wrappers.
{
  "guideTitle": "Mastering EDM 205",
  "phases": [
    {
      "phaseId": "1",
      "title": "Phase 1: Core Definitions",
      "microBites": [
        "Educational Planning is the systematic process of...",
        "It requires resource allocation and..."
      ],
      "flashcards": [
        { "question": "What is Educational Planning?", "answer": "A systematic process..." }
      ]
    }
  ]
}

Document Context:
${text.substring(0, 40000)}
`;

    let contentParts: any[] = [prompt];
    if (text === "Attached document content for extraction.") {
       contentParts = [
         prompt, 
         { inlineData: { data: buffer.toString('base64'), mimeType } }
       ];
    }

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: contentParts.map(p => typeof p === 'string' ? { text: p } : p) }],
        generationConfig: { responseMimeType: "application/json" }
      });
    } catch (aiError: any) {
      console.error("Study Guide Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    const markdownOut = response.text();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(markdownOut);
    } catch (e) {
      console.error("JSON Parse failed on raw AI output:", e);
      console.log("--- RAW AI OUTPUT START ---");
      console.log(markdownOut);
      console.log("--- RAW AI OUTPUT END ---");
      try {
        const cleaned = markdownOut.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch (cleanError) {
        console.error("Cleaned JSON Parse failed:", cleanError);
        throw new Error("AI returned malformed JSON");
      }
    }
    try {
      const origin = req.headers.get('origin') || new URL(req.url).origin;
      const cookieHeader = req.headers.get('cookie');
      await fetch(`${origin}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { 'cookie': cookieHeader } : {}) },
        body: JSON.stringify({ action: 'generate_guide' })
      });
    } catch (metricErr) {
      console.error("Failed to update gamification metric:", metricErr);
    }

    return NextResponse.json({ studyGuide: parsedJson });

  } catch (error: any) {
    console.error("Study Guide Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
