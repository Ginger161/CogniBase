import { prisma } from '../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function run() {
  try {
    const text = "This is a quick test document to verify 768-dimensional vector insertion into Supabase pgvector.";
    
    // 1. Generate Embedding
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    let embedding = result.embedding.values;

    if (embedding.length > 768) {
       console.log(`Model generated ${embedding.length} dims. Slicing to 768...`);
       embedding = embedding.slice(0, 768);
    }
    
    console.log(`Final embedding length to insert: ${embedding.length}`);

    // 2. Create Dummy Document
    const doc = await prisma.document.create({
      data: {
        name: "Test Doc",
        url: "https://test.com",
        workspaceId: "global-vault-001"
      }
    });

    // 3. Insert Chunk
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding") 
       VALUES ($1, $2, $3, $4::vector)`,
      `test-chunk-1`,
      doc.id,
      text,
      `[${embedding.join(',')}]`
    );

    console.log("✅ Successfully inserted DocumentChunk with vector embedding!");
    
    // Cleanup
    await prisma.document.delete({ where: { id: doc.id } });
    
  } catch (error) {
    console.error("❌ Test Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
