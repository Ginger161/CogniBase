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

    // 1. Enable RLS
    await client.query(`ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Timetable" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;`);
    console.log("✅ RLS Enabled on all core tables.");

    // Helper to safely drop existing policies before creating new ones
    const dropPolicy = async (table: string, policyName: string) => {
        try {
            await client.query(`DROP POLICY IF EXISTS "${policyName}" ON "${table}";`);
        } catch (e) {}
    };

    // 2. User Policies
    await dropPolicy('User', 'Users can manage their own profile');
    await client.query(`
        CREATE POLICY "Users can manage their own profile" ON "User"
        FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);
    `);

    // 3. Workspace Policies
    await dropPolicy('Workspace', 'Users can manage their own workspaces');
    await client.query(`
        CREATE POLICY "Users can manage their own workspaces" ON "Workspace"
        FOR ALL USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
    `);

    // 4. Timetable Policies
    await dropPolicy('Timetable', 'Users can manage their own timetables');
    await client.query(`
        CREATE POLICY "Users can manage their own timetables" ON "Timetable"
        FOR ALL USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
    `);

    // 5. Document Policies
    await dropPolicy('Document', 'Users can manage documents in their workspaces');
    await client.query(`
        CREATE POLICY "Users can manage documents in their workspaces" ON "Document"
        FOR ALL USING (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Document"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Document"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        );
    `);

    // 6. Message Policies
    await dropPolicy('Message', 'Users can manage messages in their workspaces');
    await client.query(`
        CREATE POLICY "Users can manage messages in their workspaces" ON "Message"
        FOR ALL USING (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Message"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM "Workspace" WHERE "Workspace".id = "Message"."workspaceId" AND "Workspace"."userId" = auth.uid()::text)
        );
    `);

    console.log("✅ RLS Policies Created successfully!");
  } catch (err) {
    console.error("❌ SQL Error:", err);
  } finally {
    await client.end();
  }
}

run();
