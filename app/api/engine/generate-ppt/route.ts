import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { requireUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (!user) return authResponse;

    const { documentText } = await req.json();

    if (!documentText || typeof documentText !== 'string') {
      return NextResponse.json({ error: "Missing or invalid documentText." }, { status: 400 });
    }

    const model = getAIModel('complex');
    
    const prompt = `You are a master presentation designer. Create a highly structured JSON presentation based on the following document content.

You MUST return a raw JSON array of slide objects that EXACTLY matches this schema. Do not include markdown wrappers.
[
  {
    "slide": 1,
    "title": "Title of the Slide",
    "bullets": [
      "First key point",
      "Second key point"
    ],
    "speakerNotes": "Details that the speaker should mention..."
  }
]

Document Context:
${documentText.substring(0, 40000)}
`;

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
    } catch (aiError: any) {
      console.error("PPT Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    const markdownOut = response.text();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(markdownOut);
    } catch (e) {
      console.error("JSON Parse failed on raw AI output:", e);
      try {
        const cleaned = markdownOut.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedJson = JSON.parse(cleaned);
      } catch (cleanError) {
        throw new Error("AI returned malformed JSON");
      }
    }
    
    return NextResponse.json({ slides: parsedJson });

  } catch (error: any) {
    console.error("PPT Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
