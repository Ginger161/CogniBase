import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(req.url);
    const includeEmpty = searchParams.get('includeEmpty') === 'true';

    const whereClause: any = {
      userId: user.id
    };

    if (!includeEmpty) {
      whereClause.documents = { some: {} };
    }

    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
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
    const { user, response } = await requireUser();
    if (!user) return response;

    const newWorkspace = await prisma.workspace.create({
      data: {
        title: 'Untitled workspace',
        userId: user.id
      }
    });

    return NextResponse.json(newWorkspace);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
