import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { parseOffice } from "officeparser";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { fileUrl, text: providedText } = await req.json();

    let text = providedText || '';
    let mimeType = 'text/plain';
    let buffer = Buffer.from('');

    if (!providedText) {
      if (!fileUrl || typeof fileUrl !== 'string') {
        return NextResponse.json({ error: "Missing fileUrl or text." }, { status: 400 });
      }

      console.log("Fetching fileUrl:", fileUrl);
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        console.error(`Failed to fetch file. Status: ${fileRes.status} ${fileRes.statusText}`);
        if (fileRes.status === 404) {
          return NextResponse.json({ error: "The file could not be found on the storage server. It may have been deleted or expired." }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to fetch file from storage provider. Status: ${fileRes.status}` }, { status: fileRes.status });
      }
      const arrayBuffer = await fileRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      
      const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
      mimeType = rawContentType.split(';')[0].trim();
      
      let ext: any = mimeType.includes("csv") ? "csv" 
                : mimeType.includes("spreadsheetml") ? "xlsx" 
                : mimeType.includes("officedocument.presentationml") ? "pptx"
                : mimeType.includes("officedocument.wordprocessingml") ? "docx"
                : mimeType.includes("text/plain") ? "txt"
                : "pdf"; // Fallback extension
                
      try {
        if (ext === 'txt') {
          text = buffer.toString('utf-8');
        } else {
          const doc = await parseOffice(buffer, { fileType: ext });
          text = doc.toText();
        }
      } catch (err) {
        console.error("Parser error:", err);
        // Fallback for PDFs if officeparser fails or is incomplete
        text = "Attached document content for extraction."; // Simplified fallback
      }
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Document text could not be extracted or downloaded from storage. Please try again." }, { status: 400 });
    }

    const model = getAIModel('simple');
    
    const prompt = `You are an expert tutor. Read the following text context from an uploaded document and extract the most important concepts, definitions, and theories. Output a strict JSON array of objects, where each object has exactly two keys: "front" (the term, question, or concept) and "back" (the definition, answer, or explanation). Do not include any markdown formatting or backticks. Return ONLY the raw JSON array.

Context:
${text.substring(0, 40000)} // Limit context if very large
`;

    // If text extraction failed completely and we just have the fallback string, we can't do much. 
    // Ideally we should pass the raw buffer to Gemini like in the timetable route, but officeparser should work for most formats.
    let contentParts: any[] = [prompt];
    if (text === "Attached document content for extraction.") {
       // Passing document as inline data for gemini-1.5 multimodal if parsing failed
       contentParts = [
         prompt, 
         { inlineData: { data: buffer.toString('base64'), mimeType } }
       ];
    }

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: "user", parts: contentParts.map(p => typeof p === 'string' ? { text: p } : p) }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
    } catch (aiError: any) {
      console.error("Flashcard Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    let out = response.text();
    
    // Clean up potential markdown formatting
    out = out.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(out);
      if (!Array.isArray(parsed)) {
          return NextResponse.json({ flashcards: [parsed] });
      }
      return NextResponse.json({ flashcards: parsed });
    } catch(e) {
      console.error("Failed to parse flashcards JSON:", out);
      return NextResponse.json({ error: "Failed to generate valid flashcards format." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Flashcard Gen Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
