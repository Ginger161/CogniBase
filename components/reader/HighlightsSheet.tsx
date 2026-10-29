'use client';

import React from 'react';
import { Highlighter, Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';

export type Highlight = { id: string; quote: string; note: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  highlights: Highlight[];
  onJump: (quote: string) => void;
  onDelete: (id: string) => void;
};

/** Everything the reader has highlighted in this source, in the order it was saved. */
export default function HighlightsSheet({ open, onClose, highlights, onJump, onDelete }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Highlights">
      {highlights.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <Highlighter size={28} className="text-[var(--accent-text)]" aria-hidden />
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Select text while you read and choose Highlight. Your highlights are kept here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pt-1">
          {highlights.map((h) => (
            <li key={h.id} className="flex items-stretch rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
              <button
                type="button"
                onClick={() => {
                  onJump(h.quote);
                  onClose();
                }}
                className="flex-1 min-w-0 min-h-14 px-4 py-3 text-left"
              >
                <span className="block text-[15px] leading-snug line-clamp-3">{h.quote}</span>
                {h.note && <span className="block mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{h.note}</span>}
              </button>
              <button
                type="button"
                onClick={() => onDelete(h.id)}
                aria-label="Remove this highlight"
                className="w-12 shrink-0 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
