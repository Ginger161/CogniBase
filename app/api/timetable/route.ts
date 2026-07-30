import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
  return NextResponse.json({ scheduled_classes: (timetable?.data as any)?.scheduled_classes || [] });
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { scheduled_classes } = await req.json();

  const existing = await prisma.timetable.findFirst({ where: { userId: user.id } });

  let timetable;
  if (existing) {
    timetable = await prisma.timetable.update({
      where: { id: existing.id },
      data: { data: { scheduled_classes } }
    });
  } else {
    timetable = await prisma.timetable.create({
      data: { userId: user.id, data: { scheduled_classes } }
    });
  }

  return NextResponse.json({ scheduled_classes: (timetable.data as any).scheduled_classes });
}
