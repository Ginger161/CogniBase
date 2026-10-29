'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useUserContext } from '@/lib/hooks/useUserContext';

export type AskSource = { id: string; name: string; workspaceId: string };

type AskContextValue = {
  /** The one source the console is attached to. Null until a source is opened. */
  source: AskSource | null;
  /** Attach the console to a source. Switching source starts a fresh conversation. */
  attach: (s: AskSource) => void;
  /** Detach the console and drop its conversation (leaving the source). */
  detach: () => void;
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

export function AskProvider({ children }: { children: React.ReactNode }) {
  const { context } = useUserContext();
  const [source, setSource] = useState<AskSource | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  // Every request is scoped to the attached source; the server rejects an unscoped chat.
  const requestOptions = useMemo(
    () => ({ body: { activeSources: source ? [source.id] : [], userProfile: profile } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, context]
  );

  const attach = useCallback(
    (s: AskSource) => {
      setSource((prev) => {
        if (prev?.id !== s.id) setMessages([]);
        return s;
      });
    },
    [setMessages]
  );

  const detach = useCallback(() => {
    stop();
    setMessages([]);
    setSource(null);
    setIsOpen(false);
  }, [stop, setMessages]);

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || !source) return;
      sendMessage({ text: t }, requestOptions);
      fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(() => {});
    },
    [sendMessage, requestOptions, source]
  );

  const value = useMemo<AskContextValue>(
    () => ({
      source,
      attach,
      detach,
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
    [source, attach, detach, isOpen, messages, send, regenerate, requestOptions, setMessages, stop, isBusy, error]
  );

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}

export function useAsk() {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error('useAsk must be used inside <AskProvider>');
  return ctx;
}
