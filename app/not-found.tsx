import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-5 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 text-center flex flex-col gap-3">
        <h1 className="text-2xl font-bold">We can&apos;t find that page</h1>
        <p className="text-[var(--text-secondary)]">The link may be old, or the page may have been removed.</p>
        <Link href="/dashboard" className="mt-2 h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center">
          Go Home
        </Link>
      </div>
    </main>
  );
}
