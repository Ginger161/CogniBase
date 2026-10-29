// Spaced repetition: a small SM-2 variant. Pure, so it is easy to test and runs on the server only.

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

export type SrsState = { ease: number; intervalDays: number; reps: number; lapses: number };

export const NEW_STATE: SrsState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

const MIN_EASE = 1.3;
const DAY_MS = 86_400_000;
const AGAIN_DELAY_MS = 10 * 60_000;

export function isGrade(x: unknown): x is Grade {
  return typeof x === 'string' && (GRADES as string[]).includes(x);
}

/** The card's next state and when it is due, given how the answer went. */
export function schedule(state: SrsState, grade: Grade, now: Date): SrsState & { dueAt: Date } {
  let { ease, intervalDays } = state;
  const { reps, lapses } = state;

  if (grade === 'again') {
    // A miss comes back within the session and loses ground on ease.
    return { ease: Math.max(MIN_EASE, ease - 0.2), intervalDays: 0, reps: 0, lapses: lapses + 1, dueAt: new Date(now.getTime() + AGAIN_DELAY_MS) };
  }

  if (grade === 'hard') {
    ease = Math.max(MIN_EASE, ease - 0.15);
    intervalDays = Math.max(1, Math.round(Math.max(intervalDays, 1) * 1.2));
  } else if (grade === 'good') {
    intervalDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(intervalDays * ease);
  } else {
    ease += 0.15;
    intervalDays = reps === 0 ? 3 : Math.round(Math.max(intervalDays, 1) * ease * 1.3);
  }
  intervalDays = Math.min(365, Math.max(1, intervalDays));
  return { ease, intervalDays, reps: reps + 1, lapses, dueAt: new Date(now.getTime() + intervalDays * DAY_MS) };
}
