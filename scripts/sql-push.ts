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
      CREATE TABLE IF NOT EXISTS "Timetable" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "data" JSONB NOT NULL,
        CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created Timetable table.");

    try {
      await client.query(`ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("Added foreign key to Timetable.");
    } catch (e: any) {
      if (!e.message.includes("already exists")) console.error(e.message);
    }

    try {
      await client.query(`ALTER TABLE "Workspace" ADD COLUMN "userId" TEXT;`);
      console.log("Added userId to Workspace.");
    } catch (e: any) {
      if (!e.message.includes("already exists") && !e.message.includes("column \"userId\" of relation \"Workspace\" already exists")) console.error(e.message);
    }

    try {
      await client.query(`ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
      console.log("Added foreign key to Workspace.");
    } catch (e: any) {
      if (!e.message.includes("already exists")) console.error(e.message);
    }

    console.log("Schema updated successfully via SQL!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();
