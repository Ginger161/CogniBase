import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const workspaces = await prisma.workspace.findMany({
      where: {
        userId: userId ? userId : null,
        id: { not: 'global-vault-001' },
        documents: { some: {} }
      },
      include: {
        documents: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, userEmail } = await req.json();

    let validUserId = null;
    if (userId) {
      let uEmail = userEmail;
      if (!uEmail || uEmail === 'guest@example.com') {
        uEmail = `guest_${userId}@example.com`;
      }
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: { id: userId, email: uEmail }
        });
        validUserId = userId;
      } catch (upsertError) {
        console.error("Failed to upsert user with email, trying fallback:", upsertError);
        try {
          // If unique constraint fails, forcefully create with unique email
          await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, email: `${userId}_${uEmail}` }
          });
          validUserId = userId;
        } catch(fallbackError) {
          console.error("Critical failure upserting user:", fallbackError);
          // Only if absolutely everything fails do we fallback to null
          validUserId = null;
        }
      }
    }

    const newWorkspace = await prisma.workspace.create({
      data: {
        title: 'Untitled workspace',
        userId: validUserId
      }
    });

    return NextResponse.json(newWorkspace);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
