import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const getAIModel = (taskType: 'simple' | 'complex') => {
  if (taskType === 'simple') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
  } else if (taskType === 'complex') {
    return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
  }
  
  // Fallback
  return genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
};
