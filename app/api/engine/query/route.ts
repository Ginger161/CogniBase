import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { db } from "../../../../lib/firebase";
import { getDoc, doc } from "firebase/firestore";
import { checkClash } from "../../../../lib/utils/timetable";
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { query, userId, chatHistory, userProfile } = await req.json();

    if (!query || !userId) {
      return NextResponse.json({ error: "Missing query or user context." }, { status: 400 });
    }

    let systemInstruction = `You are a data-processing terminal. 
- NO personality. 
- NO conversational fluff. 
- If the user provides a query (e.g., 'VUA EDM 201'), treat it as a search command. 
- Search the database for the material. 
- If found: return the content/summary. 
- If not found or command unrecognized: return 'Error: Command not found'.`;

    const isGenericQuery = /^(summarize|explain this|what is this course about\??|explain|help|summary|what is this\??)$/i.test(query.trim());
    const hasHistory = chatHistory && chatHistory.length > 0;

    let context = "";

    // 1. If it's a generic query without history, skip Pinecone to avoid blind querying
    if (!isGenericQuery || hasHistory) {
      // Embed the user's query using the same model as the ingest engine
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const queryResult = await embeddingModel.embedContent(query);
      const queryEmbedding = queryResult.embedding.values;

      // Query Pinecone for the most similar context
      const index = pc.index(process.env.PINECONE_INDEX as string);
      const pineconeResult = await index.query({
        vector: queryEmbedding,
        topK: 3,
        filter: { userId: userId },
        includeMetadata: true
      });

      // Format the context for Gemini
      context = pineconeResult.matches
        .map(match => match.metadata?.text)
        .join("\n\n");
    }

    // 4. Generate the final answer using Gemini
    const addCourseTool: FunctionDeclaration = {
      name: "add_course",
      description: "Adds a new course to the user's active semester.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          courseCode: { type: SchemaType.STRING, description: "The course code (e.g., CS101)." },
          courseTitle: { type: SchemaType.STRING, description: "The title of the course." },
          semester: { type: SchemaType.STRING, description: "The semester for the course. Must be First, Second, or Summer." },
        },
        required: ["courseCode", "courseTitle", "semester"],
      },
    };

    const deleteCourseTool: FunctionDeclaration = {
      name: "delete_course",
      description: "Deletes a course from the user's active semester.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          courseCode: { type: SchemaType.STRING, description: "The course code to delete." },
        },
        required: ["courseCode"],
      },
    };

    const addToTimetableTool: FunctionDeclaration = {
      name: "add_to_timetable",
      description: "Adds a scheduled class to the user's timetable.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          courseCode: { type: SchemaType.STRING, description: "The course code (e.g., CS101)." },
          day: { type: SchemaType.STRING, description: "The day of the week (e.g., Monday)." },
          startTime: { type: SchemaType.STRING, description: "Start time in HH:MM format (e.g., 09:00)." },
          endTime: { type: SchemaType.STRING, description: "End time in HH:MM format (e.g., 10:30)." },
        },
        required: ["courseCode", "day", "startTime", "endTime"],
      },
    };

    const modelConfig: any = { 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [addCourseTool, deleteCourseTool, addToTimetableTool] }]
    };
    const chatModel = genAI.getGenerativeModel(modelConfig);
    
    // Format history for Gemini (keep only last 5 interactions)
    const formattedHistory = chatHistory ? chatHistory.slice(-5).map((msg: any) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    })) : [];

    const chatSession = chatModel.startChat({ history: formattedHistory });
    
    const prompt = `Use the following context to answer the user's question.
    
    Context:
    ${context ? context : "No specific file context provided."}
    
    Question: ${query}`;

    const chatResult = await chatSession.sendMessage(prompt);
    
    const functionCalls = chatResult.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      // Guardrail for Timetable Clashes
      if (call.name === "add_to_timetable") {
        const timetablesDoc = await getDoc(doc(db, 'timetables', userId));
        if (timetablesDoc.exists()) {
          const data = timetablesDoc.data();
          const scheduledClasses = data.scheduled_classes || [];
          const clashResult = checkClash(call.args as any, scheduledClasses);
          
          if (clashResult.hasClash) {
            return NextResponse.json({ 
              type: 'action_required', 
              action: call.name, 
              payload: call.args,
              error: { status: 'clash', existingCourse: clashResult.clashingCourse }
            });
          }
        }
      }

      return NextResponse.json({ 
        type: 'action_required', 
        action: call.name, 
        payload: call.args 
      });
    }

    const answer = chatResult.response.text();

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error("Query Error:", error);
    const fallbackAnswer = "Error: Command not found";
    return NextResponse.json({ answer: fallbackAnswer }, { status: 200 });
  }
}
