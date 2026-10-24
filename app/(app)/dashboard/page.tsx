'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, FileText, Film, Globe, StickyNote, UploadCloud } from 'lucide-react';
import { findNextClass, formatClassTime, type TimetableClass } from '@/lib/utils/schedule';
import { formatSmartTime } from '@/lib/utils/time';

type HomeData = {
  name: string;
  classes: TimetableClass[];
  continueGuide: { id: string; title: string; total: number; completed: number; nextPhaseTitle: string | null } | null;
  focusGoal: number;
  week: { date: string; minutes: number }[];
  recent: { id: string; name: string; sourceType: string; createdAt: string }[];
  sourceCount: number;
};

function greeting(hour: number) {
  if (hour < 12) return 'This morning';
  if (hour < 18) return 'This afternoon';
  return 'Tonight';
}

const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 27;
  const circumference = 2 * Math.PI * r;
  const fraction = total > 0 ? done / total : 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${done} of ${total} phases complete`} className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-color)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--accent-solid)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circumference * fraction} ${circumference}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text-primary)">
        {done}/{total}
      </text>
    </svg>
  );
}

function sourceIcon(type: string) {
  if (type === 'youtube') return Film;
  if (type === 'website') return Globe;
  if (type === 'text') return StickyNote;
  return FileText;
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not load Home.');
        return res.json();
      })
      .then((d: HomeData) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-5 pt-8">
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <div className="h-9 w-40 rounded-lg bg-[var(--bg-surface)] animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />
        ))}
      </div>
    );
  }

  const next = findNextClass(data.classes, now);
  const todayKey = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).getTime();
  const todayMinutes = data.week.find((w) => new Date(w.date).getTime() === todayKey)?.minutes ?? 0;
  const goalFraction = Math.min(1, todayMinutes / Math.max(1, data.focusGoal));
  const guide = data.continueGuide;

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{greeting(now.getHours())}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {guide || next ? "One thing next, then you're done." : `Welcome, ${data.name}. Add a source to get started.`}
        </p>
      </div>

      {data.sourceCount === 0 && (
        <Link href="/vault" className={`${card} p-5 flex items-center gap-4 hover:border-[var(--accent-solid)]`}>
          <div className="w-12 h-12 rounded-xl bg-[var(--tag-bg)] flex items-center justify-center shrink-0">
            <UploadCloud size={24} className="text-[var(--accent-text)]" aria-hidden />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Add your first source</span>
            <span className="text-sm text-[var(--text-secondary)]">Upload notes or paste a link, then ask questions about it.</span>
          </div>
        </Link>
      )}

      <Link href="/schedule" className={`${card} p-4 flex items-center gap-3.5 hover:border-[var(--accent-solid)]`}>
        <div className="w-11 h-11 rounded-xl bg-[var(--tag-bg)] flex items-center justify-center shrink-0">
          <Clock size={22} className="text-[var(--accent-text)]" aria-hidden />
        </div>
        {next ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-medium tracking-wider uppercase text-[var(--text-muted)]">
              {next.isToday ? 'Today' : next.isTomorrow ? 'Tomorrow' : next.startsAt.toLocaleDateString(undefined, { weekday: 'long' })} · {formatClassTime(next.cls.startTime)}
            </span>
            <span className="text-[15px] font-semibold truncate">
              {next.cls.courseCode}
              {next.cls.courseTitle ? ` · ${next.cls.courseTitle}` : ''}
            </span>
            {next.cls.location && <span className="text-[13px] text-[var(--text-secondary)] truncate">{next.cls.location}</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{data.classes.length ? 'No more classes this week' : 'Add your timetable'}</span>
            <span className="text-[13px] text-[var(--text-secondary)]">
              {data.classes.length ? 'Open your schedule' : 'Upload it or enter classes by hand'}
            </span>
          </div>
        )}
      </Link>

      <div className={`${card} p-4 flex flex-col gap-3.5 relative overflow-hidden`}>
        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[var(--tag-bg)]" aria-hidden />
        <span className="relative text-xs font-semibold tracking-wider uppercase text-[var(--accent-text)]">
          {guide ? 'Continue studying' : 'Study'}
        </span>
        {guide ? (
          <>
            <div className="relative flex items-center gap-4">
              <ProgressRing done={guide.completed} total={guide.total} />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[17px] font-semibold leading-snug">{guide.title}</span>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {guide.completed >= guide.total && guide.total > 0 ? 'All phases complete' : guide.nextPhaseTitle ? `Next: ${guide.nextPhaseTitle}` : ''}
                </span>
              </div>
            </div>
            <Link
              href={`/study-guides?open=${encodeURIComponent(guide.id)}`}
              className="relative h-11 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center"
            >
              {guide.completed === 0 ? 'Start' : guide.completed >= guide.total ? 'Review' : 'Resume'}
            </Link>
          </>
        ) : (
          <>
            <p className="relative text-[15px] text-[var(--text-secondary)]">Turn any source into a guided study plan with flashcards.</p>
            <Link
              href="/vault"
              className="relative h-11 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center"
            >
              Pick a source in Library
            </Link>
          </>
        )}
      </div>

      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Focus today</span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-semibold">{todayMinutes}</span> / {data.focusGoal} min
          </span>
        </div>
        <div
          className="h-2 rounded bg-[var(--border-color)] overflow-hidden"
          role="progressbar"
          aria-label="Focus minutes today"
          aria-valuenow={todayMinutes}
          aria-valuemin={0}
          aria-valuemax={data.focusGoal}
        >
          <div className="h-full bg-gradient-to-r from-[var(--accent-solid)] to-[var(--accent-text)]" style={{ width: `${goalFraction * 100}%` }} />
        </div>
        <ol className="flex justify-between" aria-label="Last 7 days">
          {data.week.map((w) => {
            const d = new Date(w.date);
            const isToday = d.getTime() === todayKey;
            const active = w.minutes > 0;
            return (
              <li key={w.date} className="flex flex-col items-center gap-1.5">
                <span
                  className={`w-6 h-6 rounded-full border ${active ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)]' : 'border-[var(--border-strong)]'} ${
                    isToday ? 'ring-2 ring-[var(--accent-text)] ring-offset-2 ring-offset-[var(--bg-surface)]' : ''
                  }`}
                  title={`${w.minutes} min`}
                />
                <span className="text-[11px] text-[var(--text-muted)]">
                  {d.toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' })}
                  <span className="sr-only"> {w.minutes} minutes</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {data.recent.length > 0 && (
        <section aria-label="Recent sources" className="flex flex-col">
          <div className="flex items-center justify-between min-h-11">
            <h2 className="text-sm font-semibold">Recent sources</h2>
            <Link href="/vault" className="min-h-11 min-w-11 justify-end flex items-center text-[13px] font-semibold text-[var(--accent-text)]">
              See all
            </Link>
          </div>
          <ul>
            {data.recent.map((s) => {
              const Icon = sourceIcon(s.sourceType);
              return (
                <li key={s.id}>
                  <Link href={`/lecture-materials/${s.id}`} className="flex items-center gap-3 min-h-12 hover:text-[var(--accent-text)]">
                    <Icon size={20} className="text-[var(--text-secondary)] shrink-0" aria-hidden />
                    <span className="flex-1 min-w-0 truncate text-sm">{s.name}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">{formatSmartTime(s.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
