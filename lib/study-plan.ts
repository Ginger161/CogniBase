// Turns an exam date and the sources it covers into a day-by-day plan.
// Deterministic on purpose: it costs nothing, works offline, and gives the same answer every time you open it.

export type PlanDoc = { id: string; name: string; progress: number };
export type PlanTask = { kind: 'read' | 'cards' | 'quiz' | 'revise' | 'exam'; label: string; documentId?: string };
export type PlanDay = { date: string; daysToExam: number; tasks: PlanTask[] };

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, counted on the calendar (so 11pm tonight to 8am tomorrow is 1 day). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * Up to `horizon` days of tasks starting today. Early days are for reading what is least read,
 * the middle is practice (cards and quizzes), and the last two days are revision.
 */
export function buildPlan(exam: { title: string; examDate: Date }, docs: PlanDoc[], now: Date, horizon = 7): PlanDay[] {
  const total = daysBetween(now, exam.examDate);
  if (total < 0) return [];

  // Least-read sources first, so reading time goes where it is needed.
  const queue = [...docs].sort((a, b) => a.progress - b.progress);
  const toRead = queue.filter((d) => d.progress < 0.9);

  const readDays = total >= 5 ? Math.max(1, Math.round((total - 2) * 0.5)) : total >= 3 ? 1 : 0;
  const days: PlanDay[] = [];

  for (let i = 0; i <= Math.min(total, horizon - 1); i++) {
    const daysToExam = total - i;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const tasks: PlanTask[] = [];

    if (daysToExam === 0) {
      tasks.push({ kind: 'exam', label: `${exam.title} today` }, { kind: 'cards', label: 'Quick look at your due cards' });
    } else if (daysToExam <= 2) {
      tasks.push({ kind: 'cards', label: 'Clear your due flashcards' });
      const weakest = queue[0];
      tasks.push({ kind: 'quiz', label: weakest ? `Quiz on ${weakest.name}` : 'Take a quiz', documentId: weakest?.id });
      if (daysToExam === 1) tasks.push({ kind: 'revise', label: 'Light revision, then rest early' });
    } else if (i < readDays && toRead.length > 0) {
      // Spread the unread sources across the reading days.
      const perDay = Math.ceil(toRead.length / readDays);
      for (const d of toRead.slice(i * perDay, (i + 1) * perDay)) tasks.push({ kind: 'read', label: `Read ${d.name}`, documentId: d.id });
      tasks.push({ kind: 'cards', label: 'Review due flashcards' });
    } else {
      const doc = queue.length > 0 ? queue[(i - readDays + queue.length) % queue.length] : undefined;
      tasks.push({ kind: 'cards', label: 'Review due flashcards' });
      tasks.push({ kind: 'quiz', label: doc ? `Quiz on ${doc.name}` : 'Take a quiz', documentId: doc?.id });
    }

    days.push({ date: date.toISOString(), daysToExam, tasks });
  }
  return days;
}
