'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

type Section = { href: string; label: string };

/** Frame for every admin page: a side menu on desktop, a scrolling tab row on phones. Only permitted sections are listed. */
export default function AdminShell({ sections, email, role, children }: { sections: Section[]; email: string; role: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const link = (href: string) =>
    `min-h-11 px-3.5 rounded-xl flex items-center text-sm font-semibold whitespace-nowrap ${
      active(href) ? 'bg-[var(--accent-solid)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]'
    }`;

  return (
    <div className="min-h-dvh flex flex-col md:flex-row text-[var(--text-primary)]">
      <aside className="md:w-60 md:shrink-0 md:min-h-dvh border-b md:border-b-0 md:border-r border-[var(--border-color)] bg-[var(--bg-nav)] flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[var(--tag-bg)] flex items-center justify-center">
            <ShieldCheck size={18} className="text-[var(--accent-text)]" aria-hidden />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-tight">CogniBase Admin</span>
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              {role === 'OWNER' ? 'Owner' : 'Team'} · {email}
            </span>
          </span>
        </div>
        <nav aria-label="Admin sections" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible px-3 pb-3 pt-1">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} aria-current={active(s.href) ? 'page' : undefined} className={link(s.href)}>
              {s.label}
            </Link>
          ))}
          <Link href="/dashboard" className="min-h-11 px-3.5 rounded-xl flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] md:mt-4 whitespace-nowrap">
            Back to the app
          </Link>
        </nav>
      </aside>
      <main className="flex-1 min-w-0 px-5 py-6 md:py-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
