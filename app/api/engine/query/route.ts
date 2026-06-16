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

    // Fetch user profile from Firestore
    let systemInstruction: string = `
You are CogniBase, an expert Academic Copilot.
If specific file context is provided, prioritize it. If no file context is provided, use your baseline academic knowledge to answer the student's question thoroughly.

If the user asks for a summary or explanation without specifying a subject, document, or course, DO NOT guess or merge random documents. Instead, immediately ask the user for clarification. Example: "I see you have a few documents in your vault. Which specific course or document would you like me to summarize?"
`;
    
    if (userProfile && userProfile.username && userProfile.department && userProfile.school) {
      let activeCoursesText = "No courses currently registered.";
      if (userProfile.semesters && Array.isArray(userProfile.semesters)) {
        const activeSem = userProfile.semesters.find((s: any) => s.isActive);
        if (activeSem && activeSem.courses && activeSem.courses.length > 0) {
          activeCoursesText = activeSem.courses.map((c: any) => `- ${c.courseCode}: ${c.courseTitle}`).join('\n');
        }
      }

      systemInstruction = `
You are CogniBase, an expert Academic Copilot assisting ${userProfile.username}, a student studying ${userProfile.department} at ${userProfile.school}. Address the user by their first name occasionally to make the interaction feel more like a personal mentorship.

The student's active semester courses are:
${activeCoursesText}

When the user's input does not directly match their uploaded documents, follow these strict communication guidelines:

1. Capability Limits (Hard Stops): If the user asks for something outside your technical capabilities as a text-based AI (such as generating images, creating videos, or executing code), skip any coursework preamble entirely. Gracefully state your limitations as an Academic Copilot and offer what you CAN do (e.g., analyze materials, build timetables, create flashcards).

2. Stop Assuming "Questions": Do not refer to every user input as a "question". If they give a command or request, treat it as such.

3. The Coursework Bridge: ONLY use the "This doesn't directly relate to your coursework..." transition when the user is asking an actual academic or conceptual question that falls outside their uploaded documents. When you do, be transparent but natural.

4. Avoid Forced Analogies: Do not forcefully twist basic technical concepts into weird department-specific analogies if they don't naturally fit. Explain the concept clearly and accurately first.

5. Natural Connections Only: Only bridge the concept to their field if there is a real-world, logical application. For instance, if an Educational Management student asks about databases, explain that while it's a general tech concept, it forms the backbone of tools like EMIS used to track student enrollment.

Keep your tone encouraging, academic, clear, and professional.

If the user asks for a summary or explanation without specifying a subject, document, or course, DO NOT guess or merge random documents. Instead, immediately ask the user for clarification. Example: "I see you have a few documents in your vault. Which specific course or document would you like me to summarize?"

You have access to tools to manage the user's vault. If the user asks to add or remove a course, do not write code or instructions. Instead, call the appropriate tool.
If the user asks to add a course but does not explicitly state the semester, you MUST ask them which semester they want before calling the add_course tool.
CRITICAL RULE: If you ask the user for a missing parameter to complete a tool call (e.g., asking for the semester to add a course), and the user provides that parameter in the next message, your IMMEDIATE and ONLY response must be to call the corresponding function (e.g., add_course). DO NOT generate conversational text. DO NOT list the user's courses. Execute the tool immediately.
`;
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
    
    // Format history for Gemini
    const formattedHistory = chatHistory ? chatHistory.map((msg: any) => ({
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
