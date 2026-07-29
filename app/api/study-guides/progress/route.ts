import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const { searchParams } = new URL(req.url);
    const guideId = searchParams.get('guideId');
    if (!guideId) return NextResponse.json({ error: "Missing guideId" }, { status: 400 });

    const progress = await prisma.studyGuideProgress.findMany({
      where: {
        userId: user.id,
        guideId: guideId,
        completed: true
      },
      select: {
        phaseId: true
      }
    });

    const completedPhases = progress.map(p => p.phaseId);
    return NextResponse.json({ completedPhases });
  } catch (error: any) {
    console.error("GET Progress Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const data = await req.json();
    const { guideId, phaseId } = data;

    if (!guideId || !phaseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newProgress = await prisma.studyGuideProgress.upsert({
      where: {
        userId_guideId_phaseId: {
          userId: user.id,
          guideId: guideId,
          phaseId: phaseId
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        guideId: guideId,
        phaseId: phaseId,
        completed: true
      }
    });

    return NextResponse.json(newProgress);
  } catch (error: any) {
    console.error("POST Progress Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
