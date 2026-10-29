import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';

export async function GET() {
  try {
    const { user, response } = await requireStaff('billing.view');
    if (!user) return response;
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, reference: true, product: true, amountNgn: true, createdAt: true, user: { select: { email: true } } },
    });
    return NextResponse.json({ payments: payments.map((p) => ({ ...p, email: p.user?.email ?? 'deleted account', user: undefined })) });
  } catch (error) {
    console.error('Payments error:', error);
    return NextResponse.json({ error: 'Could not load payments.' }, { status: 500 });
  }
}
