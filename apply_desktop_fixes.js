const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add hide-scrollbar to global style
const oldStyle = /.dashboard-layout \{ display: flex;/;
const newStyle = `.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .dashboard-layout { display: flex;`;
content = content.replace(oldStyle, newStyle);

// 2. Add Sources Chips to Header
const subtitleRegex = /<p className="text-sm md:text-base text-\[#A1A1AA\] mt-2">Active Workspace loaded\. Chat with your tutor or generate study tools\.<\/p>/;
const sourcesChips = `<p className="text-sm md:text-base text-[#A1A1AA] mt-2">Active Workspace loaded. Chat with your tutor or generate study tools.</p>
                  
                  <div className="flex flex-wrap gap-2 mt-4 items-center">
                    {activeSources.map(source => (
                      <div key={source.id} className="flex items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-full px-3 py-1 text-sm text-gray-300">
                        <span className="truncate max-w-[150px]" title={source.title}>{source.title}</span>
                        <button onClick={() => setActiveSources(prev => prev.filter(s => s.id !== source.id))} className="text-gray-500 hover:text-white">&times;</button>
                      </div>
                    ))}
                    <button onClick={() => setIsAddSourceModalOpen(true)} className="flex items-center gap-1 border border-[#EA580C] text-[#EA580C] rounded-full px-3 py-1 text-sm hover:bg-[#EA580C] hover:text-white transition-colors">+ Add Source</button>
                  </div>`;
content = content.replace(subtitleRegex, sourcesChips);

// 3. Remove Source Sidebar Container and update Split Wrapper
const sidebarRegex = /<div className="w-full lg:w-\[250px\] bg-\[#111111\] rounded-xl border border-\[#27272A\] p-4 flex flex-col gap-4 flex-shrink-0">[\s\S]*?<\/div>\s*<\/div>\s*<button onClick=\{\(\) => setIsAddSourceModalOpen\(true\)\}[\s\S]*?<\/button>\s*<\/div>/;
content = content.replace(sidebarRegex, '');

// The split wrapper
const splitWrapperRegex = /<div className="w-full flex flex-col lg:flex-row gap-6 md:gap-8 h-full">/;
content = content.replace(splitWrapperRegex, `<div className="flex flex-col lg:flex-row w-full gap-6 h-[calc(100vh-200px)]">`);

// 4. Update Chat (Left Pane) Wrapper
const chatWrapperRegex = /<div className="w-full lg:flex-1 bg-\[#111111\] rounded-xl border border-\[#27272A\] flex flex-col overflow-hidden min-h-\[500px\]">/;
content = content.replace(chatWrapperRegex, `<div className="w-full lg:w-2/3 flex flex-col h-full bg-[#111111] rounded-xl border border-[#27272A] overflow-hidden">`);

// 5. Update Chat Scrollbar container
const chatScrollRegex = /<div style=\{\{ flex: 1, padding: '1\.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1\.5rem' \}\}>/;
content = content.replace(chatScrollRegex, `<div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 hide-scrollbar">`);

// 6. Update Studio (Right Pane) Wrapper
const studioWrapperRegex = /<div className="w-full lg:w-\[350px\] flex flex-col gap-6 overflow-hidden box-border flex-shrink-0">/;
content = content.replace(studioWrapperRegex, `<div className="w-full lg:w-1/3 flex flex-col h-full overflow-y-auto">`);

fs.writeFileSync(path, content, 'utf8');
console.log("Desktop fixes applied.");
