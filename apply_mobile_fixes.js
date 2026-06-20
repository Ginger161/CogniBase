const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Header Typography & Overflow
// activeWorkspaceName input
content = content.replace(
  /style=\{\{ fontSize: '2rem', margin: 0, letterSpacing: '-0\.05em', fontWeight: 'bold', backgroundColor: 'transparent', color: 'white', border: '1px solid #EA580C', outline: 'none', borderRadius: '0\.5rem', padding: '0 0\.5rem', width: '100%', maxWidth: '600px' \}\}/g,
  `className="text-2xl md:text-4xl font-bold break-words w-full max-w-[600px]" style={{ margin: 0, letterSpacing: '-0.05em', backgroundColor: 'transparent', color: 'white', border: '1px solid #EA580C', outline: 'none', borderRadius: '0.5rem', padding: '0 0.5rem' }}`
);

// activeWorkspaceName h1
content = content.replace(
  /<h1 style=\{\{ fontSize: '2rem', margin: 0, letterSpacing: '-0\.05em', display: 'flex', alignItems: 'center' \}\}>/g,
  `<h1 className="text-2xl md:text-4xl font-bold break-words flex items-center" style={{ margin: 0, letterSpacing: '-0.05em' }}>`
);

// Title subtitle
content = content.replace(
  /<p style=\{\{ color: '#A1A1AA', margin: '0\.5rem 0 0 0', fontSize: '1rem' \}\}>Active Workspace loaded/g,
  `<p className="text-sm md:text-base text-[#A1A1AA] mt-2">Active Workspace loaded`
);

// 2. Split-Pane Layout Wrapper
content = content.replace(
  /<div style=\{\{ display: 'flex', gap: '1\.5rem', height: '100%', flexDirection: 'row' \}\}>/g,
  `<div className="w-full flex flex-col lg:flex-row gap-6 md:gap-8 h-full">`
);

// 3. Source Sidebar Container
content = content.replace(
  /<div style=\{\{ width: '250px', backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' \}\}>/g,
  `<div className="w-full lg:w-[250px] bg-[#111111] rounded-xl border border-[#27272A] p-4 flex flex-col gap-4 flex-shrink-0">`
);

// 4. Console Panel (The Tutor) Wrapper
content = content.replace(
  /<div style=\{\{ flex: 1, backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', overflow: 'hidden' \}\}>/g,
  `<div className="w-full lg:flex-1 bg-[#111111] rounded-xl border border-[#27272A] flex flex-col overflow-hidden min-h-[500px]">`
);

// 5. The Studio Card Clipping
content = content.replace(
  /<div style=\{\{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1\.5rem' \}\}>/g,
  `<div className="w-full lg:w-[350px] flex flex-col gap-6 overflow-hidden box-border flex-shrink-0">`
);
content = content.replace(
  /<div style=\{\{ backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', padding: '1\.5rem', flex: 1, display: 'flex', flexDirection: 'column' \}\}>/g,
  `<div className="w-full bg-[#111111] rounded-xl border border-[#27272A] p-4 md:p-6 overflow-hidden box-border flex-1 flex flex-col">`
);

// 6. Responsive Grid for Studio Buttons
content = content.replace(
  /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.75rem', flex: 1, overflowY: 'auto' \}\}>/g,
  `<div className="grid grid-cols-2 gap-3 md:gap-4 flex-1 overflow-y-auto w-full">`
);

// Replace button inline styles to Tailwind
const buttonStyleRegex = /style=\{\{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0\.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0\.2s', outline: 'none' \}\}/g;
content = content.replace(buttonStyleRegex, `className="w-full flex items-center gap-2 bg-[#18181B] text-white border border-[#27272A] p-3 md:p-4 rounded-lg cursor-pointer text-left transition-all duration-200 outline-none hover:border-[#EA580C]"`);

// Remove inline mouseover handling since Tailwind takes care of it
const mouseOverRegex = /onMouseOver=\{e => e\.currentTarget\.style\.borderColor = '#EA580C'\} onMouseOut=\{e => e\.currentTarget\.style\.borderColor = '#27272A'\}/g;
content = content.replace(mouseOverRegex, '');

// 7. Ensure main content container prevents horizontal scroll
content = content.replace(
  /<main className="main-content" style=\{\{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' \}\}>/g,
  `<main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', overflowX: 'hidden' }}>`
);

fs.writeFileSync(path, content, 'utf8');
console.log("Mobile-first UI layouts applied via Tailwind.");
