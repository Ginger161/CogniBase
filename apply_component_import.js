const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add the import statement if not exists
if (!content.includes('import CommandCenterUI')) {
  content = content.replace(
    /import \{ useUserContext \} from '\.\.\/\.\.\/\.\.\/lib\/hooks\/useUserContext';/,
    `import { useUserContext } from '../../../lib/hooks/useUserContext';\nimport CommandCenterUI from '../../../components/CommandCenterUI';`
  );
}

// 1. Replace the Header block
const headerRegex = /<header style=\{\{ borderBottom: '1px solid #27272A', padding: '1\.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' \}\}>[\s\S]*?<\/header>/;

const newHeader = `{activeSources.length === 0 && (
            <header style={{ borderBottom: '1px solid #27272A', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>Command Center</h1>
                <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Initialize and monitor your study engines.</p>
              </div>
            </header>
          )}`;

content = content.replace(headerRegex, newHeader);

// 2. Replace the Active Workspace inline layout
const layoutRegex = /<div className="grid grid-cols-1 lg:grid-cols-12 w-full gap-6 h-auto lg:h-\[calc\(100vh-200px\)\]">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const componentCall = `<CommandCenterUI
                activeWorkspaceName={activeWorkspaceName || "Untitled Workspace"}
                setActiveWorkspaceName={setActiveWorkspaceName}
                activeSources={activeSources}
                setActiveSources={setActiveSources}
                setIsAddSourceModalOpen={setIsAddSourceModalOpen}
                messages={messages}
                userData={userData}
                isQuerying={isQuerying}
                consoleInput={consoleInput}
                setConsoleInput={setConsoleInput}
                handleQueryConsole={handleQueryConsole}
                isEditingTitle={isEditingTitle}
                setIsEditingTitle={setIsEditingTitle}
                newTitle={newTitle}
                setNewTitle={setNewTitle}
                handleRenameDocument={handleRenameDocument}
              />`;

content = content.replace(layoutRegex, componentCall);

fs.writeFileSync(path, content, 'utf8');
console.log("Component successfully extracted and imported.");
