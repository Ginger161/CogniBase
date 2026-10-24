import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit-log';

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const timetable = await prisma.timetable.findFirst({ where: { userId: user.id } });
  return NextResponse.json({ scheduled_classes: (timetable?.data as { scheduled_classes?: unknown[] } | null)?.scheduled_classes || [] });
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { scheduled_classes, activityLabel } = await req.json().catch(() => ({}));

  const validClass = (c: unknown) =>
    !!c && typeof c === 'object' &&
    typeof (c as { courseCode?: unknown }).courseCode === 'string' &&
    typeof (c as { day?: unknown }).day === 'string' &&
    typeof (c as { startTime?: unknown }).startTime === 'string';
  if (!Array.isArray(scheduled_classes) || scheduled_classes.length > 300 || !scheduled_classes.every(validClass)) {
    return NextResponse.json({ error: "Send a list of classes with a course code, day and start time." }, { status: 400 });
  }

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

  if (activityLabel) {
    logActivity(user.id, 'update_timetable', activityLabel, req).catch(console.error);
  }

  return NextResponse.json({ scheduled_classes: (timetable.data as { scheduled_classes?: unknown[] }).scheduled_classes });
}
