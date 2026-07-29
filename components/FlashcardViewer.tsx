'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function FlashcardViewer({ workspaceId, onClose }: FlashcardViewerProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      fetchFlashcards();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 503 || errData.isCongested) {
          toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
        } else {
          toast.error(errData.error || "Failed to generate flashcards.");
        }
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setFlashcards(data);
        try {
          await fetch('/api/studio/save-asset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, title: 'Flashcards', type: 'FLASHCARD', content: data })
          });
        } catch (saveErr) {
          console.error("Failed to save flashcards to Studio Assets:", saveErr);
        }
      } else {
        toast.error("The AI returned an invalid flashcard format.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm rounded-xl">
      <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white transition">
        <X className="w-8 h-8" />
      </button>

      {loading ? (
        <div className="flex flex-col items-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl text-white font-medium animate-pulse">Generating your flashcards...</h2>
          <p className="text-gray-400 mt-2">The AI is analyzing your workspace materials.</p>
        </div>
      ) : flashcards.length > 0 ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          <div className="text-gray-400 mb-6 font-medium">Card {currentIndex + 1} of {flashcards.length}</div>
          
          <div 
            className="w-full h-80 sm:h-96 cursor-pointer group" 
            style={{ perspective: '1000px' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div 
              className="relative w-full h-full transition-all duration-500"
              style={{ 
                transformStyle: 'preserve-3d', 
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front - Question */}
              <div 
                className="absolute inset-0 w-full h-full bg-gray-900 border border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4">Question</div>
                <h3 className="text-2xl sm:text-3xl text-white text-center font-semibold">{flashcards[currentIndex].question}</h3>
                <div className="absolute bottom-6 text-gray-500 text-sm flex items-center gap-2">
                  <span>Click to flip</span>
                </div>
              </div>

              {/* Back - Answer */}
              <div 
                className="absolute inset-0 w-full h-full bg-blue-900/40 border border-blue-500/50 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <div className="text-blue-300 text-sm font-bold uppercase tracking-wider mb-4">Answer</div>
                <p className="text-xl sm:text-2xl text-white text-center">{flashcards[currentIndex].answer}</p>
                <div className="absolute bottom-6 text-gray-500 text-sm flex items-center gap-2">
                  <span>Click to flip back</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 mt-8">
            <button 
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-3 rounded-full bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-700 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNext}
              disabled={currentIndex === flashcards.length - 1}
              className="p-3 rounded-full bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-700 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-white">
          <p>No flashcards could be generated.</p>
        </div>
      )}
    </div>
  );
}
