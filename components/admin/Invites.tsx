'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { ErrorBox, Loading, PageTitle, card, field, ghostBtn, primaryBtn, useApi } from './ui';

type Invite = { id: string; code: string; note: string | null; credits: number; planTier: string | null; planDays: number | null; maxUses: number; uses: number; expiresAt: string | null; active: boolean };

/** Codes that give testers credits or a plan. Hand them out in a group chat, on a flyer, or one to one. */
export default function Invites() {
  const { data, error, reload } = useApi<{ invites: Invite[] }>('/api/admin/invites');
  const [form, setForm] = useState({ code: '', note: '', credits: '100', planTier: '', planDays: '30', maxUses: '1', expiresOn: '' });
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, credits: Number(form.credits || 0), maxUses: Number(form.maxUses || 1), planDays: Number(form.planDays || 30), planTier: form.planTier || undefined, expiresOn: form.expiresOn || undefined }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not create that code.');
      setForm({ ...form, code: '', note: '' });
      await reload();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create that code.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (i: Invite) => {
    try {
      const res = await fetch('/api/admin/invites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id, active: !i.active }) });
      if (!res.ok) throw await readApiError(res, 'Could not change that code.');
      await reload();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not change that code.'));
    }
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => toast.success('Code copied.')).catch(() => toast(`Code: ${code}`));
  };

  return (
    <>
      <PageTitle title="Invite codes" hint="Give testers credits or a free plan. Students enter a code under Settings > Plan & credits." />

      <section className={`${card} flex flex-col gap-3`} aria-label="Create a code">
        <h2 className="text-sm font-semibold">New code</h2>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Leave blank for a random code, or type one like FOUNDING50" maxLength={24} className={field} aria-label="Code" />
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note for yourself (who or what it is for)" maxLength={120} className={field} aria-label="Note" />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            Credits it gives
            <input type="number" inputMode="numeric" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            How many people can use it
            <input type="number" inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            Also gives a plan
            <select value={form.planTier} onChange={(e) => setForm({ ...form, planTier: e.target.value })} className={field}>
              <option value="">No plan</option>
              <option value="PRO">Pro</option>
              <option value="X">X</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            Plan lasts (days)
            <input type="number" inputMode="numeric" value={form.planDays} onChange={(e) => setForm({ ...form, planDays: e.target.value })} disabled={!form.planTier} className={`${field} disabled:opacity-50`} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          Stops working on (optional)
          <input type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} className={field} />
        </label>
        <button type="button" onClick={create} disabled={busy} className={primaryBtn}>
          Create code
        </button>
      </section>

      <ul className="flex flex-col gap-2">
        {data.invites.map((i) => (
          <li key={i.id} className={`${card} !p-4 flex items-center gap-3 ${i.active ? '' : 'opacity-60'}`}>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-mono text-[15px] font-bold tracking-wide">{i.code}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {[i.credits > 0 ? `${i.credits} credits` : '', i.planTier ? `${i.planTier} for ${i.planDays} days` : ''].filter(Boolean).join(' + ')} · used {i.uses} of {i.maxUses}
                {i.expiresAt ? ` · ends ${new Date(i.expiresAt).toLocaleDateString()}` : ''}
              </span>
              {i.note && <span className="text-xs text-[var(--text-muted)] truncate">{i.note}</span>}
            </span>
            <button type="button" onClick={() => copy(i.code)} aria-label={`Copy ${i.code}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <Copy size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => toggle(i)} className={ghostBtn}>
              {i.active ? 'Turn off' : 'Turn on'}
            </button>
          </li>
        ))}
        {data.invites.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">No codes yet.</li>}
      </ul>
    </>
  );
}
