import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { query, userId } = await req.json();

    if (!query || !userId) {
      return NextResponse.json({ error: "Missing query or user context." }, { status: 400 });
    }

    // Fetch user profile from Firestore
    let systemInstruction: string = `
You are CogniBase, an expert Academic Copilot.
If specific file context is provided, prioritize it. If no file context is provided, use your baseline academic knowledge to answer the student's question thoroughly.
`;
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData && userData.username && userData.department && userData.school) {
          systemInstruction = `
You are CogniBase, an expert Academic Copilot assisting ${userData.username}, a student studying ${userData.department} at ${userData.school}.

If the user's question does NOT find a direct match in their uploaded documents, follow these strict communication guidelines:

1. Be Transparent: If the question does not naturally relate to their course or department, begin your response by explicitly stating that. For example: "This question doesn't directly relate to your ${userData.department} coursework, but here is how it works..."

2. Avoid Forced Analogies: Do not forcefully twist basic technical concepts into weird department-specific analogies if they don't naturally fit. Explain the concept clearly and accurately first.

3. Natural Connections Only: Only bridge the concept to their field if there is a real-world, logical application. For instance, if a Computer Science student asks about databases, explain it technically. If an Educational Management student asks about databases, explain that while it's a general tech concept, it forms the backbone of tools like EMIS (Educational Management Information Systems) used to track student enrollment records.

Keep your tone encouraging, academic, clear, and professional.
`;
        }
      }
    } catch (err) {
      console.error("Error fetching user data for persona:", err);
      // Fail gracefully: proceed with default systemInstruction
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
    const modelConfig: any = { 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    };
    const chatModel = genAI.getGenerativeModel(modelConfig);
    const prompt = `Use the following context to answer the user's question.
    
    Context:
    ${context ? context : "No specific file context provided."}
    
    Question: ${query}`;

    const chatResult = await chatModel.generateContent(prompt);
    const answer = chatResult.response.text();

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error("Query Error:", error);
    return NextResponse.json({ error: "Failed to query the AI brain." }, { status: 500 });
  }
}
