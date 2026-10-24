"use client";

import React, { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { friendlyError, readApiError } from '@/lib/client-errors';

type Day = { date: string; minutes: number; tasks: number };
type Metrics = { focusGoal: number; taskGoal: number; today: Day; week: Day[]; streak: number };

const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl';

const dayLabel = (iso: string, style: 'narrow' | 'short' | 'long') =>
  new Date(iso).toLocaleDateString(undefined, { weekday: style, timeZone: 'UTC' });

function Meter({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const fraction = Math.min(1, value / Math.max(1, goal));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[13px] text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)] font-semibold">{value}</span> / {goal} {unit}
        </span>
      </div>
      <div
        className="h-2.5 rounded bg-[var(--border-color)] overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={goal}
      >
        <div className="h-full rounded bg-gradient-to-r from-[var(--accent-solid)] to-[var(--accent-text)]" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

function WeekChart({ week }: { week: Day[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(60, ...week.map((d) => d.minutes));
  const total = week.reduce((sum, d) => sum + d.minutes, 0);
  const active = picked ?? week.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Focus minutes, last 7 days</h2>
          <p className="text-[13px] text-[var(--text-secondary)]" aria-live="polite">
            <span className="text-[var(--text-primary)] font-semibold">{week[active].minutes} min</span> on {dayLabel(week[active].date, 'long')} · {total} min this week
          </p>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable} className="min-h-11 px-2 text-[13px] font-semibold text-[var(--accent-text)]">
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Focus minutes and tasks per day</caption>
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th className="py-2 font-semibold">Day</th>
              <th className="py-2 font-semibold">Minutes</th>
              <th className="py-2 font-semibold">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {week.map((d) => (
              <tr key={d.date} className="border-t border-[var(--border-color)]">
                <td className="py-2.5">{dayLabel(d.date, 'long')}</td>
                <td className="py-2.5">{d.minutes}</td>
                <td className="py-2.5">{d.tasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="flex items-stretch justify-between gap-2 h-44" aria-label="Focus minutes per day">
          {week.map((d, i) => {
            const height = d.minutes > 0 ? Math.max(4, (d.minutes / max) * 100) : 0;
            const isActive = i === active;
            return (
              <li key={d.date} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setPicked(i)}
                  onMouseEnter={() => setPicked(i)}
                  onFocus={() => setPicked(i)}
                  aria-label={`${dayLabel(d.date, 'long')}: ${d.minutes} minutes`}
                  className="flex-1 w-full max-w-11 flex items-end justify-center rounded-md outline-offset-2"
                >
                  <span
                    className={`w-full max-w-[22px] rounded-t-[4px] ${isActive ? 'bg-[var(--accent-text)]' : 'bg-[var(--accent-solid)]'} ${d.minutes === 0 ? 'bg-transparent border-t-2 border-[var(--border-strong)]' : ''}`}
                    style={{ height: d.minutes === 0 ? 2 : `${height}%` }}
                  />
                </button>
                <span className={`text-[11px] ${isActive ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'}`}>{dayLabel(d.date, 'narrow')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function StudyAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/metrics')
      .then(async (res) => {
        if (!res.ok) throw await readApiError(res, 'Could not load your progress.');
        return res.json();
      })
      .then((d: Metrics) => !cancelled && setMetrics(d))
      .catch((e: unknown) => !cancelled && setError(friendlyError(e, 'Could not load your progress.')));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-8 flex flex-col gap-4">
      <h1 className="text-[28px] font-bold tracking-tight">Progress</h1>

      {error ? (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : !metrics ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading progress">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className={`${card} p-5 flex items-center justify-between`}>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Streak</span>
              <span className="text-[13px] text-[var(--text-secondary)]">
                {metrics.streak > 0 ? 'Days in a row with study activity' : 'Study today to start a streak'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={26} className="text-[var(--accent-text)]" aria-hidden />
              <span className="text-4xl font-black tabular-nums">{metrics.streak}</span>
            </div>
          </div>

          <div className={`${card} p-5 flex flex-col gap-5`}>
            <Meter label="Focus today" value={metrics.today.minutes} goal={metrics.focusGoal} unit="min" />
            <Meter label="Tasks today" value={metrics.today.tasks} goal={metrics.taskGoal} unit="tasks" />
          </div>

          <div className={`${card} p-5`}>
            <WeekChart week={metrics.week} />
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed px-1">
            Focus minutes are credited for what you do: reading, reviewing cards, finishing study phases and asking questions. They are an estimate, not a stopwatch. You can change your daily goal in Settings.
          </p>
        </>
      )}
    </div>
  );
}
