'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useUserContext } from '@/lib/hooks/useUserContext';

export type AskSource = { id: string; name: string; workspaceId: string };

type AskContextValue = {
  sources: AskSource[];
  setSources: (next: AskSource[]) => void;
  toggleSource: (s: AskSource) => void;
  removeSource: (id: string) => void;
  clearSources: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  messages: UIMessage[];
  send: (text: string) => void;
  retry: () => void;
  reset: () => void;
  stop: () => void;
  isBusy: boolean;
  error: Error | undefined;
};

const AskContext = createContext<AskContextValue | null>(null);

const STORAGE_KEY = 'cb-ask-sources';

function loadSources(): AskSource[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
}

export function AskProvider({ children }: { children: React.ReactNode }) {
  const { context } = useUserContext();
  const [sources, setSourcesState] = useState<AskSource[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Read the saved selection after mount so server and client markup match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists on the client
    setSourcesState(loadSources());
  }, []);

  const setSources = useCallback((next: AskSource[]) => {
    setSourcesState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: selection just won't survive a reload */
    }
  }, []);

  const profile = context
    ? {
        name: context.name,
        school: context.school,
        department: context.department,
        courses: context.profile?.courses || [],
      }
    : null;

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, regenerate, setMessages, stop, status, error } = useChat({ transport });
  const isBusy = status === 'submitted' || status === 'streaming';

  // The scope travels with every request so a changed selection applies to the next message.
  const requestOptions = useMemo(
    () => ({ body: { activeSources: sources.map((s) => s.id), userProfile: profile } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources, context]
  );

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      sendMessage({ text: t }, requestOptions);
      fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(() => {});
    },
    [sendMessage, requestOptions]
  );

  const value = useMemo<AskContextValue>(
    () => ({
      sources,
      setSources,
      toggleSource: (s) =>
        setSources(sources.some((x) => x.id === s.id) ? sources.filter((x) => x.id !== s.id) : [...sources, s]),
      removeSource: (id) => setSources(sources.filter((s) => s.id !== id)),
      clearSources: () => setSources([]),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      messages,
      send,
      retry: () => regenerate(requestOptions),
      reset: () => setMessages([]),
      stop,
      isBusy,
      error,
    }),
    [sources, setSources, isOpen, messages, send, regenerate, requestOptions, setMessages, stop, isBusy, error]
  );

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}

export function useAsk() {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error('useAsk must be used inside <AskProvider>');
  return ctx;
}
