'use client';

import { ErrorBox, Loading, PageTitle, Stat, card, naira, useApi } from './ui';

type Stats = {
  users: { total: number; new7: number; new30: number; active7: number; active30: number };
  paying: { count: number; mrr: number };
  revenue: { month: number; payments: number; lastMonth: number };
  creditsOutstanding: number;
  usage: Record<string, number>;
  voice: { usedChars: number; budgetChars: number };
  costs: { variable: number; fixed: number };
  net: number;
};

const USAGE_LABELS: Record<string, string> = {
  chat: 'Chat messages',
  generate: 'Quizzes, cards, slides',
  guide: 'Study guides',
  upload: 'Uploads',
  audio_script: 'Audio overviews',
  audio_minute: 'Voiced minutes',
};

// A typical Pro subscriber leaves about this much after their own AI and voice costs (see the monetization notes).
const PRO_MARGIN_NGN = 1800;

export default function Overview() {
  const { data, error } = useApi<Stats>('/api/admin/overview');
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const voicePct = Math.min(100, Math.round((data.voice.usedChars / Math.max(1, data.voice.budgetChars)) * 100));
  const breakEven = Math.ceil(data.costs.fixed / PRO_MARGIN_NGN);
  const growth = data.revenue.lastMonth > 0 ? Math.round(((data.revenue.month - data.revenue.lastMonth) / data.revenue.lastMonth) * 100) : null;

  return (
    <>
      <PageTitle title="Overview" hint="This month so far. Costs marked estimated come from average prices, not measured bills." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users" value={String(data.users.total)} sub={`${data.users.new7} new this week`} />
        <Stat label="Active, 7 days" value={String(data.users.active7)} sub={`${data.users.active30} in 30 days`} />
        <Stat label="Paying now" value={String(data.paying.count)} sub={`${naira(data.paying.mrr)} a month`} />
        <Stat label="Credits held" value={data.creditsOutstanding.toLocaleString()} sub="owed to users" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Revenue" value={naira(data.revenue.month)} sub={growth === null ? `${data.revenue.payments} payments` : `${growth >= 0 ? '+' : ''}${growth}% vs last month`} />
        <Stat label="AI and voice (est.)" value={naira(data.costs.variable)} />
        <Stat label="Running costs" value={naira(data.costs.fixed)} sub="monthly, from Funds" />
        <Stat label="Net this month" value={naira(data.net)} tone={data.net >= 0 ? 'good' : 'bad'} sub={data.net >= 0 ? 'ahead' : 'behind'} />
      </div>

      <section className={`${card} flex flex-col gap-3`} aria-label="Voice budget">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Voice budget</h2>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            {data.voice.usedChars.toLocaleString()} / {data.voice.budgetChars.toLocaleString()} characters
          </span>
        </div>
        <div className="h-2.5 rounded bg-[var(--border-color)] overflow-hidden" role="progressbar" aria-label="Voice budget used" aria-valuenow={voicePct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded ${voicePct >= 80 ? 'bg-[var(--danger)]' : 'bg-[var(--accent-solid)]'}`} style={{ width: `${voicePct}%` }} />
        </div>
        <p className="text-xs text-[var(--text-muted)]">When this fills up, voices pause for everyone until the 1st and students get their transcript. About 900 characters is one minute of audio.</p>
      </section>

      <section className={`${card} flex flex-col gap-2`} aria-label="Break-even">
        <h2 className="text-sm font-semibold">Covering your running costs</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Your running costs are <span className="text-[var(--text-primary)] font-semibold">{naira(data.costs.fixed)}</span> a month. At about {naira(PRO_MARGIN_NGN)} left from each Pro subscriber after AI and voice costs, you need roughly{' '}
          <span className="text-[var(--text-primary)] font-semibold">{breakEven} paying users</span> to break even. You have {data.paying.count}.
        </p>
      </section>

      <section className={card} aria-label="Usage this month">
        <h2 className="text-sm font-semibold mb-2">Usage this month</h2>
        <ul className="flex flex-col">
          {Object.keys(USAGE_LABELS).map((k) => (
            <li key={k} className="flex justify-between items-center min-h-10 border-t border-[var(--border-color)] text-sm">
              <span className="text-[var(--text-secondary)]">{USAGE_LABELS[k]}</span>
              <span className="font-semibold tabular-nums">{(data.usage[k] ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
