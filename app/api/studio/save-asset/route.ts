import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const body = await req.json();
    const { workspaceId, title, type, content } = body;

    if (!workspaceId || !title || !type || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { workspace, response: wsResp } = await requireWorkspaceOwnership(workspaceId, user.id);
    if (!workspace) return wsResp;

    const newAsset = await prisma.studioAsset.create({
      data: {
        workspaceId,
        title,
        type,
        content
      }
    });

    return NextResponse.json({ success: true, asset: newAsset });

  } catch (error: any) {
    console.error("Save Guide Error:", error);
    return NextResponse.json({ 
      error: "Failed to save the asset. Please try again later."
    }, { status: 500 });
  }
}
