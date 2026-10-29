'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Sheet from '@/components/ui/Sheet';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { buildPlan, daysBetween, type PlanDoc } from '@/lib/study-plan';

type Exam = { id: string; title: string; examDate: string; documents: PlanDoc[] };
type Source = { id: string; name: string };

const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl';

export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Exams and the study plan worked out from them: what to read, review and quiz on each day until the exam. */
export default function ExamsSection() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/exams');
      if (!res.ok) throw await readApiError(res, 'Could not load your exams.');
      setExams((await res.json()).exams ?? []);
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load your exams.'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load exams when the tab opens
    void load();
  }, [load]);

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/exams?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw await readApiError(res, 'Could not remove that exam.');
      setExams((list) => list?.filter((e) => e.id !== id) ?? list);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove that exam.'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2"
      >
        <Plus size={18} aria-hidden /> Add an exam
      </button>

      {error && (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {exams === null && !error && <div className="h-28 rounded-2xl bg-[var(--bg-surface)] animate-pulse" aria-busy="true" aria-label="Loading exams" />}

      {exams?.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-[var(--border-strong)] px-6 py-10 flex flex-col items-center gap-3 text-center">
          <CalendarClock size={30} className="text-[var(--accent-text)]" aria-hidden />
          <p className="text-lg font-semibold">No exams yet</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">Add an exam and the sources it covers. CogniBase spreads your reading, cards and quizzes across the days you have.</p>
        </div>
      )}

      {exams?.map((exam) => {
        const days = daysBetween(now, new Date(exam.examDate));
        const plan = buildPlan({ title: exam.title, examDate: new Date(exam.examDate) }, exam.documents, now);
        return (
          <section key={exam.id} className={`${card} p-4 flex flex-col gap-3`} aria-label={exam.title}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <h2 className="text-[17px] font-bold leading-snug">{exam.title}</h2>
                <p className="text-sm text-[var(--accent-text)] font-semibold">{countdownLabel(days)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(exam.examDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                  {exam.documents.length > 0 && ` · ${exam.documents.length} source${exam.documents.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button type="button" onClick={() => remove(exam.id)} aria-label={`Remove ${exam.title}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]">
                <Trash2 size={18} aria-hidden />
              </button>
            </div>

            {plan.length > 0 ? (
              <ol className="flex flex-col gap-2.5" aria-label="Study plan">
                {plan.map((day, i) => (
                  <li key={day.date} className="flex gap-3">
                    <span className={`w-14 shrink-0 text-xs font-semibold pt-0.5 ${i === 0 ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}>
                      {i === 0 ? 'Today' : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </span>
                    <ul className="flex-1 flex flex-col gap-1">
                      {day.tasks.map((t, j) => (
                        <li key={j} className="text-sm text-[var(--text-secondary)]">
                          {t.documentId ? (
                            <Link href={`/lecture-materials/${t.documentId}`} className="hover:text-[var(--accent-text)] underline decoration-[var(--border-strong)] underline-offset-2">
                              {t.label}
                            </Link>
                          ) : (
                            t.label
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">This exam date has passed.</p>
            )}
          </section>
        );
      })}

      <AddExamSheet open={adding} onClose={() => setAdding(false)} onAdded={load} />
    </div>
  );
}

function AddExamSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/documents')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => Array.isArray(list) && setSources(list.map((d: Source) => ({ id: d.id, name: d.name }))))
      .catch(() => {});
  }, [open]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/exams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, date, documentIds: picked }) });
      if (!res.ok) throw await readApiError(res, 'Could not save that exam.');
      setTitle('');
      setDate('');
      setPicked([]);
      onClose();
      onAdded();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save that exam.'));
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const field = 'h-12 w-full rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] px-3.5 text-[15px] outline-none focus:border-[var(--accent-solid)]';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add an exam"
      footer={
        <button
          type="button"
          onClick={save}
          disabled={busy || !title.trim() || !date}
          className="w-full h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save exam'}
        </button>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BIO 101 final" maxLength={80} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Date
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-semibold mb-1">Sources it covers</legend>
          {sources.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Add sources to your Library first, then pick them here.</p>
          ) : (
            sources.map((s) => (
              <label key={s.id} className="flex items-center gap-3 min-h-11 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(s.id)}
                  onChange={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                  className="w-5 h-5 accent-[var(--accent-solid)]"
                />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
              </label>
            ))
          )}
        </fieldset>
      </div>
    </Sheet>
  );
}
