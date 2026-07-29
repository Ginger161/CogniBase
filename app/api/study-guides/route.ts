import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { ensurePrismaUser } from '@/lib/auth-sync';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrismaUser(user);

    const studyGuides = await prisma.studyGuide.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(studyGuides);
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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

    const { sourceDocumentId, sourceDocumentName, sectionConstraint, markdownContent, strategyData } = await req.json();

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
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
