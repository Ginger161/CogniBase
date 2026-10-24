'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned below the scrolling body (primary actions). */
  footer?: React.ReactNode;
};

// Bottom sheet on phones, centred dialog on larger screens. Rendered in a portal so it is never clipped.
export default function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full md:max-w-lg max-h-[88dvh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl md:rounded-3xl shadow-2xl outline-none"
      >
        <div className="shrink-0 flex items-center justify-between pl-5 pr-2 pt-3 pb-1">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-[var(--border-color)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
