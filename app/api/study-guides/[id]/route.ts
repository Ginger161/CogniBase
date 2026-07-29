import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user, response } = await requireUser();
    if (!user) return response;

    const guide = await prisma.studyGuide.findUnique({ where: { id: params.id } });
    
    if (!guide) {
        return NextResponse.json({ error: "Guide not found" }, { status: 404 });
    }

    // Verify ownership
    if (guide.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized: You do not have permission to delete this guide." }, { status: 403 });
    }

    await prisma.studyGuide.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error on Delete:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
