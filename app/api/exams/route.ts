import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { resolveScopedDocs } from '@/lib/scope';
import { upcomingExams } from '@/lib/exams';

const MAX_EXAMS = 20;

// Upcoming exams with how far through each covered source the student is. The client builds the day-by-day
// plan from this in the student's own time zone (see lib/study-plan.ts).
export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    return NextResponse.json({ exams: await upcomingExams(user.id) });
  } catch (error) {
    console.error('Exams GET error:', error);
    return NextResponse.json({ error: 'Could not load your exams.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const { title, date, documentIds } = await req.json().catch(() => ({}));
    const name = typeof title === 'string' ? title.trim().slice(0, 80) : '';
    if (!name) return NextResponse.json({ error: 'Give the exam a name.' }, { status: 400 });
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Choose the exam date.' }, { status: 400 });
    }
    // Noon UTC keeps the calendar day the same in every time zone that matters to the student.
    const examDate = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(examDate.getTime())) return NextResponse.json({ error: 'Choose the exam date.' }, { status: 400 });

    if ((await prisma.exam.count({ where: { userId: user.id } })) >= MAX_EXAMS) {
      return NextResponse.json({ error: 'You have the most exams you can track. Remove one to add another.' }, { status: 400 });
    }

    // Only sources the student owns can be attached, whatever ids the client sent.
    const owned = await resolveScopedDocs(user.id, { documentIds });
    const exam = await prisma.exam.create({
      data: { userId: user.id, title: name, examDate, documentIds: owned.map((d) => d.id) },
      select: { id: true },
    });
    return NextResponse.json({ id: exam.id });
  } catch (error) {
    console.error('Exams POST error:', error);
    return NextResponse.json({ error: 'Could not save that exam.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing exam.' }, { status: 400 });
    const { count } = await prisma.exam.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exams DELETE error:', error);
    return NextResponse.json({ error: 'Could not remove that exam.' }, { status: 500 });
  }
}
