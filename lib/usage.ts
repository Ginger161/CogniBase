import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSwitches } from '@/lib/settings';
import { CREDIT_COST, PLANS, USAGE_LABEL, includedFor, planFor, type PlanLimits, type PlanTier, type UsageKind } from '@/lib/plans';

// Metering: every counted action is checked before the work (so nothing expensive runs for someone who has hit
// their limit) and recorded after it succeeds (so a failed action costs the student nothing).
// An action is paid for first from the plan's monthly allowance, then from credits.

const KINDS = Object.keys(CREDIT_COST) as UsageKind[];

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** The plan a user is on right now. A paid plan whose date has passed counts as Free. */
export async function effectivePlan(userId: string): Promise<{ tier: PlanTier; plan: PlanLimits; expiresAt: Date | null; lapsed: boolean; suspended: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { planTier: true, planExpiresAt: true, suspendedAt: true } });
  const suspended = !!user?.suspendedAt;
  const plan = planFor(user?.planTier);
  const tier = (Object.keys(PLANS) as PlanTier[]).find((t) => PLANS[t] === plan) ?? 'FREE';
  if (tier !== 'FREE' && user?.planExpiresAt && user.planExpiresAt < new Date()) {
    return { tier: 'FREE', plan: PLANS.FREE, expiresAt: user.planExpiresAt, lapsed: true, suspended };
  }
  return { tier, plan, expiresAt: user?.planExpiresAt ?? null, lapsed: false, suspended };
}

export async function creditBalance(userId: string): Promise<number> {
  const sum = await prisma.creditLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return sum._sum.amount ?? 0;
}

async function includedUsed(userId: string, kind: UsageKind): Promise<number> {
  const sum = await prisma.usageEvent.aggregate({ where: { userId, kind, createdAt: { gte: startOfMonth() } }, _sum: { includedUnits: true } });
  return sum._sum.includedUnits ?? 0;
}

type Split = { included: number; credits: number };

function split(limit: number, used: number, units: number, kind: UsageKind): Split {
  const included = Math.min(Math.max(0, limit - used), units);
  return { included, credits: (units - included) * CREDIT_COST[kind] };
}

export type UsageVerdict = ({ ok: true } & Split) | { ok: false; status: number; message: string };

/** May this student do this now? Does not record anything. */
export async function checkUsage(userId: string, kind: UsageKind, units = 1): Promise<UsageVerdict> {
  const [{ plan, suspended }, used, balance, switches] = await Promise.all([effectivePlan(userId), includedUsed(userId, kind), creditBalance(userId), getSwitches()]);

  // A paused account can still read what it has, but not use anything that costs us money.
  if (suspended) return { ok: false, status: 403, message: 'Your account is paused. Please contact support to get it restored.' };
  const feature = kind === 'chat' ? 'chat' : kind === 'generate' || kind === 'guide' ? 'generate' : kind === 'upload' ? 'uploads' : 'audio';
  if (switches.off[feature]) return { ok: false, status: 503, message: switches.message };

  const limit = includedFor(plan, kind);
  const { included, credits } = split(limit, used, units, kind);
  if (credits <= balance) return { ok: true, included, credits };

  const label = USAGE_LABEL[kind];
  const lead =
    limit === 0
      ? `Your ${plan.label} plan does not include ${label.many}.`
      : `You have used all ${limit} ${label.many} in your ${plan.label} plan this month.`;
  const need =
    balance > 0 ? ` This needs ${credits} credits and you have ${balance}.` : ` This needs ${credits} credits.`;
  return { ok: false, status: 402, message: `${lead}${need} Top up credits or upgrade in Settings > Plan & credits.` };
}

/** Records a finished action, spending the allowance first and credits for the rest. Never throws. */
export async function recordUsage(userId: string, kind: UsageKind, units = 1): Promise<void> {
  try {
    const [{ plan }, used, balance] = await Promise.all([effectivePlan(userId), includedUsed(userId, kind), creditBalance(userId)]);
    const { included, credits } = split(includedFor(plan, kind), used, units, kind);
    // The action already happened, so never charge more than the student has.
    const charged = Math.min(credits, Math.max(0, balance));
    await prisma.$transaction(async (tx) => {
      const event = await tx.usageEvent.create({ data: { userId, kind, units, includedUnits: included, credits: charged } });
      if (charged > 0) await tx.creditLedger.create({ data: { userId, amount: -charged, reason: 'USAGE', ref: `use:${event.id}` } });
    });
  } catch (e) {
    console.error('Could not record usage:', e);
  }
}

export type UsageLine = { kind: UsageKind; label: string; used: number; limit: number; creditCost: number };

/** What the student has used this month against what the plan includes, plus their balance. */
export async function usageSummary(userId: string) {
  const [{ tier, plan, expiresAt, lapsed }, balance, rows] = await Promise.all([
    effectivePlan(userId),
    creditBalance(userId),
    prisma.usageEvent.groupBy({ by: ['kind'], where: { userId, createdAt: { gte: startOfMonth() } }, _sum: { includedUnits: true } }),
  ]);
  const usedBy = new Map(rows.map((r) => [r.kind, r._sum.includedUnits ?? 0]));
  const lines: UsageLine[] = KINDS.map((kind) => ({
    kind,
    label: USAGE_LABEL[kind].many,
    used: usedBy.get(kind) ?? 0,
    limit: includedFor(plan, kind),
    creditCost: CREDIT_COST[kind],
  }));
  return { tier, planLabel: plan.label, expiresAt, lapsed, credits: balance, lines };
}

/** Adds credits to a balance. A reference makes it safe to call twice: the second call changes nothing. */
export async function grantCredits(args: { userId: string; amount: number; reason: 'PURCHASE' | 'GRANT' | 'REFUND' | 'PLAN'; ref?: string; note?: string }): Promise<'applied' | 'duplicate'> {
  try {
    await prisma.creditLedger.create({ data: { userId: args.userId, amount: args.amount, reason: args.reason, ref: args.ref ?? null, note: args.note ?? null } });
    return 'applied';
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
    throw e;
  }
}

/** Puts a user on a plan. `days` null means it never lapses on its own. Buying the same plan again extends it. */
export async function setPlan(userId: string, tier: PlanTier, days: number | null): Promise<Date | null> {
  if (tier === 'FREE') {
    await prisma.user.update({ where: { id: userId }, data: { planTier: 'FREE', planExpiresAt: null } });
    return null;
  }
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { planTier: true, planExpiresAt: true } });
  const now = new Date();
  const sameAndActive = current?.planTier === tier && current.planExpiresAt && current.planExpiresAt > now;
  const from = sameAndActive ? current.planExpiresAt! : now;
  const expiresAt = days === null ? null : new Date(from.getTime() + days * 86_400_000);
  await prisma.user.update({ where: { id: userId }, data: { planTier: tier, planExpiresAt: expiresAt } });
  return expiresAt;
}
