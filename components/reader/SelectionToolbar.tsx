'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Highlighter, Layers, MessageCircleQuestion, Sparkles } from 'lucide-react';

export type SelectionAction = 'highlight' | 'explain' | 'quiz' | 'card';

type Props = {
  /** Selections only count when they start inside this element. */
  containerRef: React.RefObject<HTMLElement | null>;
  onAction: (action: SelectionAction, text: string) => void;
};

type Picked = { text: string; top: number; left: number };

const ACTIONS: { id: SelectionAction; label: string; icon: typeof Highlighter }[] = [
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'explain', label: 'Explain', icon: Sparkles },
  { id: 'quiz', label: 'Quiz me', icon: MessageCircleQuestion },
  { id: 'card', label: 'Card', icon: Layers },
];

/** Floating actions that appear under text the reader selects. */
export default function SelectionToolbar({ containerRef, onAction }: Props) {
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    const read = () => {
      const sel = window.getSelection();
      const root = containerRef.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) return setPicked(null);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setPicked(null);
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 3) return setPicked(null);
      const rect = range.getBoundingClientRect();
      // Below the selection, centred, and kept on screen. Phones draw their own menu above it.
      const half = 150;
      const left = Math.min(window.innerWidth - half - 8, Math.max(half + 8, rect.left + rect.width / 2));
      setPicked({ text, top: rect.bottom + 10, left });
    };
    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [containerRef]);

  if (!picked || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Actions for the selected text"
      // Keeps the selection alive while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: picked.top, left: picked.left }}
      className="fixed z-40 -translate-x-1/2 flex items-center gap-0.5 p-1 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      {ACTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onAction(id, picked.text);
            window.getSelection()?.removeAllRanges();
            setPicked(null);
          }}
          className="min-h-11 min-w-11 px-2.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
        >
          <Icon size={17} aria-hidden />
          <span className="text-[10.5px] font-semibold leading-none">{label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
