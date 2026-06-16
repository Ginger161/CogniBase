import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const getAIModel = (taskType: 'simple' | 'complex') => {
  if (taskType === 'simple') {
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  } else if (taskType === 'complex') {
    return genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  }
  
  // Fallback
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
};
