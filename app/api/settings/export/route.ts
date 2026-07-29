import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const [dbUser, workspaces, studyGuides] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.workspace.findMany({
        where: { userId: user.id },
        include: { documents: true, messages: true }
      }),
      prisma.studyGuide.findMany({ where: { userId: user.id } })
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: dbUser,
      workspaces,
      studyGuides
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="cognibase-data-export.json"'
      }
    });
  } catch (error: any) {
    console.error("Data Export Error:", error);
    return NextResponse.json({ error: "Failed to export data." }, { status: 500 });
  }
}
