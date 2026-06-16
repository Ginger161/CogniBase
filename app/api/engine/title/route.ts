import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const modelConfig: any = { 
      model: "gemini-2.5-flash",
      systemInstruction: "Generate a short, 3-to-4 word title summarizing the user's prompt. Do not use quotes, punctuation, or special formatting."
    };
    
    const chatModel = genAI.getGenerativeModel(modelConfig);
    const chatResult = await chatModel.generateContent(prompt);
    let title = chatResult.response.text().trim();
    
    // Remove wrapping quotes if Gemini adds them
    if (title.startsWith('"') && title.endsWith('"')) {
      title = title.slice(1, -1);
    }

    return NextResponse.json({ title });

  } catch (error: any) {
    console.error("Title Generation Error:", error);
    // Fallback title on error
    return NextResponse.json({ title: "New Chat" }, { status: 500 });
  }
}
