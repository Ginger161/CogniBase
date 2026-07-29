"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { StudyEngine } from '@/components/StudyEngine';
import { toast } from 'sonner';
import { formatSmartTime } from '@/lib/utils/time';


export default function StudyGuidesPage() {
  const pathname = usePathname();
  
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [activeStudyGuide, setActiveStudyGuide] = useState<any>(null);
  const [isStudyGuideViewOpen, setIsStudyGuideViewOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(null);
      }, 3000);
      return;
    }
    
    try {
      const res = await fetch(`/api/study-guides/${id}?userId=${userData.uid}`, { method: 'DELETE' });
      if (res.ok) {
        setStudyGuides(prev => prev.filter(g => g.id !== id));
        setDeleteConfirmId(null);
        toast.success("Study guide deleted successfully.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete study guide.");
      }
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("An unexpected error occurred.");
    }
  };

  useEffect(() => {
    const fetchGuides = async () => {
      const { data: { session } } = await import('@/utils/supabase/client').then(m => m.supabase.auth.getSession());
      if (session?.user) {
        setUserData({ name: session.user.email?.split('@')[0] || 'Student', email: session.user.email || '', uid: session.user.id });
        try {
          const res = await fetch('/api/study-guides?userId=' + session.user.id);
          const sGuides = await res.json();
          setStudyGuides(sGuides);
        } catch(e) { console.error(e) }
      }
    };
    fetchGuides();
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
      
      <div className="flex flex-col h-full w-full">
        

        <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ padding: '2rem', overflowY: 'auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Global Study Guides</h1>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {Array.isArray(studyGuides) && studyGuides.length > 0 ? (
              studyGuides.map(guide => (
                <div key={guide.id} className="w-full overflow-hidden px-4 sm:px-6 py-4 sm:py-6 break-words whitespace-normal hover:border-orange-500 hover:-translate-y-1" style={{ backgroundColor: '#18181B', borderRadius: '0.75rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 w-full pr-4">
                      <h3 className="break-words whitespace-normal min-w-0" style={{ margin: 0, color: 'white', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>
                      <span className="break-words whitespace-normal min-w-0 block" style={{ color: '#71717A', fontSize: '0.85rem' }}>{guide.sourceDocumentName}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, guide.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex-shrink-0 ${deleteConfirmId === guide.id ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-800/50 text-zinc-500 hover:text-red-400 hover:bg-zinc-800'}`}
                    >
                      {deleteConfirmId === guide.id ? 'Confirm Delete?' : 'Delete'}
                    </button>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#52525B', fontSize: '0.75rem' }}>
                      {formatSmartTime(guide.createdAt)}
                    </span>
                    <span style={{ color: '#EA580C', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Read <ChevronRight size={14}/></span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', backgroundColor: '#111111', borderRadius: '1rem', border: '1px dashed #27272A' }}>
                <p style={{ color: '#A1A1AA' }}>No study guides found or failed to load.</p>
                <p style={{ color: '#71717A', fontSize: '0.9rem', marginTop: '0.5rem' }}>Go to My Vault, open a document's menu, and click "Generate Study Guide".</p>
              </div>
            )}
          </div>
        </div>
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
              {activeStudyGuide.strategyData ? (
                <StudyEngine guideData={activeStudyGuide.strategyData} guideId={activeStudyGuide.id} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-center p-8">
                  <p>This guide was generated with an older engine. Please generate a new one for the gamified experience.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
