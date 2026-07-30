"use client";
import React, { useState, useEffect } from 'react';
import StudioAssetsPanel from '../../../components/StudioAssetsPanel';

export default function StudioAssetsPage() {
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());
      if (session?.user) {
        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ padding: '2rem', overflowY: 'auto' }}>
      <header className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[var(--accent-solid)] text-xl font-bold">&gt;_</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Studio Assets</h1>
        </div>
      </header>

      <div style={{ maxWidth: '1200px' }}>
        <p className="text-[var(--text-muted)] mb-8 text-sm font-mono">// every flashcard set, mind map, and deck you've generated</p>
        {userData.uid ? (
          <StudioAssetsPanel userId={userData.uid} />
        ) : (
          <div className="w-full h-20 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] animate-pulse" />
        )}
      </div>
    </div>
  );
}
