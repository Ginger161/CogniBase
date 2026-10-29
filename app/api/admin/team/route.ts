import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwner, isOwnerEmail } from '@/lib/admin';
import { isPermission } from '@/lib/staff';
import { logActivity } from '@/lib/audit-log';

// Owner only. The team, and what each person may see and do.
export async function GET() {
  try {
    const { user, response } = await requireOwner();
    if (!user) return response;

    const rows = await prisma.staffMember.findMany({
      orderBy: { createdAt: 'asc' },
      select: { userId: true, permissions: true, createdAt: true, user: { select: { email: true, username: true } } },
    });
    return NextResponse.json({
      team: rows.map((r) => ({ userId: r.userId, email: r.user.email, name: r.user.username, permissions: r.permissions, addedAt: r.createdAt })),
    });
  } catch (error) {
    console.error('Team GET error:', error);
    return NextResponse.json({ error: 'Could not load the team.' }, { status: 500 });
  }
}

// Adds a moderator, or changes what an existing one can do. Body: { email, permissions: string[] }.
export async function POST(req: Request) {
  try {
    const { user, staff, response } = await requireOwner();
    if (!user || !staff) return response;

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const permissions: string[] = Array.isArray(body.permissions) ? [...new Set<string>(body.permissions.filter(isPermission))] : [];
    if (!email) return NextResponse.json({ error: 'Enter their email.' }, { status: 400 });
    if (isOwnerEmail(email)) return NextResponse.json({ error: 'That person is already an owner and can do everything.' }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'No account has that email yet. Ask them to sign up first.' }, { status: 404 });

    await prisma.staffMember.upsert({
      where: { userId: target.id },
      update: { permissions },
      create: { userId: target.id, permissions, addedById: user.id },
    });
    logActivity(user.id, 'admin_team_edit', `${staff.email} set ${email} to: ${permissions.join(', ') || 'no access'}`, req).catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team POST error:', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }
}

// Removes a moderator completely. They become an ordinary student again.
export async function DELETE(req: Request) {
  try {
    const { user, staff, response } = await requireOwner();
    if (!user || !staff) return response;

    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Missing person.' }, { status: 400 });
    const target = await prisma.staffMember.findUnique({ where: { userId }, select: { user: { select: { email: true } } } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.staffMember.delete({ where: { userId } });
    logActivity(user.id, 'admin_team_edit', `${staff.email} removed ${target.user.email} from the team`, req).catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team DELETE error:', error);
    return NextResponse.json({ error: 'Could not remove them.' }, { status: 500 });
  }
}
