import React from 'react';
import { Pencil } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  type: string;
  content: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  feedback?: 'up' | 'down';
  type?: string;
}

interface CommandCenterUIProps {
  activeWorkspaceName: string;
  setActiveWorkspaceName: (name: string) => void;
  activeSources: Source[];
  setActiveSources: React.Dispatch<React.SetStateAction<Source[]>>;
  setIsAddSourceModalOpen: (isOpen: boolean) => void;
  messages: Message[];
  userData: { name: string };
  isQuerying: boolean;
  consoleInput: string;
  setConsoleInput: (input: string) => void;
  handleQueryConsole: (e: React.FormEvent) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (val: boolean) => void;
  newTitle: string;
  setNewTitle: (val: string) => void;
  handleRenameDocument: () => void;
}

export default function CommandCenterUI({
  activeWorkspaceName,
  setActiveWorkspaceName,
  activeSources,
  setActiveSources,
  setIsAddSourceModalOpen,
  messages,
  userData,
  isQuerying,
  consoleInput,
  setConsoleInput,
  handleQueryConsole,
  isEditingTitle,
  setIsEditingTitle,
  newTitle,
  setNewTitle,
  handleRenameDocument
}: CommandCenterUIProps) {
  return (
    <div className="w-full flex flex-col h-full">
      {/* Header */}
      <div className="mb-6 w-full">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRenameDocument}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameDocument(); }}
              autoFocus
              className="text-2xl md:text-3xl font-bold bg-transparent text-white border border-orange-500 outline-none rounded-lg px-2 w-full max-w-[600px]"
            />
          </div>
        ) : (
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            {activeWorkspaceName} 
            <span 
              className="text-gray-500 text-sm cursor-pointer hover:text-white"
              onClick={() => setIsEditingTitle(true)}
            >
              <Pencil size={16} />
            </span>
          </h1>
        )}
        <p className="text-gray-400 text-sm mb-4">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
        
        {/* Chips */}
        <div className="flex flex-wrap items-center gap-3">
          {activeSources.map(source => (
            <div key={source.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-sm rounded-lg border border-gray-700 shadow-sm">
              <span className="truncate max-w-[200px]" title={source.title}>{source.title}</span>
              <button onClick={() => setActiveSources(prev => prev.filter(s => s.id !== source.id))} className="text-gray-500 hover:text-white">✕</button>
            </div>
          ))}
          <button onClick={() => setIsAddSourceModalOpen(true)} className="px-4 py-1.5 text-sm font-medium text-orange-500 border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-colors">
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
            <button onClick={() => { setActiveSources([]); setActiveWorkspaceName("Untitled Workspace"); }} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors">Exit Workspace</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className={`font-bold text-xs ${msg.role === 'user' ? 'text-gray-500' : 'text-orange-500'}`}>
                  {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                </span>
                <div className={`rounded-lg p-3 text-sm max-w-[85%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-gray-900 border border-gray-800 text-gray-300 w-fit'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isQuerying && (
              <div className="flex flex-col gap-2 items-start">
                <span className="font-bold text-xs text-orange-500">&gt;_console</span>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%]">
                  Thinking...
                </div>
              </div>
            )}
            {messages.length === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 w-fit max-w-[85%]">
                Acknowledged. I am &gt;_console. Ask me anything about your uploaded materials.
              </div>
            )}
          </div>
          
          <div className="p-3 bg-black border-t border-gray-800 shrink-0">
            <form className="flex items-center gap-2 w-full" onSubmit={(e) => {
              e.preventDefault();
              if (!consoleInput.trim()) return;
              handleQueryConsole(e);
            }}>
              <input 
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                type="text" 
                placeholder="Ask a question..." 
                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500" 
              />
              <button type="submit" disabled={isQuerying} className="shrink-0 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg px-4 py-3 flex items-center justify-center transition-colors">➔</button>
            </form>
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
