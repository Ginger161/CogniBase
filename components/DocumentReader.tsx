"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { AlignJustify, BookOpen, ChevronLeft, ChevronRight, Download, MessageSquare } from 'lucide-react';
import { useAsk } from '@/components/ask/AskProvider';

type ReaderDocument = { id: string; name: string; url: string; sourceType: string; textContent: string | null; workspaceId: string };

const WORDS_PER_PAGE = 250;
const proseClass = 'reader-prose prose max-w-none prose-p:leading-relaxed prose-headings:tracking-tight';

function paginate(text: string): string[] {
  const pages: string[] = [];
  let current: string[] = [];
  let words = 0;
  // Split on paragraphs so markdown structures (lists, bold, links) are never cut in half.
  for (const p of text.split(/\n\n+/)) {
    const count = p.split(/\s+/).length;
    if (words + count > WORDS_PER_PAGE && current.length > 0) {
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

export default function DocumentReader({ document, pdfUrl }: { document: ReaderDocument; pdfUrl: string | null }) {
  const ask = useAsk();
  const [mode, setMode] = useState<'scroll' | 'pages'>('scroll');
  const [page, setPage] = useState(0);
  const pages = useMemo(() => (document.textContent ? paginate(document.textContent) : []), [document.textContent]);

  useEffect(() => {
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'read_document' }) }).catch(() => {});
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved mode after mount
      if (localStorage.getItem('zen_reading_mode') === 'pages') setMode('pages');
    } catch {
      /* storage unavailable */
    }
  }, []);

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

  const askAbout = () => {
    ask.setSources([{ id: document.id, name: document.name, workspaceId: document.workspaceId }]);
    ask.open();
  };

  const toggle = (active: boolean) =>
    `w-11 h-11 rounded-full flex items-center justify-center ${active ? 'bg-[var(--accent-solid)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;

  return (
    <div className="min-h-full flex flex-col">
      <div className="shrink-0 sticky top-0 z-20 bg-[var(--bg-base)]/95 backdrop-blur border-b border-[var(--border-color)] px-3 min-h-14 flex items-center gap-2">
        <Link href="/vault" aria-label="Back to Library" className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <h1 className="flex-1 min-w-0 truncate text-[15px] font-semibold">{document.name}</h1>
        {!pdfUrl && pages.length > 0 && (
          <div role="group" aria-label="Reading mode" className="flex items-center gap-1 p-0.5 rounded-full bg-[var(--bg-surface-alt)]">
            <button type="button" onClick={() => chooseMode('scroll')} aria-pressed={mode === 'scroll'} aria-label="Scroll" className={toggle(mode === 'scroll')}>
              <AlignJustify size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => chooseMode('pages')} aria-pressed={mode === 'pages'} aria-label="Pages" className={toggle(mode === 'pages')}>
              <BookOpen size={18} aria-hidden />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={askAbout}
          className="h-11 px-4 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] text-sm font-bold flex items-center gap-2"
        >
          <MessageSquare size={16} aria-hidden /> <span className="hidden sm:inline">Ask</span>
          <span className="sm:hidden sr-only">Ask about this</span>
        </button>
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
        <article className="w-full max-w-2xl mx-auto px-5 py-8 flex flex-col gap-10">
          {pages.map((text, i) => (
            <section key={i} aria-label={`Page ${i + 1}`}>
              <div className={proseClass}>
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            </section>
          ))}
        </article>
      ) : (
        <div className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 flex flex-col gap-4">
          <div
            className="h-1 rounded bg-[var(--border-color)] overflow-hidden"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuenow={page + 1}
            aria-valuemin={1}
            aria-valuemax={pages.length}
          >
            <div className="h-full bg-[var(--accent-solid)]" style={{ width: `${((page + 1) / pages.length) * 100}%` }} />
          </div>
          <article className="flex-1 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 overflow-y-auto">
            <div className={proseClass}>
              <ReactMarkdown>{pages[page]}</ReactMarkdown>
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
    </div>
  );
}
