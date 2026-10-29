'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserError, friendlyError, readApiError } from '@/lib/client-errors';
import AssetViewer, { type StudioAsset } from './AssetViewer';

export type AssetKind = 'flashcards' | 'quiz' | 'mindmap' | 'slides';

const COPY: Record<AssetKind, string> = {
  flashcards: 'Writing flashcards…',
  quiz: 'Writing your quiz…',
  mindmap: 'Mapping concepts…',
  slides: 'Designing slides…',
};

type Props = {
  kind: AssetKind;
  workspaceId?: string;
  documentIds?: string[];
  onClose: () => void;
};

/** Generates the asset on the server (which also saves it to Studio), then opens it. */
export default function GenerateAsset({ kind, workspaceId, documentIds, onClose }: Props) {
  const [asset, setAsset] = useState<StudioAsset | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/studio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, workspaceId, documentIds }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw await readApiError(res, 'Could not generate this. Please try again.');
        const data = await res.json().catch(() => ({}));
        if (!data.asset) throw new UserError('Could not generate this. Please try again.');
        setAsset(data.asset);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        toast.error(friendlyError(e, 'Could not generate this. Please try again.'));
        onClose();
      });
    return () => controller.abort();
    // Generate once per mount; callers remount to regenerate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (asset) return <AssetViewer asset={asset} onClose={onClose} />;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Generating" className="fixed inset-0 z-[100] bg-[var(--bg-base)]/95 flex flex-col items-center justify-center gap-4">
      <Loader2 size={40} className="animate-spin text-[var(--accent-text)]" aria-hidden />
      <p className="text-lg font-semibold" role="status">
        {COPY[kind]}
      </p>
      <button type="button" onClick={onClose} className="min-h-11 px-4 text-sm text-[var(--text-secondary)] underline">
        Cancel
      </button>
    </div>,
    document.body
  );
}
