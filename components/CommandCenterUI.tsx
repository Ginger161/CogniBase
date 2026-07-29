'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown, Headphones, Layers, Network, Presentation, X, Wrench } from 'lucide-react';
import FlashcardViewer from './FlashcardViewer';
import MermaidViewer from './MermaidViewer';
import PresentationViewer from './PresentationViewer';
import StudioAssetsPanel from './StudioAssetsPanel';

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
  isWorkspaceReady?: boolean;
  workspaceId?: string;
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
  onYouTubeSubmit,
  isWorkspaceReady = true,
  workspaceId = ""
}: CommandCenterUIProps) {
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [feedback, setFeedback] = useState<Record<number, 'like' | 'dislike' | undefined>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
  const [youtubeLoadingText, setYoutubeLoadingText] = useState(">_ Bypassing mainframe... scraping captions [     ]");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

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

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && tempTitle !== title) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  const sourcesContent = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(isExpanded ? activeSources : activeSources.slice(0, 3)).map((source: any, idx) => (
          <div key={source.id || idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-900 text-gray-200 text-xs rounded-lg border border-gray-700">
            <span className="truncate max-w-[160px]">{source.title || source.name || source.url || 'Untitled Document'}</span>
            <button onClick={() => onRemoveSource(source.id)} className="text-gray-500 hover:text-white">✕</button>
          </div>
        ))}

        {!isExpanded && activeSources.length > 3 && (
          <button onClick={() => setIsExpanded(true)} className="px-2.5 py-1.5 bg-gray-800 text-gray-300 text-xs rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors">
            + {activeSources.length - 3} more
          </button>
        )}

        {isExpanded && activeSources.length > 3 && (
          <button onClick={() => setIsExpanded(false)} className="px-2.5 py-1.5 bg-gray-800 text-gray-300 text-xs rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors">
            Show less
          </button>
        )}

        {activeSources.length < 10 && (
          <button onClick={onAddSource} className="px-2.5 py-1.5 text-xs font-medium text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-colors">
            + Add Source
          </button>
        )}
      </div>

      {onYouTubeSubmit && (
        <form onSubmit={handleYouTubeSubmit} className="flex items-center gap-2 bg-black border border-gray-700 rounded-md p-2">
          <span className="text-orange-500 font-mono text-xs pl-1 select-none">&gt;_</span>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder={isWorkspaceReady ? "YouTube URL..." : "Initializing..."}
            disabled={isYoutubeLoading || !isWorkspaceReady}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-200 font-mono text-xs px-1 focus:ring-0 placeholder-gray-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isYoutubeLoading || !youtubeUrl.trim() || !isWorkspaceReady}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-orange-500 font-mono text-[10px] px-2 py-1.5 rounded transition-colors border border-gray-700 font-bold tracking-widest uppercase shrink-0"
          >
            {isYoutubeLoading ? '...' : 'GO'}
          </button>
        </form>
      )}
      {isYoutubeLoading && <div className="text-green-500 font-mono text-[10px] animate-pulse">{youtubeLoadingText}</div>}
      {youtubeError && !isYoutubeLoading && <div className="text-red-500 font-mono text-[10px]">{youtubeError}</div>}
    </div>
  );

  const generateContent = (
    <div className="grid grid-cols-2 gap-2">
      <button className="flex flex-col items-center gap-1.5 p-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-lg group text-center">
        <Headphones className="w-4 h-4 text-gray-300 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-medium text-gray-200">Audio Podcast</span>
      </button>
      <button onClick={() => setShowFlashcards(true)} className="flex flex-col items-center gap-1.5 p-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-lg group text-center">
        <Layers className="w-4 h-4 text-gray-300 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-medium text-gray-200">Flashcards</span>
      </button>
      <button onClick={() => setShowMindMap(true)} className="flex flex-col items-center gap-1.5 p-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-lg group text-center">
        <Network className="w-4 h-4 text-gray-300 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-medium text-gray-200">Mind Map</span>
      </button>
      <button onClick={() => setShowPresentation(true)} className="flex flex-col items-center gap-1.5 p-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-lg group text-center">
        <Presentation className="w-4 h-4 text-gray-300 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-medium text-gray-200">PowerPoint</span>
      </button>
    </div>
  );

  return (
    <div className="w-full flex flex-col h-full min-h-0 relative gap-3 sm:gap-4">
      {showFlashcards && <FlashcardViewer workspaceId={workspaceId} onClose={() => setShowFlashcards(false)} />}
      {showMindMap && <MermaidViewer workspaceId={workspaceId} onClose={() => setShowMindMap(false)} />}
      {showPresentation && <PresentationViewer workspaceId={workspaceId} onClose={() => setShowPresentation(false)} />}

      {/* Header */}
      <div className="w-full shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isEditingTitle ? (
            <input
              autoFocus
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 bg-transparent border-b-2 border-orange-500 focus:outline-none w-full max-w-md text-white"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 flex items-center gap-2 cursor-pointer hover:text-gray-300 transition-colors group w-fit truncate"
            >
              <span className="truncate">{tempTitle}</span>
              <span className="text-gray-600 text-lg group-hover:text-orange-500 transition-colors shrink-0">✎</span>
            </h1>
          )}
          <p className="hidden sm:block text-gray-400 text-sm">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
        </div>

        {/* Mobile-only tools trigger */}
        <button
          onClick={() => setShowMobileTools(true)}
          className="sm:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs font-medium text-orange-500"
        >
          <Wrench className="w-3.5 h-3.5" />
          Tools
        </button>
      </div>

      {/* Desktop tiles — unchanged, hidden on mobile */}
      <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4 w-full shrink-0">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 flex flex-col gap-3 max-h-[240px] overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">Sources</h3>
          {sourcesContent}
        </div>
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 flex flex-col gap-3 max-h-[240px] overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">Generate</h3>
          {generateContent}
        </div>
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 flex flex-col gap-3 max-h-[240px] overflow-hidden">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">Studio assets</h3>
          <div className="flex-1 overflow-y-auto min-h-0">
            <StudioAssetsPanel workspaceId={workspaceId} />
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet for tools */}
      {showMobileTools && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
          onClick={() => setShowMobileTools(false)}
        >
          <div
            className="bg-[#0a0a0a] border-t border-gray-800 rounded-t-2xl max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-white">Workspace tools</h2>
              <button onClick={() => setShowMobileTools(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Sources</h3>
              {sourcesContent}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Generate</h3>
              {generateContent}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Studio assets</h3>
              <StudioAssetsPanel workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      )}

      {/* Chat, full width, fills the remaining space */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-2 sm:p-3 border-b border-gray-800 flex justify-between items-center bg-black/40 shrink-0">
          <span className="font-mono text-sm font-bold text-orange-500">&gt;_ console</span>
          <button onClick={onExit} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1">Exit Workspace</button>
        </div>
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {chatMessages.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%] break-words whitespace-pre-wrap">
              Acknowledged. I am &gt;_console. Ask me anything about your uploaded materials.
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`group flex flex-col ${msg.role === 'user' ? 'items-end ml-auto' : 'items-start'} max-w-[85%] w-fit`}>
                <div className={`relative rounded-lg p-3 text-sm break-words w-full ${msg.role === 'user' ? 'bg-orange-900/30 border border-orange-800/50 text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:leading-relaxed prose-pre:bg-black prose-pre:border prose-pre:border-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>

                <div className={`flex gap-2 mt-1 text-sm text-gray-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                  {msg.role === 'user' ? (
                    <button onClick={() => setChatInput && setChatInput(msg.text)} className="p-1 hover:text-white transition-colors" title="Edit Message">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'like' ? undefined : 'like'}))} className="p-1 hover:text-white transition-colors" title="Helpful">
                        <ThumbsUp className={`w-3.5 h-3.5 ${feedback[i] === 'like' ? 'text-green-500' : ''}`} />
                      </button>
                      <button onClick={() => setFeedback(prev => ({...prev, [i]: prev[i] === 'dislike' ? undefined : 'dislike'}))} className="p-1 hover:text-white transition-colors" title="Not Helpful">
                        <ThumbsDown className={`w-3.5 h-3.5 ${feedback[i] === 'dislike' ? 'text-red-500' : ''}`} />
                      </button>
                      {onRetry && i === chatMessages.length - 1 && (
                        <button onClick={onRetry} className="p-1 hover:text-white transition-colors" title="Retry Generation">
                          <RefreshCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {isChatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' && (
          <div className="px-4 py-2 flex items-center gap-2 text-xs text-orange-500 font-mono animate-pulse shrink-0">
            <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
            <ProgressText />
          </div>
        )}

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

        <div className="p-2 sm:p-3 bg-black border-t border-gray-800 shrink-0">
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
                disabled={!isWorkspaceReady || isChatLoading}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                }}
                onFocus={(e) => {
                  setTimeout(() => e.target.scrollIntoView({ block: 'end', behavior: 'smooth' }), 300);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage();
                    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(console.error);
                    e.currentTarget.style.height = 'auto';
                  }
                }}
                placeholder={isWorkspaceReady ? "Ask a question..." : "Initializing workspace..."}
                rows={1}
                className={`flex-1 min-w-0 bg-gray-900 border ${chatError ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ minHeight: '46px', maxHeight: '150px' }}
              />
              <button
                disabled={!isWorkspaceReady || isChatLoading}
                onClick={() => {
                  onSendMessage();
                  fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'chat_message' }) }).catch(console.error);
                  const el = document.getElementById('chat-textarea');
                  if (el) el.style.height = 'auto';
                }}
                className="shrink-0 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg px-4 py-3 flex items-center justify-center transition-colors"
              >
                ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
