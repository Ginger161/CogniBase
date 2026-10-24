'use client';

import { useRef, useState } from 'react';
import { Link2, Loader2, StickyNote, UploadCloud } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import { ACCEPTED_EXTENSIONS } from './types';

type Tab = 'upload' | 'link' | 'paste';

const TABS: { id: Tab; label: string; icon: typeof UploadCloud }[] = [
  { id: 'upload', label: 'Upload', icon: UploadCloud },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'paste', label: 'Paste', icon: StickyNote },
];

type Props = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onFiles: (files: File[], category: 'Note' | 'Assignment') => Promise<void>;
  onLink: (url: string) => Promise<void>;
  onText: (title: string, text: string) => Promise<void>;
};

export default function AddSourceSheet({ open, onClose, busy, onFiles, onLink, onText }: Props) {
  const [tab, setTab] = useState<Tab>('upload');
  const [category, setCategory] = useState<'Note' | 'Assignment'>('Note');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    onClose();
    await onFiles(files, category);
  };

  const submitLink = async () => {
    try {
      await onLink(url.trim());
      setUrl('');
      onClose();
    } catch {
      /* the hook already showed the error; keep the sheet open so the link can be fixed */
    }
  };

  const submitText = async () => {
    try {
      await onText(title.trim(), text.trim());
      setTitle('');
      setText('');
      onClose();
    } catch {
      /* error already shown */
    }
  };

  const inputClass =
    'w-full rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent-solid)] placeholder:text-[var(--text-muted)]';

  return (
    <Sheet open={open} onClose={onClose} title="Add a source">
      <div role="tablist" aria-label="Source type" className="flex gap-1 p-1 mb-4 rounded-xl bg-[var(--bg-surface-alt)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
              tab === id ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(Array.from(e.dataTransfer.files));
            }}
            className={`rounded-2xl border-2 border-dashed px-4 py-8 flex flex-col items-center gap-3 text-center ${
              dragging ? 'border-[var(--accent-solid)] bg-[var(--tag-bg)]' : 'border-[var(--border-strong)]'
            }`}
          >
            <UploadCloud size={28} className="text-[var(--accent-text)]" aria-hidden />
            <p className="text-sm text-[var(--text-secondary)]">Drop files here, or</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-11 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold text-sm"
            >
              Choose files
            </button>
            <p className="text-xs text-[var(--text-muted)]">PDF, Word, PowerPoint, text or images · up to 25MB each</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept={ACCEPTED_EXTENSIONS.map((e) => '.' + e).join(',')}
              onChange={(e) => {
                handleFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
          <div role="radiogroup" aria-label="Category" className="flex gap-2">
            {(['Note', 'Assignment'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`h-11 px-4 rounded-full text-sm font-semibold border ${
                  category === c
                    ? 'bg-[var(--tag-bg)] border-[var(--accent-solid)] text-[var(--tag-text)]'
                    : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'link' && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitLink();
          }}
        >
          <label className="text-sm text-[var(--text-secondary)]" htmlFor="source-url">
            A YouTube video with captions, or a web page
          </label>
          <input
            id="source-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Add link
          </button>
        </form>
      )}

      {tab === 'paste' && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
        >
          <label className="text-sm text-[var(--text-secondary)]" htmlFor="paste-title">
            Title
          </label>
          <input id="paste-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3 notes" className={inputClass} />
          <label className="text-sm text-[var(--text-secondary)]" htmlFor="paste-text">
            Text
          </label>
          <textarea
            id="paste-text"
            required
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your notes here"
            className={`${inputClass} resize-none`}
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Save notes
          </button>
        </form>
      )}
    </Sheet>
  );
}
