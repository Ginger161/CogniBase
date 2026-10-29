import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { usageSummary } from '@/lib/usage';
import { CREDIT_PACKS, paymentsOn } from '@/lib/billing';
import { PLANS } from '@/lib/plans';

// Everything the Plan & credits screen needs: plan, balance, this month's use, and what can be bought.
export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const summary = await usageSummary(user.id);
    return NextResponse.json({
      ...summary,
      paymentsOn: paymentsOn(),
      packs: CREDIT_PACKS,
      plans: (['PRO', 'X'] as const).map((tier) => ({ tier, label: PLANS[tier].label, priceNgn: PLANS[tier].priceNgn })),
    });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json({ error: 'Could not load your plan and credits.' }, { status: 500 });
  }
}
