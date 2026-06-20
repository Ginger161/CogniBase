const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace the Header's Source Chips Block
const headerChipsRegex = /\{\/\* Source Chips \*\/\}[\s\S]*?<\/div>/;
const newHeaderChips = `{/* Source Chips */}
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
                  </div>`;
content = content.replace(headerChipsRegex, newHeaderChips);

// 2. Replace the Active Workspace Layout Block
const workspaceLayoutRegex = /<div className="flex flex-col lg:flex-row w-full gap-6 h-auto lg:h-\[calc\(100vh-200px\)\]">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newWorkspaceLayout = `<div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-6 h-auto lg:h-[calc(100vh-200px)]">

                {/* Left Pane: Chat */}
                <div className="lg:col-span-7 flex flex-col h-[60vh] lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-black/40">
                    <span className="font-mono text-sm font-bold text-orange-500">&gt;_ console</span>
                    <button onClick={() => { setActiveSources([]); setActiveWorkspaceName("Untitled Workspace"); }} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors">Exit Workspace</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {messages.map((msg, i) => (
                      <div key={i} className={\`flex flex-col gap-2 \${msg.role === 'user' ? 'items-end' : 'items-start'}\`}>
                        <span className={\`font-bold text-xs \${msg.role === 'user' ? 'text-gray-500' : 'text-orange-500'}\`}>
                          {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                        </span>
                        <div className={\`rounded-lg p-3 text-sm max-w-[85%] whitespace-pre-wrap \${msg.role === 'user' ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-gray-900 border border-gray-800 text-gray-300 w-fit'}\`}>
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
                      <button type="submit" disabled={isQuerying} className="shrink-0 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg px-4 py-3 transition-colors">➔</button>
                    </form>
                  </div>
                </div>

                {/* Right Pane: The Studio */}
                <div className="lg:col-span-5 flex flex-col h-auto lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 shadow-lg overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <h2 className="text-xl font-bold mb-5 text-white">The Studio</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🎧</span>
                      <span className="text-sm font-medium text-gray-200">Audio Overview</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🗂️</span>
                      <span className="text-sm font-medium text-gray-200">Flashcards</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
                      <span className="text-sm font-medium text-gray-200">Mock Exam</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                      <span className="text-sm font-medium text-gray-200">Slide Deck</span>
                    </button>
                  </div>
                </div>

              </div>`;

content = content.replace(workspaceLayoutRegex, newWorkspaceLayout);
fs.writeFileSync(path, content, 'utf8');
console.log("Tailwind UI replacement successful.");
