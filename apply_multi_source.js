const fs = require('fs');
const path = 'c:/Users/HENRY/Documents/cognibase/app/(app)/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace State
const oldStateRegex = /const \[activeDocumentContext, setActiveDocumentContext\] = useState<string \| null>\(null\);\s*const \[activeDocumentId, setActiveDocumentId\] = useState<string \| null>\(null\);\s*const \[activeDocumentName, setActiveDocumentName\] = useState<string \| null>\(null\);/;

const newState = `const [activeSources, setActiveSources] = useState<Array<{ id: string, title: string, type: string, content: string }>>([]);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>("Untitled Workspace");
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [sourceModalView, setSourceModalView] = useState<'options' | 'website' | 'youtube' | 'text'>('options');
  const [sourceInputText, setSourceInputText] = useState("");
  const [isExtractingMock, setIsExtractingMock] = useState(false);
`;
content = content.replace(oldStateRegex, newState);

// 2. Add handleExtractSource Mock function
const submitQueryRegex = /const handleRenameDocument = async/;
const mockFunc = `
  const handleExtractSource = (type: string, inputTitle: string, rawContent?: string) => {
    setIsExtractingMock(true);
    setTimeout(() => {
      let extractedContent = "";
      if (type === 'pdf') extractedContent = rawContent || "Extracted text from newly uploaded file...";
      if (type === 'vault') extractedContent = rawContent || "Mock extracted text from vault file.";
      if (type === 'image') extractedContent = \`Mocked OCR text for \${inputTitle}\`;
      if (type === 'website') extractedContent = \`Mocked scraped text for \${inputTitle}\`;
      if (type === 'youtube') extractedContent = \`Mocked transcript for \${inputTitle}\`;
      if (type === 'text') extractedContent = rawContent || "Manual text input.";

      setActiveSources(prev => [...prev, {
        id: Date.now().toString(),
        title: inputTitle,
        type: type,
        content: extractedContent
      }]);
      
      setIsExtractingMock(false);
      setIsAddSourceModalOpen(false);
      setSourceModalView('options');
      setSourceInputText('');
    }, 1500);
  };

  const handleRenameDocument = async`;
content = content.replace(submitQueryRegex, mockFunc);

// 3. Update the submitQuery to concatenate activeSources
const oldSubmitQueryContext = /activeDocumentContext: activeDocumentContext,/;
const newSubmitQueryContext = `activeDocumentContext: activeSources.map(s => \`Source: \${s.title}\\n\${s.content}\`).join("\\n\\n---\\n\\n"),`;
content = content.replace(oldSubmitQueryContext, newSubmitQueryContext);

// 4. Clean up Header and other scalar references
content = content.replace(/!activeDocumentContext/g, 'activeSources.length === 0');
content = content.replace(/activeDocumentContext/g, 'activeSources.length > 0');
content = content.replace(/activeDocumentName/g, 'activeWorkspaceName');
content = content.replace(/setActiveDocumentName/g, 'setActiveWorkspaceName');
content = content.replace(/setActiveDocumentContext\(null\); setActiveDocumentId\(null\); setActiveWorkspaceName\(null\);/g, `setActiveSources([]); setActiveWorkspaceName("Untitled Workspace");`);

// 5. Replace the entire UI payload starting from `<div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>` up to the closing `</main>`
const uiRegex = /<div style=\{\{ flex: 1, overflowY: 'auto', padding: '1\.5rem' \}\}>[\s\S]*<\/main>/;

const newUI = `<div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {activeSources.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                <div style={{ textAlign: 'center', maxWidth: '600px' }}>
                  <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Unlock the Command Center</h2>
                  <p style={{ color: '#A1A1AA', fontSize: '1.1rem', lineHeight: '1.6' }}>Upload a document or select notes from your Vault to unlock the Command Center.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
                  <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Upload New Source</h3>
                    <div
                      onClick={() => setIsAddSourceModalOpen(true)}
                      style={{ backgroundColor: '#18181B', padding: '2rem', borderRadius: '0.5rem', border: '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', marginTop: 'auto' }}
                    >
                      <span style={{ color: 'white', fontWeight: '500' }}>+ Add Source</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Select from Vault</h3>
                    <div className="file-list-container" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isLoadingVault ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                      ) : vaultFiles.length > 0 ? (
                        vaultFiles.map(file => (
                          <button
                            key={file.id}
                            onClick={() => {
                                handleExtractSource('vault', file.fileName || file.name || "Untitled Document", file.extractedText);
                            }}
                            style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'border-color 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'}
                            onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}
                          >
                            📄 {file.fileName || file.name || "Untitled Document"}
                          </button>
                        ))
                      ) : (
                        <span style={{ color: '#71717A', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No files found in Vault. Add a new source to the left to get started.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1.5rem', height: '100%', flexDirection: 'row' }}>
                
                {/* Source Sidebar */}
                <div style={{ width: '250px', backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#EA580C', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sources</h3>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeSources.map(source => (
                      <div key={source.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18181B', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #3F3F46' }}>
                        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={source.title}>{source.title}</span>
                        <button onClick={() => setActiveSources(prev => prev.filter(s => s.id !== source.id))} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem' }}>&times;</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setIsAddSourceModalOpen(true)} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Source</button>
                </div>

                {/* The Tutor */}
                <div style={{ flex: 1, backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090B' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#EA580C' }}>&gt;_</span> console
                    </h3>
                    <button onClick={() => { setActiveSources([]); setActiveWorkspaceName("Untitled Workspace"); }} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                      Exit Workspace
                    </button>
                  </div>
                  
                  <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {messages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <span style={{ color: msg.role === 'user' ? '#A1A1AA' : '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                        </span>
                        <div style={{
                          backgroundColor: msg.role === 'user' ? '#27272A' : '#18181B',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #27272A',
                          color: '#E4E4E7',
                          fontSize: '0.9rem',
                          lineHeight: '1.6',
                          maxWidth: '90%',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isQuerying && (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                         <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>&gt;_console</span>
                         <div style={{ backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', color: '#E4E4E7', fontSize: '0.9rem' }}>
                           Thinking...
                         </div>
                       </div>
                    )}
                  </div>
                  
                  <div style={{ padding: '1rem', borderTop: '1px solid #27272A', backgroundColor: '#09090B' }}>
                    <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={(e) => {
                       e.preventDefault();
                       if (!consoleInput.trim()) return;
                       handleQueryConsole(e);
                    }}>
                      <input
                        value={consoleInput}
                        onChange={(e) => setConsoleInput(e.target.value)}
                        type="text"
                        placeholder="Ask a question about your sources..."
                        style={{ flex: 1, backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button type="submit" disabled={isQuerying} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '0.5rem', cursor: isQuerying ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isQuerying ? 0.5 : 1 }}>→</button>
                    </form>
                  </div>
                </div>

                {/* The Studio */}
                <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      The Studio
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>🎧</span>
                        <span style={{ fontWeight: 'bold' }}>Audio Overview</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>🎥</span>
                        <span style={{ fontWeight: 'bold' }}>Video Overview</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>📇</span>
                        <span style={{ fontWeight: 'bold' }}>Flashcards</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>🧠</span>
                        <span style={{ fontWeight: 'bold' }}>Quiz</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>📊</span>
                        <span style={{ fontWeight: 'bold' }}>Slide Deck</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>🗺️</span>
                        <span style={{ fontWeight: 'bold' }}>Infographic</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', outline: 'none' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                        <span style={{ fontSize: '1.5rem' }}>📝</span>
                        <span style={{ fontWeight: 'bold' }}>Reports</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </main>

        {/* Add Source Modal */}
        {isAddSourceModalOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', width: '90%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              <button onClick={() => { setIsAddSourceModalOpen(false); setSourceModalView('options'); setSourceInputText(''); }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{sourceModalView === 'options' ? 'Add Source' : sourceModalView === 'website' ? 'Paste Website URL' : sourceModalView === 'youtube' ? 'Paste YouTube URL' : 'Paste Text'}</h2>
              
              {isExtractingMock ? (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
                   <div style={{ width: '40px', height: '40px', border: '4px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                   <span style={{ color: '#A1A1AA' }}>Extracting content...</span>
                 </div>
              ) : sourceModalView === 'options' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <span style={{ fontWeight: 'bold' }}>PDF / Doc</span>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if(file) handleExtractSource('pdf', file.name);
                    }} />
                  </label>
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                    <span style={{ fontSize: '1.5rem' }}>📸</span>
                    <span style={{ fontWeight: 'bold' }}>Image / Camera</span>
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if(file) handleExtractSource('image', file.name || 'Captured Image');
                    }} />
                  </label>
                  <button onClick={() => setSourceModalView('website')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                    <span style={{ fontSize: '1.5rem' }}>🌐</span>
                    <span style={{ fontWeight: 'bold' }}>Website</span>
                  </button>
                  <button onClick={() => setSourceModalView('youtube')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                    <span style={{ fontSize: '1.5rem' }}>▶️</span>
                    <span style={{ fontWeight: 'bold' }}>YouTube</span>
                  </button>
                  <button onClick={() => setSourceModalView('text')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'} onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}>
                    <span style={{ fontSize: '1.5rem' }}>📋</span>
                    <span style={{ fontWeight: 'bold' }}>Copied Text</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {sourceModalView === 'text' ? (
                    <textarea 
                      value={sourceInputText} 
                      onChange={e => setSourceInputText(e.target.value)} 
                      placeholder="Paste your text here..." 
                      style={{ width: '100%', height: '200px', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', outline: 'none', resize: 'none' }}
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={sourceInputText} 
                      onChange={e => setSourceInputText(e.target.value)} 
                      placeholder="https://" 
                      style={{ width: '100%', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', outline: 'none' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setSourceModalView('options')} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: '#A1A1AA', border: 'none', cursor: 'pointer' }}>Back</button>
                    <button 
                      onClick={() => {
                        if(!sourceInputText.trim()) return;
                        handleExtractSource(sourceModalView, sourceModalView === 'text' ? 'Pasted Text Snippet' : sourceInputText, sourceModalView === 'text' ? sourceInputText : undefined);
                      }} 
                      style={{ padding: '0.75rem 1.5rem', backgroundColor: '#EA580C', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Fetch
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
`;

content = content.replace(uiRegex, newUI);

fs.writeFileSync(path, content, 'utf8');
console.log("Multi-source UI layout replaced successfully.");
