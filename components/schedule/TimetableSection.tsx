'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { checkClash } from '@/lib/utils/timetable';
import { formatClassTime, parseTimeToMinutes } from '@/lib/utils/schedule';
import type { ClassItem, Clash } from './useSchedule';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const input =
  'w-full h-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] px-4 text-[15px] outline-none focus:border-[var(--accent-solid)] placeholder:text-[var(--text-muted)]';

// <input type="time"> wants "HH:MM"; stored classes may be "9:00 AM".
function toInputTime(raw: string | undefined): string {
  const mins = parseTimeToMinutes(raw);
  if (mins === null) return '';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

type Props = {
  classes: ClassItem[];
  busy: string | null;
  pendingClashes: Clash[] | null;
  onExtract: (file: File) => Promise<void> | void;
  onSave: (item: Omit<ClassItem, 'id'> & { id?: string }) => Promise<boolean>;
  onRemove: (ids: string[]) => Promise<boolean>;
  onClear: () => Promise<boolean>;
  onKeepClashes: () => Promise<void>;
  onDiscardClashes: () => void;
};

function ClassSheet({ editing, open, classes, onClose, onSave }: { editing: ClassItem | null; open: boolean; classes: ClassItem[]; onClose: () => void; onSave: Props['onSave'] }) {
  // The parent remounts this sheet (key) for each add/edit, so initial state is the form's starting point.
  const [code, setCode] = useState(editing?.courseCode ?? '');
  const [title, setTitle] = useState(editing?.courseTitle ?? '');
  const [day, setDay] = useState(editing?.day ?? 'Monday');
  const [start, setStart] = useState(toInputTime(editing?.startTime) || '08:00');
  const [end, setEnd] = useState(toInputTime(editing?.endTime) || '09:00');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [saving, setSaving] = useState(false);

  const draft = { courseCode: code, day, startTime: start, endTime: end };
  const clash = code && start ? checkClash(draft, classes.filter((c) => c.id !== editing?.id)) : { hasClash: false };
  const invalid = !code.trim() || !start || !end || (parseTimeToMinutes(end) ?? 0) <= (parseTimeToMinutes(start) ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setSaving(true);
    const ok = await onSave({ id: editing?.id, courseCode: code, courseTitle: title.trim(), day, startTime: start, endTime: end, location: location.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit class' : 'Add a class'}
      footer={
        <button
          type="submit"
          form="class-form"
          disabled={saving || invalid}
          className="w-full h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {editing ? 'Save changes' : 'Add class'}
        </button>
      }
    >
      <form id="class-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <input aria-label="Course code" className={input} placeholder="CS101" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input aria-label="Course title" className={input} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label className="text-[13px] font-medium text-[var(--text-secondary)]" htmlFor="class-day">
          Day
        </label>
        <select id="class-day" className={input} value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]" htmlFor="class-start">
              Starts
            </label>
            <input id="class-start" type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]" htmlFor="class-end">
              Ends
            </label>
            <input id="class-end" type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <input aria-label="Location" className={input} placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        {clash.hasClash && (
          <p role="status" className="flex items-center gap-2 text-sm text-[var(--danger)]">
            <AlertTriangle size={16} aria-hidden /> Overlaps with {clash.clashingCourse}. You can still save it.
          </p>
        )}
      </form>
    </Sheet>
  );
}

export default function TimetableSection({ classes, busy, pendingClashes, onExtract, onSave, onRemove, onClear, onKeepClashes, onDiscardClashes }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<{ editing: ClassItem | null; n: number } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const grouped = useMemo(() => {
    const clashIds = new Set<string>();
    classes.forEach((a, i) => classes.slice(i + 1).forEach((b) => {
      if (checkClash(a, [b]).hasClash) {
        clashIds.add(a.id);
        clashIds.add(b.id);
      }
    }));
    return DAYS.map((day) => ({
      day,
      items: classes
        .filter((c) => c.day.trim().toLowerCase() === day.toLowerCase())
        .sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0))
        .map((c) => ({ ...c, clash: clashIds.has(c.id) })),
    })).filter((g) => g.items.length > 0);
  }, [classes]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="min-h-12 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center justify-center gap-2 px-3 text-center hover:border-[var(--accent-solid)] disabled:opacity-60"
        >
          {busy ? <Loader2 size={18} className="animate-spin shrink-0" aria-hidden /> : <Upload size={18} className="shrink-0" aria-hidden />}
          <span className="text-sm">{busy ?? 'Import timetable'}</span>
        </button>
        <button
          type="button"
          onClick={() => setSheet({ editing: null, n: Date.now() })}
          className="min-h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2"
        >
          <Plus size={18} strokeWidth={2.6} aria-hidden /> Add class
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/*,application/pdf,.docx,.xlsx,.csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onExtract(f);
          e.target.value = '';
        }}
      />

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface-alt)] px-4 min-h-12">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <button type="button" onClick={() => setConfirmDelete(selected)} className="min-h-11 px-2 text-sm font-semibold text-[var(--danger)]">
            Delete
          </button>
        </div>
      )}

      {classes.length === 0 ? (
        <p className="text-center text-sm text-[var(--text-secondary)] py-8">No classes yet. Import a timetable or add one by hand.</p>
      ) : (
        <>
          {grouped.map((g) => (
            <section key={g.day} aria-label={g.day} className="flex flex-col">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] min-h-9 flex items-center">{g.day}</h3>
              <ul>
                {g.items.map((c) => (
                  <li key={c.id} className="flex items-center gap-1 min-h-16 border-b border-[var(--bg-surface-alt)]">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.includes(c.id)}
                      aria-label={`Select ${c.courseCode} on ${g.day}`}
                      onClick={() => toggle(c.id)}
                      className="w-11 h-11 flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-[22px] h-[22px] rounded-[7px] border-[1.5px] ${selected.includes(c.id) ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)]' : 'border-[var(--text-muted)]'}`}
                        aria-hidden
                      />
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5 py-2">
                      <span className="text-[15px] font-semibold truncate">
                        {c.courseCode}
                        {c.courseTitle ? <span className="font-normal text-[var(--text-secondary)]"> · {c.courseTitle}</span> : null}
                      </span>
                      <span className={`text-xs ${c.clash ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                        {formatClassTime(c.startTime)}
                        {c.endTime ? ` – ${formatClassTime(c.endTime)}` : ''}
                        {c.location ? ` · ${c.location}` : ''}
                        {c.clash ? ' · overlaps another class' : ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => setSheet({ editing: c, n: Date.now() })} aria-label={`Edit ${c.courseCode}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <Pencil size={17} aria-hidden />
                    </button>
                    <button type="button" onClick={() => setConfirmDelete([c.id])} aria-label={`Delete ${c.courseCode}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]">
                      <Trash2 size={17} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" onClick={() => setConfirmClear(true)} className="self-center min-h-11 px-3 text-sm font-semibold text-[var(--danger)]">
            Clear whole timetable
          </button>
        </>
      )}

      {sheet && <ClassSheet key={sheet.n} open editing={sheet.editing} classes={classes} onClose={() => setSheet(null)} onSave={onSave} />}

      <ConfirmSheet
        open={!!confirmDelete}
        title={confirmDelete && confirmDelete.length > 1 ? `Delete ${confirmDelete.length} classes?` : 'Delete this class?'}
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (confirmDelete && (await onRemove(confirmDelete))) setSelected((s) => s.filter((id) => !confirmDelete.includes(id)));
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmSheet
        open={confirmClear}
        title="Clear your whole timetable?"
        message="Every class is deleted. This cannot be undone."
        confirmLabel="Clear timetable"
        destructive
        onConfirm={async () => {
          if (await onClear()) setSelected([]);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />

      <Sheet
        open={!!pendingClashes}
        onClose={onDiscardClashes}
        title="Some classes overlap"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={onDiscardClashes} className="flex-1 h-12 rounded-xl border border-[var(--border-strong)] font-semibold">
              Skip them
            </button>
            <button type="button" onClick={onKeepClashes} className="flex-1 h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
              Keep anyway
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-secondary)] mb-3">These classes overlap with ones you already have:</p>
        <ul className="flex flex-col gap-2">
          {pendingClashes?.map((c) => (
            <li key={c.id} className="rounded-xl bg-[var(--bg-surface-alt)] px-4 py-3 text-sm">
              <span className="font-semibold">{c.courseCode}</span> · {c.day} {formatClassTime(c.startTime)}
              <span className="text-[var(--danger)]"> overlaps {c.clashingWith}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
