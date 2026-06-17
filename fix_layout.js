const fs = require('fs');
let vault = fs.readFileSync('app/(app)/vault/page.tsx', 'utf8');
let guides = fs.readFileSync('app/(app)/study-guides/page.tsx', 'utf8');

// Vault Modals
vault = vault.replace(
  `style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}`,
  `className="w-full overflow-hidden px-4 sm:px-8 py-4 sm:py-8 break-words whitespace-normal" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}`
);

vault = vault.replace(
  `style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden' }}`,
  `className="w-full overflow-hidden break-words whitespace-normal" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}`
);

// File List
vault = vault.replace(
  `style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem' }}`,
  `className="w-full overflow-hidden px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem' }}`
);

vault = vault.replace(
  `style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n                            <div style={{ display: 'flex', flexDirection: 'column' }}>\n                              <span style={{ color: 'white', fontSize: '0.9rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</span>`,
  `className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-start sm:items-center w-full overflow-hidden">\n                            <div className="w-full overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>\n                              <span className="break-words whitespace-normal" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{file.fileName}</span>`
);

// Grid View file
vault = vault.replace(
  `style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem', position: 'relative' }}`,
  `className="w-full overflow-hidden px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem', position: 'relative' }}`
);

vault = vault.replace(
  `<span style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={file.fileName}>{file.fileName}</span>`,
  `<span className="break-words whitespace-normal" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={file.fileName}>{file.fileName}</span>`
);

// Chat bubbles
vault = vault.replace(
  /<div style={{ backgroundColor: msg\.role === 'user' \? '#EA580C' : '#27272A', color: 'white', padding: '0\.75rem 1rem', borderRadius: '1rem', borderBottomRightRadius: msg\.role === 'user' \? 0 : '1rem', borderBottomLeftRadius: msg\.role === 'ai' \? 0 : '1rem', maxWidth: '85%', fontSize: '0\.9rem', lineHeight: '1\.4', display: 'flex', flexDirection: 'column', gap: '0\.5rem' }}>/g,
  `<div className="break-words whitespace-normal overflow-hidden" style={{ backgroundColor: msg.role === 'user' ? '#EA580C' : '#27272A', color: 'white', padding: '0.75rem 1rem', borderRadius: '1rem', borderBottomRightRadius: msg.role === 'user' ? 0 : '1rem', borderBottomLeftRadius: msg.role === 'ai' ? 0 : '1rem', maxWidth: '100%', fontSize: '0.9rem', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>`
);

// Console panel width
vault = vault.replace(
  `.console-panel { position: static; width: 400px; right: 0; transition: none; display: none; flex-shrink: 0; border-left: 1px solid #27272A; }`,
  `.console-panel { position: static; width: 100%; max-width: 400px; right: 0; transition: none; display: none; flex-shrink: 0; border-left: 1px solid #27272A; }`
);

// Vault Modal content padding fix
vault = vault.replace(
  `<div style={{ flex: 1, padding: '2rem', overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>`,
  `<div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>`
);

// Study Guides Page
guides = guides.replace(
  `style={{ backgroundColor: '#18181B', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }}`,
  `className="w-full overflow-hidden px-4 sm:px-6 py-4 sm:py-6 break-words whitespace-normal hover:border-orange-500 hover:-translate-y-1" style={{ backgroundColor: '#18181B', borderRadius: '0.75rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }}`
);

guides = guides.replace(
  `className="hover:border-orange-500 hover:-translate-y-1" onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}`,
  `onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }}`
);

guides = guides.replace(
  `<h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>`,
  `<h3 className="break-words whitespace-normal" style={{ margin: 0, color: 'white', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{guide.sectionConstraint}</h3>`
);

guides = guides.replace(
  `<span style={{ color: '#71717A', fontSize: '0.85rem' }}>{guide.sourceDocumentName}</span>`,
  `<span className="break-words whitespace-normal" style={{ color: '#71717A', fontSize: '0.85rem' }}>{guide.sourceDocumentName}</span>`
);

guides = guides.replace(
  `style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden' }}`,
  `className="w-full overflow-hidden break-words whitespace-normal" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}`
);

guides = guides.replace(
  `<h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>`,
  `<h3 className="break-words whitespace-normal" style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>`
);

guides = guides.replace(
  `<span style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>`,
  `<span className="break-words whitespace-normal" style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>`
);

guides = guides.replace(
  `<div style={{ flex: 1, padding: '2rem', overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>`,
  `<div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>`
);

fs.writeFileSync('app/(app)/vault/page.tsx', vault);
fs.writeFileSync('app/(app)/study-guides/page.tsx', guides);
console.log("Done");
