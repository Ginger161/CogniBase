'use client';

import React, { useState, useEffect } from 'react';
import { SideNav, TabBar, MobileHeader } from '@/components/nav/AppNav';
import { AskProvider } from '@/components/ask/AskProvider';
import AskSheet from '@/components/ask/AskSheet';
import { useUserContext } from '../../lib/hooks/useUserContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { context } = useUserContext();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Track the visual viewport so the tab bar stays above the on-screen keyboard.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  const userName = context?.name || 'Student';
  const height = viewportHeight ? `${viewportHeight}px` : '100dvh';

  return (
    <AskProvider>
      <div
        className="flex overflow-hidden text-[var(--text-primary)] w-full max-w-[100vw]"
        style={{ height }}
      >
        <SideNav userName={userName} />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <MobileHeader userName={userName} />
          <main className="flex-1 min-h-0 overflow-y-auto relative">{children}</main>
          <TabBar />
        </div>
      </div>
      <AskSheet />
    </AskProvider>
  );
}
