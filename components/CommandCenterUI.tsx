'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown } from 'lucide-react';

function ProgressText() {
  const [phase, setPhase] = useState(0);
  const phases = ['Searching document...', 'Analyzing context...', 'Synthesizing response...'];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);
  
  return <span>{phases[phase]}</span>;
}


interface CommandCenterUIProps {
title?: string;
activeSources?: Array<{ id: string; title: string }>;
onRemoveSource?: (id: string) => void;
onAddSource?: () => void;
onExit?: () => void;
chatMessages?: Array<{ role: string; text: string }>;
chatInput?: string;
setChatInput?: (val: string) => void;
onSendMessage?: () => void;
onUpdateTitle?: (newTitle: string) => void;
isChatLoading?: boolean;
isAssimilating?: boolean;
assimilationStatus?: string;
chatError?: any;
onRetry?: () => void;
onYouTubeSubmit?: (url: string) => Promise<void>;
}

const getFriendlyErrorMessage = (error: any) => {
  if (!error) return "";
  const msg = error.message || String(error);
  
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED")) {
    return "The AI is currently receiving too many requests or its usage limits have been reached. Please wait a moment and try again.";
  }
  if (msg.includes("401") || msg.includes("403")) {
    return "There is an issue with the AI's authorization. Please check the system configuration.";
  }
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
    return "There was a network issue communicating with the AI. Please check your internet connection.";
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return "The AI servers are currently experiencing temporary issues. Please try again later.";
  }
  
  return "Something went wrong while generating a response. Please try again.";
};

export default function CommandCenterUI({
title = "Untitled Workspace",
activeSources = [],
onRemoveSource = () => {},
onAddSource = () => {},
onExit = () => {},
chatMessages = [],
chatInput = "",
setChatInput = () => {},
onSendMessage = () => {},
onUpdateTitle = () => {},
isChatLoading = false,
isAssimilating = false,
assimilationStatus = "",
chatError = null,
onRetry,
onYouTubeSubmit
}: CommandCenterUIProps) {
// UI States
const [mobileTab, setMobileTab] = useState<'chat' | 'studio'>('chat');
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [tempTitle, setTempTitle] = useState(title);
const [feedback, setFeedback] = useState<Record<number, 'like' | 'dislike' | undefined>>({});
const [isExpanded, setIsExpanded] = useState(false);
const [youtubeUrl, setYoutubeUrl] = useState("");
const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
const [youtubeLoadingText, setYoutubeLoadingText] = useState(">_ Bypassing mainframe... scraping captions [     ]");
const [youtubeError, setYoutubeError] = useState<string | null>(null);

const handleYouTubeSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!youtubeUrl.trim() || !onYouTubeSubmit) return;
  
  setIsYoutubeLoading(true);
  setYoutubeError(null);
  
  let dots = 0;
  const interval = setInterval(() => {
    dots = (dots + 1) % 6;
    const progress = "=".repeat(dots) + " ".repeat(5 - dots);
    setYoutubeLoadingText(`>_ Bypassing mainframe... scraping captions [${progress}]`);
  }, 200);

  try {
    await onYouTubeSubmit(youtubeUrl.trim());
    setYoutubeUrl("");
  } catch (error: any) {
    console.error("YouTube extract error:", error);
    setYoutubeError(`>_ ERROR: ${error.message}`);
  } finally {
    clearInterval(interval);
    setIsYoutubeLoading(false);
  }
};


// Sync local title state if the prop changes
useEffect(() => {
setTempTitle(title);
}, [title]);

const handleTitleSave = () => {
setIsEditingTitle(false);
if (tempTitle.trim() && tempTitle !== title) {
onUpdateTitle(tempTitle.trim());
} else {
setTempTitle(title); // Revert if empty
}
};

return (
<div className="w-full flex flex-col h-full">
  {/* Dynamic Editable Header */}
  <div className="mb-6 w-full">
    {isEditingTitle ? (
      <input 
        autoFocus
        type="text"
        value={tempTitle}
        onChange={(e) => setTempTitle(e.target.value)}
        onBlur={handleTitleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
        className="text-2xl md:text-3xl font-bold mb-2 bg-transparent border-b-2 border-orange-500 focus:outline-none w-full max-w-md text-white"
      />
    ) : (
      <h1 
        onClick={() => setIsEditingTitle(true)}
        className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3 cursor-pointer hover:text-gray-300 transition-colors group w-fit"
      >
        {tempTitle} 
        <span className="text-gray-600 text-lg group-hover:text-orange-500 transition-colors">✎</span>
      </h1>
    )}
    <p className="text-gray-400 text-sm mb-4">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
    
    {/* Chips */}
    <div className="flex flex-wrap items-center gap-3">
      {(isExpanded ? activeSources : activeSources.slice(0, 3)).map((source, idx) => (
        <div key={source.id || idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-sm rounded-lg border border-gray-700 shadow-sm">
          <span className="truncate max-w-[200px]">{source.title}</span>
          <button onClick={() => onRemoveSource(source.id)} className="text-gray-500 hover:text-white">✕</button>
        </div>
      ))}
      
      {!isExpanded && activeSources.length > 3 && (
        <button onClick={() => setIsExpanded(true)} className="px-3 py-1.5 bg-gray-800 text-gray-300 text-sm rounded-lg border border-gray-700 shadow-sm hover:bg-gray-700 transition-colors">
          + {activeSources.length - 3} more
        </button>
      )}

      {isExpanded && activeSources.length > 3 && (
        <button onClick={() => setIsExpanded(false)} className="px-3 py-1.5 bg-gray-800 text-gray-300 text-sm rounded-lg border border-gray-700 shadow-sm hover:bg-gray-700 transition-colors">
          Show less
        </button>
      )}

      {activeSources.length < 10 && (
        <button onClick={onAddSource} className="px-4 py-1.5 text-sm font-medium text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-colors">
          + Add Source
        </button>
      )}
    </div>

    {/* YouTube CLI Input */}
    {onYouTubeSubmit && (
      <form onSubmit={handleYouTubeSubmit} className="mt-4 flex items-center gap-2 bg-black border border-gray-700 rounded-md p-2 w-full max-w-2xl shadow-inner">
        <span className="text-orange-500 font-mono text-sm pl-2 select-none">&gt;_</span>
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="Enter YouTube URL to extract..."
          disabled={isYoutubeLoading}
          className="flex-1 bg-transparent border-none outline-none text-gray-200 font-mono text-sm px-2 focus:ring-0 placeholder-gray-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isYoutubeLoading || !youtubeUrl.trim()}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-orange-500 font-mono text-xs px-4 py-1.5 rounded transition-colors border border-gray-700 font-bold tracking-widest uppercase"
        >
          {isYoutubeLoading ? 'SYNCING...' : 'EXECUTE'}
        </button>
      </form>
    )}
    
    {isYoutubeLoading && (
      <div className="mt-2 text-green-500 font-mono text-xs animate-pulse">
        {youtubeLoadingText}
      </div>
    )}

    {youtubeError && !isYoutubeLoading && (
      <div className="mt-2 text-red-500 font-mono text-xs">
        {youtubeError}
      </div>
    )}

  </div>

  {/* Mobile Tab Toggle (Visible only on mobile) */}
  <div className="flex lg:hidden w-full bg-gray-900 p-1 rounded-lg mb-4 border border-gray-800">
    <button 
      onClick={() => setMobileTab('chat')}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mobileTab === 'chat' ? 'bg-black text-white shadow' : 'text-gray-400'}`}
    >
      &gt;_ console
    </button>
    <button 
      onClick={() => setMobileTab('studio')}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mobileTab === 'studio' ? 'bg-black text-white shadow' : 'text-gray-400'}`}
    >
      The Studio
    </button>
  </div>

  {/* Split Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-[70vh] lg:h-[calc(100vh-250px)]">
    
    {/* Chat Pane (Hidden on mobile if Studio is active) */}
    <div className={`lg:col-span-7 flex-col h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-lg ${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex`}>
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-black/40">
        <span className="font-mono text-sm font-bold text-orange-500">&gt;_ console</span>
        <button onClick={onExit} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1">Exit Workspace</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {chatMessages.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%] break-words whitespace-pre-wrap">
            Acknowledged. I am &gt;_console. Ask me anything about your uploaded materials.
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className={`group relative rounded-lg p-3 text-sm w-fit max-w-[85%] break-words ${msg.role === 'user' ? 'bg-orange-900/30 border border-orange-800/50 ml-auto text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:bg-black prose-pre:border prose-pre:border-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>

              {/* Hover Action Bar */}
              <div className={`absolute ${msg.role === 'user' ? '-bottom-3 right-0' : '-bottom-3 left-0'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-sm p-1 rounded-md border border-gray-700 flex gap-1 z-10 shadow-lg`}>
                {msg.role === 'user' ? (
                  <button onClick={() => setChatInput && setChatInput(msg.text)} className="p-1.5 hover:bg-gray-800 rounded transition-colors" title="Edit Message">
                    <Pencil className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                ) : (
                  <>
                    <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'like' ? undefined : 'like'}))} className="p-1.5 hover:bg-gray-800 rounded transition-colors" title="Helpful">
                      <ThumbsUp className={`w-4 h-4 ${feedback[i] === 'like' ? 'text-green-500' : 'text-gray-400 hover:text-white'}`} />
                    </button>
                    <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'dislike' ? undefined : 'dislike'}))} className="p-1.5 hover:bg-gray-800 rounded transition-colors" title="Not Helpful">
                      <ThumbsDown className={`w-4 h-4 ${feedback[i] === 'dislike' ? 'text-red-500' : 'text-gray-400 hover:text-white'}`} />
                    </button>
                    {onRetry && i === chatMessages.length - 1 && (
                      <button onClick={onRetry} className="p-1.5 hover:bg-gray-800 rounded transition-colors" title="Retry Generation">
                        <RefreshCcw className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Dynamic Progress Indicator */}
      {isChatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-orange-500 font-mono animate-pulse shrink-0">
          <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
          <ProgressText />
        </div>
      )}

      {/* Chat Error Banner */}
      {chatError && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-red-400">
            <span className="font-semibold block mb-0.5">AI Error Encountered</span>
            {getFriendlyErrorMessage(chatError)}
          </div>
        </div>
      )}

      <div className="p-3 bg-black border-t border-gray-800 shrink-0">
        {isAssimilating ? (
          <div className="flex items-center justify-center gap-3 w-full bg-gray-900 border border-orange-500/50 rounded-lg px-4 py-3 min-h-[46px]">
            <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-sm font-mono text-orange-400 animate-pulse">{assimilationStatus || 'Assimilating document content...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <textarea
              id="chat-textarea"
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                  e.currentTarget.style.height = 'auto';
                }
              }}
              placeholder="Ask a question..." 
              rows={1}
              className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none overflow-y-auto"
              style={{ minHeight: '46px', maxHeight: '150px' }}
            />
            <button 
              onClick={() => {
                onSendMessage();
                const el = document.getElementById('chat-textarea');
                if (el) el.style.height = 'auto';
              }} 
              className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-4 py-3 flex items-center justify-center transition-colors"
            >
              ➔
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Studio Pane (Hidden on mobile if Chat is active) */}
    <div className={`lg:col-span-5 flex-col h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 shadow-lg overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${mobileTab === 'studio' ? 'flex' : 'hidden'} lg:flex`}>
      <h2 className="text-xl font-bold mb-5 text-white">The Studio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group">
          <span className="text-xl group-hover:scale-110 transition-transform">🎧</span>
          <span className="text-sm font-medium text-gray-200">Audio Overview</span>
        </button>
        <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group">
          <span className="text-xl group-hover:scale-110 transition-transform">🗂️</span>
          <span className="text-sm font-medium text-gray-200">Flashcards</span>
        </button>
        <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group">
          <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
          <span className="text-sm font-medium text-gray-200">Mock Exam</span>
        </button>
        <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl text-left group">
          <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
          <span className="text-sm font-medium text-gray-200">Slide Deck</span>
        </button>
      </div>
    </div>
  </div>
</div>
);
}
