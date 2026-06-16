import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseOffice } from "officeparser";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing image or mimeType." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `First, evaluate the document. If it does not contain a recognizable timetable or schedule, immediately return a JSON object exactly like this: { "error": "NOT_A_TIMETABLE" }. Do not attempt to guess.\n\nRegardless of the input format (handwritten photo, Excel sheet, plain text), extract all detected classes into this standardized JSON format. Return ONLY a clean JSON array of objects. Each object must have the following exact keys: "courseCode" (e.g. "CSC 101"), "day" (e.g. "Monday", "Tuesday"), "startTime" (e.g. "10:00 AM"), "endTime" (e.g. "11:30 AM"), and "location" (e.g. "Room 404"). If the location is missing, set it to an empty string. Do not include any markdown backticks. Return the raw JSON array or the error object.`;

    let contentParts: any[] = [];
    
    // Check if it's an office document or csv
    if (mimeType.includes("officedocument") || mimeType.includes("ms-excel") || mimeType.includes("csv") || mimeType.includes("text/csv") || mimeType.includes("msword")) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const ext = mimeType.includes("csv") ? "csv" 
                : mimeType.includes("spreadsheetml") ? "xlsx" 
                : mimeType.includes("ms-excel") ? "xls" 
                : "docx";
                
      try {
        const doc = await parseOffice(buffer, { fileType: ext });
        contentParts = [doc.toText()];
      } catch (err) {
        console.error("Office parser error:", err);
        return NextResponse.json({ error: "Failed to parse document format." }, { status: 400 });
      }
    } else {
      contentParts = [
        {
          inlineData: {
            data: imageBase64,
            mimeType
          },
        },
      ];
    }

    const result = await model.generateContent([prompt, ...contentParts]);
    const response = await result.response;
    let text = response.text();
    
    // Clean up potential markdown formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      if (parsed.error === 'NOT_A_TIMETABLE') {
        return NextResponse.json({ error: "Invalid document: No timetable detected." }, { status: 400 });
      }
      if (!Array.isArray(parsed)) {
          return NextResponse.json({ timetable: [parsed] });
      }
      return NextResponse.json({ timetable: parsed });
    } catch(e) {
      console.error("JSON Parsing failed", text);
      return NextResponse.json({ error: "Failed to parse JSON", rawText: text }, { status: 500 });
    }

  } catch (error) {
    console.error("Course extraction error:", error);
    return NextResponse.json({ error: "Internal error processing the image." }, { status: 500 });
  }
}
