'use client';

import Sheet from './Sheet';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmSheet({ open, title, message, confirmLabel, destructive, busy, onConfirm, onCancel }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl border border-[var(--border-strong)] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-12 rounded-xl font-bold disabled:opacity-60 ${
              destructive ? 'bg-[var(--danger)] text-[#1A0505]' : 'bg-[var(--accent-solid)] text-[var(--on-accent)]'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">{message}</p>
    </Sheet>
  );
}
