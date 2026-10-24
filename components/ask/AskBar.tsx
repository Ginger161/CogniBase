'use client';

import { ArrowUp } from 'lucide-react';
import { useAsk } from './AskProvider';

// The persistent entry point: sits above the tab bar on phones and at the foot of the page on desktop.
export default function AskBar() {
  const { open, sources } = useAsk();
  const label = sources.length > 0 ? `Ask about ${sources.length} selected` : 'Ask about your sources';

  return (
    <div className="shrink-0 px-4 pb-2 pt-1 md:pb-4 md:flex md:justify-center">
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="w-full md:max-w-xl h-12 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] flex items-center gap-2.5 pl-4 pr-1.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:border-[var(--accent-solid)] transition-colors"
      >
        <span className="font-mono text-[13px] text-[var(--accent-text)]" aria-hidden>&gt;_</span>
        <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-muted)]">{label}</span>
        <span className="w-9 h-9 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] flex items-center justify-center shrink-0" aria-hidden>
          <ArrowUp size={18} strokeWidth={2.4} />
        </span>
      </button>
    </div>
  );
}
