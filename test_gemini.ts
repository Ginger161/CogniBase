import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent([
      "What is this image?",
      {
        inlineData: {
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", // 1x1 transparent png
          mimeType: "image/png"
        }
      }
    ]);
    console.log("Success with gemini-3.5-flash:", result.response.text());
  } catch (e: any) {
    console.error("Error with gemini-3.5-flash:", e.message);
  }
}
run();
