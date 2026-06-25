import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to DB via pg!");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "username" TEXT,
          "school" TEXT,
          "department" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created User table.");

    try {
      await client.query(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email");`);
    } catch(e:any) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Workspace" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "userId" TEXT,
          CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Workspace table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Message" (
          "id" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "workspaceId" TEXT NOT NULL,
          CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Message table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Document" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "workspaceId" TEXT NOT NULL,
          CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Document table.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Timetable" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Timetable table.");

    // Add foreign keys
    try { await client.query(`ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Document" ADD CONSTRAINT "Document_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}
    try { await client.query(`ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`); } catch(e:any) {}

    console.log("Schema updated successfully via SQL!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();
