import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

function getMidnightDate(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const today = getMidnightDate(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    let metrics: any[] = [];
    try {
      metrics = await prisma.dailyMetric.findMany({
        where: {
          userId: user.id,
          date: {
            gte: sevenDaysAgo,
            lte: today,
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
    } catch (e) {
      console.warn("Database error in metrics GET, returning empty metrics:", e);
      // Proceed with empty metrics array
    }

    const todayMetric = metrics.find(m => m.date.getTime() === today.getTime()) || {
      focusMinutes: 0,
      tasksCompleted: 0,
      averageAccuracy: 0,
    };

    // Build the 7-day array
    const weekDays = [];
    const streakData = [];
    const historicalFocusMinutes = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    let currentStreak = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      weekDays.push(dayNames[d.getDay()]);
      
      const metricForDay = metrics.find(m => m.date.getTime() === d.getTime());
      const isActive = metricForDay ? metricForDay.focusMinutes > 0 : false;
      streakData.push(isActive);
      historicalFocusMinutes.push(metricForDay ? metricForDay.focusMinutes : 0);
    }
    
    // Reverse count from today for streak
    for (let i = 6; i >= 0; i--) {
      if (streakData[i]) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    return NextResponse.json({
      today: todayMetric,
      weekDays,
      streakData,
      historicalFocusMinutes,
      currentStreak
    });
  } catch (error: any) {
    console.error("Metrics GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    const body = await req.json();
    const { action } = body;

    const today = getMidnightDate(new Date());

    let updateData: any = {};
    let createData: any = {
      date: today,
      userId: user.id,
      focusMinutes: 0,
      tasksCompleted: 0,
      averageAccuracy: 0,
    };

    if (action === 'generate_guide') {
      updateData.focusMinutes = { increment: 15 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 15;
      createData.tasksCompleted = 1;
    } else if (action === 'upload_document') {
      updateData.focusMinutes = { increment: 5 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 5;
      createData.tasksCompleted = 1;
    } else if (action === 'flashcard_review') {
      updateData.focusMinutes = { increment: 10 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 10;
      createData.tasksCompleted = 1;
    } else if (action === 'chat_message') {
      updateData.focusMinutes = { increment: 1 };
      createData.focusMinutes = 1;
    } else if (action === 'generate_asset') {
      updateData.focusMinutes = { increment: 10 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 10;
      createData.tasksCompleted = 1;
    } else if (action === 'read_document') {
      updateData.focusMinutes = { increment: 20 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 20;
      createData.tasksCompleted = 1;
    } else if (action === 'complete_phase') {
      updateData.focusMinutes = { increment: 25 };
      updateData.tasksCompleted = { increment: 1 };
      createData.focusMinutes = 25;
      createData.tasksCompleted = 1;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const metric = await prisma.dailyMetric.upsert({
      where: {
        date_userId: {
          date: today,
          userId: user.id
        }
      },
      update: updateData,
      create: createData,
    });

    return NextResponse.json({ success: true, metric });
  } catch (error: any) {
    console.error("Metrics POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
