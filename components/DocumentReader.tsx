"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { ArrowLeft, AlignJustify, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DocumentReader({ document }: { document: any }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [pages, setPages] = useState<string[]>([]);
  const [mode, setMode] = useState<'scroll' | 'swipe'>('scroll');
  const [currentPage, setCurrentPage] = useState(0);
  const [isHudVisible, setIsHudVisible] = useState(true);

  // Load persistence and track reading metric
  useEffect(() => {
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'read_document' }) }).catch(console.error);
    const savedMode = localStorage.getItem('zen_reading_mode');
    if (savedMode === 'swipe') {
      setMode('swipe');
    }
  }, []);

  const toggleMode = (m: 'scroll' | 'swipe') => {
    setMode(m);
    localStorage.setItem('zen_reading_mode', m);
    if (m === 'swipe') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (mode === 'swipe') {
      window.document.body.style.overflow = 'hidden';
    } else {
      window.document.body.style.overflow = 'auto';
    }
    return () => { window.document.body.style.overflow = 'auto'; };
  }, [mode]);

  useEffect(() => {
    if (!document?.textContent) return;
    // Split by paragraphs to avoid breaking markdown structures like bold, links, or lists
    const paragraphs = document.textContent.split(/\n\n+/);
    const chunks = [];
    let currentChunk = [];
    let currentWordCount = 0;
    
    for (const p of paragraphs) {
      const pWordCount = p.split(/\s+/).length;
      // Target ~250 words per chunk for safer pagination
      if (currentWordCount + pWordCount > 250 && currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [p];
        currentWordCount = pWordCount;
      } else {
        currentChunk.push(p);
        currentWordCount += pWordCount;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n\n"));
    }
    setPages(chunks);
  }, [document?.textContent]);

  // HUD Auto-hide logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      setIsHudVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsHudVisible(false), 2000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    handleActivity(); // Init
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  // Keyboard navigation for swipe mode
  useEffect(() => {
    if (mode !== 'swipe') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentPage(p => Math.min(pages.length - 1, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, pages.length]);

  if (!document) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Document Not Found</h1>
        <Link href="/vault" className="text-orange-500 hover:underline">
          Return to Vault
        </Link>
      </div>
    );
  }

  const handleNext = () => setCurrentPage(p => Math.min(pages.length - 1, p + 1));
  const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1));

  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <div className={`w-full h-full text-gray-200 selection:bg-orange-500/30 font-serif ${mode === 'swipe' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto overflow-x-hidden pb-24'}`}>
      {/* Scroll Progress Bar (Only meaningful in scroll mode) */}
      {mode === 'scroll' && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-orange-500 origin-left z-50"
          style={{ scaleX }}
        />
      )}

      {/* Swipe Progress Bar */}
      {mode === 'swipe' && pages.length > 0 && (
        <div 
          className="fixed top-0 left-0 h-1 bg-orange-500 z-50 transition-all duration-300 ease-out"
          style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
        />
      )}


      {/* Floating HUD */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-700 ease-in-out ${isHudVisible ? 'opacity-100' : 'opacity-20 hover:opacity-100'}`}
        onMouseEnter={() => setIsHudVisible(true)}
      >
        <div className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md border border-zinc-700/50 rounded-full p-1.5 shadow-2xl">
          <button 
            onClick={() => toggleMode('scroll')}
            className={`p-2 rounded-full transition-colors ${mode === 'scroll' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            title="Vertical Scroll"
          >
            <AlignJustify className="w-5 h-5" />
          </button>
          <button 
            onClick={() => toggleMode('swipe')}
            className={`p-2 rounded-full transition-colors ${mode === 'swipe' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            title="Horizontal Swipe"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className={`max-w-3xl mx-auto py-12 px-4 md:px-6 relative ${mode === 'swipe' ? 'flex-1 w-full h-full max-w-none flex items-center justify-center py-4' : ''}`}>
        {pages.length > 0 ? (
          mode === 'scroll' ? (
            <div className="flex flex-col gap-12">
              {pages.map((pageText, index) => (
                <motion.article 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl p-8 md:p-12"
                >
                  <div className="prose prose-invert max-w-none prose-h1:text-3xl prose-h1:font-bold prose-h1:text-white prose-h1:mb-6 prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-slate-100 prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-slate-200 prose-h3:mt-8 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-li:text-slate-300 prose-a:text-orange-500">
                    <ReactMarkdown>
                      {pageText}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-12 pt-6 border-t border-zinc-700/50 text-center font-sans text-sm text-zinc-500">
                    Page {index + 1} of {pages.length}
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
              {/* Swipe Controls Desktop */}
              <button 
                onClick={handlePrev}
                disabled={currentPage === 0}
                className="hidden md:flex absolute left-[-4rem] top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors z-10"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={handleNext}
                disabled={currentPage === pages.length - 1}
                className="hidden md:flex absolute right-[-4rem] top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors z-10"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              <div className="w-full h-full relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.article 
                    key={currentPage}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                      const swipe = swipePower(offset.x, velocity.x);
                      if (swipe < -10000) handleNext();
                      else if (swipe > 10000) handlePrev();
                    }}
                    className="absolute inset-0 w-full h-full bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl p-8 md:p-12 cursor-grab active:cursor-grabbing flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-hidden pr-4">
                      <div className="prose prose-invert max-w-none prose-h1:text-3xl prose-h1:font-bold prose-h1:text-white prose-h1:mb-6 prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-slate-100 prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-slate-200 prose-h3:mt-8 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-li:text-slate-300 prose-a:text-orange-500">
                        <ReactMarkdown>
                          {pages[currentPage]}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-700/50 text-center font-sans text-sm text-zinc-500 flex justify-between items-center shrink-0">
                      <span className="md:hidden cursor-pointer p-2 -ml-2" onClick={handlePrev}>
                        {currentPage > 0 ? <ChevronLeft className="w-5 h-5" /> : <span className="w-5 h-5 block" />}
                      </span>
                      <span>Page {currentPage + 1} of {pages.length}</span>
                      <span className="md:hidden cursor-pointer p-2 -mr-2" onClick={handleNext}>
                        {currentPage < pages.length - 1 ? <ChevronRight className="w-5 h-5" /> : <span className="w-5 h-5 block" />}
                      </span>
                    </div>
                  </motion.article>
                </AnimatePresence>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20 text-zinc-500 font-sans">
            No readable text content could be extracted from this document.
          </div>
        )}
      </main>
    </div>
  );
}
