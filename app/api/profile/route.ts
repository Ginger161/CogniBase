import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({ profile: dbUser?.profile || null });
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { profile } = await req.json();

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { profile }
  });

  return NextResponse.json({ profile: updated.profile });
}
