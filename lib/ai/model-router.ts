import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// Gives up before the routes' 60s maxDuration so callers can return a clear message instead of a platform 504.
const REQUEST_OPTIONS = { timeout: 50_000 };

export const getAIModel = (taskType: 'simple' | 'complex') => {
  if (taskType === 'simple') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" }, REQUEST_OPTIONS);
  } else if (taskType === 'complex') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" }, REQUEST_OPTIONS);
  }

  // Fallback
  return genAI.getGenerativeModel({ model: "gemini-3.5-flash" }, REQUEST_OPTIONS);
};
