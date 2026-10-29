import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { logActivity } from '@/lib/audit-log';
import { getMidnightDate, isMetricAction, recordMetric } from '@/lib/metrics';


export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const today = getMidnightDate(new Date());
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 6);

    const [rows, prefs] = await Promise.all([
      prisma.dailyMetric.findMany({
        where: { userId: user.id, date: { gte: start, lte: today } },
        select: { date: true, focusMinutes: true, tasksCompleted: true },
      }),
      prisma.userPreferences.findUnique({ where: { userId: user.id }, select: { dailyFocusGoal: true } }),
    ]);

    const byDay = new Map(rows.map((r) => [r.date.getTime(), r]));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const r = byDay.get(d.getTime());
      return { date: d.toISOString(), minutes: r?.focusMinutes ?? 0, tasks: r?.tasksCompleted ?? 0 };
    });

    // A streak is consecutive active days ending today, or yesterday if today has not started yet.
    let streak = 0;
    for (let i = week.length - 1; i >= 0; i--) {
      if (week[i].minutes > 0) streak++;
      else if (i === week.length - 1) continue;
      else break;
    }

    // Retention: how well quizzes and flashcards are going. Optional, so Progress still loads without it.
    const retention = await (async () => {
      const [attempts, cards] = await Promise.all([
        prisma.quizAttempt.findMany({
          where: { userId: user.id, createdAt: { gte: start } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { title: true, score: true, total: true, createdAt: true },
        }),
        prisma.cardState.aggregate({ where: { userId: user.id }, _sum: { correct: true, total: true }, _count: true }),
      ]);
      const cardTotal = cards._sum.total ?? 0;
      return {
        quizPercent: attempts.length
          ? Math.round((attempts.reduce((n, a) => n + a.score / a.total, 0) / attempts.length) * 100)
          : null,
        recentQuizzes: attempts.slice(0, 5),
        recallPercent: cardTotal > 0 ? Math.round(((cards._sum.correct ?? 0) / cardTotal) * 100) : null,
        cardsLearning: cards._count,
      };
    })().catch(() => null);

    return NextResponse.json({
      retention,
      focusGoal: prefs?.dailyFocusGoal ?? 120,
      taskGoal: 5,
      today: week[week.length - 1],
      week,
      streak,
    });
  } catch (error) {
    console.error("Metrics GET Error:", error);
    return NextResponse.json({ error: "Could not load your progress." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const actionLabels: Record<string, string> = {
      upload_document: 'Uploaded a document',
      chat_message: 'Sent a message to the Tutor',
      read_document: 'Opened a document in the reader',
      generate_guide: 'Generated a study guide',
      flashcard_review: 'Reviewed a flashcard',
      complete_phase: 'Completed a study guide phase',
      generate_asset: 'Generated a studio asset',
      complete_quiz: 'Finished a quiz',
      listen_audio: 'Listened to an audio overview',
    };
    if (actionLabels[action]) {
      logActivity(user.id, action, actionLabels[action], req).catch(console.error);
    }

    if (!isMetricAction(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const metric = await recordMetric(user.id, action);

    return NextResponse.json({ success: true, metric });
  } catch (error) {
    console.error("Metrics POST Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
