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

    // 1. Intent & Sentinel State Classification
    const classificationModel = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    const classificationPrompt = `Analyze the user's query and provide a JSON response with two keys:
    1. "intent": Classify into exactly one of these categories: "Scheduling", "Strategy", "Synthesis", or "Other".
    2. "implicitState": Identify if the user is expressing stress or overload. Return "Stressed", "Overwhelmed", "Falling Behind", or "Normal".
    Query: "${query}"`;
    const classificationResult = await classificationModel.generateContent(classificationPrompt);
    
    let intent = 'Other';
    let implicitState = 'Normal';
    try {
      const parsed = JSON.parse(classificationResult.response.text().trim());
      intent = parsed.intent || 'Other';
      implicitState = parsed.implicitState || 'Normal';
    } catch(e) {
      console.error("Failed to parse classification JSON:", e);
    }

    // 2. Base System Instruction
    let systemInstruction = `You are a smart academic companion. You know the student's background but you are subtle. You only mention their specific details when it is logically relevant to help them achieve their goal. Prioritize natural, helpful communication over robotic repetition. If you are asked to build a study schedule, you MUST output it in a strict JSON format.`;

    // 3. Conditional Context Injection (Intent)
    if (intent === 'Scheduling' || intent === 'Strategy' || intent === 'Synthesis') {
      if (userProfile && userProfile.username && userProfile.department && userProfile.school) {
        let activeCoursesText = "No courses currently registered.";
        if (userProfile.semesters && Array.isArray(userProfile.semesters)) {
          const activeSem = userProfile.semesters.find((s: any) => s.isActive);
          if (activeSem && activeSem.courses && activeSem.courses.length > 0) {
            activeCoursesText = activeSem.courses.map((c: any) => `- ${c.courseCode}: ${c.courseTitle}`).join('\n');
          }
        }
        systemInstruction += `\n\nStudent Profile Context:\nName: ${userProfile.username}\nDepartment: ${userProfile.department}\nSchool: ${userProfile.school}\nActive Courses:\n${activeCoursesText}`;
      }
    }

    // 4. Sentinel Engine: Implicit Context Injection
    if (['Stressed', 'Overwhelmed', 'Falling Behind'].includes(implicitState)) {
      let timetableContext = "No timetable available.";
      try {
        const timetablesDoc = await getDoc(doc(db, 'timetables', userId));
        if (timetablesDoc.exists()) {
          const data = timetablesDoc.data();
          timetableContext = JSON.stringify(data.scheduled_classes || []);
        }
      } catch (err) {
        console.error("Sentinel failed to fetch timetable:", err);
      }
      
      systemInstruction += `\n\n[SENTINEL ENGINE ACTIVE]\nThe user is currently feeling ${implicitState}. Act as an 'Empathetic Executive'. Synthesize their current academic load against their timetable below and provide an actionable solution (e.g., rescheduling a study task) before they ask. Always end your response with an action button format wrapped in brackets, e.g., '[Action: Reschedule Thursday]' or '[Action: Show me lighter days]' that ties back into the system's ability to mutate data.\nTimetable Context: ${timetableContext}`;
    }

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
    const fallbackAnswer = "I am unable to process that specific request. However, as your Academic Copilot, I can help you analyze your course materials, build reading timetables, create flashcards, or summarize your notes. Could you rephrase your question, or let me know which of these study tools you would like to focus on?";
    return NextResponse.json({ answer: fallbackAnswer }, { status: 200 });
  }
}
