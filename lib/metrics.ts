import { prisma } from '@/lib/prisma';

export function getMidnightDate(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Focus minutes and tasks credited per action.
const CREDITS: Record<string, { focusMinutes: number; tasksCompleted: number }> = {
  generate_guide: { focusMinutes: 15, tasksCompleted: 1 },
  upload_document: { focusMinutes: 5, tasksCompleted: 1 },
  flashcard_review: { focusMinutes: 10, tasksCompleted: 1 },
  chat_message: { focusMinutes: 1, tasksCompleted: 0 },
  generate_asset: { focusMinutes: 10, tasksCompleted: 1 },
  read_document: { focusMinutes: 20, tasksCompleted: 1 },
  complete_phase: { focusMinutes: 25, tasksCompleted: 1 },
};

export function isMetricAction(action: unknown): action is string {
  return typeof action === 'string' && action in CREDITS;
}

/** Credit today's DailyMetric for `userId`. The user row must already exist. */
export async function recordMetric(userId: string, action: string) {
  const credit = CREDITS[action];
  if (!credit) return null;
  const date = getMidnightDate(new Date());
  return prisma.dailyMetric.upsert({
    where: { date_userId: { date, userId } },
    update: {
      focusMinutes: { increment: credit.focusMinutes },
      tasksCompleted: { increment: credit.tasksCompleted },
    },
    create: { date, userId, focusMinutes: credit.focusMinutes, tasksCompleted: credit.tasksCompleted, averageAccuracy: 0 },
  });
}
