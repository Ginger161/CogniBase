"use client";

import React, { useState, useEffect } from 'react';
import pptxgen from 'pptxgenjs';
import { toast } from 'sonner';
import { X, RefreshCw, Download, FileAudio, FileText } from 'lucide-react';

interface Slide {
  title: string;
  bulletPoints: string[];
}

interface PresentationViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function PresentationViewer({ workspaceId, onClose }: PresentationViewerProps) {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    if (workspaceId) {
      generatePresentation();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const generatePresentation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to generate presentation.");
        setLoading(false);
        return;
      }
      
      if (data && Array.isArray(data.slides)) {
        setSlides(data.slides);
      } else {
        toast.error("The AI returned an invalid presentation format.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const pres = new pptxgen();
      
      slides.forEach((slideData) => {
        const slide = pres.addSlide();
        
        // Add Title
        slide.addText(slideData.title, {
          x: 0.5,
          y: 0.5,
          w: "90%",
          h: 1,
          fontSize: 24,
          bold: true,
          color: "363636",
        });

        // Add Bullet Points
        const formattedBullets = slideData.bulletPoints.map(point => ({ text: point, options: { bullet: true } }));
        slide.addText(formattedBullets, {
          x: 0.5,
          y: 1.5,
          w: "90%",
          h: 4,
          fontSize: 18,
          color: "666666",
        });
      });

      pres.writeFile({ fileName: 'Study_Deck.pptx' });
      toast.success("Presentation downloaded successfully!");
    } catch (error) {
      console.error("PPTX Generation Error:", error);
      toast.error("Failed to generate the PowerPoint file.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] relative flex flex-col bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">PowerPoint Generator</h2>
              <p className="text-sm text-gray-400">AI-powered slide deck creation</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition bg-gray-900 p-2 rounded-full border border-gray-700 shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[400px]">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h2 className="text-xl text-white font-medium animate-pulse">Designing slides...</h2>
              <p className="text-gray-400 mt-2">The AI is structuring your presentation.</p>
              
              {/* Skeleton Cards */}
              <div className="w-full max-w-2xl mt-12 space-y-6 opacity-50">
                {[1, 2].map(i => (
                  <div key={i} className="w-full h-48 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col gap-4 animate-pulse">
                    <div className="w-3/4 h-6 bg-gray-800 rounded"></div>
                    <div className="w-full h-4 bg-gray-800 rounded mt-4"></div>
                    <div className="w-5/6 h-4 bg-gray-800 rounded"></div>
                    <div className="w-4/6 h-4 bg-gray-800 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : slides.length > 0 ? (
            <div className="w-full max-w-2xl flex flex-col gap-8 pb-10">
              
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                <span className="text-blue-200 font-medium">{slides.length} slides generated successfully.</span>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" />
                  Download .pptx
                </button>
              </div>

              <div className="space-y-6">
                {slides.map((slide, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
                    <div className="text-xs font-bold text-gray-500 tracking-wider mb-2 uppercase">Slide {idx + 1}</div>
                    <h3 className="text-2xl font-bold text-white mb-6 leading-tight">{slide.title}</h3>
                    <ul className="space-y-3">
                      {slide.bulletPoints.map((point, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3 text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                          <span className="text-lg leading-snug">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-white min-h-[300px]">
              <p className="text-gray-400">No slides could be generated.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
