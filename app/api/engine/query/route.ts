import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { query, userId } = await req.json();

    if (!query || !userId) {
      return NextResponse.json({ error: "Missing query or user context." }, { status: 400 });
    }

    // 1. Embed the user's query using the same model as the ingest engine
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const queryResult = await embeddingModel.embedContent(query);
    const queryEmbedding = queryResult.embedding.values;

    // 2. Query Pinecone for the most similar context
    const index = pc.index(process.env.PINECONE_INDEX as string);
    const pineconeResult = await index.query({
      vector: queryEmbedding,
      topK: 3,
      filter: { userId: userId },
      includeMetadata: true
    });

    // 3. Format the context for Gemini
    const context = pineconeResult.matches
      .map(match => match.metadata?.text)
      .join("\n\n");

    // 4. Generate the final answer using Gemini
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are CogniBase, a helpful study assistant. Use the following context to answer the user's question. If the answer is not in the context, say you don't know. 
    
    Context:
    ${context}
    
    Question: ${query}`;

    const chatResult = await chatModel.generateContent(prompt);
    const answer = chatResult.response.text();

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error("Query Error:", error);
    return NextResponse.json({ error: "Failed to query the AI brain." }, { status: 500 });
  }
}
