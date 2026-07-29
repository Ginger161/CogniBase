import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/USER/CogniBase/.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent("Hello, what are you?");
    console.log("Success with gemini-flash-latest:", result.response.text());
  } catch (e: any) {
    console.error("Error with gemini-flash-latest:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent("Hello");
    console.log("Success with gemini-embedding-001");
  } catch (e: any) {
    console.error("Error with gemini-embedding-001:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent("Hello");
    console.log("Success with text-embedding-004");
  } catch (e: any) {
    console.error("Error with text-embedding-004:", e.message);
  }
}

run();
