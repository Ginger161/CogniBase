"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, GraduationCap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StudyEngine } from '@/components/StudyEngine';
import StudioAssetsPanel from '@/components/StudioAssetsPanel';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { formatSmartTime } from '@/lib/utils/time';
import { friendlyError, readApiError } from '@/lib/client-errors';

type Guide = {
  id: string;
  title: string | null;
  sectionConstraint: string | null;
  sourceDocumentName: string | null;
  strategyData: { guideTitle?: string } | null;
  isPublic: boolean;
  createdAt: string;
  completedPhases: number;
  totalPhases: number;
};

const guideTitle = (g: Guide) => g.strategyData?.guideTitle || g.title || g.sourceDocumentName || 'Study guide';

function StudyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get('open');
  const tab = params.get('tab') === 'assets' ? 'assets' : 'guides';

  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/study-guides');
      if (!res.ok) throw await readApiError(res, 'Could not load your study guides.');
      const data = await res.json();
      setGuides(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(friendlyError(e, 'Could not load your study guides.'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/study-guides')
      .then(async (res) => {
        if (!res.ok) throw await readApiError(res, 'Could not load your study guides.');
        return res.json();
      })
      .then((data) => !cancelled && setGuides(Array.isArray(data) ? data : []))
      .catch((e: unknown) => !cancelled && setError(friendlyError(e, 'Could not load your study guides.')));
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/study-guides/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw await readApiError(res, 'Could not delete this guide.');
      setGuides((prev) => prev?.filter((g) => g.id !== deleteTarget.id) ?? prev);
      toast.success('Study guide deleted.');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete this guide.'));
    } finally {
      setDeleting(false);
    }
  };

  const open = openId ? guides?.find((g) => g.id === openId) : null;

  if (open) {
    return (
      <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-8">
        {open.strategyData ? (
          <StudyEngine
            key={open.id}
            guideData={open.strategyData}
            guideId={open.id}
            initialPublic={open.isPublic}
            onClose={() => {
              router.push('/study-guides');
              load();
            }}
          />
        ) : (
          <p className="text-[var(--text-secondary)]">This guide was made with an older engine. Build a new one from Library.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-8 flex flex-col gap-4">
      <h1 className="text-[28px] font-bold tracking-tight">Study</h1>

      <div role="tablist" aria-label="Study sections" className="flex gap-1 p-1 rounded-xl bg-[var(--bg-surface-alt)]">
        {([
          ['guides', 'Guides'],
          ['assets', 'Flashcards, maps & slides'],
        ] as const).map(([id, label]) => (
          <Link
            key={id}
            role="tab"
            aria-selected={tab === id}
            href={id === 'guides' ? '/study-guides' : '/study-guides?tab=assets'}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold flex items-center justify-center text-center px-2 ${
              tab === id ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === 'assets' ? (
        <StudioAssetsPanel />
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 flex items-center gap-3">
          <p className="flex-1 text-sm text-[var(--danger)]">{error}</p>
          <button type="button" onClick={load} className="min-h-11 px-3 text-sm font-semibold underline">
            Retry
          </button>
        </div>
      ) : guides === null ? (
        <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading study guides">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />
          ))}
        </ul>
      ) : guides.length === 0 ? (
        <div className="mt-4 rounded-3xl border-2 border-dashed border-[var(--border-strong)] px-6 py-12 flex flex-col items-center gap-4 text-center">
          <GraduationCap size={32} className="text-[var(--accent-text)]" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">No study guides yet</p>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs">Pick a source in Library and choose Build a study guide from its menu.</p>
          </div>
          <Link href="/vault" className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center">
            Go to Library
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {guides.map((g) => {
            const pct = g.totalPhases > 0 ? (g.completedPhases / g.totalPhases) * 100 : 0;
            return (
              <li key={g.id} className="relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent-solid)]/60">
                <Link href={`/study-guides?open=${encodeURIComponent(g.id)}`} className="flex flex-col gap-3 p-4 pr-14">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[16px] font-semibold leading-snug">{guideTitle(g)}</span>
                    <span className="text-xs text-[var(--text-muted)] truncate">
                      {g.sourceDocumentName} · {formatSmartTime(g.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-1 h-1.5 rounded bg-[var(--border-color)] overflow-hidden"
                      role="progressbar"
                      aria-label={`${guideTitle(g)} progress`}
                      aria-valuenow={g.completedPhases}
                      aria-valuemin={0}
                      aria-valuemax={g.totalPhases}
                    >
                      <div className="h-full bg-[var(--accent-solid)]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {g.completedPhases} of {g.totalPhases}
                    </span>
                    <ChevronRight size={16} className="text-[var(--text-muted)]" aria-hidden />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(g)}
                  aria-label={`Delete ${guideTitle(g)}`}
                  className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this study guide?"
        message="Your progress on it is deleted too. The source in Library is not affected."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function StudyGuidesPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-5 pt-8 text-[var(--text-secondary)]">Loading…</div>}>
      <StudyInner />
    </Suspense>
  );
}
