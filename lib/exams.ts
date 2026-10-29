import { prisma } from '@/lib/prisma';

export type ExamSummary = {
  id: string;
  title: string;
  examDate: Date;
  documents: { id: string; name: string; progress: number }[];
};

/** Upcoming exams with how far through each covered source the student is. */
export async function upcomingExams(userId: string, limit?: number): Promise<ExamSummary[]> {
  // Keep an exam on screen through its own day.
  const since = new Date(Date.now() - 36 * 3_600_000);
  const exams = await prisma.exam.findMany({
    where: { userId, examDate: { gte: since } },
    orderBy: { examDate: 'asc' },
    take: limit,
    select: { id: true, title: true, examDate: true, documentIds: true },
  });
  if (exams.length === 0) return [];

  const ids = [...new Set(exams.flatMap((e) => e.documentIds))];
  const [docs, progress] = await Promise.all([
    prisma.document.findMany({ where: { id: { in: ids }, workspace: { userId } }, select: { id: true, name: true } }),
    prisma.readingProgress.findMany({ where: { userId, documentId: { in: ids } }, select: { documentId: true, progress: true } }),
  ]);
  const read = new Map(progress.map((p) => [p.documentId, p.progress]));
  const byId = new Map(docs.map((d) => [d.id, { id: d.id, name: d.name, progress: read.get(d.id) ?? 0 }]));

  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    examDate: e.examDate,
    documents: e.documentIds.map((id) => byId.get(id)).filter((d): d is NonNullable<typeof d> => !!d),
  }));
}
