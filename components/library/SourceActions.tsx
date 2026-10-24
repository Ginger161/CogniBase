'use client';

import Link from 'next/link';
import { BookOpen, GraduationCap, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import type { LibrarySource } from './types';

type Props = {
  source: LibrarySource | null;
  busy: boolean;
  onClose: () => void;
  onAsk: (s: LibrarySource) => void;
  onStudyGuide: (s: LibrarySource) => void;
  onReindex: (s: LibrarySource) => void;
  onDelete: (s: LibrarySource) => void;
};

const itemClass =
  'w-full min-h-12 px-3 rounded-xl flex items-center gap-3 text-[15px] font-medium text-left hover:bg-[var(--bg-surface-alt)]';

export default function SourceActions({ source, busy, onClose, onAsk, onStudyGuide, onReindex, onDelete }: Props) {
  return (
    <Sheet open={!!source} onClose={onClose} title={source?.name ?? 'Source'}>
      {source && (
        <div className="flex flex-col gap-1">
          {source.indexed && !busy && (
            <button type="button" className={itemClass} onClick={() => onAsk(source)}>
              <MessageSquare size={18} aria-hidden /> Ask about this source
            </button>
          )}
          <Link href={`/lecture-materials/${source.id}`} className={itemClass} onClick={onClose}>
            <BookOpen size={18} aria-hidden /> Open in reader
          </Link>
          <button type="button" className={itemClass} onClick={() => onStudyGuide(source)}>
            <GraduationCap size={18} aria-hidden /> Build a study guide
          </button>
          {!source.indexed && !busy && (
            <button type="button" className={itemClass} onClick={() => onReindex(source)}>
              <RefreshCw size={18} aria-hidden /> Retry indexing
            </button>
          )}
          <button type="button" className={`${itemClass} text-[var(--danger)]`} onClick={() => onDelete(source)}>
            <Trash2 size={18} aria-hidden /> Delete
          </button>
        </div>
      )}
    </Sheet>
  );
}
