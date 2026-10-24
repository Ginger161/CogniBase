"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BrainCircuit, Check, ChevronLeft, Share2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Flashcard {
  question: string;
  answer: string;
}

interface Phase {
  phaseId: string;
  title: string;
  microBites: string[];
  flashcards: Flashcard[];
}

interface GuideData {
  guideTitle?: string;
  phases: Phase[];
}

interface StudyEngineProps {
  guideData: unknown;
  guideId?: string;
  initialPublic?: boolean;
  /** Shown as a back button above the quest log. */
  onClose?: () => void;
}

type View = 'quest_log' | 'micro_bite' | 'flashcards';

function parseGuide(raw: unknown): GuideData | null {
  try {
    const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as GuideData | null;
    if (!data || !Array.isArray(data.phases)) return null;
    return {
      ...data,
      phases: data.phases.map((p, i) => ({
        phaseId: String(p.phaseId ?? i + 1),
        title: p.title || `Phase ${i + 1}`,
        microBites: Array.isArray(p.microBites) ? p.microBites : [],
        flashcards: Array.isArray(p.flashcards) ? p.flashcards : [],
      })),
    };
  } catch {
    return null;
  }
}

export function StudyEngine({ guideData, guideId, initialPublic = false, onClose }: StudyEngineProps) {
  const reduceMotion = useReducedMotion();
  const data = useMemo(() => parseGuide(guideData), [guideData]);

  const [view, setView] = useState<View>('quest_log');
  const [activeIndex, setActiveIndex] = useState(0);
  const [biteIndex, setBiteIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!guideId) return;
    let cancelled = false;
    fetch(`/api/study-guides/progress?guideId=${encodeURIComponent(guideId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d?.completedPhases) setCompleted(new Set(d.completedPhases));
      })
      .catch((err) => console.error('Failed to fetch progress', err));
    return () => {
      cancelled = true;
    };
  }, [guideId]);

  if (!data || data.phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-[var(--text-secondary)] p-8 text-center gap-3">
        <BrainCircuit size={48} className="text-[var(--text-muted)]" aria-hidden />
        <p>This study guide is in an older format or did not generate correctly. Build a new one from Library.</p>
      </div>
    );
  }

  const phases = data.phases;
  const active = phases[activeIndex];
  const doneCount = phases.filter((p) => completed.has(p.phaseId)).length;
  const currentIndex = phases.findIndex((p) => !completed.has(p.phaseId));

  const markComplete = (phaseId: string) => {
    if (completed.has(phaseId)) return;
    setCompleted((prev) => new Set(prev).add(phaseId));
    if (!guideId) return;
    fetch('/api/study-guides/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId, phaseId }),
    }).catch((err) => console.error(err));
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete_phase' }),
    }).catch((err) => console.error(err));
  };

  const startPhase = (index: number) => {
    const phase = phases[index];
    setActiveIndex(index);
    setBiteIndex(0);
    setCardIndex(0);
    setFlipped(false);
    if (phase.microBites.length > 0) setView('micro_bite');
    else if (phase.flashcards.length > 0) setView('flashcards');
    else markComplete(phase.phaseId);
  };

  const finishPhase = () => {
    markComplete(active.phaseId);
    setView('quest_log');
    toast.success(`${active.title} complete`);
  };

  const nextBite = () => {
    if (biteIndex < active.microBites.length - 1) setBiteIndex(biteIndex + 1);
    else if (active.flashcards.length > 0) {
      setCardIndex(0);
      setFlipped(false);
      setView('flashcards');
    } else finishPhase();
  };

  const nextCard = () => {
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flashcard_review' }),
    }).catch((err) => console.error(err));
    if (cardIndex < active.flashcards.length - 1) {
      setCardIndex(cardIndex + 1);
      setFlipped(false);
    } else finishPhase();
  };

  const toggleShare = async () => {
    if (!guideId || sharing) return;
    const next = !isPublic;
    setSharing(true);
    try {
      const res = await fetch(`/api/study-guides/${guideId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error();
      setIsPublic(next);
      if (next) {
        const shareUrl = `${window.location.origin}/share/guide/${guideId}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: data.guideTitle || 'My CogniBase Study Guide', url: shareUrl });
          } catch {
            /* the share sheet was dismissed */
          }
        } else {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Link copied. Anyone with it can read this guide.');
        }
      } else {
        toast.success('This guide is private again.');
      }
    } catch {
      toast.error('Could not change sharing. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const itemsInPhase = active.microBites.length + active.flashcards.length;
  const itemsDone = view === 'micro_bite' ? biteIndex : active.microBites.length + cardIndex;
  const anim = (props: object) => (reduceMotion ? {} : props);

  return (
    <div className="w-full">
      <section aria-label="Quest log" className="flex flex-col gap-5">
        {onClose && (
          <button type="button" onClick={onClose} className="self-start -ml-2 min-h-11 px-2 flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ChevronLeft size={18} aria-hidden /> All guides
          </button>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--accent-text)]">Study guide</span>
            <h2 className="text-[26px] leading-tight font-bold tracking-tight">{data.guideTitle || 'Study quest'}</h2>
          </div>
          {guideId && (
            <button
              type="button"
              onClick={toggleShare}
              disabled={sharing}
              aria-pressed={isPublic}
              className={`shrink-0 h-11 px-4 rounded-full border text-sm font-semibold flex items-center gap-2 disabled:opacity-50 ${
                isPublic ? 'border-[var(--accent-solid)] text-[var(--tag-text)] bg-[var(--tag-bg)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
              }`}
            >
              <Share2 size={16} aria-hidden />
              {isPublic ? 'Shared' : 'Share'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-2 rounded bg-[var(--border-color)] overflow-hidden"
            role="progressbar"
            aria-label="Guide progress"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={phases.length}
          >
            <div className="h-full bg-gradient-to-r from-[var(--accent-solid)] to-[var(--accent-text)]" style={{ width: `${(doneCount / phases.length) * 100}%` }} />
          </div>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
            {doneCount} of {phases.length}
          </span>
        </div>

        <ol className="relative flex flex-col">
          <span className="absolute left-[15px] top-5 bottom-5 w-0.5 bg-[var(--border-color)]" aria-hidden />
          {phases.map((phase, i) => {
            const done = completed.has(phase.phaseId);
            const current = i === currentIndex;
            return (
              <li key={phase.phaseId} className="relative flex gap-3.5 items-start py-2.5">
                <span
                  className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                    done
                      ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-[var(--on-accent)]'
                      : current
                        ? 'bg-[var(--bg-base)] border-[var(--accent-solid)] text-[var(--accent-text)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-strong)] text-[var(--text-muted)]'
                  }`}
                  aria-hidden
                >
                  {done ? <Check size={16} strokeWidth={3.2} /> : i + 1}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <button type="button" onClick={() => startPhase(i)} className="text-left min-h-11 flex flex-col justify-center gap-0.5">
                    <span className={`text-[15px] font-semibold ${done || current ? '' : 'text-[var(--text-secondary)]'}`}>{phase.title}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {done ? 'Done · tap to review' : current ? 'Up next' : 'Upcoming'} · {phase.microBites.length} bites · {phase.flashcards.length} cards
                    </span>
                  </button>
                  {current && (
                    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--accent-solid)]/50 p-3.5 flex flex-col gap-3 shadow-[0_0_24px_var(--tag-bg)]">
                      {phase.microBites[0] && <p className="text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">{phase.microBites[0]}</p>}
                      <button
                        type="button"
                        onClick={() => startPhase(i)}
                        className="h-11 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold"
                      >
                        {completed.size === 0 ? 'Start' : 'Continue'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <AnimatePresence>
        {view !== 'quest_log' && (
          <motion.div
            key={view}
            role="dialog"
            aria-modal="true"
            aria-label={view === 'micro_bite' ? 'Micro-bite reader' : 'Flashcards'}
            {...anim({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 24 } })}
            className="fixed inset-0 z-[55] bg-[var(--bg-base)] flex flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setView('quest_log')} aria-label="Back to quest log" className="w-11 h-11 -ml-2 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={22} aria-hidden />
              </button>
              <div
                className="flex-1 h-2 rounded bg-[var(--border-color)] overflow-hidden"
                role="progressbar"
                aria-label="Phase progress"
                aria-valuenow={itemsDone}
                aria-valuemin={0}
                aria-valuemax={itemsInPhase}
              >
                <div className="h-full bg-[var(--accent-solid)] transition-[width]" style={{ width: `${(itemsDone / Math.max(1, itemsInPhase)) * 100}%` }} />
              </div>
            </div>

            <p className="mt-5 text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] text-center">
              {view === 'micro_bite' ? `${active.title} · bite ${biteIndex + 1} of ${active.microBites.length}` : `Knowledge check · card ${cardIndex + 1} of ${active.flashcards.length}`}
            </p>

            {view === 'micro_bite' ? (
              <>
                <div className="flex-1 flex items-center justify-center py-6 overflow-y-auto">
                  <motion.p
                    key={biteIndex}
                    {...anim({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } })}
                    className="text-2xl md:text-3xl font-medium leading-snug text-center max-w-2xl"
                  >
                    {active.microBites[biteIndex]}
                  </motion.p>
                </div>
                <button type="button" onClick={nextBite} className="h-14 rounded-2xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold text-lg active:scale-[0.99]">
                  {biteIndex < active.microBites.length - 1 ? 'Continue' : active.flashcards.length > 0 ? 'Check yourself' : 'Finish phase'}
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 flex items-center justify-center py-6" style={{ perspective: '1000px' }}>
                  <motion.button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    aria-label={flipped ? 'Showing answer. Tap to see the question' : 'Showing question. Tap to reveal the answer'}
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="relative w-full max-w-xl min-h-[320px] md:min-h-[380px] text-left"
                  >
                    <span
                      aria-hidden={flipped}
                      className="absolute inset-0 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-7 flex flex-col items-center justify-center gap-3 shadow-2xl"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="absolute top-5 text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)]">Question</span>
                      <span className="text-2xl font-bold text-center leading-snug">{active.flashcards[cardIndex].question}</span>
                      <span className="absolute bottom-5 text-sm font-semibold text-[var(--accent-text)]">Tap to flip</span>
                    </span>
                    <span
                      aria-hidden={!flipped}
                      className="absolute inset-0 rounded-3xl bg-[var(--accent-solid)] text-[var(--on-accent)] p-7 flex flex-col items-center justify-center shadow-2xl"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <span className="absolute top-5 text-xs font-semibold tracking-widest uppercase opacity-70">Answer</span>
                      <span className="text-2xl font-bold text-center leading-snug">{active.flashcards[cardIndex].answer}</span>
                    </span>
                  </motion.button>
                </div>
                <button
                  type="button"
                  onClick={nextCard}
                  disabled={!flipped}
                  className="h-14 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] font-bold text-lg disabled:opacity-40 active:scale-[0.99]"
                >
                  {flipped ? (cardIndex < active.flashcards.length - 1 ? 'Got it, next' : 'Finish phase') : 'Flip the card first'}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
