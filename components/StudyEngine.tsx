"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, Layers, BrainCircuit } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

interface Phase {
  phaseId: string;
  title: string;
  microBites: string[];
  flashcards: Flashcard[];
}

interface GuideData {
  guideTitle: string;
  phases: Phase[];
}

interface StudyEngineProps {
  guideData: any;
  guideId?: string;
}

export function StudyEngine({ guideData, guideId }: StudyEngineProps) {
  const [viewState, setViewState] = useState<'quest_log' | 'micro_bite' | 'flashcards'>('quest_log');
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [currentBiteIndex, setCurrentBiteIndex] = useState<number>(0);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());
  const [isPublicGuide, setIsPublicGuide] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const toggleShare = async () => {
    if (!guideId) return;
    const nextValue = !isPublicGuide;
    setIsSharing(true);
    try {
      const res = await fetch(`/api/study-guides/${guideId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextValue })
      });
      if (res.ok) {
        setIsPublicGuide(nextValue);
        if (nextValue) {
          const shareUrl = `${window.location.origin}/share/guide/${guideId}`;
          if (navigator.share) {
            try {
              await navigator.share({
                title: data?.guideTitle || 'My CogniBase Study Guide',
                text: 'Check out this study guide I made on CogniBase!',
                url: shareUrl,
              });
            } catch (e) {
              // Person closed the share sheet without picking anything — not an error, do nothing
            }
          } else {
            navigator.clipboard.writeText(shareUrl);
            alert("Share link copied! Anyone with this link can view a read-only version of this guide.");
          }
        } else {
          alert("This guide is no longer shared publicly.");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  let data: GuideData | null = null;
  try {
    data = typeof guideData === 'string' ? JSON.parse(guideData) : guideData;
  } catch (e) {
    console.error("Invalid guideData", e);
  }

  React.useEffect(() => {
    if (guideId) {
      fetch(`/api/study-guides/progress?guideId=${guideId}`)
        .then(res => res.json())
        .then(resData => {
          if (resData.completedPhases) {
            setCompletedPhases(new Set(resData.completedPhases));
          }
        })
        .catch(err => console.error("Failed to fetch progress", err));
    }
  }, [guideId]);

  const recordPhaseCompletion = async (phaseId: string) => {
    setCompletedPhases(prev => new Set(prev).add(phaseId));
    if (guideId) {
      fetch('/api/study-guides/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId, phaseId })
      }).catch(err => console.error(err));
      
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_phase' })
      }).catch(err => console.error(err));
    }
  };

  if (!data || !data.phases) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center bg-[#111111]">
        <BrainCircuit className="w-16 h-16 text-zinc-600 mb-4" />
        <p>This study guide is using an older format or failed to generate correctly.</p>
      </div>
    );
  }

  const activePhase = data.phases[activePhaseIndex];

  const handleStartPhase = (index: number) => {
    setActivePhaseIndex(index);
    setCurrentBiteIndex(0);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    
    const clickedPhase = data?.phases[index];
    if (clickedPhase && !completedPhases.has(clickedPhase.phaseId)) {
        // The Double-Trigger
        recordPhaseCompletion(clickedPhase.phaseId);
    }
    
    if (clickedPhase?.microBites && clickedPhase.microBites.length > 0) {
        setViewState('micro_bite');
    } else if (clickedPhase?.flashcards && clickedPhase.flashcards.length > 0) {
        setViewState('flashcards');
    }
  };

  const advanceMicroBite = () => {
    if (currentBiteIndex < activePhase.microBites.length - 1) {
      setCurrentBiteIndex(prev => prev + 1);
    } else {
      if (activePhase.flashcards && activePhase.flashcards.length > 0) {
          setViewState('flashcards');
      } else {
          recordPhaseCompletion(activePhase.phaseId);
          setViewState('quest_log');
      }
    }
  };

  const advanceFlashcard = () => {
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flashcard_review' })
    }).catch(err => console.error(err));

    if (currentCardIndex < activePhase.flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      recordPhaseCompletion(activePhase.phaseId);
      setViewState('quest_log');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111111] overflow-hidden rounded-lg">
      <AnimatePresence mode="wait">
        {viewState === 'quest_log' && (
          <motion.div 
            key="quest_log"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 overflow-y-auto p-4 sm:p-8"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{data.guideTitle || 'Study Quest'}</h2>
                <p className="text-zinc-400">Complete all phases to master this material.</p>
              </div>
              {guideId && (
                <button
                  onClick={toggleShare}
                  disabled={isSharing}
                  className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {isPublicGuide ? 'Shared ✓' : 'Share'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {data.phases.map((phase, index) => {
                const isCompleted = completedPhases.has(phase.phaseId);
                return (
                  <button
                    key={phase.phaseId}
                    onClick={() => handleStartPhase(index)}
                    className={`flex items-center justify-between p-5 rounded-xl border text-left transition-all ${
                      isCompleted 
                        ? 'bg-green-900/10 border-green-900/50 hover:bg-green-900/20' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                        isCompleted ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${isCompleted ? 'text-green-50' : 'text-zinc-100'}`}>{phase.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{phase.microBites?.length || 0} bites • {phase.flashcards?.length || 0} cards</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${isCompleted ? 'text-green-600' : 'text-zinc-600'}`} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {viewState === 'micro_bite' && activePhase && (
          <motion.div 
            key="micro_bite"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col p-4 sm:p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{activePhase.title}</span>
              <span className="text-xs font-bold text-[#EA580C] bg-[#EA580C]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Micro-Bite {currentBiteIndex + 1} of {activePhase.microBites.length}
              </span>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <motion.p 
                key={currentBiteIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white text-center leading-tight max-w-3xl"
              >
                {activePhase.microBites[currentBiteIndex]}
              </motion.p>
            </div>

            <div className="mt-8">
              <button 
                onClick={advanceMicroBite}
                className="w-full py-5 rounded-2xl bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold text-xl shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all active:scale-[0.98]"
              >
                Tap to Continue
              </button>
            </div>
          </motion.div>
        )}

        {viewState === 'flashcards' && activePhase && (
          <motion.div 
            key="flashcards"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col p-4 sm:p-8 perspective-1000"
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge Check</span>
              <span className="text-xs font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Card {currentCardIndex + 1} of {activePhase.flashcards.length}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center relative w-full max-w-2xl mx-auto min-h-[300px]" style={{ perspective: '1000px' }}>
              <motion.div 
                className="w-full h-full relative min-h-[300px]"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className="absolute inset-0 w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl" style={{ backfaceVisibility: 'hidden' }}>
                  <span className="absolute top-6 text-zinc-500 text-sm font-semibold uppercase tracking-widest">Question</span>
                  <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-relaxed">
                    {activePhase.flashcards[currentCardIndex].question}
                  </p>
                  <span className="absolute bottom-6 text-[#EA580C] text-sm font-semibold animate-pulse">Tap to flip</span>
                </div>

                {/* Back */}
                <div className="absolute inset-0 w-full h-full bg-[#EA580C] rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl shadow-[#EA580C]/20" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <span className="absolute top-6 text-orange-200 text-sm font-semibold uppercase tracking-widest">Answer</span>
                  <p className="text-2xl sm:text-3xl font-bold text-white text-center leading-relaxed">
                    {activePhase.flashcards[currentCardIndex].answer}
                  </p>
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {isFlipped && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8"
                >
                  <button 
                    onClick={advanceFlashcard}
                    className="w-full py-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xl transition-all active:scale-[0.98]"
                  >
                    Got it. Next!
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
