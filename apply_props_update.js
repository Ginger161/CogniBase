const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCallRegex = /<CommandCenterUI[\s\S]*?\/>/;

const newCall = `<CommandCenterUI
                title={activeWorkspaceName || "Untitled Workspace"}
                activeSources={activeSources}
                onRemoveSource={(id) => setActiveSources(prev => prev.filter(s => s.id !== id))}
                onAddSource={() => setIsAddSourceModalOpen(true)}
                onExit={() => { setActiveSources([]); setActiveWorkspaceName("Untitled Workspace"); }}
                chatMessages={messages.map(m => ({ role: m.role, text: m.content }))}
                chatInput={consoleInput}
                setChatInput={setConsoleInput}
                onSendMessage={() => {
                  if (!consoleInput.trim()) return;
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleQueryConsole(fakeEvent);
                }}
              />`;

content = content.replace(oldCallRegex, newCall);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated page.tsx call");
