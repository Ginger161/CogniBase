import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDocumentOwnership, requireUser } from '@/lib/api-auth';

// Saves how far through a source the reader is (0 to 1). Called often, so it stays small.
export async function PUT(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { documentId, progress } = await req.json().catch(() => ({}));
    if (typeof documentId !== 'string' || typeof progress !== 'number' || !Number.isFinite(progress)) {
      return NextResponse.json({ error: 'Invalid progress.' }, { status: 400 });
    }
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const value = Math.min(1, Math.max(0, progress));
    await prisma.readingProgress.upsert({
      where: { userId_documentId: { userId: user.id, documentId } },
      update: { progress: value },
      create: { userId: user.id, documentId, progress: value },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reading progress error:', error);
    return NextResponse.json({ error: 'Could not save your place.' }, { status: 500 });
  }
}
