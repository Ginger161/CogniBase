import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  console.log("Users:", await prisma.user.count());
  console.log("Timetables:", await prisma.timetable.count());
  console.log("Workspaces (Chats):", await prisma.workspace.count());
  console.log("Messages:", await prisma.message.count());
  process.exit(0);
}
check();
