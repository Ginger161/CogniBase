const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Ensure max-w-[100vw] on parent
content = content.replace(
  /<main className="main-content" style=\{\{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', overflowX: 'hidden' \}\}>/,
  `<main className="main-content max-w-[100vw]" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', overflowX: 'hidden' }}>`
);

// 2. Split Pane Layout Wrapper
content = content.replace(
  /<div className="grid grid-cols-1 lg:grid-cols-3 w-full gap-6 h-\[calc\(100vh-200px\)\]">/,
  `<div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-6 h-auto lg:h-[calc(100vh-200px)]">`
);

// 3. Left Pane Chat Wrapper
content = content.replace(
  /<div className="w-full lg:col-span-2 flex flex-col h-full bg-\[#111111\] rounded-xl border border-\[#27272A\] overflow-hidden">/,
  `<div className="w-full lg:col-span-7 flex flex-col h-[60vh] lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden relative">`
);

// 4. Chat Input Fix
const oldChatInput = /<div style=\{\{ padding: '1rem', borderTop: '1px solid #27272A', backgroundColor: '#09090B' \}\}>[\s\S]*?<\/div>/;
const newChatInput = `<div className="w-full p-3 bg-[#0a0a0a] border-t border-gray-800 shrink-0">
                    <form className="flex items-center gap-2 w-full" onSubmit={(e) => {
                       e.preventDefault();
                       if (!consoleInput.trim()) return;
                       handleQueryConsole(e);
                    }}>
                      <input
                        value={consoleInput}
                        onChange={(e) => setConsoleInput(e.target.value)}
                        type="text"
                        placeholder="Ask a question about your sources..."
                        className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                      <button type="submit" disabled={isQuerying} className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white rounded-lg p-3 px-4 flex items-center justify-center font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                        →
                      </button>
                    </form>
                  </div>`;
content = content.replace(oldChatInput, newChatInput);

// 5. Replace Entire Studio Wrapper and Grid
const oldStudio = /<div className="w-full lg:col-span-1 flex flex-col h-full overflow-y-auto">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const newStudio = `<div className="w-full lg:col-span-5 flex flex-col h-auto lg:h-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4 text-white">The Studio</h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🎧</span>
                      <span className="text-sm font-medium text-gray-200">Audio Overview</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🎥</span>
                      <span className="text-sm font-medium text-gray-200">Video Overview</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">📇</span>
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
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">🗺️</span>
                      <span className="text-sm font-medium text-gray-200">Infographic</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 rounded-xl transition-all text-left group">
                      <span className="text-xl group-hover:scale-110 transition-transform">📝</span>
                      <span className="text-sm font-medium text-gray-200">Reports</span>
                    </button>
                  </div>
                </div>`;
content = content.replace(oldStudio, newStudio);

fs.writeFileSync(path, content, 'utf8');
console.log("Mobile layout fixes applied via Tailwind.");
