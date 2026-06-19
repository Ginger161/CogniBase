import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../../../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import crypto from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { fileUrl, userId, semesterId } = await req.json();

    if (!fileUrl || !userId || !semesterId) {
      return NextResponse.json({ error: "Missing fileUrl, userId, or semesterId." }, { status: 400 });
    }

    // Step 4: Backend API fetches the file from the URL
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error("Failed to fetch file from URL");
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString('base64');
    
    // Extract dynamic MIME type, stripping out any charset directives
    const rawContentType = fileRes.headers.get('content-type') || 'application/pdf';
    const mimeType = rawContentType.split(';')[0].trim();

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const cacheRef = doc(db, 'extracted_forms', fileHash);

    // Defense Layer 1: Smart Caching
    try {
      const cacheDoc = await getDoc(cacheRef);
      if (cacheDoc.exists()) {
        console.log(`Cache hit for file hash: ${fileHash}`);
        return NextResponse.json({ success: true, courses: cacheDoc.data().courses });
      }
    } catch (e) {
      // Gracefully continue if Firestore permission denies the unauthenticated backend read
      console.error("Cache read error:", e);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `First, verify if this document is a university course registration form or student schedule. If it is NOT, do not extract any courses. Instead, return a JSON object containing strictly: { "error": "invalid_document" }.\n\nIf it IS a valid form, you are analyzing a university course registration form. This form may contain multiple semesters. Please extract the courses and the semester they belong to. Return ONLY a raw JSON array of objects with keys "courseCode", "courseTitle", and "semester" (strictly string values of either 'First' or 'Second').\n\nCRITICAL: Do NOT wrap the response in markdown code blocks (e.g., no \`\`\`json). Return ONLY the raw array bracket structure or the error JSON object.`;
    const imageParts = [{ inlineData: { data: imageBase64, mimeType } }];

    // Defense Layer 2: Exponential Backoff (Invisible Retries)
    let extractedCourses = null;
    let attempt = 0;
    const backoffDelays = [2000, 4000, 8000, 12000, 15000];
    const maxAttempts = backoffDelays.length;

    while (attempt < maxAttempts) {
      try {
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (text.startsWith('`') && text.endsWith('`')) {
          text = text.substring(1, text.length - 1).trim();
        }
        
        const parsed = JSON.parse(text);
        if (parsed.error === 'invalid_document') {
          return NextResponse.json({ error: "Please upload a valid course form. We couldn't find your courses in this document." }, { status: 400 });
        }
        
        extractedCourses = Array.isArray(parsed) ? parsed : [parsed];
        break; // Success! Break the retry loop
      } catch (err: any) {
        attempt++;
        const errMsg = String(err.message || err);
        console.error(`Gemini Attempt ${attempt} failed: ${errMsg}`);
        
        if (attempt >= maxAttempts) {
          throw err; // Out of retries, throw the final error
        }
        
        // Retry on rate limits (429), server overloads (503), or network issues
        if (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('fetch failed')) {
          const delay = backoffDelays[attempt - 1];
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          // Do not retry fatal errors (like 400 Bad Request or JSON Parsing crashes)
          throw err; 
        }
      }
    }

    // Save successful extraction to Cache
    if (extractedCourses) {
      try {
        await setDoc(cacheRef, { 
          courses: extractedCourses, 
          createdAt: new Date().toISOString() 
        });
        console.log(`Saved extracted courses to cache for hash: ${fileHash}`);
      } catch (e) {
        console.error("Cache write error:", e);
      }
    }

    return NextResponse.json({ success: true, courses: extractedCourses });
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
