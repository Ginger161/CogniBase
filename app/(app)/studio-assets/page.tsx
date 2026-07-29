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
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Studio Assets</h1>
      </header>

      <div style={{ maxWidth: '1200px' }}>
        <p className="text-gray-400 mb-8">View and export all AI-generated assets across your workspaces.</p>
        {userData.uid ? (
          <StudioAssetsPanel userId={userData.uid} />
        ) : (
          <div className="w-full h-20 bg-gray-900 rounded-xl border border-gray-800 animate-pulse" />
        )}
      </div>
    </div>
  );
}
