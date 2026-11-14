import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("API Crash Error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
