'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { ErrorBox, Loading, PageTitle, Stat, card, field, ghostBtn, naira, primaryBtn, useApi } from './ui';

type Expense = { id: string; label: string; category: string; amountNgn: number; incurredOn: string; recurring: string | null; note: string | null };
type Funds = { expenses: Expense[]; monthlyBurn: number; spentAllTime: number; categories: string[] };

// What it typically takes to launch, at about 1,400 naira to the dollar. One tap fills the form; adjust and save.
const LAUNCH_ITEMS = [
  { label: 'Vercel Pro (hosting, allows commercial use)', category: 'Hosting', amountNgn: 28_000, recurring: 'monthly' },
  { label: 'Supabase Pro (database and storage)', category: 'Database', amountNgn: 35_000, recurring: 'monthly' },
  { label: 'Domain name (.com)', category: 'Domain', amountNgn: 21_000, recurring: 'yearly' },
  { label: 'ElevenLabs voices (testing)', category: 'Voice', amountNgn: 7_000, recurring: 'monthly' },
  { label: 'Gemini API (AI)', category: 'AI', amountNgn: 20_000, recurring: 'monthly' },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function Funds({ canEdit }: { canEdit: boolean }) {
  const { data, error, reload } = useApi<Funds>('/api/admin/funds');
  const [form, setForm] = useState({ label: '', category: 'Hosting', amountNgn: '', date: today(), recurring: '' });
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amountNgn: Number(form.amountNgn), recurring: form.recurring || undefined }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not save that expense.');
      setForm({ label: '', category: 'Hosting', amountNgn: '', date: today(), recurring: '' });
      await reload();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save that expense.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/funds?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw await readApiError(res, 'Could not remove that expense.');
      await reload();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove that expense.'));
    }
  };

  return (
    <>
      <PageTitle title="Funds & runway" hint="What it costs to run CogniBase. Enter your real bills here and the overview works out break-even." />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Running cost" value={naira(data.monthlyBurn)} sub="per month" />
        <Stat label="Three months" value={naira(data.monthlyBurn * 3)} sub="a sensible amount to have set aside" />
      </div>

      {canEdit && (
        <>
          <section className={`${card} flex flex-col gap-3`} aria-label="Typical launch costs">
            <h2 className="text-sm font-semibold">Typical launch costs</h2>
            <p className="text-xs text-[var(--text-muted)]">Rough naira prices. Tap one to fill the form, then correct the amount to what you actually paid.</p>
            <div className="flex flex-wrap gap-2">
              {LAUNCH_ITEMS.map((i) => (
                <button key={i.label} type="button" className={ghostBtn} onClick={() => setForm({ label: i.label, category: i.category, amountNgn: String(i.amountNgn), date: today(), recurring: i.recurring })}>
                  {i.label.split(' (')[0]} · {naira(i.amountNgn)}
                </button>
              ))}
            </div>
          </section>

          <section className={`${card} flex flex-col gap-3`} aria-label="Add an expense">
            <h2 className="text-sm font-semibold">Add an expense</h2>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="What was it?" maxLength={80} className={field} aria-label="Expense name" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field} aria-label="Category">
                {data.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input type="number" inputMode="numeric" value={form.amountNgn} onChange={(e) => setForm({ ...form, amountNgn: e.target.value })} placeholder="Amount in ₦" className={field} aria-label="Amount in naira" />
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} aria-label="Date" />
              <select value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value })} className={field} aria-label="How often">
                <option value="">One-off</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
            <button type="button" onClick={save} disabled={busy || !form.label.trim() || !form.amountNgn} className={primaryBtn}>
              Save expense
            </button>
          </section>
        </>
      )}

      <ul className="flex flex-col gap-2" aria-label="Expenses">
        {data.expenses.map((e) => (
          <li key={e.id} className={`${card} !p-4 flex items-center gap-3`}>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold truncate">{e.label}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {e.category} · {e.recurring ? `every ${e.recurring === 'monthly' ? 'month' : 'year'}` : 'one-off'} · {new Date(e.incurredOn).toLocaleDateString()}
              </span>
            </span>
            <span className="font-bold tabular-nums">{naira(e.amountNgn)}</span>
            {canEdit && (
              <button type="button" onClick={() => remove(e.id)} aria-label={`Remove ${e.label}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]">
                <Trash2 size={18} aria-hidden />
              </button>
            )}
          </li>
        ))}
        {data.expenses.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">No expenses yet.</li>}
      </ul>
    </>
  );
}
