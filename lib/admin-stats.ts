import { prisma } from '@/lib/prisma';
import { PLANS, type UsageKind } from '@/lib/plans';
import { estimateCost } from '@/lib/costs';
import { isEpisodeContent } from '@/lib/audio/episode';
import { monthlyVoiceBudgetChars } from '@/lib/audio/limits';

const startOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** What it costs to run the business each month, from the expenses entered by hand. */
export async function fundsSummary() {
  const expenses = await prisma.expense.findMany({ orderBy: { incurredOn: 'desc' } });
  const monthStart = startOfMonth();
  let monthlyBurn = 0;
  for (const e of expenses) {
    if (e.recurring === 'monthly') monthlyBurn += e.amountNgn;
    else if (e.recurring === 'yearly') monthlyBurn += e.amountNgn / 12;
    else if (e.incurredOn >= monthStart) monthlyBurn += e.amountNgn;
  }
  const spentAllTime = expenses.reduce((n, e) => n + e.amountNgn, 0);
  return { expenses, monthlyBurn: Math.round(monthlyBurn), spentAllTime };
}

/** Headline numbers for the admin overview. Everything is aggregated: no chat or personal content is touched. */
export async function overviewStats() {
  const now = new Date();
  const monthStart = startOfMonth();
  const lastMonthStart = startOfMonth(-1);

  const [users, new7, new30, payers, revenue, lastRevenue, ledger, usage, active7, active30, voiced, funds] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.user.findMany({ where: { planTier: { in: ['PRO', 'X'] }, OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }] }, select: { planTier: true } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amountNgn: true }, _count: true }),
    prisma.payment.aggregate({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } }, _sum: { amountNgn: true } }),
    prisma.creditLedger.aggregate({ _sum: { amount: true } }),
    prisma.usageEvent.groupBy({ by: ['kind'], where: { createdAt: { gte: monthStart } }, _sum: { units: true } }),
    prisma.usageEvent.findMany({ where: { createdAt: { gte: daysAgo(7) } }, distinct: ['userId'], select: { userId: true } }),
    prisma.usageEvent.findMany({ where: { createdAt: { gte: daysAgo(30) } }, distinct: ['userId'], select: { userId: true } }),
    prisma.studioAsset.findMany({ where: { type: 'AUDIO', createdAt: { gte: monthStart } }, select: { content: true } }),
    fundsSummary(),
  ]);

  const counts = Object.fromEntries(usage.map((u) => [u.kind, u._sum.units ?? 0])) as Partial<Record<UsageKind, number>>;
  const mrr = payers.reduce((n, p) => n + (p.planTier === 'X' ? PLANS.X.priceNgn : PLANS.PRO.priceNgn), 0);
  const revenueMonth = revenue._sum.amountNgn ?? 0;
  const variableCost = estimateCost(counts);
  const voicedChars = voiced.reduce((n, a) => n + (isEpisodeContent(a.content) && a.content.audioPath ? a.content.charCount : 0), 0);

  return {
    users: { total: users, new7, new30, active7: active7.length, active30: active30.length },
    paying: { count: payers.length, mrr },
    revenue: { month: revenueMonth, payments: revenue._count, lastMonth: lastRevenue._sum.amountNgn ?? 0 },
    creditsOutstanding: ledger._sum.amount ?? 0,
    usage: counts,
    voice: { usedChars: voicedChars, budgetChars: monthlyVoiceBudgetChars() },
    costs: { variable: variableCost, fixed: funds.monthlyBurn },
    // Revenue this month less estimated AI cost and running costs. Negative means you are spending more than you earn.
    net: revenueMonth - variableCost - funds.monthlyBurn,
  };
}
