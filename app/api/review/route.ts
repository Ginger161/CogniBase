import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { buildReviewQueue } from '@/lib/review-queue';
import { NEW_STATE, isGrade, schedule } from '@/lib/srs';

// Today's flashcard queue: due cards first, then a few new ones.
export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    return NextResponse.json(await buildReviewQueue(user.id));
  } catch (error) {
    console.error('Review GET error:', error);
    return NextResponse.json({ error: 'Could not load your cards.' }, { status: 500 });
  }
}

// Records how a card went and schedules its next review.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { assetId, cardIndex, grade } = await req.json().catch(() => ({}));
    if (typeof assetId !== 'string' || !Number.isInteger(cardIndex) || cardIndex < 0 || !isGrade(grade)) {
      return NextResponse.json({ error: 'Invalid review.' }, { status: 400 });
    }

    const asset = await prisma.studioAsset.findFirst({
      where: { id: assetId, type: 'FLASHCARD', workspace: { userId: user.id } },
      select: { content: true },
    });
    if (!asset || !Array.isArray(asset.content) || cardIndex >= asset.content.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const key = { userId_assetId_cardIndex: { userId: user.id, assetId, cardIndex } };
    const existing = await prisma.cardState.findUnique({ where: key });
    const now = new Date();
    const next = schedule(existing ?? NEW_STATE, grade, now);
    const recalled = grade !== 'again';

    const data = {
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: now,
      total: (existing?.total ?? 0) + 1,
      correct: (existing?.correct ?? 0) + (recalled ? 1 : 0),
    };
    await prisma.cardState.upsert({
      where: key,
      update: data,
      create: { userId: user.id, assetId, cardIndex, ...data },
    });
    return NextResponse.json({ dueAt: next.dueAt, intervalDays: next.intervalDays });
  } catch (error) {
    console.error('Review POST error:', error);
    return NextResponse.json({ error: 'Could not save that answer.' }, { status: 500 });
  }
}
