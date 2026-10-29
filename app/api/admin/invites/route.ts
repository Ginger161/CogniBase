import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';
import { logActivity } from '@/lib/audit-log';

const newCode = () => `CB-${randomBytes(4).toString('hex').toUpperCase()}`;

export async function GET() {
  try {
    const { user, response } = await requireStaff('invites.manage');
    if (!user) return response;
    const invites = await prisma.invite.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Invites GET error:', error);
    return NextResponse.json({ error: 'Could not load invite codes.' }, { status: 500 });
  }
}

// Creates a code. Body: { code?, note?, credits?, planTier?: "PRO"|"X", planDays?, maxUses?, expiresOn?: "YYYY-MM-DD" }.
export async function POST(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('invites.manage');
    if (!user || !staff) return response;

    const b = await req.json().catch(() => ({}));
    const credits = Number(b.credits ?? 0);
    const maxUses = Number(b.maxUses ?? 1);
    const planTier = b.planTier === 'PRO' || b.planTier === 'X' ? b.planTier : null;
    const planDays = planTier ? Number(b.planDays ?? 30) : null;
    if (!Number.isInteger(credits) || credits < 0 || credits > 10_000) return NextResponse.json({ error: 'Credits must be a whole number from 0 to 10,000.' }, { status: 400 });
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) return NextResponse.json({ error: 'Uses must be a whole number from 1 to 10,000.' }, { status: 400 });
    if (planDays !== null && (!Number.isInteger(planDays) || planDays < 1 || planDays > 365)) return NextResponse.json({ error: 'Plan days must be from 1 to 365.' }, { status: 400 });
    if (credits === 0 && !planTier) return NextResponse.json({ error: 'A code needs to give credits, a plan, or both.' }, { status: 400 });

    const code = typeof b.code === 'string' && b.code.trim() ? b.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) : newCode();
    if (code.length < 4) return NextResponse.json({ error: 'A code needs at least 4 letters or numbers.' }, { status: 400 });
    const expiresAt = typeof b.expiresOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.expiresOn) ? new Date(`${b.expiresOn}T23:59:59.000Z`) : null;

    if (await prisma.invite.findUnique({ where: { code }, select: { id: true } })) {
      return NextResponse.json({ error: 'That code already exists. Pick another or leave it blank for a random one.' }, { status: 409 });
    }
    const invite = await prisma.invite.create({
      data: { code, note: typeof b.note === 'string' ? b.note.trim().slice(0, 120) || null : null, credits, planTier, planDays, maxUses, expiresAt, createdById: user.id },
    });
    logActivity(user.id, 'admin_invite', `${staff.email} created invite ${code}`, req).catch(console.error);
    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Invites POST error:', error);
    return NextResponse.json({ error: 'Could not create that code.' }, { status: 500 });
  }
}

// Turns a code on or off. Body: { id, active }.
export async function PATCH(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('invites.manage');
    if (!user || !staff) return response;
    const { id, active } = await req.json().catch(() => ({}));
    if (typeof id !== 'string' || typeof active !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const invite = await prisma.invite.update({ where: { id }, data: { active } }).catch(() => null);
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logActivity(user.id, 'admin_invite', `${staff.email} ${active ? 'enabled' : 'disabled'} invite ${invite.code}`, req).catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invites PATCH error:', error);
    return NextResponse.json({ error: 'Could not change that code.' }, { status: 500 });
  }
}
