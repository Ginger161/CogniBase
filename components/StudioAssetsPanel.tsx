"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Layers, Network, Presentation, Trash2, Sparkles, type LucideIcon } from 'lucide-react';
import AssetViewer, { type StudioAsset } from '@/components/studio/AssetViewer';
import ConfirmSheet from '@/components/ui/ConfirmSheet';

const META: Record<string, { label: string; icon: LucideIcon }> = {
  FLASHCARD: { label: 'Flashcards', icon: Layers },
  MINDMAP: { label: 'Mind map', icon: Network },
  PRESENTATION: { label: 'Slides', icon: Presentation },
};

/** Everything generated from Ask or Library: flashcard sets, mind maps and slide decks. */
export default function StudioAssetsPanel() {
  const [assets, setAssets] = useState<StudioAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<StudioAsset | null>(null);
  const [deleting, setDeleting] = useState<StudioAsset | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/studio/assets')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not load your items.');
        return res.json();
      })
      .then((d) => !cancelled && setAssets(Array.isArray(d.assets) ? d.assets : []))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch('/api/studio/assets?id=' + encodeURIComponent(deleting.id), { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not delete this item.');
      setAssets((prev) => prev?.filter((a) => a.id !== deleting.id) ?? prev);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete this item.');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
        {error}
      </div>
    );
  }

  if (assets === null) {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-[72px] rounded-2xl bg-[var(--bg-surface)] animate-pulse" />
        ))}
      </ul>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="mt-4 rounded-3xl border-2 border-dashed border-[var(--border-strong)] px-6 py-12 flex flex-col items-center gap-4 text-center">
        <Sparkles size={32} className="text-[var(--accent-text)]" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Nothing here yet</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Ask about a source, then choose Flashcards, Mind map or Slides under the answer. They are saved here.
          </p>
        </div>
        <Link href="/vault" className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center">
          Go to Library
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {assets.map((a) => {
          const meta = META[a.type] ?? { label: a.type, icon: Layers };
          const Icon = meta.icon;
          return (
            <li key={a.id} className="relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent-solid)]/60">
              <button type="button" onClick={() => setViewing(a)} className="w-full flex items-center gap-3.5 p-4 pr-14 text-left min-h-[72px]">
                <span className="w-11 h-11 rounded-xl bg-[var(--tag-bg)] flex items-center justify-center shrink-0">
                  <Icon size={22} className="text-[var(--accent-text)]" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[15px] font-semibold truncate">{a.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {meta.label} · {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeleting(a)}
                aria-label={`Delete ${a.title}`}
                className="absolute top-1/2 -translate-y-1/2 right-1 w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {viewing && <AssetViewer asset={viewing} onClose={() => setViewing(null)} />}

      <ConfirmSheet
        open={!!deleting}
        title="Delete this item?"
        message="It is removed from Study. The sources it came from are not affected."
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
