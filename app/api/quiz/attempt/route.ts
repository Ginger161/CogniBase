import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { getMidnightDate, recordMetric } from '@/lib/metrics';

// Saves a finished quiz and updates today's accuracy, which feeds Progress.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { assetId, score, total } = await req.json().catch(() => ({}));
    if (typeof assetId !== 'string' || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || total > 50 || score < 0 || score > total) {
      return NextResponse.json({ error: 'Invalid quiz result.' }, { status: 400 });
    }

    const asset = await prisma.studioAsset.findFirst({
      where: { id: assetId, type: 'QUIZ', workspace: { userId: user.id } },
      select: { id: true, title: true },
    });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.quizAttempt.create({ data: { userId: user.id, assetId: asset.id, title: asset.title, score, total } });

    // Today's accuracy is the average of every quiz finished today, as a percentage.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await prisma.quizAttempt.findMany({ where: { userId: user.id, createdAt: { gte: startOfDay } }, select: { score: true, total: true } });
    const accuracy = today.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / Math.max(1, today.length);

    await recordMetric(user.id, 'complete_quiz');
    const date = getMidnightDate(new Date());
    await prisma.dailyMetric.update({ where: { date_userId: { date, userId: user.id } }, data: { averageAccuracy: accuracy } });

    return NextResponse.json({ success: true, accuracy });
  } catch (error) {
    console.error('Quiz attempt error:', error);
    return NextResponse.json({ error: 'Could not save your score.' }, { status: 500 });
  }
}
