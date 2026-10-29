import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';

// What the team has done: every admin action, newest first.
export async function GET() {
  try {
    const { user, response } = await requireStaff('audit.view');
    if (!user) return response;
    const rows = await prisma.auditLog.findMany({
      where: { action: { startsWith: 'admin_' } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: { id: true, action: true, details: true, createdAt: true },
    });
    return NextResponse.json({ entries: rows });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json({ error: 'Could not load the activity log.' }, { status: 500 });
  }
}
