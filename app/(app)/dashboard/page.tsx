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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<Array<{ id: string, title: string, updatedAt: any }>>([]);

  // Console state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai', content: string, feedback?: 'up' | 'down', type?: string }>>([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
  const [consoleInput, setConsoleInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

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
      setChatList([]);
      setCurrentChatId(null);
      setVaultFiles([]);
      return;
    }
    const fetchVaultAndChats = async () => {
      try {
        const vq = query(collection(db, 'vault_files'), where('userId', '==', context.uid), where('status', '==', 'analyzed'));
        const vaultSnap = await getDocs(vq);
        const vFiles = vaultSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVaultFiles(vFiles);
      } catch (e) { console.error(e) }

      try {
        const q = query(collection(db, 'chats'), where('userId', '==', context.uid));
        const chatSnap = await getDocs(q);
        const chats = chatSnap.docs.map(d => ({ id: d.id, title: d.data().title, updatedAt: d.data().updatedAt?.toMillis() || 0 }));
        chats.sort((a, b) => b.updatedAt - a.updatedAt);
        setChatList(chats);
      } catch (error) {
        console.error("Error fetching chats:", error);
      }
    };
    fetchVaultAndChats();
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

  const handleLoadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setIsConsoleOpen(true);
    try {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
        }
      }
    } catch (error) {
      console.error("Failed to load chat", error);
    }
  };

  // --- NEW: Console Query Logic ---
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
          sessionId: currentChatId,
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

      // Persist to Firestore
      if (currentChatId) {
        const chatRef = doc(db, 'chats', currentChatId);
        await updateDoc(chatRef, {
          messages: finalMessages,
          updatedAt: serverTimestamp()
        });
        setChatList(prev => prev.map(c => c.id === currentChatId ? { ...c, updatedAt: Date.now() } : c).sort((a, b) => b.updatedAt - a.updatedAt));
      } else {
        let title = userMessage.split(' ').slice(0, 4).join(' ') + '...';

        const newChatDoc = await addDoc(collection(db, 'chats'), {
          userId: userData.uid,
          title: title,
          messages: finalMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        setCurrentChatId(newChatDoc.id);
        setChatList(prev => [{ id: newChatDoc.id, title, updatedAt: Date.now() }, ...prev]);

        // Generate title asynchronously
        fetch('/api/engine/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userMessage })
        })
          .then(res => res.json())
          .then(data => {
            if (data.title) {
              updateDoc(doc(db, 'chats', newChatDoc.id), { title: data.title });
              setChatList(prev => prev.map(c => c.id === newChatDoc.id ? { ...c, title: data.title } : c));
            }
          })
          .catch(e => console.error("Async title generation failed", e));
      }
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

    if (currentChatId) {
      try {
        await updateDoc(doc(db, 'chats', currentChatId), {
          messages: newMessages
        });
      } catch (e) { console.error("Failed to save feedback", e); }
    }
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

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #27272A', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#71717A', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Chats</span>
                <button
                  onClick={() => {
                    setCurrentChatId(null);
                    setMessages([{ role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }]);
                    setIsConsoleOpen(true);
                  }}
                  style={{ background: 'none', border: 'none', color: '#EA580C', cursor: 'pointer', fontSize: '1.25rem', lineHeight: '1' }}
                  title="New Chat"
                >
                  +
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }} className="file-list-container">
                {chatList.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => handleLoadChat(chat.id)}
                    style={{ background: currentChatId === chat.id ? '#18181B' : 'none', border: 'none', color: currentChatId === chat.id ? 'white' : '#A1A1AA', textAlign: 'left', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.2s' }}
                  >
                    {chat.title}
                  </button>
                ))}
                {chatList.length === 0 && <span style={{ color: '#71717A', fontSize: '0.8rem' }}>No recent chats.</span>}
              </div>
            </div>
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

        <main className="main-content">
          <div className="mobile-header">
            <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
            <button onClick={() => setIsConsoleOpen(true)} style={{ backgroundColor: '#18181B', color: '#EA580C', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              &gt;_ Console
            </button>
          </div>

          <header style={{ borderBottom: '1px solid #27272A', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>Command Center</h1>
              <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Initialize and monitor your study engines.</p>
            </div>
            <button onClick={() => setIsConsoleOpen(!isConsoleOpen)} className="desktop-toggle-btn" style={{ color: isConsoleOpen ? '#A1A1AA' : '#EA580C' }}>
              <span style={{ color: '#EA580C' }}>&gt;_</span> {isConsoleOpen ? 'Close Console' : 'Open Console'}
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

            <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>1. Add Course Materials</h3>
              <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload Educational Management lecture slides or PDFs to build your knowledge base.</p>

              <input type="file" multiple accept=".pdf,.pptx,.docx,.txt" ref={fileInputRef} onChange={handleFileInput} style={{ display: 'none' }} />

              <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', opacity: isUploading ? 0.5 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
              >
                <span className="mobile-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>+ Tap to Upload Files</span>
                <span className="desktop-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>{isDragging ? 'Drop files now...' : '+ Click or Drag Files Here'}</span>
                <span style={{ color: '#71717A', fontSize: '0.75rem' }}>PDF, PPTX, DOCX, TXT (Max 20)</span>
              </div>

              {(pendingFiles.length > 0 || uploadStatus) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div className="file-list-container" style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#18181B', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', border: '1px solid #27272A' }}>
                        <span style={{ color: '#D4D4D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{file.name}</span>
                        <span style={{ color: '#71717A' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>

                  {isUploading && (
                    <div style={{ width: '100%', backgroundColor: '#27272A', borderRadius: '0.25rem', height: '6px', overflow: 'hidden', marginTop: '0.25rem' }}>
                      <div style={{ width: `${uploadProgress}%`, backgroundColor: '#EA580C', height: '100%', transition: 'width 0.2s ease' }}></div>
                    </div>
                  )}

                  {uploadStatus ? (
                    <div style={{ backgroundColor: uploadStatus.includes('Error') || uploadStatus.includes('Warning') || uploadStatus.includes('Limit') ? '#7F1D1D' : '#27272A', color: uploadStatus.includes('Error') || uploadStatus.includes('Warning') || uploadStatus.includes('Limit') ? '#FECACA' : '#A1A1AA', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {uploadStatus}
                    </div>
                  ) : null}

                  {pendingFiles.length > 0 && !isUploading && (
                    <button
                      onClick={handleUploadToVault} disabled={isUploading}
                      style={{ backgroundColor: '#EA580C', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                    >
                      Upload to Vault
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>2. Smart Analysis</h3>

              {!isSelectionMode && !isAnalyzing && (
                <>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0, flex: 1 }}>Select unprocessed files from your Vault to extract key concepts and formulas.</p>
                  {analysisStatus && (
                    <div style={{ backgroundColor: analysisStatus.includes('Debug Error') ? '#7F1D1D' : '#27272A', color: analysisStatus.includes('Debug Error') ? '#FECACA' : '#A1A1AA', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                      {analysisStatus}
                    </div>
                  )}
                  <button
                    onClick={handleInitiateAnalysis}
                    style={{ backgroundColor: '#27272A', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #3F3F46', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'all 0.2s' }}
                  >
                    Select Files to Analyze
                  </button>
                </>
              )}

              {isSelectionMode && (
                <>
                  <p style={{ color: '#EA580C', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>Select files for this session:</p>

                  <div className="file-list-container" style={{ flex: 1, maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem', marginTop: '0.5rem' }}>
                    {rawFiles.map((file) => (
                      <label key={file.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#18181B', padding: '0.75rem', borderRadius: '0.5rem', border: selectedFileIds.includes(file.id) ? '1px solid #EA580C' : '1px solid #27272A', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                        />
                        <span style={{ color: selectedFileIds.includes(file.id) ? 'white' : '#A1A1AA', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.fileName}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem' }}>
                    <button onClick={() => setIsSelectionMode(false)} style={{ flex: 1, backgroundColor: 'transparent', color: '#A1A1AA', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #3F3F46', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleProcessSelected}
                      disabled={selectedFileIds.length === 0}
                      style={{ flex: 2, backgroundColor: selectedFileIds.length === 0 ? '#3F3F46' : '#EA580C', color: selectedFileIds.length === 0 ? '#A1A1AA' : 'white', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: selectedFileIds.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s' }}
                    >
                      Ignite Engine ({selectedFileIds.length})
                    </button>
                  </div>
                </>
              )}

              {isAnalyzing && (
                <>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0, flex: 1 }}>Processing selected files through the AI engine...</p>
                  <div style={{ backgroundColor: '#27272A', color: '#E4E4E7', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem', border: '1px solid #3F3F46' }}>
                    <div style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }}></div>
                    <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
                    <div>{analysisStatus}</div>
                  </div>
                </>
              )}
            </div>

            <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>3. Create Study Tools</h3>
              <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0, flex: 1 }}>Convert your processed notes into actionable review formats.</p>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button style={{ flex: 1, backgroundColor: '#27272A', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>Flashcards</button>
                <button style={{ flex: 1, backgroundColor: '#27272A', color: 'white', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}>Study Guide</button>
              </div>
            </div>

          </div>
        </main>

        <aside className={`console-panel ${isConsoleOpen ? 'open' : ''}`}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#EA580C', fontWeight: 'bold' }}>&gt;_</span>
              <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>console</span>
            </div>
            <button className="menu-btn lg:hidden" onClick={() => setIsConsoleOpen(false)}>✕</button>
          </div>
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ color: '#A1A1AA', fontSize: '0.75rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px dashed #27272A', paddingBottom: '0.5rem' }}>Secure Session Established</div>

            {messages.map((msg, i) => {
              const isError = msg.content.startsWith("Error:") || msg.content.includes("Failed to query the AI brain.");

              const lowerMsg = msg.content.toLowerCase();
              const needsDisambiguation = lowerMsg.includes("which specific") || lowerMsg.includes("which document") || lowerMsg.includes("tell me which");

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: msg.role === 'user' ? '#A1A1AA' : isError ? '#EF4444' : '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {msg.role === 'user' ? userData.name.split(' ')[0] : '>_console'}
                    </span>
                    {msg.role === 'user' && (
                      <button onClick={() => { setEditingMessageIndex(i); setEditInput(msg.content); }} className="text-gray-400 hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none' }} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {editingMessageIndex === i ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '90%', alignItems: 'flex-end' }}>
                      <textarea
                        value={editInput}
                        onChange={e => setEditInput(e.target.value)}
                        style={{ width: '100%', backgroundColor: '#27272A', color: 'white', border: '1px solid #EA580C', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem', outline: 'none', resize: 'vertical', minHeight: '80px' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setEditingMessageIndex(null)} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleEditSubmit(i)} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>Save & Resubmit</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: msg.role === 'user' ? '#27272A' : isError ? '#450a0a' : '#18181B',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: isError ? '1px solid #7f1d1d' : '1px solid #27272A',
                      color: isError ? '#fca5a5' : '#E4E4E7',
                      fontSize: '0.9rem',
                      lineHeight: '1.6',
                      maxWidth: '90%',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Smart Vault Selector for Disambiguation */}
                  {msg.role === 'ai' && needsDisambiguation && !isError && i === messages.length - 1 && vaultFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', maxWidth: '90%' }}>
                      {vaultFiles.map(file => (
                        <button
                          key={file.id}
                          disabled={isQuerying}
                          onClick={() => submitQuery(`Please use the document: ${file.fileName} as the context.`)}
                          style={{ backgroundColor: '#18181B', color: '#A1A1AA', border: '1px solid #EA580C', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}
                        >
                          📄 {file.fileName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* AI Action Buttons & Controls */}
                  {msg.role === 'ai' && !isError && i > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
                      {!needsDisambiguation && (
                        <>
                          <button disabled={isQuerying} onClick={() => submitQuery("Based on the response above, please create a set of interactive flashcards for me.")} style={{ backgroundColor: '#27272A', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s' }}>
                            ✨ Create Flashcards
                          </button>
                          <button disabled={isQuerying} onClick={() => submitQuery("Please extract and summarize the absolute key terms from the response above into a bulleted list.")} style={{ backgroundColor: '#27272A', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s' }}>
                            📝 Summarize Key Terms
                          </button>
                          <button disabled={isQuerying} onClick={() => submitQuery("Please generate a quick 3-question multiple-choice quiz based on the information above to test my understanding.")} style={{ backgroundColor: '#27272A', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.4rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: isQuerying ? 'not-allowed' : 'pointer', opacity: isQuerying ? 0.5 : 1, transition: 'all 0.2s' }}>
                            🧠 Generate Practice Quiz
                          </button>
                        </>
                      )}
                      <div style={{ flex: 1 }}></div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button disabled={isQuerying} onClick={() => handleRegenerate(i)} className="text-gray-400 hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none', opacity: isQuerying ? 0.5 : 1 }} title="Regenerate">
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button disabled={isQuerying} onClick={() => handleFeedback(i, 'up')} className="hover:text-green-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'up' ? '#22C55E' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1 }} title="Good response">
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button disabled={isQuerying} onClick={() => handleFeedback(i, 'down')} className="hover:text-red-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'down' ? '#EF4444' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1 }} title="Bad response">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {isQuerying && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.85rem' }}>&gt;_console</span>
                <div style={{ backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', color: '#E4E4E7', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  Processing...
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '1.5rem', borderTop: '1px solid #27272A', backgroundColor: '#000000' }}>
            <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={handleQueryConsole}>
              <input
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                type="text"
                placeholder="Enter command or query..."
                style={{ flex: 1, backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '16px', outline: 'none', minWidth: '0' }}
              />
              <button type="submit" disabled={isQuerying} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '0.5rem', cursor: isQuerying ? 'not-allowed' : 'pointer', fontWeight: 'bold', flexShrink: 0, opacity: isQuerying ? 0.5 : 1 }}>→</button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
