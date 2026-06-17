import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const getAIModel = (taskType: 'simple' | 'complex') => {
  if (taskType === 'simple') {
    return genAI.getGenerativeModel({ model: "gemini-pro" });
  } else if (taskType === 'complex') {
    return genAI.getGenerativeModel({ model: "gemini-pro" });
  }
  
  // Fallback
  return genAI.getGenerativeModel({ model: "gemini-pro" });
};
