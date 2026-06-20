"use client";
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { useUploadThing } from '../../../utils/uploadthing';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useUserContext } from '../../../lib/hooks/useUserContext';

export default function DashboardPage() {
  const pathname = usePathname();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeDocumentContext, setActiveDocumentContext] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  // Console state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai', content: string, feedback?: 'up' | 'down', type?: string }>>([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
  const [consoleInput, setConsoleInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Locating course notes in Vault...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQuerying) {
      setThinkingStatus('Locating course notes in Vault...');
      interval = setInterval(() => {
        setThinkingStatus(prev => 
          prev === 'Locating course notes in Vault...' 
          ? 'Parsing context & removing academic jargon...' 
          : 'Locating course notes in Vault...'
        );
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isQuerying]);

  const [vaultFiles, setVaultFiles] = useState<any[]>([]);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const { startUpload } = useUploadThing("vaultUploader", {
    onUploadProgress: (p) => {
      setUploadProgress(p);
      if (p === 100) setUploadStatus('Finalizing secure links from server...');
      else setUploadStatus(`Transmitting... ${p}%`);
    },
    onUploadError: (error) => {
      setUploadStatus(`Error: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  });

  const { context, isLoading: isContextLoading } = useUserContext();
  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null };

  useEffect(() => {
    if (!context?.uid) {
      setVaultFiles([]);
      setIsLoadingVault(false);
      return;
    }
    const fetchVault = async () => {
      setIsLoadingVault(true);
      try {
        const vq = query(collection(db, 'vault_files'), where('userId', '==', context.uid));
        const vaultSnap = await getDocs(vq);
        const vFiles = vaultSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVaultFiles(vFiles);
      } catch (e) { 
        console.error(e) 
      } finally {
        setIsLoadingVault(false);
      }
    };
    fetchVault();
  }, [context?.uid]);

  const processFiles = (files: File[]) => {
    if (files.length > 20) {
      setUploadStatus('Error: You can only upload a maximum of 20 files at once.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    const validFiles = files.filter(f => f.name.match(/\.(pdf|pptx|docx|txt)$/i));
    if (validFiles.length !== files.length) {
      setUploadStatus('Error: Legacy .doc files are not supported. Please save as modern .docx or .pdf.');
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }
    setPendingFiles((prev) => {
      const combined = [...prev, ...validFiles];
      const unique = combined.filter((file, index, self) =>
        index === self.findIndex((f) => f.name === file.name && f.size === file.size)
      );
      if (unique.length > 20) {
        setUploadStatus('Error: Queue limit reached. Maximum 20 files total.');
        setTimeout(() => setUploadStatus(''), 4000);
        return prev;
      }
      return unique;
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files)); };

  const handleUploadToVault = async () => {
    if (pendingFiles.length === 0 || !userData.uid || isUploading) return;
    setIsUploading(true); setUploadProgress(0); setUploadStatus('Scanning Vault for existing records...');

    try {
      const q = query(collection(db, 'vault_files'), where('userId', '==', userData.uid));
      const querySnapshot = await getDocs(q);
      const existingFiles = querySnapshot.docs.map(doc => doc.data());

      const newFilesToUpload: File[] = [];
      const duplicateFiles: File[] = [];

      pendingFiles.forEach(file => {
        const isDuplicate = existingFiles.some(ef => ef.fileName === file.name && ef.fileSize === file.size);
        if (isDuplicate) duplicateFiles.push(file);
        else newFilesToUpload.push(file);
      });

      if (newFilesToUpload.length === 0) {
        setUploadStatus('All selected files are already in your Vault.');
        setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
        return;
      }

      if (duplicateFiles.length > 0) setUploadStatus(`Skipped ${duplicateFiles.length} duplicates. Transmitting new files...`);
      else setUploadStatus('Initializing Secure Transfer...');

      const res = await startUpload(newFilesToUpload);

      if (res && res.length > 0) {
        setUploadStatus('Saving records to Database...');
        try {
          for (const fileRes of res) {
            await addDoc(collection(db, 'vault_files'), {
              userId: userData.uid,
              fileName: fileRes.name,
              fileSize: fileRes.size,
              downloadURL: fileRes.url,
              uploadedAt: serverTimestamp(),
              status: 'raw'
            });
          }
          setUploadStatus('Transfer Complete. Files Secured.');
        } catch (dbError) {
          setUploadStatus('Warning: Transfer succeeded, but database save failed.');
        }
        setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
      } else {
        setUploadStatus('Error: Server rejected the batch. Check limits.');
        setIsUploading(false); setUploadProgress(0);
      }
    } catch (error) {
      setUploadStatus('Error: Upload connection failed.');
      setIsUploading(false); setUploadProgress(0);
    }
  };

  const handleInitiateAnalysis = async () => {
    if (!userData.uid) return;
    setAnalysisStatus('Scanning Vault...');

    try {
      const q = query(collection(db, 'vault_files'), where('userId', '==', userData.uid), where('status', '==', 'raw'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAnalysisStatus('All files in your Vault are already analyzed!');
        setTimeout(() => setAnalysisStatus(''), 4000);
        return;
      }

      const files = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // NEW: Sort files by newest first (reverse chronological)
      files.sort((a: any, b: any) => {
        const timeA = a.uploadedAt?.seconds || 0;
        const timeB = b.uploadedAt?.seconds || 0;
        return timeB - timeA;
      });

      setRawFiles(files);
      setSelectedFileIds([]);
      setIsSelectionMode(true);
      setAnalysisStatus('');
    } catch (error) {
      setAnalysisStatus('Error accessing Vault records.');
      setTimeout(() => setAnalysisStatus(''), 4000);
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const handleProcessSelected = async () => {
    if (selectedFileIds.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setIsSelectionMode(false);

    const filesToProcess = rawFiles.filter(f => selectedFileIds.includes(f.id));
    setAnalysisStatus(`Igniting AI Engine for ${filesToProcess.length} file(s)...`);

    let successCount = 0;

    try {
      for (const file of filesToProcess) {
        setAnalysisStatus(`Extracting: ${file.fileName}...`);

        const response = await fetch('/api/engine/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: file.downloadURL,
            fileName: file.fileName,
            docId: file.id,
            userId: userData.uid
          })
        });

        const textResponse = await response.text();
        let result;

        try {
          result = JSON.parse(textResponse);
        } catch (parseError) {
          throw new Error(`The AI Engine experienced a critical failure reading "${file.fileName}". The file might be corrupted or too complex.`);
        }

        if (response.ok && result.success) {
          const docRef = doc(db, 'vault_files', file.id);
          await updateDoc(docRef, { status: 'analyzed' });
          successCount++;
        } else {
          throw new Error(result.error || `Failed to process ${file.fileName}. Please try again.`);
        }
      }

      setAnalysisStatus(`Analysis Complete. ${successCount}/${filesToProcess.length} integrated into AI Brain.`);
      setTimeout(() => setAnalysisStatus(''), 8000);
      setIsAnalyzing(false);

    } catch (error: any) {
      setAnalysisStatus(`${error.message}`);
      setIsAnalyzing(false);
    }
  };


  // --- NEW: Console Query Logic ---
  const handleRenameDocument = async () => {
    if (!newTitle.trim() || !activeDocumentId || newTitle === activeDocumentName) {
      setIsEditingTitle(false);
      return;
    }
    const finalName = newTitle.trim();
    try {
      await updateDoc(doc(db, 'vault_files', activeDocumentId), { fileName: finalName });
      setActiveDocumentName(finalName);
      setVaultFiles(prev => prev.map(f => f.id === activeDocumentId ? { ...f, fileName: finalName } : f));
      console.log("Document renamed successfully.");
    } catch (e) {
      console.error("Failed to rename document:", e);
    }
    setIsEditingTitle(false);
  };

  const submitQuery = async (userMessage: string, historyPrefix?: Array<{ role: 'user' | 'ai', content: string, feedback?: 'up' | 'down' }>) => {
    if (isQuerying) return;

    const baseMessages = historyPrefix || messages;
    const history = baseMessages.filter(m => m.role === 'user');

    const newUserMsg = { role: 'user' as const, content: userMessage };
    const updatedMessages = [...baseMessages, newUserMsg];

    setMessages(updatedMessages);
    setIsQuerying(true);

    if (isContextLoading || !context) {
      setMessages([...updatedMessages, { role: 'ai', content: 'Syncing Academic Data... Please wait.' }]);
      setIsQuerying(false);
      return;
    }

    try {
      const userProfilePayload = {
        name: context.name,
        school: context.school,
        department: context.department,
        courses: context.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
      };

      const response = await fetch('/api/engine/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.filter(m => (m as any).type !== 'action_required').slice(-10),
          activeFileId: selectedFileIds.length > 0 ? selectedFileIds[0] : null,
          sessionId: "command-center-session",
          userProfile: userProfilePayload
        })
      });
      const contentType = response.headers.get('content-type');
      let finalMessages: any[] = [];

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();

        if (data.error) {
          setMessages([...updatedMessages, { role: 'ai', content: `System Error: ${data.error}` }]);
          setIsQuerying(false);
          return;
        }

        const newAiMsg = { role: 'ai' as const, content: data.answer || '' };
        finalMessages = [...updatedMessages, newAiMsg];
        setMessages(finalMessages);
      } else if (response.body) {
        // Stream text token by token
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiContent = '';
        let newAiMsg = { role: 'ai' as const, content: '' };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          aiContent += decoder.decode(value, { stream: true });
          newAiMsg.content = aiContent;
          setMessages([...updatedMessages, newAiMsg]);
        }
        finalMessages = [...updatedMessages, newAiMsg];
      } else {
        setIsQuerying(false);
        return;
      }

      // Chat history is now scoped strictly to the active document and not persisted globally.
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error: Could not reach the brain." }]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleEditSubmit = (index: number) => {
    if (!editInput.trim() || isQuerying) return;
    const historyPrefix = messages.slice(0, index);
    setEditingMessageIndex(null);
    submitQuery(editInput, historyPrefix);
  };

  const handleRegenerate = (index: number) => {
    if (isQuerying) return;
    const userMsg = messages[index - 1];
    if (userMsg && userMsg.role === 'user') {
      const historyPrefix = messages.slice(0, index - 1);
      submitQuery(userMsg.content, historyPrefix);
    }
  };

  const handleFeedback = async (index: number, type: 'up' | 'down') => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], feedback: type };
    setMessages(newMessages);
  };

  const handleQueryConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim() || isQuerying) return;
    const msg = consoleInput;
    setConsoleInput('');
    await submitQuery(msg);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .dashboard-layout, .dashboard-layout * { box-sizing: border-box; }
        .dashboard-layout { display: flex; flex-direction: column; height: 100dvh; background-color: #0A1128; color: white; overflow-x: hidden; overflow-y: hidden; position: relative; width: 100%; max-width: 100vw; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 40; display: none; opacity: 0; transition: opacity 0.3s; }
        .overlay.visible { display: block; opacity: 1; }
        .sidebar { position: fixed; top: 0; left: -300px; width: 260px; height: 100dvh; background-color: #111111; border-right: 1px solid #27272A; padding: 1.5rem; display: flex; flex-direction: column; z-index: 50; transition: left 0.3s ease; }
        .sidebar.open { left: 0; }
        .console-panel { position: fixed; top: 0; right: -100%; width: 100%; height: 100dvh; background-color: #111111; display: flex; flex-direction: column; z-index: 50; transition: right 0.3s ease; }
        .console-panel.open { right: 0; }
        .main-content { flex: 1; padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem; overflow-y: auto; overflow-x: hidden; height: 100dvh; width: 100%; max-width: 100vw; }
        .logo-img { width: 8rem; margin-bottom: 2rem; }
        .mobile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; width: 100%; }
        .menu-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; padding: 0.5rem; display: flex; }
        .desktop-toggle-btn { display: none; background-color: #18181B; padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #27272A; cursor: pointer; font-size: 0.875rem; font-weight: bold; align-items: center; gap: 0.5rem; transition: all 0.2s; }
        .mobile-text { display: inline; }
        .desktop-text { display: none; }
        .file-list-container::-webkit-scrollbar { width: 6px; }
        .file-list-container::-webkit-scrollbar-track { background: #111111; }
        .file-list-container::-webkit-scrollbar-thumb { background: #3F3F46; border-radius: 3px; }
        .custom-checkbox { accent-color: #EA580C; width: 1.2rem; height: 1.2rem; cursor: pointer; }
        @media (min-width: 1024px) {
          .dashboard-layout { flex-direction: row; }
          .overlay { display: none !important; }
          .mobile-header { display: none; }
          .sidebar { position: static; width: 250px; left: 0; transition: none; flex-shrink: 0; }
          .console-panel { position: static; width: 400px; right: 0; transition: none; display: none; flex-shrink: 0; border-left: 1px solid #27272A; }
          .console-panel.open { display: flex; }
          .main-content { padding: 3rem; flex: 1; }
          .logo-img { width: 10rem; margin-bottom: 3rem; }
          .desktop-toggle-btn { display: flex; }
          .mobile-text { display: none; }
          .desktop-text { display: inline; }
        }
      `}} />

      <div className="dashboard-layout">
        <div className={`overlay ${isSidebarOpen || isConsoleOpen ? 'visible' : ''}`} onClick={() => { setIsSidebarOpen(false); setIsConsoleOpen(false); }}></div>
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src="/logo.png" alt="CogniBase" className="logo-img" style={{ marginBottom: '0' }} />
            <button className="menu-btn lg:hidden" onClick={() => setIsSidebarOpen(false)} style={{ display: 'none' }}>✕</button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginTop: '3rem' }}>
            <a href="/dashboard" style={{ color: pathname === '/dashboard' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Command Center</a>
            <a href="/vault" style={{ color: pathname === '/vault' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/vault' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>My Vault</a>
            <a href="/study-guides" style={{ color: pathname === '/study-guides' ? '#EA580C' : '#A1A1AA', fontWeight: pathname === '/study-guides' ? 'bold' : 'normal', textDecoration: 'none', transition: 'color 0.2s' }}>Study Guides</a>
            <a href="#" style={{ color: '#A1A1AA', textDecoration: 'none', transition: 'color 0.2s' }}>Active Engines</a>
            <a href="#" style={{ color: '#A1A1AA', textDecoration: 'none', transition: 'color 0.2s' }}>Settings</a>

            </nav>
          <div style={{ borderTop: '1px solid #27272A', paddingTop: '1.5rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.name}</span>
              <span style={{ color: '#A1A1AA', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData.email}</span>
            </div>
            <div style={{ color: '#71717A', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#22C55E', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>System Online</span>
            </div>
          </div>
        </aside>

                <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <div className="mobile-header">
            <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
          </div>

          <header style={{ borderBottom: '1px solid #27272A', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              {!activeDocumentContext ? (
                <>
                  <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>Command Center</h1>
                  <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Initialize and monitor your study engines.</p>
                </>
              ) : (
                <>
                  {isEditingTitle ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onBlur={handleRenameDocument}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameDocument(); }}
                        autoFocus
                        style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em', fontWeight: 'bold', backgroundColor: 'transparent', color: 'white', border: '1px solid #EA580C', outline: 'none', borderRadius: '0.5rem', padding: '0 0.5rem', width: '100%', maxWidth: '600px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="group">
                      <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em', display: 'flex', alignItems: 'center' }}>
                        {activeDocumentName}
                        <button
                          onClick={() => setIsEditingTitle(true)}
                          style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', marginLeft: '0.5rem', opacity: 0.5, transition: 'opacity 0.2s' }}
                          title="Rename Document"
                          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                        >
                          <Pencil size={18} />
                        </button>
                      </h1>
                    </div>
                  )}
                  <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Active Workspace loaded. Chat with your tutor or generate study tools.</p>
                </>
              )}
            </div>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {!activeDocumentContext ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                <div style={{ textAlign: 'center', maxWidth: '600px' }}>
                  <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Unlock the Command Center</h2>
                  <p style={{ color: '#A1A1AA', fontSize: '1.1rem', lineHeight: '1.6' }}>Upload a document or select notes from your Vault to unlock the Command Center.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
                  <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Upload New Document</h3>
                    <input type="file" accept=".pdf,.pptx,.docx,.txt" ref={fileInputRef} onChange={(e) => {
                       handleFileInput(e);
                       setTimeout(() => {
                           setActiveDocumentContext("Extracted text from newly uploaded file...");
                           // For mock purposes during upload:
                           setActiveDocumentId("temp-id");
                           const fileName = e.target.files?.[0]?.name || "New Document";
                           setActiveDocumentName(fileName);
                           setNewTitle(fileName);
                       }, 1000);
                    }} style={{ display: 'none' }} />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ backgroundColor: '#18181B', padding: '2rem', borderRadius: '0.5rem', border: '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', marginTop: 'auto' }}
                    >
                      <span style={{ color: 'white', fontWeight: '500' }}>+ Click or Drag Files Here</span>
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
                             setActiveDocumentContext(file.extractedText || "Mock extracted text from vault file: " + file.fileName);
                             setActiveDocumentId(file.id);
                             setActiveDocumentName(file.fileName || file.name || "Untitled Document");
                             setNewTitle(file.fileName || file.name || "Untitled Document");
                          }}
                            style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'border-color 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'}
                            onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}
                          >
                            📄 {file.fileName || file.name || "Untitled Document"}
                          </button>
                        ))
                      ) : (
                        <span style={{ color: '#71717A', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No files found in Vault. Upload a new document to the left to get started.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
                
                <div style={{ flex: 1, backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090B' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#EA580C' }}>&gt;_</span> The Tutor
                    </h3>
                    <button onClick={() => { setActiveDocumentContext(null); setActiveDocumentId(null); setActiveDocumentName(null); }} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                      Exit Workspace
                    </button>
                  </div>
                  
                  <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {messages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <span style={{ color: msg.role === 'user' ? '#A1A1AA' : '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {msg.role === 'user' ? userData.name.split(' ')[0] : 'The Tutor'}
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
                         <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>The Tutor</span>
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
                        placeholder="Ask a question about the active document..."
                        style={{ flex: 1, backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button type="submit" disabled={isQuerying} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '0.5rem', cursor: isQuerying ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isQuerying ? 0.5 : 1 }}>→</button>
                    </form>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#111111', borderRadius: '1rem', border: '1px solid #27272A', padding: '1.5rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      The Studio
                    </h3>
                    <p style={{ color: '#A1A1AA', marginBottom: '2rem' }}>Generate advanced study materials from your active document.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.2s', outline: 'none' }}>
                        <span style={{ fontSize: '1.25rem' }}>✨</span>
                        <span style={{ fontWeight: 'bold' }}>Generate Flashcards</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.2s', outline: 'none' }}>
                        <span style={{ fontSize: '1.25rem' }}>🧠</span>
                        <span style={{ fontWeight: 'bold' }}>Build Mock Exam</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.2s', outline: 'none' }}>
                        <span style={{ fontSize: '1.25rem' }}>🎧</span>
                        <span style={{ fontWeight: 'bold' }}>Audio Overview</span>
                      </button>
                      <button style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.2s', outline: 'none' }}>
                        <span style={{ fontSize: '1.25rem' }}>📊</span>
                        <span style={{ fontWeight: 'bold' }}>Generate Mind Map</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
