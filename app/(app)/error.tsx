'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Uncaught app error:", error);
  }, [error]);

  return (
    <div role="alert" className="min-h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-[var(--text-secondary)] max-w-sm">This screen hit an unexpected error. Try again, or head back Home.</p>
      {error.digest && <p className="font-mono text-xs text-[var(--text-muted)]">Reference: {error.digest}</p>}
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={() => reset()} className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
          Try again
        </button>
        <Link href="/dashboard" className="h-12 px-6 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center">
          Home
        </Link>
      </div>
    </div>
  );
}
