import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';
import { creditBalance, grantCredits, setPlan, usageSummary } from '@/lib/usage';
import { logActivity } from '@/lib/audit-log';
import type { PlanTier } from '@/lib/plans';

const MAX_GRANT = 100_000;

// One user's plan, balance and this month's use. Never any chat or study content.
export async function GET(req: Request) {
  try {
    const { user, response } = await requireStaff('users.view');
    if (!user) return response;

    const email = (new URL(req.url).searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Enter an email.' }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, username: true, suspendedAt: true, createdAt: true } });
    if (!target) return NextResponse.json({ error: 'No user has that email.' }, { status: 404 });

    return NextResponse.json({ user: target, ...(await usageSummary(target.id)) });
  } catch (error) {
    console.error('Admin lookup error:', error);
    return NextResponse.json({ error: 'Could not look that user up.' }, { status: 500 });
  }
}

// Gives credits (a negative number takes some back), sets a plan, and/or pauses or restores an account.
// Body: { email, credits?, plan?: "FREE" | "PRO" | "X", planDays?: number | null, suspend?: boolean, note? }.
export async function POST(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('users.edit');
    if (!user || !staff) return response;

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const target = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
    if (!target) return NextResponse.json({ error: 'No user has that email.' }, { status: 404 });
    if (target.id === user.id && typeof body.suspend === 'boolean') {
      return NextResponse.json({ error: 'You cannot pause your own account.' }, { status: 400 });
    }

    const credits = body.credits === undefined || body.credits === null || body.credits === '' ? 0 : Number(body.credits);
    if (!Number.isInteger(credits) || Math.abs(credits) > MAX_GRANT) {
      return NextResponse.json({ error: `Credits must be a whole number up to ${MAX_GRANT.toLocaleString()}.` }, { status: 400 });
    }
    const plan: PlanTier | null = body.plan === 'FREE' || body.plan === 'PRO' || body.plan === 'X' ? body.plan : null;
    if (body.plan && !plan) return NextResponse.json({ error: 'Plan must be FREE, PRO or X.' }, { status: 400 });
    const days = body.planDays === null || body.planDays === undefined || body.planDays === '' ? null : Number(body.planDays);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      return NextResponse.json({ error: 'Plan days must be a whole number from 1 to 3650, or empty for no expiry.' }, { status: 400 });
    }
    const suspend = typeof body.suspend === 'boolean' ? body.suspend : null;
    if (credits === 0 && !plan && suspend === null) return NextResponse.json({ error: 'Give some credits, choose a plan, or pause or restore the account.' }, { status: 400 });

    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : 'Granted by the team';
    if (credits !== 0) await grantCredits({ userId: target.id, amount: credits, reason: 'GRANT', note });
    const expiresAt = plan ? await setPlan(target.id, plan, days) : undefined;
    if (suspend !== null) await prisma.user.update({ where: { id: target.id }, data: { suspendedAt: suspend ? new Date() : null } });

    const did = [credits !== 0 ? `credits ${credits > 0 ? '+' : ''}${credits}` : '', plan ? `plan ${plan}` : '', suspend === null ? '' : suspend ? 'paused' : 'restored'].filter(Boolean).join(', ');
    logActivity(user.id, 'admin_user_edit', `${staff.email} changed ${email}: ${did}. ${note}`, req).catch(console.error);
    return NextResponse.json({ credits: await creditBalance(target.id), plan: plan ?? undefined, expiresAt });
  } catch (error) {
    console.error('Admin grant error:', error);
    return NextResponse.json({ error: 'Could not apply that.' }, { status: 500 });
  }
}

