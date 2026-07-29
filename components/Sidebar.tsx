'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  userData
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  userData: { name: string; email: string; [key: string]: any } | null;
}) {
  const pathname = usePathname();
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [showManifesto, setShowManifesto] = useState(false);

  const handleProfileTap = () => {
    const now = Date.now();
    if (now - lastTap < 2000) {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount >= 5) {
        setShowManifesto(true);
        setTapCount(0);
      }
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  };

  return (
    <>
      <aside className={`fixed md:relative top-0 left-0 h-[100dvh] w-[260px] bg-[#111111] border-r border-zinc-800 p-6 flex flex-col z-50 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shrink-0`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" alt="CogniBase" className="w-32 mb-0" />
          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginTop: '3rem' }}>
          <Link onClick={() => setIsSidebarOpen(false)} href="/dashboard" style={{ color: pathname === '/dashboard' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Command Center</Link>
          <Link onClick={() => setIsSidebarOpen(false)} href="/vault" style={{ color: pathname === '/vault' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/vault' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>My Vault</Link>
          <Link onClick={() => setIsSidebarOpen(false)} href="/study-guides" style={{ color: pathname === '/study-guides' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/study-guides' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Study Guides</Link>
          <Link onClick={() => setIsSidebarOpen(false)} href="/studio-assets" style={{ color: pathname === '/studio-assets' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/studio-assets' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Studio Assets</Link>
          <Link onClick={() => setIsSidebarOpen(false)} href="/analytics" style={{ color: pathname === '/analytics' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/analytics' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Analytics</Link>
          <Link onClick={() => setIsSidebarOpen(false)} href="/settings" style={{ color: pathname === '/settings' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/settings' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Settings</Link>
        </nav>
        
        <div 
          onClick={handleProfileTap}
          style={{ 
            borderTop: '1px solid #27272A', 
            paddingTop: '1.5rem', 
            marginTop: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {userData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.name}</span>
              <span style={{ color: '#A1A1AA', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.email}</span>
            </div>
          )}
          <div style={{ color: '#71717A', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#22C55E', borderRadius: '50%', display: 'inline-block' }}></span>
            <span>System Online</span>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {showManifesto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowManifesto(false)}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl p-8 relative overflow-hidden cursor-pointer"
            >
              <h2 className="text-2xl font-bold text-zinc-100 mb-6 tracking-tight">
                A Note from the Architect
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                For the past year, I relied on a combination of Gemini Pro and Notebook LM to synthesize my academic work for quick exam prep and deep study while simultaneously running multiple businesses. I am not a first-class student, but that combination bought my time back. It allowed me to focus on multiple tasks at once without academic burnout.
              </p>
              <p className="text-zinc-400 leading-relaxed mb-4">
                I built CogniBase to handle that entire workflow smoothly, all in one place. Every detail here, every interaction, was built with deep consideration for how different minds actually learn.
              </p>
              <hr className="border-white/5 my-6" />
              <p className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
                Ginger-Eke Chienyegom
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Veritas University | Educational Management
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
