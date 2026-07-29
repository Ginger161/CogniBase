'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { useUserContext } from '../../lib/hooks/useUserContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { context, isLoading: isContextLoading } = useUserContext();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null };
  const dynamicHeight = viewportHeight ? `${viewportHeight}px` : '100dvh';

  return (
    <div
      className="flex overflow-hidden bg-[#0A1128] text-white w-full max-w-[100vw]"
      style={{ height: dynamicHeight }}
    >
      <div
        className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        userData={userData}
      />

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden" style={{ height: dynamicHeight }}>
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 shrink-0 bg-[#111111]">
          <div className="flex items-center gap-2">
            <button
              className="p-2 -ml-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <span className="font-bold text-zinc-100">CogniBase</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative">
          {children}
        </div>
      </main>
    </div>
  );
}
