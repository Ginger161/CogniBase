import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { db } from "../../../../lib/firebase";
import { getDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import { checkClash } from "../../../../lib/utils/timetable";
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { messages, activeFileId, sessionId, userProfile } = await req.json();

    if (!messages || messages.length === 0 || !userProfile) {
      return NextResponse.json({ error: "Missing messages or user context." }, { status: 400 });
    }

    const query = messages[messages.length - 1].content;

    let systemInstruction = `YOU ARE AN ELITE ACADEMIC TUTOR AND EXAM STRATEGIST. Your sole purpose is to help university students master their course materials, synthesize complex information, and ace their exams. You are empathetic, proactive, and highly structured.

CORE BEHAVIORS:
1. EMPATHY & PACING: If a student says 'I don't know anything' or is overwhelmed, validate their feelings. Respond with: 'That's completely fine, we will take it step-by-step. Let's start with the foundation.' DO NOT bombard them with massive walls of text. Provide information in digestible chunks.
2. PROACTIVITY: NEVER leave the conversation hanging. Always end your response with a proactive hook to guide the student's next step. Examples: 'Does this make sense, or should I break down [Specific Concept] further?' or 'Would you like to test your knowledge on this with a quick 5-question quiz?'
3. STRIP JARGON (ELI5): Translate heavy academic phrasing into plain, everyday language. Use simple, real-world analogies to explain abstract concepts.
4. EXAM PRIORITIZATION: Analyze uploaded materials specifically for what examiners test: definitions, classifications, frameworks (like PESTLE), and implications. Ignore fluff.
5. MEMORY AIDS: Actively create mnemonics (like acronyms), summary tables, and visual structures to help the student retain information rapidly. 
6. THE 'GOLDEN THREAD': When analyzing multiple documents, always provide a 'Golden Thread'—a unifying concept that ties all the notes together so the student understands the big picture.
7. DUAL DELIVERY: When simplifying complex jargon into layman's terms, you must ALWAYS explicitly preserve and bold the precise academic keywords, definitions, or frameworks required for university-level exam scoring.
8. SEMANTIC GRADING: When evaluating short-answer mock tests, do not look for verbatim matches. Grade based on whether the student accurately grasped the core conceptual mechanism or theory, providing partial credit and constructive gap analysis where applicable.

MOCK TEST PROTOCOL:
If asked for a test, generate a structured exam based strictly on the uploaded materials. Include a mix of Multiple Choice, True/False, Fill-in-the-Blank, and Short Answer questions. Emulate the style of Nigerian University exams (direct, concept-focused, not trick questions). Invite the student to answer them and wait to grade their responses.

BOUNDARIES:
You are elite at studying, research, and academia. If asked to generate images, write code (unless for a CS class), or do business strategy outside of an academic context, politely decline and steer the conversation back to their studies.
You have access to the user's cloud Vault database. When they mention an uploaded file name, the system will automatically inject its contents into your context window. Never tell the user you cannot access local files; the files are securely stored on our servers.`;

    // 1. Use conversation history injected directly from the frontend
    let dbHistory = messages.slice(0, -1);
    const userId = userProfile.userId || (messages[0]?.userId) || "unknown"; // Or fetch from context if passed

    // 2. Fetch original file metadata if activeFileId exists, OR Auto-Fetch based on course code
    let activeFileContext = "";
    
    // Auto-Fetch Trigger: Detect active course code from user's profile
    let activeCourseCode = null;
    const userCourses = userProfile.courses || [];
    for (const c of userCourses) {
      if (query.toUpperCase().includes(c.courseCode.toUpperCase())) {
         activeCourseCode = c.courseCode.toUpperCase();
         break;
      }
    }

    // Vault Interceptor Trigger: Detect filename mentions
    let activeFileName = null;
    const filenameMatch = query.match(/[\w\s-]+\.(pdf|docx|txt|pptx|xlsx|csv)/i);
    if (filenameMatch) {
       activeFileName = filenameMatch[0].trim();
    } else {
       const docMatch = query.match(/document:?\s+([^\s,.]+)/i);
       if (docMatch && docMatch[1].length > 3) {
          activeFileName = docMatch[1].replace(/['"]/g, '').trim();
       }
    }

    let extractedText = "";
    let fileName = "";
    if (activeFileId) {
       const fileDoc = await getDoc(doc(db, 'vault_files', activeFileId));
       if (fileDoc.exists()) {
          const fileData = fileDoc.data() as { name?: string; fileName?: string; extractedText?: string };
          fileName = fileData.name || fileData.fileName || '';
          extractedText = fileData.extractedText || '';
       }
    }

    // Wait to calculate totalContextSize until all files are fetched.

    if (activeCourseCode || activeFileName) {
       // Two-Pass Database Query
       const vq = query(collection(db, 'vault_files'), where('userId', '==', userId));
       const vaultSnap = await getDocs(vq);
       
       // PASS 1: Extract lightweight metadata
       const metadataList = vaultSnap.docs.map(d => {
          const data = d.data() as { name?: string; fileName?: string; extractedText?: string };
          return { id: d.id, name: data.name || data.fileName || '', hasText: !!data.extractedText };
       });

       // Filtering
       const matchingIds = metadataList
          .filter(m => {
             const nameUpper = m.name.toUpperCase();
             if (activeCourseCode && nameUpper.includes(activeCourseCode)) return true;
             if (activeFileName && nameUpper.includes(activeFileName.toUpperCase())) return true;
             return false;
          })
          .map(m => m.id);

       let combinedCourseText = "";
       
       if (matchingIds.length > 0) {
          // PASS 2: Fetch full payload for specific IDs
          for (const id of matchingIds) {
             const fileDoc = await getDoc(doc(db, 'vault_files', id));
             if (fileDoc.exists()) {
                const data = fileDoc.data() as { name?: string; fileName?: string; extractedText?: string };
                combinedCourseText += `\n--- Document: ${data.name || data.fileName} ---\n${data.extractedText || 'No text extracted'}\n`;
             }
          }
          const triggerReason = activeCourseCode ? `Course Material for ${activeCourseCode}` : `Requested File: ${activeFileName}`;
          activeFileContext = `\n${triggerReason}:\n${combinedCourseText}\n`;
          extractedText = combinedCourseText; // For token truncation calculation
       } else {
          // Fallback Handling
          if (activeCourseCode) {
              activeFileContext = `\nSYSTEM ALERT: The user asked about ${activeCourseCode}, but no uploaded materials were found for this course in the vault. You MUST inform the user that you cannot answer because they haven't uploaded notes for ${activeCourseCode} yet, and politely ask them to upload the relevant materials.\n`;
          } else if (activeFileName) {
              activeFileContext = `\nSYSTEM ALERT: The user asked to use the document '${activeFileName}', but no such document was found in their vault. Inform the user they need to upload this document first.\n`;
          }
       }
    } else if (activeFileId) {
       activeFileContext = `\nActive Document Context (Prioritize this if the user asks about the 'current' file):\nTitle: ${fileName}\nExtracted Text: ${extractedText || 'No text extracted'}\n`;
    }

    // 3. Token Exhaustion Mitigation (600,000 threshold)
    let totalContextSize = JSON.stringify(dbHistory).length + extractedText.length;
    if (totalContextSize > 600000) {
       // Prioritize truncating oldest chat history
       if (dbHistory.length > 5) {
          dbHistory = dbHistory.slice(-5);
          totalContextSize = JSON.stringify(dbHistory).length + extractedText.length;
       }
       // If still too large, slice activeFileContext from the end
       if (totalContextSize > 600000) {
          const maxFileLength = Math.max(0, 600000 - JSON.stringify(dbHistory).length - 500);
          extractedText = extractedText.substring(0, maxFileLength);
          if (activeCourseCode) {
             activeFileContext = `\nCourse Material for ${activeCourseCode}:\n${extractedText}\n[Note: Content was truncated due to length]`;
          } else if (activeFileId) {
             activeFileContext = `\nActive Document Context (Prioritize this if the user asks about the 'current' file):\nTitle: ${fileName}\nExtracted Text: ${extractedText || 'No text extracted'}\n[Note: Content was truncated due to length]\n`;
          }
       }
    }

    const isGenericQuery = /^(summarize|explain this|what is this course about\??|explain|help|summary|what is this\??)$/i.test(query.trim());
    const hasHistory = dbHistory.length > 0 || (messages && messages.length > 0);

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
    const formattedHistory = dbHistory
      .filter((msg: any) => msg.type !== 'action_required' && msg.role !== 'system')
      .map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || '' }]
      }));

    // Prevent 'user' role mismatches by ensuring history alternates correctly 
    // Gemini strictly requires roles to alternate and begin with 'user'
    let validHistory = [];
    let expectedRole = 'user';
    for (const msg of formattedHistory) {
      if (msg.role === expectedRole) {
        validHistory.push(msg);
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }

    const chatSession = chatModel.startChat({ history: validHistory });
    
    const prompt = `Use the following context to answer the user's question.
    
    User Profile Context (Name, School, Department, Courses):
    ${JSON.stringify(userProfile)}
    ${activeFileContext}
    Vault Document Context:
    ${context ? context : "No specific file context provided."}
    
    Question: ${query}`;

    const chatResult = await chatSession.sendMessageStream(prompt);
    const iterator = chatResult.stream[Symbol.asyncIterator]();
    const firstChunkResult = await iterator.next();

    if (firstChunkResult.done) {
       return NextResponse.json({ error: "No response generated." }, { status: 500 });
    }

    const firstChunk = firstChunkResult.value;
    const functionCalls = firstChunk.functionCalls();
    
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

    // Return a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (firstChunk.text()) {
             controller.enqueue(new TextEncoder().encode(firstChunk.text()));
          }
          for await (const chunk of iterator) {
             if (chunk.text()) {
                controller.enqueue(new TextEncoder().encode(chunk.text()));
             }
          }
        } catch (err) {
          console.error("Stream error", err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (error: any) {
    console.error("Query Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate response" }, { status: 500 });
  }
}
