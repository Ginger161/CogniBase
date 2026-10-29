'use client';

import Link from 'next/link';
import { Check, MoreVertical } from 'lucide-react';
import { kindLabel, type IndexingState, type LibrarySource } from './types';

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  source: LibrarySource;
  selected: boolean;
  indexing?: IndexingState;
  onToggle: () => void;
  onMenu: () => void;
};

export default function SourceRow({ source, selected, indexing, onToggle, onMenu }: Props) {
  const searchable = source.indexed && !indexing;

  let status: string;
  let statusClass = 'text-[var(--text-muted)]';
  if (indexing) {
    status = indexing.percent > 0 ? `Indexing ${indexing.percent}%` : indexing.message;
    statusClass = 'text-[var(--accent-text)]';
  } else if (!source.indexed) {
    status = 'Not searchable yet · open menu to retry';
    statusClass = 'text-[var(--danger)]';
  } else {
    status = ['Indexed', formatSize(source.fileSize)].filter(Boolean).join(' · ');
  }

  return (
    <li className="flex items-center gap-1 min-h-[68px] border-b border-[var(--bg-surface-alt)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${source.name}`}
        aria-disabled={!searchable}
        disabled={!searchable}
        onClick={onToggle}
        className="w-11 h-11 flex items-center justify-center shrink-0 disabled:opacity-40"
      >
        <span
          className={`w-[22px] h-[22px] rounded-[7px] border-[1.5px] flex items-center justify-center ${
            selected ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)]' : 'border-[var(--text-muted)]'
          }`}
          aria-hidden
        >
          {selected && <Check size={14} strokeWidth={3.2} className="text-[var(--on-accent)]" />}
        </span>
      </button>

      <div
        className="w-10 h-10 rounded-[10px] bg-[var(--bg-surface-alt)] flex items-center justify-center shrink-0 font-mono text-[10px] text-[var(--accent-text)]"
        aria-hidden
      >
        {kindLabel(source)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1 pl-2.5 py-2">
        <Link
          href={`/lecture-materials/${source.id}`}
          className="text-[15px] font-semibold truncate hover:text-[var(--accent-text)]"
        >
          {source.name}
        </Link>
        <span className={`text-xs truncate ${statusClass}`}>{status}</span>
        {indexing && indexing.percent > 0 && (
          <div className="h-1 rounded bg-[var(--border-color)] overflow-hidden" role="progressbar" aria-valuenow={indexing.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--accent-solid)] transition-[width]" style={{ width: `${indexing.percent}%` }} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onMenu}
        aria-label={`More actions for ${source.name}`}
        aria-haspopup="dialog"
        className="w-11 h-11 flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <MoreVertical size={20} aria-hidden />
      </button>
    </li>
  );
}
