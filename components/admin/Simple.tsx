'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { ErrorBox, Loading, PageTitle, card, field, naira, primaryBtn, useApi, when } from './ui';

export function Payments() {
  const { data, error } = useApi<{ payments: { id: string; reference: string; product: string; amountNgn: number; createdAt: string; email: string }[] }>('/api/admin/payments');
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const total = data.payments.reduce((n, p) => n + p.amountNgn, 0);
  return (
    <>
      <PageTitle title="Payments" hint={`The last ${data.payments.length} payments, ${naira(total)} in total. Paystack's fees are taken before the money reaches you.`} />
      <ul className="flex flex-col gap-2">
        {data.payments.map((p) => (
          <li key={p.id} className={`${card} !p-4 flex items-center gap-3`}>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold truncate">{p.email}</span>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {p.product} · {p.reference}
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className="font-bold tabular-nums">{naira(p.amountNgn)}</span>
              <span className="text-xs text-[var(--text-muted)]">{when(p.createdAt)}</span>
            </span>
          </li>
        ))}
        {data.payments.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">No payments yet.</li>}
      </ul>
    </>
  );
}

export function Audit() {
  const { data, error } = useApi<{ entries: { id: string; action: string; details: string; createdAt: string }[] }>('/api/admin/audit');
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle title="Activity log" hint="Everything the team has done here, newest first. It cannot be edited." />
      <ul className="flex flex-col gap-2">
        {data.entries.map((e) => (
          <li key={e.id} className={`${card} !p-4 flex flex-col gap-0.5`}>
            <span className="text-sm">{e.details}</span>
            <span className="text-xs text-[var(--text-muted)]">{when(e.createdAt)}</span>
          </li>
        ))}
        {data.entries.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">Nothing yet.</li>}
      </ul>
    </>
  );
}

type Switches = { off: { chat: boolean; generate: boolean; uploads: boolean; audio: boolean }; message: string };
const SWITCH_LABELS: { key: keyof Switches['off']; label: string; hint: string }[] = [
  { key: 'chat', label: 'Chat', hint: 'The console in every source' },
  { key: 'generate', label: 'Quizzes, cards, slides, study guides', hint: 'Everything the AI generates' },
  { key: 'uploads', label: 'Uploads', hint: 'Adding files and links' },
  { key: 'audio', label: 'Audio overviews', hint: 'Scripts and voices' },
];

export function KillSwitches() {
  const { data, error, reload } = useApi<Switches>('/api/admin/switches');
  const [draft, setDraft] = useState<Switches | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const current = draft ?? data;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/switches', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
      if (!res.ok) throw await readApiError(res, 'Could not save the switches.');
      setDraft(null);
      await reload();
      toast.success('Saved. It applies to everyone within seconds.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save the switches.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Kill switches" hint="Pause a feature for everyone if something goes wrong or costs run away. Students see a short, calm message." />
      <section className={`${card} flex flex-col gap-1`}>
        {SWITCH_LABELS.map((s) => (
          <label key={s.key} className="flex items-center gap-3 min-h-14 border-b last:border-b-0 border-[var(--border-color)]">
            <span className="flex-1 flex flex-col">
              <span className="text-[15px] font-semibold">{s.label}</span>
              <span className="text-xs text-[var(--text-secondary)]">{s.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={current.off[s.key]}
              onChange={(e) => setDraft({ ...current, off: { ...current.off, [s.key]: e.target.checked } })}
              className="w-6 h-6 accent-[var(--danger)]"
              aria-label={`Switch ${s.label} off`}
            />
            <span className={`w-12 text-xs font-bold ${current.off[s.key] ? 'text-[var(--danger)]' : 'text-[var(--accent-text)]'}`}>{current.off[s.key] ? 'OFF' : 'On'}</span>
          </label>
        ))}
      </section>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Message students see when something is off
        <input value={current.message} maxLength={200} onChange={(e) => setDraft({ ...current, message: e.target.value })} className={field} />
      </label>
      <button type="button" onClick={save} disabled={busy || !draft} className={primaryBtn}>
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Save
      </button>
    </>
  );
}
