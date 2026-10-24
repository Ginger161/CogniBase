import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { requireStudyGuideOwnership } from '@/lib/api-auth';

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
  } catch (error) {
    console.error("GET Progress Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensurePrismaUser(user);

    const data = await req.json().catch(() => ({}));
    const { guideId, phaseId } = data;

    if (typeof guideId !== 'string' || typeof phaseId !== 'string' || !guideId || !phaseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { guide, response: ownerResp } = await requireStudyGuideOwnership(guideId, user.id);
    if (!guide) return ownerResp;

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
  } catch (error) {
    console.error("POST Progress Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
