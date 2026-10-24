import React from 'react';
import Link from 'next/link';

export const authInput =
  'w-full h-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] px-4 text-[15px] outline-none focus:border-[var(--accent-solid)] placeholder:text-[var(--text-muted)]';
export const authPrimary =
  'w-full h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold disabled:opacity-60 flex items-center justify-center';
export const authSecondary =
  'w-full h-12 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center justify-center gap-2 hover:border-[var(--accent-solid)] disabled:opacity-60';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <Link href="/" className="self-center text-2xl font-bold tracking-tight">
          Cogni<span className="text-[var(--accent-text)]">Base</span>
        </Link>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
      {message}
    </div>
  );
}

export function AuthField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]" aria-hidden>
      <span className="flex-1 h-px bg-[var(--border-color)]" />
      or
      <span className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}
