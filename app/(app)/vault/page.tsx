'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Plus, Search, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useAsk } from '@/components/ask/AskProvider';
import { useLibrary } from '@/components/library/useLibrary';
import SourceRow from '@/components/library/SourceRow';
import SourceActions from '@/components/library/SourceActions';
import AddSourceSheet from '@/components/library/AddSourceSheet';
import StudyGuideSheet from '@/components/library/StudyGuideSheet';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import type { LibrarySource, SourceType } from '@/components/library/types';

const FILTERS: { id: 'all' | SourceType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'file', label: 'Files' },
  { id: 'youtube', label: 'Videos' },
  { id: 'website', label: 'Web' },
  { id: 'text', label: 'Notes' },
];

export default function LibraryPage() {
  const library = useLibrary();
  const ask = useAsk();
  const { sources, isLoading, loadError, indexing, uploadStatus } = library;

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<LibrarySource | null>(null);
  const [guideFor, setGuideFor] = useState<LibrarySource | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Forget selections for sources that no longer exist (deleted elsewhere, or left over from an earlier session).
  const { sources: selectedSources, setSources: setSelectedSources } = ask;
  useEffect(() => {
    if (isLoading || loadError) return;
    const alive = new Set(sources.map((s) => s.id));
    const kept = selectedSources.filter((s) => alive.has(s.id));
    if (kept.length !== selectedSources.length) setSelectedSources(kept);
  }, [isLoading, loadError, sources, selectedSources, setSelectedSources]);

  const selectedIds = useMemo(() => new Set(selectedSources.map((s) => s.id)), [selectedSources]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => (filter === 'all' || s.sourceType === filter) && (!q || s.name.toLowerCase().includes(q)));
  }, [sources, filter, query]);

  const selectable = visible.filter((s) => s.indexed && !indexing[s.id]);
  const allSelected = selectable.length > 0 && selectable.every((s) => selectedIds.has(s.id));

  const toAskSource = (s: LibrarySource) => ({ id: s.id, name: s.name, workspaceId: s.workspaceId });

  const toggleAll = () => {
    if (allSelected) {
      const visibleIds = new Set(selectable.map((s) => s.id));
      setSelectedSources(selectedSources.filter((s) => !visibleIds.has(s.id)));
    } else {
      const have = new Set(selectedSources.map((s) => s.id));
      setSelectedSources([...selectedSources, ...selectable.filter((s) => !have.has(s.id)).map(toAskSource)]);
    }
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    setDeleting(true);
    const deleted = await library.remove(deleteIds);
    setSelectedSources(selectedSources.filter((s) => !deleted.includes(s.id)));
    setDeleting(false);
    setDeleteIds(null);
  };

  const askAbout = (s: LibrarySource) => {
    setSelectedSources([toAskSource(s)]);
    setMenuFor(null);
    ask.open();
  };

  const busy = !!uploadStatus;

  return (
    <div
      className="min-h-full w-full max-w-3xl mx-auto px-5 pt-2 md:pt-8 pb-6 flex flex-col gap-4 relative"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        library.addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {dragging && (
        <div className="absolute inset-2 z-10 rounded-3xl border-2 border-dashed border-[var(--accent-solid)] bg-[var(--bg-base)]/90 flex items-center justify-center pointer-events-none">
          <p className="text-lg font-semibold text-[var(--accent-text)]">Drop to add to your library</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 min-h-11">
        <h1 className="text-[28px] font-bold tracking-tight">Library</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="h-11 min-w-11 px-3 justify-center rounded-full border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2"
          >
            <CalendarDays size={16} aria-hidden />
            <span className="hidden sm:inline">Schedule</span>
            <span className="sm:hidden sr-only">Schedule</span>
          </Link>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-11 pl-3 pr-4 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] text-sm font-bold flex items-center gap-1.5"
          >
            <Plus size={18} strokeWidth={2.6} aria-hidden /> Add
          </button>
        </div>
      </div>

      <label className="h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center gap-2.5 px-3.5 focus-within:border-[var(--accent-solid)]">
        <Search size={18} className="text-[var(--text-muted)] shrink-0" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your sources"
          aria-label="Search your sources"
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[var(--text-muted)]"
        />
      </label>

      <div role="radiogroup" aria-label="Filter by type" className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-11 px-4 rounded-full text-[13px] font-semibold border whitespace-nowrap shrink-0 ${
              filter === f.id
                ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-[var(--on-accent)]'
                : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {busy && (
        <div role="status" className="flex items-center gap-2 text-sm text-[var(--accent-text)]">
          <Loader2 size={16} className="animate-spin" aria-hidden /> {uploadStatus}
        </div>
      )}

      {isLoading ? (
        <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your library">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-14 rounded-xl bg-[var(--bg-surface)] animate-pulse" />
          ))}
        </ul>
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 flex items-center gap-3">
          <p className="flex-1 text-sm text-[var(--danger)]">{loadError}</p>
          <button type="button" onClick={library.refresh} className="min-h-11 px-3 text-sm font-semibold underline">
            Retry
          </button>
        </div>
      ) : sources.length === 0 ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-[var(--border-strong)] px-6 py-12 flex flex-col items-center gap-4 text-center">
          <UploadCloud size={32} className="text-[var(--accent-text)]" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Add your first source</p>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs">
              Upload lecture notes, a PDF, a YouTube link or paste text. Then ask questions and build study guides from it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold"
          >
            Add a source
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between min-h-11">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">
              {visible.length} source{visible.length === 1 ? '' : 's'}
              {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
            </span>
            <div className="flex items-center">
              {selectable.length > 0 && (
                <button type="button" onClick={toggleAll} className="min-h-11 px-2 text-sm font-semibold text-[var(--accent-text)]">
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteIds([...selectedIds])}
                  className="min-h-11 px-2 text-sm font-semibold text-[var(--danger)]"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nothing matches that search.</p>
          ) : (
            <ul>
              {visible.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  selected={selectedIds.has(s.id)}
                  indexing={indexing[s.id]}
                  onToggle={() => ask.toggleSource(toAskSource(s))}
                  onMenu={() => setMenuFor(s)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <AddSourceSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        busy={busy}
        onFiles={library.addFiles}
        onLink={library.addLink}
        onText={library.addText}
      />

      <SourceActions
        source={menuFor}
        busy={menuFor ? !!indexing[menuFor.id] : false}
        onClose={() => setMenuFor(null)}
        onAsk={askAbout}
        onStudyGuide={(s) => {
          setMenuFor(null);
          setGuideFor(s);
        }}
        onReindex={(s) => {
          setMenuFor(null);
          library.indexSource(s);
        }}
        onDelete={(s) => {
          setMenuFor(null);
          setDeleteIds([s.id]);
        }}
      />

      <StudyGuideSheet source={guideFor} onClose={() => setGuideFor(null)} />

      <ConfirmSheet
        open={!!deleteIds}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} sources?` : 'Delete this source?'}
        message="It will be removed from your library, its search index and any chats scoped to it. Study guides already built from it stay."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteIds(null)}
      />
    </div>
  );
}
