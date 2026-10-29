import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { ensurePrismaUser } from '@/lib/auth-sync';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { grantCredits, setPlan } from '@/lib/usage';
import { logActivity } from '@/lib/audit-log';
import type { PlanTier } from '@/lib/plans';

// A student enters an invite code and receives what it gives. Each code works once per person.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    // Guessing codes should be slow: reuse the ingest limiter.
    const limited = rateLimit(user.id, LIMITS.ingest);
    if (limited) return limited;
    await ensurePrismaUser(user);

    const { code } = await req.json().catch(() => ({}));
    const clean = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const invite = clean ? await prisma.invite.findUnique({ where: { code: clean } }) : null;
    const usable = invite && invite.active && invite.uses < invite.maxUses && (!invite.expiresAt || invite.expiresAt > new Date());
    // One message for every kind of "no", so a code cannot be probed for whether it exists.
    if (!invite || !usable) return NextResponse.json({ error: 'That code is not valid, or it has already been used up.' }, { status: 400 });

    try {
      await prisma.inviteRedemption.create({ data: { inviteId: invite.id, userId: user.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'You have already used this code.' }, { status: 400 });
      }
      throw e;
    }
    // Claim a use atomically, so a code with one use left cannot be redeemed twice at the same moment.
    const claimed = await prisma.invite.updateMany({ where: { id: invite.id, uses: { lt: invite.maxUses } }, data: { uses: { increment: 1 } } });
    if (claimed.count === 0) {
      await prisma.inviteRedemption.deleteMany({ where: { inviteId: invite.id, userId: user.id } });
      return NextResponse.json({ error: 'That code is not valid, or it has already been used up.' }, { status: 400 });
    }

    if (invite.credits > 0) await grantCredits({ userId: user.id, amount: invite.credits, reason: 'GRANT', ref: `invite:${invite.id}:${user.id}`, note: `Invite ${invite.code}` });
    if (invite.planTier) await setPlan(user.id, invite.planTier as PlanTier, invite.planDays ?? 30);

    logActivity(user.id, 'redeem_invite', `Redeemed invite ${invite.code}`, req).catch(console.error);
    const parts = [invite.credits > 0 ? `${invite.credits} credits` : '', invite.planTier ? `${invite.planTier === 'X' ? 'X' : 'Pro'} plan for ${invite.planDays ?? 30} days` : ''].filter(Boolean);
    return NextResponse.json({ message: `You received ${parts.join(' and ')}.` });
  } catch (error) {
    console.error('Redeem error:', error);
    return NextResponse.json({ error: 'Could not use that code. Please try again.' }, { status: 500 });
  }
}
