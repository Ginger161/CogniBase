"use client";

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-5 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div role="alert" className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 text-center flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-[var(--text-secondary)]">This page hit an unexpected error. Trying again usually fixes it.</p>
        {error.digest && <p className="font-mono text-xs text-[var(--text-muted)]">Reference: {error.digest}</p>}
        <button type="button" onClick={() => reset()} className="mt-2 h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
          Try again
        </button>
      </div>
    </main>
  );
}
