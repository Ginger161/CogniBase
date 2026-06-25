import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    // Alter the column to 768 dimensions as requested
    await client.query(`
      ALTER TABLE "DocumentChunk" ALTER COLUMN embedding TYPE vector(768);
    `);

    // Create HNSW index for L2 distance (which maps to <-> operator)
    await client.query(`
      CREATE INDEX IF NOT EXISTS "embeddingIndex" 
      ON "DocumentChunk" 
      USING hnsw (embedding vector_l2_ops);
    `);
    
    console.log("✅ Vector Index 'embeddingIndex' created successfully!");

  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();
