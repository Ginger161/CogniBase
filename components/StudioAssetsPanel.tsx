"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Network, Presentation, Headphones, Download, Eye, Loader2, Lock } from 'lucide-react';

interface StudioAsset {
  id: string;
  workspaceId: string;
  title: string;
  type: string;
  content: any;
  createdAt: string;
}

export default function StudioAssetsPanel({ workspaceId, userId }: { workspaceId?: string, userId?: string }) {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId || userId) {
      fetchAssets();
    } else {
      setLoading(false);
    }
  }, [workspaceId, userId]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const url = workspaceId 
        ? `/api/studio/assets?workspaceId=${workspaceId}` 
        : `/api/studio/assets?userId=${userId}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to fetch studio assets.");
        return;
      }
      
      setAssets(data.assets || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to communicate with the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (asset: StudioAsset) => {
    if (asset.type === 'PRESENTATION') {
      const toastId = toast.loading(`Generating slides for ${asset.title}...`);
      try {
        const res = await fetch('/api/engine/generate-ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentText: typeof asset.content === 'string' ? asset.content : JSON.stringify(asset.content) })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate presentation');
        }

        const pptxgen = (await import('pptxgenjs')).default;
        const pptx = new pptxgen();

        if (data.slides && Array.isArray(data.slides)) {
          data.slides.forEach((slideData: any) => {
            let slide = pptx.addSlide();
            slide.addText(slideData.title, { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
            
            if (slideData.bullets && slideData.bullets.length > 0) {
              slide.addText(
                slideData.bullets.map((b: string) => ({ text: b })), 
                { x: 0.5, y: 1.5, w: '90%', fontSize: 18, bullet: true, color: '666666' }
              );
            }
            if (slideData.speakerNotes) {
              slide.addNotes(slideData.speakerNotes);
            }
          });
        }

        await pptx.writeFile({ fileName: `${asset.title.replace(/\s+/g, '_')}.pptx` });
        toast.success('Presentation exported successfully!', { id: toastId });
        fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'generate_asset' }) }).catch(console.error);
      } catch (err: any) {
        console.error(err);
        toast.error(`Export failed: ${err.message}`, { id: toastId });
      }
    } else {
      toast.info(`Export for ${asset.type} is not yet implemented.`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'FLASHCARD': return <Layers className="w-5 h-5 text-purple-400" />;
      case 'MINDMAP': return <Network className="w-5 h-5 text-emerald-400" />;
      case 'PRESENTATION': return <Presentation className="w-5 h-5 text-blue-400" />;
      case 'AUDIO': return <Headphones className="w-5 h-5 text-orange-400" />;
      default: return <Layers className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-20 bg-gray-900 rounded-xl border border-gray-800 animate-pulse flex items-center p-4">
            <div className="w-10 h-10 bg-gray-800 rounded-lg mr-4"></div>
            <div className="flex-1 space-y-2">
              <div className="w-1/3 h-4 bg-gray-800 rounded"></div>
              <div className="w-1/4 h-3 bg-gray-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="w-full p-8 bg-gray-900/50 rounded-xl border border-gray-800 flex flex-col items-center justify-center text-center">
        <p className="text-gray-400">No assets generated yet.</p>
        <p className="text-xs text-gray-500 mt-2">Generate flashcards, mind maps, or presentations in The Studio to see them here.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Audio Overview Under Construction UI */}
      <div className="w-full bg-zinc-900/50 rounded-xl border border-zinc-800 opacity-80 cursor-not-allowed overflow-hidden flex flex-col mb-4 relative">
        <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,#eab308,#eab308_10px,#000_10px,#000_20px)]"></div>
        <div className="p-4 flex items-center gap-4">
          <div className="p-2.5 bg-zinc-950/50 rounded-lg text-yellow-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-200">Audio Overviews (Coming Soon)</h3>
            <p className="text-xs text-gray-400 mt-1">We are currently training our conversational audio models. Premium podcast synthesis will unlock in a future update.</p>
          </div>
        </div>
      </div>

      {assets.map((asset) => (
        <div key={asset.id} className="w-full bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors rounded-xl p-4 flex items-center justify-between group">
          
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="p-2.5 bg-gray-950 rounded-lg shadow-inner">
              {getIcon(asset.type)}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-gray-200 truncate">{asset.title}</span>
              <span className="text-xs text-gray-500">
                {asset.type} • {new Date(asset.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors tooltip-trigger"
              title="View Asset"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleExport(asset)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors tooltip-trigger"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

        </div>
      ))}
    </div>
  );
}
