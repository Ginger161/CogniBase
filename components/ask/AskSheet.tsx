'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, ChevronLeft, GraduationCap, Layers, Network, Presentation, RotateCcw, Square, X } from 'lucide-react';
import type { UIMessage } from 'ai';
import { useAsk } from './AskProvider';
import GenerateAsset, { type AssetKind } from '../studio/GenerateAsset';
import StudyGuideSheet from '../library/StudyGuideSheet';

type Tool = 'cards' | 'map' | 'slides' | 'guide';
const KIND: Record<Exclude<Tool, 'guide'>, AssetKind> = { cards: 'flashcards', map: 'mindmap', slides: 'slides' };

const SUGGESTIONS = [
  'Summarise the key ideas',
  'Quiz me on this material',
  'What is most likely to be examined?',
];

function messageText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

// A tool call that has not produced output yet means we are still reading the sources.
function isSearching(m: UIMessage | undefined): boolean {
  if (!m || m.role !== 'assistant') return false;
  return m.parts.some(
    (p) => p.type.startsWith('tool-') && 'state' in p && p.state !== 'output-available' && p.state !== 'output-error'
  );
}

// Distinct cited document names, in order of first appearance.
function citedNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\]\(cite:([^)]+)\)/g)) {
    const name = decodeURIComponent(match[1]);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

function friendlyError(error: Error): string {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('daily usage limit') || msg.includes('quota')) return "The AI's daily usage limit has been reached. Try again later.";
  if (msg.includes('429') || msg.includes('too fast') || msg.includes('rate limit')) {
    return 'The AI is receiving too many requests right now. Wait a moment and try again.';
  }
  if (msg.includes('401') || msg.includes('403')) return 'Your session has expired. Sign in again to keep going.';
  if (msg.includes('503') || msg.includes('demand') || msg.includes('overloaded') || msg.includes('unavailable')) {
    return 'The AI servers are busy. Try again in a few moments.';
  }
  if (msg.includes('too long') || msg.includes('504') || msg.includes('timeout')) return 'That took too long. Try a shorter question or fewer sources.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Network problem. Check your connection and try again.';
  return 'Something went wrong generating that answer.';
}

function AssistantBody({ text }: { text: string }) {
  const names = useMemo(() => citedNames(text), [text]);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[15px] leading-relaxed text-[var(--text-primary)] [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-base [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--bg-surface-alt)] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[var(--bg-surface)] [&_pre]:border [&_pre]:border-[var(--border-color)] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_table]:text-sm [&_th]:text-left [&_th]:pr-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              if (href?.startsWith('cite:')) {
                const name = decodeURIComponent(href.slice(5));
                const n = names.indexOf(name) + 1;
                return (
                  <sup
                    title={name}
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] ml-1 rounded-full bg-[var(--tag-bg)] text-[var(--tag-text)] text-[11px] font-bold not-italic align-[2px]"
                  >
                    {n}
                  </sup>
                );
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] underline">
                  {children}
                </a>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {names.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {names.map((name, i) => (
            <li
              key={name}
              className="flex items-center gap-2.5 min-h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]"
            >
              <span className="w-[18px] h-[18px] rounded-full bg-[var(--tag-bg)] text-[var(--tag-text)] text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[13px] text-[var(--text-secondary)] truncate">{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AskSheet() {
  const { isOpen, close, source, messages, send, retry, reset, stop, isBusy, error } = useAsk();
  const [input, setInput] = useState('');
  const [tool, setTool] = useState<Tool | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tool) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close, tool]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isBusy, isOpen]);

  if (!isOpen || !source) return null;

  const last = messages[messages.length - 1];
  const lastText = last?.role === 'assistant' ? messageText(last) : '';
  const waiting = isBusy && (last?.role === 'user' || (last?.role === 'assistant' && !lastText));
  const showActions = !isBusy && !error && lastText.length > 0;
  const workspaceId = source.workspaceId;
  const documentIds = [source.id];

  const submit = () => {
    if (!input.trim() || isBusy) return;
    send(input);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Source console"
        className="fixed inset-0 z-50 md:inset-y-0 md:left-auto md:right-0 md:w-[440px] flex flex-col bg-[var(--bg-base)] md:border-l md:border-[var(--border-color)] md:shadow-2xl"
      >
        <div className="shrink-0 flex items-center gap-1 pl-2 pr-3 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-[var(--bg-surface-alt)]">
          <button
            type="button"
            onClick={close}
            aria-label="Close console"
            className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={22} className="md:hidden" aria-hidden />
            <X size={20} className="hidden md:block" aria-hidden />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold leading-tight font-mono">
              <span className="text-[var(--accent-text)]" aria-hidden>&gt;_</span> console
            </h2>
            <p className="text-xs text-[var(--text-muted)] truncate">{source.name}</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label="Start a new conversation"
              className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw size={18} aria-hidden />
            </button>
          )}
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-4 flex flex-col gap-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4 pt-4">
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                Ask anything about this source. Answers stay inside it and point back to where they came from.
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-11 px-4 text-left text-sm rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--accent-solid)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const text = messageText(m);
              if (!text) return null;
              return m.role === 'user' ? (
                <div
                  key={m.id}
                  className="self-end max-w-[85%] bg-[var(--accent-solid)] text-[var(--on-accent)] rounded-[18px] rounded-br-[4px] px-3.5 py-2.5 text-[15px] leading-snug font-medium whitespace-pre-wrap break-words"
                >
                  {text}
                </div>
              ) : (
                <AssistantBody key={m.id} text={text} />
              );
            })
          )}

          {waiting && (
            <div className="flex items-center gap-2 text-sm text-[var(--accent-text)] font-mono">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
              {isSearching(last) ? 'Searching this source…' : 'Thinking…'}
            </div>
          )}

          {error && !isBusy && (
            <div role="alert" className="flex items-start gap-3 p-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10">
              <p className="flex-1 text-sm text-[var(--danger)]">{friendlyError(error)}</p>
              <button type="button" onClick={retry} className="min-h-11 px-3 text-sm font-semibold underline text-[var(--text-primary)]">
                Retry
              </button>
            </div>
          )}

          {showActions && (
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Turn this into</span>
              <div className="flex flex-wrap gap-2">
                {([
                  ['cards', 'Flashcards', Layers],
                  ['map', 'Mind map', Network],
                  ['slides', 'Slides', Presentation],
                  ['guide', 'Study guide', GraduationCap],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTool(key)}
                    className="h-11 px-4 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[13px] font-semibold flex items-center gap-2 hover:border-[var(--accent-solid)]"
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="min-h-[52px] rounded-[26px] bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] flex items-end gap-2.5 pl-4 pr-1.5 py-1.5 focus-within:border-[var(--accent-solid)]">
            <span className="font-mono text-[13px] text-[var(--accent-text)] pb-3" aria-hidden>&gt;_</span>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder={messages.length ? 'Ask a follow-up' : 'Ask a question'}
              aria-label="Message"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="flex-1 min-w-0 bg-transparent outline-none resize-none text-[15px] py-2.5 placeholder:text-[var(--text-muted)] max-h-[140px]"
            />
            {isBusy ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] flex items-center justify-center shrink-0"
              >
                <Square size={14} fill="currentColor" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim()}
                aria-label="Send"
                className="w-10 h-10 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      <StudyGuideSheet source={tool === 'guide' ? source : null} onClose={() => setTool(null)} />
      {tool && tool !== 'guide' && (
        <GenerateAsset key={tool} kind={KIND[tool]} workspaceId={workspaceId} documentIds={documentIds} onClose={() => setTool(null)} />
      )}
    </>
  );
}
