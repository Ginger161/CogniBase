// @ts-nocheck
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Ensure you have a serviceAccountKey.json in the scripts folder or root
// Or initialize using default credentials if running in an environment with GOOGLE_APPLICATION_CREDENTIALS
let db: FirebaseFirestore.Firestore;

try {
  const serviceAccountPath = path.resolve(process.cwd(), 'cognibase-4fd12-firebase-adminsdk-fbsvc-c7c13ee143.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } else {
    console.error("Could not find service-account.json file at", serviceAccountPath);
    process.exit(1);
  }
  db = getFirestore();
} catch (error) {
  console.error("Firebase Admin Initialization Error. Please ensure you provide a valid FIREBASE_SERVICE_ACCOUNT environment variable.");
  process.exit(1);
}

async function migrateData() {
  console.log("🚀 Starting Data Migration: Firebase -> Supabase/Prisma");

  try {
    // 1. Migrate Users
    console.log("Migrating Users...");
    const usersSnap = await db.collection('users').get();
    const usersToInsert = usersSnap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || `${doc.id}@placeholder.com`,
        username: data.username || data.name || null,
        school: data.school || null,
        department: data.department || null,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      };
    });

    for (const user of usersToInsert) {
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          update: user,
          create: user,
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          // Unique constraint failed, likely a duplicate email in Firebase.
          console.warn(`⚠️ Skipping user ${user.id} due to duplicate email: ${user.email}`);
        } else {
          throw e;
        }
      }
    }
    console.log(`✅ Migrated ${usersToInsert.length} Users`);

    // 2. Migrate Timetables
    console.log("Migrating Timetables...");
    const timetablesSnap = await db.collection('timetables').get();
    const timetablesToInsert = timetablesSnap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id, // Or generate new cuid if needed, but we can reuse the Firebase document ID
        userId: doc.id, // Assuming doc.id is the userId based on context
        data: data,
      };
    });

    for (const timetable of timetablesToInsert) {
      // Ensure the user exists before inserting the timetable to avoid foreign key constraints
      const userExists = await prisma.user.findUnique({ where: { id: timetable.userId } });
      if (userExists) {
        await prisma.timetable.upsert({
          where: { id: timetable.id },
          update: { data: timetable.data },
          create: timetable,
        });
      }
    }
    console.log(`✅ Migrated Timetables`);

    // 3. Migrate Chats (to Workspaces) and Messages
    console.log("Migrating Chats & Messages...");
    const chatsSnap = await db.collection('chats').get();
    
    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data();
      const workspaceId = chatDoc.id;
      const userId = chatData.userId;

      // Ensure user exists
      const userExists = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
      
      // Create Workspace
      await prisma.workspace.upsert({
        where: { id: workspaceId },
        update: {
          title: chatData.title || 'Untitled Chat',
          updatedAt: chatData.updatedAt ? chatData.updatedAt.toDate() : new Date(),
        },
        create: {
          id: workspaceId,
          title: chatData.title || 'Untitled Chat',
          userId: userExists ? userId : null,
          createdAt: chatData.createdAt ? chatData.createdAt.toDate() : new Date(),
          updatedAt: chatData.updatedAt ? chatData.updatedAt.toDate() : new Date(),
        }
      });

      // Migrate Subcollection Messages
      const messagesSnap = await chatDoc.ref.collection('messages').get();
      const messagesToInsert = messagesSnap.docs.map((msgDoc: any) => {
        const msgData = msgDoc.data();
        return {
          id: msgDoc.id,
          role: msgData.role || 'user',
          text: msgData.text || '',
          createdAt: msgData.createdAt ? msgData.createdAt.toDate() : new Date(),
          workspaceId: workspaceId,
        };
      });

      for (const msg of messagesToInsert) {
        await prisma.message.upsert({
          where: { id: msg.id },
          update: msg,
          create: msg,
        });
      }
    }
    console.log(`✅ Migrated ${chatsSnap.docs.length} Chats and their Messages`);

    console.log("🎉 Migration Complete!");
  } catch (error) {
    console.error("❌ Migration Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
