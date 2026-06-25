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

    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("Vector extension enabled!");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "DocumentChunk" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" vector(768),
        "pageNumber" INTEGER,

        CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add foreign key constraint if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log("Foreign key constraint added!");
    } catch(e: any) {
      console.log("Constraint might already exist:", e.message);
    }

    // Enable RLS and add policies
    await client.query(`ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;`);
    
    // Policy for DocumentChunk: Same as Document (user owns the Workspace)
    await client.query(`DROP POLICY IF EXISTS "Users can manage chunks in their workspaces" ON "DocumentChunk";`);
    await client.query(`
        CREATE POLICY "Users can manage chunks in their workspaces" ON "DocumentChunk"
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM "Document" d
            JOIN "Workspace" w ON w.id = d."workspaceId"
            WHERE d.id = "DocumentChunk"."documentId" AND w."userId" = auth.uid()::text
          )
        ) WITH CHECK (
          EXISTS (
            SELECT 1 FROM "Document" d
            JOIN "Workspace" w ON w.id = d."workspaceId"
            WHERE d.id = "DocumentChunk"."documentId" AND w."userId" = auth.uid()::text
          )
        );
    `);

    console.log("✅ DocumentChunk table and RLS created successfully!");

  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();
