'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Plus } from 'lucide-react';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import type { Course } from './useSchedule';

const input =
  'w-full h-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] px-4 text-[15px] outline-none focus:border-[var(--accent-solid)] placeholder:text-[var(--text-muted)]';
const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col gap-4';

type Props = {
  courses: Course[];
  busy: string | null;
  onExtract: (file: File) => Promise<void> | void;
  onAdd: (course: Course) => Promise<boolean>;
  onRemove: (codes: string[]) => Promise<boolean>;
};

export default function CoursesSection({ courses, busy, onExtract, onAdd, onRemove }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState<'First' | 'Second'>('First');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;
    if (await onAdd({ courseCode: code, courseTitle: title, semester })) {
      setCode('');
      setTitle('');
    }
  };

  const toggle = (c: string) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const bySemester = (['First', 'Second'] as const)
    .map((s) => ({ semester: s, items: courses.filter((c) => (c.semester || 'First') === s) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <section className={card} aria-labelledby="extract-h">
        <div className="flex flex-col gap-1">
          <h2 id="extract-h" className="text-base font-bold">
            Import from your registration form
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">Upload a photo or PDF and we will read the course codes for you.</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="h-12 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center justify-center gap-2 hover:border-[var(--accent-solid)] disabled:opacity-60"
        >
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />}
          {busy ?? 'Choose a photo or PDF'}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onExtract(f);
            e.target.value = '';
          }}
        />
      </section>

      <form onSubmit={submit} className={card} aria-labelledby="add-course-h">
        <h2 id="add-course-h" className="text-base font-bold">
          Add a course
        </h2>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <label className="sr-only" htmlFor="course-code">
            Course code
          </label>
          <input id="course-code" className={input} placeholder="CS101" value={code} onChange={(e) => setCode(e.target.value)} required />
          <label className="sr-only" htmlFor="course-title">
            Course title
          </label>
          <input id="course-title" className={input} placeholder="Introduction to Computing" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex items-center gap-3">
          <div role="radiogroup" aria-label="Semester" className="flex gap-2 flex-1">
            {(['First', 'Second'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={semester === s}
                onClick={() => setSemester(s)}
                className={`flex-1 h-11 rounded-xl border text-sm font-semibold ${
                  semester === s ? 'border-[var(--accent-solid)] bg-[var(--tag-bg)] text-[var(--tag-text)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
                }`}
              >
                {s} semester
              </button>
            ))}
          </div>
          <button type="submit" aria-label="Add course" className="w-12 h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] flex items-center justify-center shrink-0">
            <Plus size={22} strokeWidth={2.6} aria-hidden />
          </button>
        </div>
      </form>

      {courses.length === 0 ? (
        <p className="text-center text-sm text-[var(--text-secondary)] py-6">No courses yet. Import your form or add one above.</p>
      ) : (
        <>
          {selected.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface-alt)] px-4 min-h-12">
              <span className="text-sm font-semibold">{selected.length} selected</span>
              <button type="button" onClick={() => setConfirm(selected)} className="min-h-11 px-2 text-sm font-semibold text-[var(--danger)]">
                Remove
              </button>
            </div>
          )}
          {bySemester.map((g) => (
            <section key={g.semester} aria-label={`${g.semester} semester`} className="flex flex-col">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] min-h-9 flex items-center">{g.semester} semester</h3>
              <ul>
                {g.items.map((c) => (
                  <li key={c.courseCode} className="flex items-center gap-1 min-h-14 border-b border-[var(--bg-surface-alt)]">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.includes(c.courseCode)}
                      aria-label={`Select ${c.courseCode}`}
                      onClick={() => toggle(c.courseCode)}
                      className="w-11 h-11 flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-[22px] h-[22px] rounded-[7px] border-[1.5px] ${
                          selected.includes(c.courseCode) ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)]' : 'border-[var(--text-muted)]'
                        }`}
                        aria-hidden
                      />
                    </button>
                    <div className="flex flex-col min-w-0 py-2">
                      <span className="text-[15px] font-semibold">{c.courseCode}</span>
                      <span className="text-[13px] text-[var(--text-secondary)] truncate">{c.courseTitle}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <ConfirmSheet
        open={!!confirm}
        title={confirm && confirm.length > 1 ? `Remove ${confirm.length} courses?` : 'Remove this course?'}
        message="They are removed from your profile. Your timetable and sources are not affected."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (confirm && (await onRemove(confirm))) setSelected([]);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
