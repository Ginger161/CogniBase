"use client";
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export default function StudyGuidesPage() {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [activeStudyGuide, setActiveStudyGuide] = useState<any>(null);
  const [isStudyGuideViewOpen, setIsStudyGuideViewOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserData({ name: user.displayName || 'Student', email: user.email || '', uid: user.uid });
        try {
          const sq = query(collection(db, 'study_guides'), where('userId', '==', user.uid));
          const studyGuideSnap = await getDocs(sq);
          const sGuides = studyGuideSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          sGuides.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setStudyGuides(sGuides);
        } catch(e) { console.error(e) }
      } else {
        setUserData({ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null });
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #09090B; color: #F9FAFB; overflow: hidden; }
        .dashboard-layout { display: flex; height: 100dvh; width: 100vw; overflow: hidden; }
        .sidebar { position: fixed; top: 0; left: -300px; width: 260px; height: 100dvh; background-color: #111111; border-right: 1px solid #27272A; padding: 1.5rem; display: flex; flex-direction: column; z-index: 50; transition: left 0.3s ease; }
        .sidebar.open { left: 0; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; z-index: 10; background-color: #09090B; padding: 0; }
        @media (min-width: 1024px) {
          .sidebar { position: static; width: 250px; left: 0; transition: none; flex-shrink: 0; }
        }
      `}</style>
      
      <div className="dashboard-layout">
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="/logo.png" alt="CogniBase" style={{ width: '120px' }} />
            <button className="menu-btn lg:hidden" onClick={() => setIsSidebarOpen(false)} style={{ display: 'none' }}>✕</button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginTop: '3rem' }}>
            <a href="/dashboard" style={{ color: pathname === '/dashboard' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Command Center</a>
            <a href="/vault" style={{ color: pathname === '/vault' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/vault' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>My Vault</a>
            <a href="/study-guides" style={{ color: pathname === '/study-guides' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/study-guides' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Study Guides</a>
            <a href="#" style={{ color: '#A1A1AA', textDecoration: 'none', transition: 'color 0.2s' }}>Active Engines</a>
            <a href="#" style={{ color: '#A1A1AA', textDecoration: 'none', transition: 'color 0.2s' }}>Settings</a>
          </nav>
        </aside>

        <main className="main-content" style={{ padding: '2rem', overflowY: 'auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Global Study Guides</h1>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {studyGuides.map(guide => (
              <div key={guide.id} className="w-full overflow-hidden px-4 sm:px-6 py-4 sm:py-6 break-words whitespace-normal hover:border-orange-500 hover:-translate-y-1" style={{ backgroundColor: '#18181B', borderRadius: '0.75rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}>
                <div className="min-w-0 w-full">
                  <h3 className="break-words whitespace-normal min-w-0" style={{ margin: 0, color: 'white', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>
                  <span className="break-words whitespace-normal min-w-0 block" style={{ color: '#71717A', fontSize: '0.85rem' }}>{guide.sourceDocumentName}</span>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#52525B', fontSize: '0.75rem' }}>
                    {guide.createdAt?.seconds ? new Date(guide.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                  </span>
                  <span style={{ color: '#EA580C', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Read <ChevronRight size={14}/></span>
                </div>
              </div>
            ))}
            {studyGuides.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', backgroundColor: '#111111', borderRadius: '1rem', border: '1px dashed #27272A' }}>
                <p style={{ color: '#A1A1AA' }}>You haven't generated any study guides yet.</p>
                <p style={{ color: '#71717A', fontSize: '0.9rem', marginTop: '0.5rem' }}>Go to My Vault, open a document's menu, and click "Generate Study Guide".</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Study Guide View Modal */}
      {isStudyGuideViewOpen && activeStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden break-words whitespace-normal" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="flex justify-between items-start sm:items-center p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900 gap-4" style={{ backgroundColor: '#18181B', borderBottomColor: '#27272A' }}>
              <div className="flex flex-col min-w-0 w-full">
                <h3 className="break-words whitespace-normal min-w-0" style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>
                <span className="break-words whitespace-normal min-w-0 block" style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>
              </div>
              <button 
                onClick={() => setIsStudyGuideViewOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                {activeStudyGuide.markdownContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
