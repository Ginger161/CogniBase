const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'app/(app)/dashboard/page.tsx',
  'app/(app)/settings/page.tsx',
  'app/(app)/studio-assets/page.tsx',
  'app/(app)/study-guides/page.tsx',
  'app/(app)/vault/page.tsx'
];

filesToPatch.forEach(relPath => {
  const filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove Sidebar import
  content = content.replace(/import Sidebar from '.*?[S|s]idebar';?\n?/g, '');
  
  // 2. Remove isSidebarOpen state
  content = content.replace(/const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);?\n?/g, '');
  
  // 3. Remove style block
  content = content.replace(/<style dangerouslySetInnerHTML=\{\{\s*__html:\s*`[\s\S]*?`\s*\}\}\s*\/>/g, '');

  // 4. Remove overlay div entirely
  content = content.replace(/<div className=\{`overlay[^>]*><\/div>/g, '');
  
  // Also support the dashboard version of overlay (has onClick)
  content = content.replace(/<div className=\{`overlay[^>]*><\/div>/g, '');
  content = content.replace(/<div className=\{`overlay[^>]*><\/div>/g, ''); // Sometimes it's written differently, let's use a broader regex:
  content = content.replace(/<div className=\{`overlay[\s\S]*?><\/div>/g, '');

  // 5. Remove Sidebar element completely (including multiline props)
  content = content.replace(/<Sidebar[\s\S]*?\/>/g, '');

  // 6. Remove mobile header
  content = content.replace(/<div className="mobile-header">[\s\S]*?<\/div>/g, '');

  // 7. Simplify main wrapper or dashboard-layout wrapper if possible.
  content = content.replace(/className="dashboard-layout"/g, 'className="flex flex-col h-full w-full"');
  
  // vault-layout, settings-layout etc
  content = content.replace(/className="vault-layout"/g, 'className="flex flex-col h-full w-full"');
  content = content.replace(/className="settings-layout"/g, 'className="flex flex-col h-full w-full"');
  content = content.replace(/className="studio-layout"/g, 'className="flex flex-col h-full w-full"');
  content = content.replace(/className="study-guides-layout"/g, 'className="flex flex-col h-full w-full"');
  
  content = content.replace(/className="main-content[^"]*"/g, 'className="flex-1 flex flex-col h-full overflow-hidden p-6"');
  
  // Also strip inline styles from main tag that might conflict
  content = content.replace(/<main([^>]*) style=\{\{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', overflowX: 'hidden' \}\}/g, '<div$1');
  content = content.replace(/<\/main>/g, '</div>');
  content = content.replace(/<main/g, '<div');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${relPath}`);
});

console.log("Patching complete!");
