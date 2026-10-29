import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireWorkspaceOwnership } from '@/lib/api-auth';
import { createClient } from '@/utils/supabase/server';
import { isEpisodeContent, removeAudio } from '@/lib/audio/episode';

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

  } catch (error) {
    console.error("Fetch Studio Assets Error:", error);
    return NextResponse.json({ error: "Failed to fetch studio assets. Please try again later." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const asset = await prisma.studioAsset.findFirst({ where: { id, workspace: { userId: user.id } }, select: { id: true, type: true, content: true } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // An audio overview owns a file in storage; remove it with the episode.
    if (asset.type === 'AUDIO' && isEpisodeContent(asset.content) && asset.content.audioPath) {
      await removeAudio(await createClient(), asset.content.audioPath);
    }

    await prisma.studioAsset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete studio asset error:', error);
    return NextResponse.json({ error: 'Could not delete this item.' }, { status: 500 });
  }
}
