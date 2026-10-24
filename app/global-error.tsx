'use client';

import { useEffect } from 'react';
import './globals.css';

// Replaces the root layout when it fails, so it brings its own <html> and uses the default (charcoal) tokens.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root layout error:', error);
  }, [error]);

  return (
    <html lang="en" className="charcoal">
      <body className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
        <main className="min-h-dvh flex items-center justify-center p-5">
          <div role="alert" className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 text-center flex flex-col gap-3">
            <h1 className="text-2xl font-bold">CogniBase hit a problem</h1>
            <p className="text-[var(--text-secondary)]">Something went wrong while loading. Trying again usually fixes it.</p>
            {error.digest && <p className="font-mono text-xs text-[var(--text-muted)]">Reference: {error.digest}</p>}
            <button type="button" onClick={() => reset()} className="mt-2 h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
