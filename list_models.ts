import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/USER/CogniBase/.env.local' });

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("Available models:");
    data.models.forEach((m: any) => console.log(m.name, "-", m.description));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

run();
