import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { requireDocumentOwnership } from '@/lib/api-auth';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const guides = await prisma.studyGuide.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { progress: { where: { completed: true }, select: { phaseId: true } } }
    });

    // Per-guide progress so the list can show it without a request per guide.
    const studyGuides = guides.map(({ progress, ...g }) => {
      const phases = (g.strategyData as { phases?: unknown[] } | null)?.phases;
      return { ...g, completedPhases: progress.length, totalPhases: Array.isArray(phases) ? phases.length : 0 };
    });

    return NextResponse.json(studyGuides);
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
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

    const { sourceDocumentId, sourceDocumentName, sectionConstraint, markdownContent, strategyData } = await req.json().catch(() => ({}));

    const { doc, response: docResp } = await requireDocumentOwnership(String(sourceDocumentId), user.id);
    if (!doc) return docResp;

    const newGuide = await prisma.studyGuide.create({
      data: {
        userId: user.id,
        sourceDocumentId,
        sourceDocumentName,
        sectionConstraint,
        markdownContent,
        strategyData
      }
    });

    return NextResponse.json(newGuide);
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
