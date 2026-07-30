"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';

import { supabase } from '../../../utils/supabase/client';
import { Pencil, RefreshCcw, ThumbsUp, ThumbsDown, MoreVertical } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { useUserContext } from '../../../lib/hooks/useUserContext';
import CommandCenterUI from '../../../components/CommandCenterUI';
import PullToRefresh from '../../../components/PullToRefresh';
import { toast } from 'sonner';

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
  

  // Workspace Desk Management State
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [editingDeskId, setEditingDeskId] = useState<string | null>(null);
  const [editingDeskTitle, setEditingDeskTitle] = useState("");

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDelete));
        setWorkspaceToDelete(null);
        if (activeWorkspaceId === workspaceToDelete) {
          setActiveWorkspaceId(null);
          setActiveSources([]);
          setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
        }
      } else {
        console.error("Failed to delete workspace on the server.");
        alert("Failed to delete workspace. Please try again.");
      }
    } catch (e) {
      console.error(e);
    }
  };



  const handleYouTubeSubmit = async (url: string) => {
    if (!activeWorkspaceId) {
      throw new Error("Please select or create a desk first.");
    }
    
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to extract YouTube transcript");
    }
    
    const newDoc = await res.json();
    
    // Update local state
    setActiveSources(prev => [...prev, { id: newDoc.id, title: newDoc.name, type: 'youtube', content: '' }]);
    
    // Optionally trigger backend analysis asynchronously 
    fetch('/api/engine/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: newDoc.id })
    }).catch(console.error);

    // We don't have to await fetchWorkspaces since state is already updated, but we can do it to sync
    if (typeof fetchWorkspaces === 'function') {
      fetchWorkspaces();
    }
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
      const msgText = lastUserMsg.parts ? lastUserMsg.parts.filter(p => p.type === 'text').map(p => (p as any).text).join('\n') : (lastUserMsg as any).text || (lastUserMsg as any).content || '';
      sendMessage({ role: 'user', parts: [{ type: 'text', text: msgText }] } as any, {
        body: {
          activeSources,
          workspaceId: activeWorkspaceId,
          userProfile: {
            name: userData.name,
            school: userData.school,
            department: userData.department,
            courses: userData.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
          }
        }
      });
    }
  };


  const { context, isLoading: isContextLoading } = useUserContext();
  const userData = context || { name: 'Guest Student', email: 'Not signed in', uid: '', profile: null, school: '', department: '' };

  // Console state
  const [input, setInput] = useState('');

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: activeWorkspaceId || 'default',
    api: '/api/engine/query',
    initialMessages: [{ id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' }] } as any],
    onError: (err: Error) => {
      console.warn("Caught Backend Error:", err.message);
      if (err.message.includes('503') || err.message.includes('demand')) {
        toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
      } else {
        toast.error(err.message || "An error occurred while communicating with the AI.");
      }
    }
  } as any);
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
          setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
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
            workspaceId: targetWorkspaceId,
            fileSize: file.size
          })
        });
        if (res.ok) {
          const newDoc = await res.json();
          
          setActiveSources(prev => [...prev, {
            id: newDoc.id,
            title: file.name,
            type: file.name.endsWith('.pdf') ? 'pdf' : 'document',
            content: ''
          }]);

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
                userId: context?.uid || 'guest',
                workspaceId: targetWorkspaceId,
                workspaceName: activeWorkspaceName
              })
            });
            
            if (analyzeRes.ok) {
               const analyzeData = await analyzeRes.json();
               
               if (analyzeData.workspaceTitle) {
                 setActiveWorkspaceName(analyzeData.workspaceTitle);
                 setWorkspaces(prev => prev.map(w => w.id === targetWorkspaceId ? { ...w, title: analyzeData.workspaceTitle } : w));
               }
            } else {
              const errData = await analyzeRes.json();
              if (analyzeRes.status === 503 || errData.isCongested) {
                toast.error("High traffic detected. The AI servers are currently busy. Please try again in a few moments.");
              } else {
                toast.error(errData.error || "Analysis failed.");
              }
              console.warn("Analysis failed gracefully", errData);
            }
          } catch (analyzeError) {
            console.error("Analysis request failed", analyzeError);
          }
        } else {
          const errData = await res.json();
          toast.error(errData.error || "Failed to save document.");
          setAssimilationStatus('');
          setIsAssimilating(false);
          setIsExtractingMock(false);
          continue;
        }
      } catch (e) {
        console.error("Failed to save to database:", e);
      }
      setProgressPercentage(getProgress(3));
    }

    // We removed the old rename workflow here because the title is now 
    // dynamically generated during the document analysis phase directly in /api/engine/analyze
    
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
      setWorkspaces(Array.isArray(ws) ? ws : []);
      
      // Auto-select removed per user request: The user prefers to see the empty state 
      // showing their desks and the option to create a new workspace on load.
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
    const validFiles = files.filter(f => f.name.match(/\.(pdf|pptx|docx|txt|jpg|jpeg|png|webp|heic)$/i));
    if (validFiles.length !== files.length) {
      setUploadStatus('Error: Unsupported file type. Please upload PDF, DOCX, PPTX, TXT, or Image files.');
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
  
  const handleExtractSource = async (type: string, inputTitle: string, rawContent?: string) => {
    setIsExtractingMock(true);

    let targetWorkspaceId = activeWorkspaceId;
    if (!targetWorkspaceId) {
      try {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: context?.uid || null, userEmail: context?.email || 'guest@example.com' })
        });
        const ws = await res.json();
        if (ws.id) {
          targetWorkspaceId = ws.id;
          setActiveWorkspaceId(ws.id);
          setActiveSources([]);
          setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
        } else {
          throw new Error('No workspace ID returned');
        }
      } catch (e) {
        console.error("Failed to create workspace", e);
        setIsExtractingMock(false);
        return;
      }
    }

    try {
      const payload: any = { workspaceId: targetWorkspaceId };

      if (type === 'text') {
        payload.name = 'Pasted Text Snippet';
        payload.url = '';
        payload.rawText = rawContent;
      } else {
        payload.name = inputTitle;
        payload.url = inputTitle;
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add this source.');
      }

      const newDoc = await res.json();

      setActiveSources(prev => [...prev, {
        id: newDoc.id,
        title: type === 'text' ? 'Pasted Text Snippet' : inputTitle,
        type: type,
        content: ''
      }]);

    } catch (error: any) {
      console.error("Add source error:", error);
      alert(error.message || "Failed to add this source. Please try again.");
    } finally {
      setIsExtractingMock(false);
      setIsAddSourceModalOpen(false);
      setSourceModalView('options');
      setSourceInputText('');
    }
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
      setMessages([...messages, { id: Date.now().toString(), role: 'assistant', parts: [{ type: 'text', text: 'Syncing Academic Data... Please wait.' }] } as any]);
      return;
    }

    console.log('🚀 Sending to backend - Workspace ID:', activeWorkspaceId, 'Sources attached:', activeSources);
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any, {
      body: {
        activeSources,
        workspaceId: activeWorkspaceId,
        userProfile: {
          name: context?.name || 'Guest',
          school: context?.school || '',
          department: context?.department || '',
          courses: context?.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
        }
      }
    });
    setInput('');
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
    <PullToRefresh onRefresh={handleRefresh} disablePageScroll>
      

      <div className="flex flex-col h-full w-full">
        {isAssimilating && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-md">
              <span className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xl font-bold text-[var(--text-primary)] text-center">{assimilationStatus}</p>
              
              {/* Progress Bar Container */}
              <div className="w-full h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2">{progressPercentage}% Complete</p>
            </div>
          </div>
        )}
        
        

                <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-6 min-h-0">
          

          {activeSources.length === 0 && (
            <div className="shrink-0 px-4 pt-6 pb-4 sm:px-8 sm:pt-8 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-[var(--accent-solid)] text-lg font-bold">&gt;_</span>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Your Desks</h1>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] font-mono">// pick up where you left off, or start something new</p>
              </div>
              {workspaces.length > 0 && (
                <button
                  onClick={() => {
                    setActiveWorkspaceId(null);
                    setActiveWorkspaceName("Untitled Workspace");
                    setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                    setIsAddSourceModalOpen(true);
                  }}
                  className="shrink-0 text-[var(--text-primary)] font-bold text-sm px-4 py-2.5 rounded-lg transition-transform hover:scale-[1.03] whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #C2410C)', boxShadow: '0 4px 14px -4px rgba(234,88,12,0.5)' }}
                >
                  + New Desk
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-8">
            {activeSources.length === 0 ? (
              isLoadingVault ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : workspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
                  <p className="text-[var(--text-secondary)] max-w-sm">You don't have any desks yet. Upload your first document to start one.</p>
                  <button
                    onClick={() => {
                      setActiveWorkspaceId(null);
                      setActiveWorkspaceName("Untitled Workspace");
                      setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                      setIsAddSourceModalOpen(true);
                    }}
                    className="shrink-0 text-[var(--text-primary)] font-bold text-sm px-4 py-2.5 rounded-lg transition-transform hover:scale-[1.03] whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #EA580C, #C2410C)', boxShadow: '0 4px 14px -4px rgba(234,88,12,0.5)' }}
                  >
                    + Start Your First Desk
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {workspaces.map(ws => (
                    <div key={ws.id} className="relative">
                      {editingDeskId === ws.id ? (
                        <div className="bg-[var(--bg-surface-alt)] border border-orange-500 p-3 rounded-xl flex flex-col gap-1">
                          <input
                            autoFocus
                            value={editingDeskTitle}
                            onChange={e => setEditingDeskTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitDeskRename(ws.id);
                              if (e.key === 'Escape') setEditingDeskId(null);
                            }}
                            onBlur={() => submitDeskRename(ws.id)}
                            className="bg-transparent text-[var(--text-primary)] border-none outline-none font-bold w-full"
                          />
                          <span className="text-xs text-[var(--text-secondary)]">{ws.documents?.length || 0} documents</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectWorkspace(ws)}
                          className="relative w-full overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-orange-500/60 p-4 rounded-2xl text-left flex flex-col gap-2 transition-colors"
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #EA580C, transparent)' }}></div>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center text-sm">🗂️</div>
                              <span className="font-bold truncate">{ws.title}</span>
                            </div>
                            <div
                              onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === ws.id ? null : ws.id); }}
                              className="p-1 hover:bg-gray-800 rounded z-10 transition-colors shrink-0"
                            >
                              <MoreVertical className="w-5 h-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
                            </div>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] font-mono pl-10">{ws.documents?.length || 0} documents</span>
                        </button>
                      )}

                      {activeDropdownId === ws.id && (
                        <div className="absolute top-10 right-2 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg z-20 flex flex-col overflow-hidden shadow-lg">
                          <button onClick={(e) => { e.stopPropagation(); setEditingDeskId(ws.id); setEditingDeskTitle(ws.title); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-[var(--text-primary)] text-left transition-colors">Rename</button>
                          <button onClick={(e) => { e.stopPropagation(); setWorkspaceToDelete(ws.id); setActiveDropdownId(null); }} className="px-4 py-2 text-sm text-red-500 hover:bg-red-950/30 hover:text-red-400 text-left transition-colors border-t border-gray-800">Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <CommandCenterUI
                workspaceId={activeWorkspaceId || ''}
                title={activeWorkspaceName || (activeSources.length > 0 ? activeSources[0].title : 'Untitled Workspace')}
                activeSources={activeSources}
                onRemoveSource={(id) => {
                  setActiveSources(prev => prev.filter(s => s.id !== id));
                }}
                onAddSource={() => {
                  setActiveWorkspaceId(null);
                  setActiveWorkspaceName("Untitled Workspace");
                  setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                  setIsAddSourceModalOpen(true);
                  setSourceModalView('options');
                }}
                onExit={() => { 
                  setActiveWorkspaceId(null);
                  setActiveSources([]); 
                  setActiveWorkspaceName("Untitled Workspace"); 
                  setMessages([{ id: '1', role: 'assistant', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.' } as any]);
                }}
                onYouTubeSubmit={handleYouTubeSubmit}
                onRetry={handleRetryMessage}
                chatMessages={messages.map(m => ({ role: m.role, text: m.parts ? m.parts.map(p => (p as any).text).join('') : (m as any).content || '' }))}
                chatInput={input}
                setChatInput={setInput}
                onSendMessage={() => {
                  if (!input.trim() || isLoading) return;
                  console.log('🚀 Sending to backend - Workspace ID:', activeWorkspaceId, 'Sources attached:', activeSources);
                  sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any, {
                    body: {
                      activeSources,
                      workspaceId: activeWorkspaceId,
                      userProfile: {
                        name: context?.name || 'Guest',
                        school: context?.school || '',
                        department: context?.department || '',
                        courses: context?.profile?.semesters?.find((s: any) => s.isActive)?.courses || []
                      }
                    }
                  });
                  setInput('');
                }}
                isChatLoading={isLoading}
                isAssimilating={isAssimilating}
                assimilationStatus={assimilationStatus}
                onUpdateTitle={setActiveWorkspaceName}
                chatError={error}
                isWorkspaceReady={!!activeWorkspaceId}
              />
            )}
          </div>
        </div>

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
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Delete Workspace?</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-6">Are you sure? This will delete all documents and chat history permanently.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setWorkspaceToDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleDeleteWorkspace} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-[var(--text-primary)] hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}

