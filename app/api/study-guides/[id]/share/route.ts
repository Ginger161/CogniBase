import { logActivity } from '@/lib/audit-log';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireStudyGuideOwnership } from '@/lib/api-auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, response } = await requireUser();
    if (!user) return response;

    const { isPublic } = await req.json().catch(() => ({}));

    const { guide, response: ownerResp } = await requireStudyGuideOwnership(id, user.id);
    if (!guide) return ownerResp;

    const updated = await prisma.studyGuide.update({
      where: { id },
      data: { isPublic: !!isPublic }
    });

    logActivity(user.id, 'toggle_sharing', isPublic ? 'Made a study guide public' : 'Made a study guide private', req).catch(console.error);
    return NextResponse.json({ isPublic: updated.isPublic });
  } catch (error) {
    console.error("Share Toggle Error:", error);
    return NextResponse.json({ error: "Failed to update sharing status." }, { status: 500 });
  }
}
