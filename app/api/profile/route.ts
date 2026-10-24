import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit-log';

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({ profile: dbUser?.profile || null });
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { profile, activityLabel } = await req.json().catch(() => ({}));

  if (!profile || typeof profile !== 'object' || Array.isArray(profile) || JSON.stringify(profile).length > 100_000) {
    return NextResponse.json({ error: "Profile must be an object under 100KB." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { profile }
  });

  if (activityLabel) {
    logActivity(user.id, 'update_profile', activityLabel, req).catch(console.error);
  }

  return NextResponse.json({ profile: updated.profile });
}
