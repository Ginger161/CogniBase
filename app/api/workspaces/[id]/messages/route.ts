import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
    if (!workspace) return ownerResp;

    const messages = await prisma.message.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
