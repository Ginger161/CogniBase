"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';

import { supabase } from '../../../utils/supabase/client';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown, MoreVertical } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserContext } from '../../../lib/hooks/useUserContext';
import CommandCenterUI from '../../../components/CommandCenterUI';
import PullToRefresh from '../../../components/PullToRefresh';

export default function DashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<Array<{ id: string, title: string, type: string, content: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>("Untitled Workspace");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [sourceModalView, setSourceModalView] = useState<'options' | 'website' | 'youtube' | 'text'>('options');
  const [sourceInputText, setSourceInputText] = useState("");
  const [isExtractingMock, setIsExtractingMock] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Workspace Desk Management State
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [editingDeskId, setEditingDeskId] = useState<string | null>(null);
  const [editingDeskTitle, setEditingDeskTitle] = useState("");

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      await fetch(`/api/workspaces/${workspaceToDelete}`, { method: 'DELETE' });
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDelete));
      setWorkspaceToDelete(null);
      if (activeWorkspaceId === workspaceToDelete) {
        setActiveWorkspaceId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWorkspace = (ws: any) => {
    navigator.clipboard.writeText(`https://cognibase.app/share/${ws.id}`);
    alert("Share link copied to clipboard!");
    setActiveDropdownId(null);
  };

  const submitDeskRename = async (id: string) => {
    if (!editingDeskTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualTitle: editingDeskTitle })
      });
      if (res.ok) {
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, title: editingDeskTitle } : w));
        setEditingDeskId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryMessage = () => {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      sendMessage({ content: lastUserMsg.content });
    }
  };


  const { context, isLoading: isContextLoading } = useUserContext();
  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null };

  // Console state
  const [input, setInput] = useState('');
  const { messages, setMessages, append: sendMessage, status, error, handleSubmit } = useChat({
    id: activeWorkspaceId || 'default',
    api: '/api/engine/query',
    initialMessages: [{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any],
    body: {
      activeSources: activeSources,
      workspaceId: activeWorkspaceId,
      userProfile: {
        name: context?.name || 'Guest',
        school: context?.school || '',
        department: context?.department || '',
        courses: context?.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
      }
    }
  });
  const isLoading = status === 'streaming' || status === 'submitted';

  const [thinkingStatus, setThinkingStatus] = useState('Locating course notes in Vault...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
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
  }, [isLoading]);

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
  const [isAssimilating, setIsAssimilating] = useState(false);
  const [assimilationStatus, setAssimilationStatus] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 10);
    if (files.length === 0) return;

    setIsExtractingMock(true);
    setIsAssimilating(true);
    setProgressPercentage(0);

    let targetWorkspaceId = activeWorkspaceId;
    if (!targetWorkspaceId) {
      try {
        setAssimilationStatus('Creating new workspace...');
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: context?.uid || null, userEmail: context?.email || 'guest@example.com' })
        });
        if (!res.ok) {
          throw new Error('Server returned ' + res.status);
        }
        const ws = await res.json();
        if (ws.id) {
          targetWorkspaceId = ws.id;
          setActiveWorkspaceId(ws.id);
          setActiveSources([]); // Clear any previous desk's sources
        } else {
          throw new Error('No workspace ID returned');
        }
      } catch (e) {
        console.error("Failed to create workspace", e);
        setIsAssimilating(false);
        setIsExtractingMock(false);
        return;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const getProgress = (stage: number) => Math.round(((i + (stage / 4)) / files.length) * 100);

      setAssimilationStatus('Uploading documents to secure vault...');
      setProgressPercentage(getProgress(0));

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('workspace-files')
        .upload(filePath, file);

      if (error) {
        console.error("Upload error:", error.message);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from('workspace-files')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      console.log("Successfully uploaded to:", fileUrl);
      
      try {
        setAssimilationStatus('Extracting and structuring text...');
        setProgressPercentage(getProgress(1));
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            url: fileUrl,
            workspaceId: targetWorkspaceId
          })
        });
        if (res.ok) {
          const newDoc = await res.json();

          setAssimilationStatus('Generating AI semantic vectors...');
          setProgressPercentage(getProgress(2));
          
          try {
            const analyzeRes = await fetch('/api/engine/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileUrl: fileUrl,
                fileName: file.name,
                docId: newDoc.id,
                userId: context?.uid || 'guest'
              })
            });
            
            if (analyzeRes.ok) {
               setActiveSources(prev => [...prev, {
                 id: newDoc.id,
                 title: file.name,
                 type: file.name.endsWith('.pdf') ? 'pdf' : 'document',
                 content: '' // AI fetches chunks dynamically now
               }]);
            } else {
              console.error("Analysis failed");
            }
          } catch (analyzeError) {
            console.error("Analysis request failed", analyzeError);
          }
        }
      } catch (e) {
        console.error("Failed to save to database:", e);
      }
      setProgressPercentage(getProgress(3));
    }

    if (activeWorkspaceName === 'Untitled Workspace' || activeWorkspaceName === 'Untitled workspace') {
      try {
        setAssimilationStatus('Generating workspace title...');
        const renameRes = await fetch(`/api/workspaces/${targetWorkspaceId}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: files[0].name })
        });
        if (renameRes.ok) {
          const { title } = await renameRes.json();
          setActiveWorkspaceName(title);
        }
      } catch (e) {
        console.error("Auto rename failed", e);
      }
    }
    
    setAssimilationStatus('Finalizing your study desk...');
    setProgressPercentage(100);
    // Trigger Vault refresh so the new workspace shows up
    fetchWorkspaces();

    setTimeout(() => {
       setIsAssimilating(false);
       setIsAddSourceModalOpen(false);
       setSourceModalView('options');
       setIsExtractingMock(false);
       if (event.target) event.target.value = '';
    }, 1000);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [context?.uid]);

  const fetchWorkspaces = async () => {
    setIsLoadingVault(true);
    try {
      const res = await fetch(`/api/workspaces${context?.uid ? `?userId=${context.uid}` : ''}`);
      const ws = await res.json();
      setWorkspaces(ws);
    } catch (e) { 
      console.error(e) 
    } finally {
      setIsLoadingVault(false);
    }
  };

  const handleSelectWorkspace = async (workspace: any) => {
    setActiveWorkspaceId(workspace.id);
    setActiveWorkspaceName(workspace.title);
    
    // Set active sources from documents
    if (workspace.documents) {
      setActiveSources(workspace.documents.map((d: any) => ({
        id: d.id,
        title: d.name,
        type: d.name.endsWith('.pdf') ? 'pdf' : 'document',
        content: ''
      })));
    } else {
      setActiveSources([]);
    }

    // Fetch historical messages
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        // Map Prisma messages to Vercel AI SDK format
        const formattedMsgs = msgs.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.text
        }));
        setMessages(formattedMsgs.length > 0 ? formattedMsgs : [{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  };

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
      const docsRes = await fetch('/api/documents');
      const existingFiles = await docsRes.json();

      const newFilesToUpload: File[] = [];
      const duplicateFiles: File[] = [];

      pendingFiles.forEach(file => {
        const isDuplicate = existingFiles.some((ef: any) => ef.fileName === file.name && ef.fileSize === file.size);
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

      const res = [];
      for (const file of newFilesToUpload) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;
        const { error } = await supabase.storage.from('workspace-files').upload(filePath, file);
        if (!error) {
          const { data } = supabase.storage.from('workspace-files').getPublicUrl(filePath);
          res.push({ name: file.name, size: file.size, url: data.publicUrl });
        }
      }

      if (res && res.length > 0) {
        setUploadStatus('Saving records to Database...');
        try {
          for (const fileRes of res) {
            await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fileRes.name,
                url: fileRes.url
              })
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
      const res = await fetch('/api/documents');
      const allDocs = await res.json();
      const querySnapshot = { empty: allDocs.length === 0, docs: allDocs.map((d: any) => ({ id: d.id, data: () => d })) };

      if (querySnapshot.empty) {
        setAnalysisStatus('All files in your Vault are already analyzed!');
        setTimeout(() => setAnalysisStatus(''), 4000);
        return;
      }

      const files = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

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
  
  const handleExtractSource = (type: string, inputTitle: string, rawContent?: string) => {
    setIsExtractingMock(true);
    setTimeout(() => {
      let extractedContent = "";
      if (type === 'pdf') extractedContent = rawContent || "Extracted text from newly uploaded file...";
      if (type === 'vault') extractedContent = rawContent || "Mock extracted text from vault file.";
      if (type === 'image') extractedContent = `Mocked OCR text for ${inputTitle}`;
      if (type === 'website') extractedContent = `Mocked scraped text for ${inputTitle}`;
      if (type === 'youtube') extractedContent = `Mocked transcript for ${inputTitle}`;
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

  const handleRenameDocument = async () => {
    if (!newTitle.trim() || newTitle === activeWorkspaceName) {
      setIsEditingTitle(false);
      return;
    }
    const finalName = newTitle.trim();
    setActiveWorkspaceName(finalName);
    setIsEditingTitle(false);
  };

  const handleEditSubmit = (index: number) => {
    // Custom edit logic disabled for Vercel AI SDK simplicity in this refactor
  };

  const handleRegenerate = (index: number) => {
    // Custom regenerate logic disabled for Vercel AI SDK simplicity
  };

  const handleFeedback = async (index: number, type: 'up' | 'down') => {
    // Custom feedback logic disabled
  };

  const handleQueryConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (isContextLoading) {
      setMessages([...messages, { id: Date.now().toString(), role: 'assistant', content: 'Syncing Academic Data... Please wait.' }]);
      return;
    }

    handleSubmit(e);
  };

  const handleRefresh = async () => {
    router.refresh();
    if (typeof fetchWorkspaces === 'function') {
      await fetchWorkspaces();
    }
    // Artificial delay for UI polish
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .dashboard-layout, .dashboard-layout * { box-sizing: border-box; }
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
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
        {isAssimilating && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-md">
              <span className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xl font-bold text-white text-center">{assimilationStatus}</p>
              
              {/* Progress Bar Container */}
              <div className="w-full h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 mt-2">{progressPercentage}% Complete</p>
            </div>
          </div>
        )}
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

                <main className="main-content max-w-[100vw]" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', overflowX: 'hidden' }}>
          <div className="mobile-header">
            <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
          </div>

          {activeSources.length === 0 && (
            <header style={{ borderBottom: '1px solid #27272A', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>Command Center</h1>
                <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Initialize and monitor your study engines.</p>
              </div>
            </header>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
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
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Select from Desks</h3>
                    <div className="file-list-container" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {isLoadingVault ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                      ) : workspaces.length > 0 ? (
                        workspaces.map(ws => (
                          <div key={ws.id} style={{ position: 'relative' }}>
                            {editingDeskId === ws.id ? (
                              <div style={{ backgroundColor: '#18181B', border: '1px solid #EA580C', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <input
                                  autoFocus
                                  value={editingDeskTitle}
                                  onChange={e => setEditingDeskTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') submitDeskRename(ws.id);
                                    if (e.key === 'Escape') setEditingDeskId(null);
                                  }}
                                  onBlur={() => submitDeskRename(ws.id)}
                                  style={{ backgroundColor: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 'bold', width: '100%' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{ws.documents?.length || 0} documents</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelectWorkspace(ws)}
                                style={{ width: '100%', backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.25rem', transition: 'border-color 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.borderColor = '#EA580C'}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#27272A'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span style={{ fontWeight: 'bold' }}>🗂️ {ws.title}</span>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === ws.id ? null : ws.id); }}
                                    className="p-1 hover:bg-gray-800 rounded z-10 transition-colors"
                                  >
                                    <MoreVertical className="w-5 h-5 text-gray-400 hover:text-white" />
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>{ws.documents?.length || 0} documents</span>
                              </button>
                            )}
                            
                            {activeDropdownId === ws.id && (
                              <div style={{ position: 'absolute', top: '2.5rem', right: '0.5rem', backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '0.5rem', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
                                <button onClick={(e) => { e.stopPropagation(); setEditingDeskId(ws.id); setEditingDeskTitle(ws.title); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors">Rename</button>
                                <button onClick={(e) => { e.stopPropagation(); handleShareWorkspace(ws); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors">Share</button>
                                <button onClick={(e) => { e.stopPropagation(); setWorkspaceToDelete(ws.id); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-950/30 hover:text-red-400 text-left transition-colors border-t border-gray-800">Delete</button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#71717A', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No saved Desks. Add a new source to start a workspace.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <CommandCenterUI
                title={activeWorkspaceName || (activeSources.length > 0 ? activeSources[0].title : 'Untitled Workspace')}
                activeSources={activeSources}
                onRemoveSource={(id) => {
                  setActiveSources(prev => prev.filter(s => s.id !== id));
                }}
                onAddSource={() => {
                  setIsAddSourceModalOpen(true);
                  setSourceModalView('options');
                }}
                onExit={() => { 
                  setActiveWorkspaceId(null);
                  setActiveSources([]); 
                  setActiveWorkspaceName("Untitled Workspace"); 
                  setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                }}
                onRetry={handleRetryMessage}
                chatMessages={messages.map(m => ({ role: m.role, text: m.parts ? m.parts.map(p => (p as any).text).join('') : (m as any).content || '' }))}
                chatInput={input}
                setChatInput={setInput}
                onSendMessage={() => {
                  if (!input.trim() || isLoading) return;
                  sendMessage({ content: input, role: 'user' });
                  setInput('');
                }}
                isChatLoading={isLoading}
                isAssimilating={isAssimilating}
                assimilationStatus={assimilationStatus}
                onUpdateTitle={setActiveWorkspaceName}
                chatError={error}
              />
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
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <span style={{ fontWeight: 'bold' }}>PDF / Doc</span>
                    <input type="file" multiple accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <label style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>📸</span>
                    <span style={{ fontWeight: 'bold' }}>Image / Camera</span>
                    <input type="file" multiple accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <button onClick={() => setSourceModalView('website')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>🌐</span>
                    <span style={{ fontWeight: 'bold' }}>Website</span>
                  </button>
                  <button onClick={() => setSourceModalView('youtube')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
                    <span style={{ fontSize: '1.5rem' }}>▶️</span>
                    <span style={{ fontWeight: 'bold' }}>YouTube</span>
                  </button>
                  <button onClick={() => setSourceModalView('text')} style={{ backgroundColor: '#18181B', border: '1px solid #27272A', padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', transition: 'border-color 0.2s' }} >
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

      </div>
      {workspaceToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Workspace?</h3>
            <p className="text-gray-400 text-sm mb-6">Are you sure? This will delete all documents and chat history permanently.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setWorkspaceToDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleDeleteWorkspace} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}
