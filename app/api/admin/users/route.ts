import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';

// Find users by email or name, newest first. Account facts only: never chats, notes or study content.
export async function GET(req: Request) {
  try {
    const { user, response } = await requireStaff('users.view');
    if (!user) return response;

    const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, email: true, username: true, planTier: true, planExpiresAt: true, suspendedAt: true, createdAt: true },
    });

    const balances = await prisma.creditLedger.groupBy({ by: ['userId'], where: { userId: { in: users.map((u) => u.id) } }, _sum: { amount: true } });
    const byUser = new Map(balances.map((b) => [b.userId, b._sum.amount ?? 0]));
    return NextResponse.json({ users: users.map((u) => ({ ...u, credits: byUser.get(u.id) ?? 0 })) });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Could not load users.' }, { status: 500 });
  }
}
