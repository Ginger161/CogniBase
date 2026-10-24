'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BookOpen, Layers, BarChart3, type LucideIcon } from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

// Four destinations. Settings lives under the avatar; Ask is a bar, not a page.
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/vault', label: 'Library', icon: BookOpen },
  { href: '/study-guides', label: 'Study', icon: Layers },
  { href: '/analytics', label: 'Progress', icon: BarChart3 },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + '/');
}

export function SideNav({ userName }: { userName: string }) {
  const isActive = useIsActive();
  const [taps, setTaps] = useState<{ n: number; at: number }>({ n: 0, at: 0 });
  const [showManifesto, setShowManifesto] = useState(false);

  // Five quick taps on the avatar open the architect's note.
  const onAvatarTap = () => {
    const now = Date.now();
    const n = now - taps.at < 2000 ? taps.n + 1 : 1;
    if (n >= 5) {
      setShowManifesto(true);
      setTaps({ n: 0, at: now });
    } else {
      setTaps({ n, at: now });
    }
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden md:flex flex-col w-60 shrink-0 bg-[var(--bg-nav)] border-r border-[var(--border-color)] px-4 py-6 gap-1"
      >
        <span className="px-3 pb-5 text-xl font-bold tracking-tight">
          Cogni<span className="text-[var(--accent-text)]">Base</span>
        </span>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`h-11 px-3 rounded-xl flex items-center gap-3 text-[15px] transition-colors ${
                active
                  ? 'bg-[var(--tag-bg)] text-[var(--tag-text)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] font-medium'
              }`}
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden />
              {label}
            </Link>
          );
        })}
        <div className="flex-1" />
        <div className="border-t border-[var(--border-color)] pt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onAvatarTap}
            aria-label="Profile"
            className="w-10 h-10 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs font-semibold shrink-0 select-none"
          >
            {initials(userName)}
          </button>
          <Link
            href="/settings"
            aria-current={isActive('/settings') ? 'page' : undefined}
            className={`h-11 px-2 flex-1 min-w-0 flex items-center text-sm truncate ${
              isActive('/settings')
                ? 'text-[var(--accent-text)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {userName} · Settings
          </Link>
        </div>
      </nav>
      <Manifesto open={showManifesto} onClose={() => setShowManifesto(false)} />
    </>
  );
}

export function TabBar() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Primary"
      className="md:hidden shrink-0 flex bg-[var(--bg-nav)] border-t border-[var(--border-color)] px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] ${
              active ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--text-muted)] font-medium'
            }`}
          >
            <Icon size={22} strokeWidth={1.9} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Compact top bar for phones: wordmark and the avatar that leads to Settings.
export function MobileHeader({ userName }: { userName: string }) {
  const isActive = useIsActive();
  const onSettings = isActive('/settings');
  return (
    <header className="md:hidden shrink-0 flex items-center justify-between px-5 h-14">
      <span className="text-lg font-bold tracking-tight">
        Cogni<span className="text-[var(--accent-text)]">Base</span>
      </span>
      <Link
        href="/settings"
        aria-label="Account and settings"
        aria-current={onSettings ? 'page' : undefined}
        className={`w-11 h-11 rounded-full bg-[var(--bg-surface-alt)] border flex items-center justify-center text-sm font-semibold ${
          onSettings ? 'border-[var(--accent-solid)] text-[var(--accent-text)]' : 'border-[var(--border-color)]'
        }`}
      >
        {initials(userName)}
      </Link>
    </header>
  );
}

function Manifesto({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <motion.div
            role="dialog"
            aria-label="A note from the architect"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--bg-base)] border border-[var(--border-color)] shadow-2xl rounded-2xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6 tracking-tight">A Note from the Architect</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              For the past year, I relied on a combination of Gemini Pro and Notebook LM to synthesize my academic work for quick exam prep and deep study while simultaneously running multiple businesses. I am not a first-class student, but that combination bought my time back. It allowed me to focus on multiple tasks at once without academic burnout.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
              I built CogniBase to handle that entire workflow smoothly, all in one place. Every detail here, every interaction, was built with deep consideration for how different minds actually learn.
            </p>
            <hr className="border-[var(--border-color)] my-6" />
            <p className="text-lg font-semibold text-[var(--accent-text)]">Ginger-Eke Chienyegom</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Veritas University | Educational Management</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
