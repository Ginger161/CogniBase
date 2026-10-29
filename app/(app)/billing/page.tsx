'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { PLANS, type PlanTier, type UsageKind } from '@/lib/plans';

type Line = { kind: UsageKind; label: string; used: number; limit: number; creditCost: number };
type Summary = {
  tier: PlanTier;
  planLabel: string;
  expiresAt: string | null;
  lapsed: boolean;
  credits: number;
  lines: Line[];
  paymentsOn: boolean;
  packs: { id: string; credits: number; priceNgn: number; blurb: string }[];
  plans: { tier: 'PRO' | 'X'; label: string; priceNgn: number }[];
};

const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl';
const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

function planPerks(tier: 'PRO' | 'X'): string[] {
  const p = PLANS[tier];
  return [
    `${p.included.chat} chat messages a month`,
    `${p.audio.voicedMinutesPerMonth} minutes of voiced audio, episodes up to ${p.audio.maxEpisodeMinutes} minutes`,
    `${p.included.generate} quizzes, card sets or slide decks and ${p.included.guide} study guides`,
    tier === 'X' ? 'Long sources become a multi-part audio series' : 'Save audio on your phone for offline listening',
  ];
}

function BillingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      if (!res.ok) throw await readApiError(res, 'Could not load your plan and credits.');
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load your plan and credits.'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the usage summary when the screen opens
    void load();
  }, [load]);

  // Coming back from Paystack: confirm the payment, apply it, then tidy the address bar.
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) throw await readApiError(res, 'Could not confirm that payment yet.');
        const done = await res.json();
        if (!cancelled) toast.success(`Payment received: ${done.label}.`);
      } catch (e) {
        if (!cancelled) toast(friendlyError(e, 'Could not confirm that payment yet.'), { duration: 8000 });
      } finally {
        if (!cancelled) {
          router.replace('/billing');
          void load();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, router, load]);

  const buy = async (product: string) => {
    setPaying(product);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product }) });
      if (!res.ok) throw await readApiError(res, 'Could not start the payment.');
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      toast.error(friendlyError(e, 'Could not start the payment.'));
      setPaying(null);
    }
  };

  const redeem = async () => {
    setRedeeming(true);
    try {
      const res = await fetch('/api/invites/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (!res.ok) throw await readApiError(res, 'Could not use that code.');
      toast.success((await res.json()).message);
      setCode('');
      void load();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not use that code.'));
    } finally {
      setRedeeming(false);
    }
  };

  const button = 'min-h-11 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50';

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-10 flex flex-col gap-4">
      <div className="flex items-center gap-1 -ml-2">
        <Link href="/settings" aria-label="Back to Settings" className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <h1 className="text-[28px] font-bold tracking-tight">Plan &amp; credits</h1>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
      {!data && !error && <div className="h-40 rounded-2xl bg-[var(--bg-surface)] animate-pulse" aria-busy="true" aria-label="Loading" />}

      {data && (
        <>
          {!data.paymentsOn && (
            <p className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4 text-sm text-[var(--text-secondary)]">
              Payments are not switched on yet, so buying is paused. You can see what each plan includes below.
            </p>
          )}

          <section className={`${card} p-5 flex items-center justify-between gap-4`} aria-label="Your plan and credits">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Your plan</span>
              <span className="text-2xl font-black">{data.planLabel}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {data.lapsed
                  ? `Your paid plan ended on ${new Date(data.expiresAt!).toLocaleDateString()}.`
                  : data.expiresAt
                    ? `Active until ${new Date(data.expiresAt).toLocaleDateString()}`
                    : data.tier === 'FREE'
                      ? 'Upgrade for more of everything'
                      : 'No end date'}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Credits</span>
              <span className="flex items-center gap-1.5 text-3xl font-black tabular-nums">
                <Coins size={22} className="text-[var(--accent-text)]" aria-hidden />
                {data.credits}
              </span>
            </div>
          </section>

          <section className={`${card} p-5 flex flex-col gap-4`} aria-label="Used this month">
            <h2 className="text-sm font-semibold">Used this month</h2>
            {data.lines.map((l) => {
              const fraction = l.limit > 0 ? Math.min(1, l.used / l.limit) : 1;
              return (
                <div key={l.kind} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="capitalize">{l.label}</span>
                    <span className="text-[var(--text-secondary)] tabular-nums">
                      <span className="text-[var(--text-primary)] font-semibold">{l.used}</span> / {l.limit}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-[var(--border-color)] overflow-hidden" role="progressbar" aria-label={l.label} aria-valuenow={l.used} aria-valuemin={0} aria-valuemax={Math.max(1, l.limit)}>
                    <div className={`h-full rounded ${fraction >= 1 ? 'bg-[var(--danger)]' : 'bg-[var(--accent-solid)]'}`} style={{ width: `${fraction * 100}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              When you pass a limit, credits cover the rest: {data.lines.map((l) => `${l.creditCost} per ${l.kind === 'audio_minute' ? 'voiced minute' : l.kind === 'chat' ? 'message' : 'item'}`).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. Allowances reset on the 1st.
            </p>
          </section>

          <form
            className={`${card} p-4 flex items-center gap-2`}
            aria-label="Redeem an invite code"
            onSubmit={(e) => {
              e.preventDefault();
              void redeem();
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Have an invite code?"
              aria-label="Invite code"
              autoCapitalize="characters"
              autoComplete="off"
              className="flex-1 min-w-0 h-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] px-3.5 text-[15px] uppercase outline-none focus:border-[var(--accent-solid)]"
            />
            <button type="submit" disabled={redeeming || !code.trim()} className={`${button} bg-[var(--accent-solid)] text-[var(--on-accent)] h-12`}>
              {redeeming && <Loader2 size={16} className="animate-spin" aria-hidden />} Use code
            </button>
          </form>

          <section className="flex flex-col gap-3" aria-label="Buy credits">
            <h2 className="text-sm font-semibold">Top up credits</h2>
            <ul className="flex flex-col gap-2">
              {data.packs.map((p) => (
                <li key={p.id} className={`${card} p-4 flex items-center gap-3`}>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{p.credits} credits</span>
                    <span className="text-xs text-[var(--text-secondary)]">{p.blurb}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(`credits:${p.id}`)}
                    disabled={!data.paymentsOn || paying !== null}
                    className={`${button} bg-[var(--accent-solid)] text-[var(--on-accent)] min-w-24`}
                  >
                    {paying === `credits:${p.id}` && <Loader2 size={16} className="animate-spin" aria-hidden />}
                    {naira(p.priceNgn)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-label="Plans">
            <h2 className="text-sm font-semibold">Plans</h2>
            {data.plans.map((p) => (
              <div key={p.tier} className={`${card} p-5 flex flex-col gap-3 ${data.tier === p.tier ? 'border-[var(--accent-solid)]' : ''}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black">{p.label}</span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)] font-bold">{naira(p.priceNgn)}</span> / month
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {planPerks(p.tier).map((perk) => (
                    <li key={perk} className="flex gap-2.5 text-sm text-[var(--text-secondary)]">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] shrink-0" aria-hidden />
                      {perk}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => buy(`plan:${p.tier}`)}
                  disabled={!data.paymentsOn || paying !== null}
                  className={`${button} ${data.tier === p.tier ? 'border border-[var(--border-strong)]' : 'bg-[var(--accent-solid)] text-[var(--on-accent)]'}`}
                >
                  {paying === `plan:${p.tier}` && <Loader2 size={16} className="animate-spin" aria-hidden />}
                  {data.tier === p.tier ? 'Add 30 more days' : `Choose ${p.label}`}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-5 pt-8 text-[var(--text-secondary)]">Loading…</div>}>
      <BillingInner />
    </Suspense>
  );
}
