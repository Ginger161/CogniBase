"use client";

import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { toast } from 'sonner';
import { X, RefreshCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

const Controls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 right-4 flex gap-2 z-10 bg-gray-900/80 p-2 rounded-lg backdrop-blur-sm border border-gray-700 shadow-xl">
      <button onClick={() => zoomIn()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
      <button onClick={() => zoomOut()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
      <button onClick={() => resetTransform()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="Reset View"><Maximize className="w-5 h-5" /></button>
    </div>
  );
};

interface MermaidViewerProps {
  workspaceId: string;
  onClose: () => void;
}

export default function MermaidViewer({ workspaceId, onClose }: MermaidViewerProps) {
  const [loading, setLoading] = useState(true);
  const [svgContent, setSvgContent] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', useMaxWidth: false } as any);
    
    if (workspaceId) {
      generateMindMap();
    } else {
      setLoading(false);
      toast.error("No active workspace found.");
    }
  }, [workspaceId]);

  const generateMindMap = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 503 || errData.isCongested) {
          toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
        } else {
          toast.error(errData.error || "Failed to generate mind map.");
        }
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      
      if (data && data.mermaidCode) {
        await renderMermaidDiagram(data.mermaidCode);
      } else {
        toast.error("The AI returned an invalid diagram format.");
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while communicating with the AI.");
      setLoading(false);
    }
  };

  const renderMermaidDiagram = async (code: string) => {
    try {
      // In mermaid v10+, render is async and returns { svg }
      const { svg } = await mermaid.render('mermaid-diagram', code);
      setSvgContent(svg);
      try {
        await fetch('/api/studio/save-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, title: 'Mind Map', type: 'MINDMAP', content: { mermaidCode: code } })
        });
      } catch (saveErr) {
        console.error("Failed to save mind map to Studio Assets:", saveErr);
      }
    } catch (error) {
      console.error("Mermaid rendering error:", error);
      toast.error("Failed to render the diagram visually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center m-0 p-0 max-w-none w-screen h-screen border-none rounded-none">
      <div className="w-full h-full relative flex flex-col bg-gray-950 overflow-hidden">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10 bg-gray-900 p-2 rounded-full border border-gray-700 shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl text-white font-medium animate-pulse">Mapping concepts...</h2>
          <p className="text-gray-400 mt-2">The AI is visualizing your study materials.</p>
        </div>
      ) : svgContent ? (
        <div className="flex-1 w-full h-full flex flex-col bg-gray-900/30 p-2 pt-6">
          <div className="text-center text-gray-400 mb-2 text-sm font-medium">Mind Maps & Diagrams</div>
          
          <div 
            ref={containerRef}
            className="flex-1 w-full h-full overflow-hidden bg-gray-950 flex items-center justify-center relative cursor-move"
          >
            <TransformWrapper
              initialScale={2}
              minScale={0.1}
              limitToBounds={false}
              centerOnInit={true}
            >
              <Controls />
              <TransformComponent wrapperClass="w-full h-full flex-1" contentClass="w-full h-full flex items-center justify-center">
                <div 
                  className="w-full h-full flex items-center justify-center [&>svg]:max-w-none [&>svg]:h-auto [&>svg]:origin-center"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
          
          <div className="text-center text-gray-500 text-xs mt-3 mb-2">
            Scroll or pan to explore the full diagram.
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <p>No diagram could be generated.</p>
        </div>
      )}
      </div>
    </div>
  );
}
