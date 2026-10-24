'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, Maximize, X, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch';
import { toast } from 'sonner';

export type StudioAsset = {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  content: unknown;
  createdAt: string;
};

type Card = { question: string; answer: string };
type Slide = { title: string; bulletPoints?: string[]; bullets?: string[] };

function Flashcards({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
    },
    [cards.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const card = cards[index];
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-6">
      <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
        Card {index + 1} of {cards.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Showing the answer. Tap to see the question' : 'Showing the question. Tap to reveal the answer'}
        className={`w-full max-w-xl min-h-[320px] rounded-3xl p-7 flex flex-col items-center justify-center gap-3 text-center shadow-2xl border ${
          flipped
            ? 'bg-[var(--accent-solid)] text-[var(--on-accent)] border-transparent'
            : 'bg-[var(--bg-surface)] border-[var(--border-color)]'
        }`}
      >
        <span className={`text-xs font-semibold tracking-widest uppercase ${flipped ? 'opacity-70' : 'text-[var(--text-muted)]'}`}>
          {flipped ? 'Answer' : 'Question'}
        </span>
        <span className="text-2xl font-bold leading-snug">{flipped ? card.answer : card.question}</span>
        {!flipped && <span className="text-sm font-semibold text-[var(--accent-text)]">Tap to flip</span>}
      </button>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous card"
          className="w-14 h-14 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-40"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          aria-label="Next card"
          className="w-14 h-14 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] flex items-center justify-center disabled:opacity-40"
        >
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const btn = 'w-11 h-11 rounded-lg bg-[var(--bg-surface-alt)] hover:bg-[var(--border-color)] flex items-center justify-center';
  return (
    <div className="absolute bottom-4 right-4 z-10 flex gap-2 p-2 rounded-xl bg-[var(--bg-surface)]/90 border border-[var(--border-color)]">
      <button type="button" className={btn} onClick={() => zoomIn()} aria-label="Zoom in">
        <ZoomIn size={20} aria-hidden />
      </button>
      <button type="button" className={btn} onClick={() => zoomOut()} aria-label="Zoom out">
        <ZoomOut size={20} aria-hidden />
      </button>
      <button type="button" className={btn} onClick={() => resetTransform()} aria-label="Reset view">
        <Maximize size={20} aria-hidden />
      </button>
    </div>
  );
}

function MindMap({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const id = 'mm' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        const { svg: out } = await mermaid.render(id, code);
        if (!cancelled) setSvg(out);
      } catch (e) {
        console.error('Mermaid render failed:', e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) return <p className="m-auto text-[var(--text-secondary)] px-5 text-center">This diagram could not be drawn.</p>;
  if (!svg) return <p className="m-auto text-[var(--text-secondary)]">Drawing…</p>;
  return (
    <div className="flex-1 min-h-0 relative">
      <TransformWrapper initialScale={1} minScale={0.2} limitToBounds={false} centerOnInit>
        <ZoomControls />
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
          <div className="[&>svg]:max-w-none" dangerouslySetInnerHTML={{ __html: svg }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function Slides({ slides, title }: { slides: Slide[]; title: string }) {
  const download = async () => {
    try {
      const pptxgen = (await import('pptxgenjs')).default;
      const pres = new pptxgen();
      for (const s of slides) {
        const slide = pres.addSlide();
        slide.addText(s.title, { x: 0.5, y: 0.5, w: '90%', h: 1, fontSize: 24, bold: true, color: '363636' });
        const bullets = s.bulletPoints ?? s.bullets ?? [];
        if (bullets.length) {
          slide.addText(
            bullets.map((b) => ({ text: b, options: { bullet: true } })),
            { x: 0.5, y: 1.5, w: '90%', h: 4, fontSize: 18, color: '666666' }
          );
        }
      }
      await pres.writeFile({ fileName: `${title.replace(/[^\w.-]+/g, '_') || 'slides'}.pptx` });
    } catch (e) {
      console.error(e);
      toast.error('Could not create the PowerPoint file.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <button
          type="button"
          onClick={download}
          className="self-start h-11 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center gap-2"
        >
          <Download size={18} aria-hidden /> Download .pptx
        </button>
        <ol className="flex flex-col gap-4">
          {slides.map((s, i) => (
            <li key={i} className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6">
              <p className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] mb-2">Slide {i + 1}</p>
              <h3 className="text-xl font-bold mb-4">{s.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {(s.bulletPoints ?? s.bullets ?? []).map((b, j) => (
                  <li key={j} className="flex gap-3 text-[15px] text-[var(--text-secondary)] leading-snug">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] shrink-0" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Full-screen viewer for a saved flashcard set, mind map or slide deck. */
export default function AssetViewer({ asset, onClose }: { asset: Pick<StudioAsset, 'title' | 'type' | 'content'>; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const c = asset.content as unknown;
  let body: React.ReactNode;
  if (asset.type === 'FLASHCARD' && Array.isArray(c) && c.length > 0) body = <Flashcards cards={c as Card[]} />;
  else if (asset.type === 'MINDMAP' && typeof (c as { mermaidCode?: unknown })?.mermaidCode === 'string')
    body = <MindMap code={(c as { mermaidCode: string }).mermaidCode} />;
  else if (asset.type === 'PRESENTATION' && Array.isArray(c) && c.length > 0) body = <Slides slides={c as Slide[]} title={asset.title} />;
  else body = <p className="m-auto text-[var(--text-secondary)] px-5 text-center">This item has no content to show.</p>;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={asset.title} className="fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col">
      <div className="shrink-0 flex items-center gap-2 pl-5 pr-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-[var(--border-color)] min-h-14">
        <h2 className="flex-1 min-w-0 truncate text-base font-bold">{asset.title}</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <X size={22} aria-hidden />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{body}</div>
    </div>,
    document.body
  );
}
