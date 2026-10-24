import { prisma } from '@/lib/prisma';
import Link from 'next/link';

type Card = { question?: string; answer?: string };
type Phase = { phaseId?: string; title?: string; microBites?: unknown; flashcards?: unknown };

export default async function SharedGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guide = await prisma.studyGuide.findFirst({
    where: { id, isPublic: true },
    select: { title: true, strategyData: true },
  });

  if (!guide) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-3 px-5 text-center bg-[var(--bg-base)] text-[var(--text-primary)]">
        <h1 className="text-2xl font-bold">This guide isn&apos;t available</h1>
        <p className="text-[var(--text-secondary)]">It may have been unshared, or the link is incorrect.</p>
        <Link href="/" className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center">
          Go to CogniBase
        </Link>
      </main>
    );
  }

  const data = guide.strategyData as { guideTitle?: string; phases?: Phase[] } | null;
  const phases = Array.isArray(data?.phases) ? data!.phases! : [];

  return (
    <main className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="bg-[var(--accent-solid)] text-[var(--on-accent)] text-sm font-medium px-4 py-3 text-center">
        You&apos;re reading a study guide made with CogniBase.{' '}
        <Link href="/signup" className="underline font-bold">
          Sign up free to make your own and unlock the interactive version
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{data?.guideTitle || guide.title || 'Study guide'}</h1>
          <p className="text-[var(--text-muted)]">Shared from CogniBase</p>
        </header>

        {phases.length === 0 ? (
          <p className="text-[var(--text-secondary)]">This guide couldn&apos;t be displayed.</p>
        ) : (
          phases.map((phase, i) => {
            const bites = Array.isArray(phase.microBites) ? (phase.microBites as string[]) : [];
            const cards = Array.isArray(phase.flashcards) ? (phase.flashcards as Card[]) : [];
            return (
              <section key={phase.phaseId || i} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col gap-4">
                <h2 className="text-xl font-bold">{phase.title}</h2>
                {bites.map((bite, b) => (
                  <p key={b} className="text-[var(--text-secondary)] leading-relaxed">
                    {bite}
                  </p>
                ))}
                {cards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Knowledge check</h3>
                    {cards.map((card, c) => (
                      <div key={c} className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-2">
                        <p className="font-medium">{card.question}</p>
                        <Link href="/signup" className="min-h-11 flex items-center text-sm font-semibold text-[var(--accent-text)]">
                          Sign up free to reveal the answer
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}

        <Link href="/signup" className="self-center h-12 px-8 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center">
          Get the full experience, free
        </Link>
      </div>
    </main>
  );
}
