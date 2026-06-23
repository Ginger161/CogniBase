import React from 'react';

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
}

export default function CommandCenterUI({
title = "Untitled Workspace",
activeSources = [],
onRemoveSource = () => {},
onAddSource = () => {},
onExit = () => {},
chatMessages = [],
chatInput = "",
setChatInput = () => {},
onSendMessage = () => {}
}: CommandCenterUIProps) {
return (
<div className="w-full flex flex-col h-full">
  {/* Header */}
  <div className="mb-6 w-full">
    <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
      {title} <span className="text-gray-500 text-sm cursor-pointer hover:text-white">✎</span>
    </h1>
    <p className="text-gray-400 text-sm mb-4">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
    
    {/* Chips */}
    <div className="flex flex-wrap items-center gap-3">
      {activeSources.map((source, idx) => (
        <div key={source.id || idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-sm rounded-lg border border-gray-700 shadow-sm">
          <span className="truncate max-w-[200px]">{source.title}</span>
          <button onClick={() => onRemoveSource(source.id)} className="text-gray-500 hover:text-white">✕</button>
        </div>
      ))}
      <button onClick={onAddSource} className="px-4 py-1.5 text-sm font-medium text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-colors">
        + Add Source
      </button>
    </div>
  </div>

  {/* Split Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-h-[600px] lg:h-[calc(100vh-250px)]">
    
    {/* Chat Pane */}
    <div className="lg:col-span-7 flex flex-col h-[60vh] lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-black/40">
        <span className="font-mono text-sm font-bold text-orange-500">&gt;_ console</span>
        <button onClick={onExit} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1">Exit Workspace</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {chatMessages.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%]">
            Acknowledged. I am &gt;_console. Ask me anything about your uploaded materials.
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm w-fit max-w-[85%] ${msg.role === 'user' ? 'bg-orange-900/30 border border-orange-800/50 ml-auto text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
              {msg.text}
            </div>
          ))
        )}
      </div>
      <div className="p-3 bg-black border-t border-gray-800 shrink-0">
        <div className="flex items-center gap-2 w-full">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendMessage()}
            placeholder="Ask a question..." 
            className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500" 
          />
          <button onClick={onSendMessage} className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-4 py-3 flex items-center justify-center transition-colors">➔</button>
        </div>
      </div>
    </div>

    {/* Studio Pane */}
    <div className="lg:col-span-5 flex flex-col h-auto lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 shadow-lg overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
