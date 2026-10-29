'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, PartyPopper, X } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import type { Grade } from '@/lib/srs';

type Card = { assetId: string; cardIndex: number; question: string; answer: string; setTitle: string; isNew: boolean };

const GRADES: { grade: Grade; label: string; style: string }[] = [
  { grade: 'again', label: 'Again', style: 'border-[var(--danger)] text-[var(--danger)]' },
  { grade: 'hard', label: 'Hard', style: 'border-[var(--border-strong)] text-[var(--text-secondary)]' },
  { grade: 'good', label: 'Good', style: 'border-[var(--accent-solid)] text-[var(--accent-text)]' },
  { grade: 'easy', label: 'Easy', style: 'bg-[var(--accent-solid)] border-transparent text-[var(--on-accent)]' },
];

/** Today's flashcards across everything saved: due cards first, a few new ones, each scheduled by how it went. */
export default function ReviewSession({ onClose }: { onClose: () => void }) {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const retried = useRef(new Set<string>());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    let cancelled = false;
    fetch('/api/review')
      .then(async (res) => {
        if (!res.ok) throw await readApiError(res, 'Could not load your cards.');
        return res.json();
      })
      .then((d) => !cancelled && setQueue(Array.isArray(d.queue) ? d.queue : []))
      .catch((e) => {
        if (cancelled) return;
        toast.error(friendlyError(e, 'Could not load your cards.'));
        onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finish = useCallback(() => {
    // One credit for the whole session, not one per card.
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'flashcard_review' }) }).catch(() => {});
  }, []);

  const grade = async (g: Grade) => {
    if (!queue || queue.length === 0) return;
    const card = queue[0];
    const rest = queue.slice(1);
    setFlipped(false);
    setDone((n) => n + 1);
    // A miss comes back once more in this session, after the others.
    const key = `${card.assetId}:${card.cardIndex}`;
    if (g === 'again') {
      setAgain((n) => n + 1);
      if (!retried.current.has(key)) {
        retried.current.add(key);
        rest.push(card);
      }
    }
    setQueue(rest);
    if (rest.length === 0) finish();
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: card.assetId, cardIndex: card.cardIndex, grade: g }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not save that answer.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save that answer.'));
    }
  };

  const card = queue?.[0];
  const total = (queue?.length ?? 0) + done;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Review flashcards" className="fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col">
      <div className="shrink-0 flex items-center gap-2 pl-5 pr-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-[var(--border-color)] min-h-14">
        <h2 className="flex-1 text-base font-bold">Review</h2>
        {queue && total > 0 && (
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            {Math.min(done + 1, total)} / {total}
          </span>
        )}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X size={22} aria-hidden />
        </button>
      </div>

      {queue === null ? (
        <div className="m-auto flex items-center gap-2 text-[var(--text-secondary)]" role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Getting your cards…
        </div>
      ) : !card ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 text-center">
          <PartyPopper size={36} className="text-[var(--accent-text)]" aria-hidden />
          <p className="text-xl font-bold">{done > 0 ? 'Done for today' : 'Nothing due right now'}</p>
          <p className="text-[15px] text-[var(--text-secondary)] max-w-xs">
            {done > 0
              ? `You reviewed ${done} card${done === 1 ? '' : 's'}${again ? ` and missed ${again}, which will come back soon` : ''}. Cards return just before you would forget them.`
              : 'Make flashcards from a source, or highlight a passage and choose Card. They show up here when they are due.'}
          </p>
          <button type="button" onClick={onClose} className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
            Close
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-6">
          <p className="text-xs text-[var(--text-muted)]">
            {card.setTitle}
            {card.isNew && ' · New'}
          </p>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Showing the answer. Tap to see the question' : 'Showing the question. Tap to reveal the answer'}
            className={`w-full max-w-xl min-h-[300px] rounded-3xl p-7 flex flex-col items-center justify-center gap-3 text-center shadow-2xl border ${
              flipped ? 'bg-[var(--accent-solid)] text-[var(--on-accent)] border-transparent' : 'bg-[var(--bg-surface)] border-[var(--border-color)]'
            }`}
          >
            <span className={`text-xs font-semibold tracking-widest uppercase ${flipped ? 'opacity-70' : 'text-[var(--text-muted)]'}`}>{flipped ? 'Answer' : 'Question'}</span>
            <span className="text-2xl font-bold leading-snug">{flipped ? card.answer : card.question}</span>
            {!flipped && <span className="text-sm font-semibold text-[var(--accent-text)]">Tap to reveal</span>}
          </button>

          {flipped ? (
            <div className="w-full max-w-xl grid grid-cols-4 gap-2" role="group" aria-label="How did it go?">
              {GRADES.map((g) => (
                <button key={g.grade} type="button" onClick={() => grade(g.grade)} className={`h-12 rounded-xl border text-sm font-bold ${g.style}`}>
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Think of the answer first, then flip.</p>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
