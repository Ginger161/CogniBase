import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai/model-router";
import { parseOffice } from "officeparser";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
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
        text = doc.toText();
      }
    } catch (err) {
      console.error("Parser error:", err);
      text = "Attached document content for extraction.";
    }

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: "Document text could not be extracted or downloaded from storage. Please try again." }, { status: 400 });
    }

    const model = getAIModel('complex');
    
    const prompt = `You are a master tutor. Create a beautifully formatted markdown study guide based ONLY on the following requested section of the document.
Requested Section: ${sectionConstraint}

Format the output with clear headings (##, ###), bullet points, bold terms, and structured sections to maximize learning efficiency. Do not include any JSON formatting, just output the raw markdown text.

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
        contents: [{ role: "user", parts: contentParts.map(p => typeof p === 'string' ? { text: p } : p) }]
      });
    } catch (aiError: any) {
      console.error("Study Guide Gen Error:", aiError);
      return NextResponse.json({ error: aiError.message || "Failed to communicate with AI model." }, { status: 500 });
    }
    
    const response = await result.response;
    const markdownOut = response.text();
    
    return NextResponse.json({ studyGuide: markdownOut });

  } catch (error: any) {
    console.error("Study Guide Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
