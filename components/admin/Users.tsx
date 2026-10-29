'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { ErrorBox, PageTitle, card, field, ghostBtn, primaryBtn, useApi } from './ui';

type Row = { id: string; email: string; username: string | null; planTier: string; planExpiresAt: string | null; suspendedAt: string | null; credits: number };
type Detail = {
  user: { id: string; email: string; username: string | null; suspendedAt: string | null };
  planLabel: string;
  expiresAt: string | null;
  credits: number;
  lines: { kind: string; label: string; used: number; limit: number }[];
};

/** Find a user, see their account, and (with permission) give credits, set a plan, or pause the account. */
export default function Users({ canEdit }: { canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error } = useApi<{ users: Row[] }>(`/api/admin/users?q=${encodeURIComponent(applied)}`);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [credits, setCredits] = useState('');
  const [plan, setPlan] = useState('');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async (email: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/grant?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw await readApiError(res, 'Could not open that user.');
      setDetail(await res.json());
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open that user.'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (extra: Record<string, unknown> = {}) => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: detail.user.email,
          credits: credits === '' ? undefined : Number(credits),
          plan: plan || undefined,
          planDays: plan && plan !== 'FREE' ? (days === '' ? null : Number(days)) : undefined,
          note,
          ...extra,
        }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not apply that.');
      toast.success('Done.');
      setCredits('');
      setPlan('');
      setNote('');
      await open(detail.user.email);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not apply that.'));
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Users" hint="Account details only. Chats and study material are never shown here." />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(query.trim());
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by email or name" className={field} aria-label="Search users" />
        <button type="submit" className={`${primaryBtn} shrink-0`}>
          Search
        </button>
      </form>

      {error && <ErrorBox message={error} />}

      <ul className="flex flex-col gap-2">
        {data?.users.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => open(u.email)} className={`${card} w-full !p-4 flex items-center gap-3 text-left hover:border-[var(--accent-solid)]`}>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold truncate">{u.username || u.email}</span>
                <span className="text-xs text-[var(--text-secondary)] truncate">{u.email}</span>
              </span>
              {u.suspendedAt && <span className="text-xs font-bold text-[var(--danger)]">Paused</span>}
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--tag-bg)] text-[var(--tag-text)]">{u.planTier}</span>
              <span className="text-sm tabular-nums text-[var(--text-secondary)] w-14 text-right">{u.credits} cr</span>
            </button>
          </li>
        ))}
        {data && data.users.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">No users match that.</li>}
      </ul>

      {detail && (
        <section className={`${card} flex flex-col gap-4`} aria-label="Selected user">
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold">{detail.user.username || detail.user.email}</span>
            <span className="text-sm text-[var(--text-secondary)]">{detail.user.email}</span>
            {detail.user.suspendedAt && <span className="text-sm font-bold text-[var(--danger)]">Account paused</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="block text-xs uppercase tracking-wider text-[var(--text-muted)]">Plan</span>
              <span className="font-bold">{detail.planLabel}</span>
              {detail.expiresAt && <span className="block text-xs text-[var(--text-secondary)]">until {new Date(detail.expiresAt).toLocaleDateString()}</span>}
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-[var(--text-muted)]">Credits</span>
              <span className="font-bold tabular-nums">{detail.credits}</span>
            </div>
          </div>
          <ul className="flex flex-col text-sm">
            {detail.lines.map((l) => (
              <li key={l.kind} className="flex justify-between min-h-9 items-center border-t border-[var(--border-color)] text-[var(--text-secondary)]">
                <span className="capitalize">{l.label}</span>
                <span className="tabular-nums">
                  {l.used} / {l.limit}
                </span>
              </li>
            ))}
          </ul>

          {canEdit && (
            <div className="flex flex-col gap-3 pt-2 border-t border-[var(--border-color)]">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Credits to add (negative takes some back)
                <input type="number" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 200" className={field} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Set plan
                  <select value={plan} onChange={(e) => setPlan(e.target.value)} className={field}>
                    <option value="">No change</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                    <option value="X">X</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  For how many days
                  <input type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="empty = no end" disabled={!plan || plan === 'FREE'} className={`${field} disabled:opacity-50`} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Note (kept in the record)
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Beta tester, exam-season gift…" maxLength={200} className={field} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => apply()} disabled={busy || (credits === '' && !plan)} className={primaryBtn}>
                  {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Apply
                </button>
                <button type="button" onClick={() => apply({ suspend: !detail.user.suspendedAt, credits: undefined, plan: undefined })} disabled={busy} className={ghostBtn}>
                  {detail.user.suspendedAt ? 'Restore account' : 'Pause account'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
