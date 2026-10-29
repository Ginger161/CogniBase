'use client';

import React, { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';

export type QuizQuestion = { question: string; options: string[]; answerIndex: number; explanation?: string };

const LETTERS = ['A', 'B', 'C', 'D'];

/** One question at a time, with the answer and the reason shown straight after each pick. */
export default function QuizPlayer({ assetId, questions }: { assetId: string; questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(0);

  const q = questions[index];
  const answered = picked !== null;

  const finish = async (finalScore: number) => {
    setDone(true);
    try {
      const res = await fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, score: finalScore, total: questions.length }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not save your score.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save your score.'));
    }
  };

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.answerIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (index === questions.length - 1) {
      finish(score);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
    setRound((r) => r + 1);
  };

  if (done) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)]">Your score</p>
        <p className="text-6xl font-black tabular-nums">
          {score}
          <span className="text-[var(--text-muted)]">/{questions.length}</span>
        </p>
        <p className="text-[15px] text-[var(--text-secondary)] max-w-xs">
          {percent >= 80 ? 'Strong. You know this well.' : percent >= 50 ? 'A solid start. Go back over what you missed.' : 'Worth another read of the source, then try again.'}
        </p>
        <button
          type="button"
          onClick={restart}
          className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center gap-2"
        >
          <RotateCcw size={18} aria-hidden /> Try again
        </button>
      </div>
    );
  }

  return (
    <div key={round} className="flex-1 overflow-y-auto px-5 py-6">
      <div className="w-full max-w-xl mx-auto flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            Question {index + 1} of {questions.length}
          </p>
          <div className="h-1 rounded bg-[var(--border-color)] overflow-hidden" aria-hidden>
            <div className="h-full bg-[var(--accent-solid)] transition-[width]" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
        </div>

        <h3 className="text-xl font-bold leading-snug">{q.question}</h3>

        <ul className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answers">
          {q.options.map((option, i) => {
            const isRight = i === q.answerIndex;
            const isPicked = i === picked;
            const state = !answered
              ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--accent-solid)]'
              : isRight
                ? 'border-[var(--accent-solid)] bg-[var(--tag-bg)]'
                : isPicked
                  ? 'border-[var(--danger)] bg-[var(--danger)]/10'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] opacity-60';
            return (
              <li key={i}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  disabled={answered}
                  onClick={() => choose(i)}
                  className={`w-full min-h-14 px-4 py-3 rounded-2xl border flex items-center gap-3 text-left text-[15px] ${state}`}
                >
                  <span className="w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-bold shrink-0" aria-hidden>
                    {answered && isRight ? <Check size={15} /> : answered && isPicked ? <X size={15} /> : LETTERS[i]}
                  </span>
                  <span className="flex-1">{option}</span>
                  {answered && (isRight || isPicked) && <span className="sr-only">{isRight ? 'Correct answer' : 'Your answer, incorrect'}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {answered && (
          <div className="flex flex-col gap-4">
            {q.explanation && (
              <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4">
                <span className="font-semibold text-[var(--text-primary)]">{picked === q.answerIndex ? 'Right. ' : 'Not quite. '}</span>
                {q.explanation}
              </p>
            )}
            <button type="button" onClick={next} className="h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
              {index === questions.length - 1 ? 'See my score' : 'Next question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
