import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { getMidnightDate } from '@/lib/metrics';

type Phase = { phaseId?: string; title?: string };

// Everything the Home screen needs in one round trip.
export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const dbUser = await ensurePrismaUser(user);

    const today = getMidnightDate(new Date());
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - 6);

    const [timetable, guides, metrics, prefs, recent, sourceCount] = await Promise.all([
      prisma.timetable.findFirst({ where: { userId: user.id } }),
      prisma.studyGuide.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          sourceDocumentName: true,
          strategyData: true,
          progress: { where: { completed: true }, select: { phaseId: true } },
        },
      }),
      prisma.dailyMetric.findMany({
        where: { userId: user.id, date: { gte: weekStart, lte: today } },
        select: { date: true, focusMinutes: true },
      }),
      prisma.userPreferences.findUnique({ where: { userId: user.id }, select: { dailyFocusGoal: true } }),
      prisma.document.findMany({
        where: { workspace: { userId: user.id } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, name: true, sourceType: true, createdAt: true },
      }),
      prisma.document.count({ where: { workspace: { userId: user.id } } }),
    ]);

    // The most recent guide that still has phases left; otherwise the newest one.
    const summaries = guides.map((g) => {
      const data = g.strategyData as { guideTitle?: string; phases?: Phase[] } | null;
      const phases = Array.isArray(data?.phases) ? data!.phases! : [];
      const done = new Set(g.progress.map((p) => p.phaseId));
      const completed = phases.filter((p, i) => done.has(p.phaseId ?? String(i + 1))).length;
      const next = phases.find((p, i) => !done.has(p.phaseId ?? String(i + 1)));
      return {
        id: g.id,
        title: data?.guideTitle || g.title || g.sourceDocumentName || 'Study guide',
        total: phases.length,
        completed,
        nextPhaseTitle: next?.title ?? null,
      };
    });
    const continueGuide = summaries.find((g) => g.total > 0 && g.completed < g.total) ?? summaries[0] ?? null;

    const byDay = new Map(metrics.map((m) => [m.date.getTime(), m.focusMinutes]));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      return { date: d.toISOString(), minutes: byDay.get(d.getTime()) ?? 0 };
    });

    const classes = (timetable?.data as { scheduled_classes?: unknown[] } | null)?.scheduled_classes ?? [];

    return NextResponse.json({
      name: dbUser.username || user.email?.split('@')[0] || 'there',
      classes,
      continueGuide,
      focusGoal: prefs?.dailyFocusGoal ?? 120,
      week,
      recent,
      sourceCount,
    });
  } catch (error) {
    console.error('Home API error:', error);
    return NextResponse.json({ error: 'Could not load Home.' }, { status: 500 });
  }
}
