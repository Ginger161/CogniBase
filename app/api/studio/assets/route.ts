import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const userId = user.id;

    if (workspaceId) {
      const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
      if (!workspace) return wsResp;
    }

    const whereClause = workspaceId ? { workspaceId } : { workspace: { userId } };

    const assets = await prisma.studioAsset.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ assets });

  } catch (error: any) {
    console.error("Fetch Studio Assets Error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch studio assets. Please try again later.",
      isCongested: true
    }, { status: 500 });
  }
}
