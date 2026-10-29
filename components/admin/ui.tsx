'use client';

import { useCallback, useEffect, useState } from 'react';
import { friendlyError, readApiError } from '@/lib/client-errors';

export const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5';
export const field = 'h-12 w-full rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] px-3.5 text-[15px] outline-none focus:border-[var(--accent-solid)]';
export const primaryBtn = 'h-12 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2 disabled:opacity-50';
export const ghostBtn = 'min-h-11 px-4 rounded-xl border border-[var(--border-strong)] text-sm font-semibold hover:border-[var(--accent-solid)] disabled:opacity-50';

export const naira = (n: number) => `${n < 0 ? '-' : ''}₦${Math.abs(Math.round(n)).toLocaleString('en-NG')}`;
export const when = (iso: string | Date) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Loads a JSON endpoint and exposes a way to reload it. Errors become short messages. */
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw await readApiError(res, 'Could not load this.');
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load this.'));
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the data when the screen opens
    void reload();
  }, [reload]);

  return { data, error, reload };
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
      {message}
    </div>
  );
}

export function Loading() {
  return <div className="h-32 rounded-2xl bg-[var(--bg-surface)] animate-pulse" aria-busy="true" aria-label="Loading" />;
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
      {hint && <p className="text-sm text-[var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`${card} flex flex-col gap-1`}>
      <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">{label}</span>
      <span className={`text-2xl font-black tabular-nums ${tone === 'bad' ? 'text-[var(--danger)]' : tone === 'good' ? 'text-[var(--accent-text)]' : ''}`}>{value}</span>
      {sub && <span className="text-xs text-[var(--text-secondary)]">{sub}</span>}
    </div>
  );
}
