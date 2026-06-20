const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace the Header's old subtitle and chips block with the new strict chips implementation.
const headerBlockRegex = /<p className="text-sm md:text-base text-\[#A1A1AA\] mt-2">Active Workspace loaded[\s\S]*?<\/div>/;
const newHeaderBlock = `<p className="text-sm md:text-base text-[#A1A1AA] mt-2 mb-4">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
                  
                  {/* Source Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSources.map(source => (
                      <div key={source.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-sm rounded-full border border-gray-700">
                        <span className="truncate max-w-[200px]" title={source.title}>{source.title}</span>
                        <button onClick={() => setActiveSources(prev => prev.filter(s => s.id !== source.id))} className="text-gray-500 hover:text-white">✕</button>
                      </div>
                    ))}
                    <button onClick={() => setIsAddSourceModalOpen(true)} className="px-4 py-1.5 text-sm text-orange-500 border border-orange-500 rounded-full hover:bg-orange-500 hover:text-white transition-colors">
                      + Add Source
                    </button>
                  </div>`;
content = content.replace(headerBlockRegex, newHeaderBlock);

// 2. Replace the ENTIRE Split Pane Wrapper and children.
const splitPaneRegex = /<div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-6 h-auto lg:h-\[calc\(100vh-200px\)\]">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newSplitPane = `{/* STRICT SIDE-BY-SIDE LAYOUT */}
              <div className="flex flex-col lg:flex-row w-full gap-6 h-auto lg:h-[calc(100vh-200px)]">

                {/* Left Pane: Chat (65% width on desktop) */}
                <div className="w-full lg:w-[65%] flex flex-col h-[60vh] lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden relative">
                  <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50">
                    <div className="font-mono text-sm text-orange-500 font-bold">
                      &gt;_ console
                    </div>
                    <button onClick={() => { setActiveSources([]); setActiveWorkspaceName("Untitled Workspace"); }} className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1 rounded-full transition-colors">
                      Exit Workspace
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-6">
                    {messages.map((msg, i) => (
                      <div key={i} className={\`flex flex-col gap-2 \${msg.role === 'user' ? 'items-end' : 'items-start'}\`}>
                        <span className={\`font-bold text-xs \${msg.role === 'user' ? 'text-gray-500' : 'text-orange-500'}\`}>
                          {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                        </span>
                        <div className={\`p-4 rounded-lg text-sm max-w-[90%] whitespace-pre-wrap \${msg.role === 'user' ? 'bg-gray-800/50 border border-gray-700 text-gray-300' : 'bg-gray-900/50 border border-gray-800 text-gray-300'}\`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isQuerying && (
                      <div className="flex flex-col gap-2 items-start">
                        <span className="font-bold text-xs text-orange-500">&gt;_console</span>
                        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-sm text-gray-300">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full p-4 bg-black border-t border-gray-800 shrink-0">
                    <form className="flex gap-2 w-full" onSubmit={(e) => {
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
                      <button type="submit" disabled={isQuerying} className="shrink-0 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg px-6 py-3 font-bold transition-colors">➔</button>
                    </form>
                  </div>
                </div>

                {/* Right Pane: The Studio (35% width on desktop) */}
                <div className="w-full lg:w-[35%] flex flex-col h-auto lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <h2 className="text-xl font-bold mb-6 text-white">The Studio</h2>
                  
                  {/* Studio Buttons Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🎧</span>
                      <span className="text-sm font-semibold text-gray-200">Audio Overview</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🎥</span>
                      <span className="text-sm font-semibold text-gray-200">Video Overview</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🗂️</span>
                      <span className="text-sm font-semibold text-gray-200">Flashcards</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🧠</span>
                      <span className="text-sm font-semibold text-gray-200">Mock Exam</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                      <span className="text-sm font-semibold text-gray-200">Slide Deck</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">🗺️</span>
                      <span className="text-sm font-semibold text-gray-200">Infographic</span>
                    </button>
                    <button className="flex flex-col items-start gap-2 p-4 bg-gray-900 border border-gray-800 hover:border-orange-500 rounded-xl transition-all text-left group">
                      <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
                      <span className="text-sm font-semibold text-gray-200">Reports</span>
                    </button>
                  </div>
                </div>

              </div>`;

content = content.replace(splitPaneRegex, newSplitPane);
fs.writeFileSync(path, content, 'utf8');
console.log("Final overwrite successful.");
