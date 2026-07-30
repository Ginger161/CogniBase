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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ padding: '2rem', overflowY: 'auto' }}>
      <header className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[var(--accent-solid)] text-xl font-bold">&gt;_</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Study Guides</h1>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-mono mt-1">// every guide you've built, in one place</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {Array.isArray(studyGuides) && studyGuides.length > 0 ? (
          studyGuides.map(guide => (
            <div
              key={guide.id}
              className="relative w-full overflow-hidden px-4 sm:px-6 py-4 sm:py-6 break-words whitespace-normal hover:border-orange-500/60 hover:-translate-y-1 bg-[var(--bg-surface)] border border-[var(--border-color)]"
              style={{ borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }}
              onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-solid), transparent)' }}></div>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-2 min-w-0 w-full">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--tag-bg)] flex items-center justify-center text-sm">📖</div>
                  <div className="min-w-0 w-full">
                    <h3 className="break-words whitespace-normal min-w-0 text-[var(--text-primary)]" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>
                    <span className="break-words whitespace-normal min-w-0 block font-mono text-[var(--text-muted)]" style={{ fontSize: '0.78rem' }}>{guide.sourceDocumentName}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, guide.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex-shrink-0 ${deleteConfirmId === guide.id ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] hover:text-red-400'}`}
                >
                  {deleteConfirmId === guide.id ? 'Confirm Delete?' : 'Delete'}
                </button>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono text-[var(--text-muted)]" style={{ fontSize: '0.72rem' }}>
                  {formatSmartTime(guide.createdAt)}
                </span>
                <span className="text-[var(--accent-solid)]" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>Read <ChevronRight size={14}/></span>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-color)] text-[var(--text-secondary)]" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', borderRadius: '1rem' }}>
            <p>No study guides found or failed to load.</p>
            <p className="text-[var(--text-muted)]" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Go to My Vault, open a document's menu, and click "Generate Study Guide".</p>
          </div>
        )}
      </div>

      {isStudyGuideViewOpen && activeStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden break-words whitespace-normal bg-[var(--bg-surface)] border border-[var(--border-color)]" style={{ borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="flex justify-between items-start sm:items-center p-4 sm:p-6 border-b gap-4 bg-[var(--bg-surface-alt)] border-[var(--border-color)]">
              <div className="flex flex-col min-w-0 w-full">
                <span className="font-mono text-[var(--accent-solid)] text-xs font-bold mb-1">&gt;_ study guide</span>
                <h3 className="break-words whitespace-normal min-w-0 text-[var(--text-primary)]" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{activeStudyGuide.sectionConstraint}</h3>
                <span className="break-words whitespace-normal min-w-0 block font-mono text-[var(--text-muted)]" style={{ fontSize: '0.8rem' }}>{activeStudyGuide.sourceDocumentName}</span>
              </div>
              <button
                onClick={() => setIsStudyGuideViewOpen(false)}
                className="text-[var(--text-secondary)]"
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="px-3 sm:px-8 py-3 sm:py-8 text-[var(--text-secondary)]" style={{ flex: 1, overflowY: 'auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {activeStudyGuide.strategyData ? (
                <StudyEngine guideData={activeStudyGuide.strategyData} guideId={activeStudyGuide.id} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-center p-8">
                  <p>This guide was generated with an older engine. Please generate a new one for the gamified experience.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
