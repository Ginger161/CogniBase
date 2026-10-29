"use client";

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { AlignJustify, BookOpen, ChevronLeft, ChevronRight, Download, Headphones, Highlighter, Wand2 } from 'lucide-react';
import { useAsk } from '@/components/ask/AskProvider';
import { formatForReading } from '@/lib/reader/format';
import { clearMarks, findBlock, markQuote, normaliseForMatch, passageProbes, scrollParent } from '@/lib/reader/dom';
import { friendlyError, readApiError } from '@/lib/client-errors';
import SelectionToolbar, { type SelectionAction } from '@/components/reader/SelectionToolbar';
import HighlightsSheet, { type Highlight } from '@/components/reader/HighlightsSheet';
import AudioSheet from '@/components/reader/AudioSheet';

type ReaderDocument = { id: string; name: string; url: string; sourceType: string; textContent: string | null; workspaceId: string };

const WORDS_PER_PAGE = 250;
const proseClass = 'reader-prose prose max-w-none';

function paginate(text: string): string[] {
  const pages: string[] = [];
  let current: string[] = [];
  let words = 0;
  // Split on paragraphs so markdown structures (lists, bold, links) are never cut in half.
  for (const p of text.split(/\n\n+/)) {
    const count = p.split(/\s+/).length;
    if (words + count > WORDS_PER_PAGE && current.length > 0) {
      // A heading is never left stranded at the foot of a page: it travels with what follows it.
      if (/^#{1,6}\s/.test(current[current.length - 1]) && current.length > 1) {
        const heading = current.pop()!;
        pages.push(current.join('\n\n'));
        current = [heading, p];
        words = heading.split(/\s+/).length + count;
        continue;
      }
      pages.push(current.join('\n\n'));
      current = [p];
      words = count;
    } else {
      current.push(p);
      words += count;
    }
  }
  if (current.length > 0) pages.push(current.join('\n\n'));
  return pages;
}

// Memoised so the rendered text is never re-reconciled while highlights are being wrapped into it.
const Markdown = memo(function Markdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
});

export default function DocumentReader({
  document,
  pdfUrl,
  openConsole = false,
  openAudio = false,
  initialProgress = 0,
}: {
  document: ReaderDocument;
  pdfUrl: string | null;
  openConsole?: boolean;
  openAudio?: boolean;
  initialProgress?: number;
}) {
  const { attach, detach, open, askWith, setPassageHandler } = useAsk();
  const [formatted, setFormatted] = useState(true);
  const [mode, setMode] = useState<'scroll' | 'pages'>('scroll');
  const [modeReady, setModeReady] = useState(false);
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState(initialProgress);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(openAudio);
  const contentRef = useRef<HTMLElement>(null);
  const pendingProbes = useRef<string[] | null>(null);
  const savedProgress = useRef(initialProgress);

  const pages = useMemo(() => {
    if (!document.textContent) return [];
    return paginate(formatted ? formatForReading(document.textContent) : document.textContent);
  }, [document.textContent, formatted]);
  const normalisedPages = useMemo(() => pages.map(normaliseForMatch), [pages]);

  // The console belongs to this source: attach on entry, drop its conversation on exit.
  const { id: docId, name: docName, workspaceId } = document;
  useEffect(() => {
    attach({ id: docId, name: docName, workspaceId });
    if (openConsole) open();
    return detach;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, docName, workspaceId]);

  useEffect(() => {
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'read_document' }) }).catch(() => {});
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved mode after mount
      if (localStorage.getItem('zen_reading_mode') === 'pages') setMode('pages');
    } catch {
      /* storage unavailable */
    }
    setModeReady(true);
  }, []);

  // Saved highlights. A failure here must never stop the text from showing.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/highlights?documentId=${encodeURIComponent(docId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => !cancelled && Array.isArray(d?.highlights) && setHighlights(d.highlights))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (mode !== 'pages') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage((p) => Math.min(pages.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, pages.length]);

  const chooseMode = (m: 'scroll' | 'pages') => {
    setMode(m);
    try {
      localStorage.setItem('zen_reading_mode', m);
    } catch {
      /* storage unavailable */
    }
  };

  // ── Reading progress: pick up where the reader left off, and keep their place saved.
  const saveProgress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remember = useCallback(
    (value: number) => {
      setProgress(value);
      if (Math.abs(value - savedProgress.current) < 0.02 && value < 0.99) return;
      if (saveProgress.current) clearTimeout(saveProgress.current);
      saveProgress.current = setTimeout(() => {
        savedProgress.current = value;
        fetch('/api/reading-progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId, progress: value }),
          keepalive: true,
        }).catch(() => {});
      }, 1500);
    },
    [docId]
  );

  const restored = useRef(false);
  useEffect(() => {
    if (!modeReady || restored.current || pages.length === 0 || pdfUrl) return;
    restored.current = true;
    if (initialProgress <= 0.02 || initialProgress >= 0.99) return;
    if (mode === 'pages') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resume the saved page once the mode is known
      setPage(Math.min(pages.length - 1, Math.max(0, Math.round(initialProgress * pages.length) - 1)));
    } else {
      requestAnimationFrame(() => {
        const sc = scrollParent(contentRef.current);
        if (sc) sc.scrollTop = initialProgress * (sc.scrollHeight - sc.clientHeight);
      });
    }
  }, [modeReady, mode, pages.length, pdfUrl, initialProgress]);

  useEffect(() => {
    if (mode !== 'pages' || pages.length === 0 || !restored.current) return;
    remember((page + 1) / pages.length);
  }, [page, mode, pages.length, remember]);

  useEffect(() => {
    if (mode !== 'scroll' || pdfUrl || pages.length === 0) return;
    const sc = scrollParent(contentRef.current);
    if (!sc) return;
    const onScroll = () => {
      if (!restored.current) return;
      const range = sc.scrollHeight - sc.clientHeight;
      if (range > 0) remember(Math.min(1, sc.scrollTop / range));
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [mode, pdfUrl, pages.length, remember]);

  // ── Highlights drawn into the text. Cleared and redrawn whenever the text or the list changes.
  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    clearMarks(root);
    for (const h of highlights) markQuote(root, h.quote, h.id);
  }, [highlights, page, mode, formatted, pages]);

  const onSelection = async (action: SelectionAction, text: string) => {
    if (action === 'explain') return askWith(`Explain this passage from the source in simple terms, then give one example:\n\n"${text}"`);
    if (action === 'quiz') return askWith(`Quiz me on this passage. Ask me one question at a time and wait for my answer:\n\n"${text}"`);
    try {
      if (action === 'highlight') {
        const res = await fetch('/api/highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: docId, quote: text }) });
        if (!res.ok) throw await readApiError(res, 'Could not save that highlight.');
        const { highlight } = await res.json();
        setHighlights((h) => [...h, highlight]);
      } else {
        const res = await fetch('/api/flashcards/from-selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: docId, quote: text }) });
        if (!res.ok) throw await readApiError(res, 'Could not save that card.');
        toast.success('Card saved. Find it under Study, in your flashcards.');
      }
    } catch (e) {
      toast.error(friendlyError(e, 'Could not do that. Please try again.'));
    }
  };

  const removeHighlight = async (id: string) => {
    const before = highlights;
    setHighlights((h) => h.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/highlights?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw await readApiError(res, 'Could not remove that highlight.');
    } catch (e) {
      setHighlights(before);
      toast.error(friendlyError(e, 'Could not remove that highlight.'));
    }
  };

  // ── Jump to a passage: a citation in the console, or a saved highlight, scrolls here and flashes.
  const flash = useCallback((probes: string[], pageIndex: number) => {
    const root = contentRef.current;
    if (!root) return;
    const scope = mode === 'scroll' ? root.querySelector<HTMLElement>(`[data-page="${pageIndex}"]`) ?? root : root;
    const target = findBlock(scope, probes) ?? scope;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.add('reader-flash');
    setTimeout(() => target.classList.remove('reader-flash'), 2600);
  }, [mode]);

  const jumpToPassage = useCallback(
    (passage: string) => {
      if (pdfUrl) {
        toast('This source is shown as a PDF, so I cannot scroll it to that spot. Open the original and search for it.');
        return;
      }
      const probes = passageProbes(passage);
      let best = -1;
      let bestHits = 0;
      normalisedPages.forEach((text, i) => {
        const hits = probes.filter((p) => text.includes(p)).length;
        if (hits > bestHits) {
          best = i;
          bestHits = hits;
        }
      });
      if (best < 0) {
        toast('I could not find that passage in the text. It may have been reworded when the source was read.');
        return;
      }
      if (mode === 'pages') {
        pendingProbes.current = probes;
        setPage(best);
        // Same page: nothing re-renders, so flash right away.
        if (best === page) requestAnimationFrame(() => flash(probes, best));
      } else {
        flash(probes, best);
      }
    },
    [pdfUrl, normalisedPages, mode, page, flash]
  );

  useEffect(() => {
    setPassageHandler(jumpToPassage);
    return () => setPassageHandler(null);
  }, [jumpToPassage, setPassageHandler]);

  useEffect(() => {
    if (mode === 'pages' && pendingProbes.current) {
      const probes = pendingProbes.current;
      pendingProbes.current = null;
      requestAnimationFrame(() => flash(probes, page));
    }
  }, [page, mode, flash]);

  const toggle = (active: boolean) =>
    `w-11 h-11 rounded-full flex items-center justify-center ${active ? 'bg-[var(--accent-solid)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;
  const readable = !pdfUrl && pages.length > 0;

  return (
    <div className="min-h-full flex flex-col">
      <div className="shrink-0 sticky top-0 z-20 bg-[var(--bg-base)]/95 backdrop-blur border-b border-[var(--border-color)]">
        <div className="px-3 min-h-14 flex items-center gap-1.5">
          <Link href="/vault" aria-label="Back to Library" className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ChevronLeft size={22} aria-hidden />
          </Link>
          <h1 className="flex-1 min-w-0 truncate text-[15px] font-semibold">{document.name}</h1>
          {readable && (
            <div role="group" aria-label="Reading mode" className="flex items-center gap-1 p-0.5 rounded-full bg-[var(--bg-surface-alt)]">
              <button type="button" onClick={() => chooseMode('scroll')} aria-pressed={mode === 'scroll'} aria-label="Scroll" className={toggle(mode === 'scroll')}>
                <AlignJustify size={18} aria-hidden />
              </button>
              <button type="button" onClick={() => chooseMode('pages')} aria-pressed={mode === 'pages'} aria-label="Pages" className={toggle(mode === 'pages')}>
                <BookOpen size={18} aria-hidden />
              </button>
            </div>
          )}
          {readable && (
            <button
              type="button"
              onClick={() => setFormatted((f) => !f)}
              aria-pressed={formatted}
              aria-label={formatted ? 'Showing formatted text. Switch to original' : 'Showing original text. Switch to formatted'}
              title={formatted ? 'Formatted for reading' : 'Original text'}
              className={toggle(formatted)}
            >
              <Wand2 size={18} aria-hidden />
            </button>
          )}
          {readable && (
            <button
              type="button"
              onClick={() => setHighlightsOpen(true)}
              aria-label={`Highlights, ${highlights.length} saved`}
              className="relative w-11 h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Highlighter size={18} aria-hidden />
              {highlights.length > 0 && (
                <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] text-[10px] font-bold flex items-center justify-center">
                  {highlights.length}
                </span>
              )}
            </button>
          )}
        </div>
        {readable && (
          <div className="h-0.5 bg-[var(--border-color)]" role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--accent-solid)] transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      {pdfUrl ? (
        <div className="flex-1 flex flex-col min-h-[75dvh]">
          <iframe src={`${pdfUrl}#toolbar=0&navpanes=0`} title={document.name} className="flex-1 w-full border-0 bg-[var(--bg-surface)]" />
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-center my-4 h-11 px-5 rounded-full border border-[var(--border-strong)] text-sm font-semibold flex items-center gap-2 hover:border-[var(--accent-solid)]"
          >
            <Download size={16} aria-hidden /> Open original
          </a>
        </div>
      ) : pages.length === 0 ? (
        <p className="m-auto px-5 py-20 text-center text-[var(--text-secondary)]">No readable text was extracted from this source.</p>
      ) : mode === 'scroll' ? (
        <article ref={contentRef} className="w-full max-w-2xl mx-auto px-5 py-8 pb-28 flex flex-col gap-10">
          {pages.map((text, i) => (
            <section key={`${formatted}-${i}`} data-page={i} aria-label={`Page ${i + 1}`}>
              <div className={proseClass}>
                <Markdown text={text} />
              </div>
            </section>
          ))}
        </article>
      ) : (
        <div className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 pb-28 flex flex-col gap-4">
          <article ref={contentRef} className="flex-1 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 overflow-y-auto">
            <div key={`${formatted}-${page}`} className={proseClass}>
              <Markdown text={pages[page]} />
            </div>
          </article>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="w-12 h-12 rounded-full border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-40"
            >
              <ChevronLeft size={22} aria-hidden />
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              Page {page + 1} of {pages.length}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
              disabled={page === pages.length - 1}
              aria-label="Next page"
              className="w-12 h-12 rounded-full border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-40"
            >
              <ChevronRight size={22} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {readable && <SelectionToolbar containerRef={contentRef} onAction={onSelection} />}

      <div className="sticky bottom-0 z-20 h-0 pointer-events-none">
        <div className="absolute bottom-4 right-4 md:right-6 flex items-center gap-2 pointer-events-auto">
          {document.textContent && (
            <button
              type="button"
              onClick={() => setAudioOpen(true)}
              aria-label="Audio overview"
              className="w-12 h-12 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] text-[var(--accent-text)] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
            >
              <Headphones size={20} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={open}
            aria-haspopup="dialog"
            aria-label="Open console"
            className="h-12 px-5 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] font-mono text-sm font-bold flex items-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
          >
            <span aria-hidden>&gt;_</span> console
          </button>
        </div>
      </div>

      <HighlightsSheet open={highlightsOpen} onClose={() => setHighlightsOpen(false)} highlights={highlights} onJump={jumpToPassage} onDelete={removeHighlight} />
      <AudioSheet open={audioOpen} onClose={() => setAudioOpen(false)} documentId={docId} documentName={docName} />
    </div>
  );
}
