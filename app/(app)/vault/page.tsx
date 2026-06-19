"use client";
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, getDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useUploadThing } from '../../../utils/uploadthing';
import { Pencil, Plus, RefreshCcw, ThumbsUp, ThumbsDown, LayoutGrid, List, Trash2, Calendar, MoreVertical, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useThrottle } from '../../hooks/useThrottle';
import { checkClash } from '../../../lib/utils/timetable';

export type VaultChatMessage = { role: 'ai' | 'user' | 'system'; content: string; type?: string; feedback?: 'up' | 'down'; action?: string; payload?: any; };

export default function DashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<Array<{id: string, title: string, updatedAt: any}>>([]);

  // Console state
  const [messages, setMessages] = useState<VaultChatMessage[]>([{role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.'}]);
  const [consoleInput, setConsoleInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  const [vaultFiles, setVaultFiles] = useState<any[]>([]);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");

  // Vault state
  const [activeTab, setActiveTab] = useState<'courses' | 'timetable' | 'materials'>('courses');
  const [timetables, setTimetables] = useState<any[]>([]);
  const [pendingClashes, setPendingClashes] = useState<any[] | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  
  // Courses state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingPhaseIndex, setExtractingPhaseIndex] = useState(0);
  const [manualCourseCode, setManualCourseCode] = useState('');
  const [manualCourseTitle, setManualCourseTitle] = useState('');
  const [manualCourseSemester, setManualCourseSemester] = useState('First');
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Materials state
  const [selectedCategory, setSelectedCategory] = useState<'Note' | 'Assignment' | 'Audio' | 'Video'>('Note');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Flashcard state
  const [activeFileDropdown, setActiveFileDropdown] = useState<string | null>(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeFlashcardTitle, setActiveFlashcardTitle] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Study Guide state
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [isStudyGuideModalOpen, setIsStudyGuideModalOpen] = useState(false);
  const [studyGuideConstraint, setStudyGuideConstraint] = useState('');
  const [isGeneratingStudyGuide, setIsGeneratingStudyGuide] = useState(false);
  const [isStudyGuideViewOpen, setIsStudyGuideViewOpen] = useState(false);
  const [activeStudyGuide, setActiveStudyGuide] = useState<any>(null);
  const [openStudyGuideDropdowns, setOpenStudyGuideDropdowns] = useState<string[]>([]);
  const [isTimetableUploading, setIsTimetableUploading] = useState(false);
  const [isExtractingTimetable, setIsExtractingTimetable] = useState(false);
  const [showRawTimetable, setShowRawTimetable] = useState(false);
  const [showManualTimetable, setShowManualTimetable] = useState(false);
  const [manualTimetableCourseCode, setManualTimetableCourseCode] = useState('');
  const [manualTimetableCourseTitle, setManualTimetableCourseTitle] = useState('');
  const [manualTimetableDay, setManualTimetableDay] = useState('Monday');
  const [manualTimetableTime, setManualTimetableTime] = useState('08:00 AM');
  const [manualTimetableEndTime, setManualTimetableEndTime] = useState('09:00 AM');
  const timetableInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: startTimetableUpload } = useUploadThing("vaultUploader", {
    onUploadError: (error) => {
      setToastMessage(`Error: ${error.message}`);
      setIsTimetableUploading(false);
    }
  });

  const { startUpload: startCourseUpload } = useUploadThing("vaultUploader", {
    onUploadError: (error) => {
      setToastMessage(`Upload Error: ${error.message}`);
      setIsExtracting(false);
    }
  });

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
    onClientUploadComplete: () => {
      router.refresh();
    },
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profile = null;
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            profile = userSnap.data();
            
            // Fetch timetables
            const timetablesSnap = await getDoc(doc(db, 'timetables', user.uid));
            if (timetablesSnap.exists()) {
              const fetchedClasses = timetablesSnap.data().scheduled_classes || [];
              const classesWithIds = fetchedClasses.map((c: any) => c.id ? c : { ...c, id: Date.now().toString(36) + Math.random().toString(36).substring(2) });
              setTimetables(classesWithIds);
            }
            
            // Legacy Migration: flat `courses` array -> `semesters` array
            let needsMigration = false;
            if (!profile.semesters || profile.semesters.length === 0) {
              needsMigration = true;
              profile.semesters = [{
                semesterId: 'current_semester_01',
                title: 'Current Semester',
                isActive: true,
                courses: (profile.courses && Array.isArray(profile.courses)) ? profile.courses : [],
                timetableUrl: ''
              }];
            }
            if (needsMigration) {
              await updateDoc(userRef, { semesters: profile.semesters });
            }
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
        }
        setUserData({ name: profile?.username || user.displayName || 'Student', email: user.email || '', uid: user.uid, profile });
        
        // Fetch Vault Files
        try {
          const vq = query(collection(db, 'vault_files'), where('userId', '==', user.uid));
          const vaultSnap = await getDocs(vq);
          const vFiles = vaultSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setVaultFiles(vFiles);
        } catch(e) { console.error(e) }

        // Fetch Chat List
        try {
          const q = query(collection(db, 'chats'), where('userId', '==', user.uid));
          const chatSnap = await getDocs(q);
          const chats = chatSnap.docs.map(d => ({ id: d.id, title: d.data().title, updatedAt: d.data().updatedAt?.toMillis() || 0 }));
          chats.sort((a, b) => b.updatedAt - a.updatedAt);
          setChatList(chats);
        } catch (error) {
          console.error("Error fetching chats:", error);
        }

        // Fetch Study Guides
        try {
          const sq = query(collection(db, 'study_guides'), where('userId', '==', user.uid));
          const studyGuideSnap = await getDocs(sq);
          const sGuides = studyGuideSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          sGuides.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setStudyGuides(sGuides);
        } catch(e) { console.error(e) }
      } else {
        setUserData({ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null });
        setChatList([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleAddManualCourseCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCourseCode.trim() || !manualCourseTitle.trim() || !userData.uid) return;
    
    try {
      const userRef = doc(db, 'users', userData.uid);
      const newCourse = { courseCode: manualCourseCode.toUpperCase(), courseTitle: manualCourseTitle, semester: manualCourseSemester };
      
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;
      
      const activeSem = semesters[activeSemIdx];
      if (activeSem.courses.some((c: any) => c.courseCode === newCourse.courseCode)) {
        setToastMessage("Course already exists in this semester!");
        return;
      }
      
      activeSem.courses.push(newCourse);
      
      await updateDoc(userRef, { semesters });
      
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setManualCourseCode('');
      setManualCourseTitle('');
    } catch(err) { console.error(err); }
  };

  const { throttledFunction: handleAddManualCourse, isThrottled: isAddingCourse } = useThrottle(handleAddManualCourseCore);

  const handleDropCourse = async (courseCode: string) => {
    if (!userData.uid) return;
    try {
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;
      
      semesters[activeSemIdx].courses = semesters[activeSemIdx].courses.filter((c: any) => c.courseCode !== courseCode);
      
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
    } catch(err) { console.error(err); }
  };

  const handleToggleCourseSelection = (courseCode: string) => {
    setSelectedCourseCodes(prev => prev.includes(courseCode) ? prev.filter(c => c !== courseCode) : [...prev, courseCode]);
  };

  const handleToggleSemesterSelection = (semesterCourses: any[], isAllSelected: boolean) => {
    const codes = semesterCourses.map(c => c.courseCode);
    if (isAllSelected) {
      setSelectedCourseCodes(prev => prev.filter(c => !codes.includes(c)));
    } else {
      setSelectedCourseCodes(prev => Array.from(new Set([...prev, ...codes])));
    }
  };

  const handleBulkDeleteCourses = async () => {
    if (selectedCourseCodes.length === 0 || !userData.uid) return;
    
    try {
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;
      
      semesters[activeSemIdx].courses = semesters[activeSemIdx].courses.filter((c: any) => !selectedCourseCodes.includes(c.courseCode));
      
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setSelectedCourseCodes([]);
    } catch(err) { console.error(err); }
  };

  const processCourseFile = async (file: File) => {
    if (!userData.uid) return;
    
    setIsExtracting(true);
    try {
      // Step 1: Upload the file to UploadThing first
      const res = await startCourseUpload([file]);
      if (!res || res.length === 0) {
        throw new Error("File upload to secure server failed.");
      }
      // Step 2: Wait for response to get the secure file url
      const fileUrl = res[0].url;

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) throw new Error("No active semester found.");

      // Step 3 & 4: Send API request with URL, backend fetches and updates Firestore
      const extractRes = await fetch('/api/engine/extract-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileUrl, 
          userId: userData.uid, 
          semesterId: semesters[activeSemIdx].semesterId 
        })
      });
      
      let data;
      try {
        data = await extractRes.json();
      } catch (e) {
        // Ignore JSON parse error if HTML is returned
      }

      if (!extractRes.ok) {
        throw new Error(data?.error || `API Error: ${extractRes.status} ${extractRes.statusText}`);
      }
      
      if (data.courses && Array.isArray(data.courses)) {
        const activeSem = semesters[activeSemIdx];
        const newCourses = data.courses.filter((c: any) => !activeSem.courses.some((ext: any) => ext.courseCode === c.courseCode));
        if (newCourses.length > 0) {
          activeSem.courses = [...activeSem.courses, ...newCourses];
          const userRef = doc(db, 'users', userData.uid);
          await updateDoc(userRef, { semesters });
          setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
        }
      }
      
    } catch(err: any) {
      console.error(err);
      const errorMessage = err.message || "";
      
      if (errorMessage.includes("503") || errorMessage.includes("Service Unavailable") || errorMessage.includes("fetch failed")) {
        setToastMessage("Our AI is currently analyzing a high volume of course registration forms. Please wait a few seconds and try again.");
      } else if (errorMessage.includes("invalid_document")) {
        setToastMessage("Please upload a valid course form. We couldn't find your courses in this document.");
      } else if (errorMessage.includes("Unexpected token") || errorMessage.includes("JSON")) {
        setToastMessage("We had trouble reading that specific document format. Please try uploading a clearer image or enter the courses manually.");
      } else {
        setToastMessage(errorMessage || "Something went wrong on our end. Please try again or use the manual entry option.");
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTimetableUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData.uid) return;
    
    setIsTimetableUploading(true);
    setIsExtractingTimetable(true);
    try {
      const reader = new FileReader();
      
      const extractedTimetable = await new Promise<any>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const res = await fetch('/api/engine/extract-timetable', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type })
            });
            const data = await res.json();
            if (!res.ok) {
              reject(new Error(data.error || "Failed to extract timetable"));
              return;
            }
            resolve(data.timetable);
          } catch(err) {
            reject(err);
          }
        };
        reader.onerror = reject;
      });

      // Since extraction succeeded, we safely upload the file
      const uploadRes = await startTimetableUpload([file]);
      
      let finalTimetableUrl = '';
      if (uploadRes && uploadRes.length > 0) {
        finalTimetableUrl = uploadRes[0].url;
      } else {
        setToastMessage("Timetable image upload failed.");
      }

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      
      if (finalTimetableUrl && activeSemIdx !== -1) {
        semesters[activeSemIdx].timetableUrl = finalTimetableUrl;
        const userRef = doc(db, 'users', userData.uid);
        await updateDoc(userRef, { semesters });
        setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      }

      if (extractedTimetable && Array.isArray(extractedTimetable)) {
        const currentTimetables = [...timetables];
        const newClasses = [];
        const clashingClasses = [];

        for (const cls of extractedTimetable) {
          const formattedClass = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            courseCode: cls.courseCode || '',
            courseTitle: cls.courseTitle || '',
            day: cls.day || '',
            startTime: cls.startTime || cls.time || '',
            endTime: cls.endTime || '',
            location: cls.location || cls.venue || ''
          };
          
          if (!formattedClass.courseCode || !formattedClass.day || !formattedClass.startTime) continue;
          
          const clashResult = checkClash(formattedClass, currentTimetables);
          if (clashResult.hasClash) {
            clashingClasses.push({ ...formattedClass, clashingWith: clashResult.clashingCourse });
          } else {
            newClasses.push(formattedClass);
            currentTimetables.push(formattedClass);
          }
        }

        if (newClasses.length > 0) {
          const ttRef = doc(db, 'timetables', userData.uid);
          const ttSnap = await getDoc(ttRef);
          if (ttSnap.exists()) {
            await updateDoc(ttRef, { scheduled_classes: currentTimetables });
          } else {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(ttRef, { scheduled_classes: currentTimetables });
          }
          setTimetables(currentTimetables);
        }

        if (clashingClasses.length > 0) {
          setPendingClashes(clashingClasses);
        } else if (newClasses.length > 0) {
          setToastMessage("Timetable extracted and saved successfully!");
        }
      }
      
    } catch(err: any) {
      console.error(err);
      if (err.message?.includes("400")) {
        setToastMessage("Extraction Failed: The image format is not supported or the document is invalid.");
      } else if (err.message?.includes("No timetable detected")) {
        setToastMessage("Extraction Failed: We couldn't detect a valid timetable in that document. Please try a different image or file.");
      } else {
        setToastMessage("Extraction Failed: Could not extract timetable data automatically.");
      }
    } finally {
      setIsTimetableUploading(false);
      setIsExtractingTimetable(false);
      if (timetableInputRef.current) timetableInputRef.current.value = '';
    }
  };

  const handleOverrideClashes = async () => {
    if (!pendingClashes || !userData.uid) return;
    try {
      const currentTimetables = [...timetables, ...pendingClashes.map(c => {
        const { clashingWith, ...rest } = c;
        return { ...rest, id: rest.id || Date.now().toString(36) + Math.random().toString(36).substring(2) };
      })];
      
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: currentTimetables });
      setTimetables(currentTimetables);
      setPendingClashes(null);
      setToastMessage("Clashing classes overridden and saved.");
    } catch(err) {
      console.error(err);
    }
  };

  const handleDiscardClashes = () => {
    setPendingClashes(null);
  };

  const handleAddManualTimetableCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.uid || !manualTimetableCourseCode.trim() || !manualTimetableCourseTitle.trim()) return;

    try {
      const newClass = {
        id: editingClassId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        day: manualTimetableDay,
        startTime: manualTimetableTime,
        endTime: manualTimetableEndTime,
        courseCode: manualTimetableCourseCode.toUpperCase(),
        courseTitle: manualTimetableCourseTitle,
        location: ''
      };
      
      let newScheduledClasses;
      if (editingClassId) {
        newScheduledClasses = timetables.map(cls => cls.id === editingClassId ? newClass : cls);
      } else {
        newScheduledClasses = [...timetables, newClass];
      }
      
      const ttRef = doc(db, 'timetables', userData.uid);
      const ttSnap = await getDoc(ttRef);
      if (ttSnap.exists()) {
        await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      } else {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(ttRef, { scheduled_classes: newScheduledClasses });
      }
      
      setTimetables(newScheduledClasses);
      setManualTimetableCourseCode('');
      setManualTimetableCourseTitle('');
      setEditingClassId(null);
      setShowManualTimetable(false);
      setToastMessage(editingClassId ? "Class updated successfully!" : "Class added successfully!");
    } catch(err) {
      console.error(err);
    }
  };

  const handleEditClass = (cls: any) => {
    setManualTimetableCourseCode(cls.courseCode);
    setManualTimetableCourseTitle(cls.courseTitle || '');
    setManualTimetableDay(cls.day);
    setManualTimetableTime(cls.startTime);
    setManualTimetableEndTime(cls.endTime || '');
    setEditingClassId(cls.id);
    setShowManualTimetable(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClass = async (id: string) => {
    if (!userData.uid) return;
    try {
      const newScheduledClasses = timetables.filter(c => c.id !== id);
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      setTimetables(newScheduledClasses);
      setSelectedClasses(prev => prev.filter(selectedId => selectedId !== id));
      setToastMessage("Class deleted successfully.");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete class.");
    }
  };

  const handleBulkDelete = async () => {
    if (!userData.uid || selectedClasses.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedClasses.length} classes?`)) return;
    try {
      const newScheduledClasses = timetables.filter(c => !selectedClasses.includes(c.id));
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
      setTimetables(newScheduledClasses);
      setSelectedClasses([]);
      setToastMessage(`Deleted ${selectedClasses.length} classes.`);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete selected classes.");
    }
  };

  const toggleClassSelection = (id: string) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const handleClearTimetableClick = () => {
    setIsClearModalOpen(true);
  };

  const handleClearTimetableConfirm = async () => {
    if (!userData.uid) return;
    try {
      const ttRef = doc(db, 'timetables', userData.uid);
      await updateDoc(ttRef, { scheduled_classes: [] });
      setTimetables([]);
      setSelectedClasses([]);
      setEditingClassId(null);
      setIsClearModalOpen(false);
      setToastMessage("Timetable cleared successfully.");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to clear timetable.");
    }
  };

  const { throttledFunction: handleAddManualTimetable, isThrottled: isAddingTimetable } = useThrottle(handleAddManualTimetableCore);

  const handleOpenStudyGuideModal = (file: any) => {
    setActiveFileDropdown(null);
    if (!file.downloadURL) {
      setToastMessage("Cannot generate study guide: Document must be uploaded first.");
      return;
    }
    setActiveDocumentId(file.id);
    setStudyGuideConstraint('');
    setIsStudyGuideModalOpen(true);
  };

  const handleGenerateStudyGuide = async () => {
    if (!studyGuideConstraint.trim()) {
      setToastMessage("Please enter a section to cover.");
      return;
    }
    
    const file = vaultFiles.find(f => f.id === activeDocumentId);
    if (!file) return;

    setIsGeneratingStudyGuide(true);
    
    try {
      const res = await fetch('/api/engine/generate-study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: file.downloadURL, sectionConstraint: studyGuideConstraint })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to generate study guide.");
      
      const newGuide = {
        userId: userData.uid,
        sourceDocumentId: file.id,
        sourceDocumentName: file.fileName,
        sectionConstraint: studyGuideConstraint,
        markdownContent: data.studyGuide,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'study_guides'), newGuide);
      
      const fullGuide = { id: docRef.id, ...newGuide, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
      
      setStudyGuides(prev => [fullGuide, ...prev]);
      
      setIsStudyGuideModalOpen(false);
      setActiveStudyGuide(fullGuide);
      setIsStudyGuideViewOpen(true);
      
    } catch(err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to generate study guide.");
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  const handleGenerateFlashcardsFromGuide = async () => {
    if (!activeStudyGuide) return;
    
    setIsGeneratingFlashcards(true);
    setFlashcards([]);
    setCurrentFlashcardIndex(0);
    setIsFlipped(false);
    setActiveFlashcardTitle(`${activeStudyGuide.sourceDocumentName} - ${activeStudyGuide.sectionConstraint} Flashcards`);
    setFlashcardModalOpen(true);
    
    try {
      let res;
      try {
        res = await fetch('/api/engine/generate-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: activeStudyGuide.markdownContent })
        });
      } catch (networkErr: any) {
        console.error("Network Error:", networkErr);
        throw new Error("Could not connect to the server. The request may have timed out.");
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate flashcards from server.");
      
      setFlashcards(data.flashcards);
    } catch(err: any) {
      console.error("Flashcard Gen Error:", err);
      setToastMessage(err.message || "Failed to generate flashcards.");
      setFlashcardModalOpen(false);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGenerateFlashcards = async (file: any) => {
    setActiveFileDropdown(null);
    if (!file.downloadURL) {
      setToastMessage("Cannot generate flashcards: Document must be uploaded first.");
      return;
    }
    
    setIsGeneratingFlashcards(true);
    setFlashcards([]);
    setCurrentFlashcardIndex(0);
    setIsFlipped(false);
    setActiveFlashcardTitle(`${file.fileName.split('.')[0]} Flashcards`);
    setActiveDocumentId(file.id);
    setFlashcardModalOpen(true);
    
    try {
      let res;
      try {
        res = await fetch('/api/engine/generate-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: file.downloadURL })
        });
      } catch (networkErr: any) {
        console.error("Network Error:", networkErr);
        throw new Error("Could not connect to the server. The request may have timed out.");
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate flashcards from server.");
      
      setFlashcards(data.flashcards);
    } catch(err: any) {
      console.error("Flashcard Gen Error:", err);
      setToastMessage(err.message || "Failed to generate flashcards.");
      setFlashcardModalOpen(false);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleDeleteVaultFile = async (id: string) => {
    setActiveFileDropdown(null);
    if (!userData.uid) return;
    try {
      await deleteDoc(doc(db, 'materials', id));
      setVaultFiles(prev => prev.filter(m => m.id !== id));
      setToastMessage("File deleted successfully from your Vault.");
    } catch (err) {
      console.error("Error deleting file:", err);
      setToastMessage("Failed to delete file.");
    }
  };

  const handleSaveDeck = async () => {
    if (!userData.uid || flashcards.length === 0) return;
    try {
      await addDoc(collection(db, 'flashcards'), {
        userId: userData.uid,
        deckId: Date.now().toString(36) + Math.random().toString(36).substring(2),
        sourceDocumentId: activeDocumentId,
        title: activeFlashcardTitle,
        cards: flashcards,
        createdAt: serverTimestamp()
      });
      setToastMessage("Flashcard deck saved successfully!");
      setFlashcardModalOpen(false);
    } catch(err) {
      console.error(err);
      setToastMessage("Failed to save flashcards.");
    }
  };

  const handleUploadToVaultCore = async () => {
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
              category: selectedCategory,
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

  const { throttledFunction: handleUploadToVault, isThrottled: isUploadingThrottled } = useThrottle(handleUploadToVaultCore);

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

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!currentChatId) {
        setMessages([{role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.'}]);
        return;
      }
      try {
        const chatDoc = await getDoc(doc(db, 'chats', currentChatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages([{role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.'}]);
          }
        }
      } catch (error) {
        console.error("Failed to load chat", error);
      }
    };

    fetchChatHistory();
  }, [currentChatId]);

  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setIsConsoleOpen(true);
  };

  const submitQuery = async (userMessage: string, historyPrefix?: Array<VaultChatMessage>) => {
    if (isQuerying) return;
    const baseMessages = historyPrefix || messages;
    const history = baseMessages.filter(m => m.type !== 'action_required').slice(-10);
    
    const newUserMsg: VaultChatMessage = { role: 'user', content: userMessage };
    const updatedMessages = [...baseMessages, newUserMsg];
    
    setMessages(updatedMessages);
    setIsQuerying(true);

    try {
      const response = await fetch('/api/engine/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, userId: userData.uid, chatHistory: history, userProfile: userData.profile })
      });
      const data = await response.json();
      
      let newAiMsg: VaultChatMessage;
      if (data.type === 'action_required') {
        let content = '';
        if (data.action === 'add_course') {
          content = `I can add ${data.payload.courseCode} - ${data.payload.courseTitle} to your ${data.payload.semester} semester.`;
        } else if (data.action === 'delete_course') {
          content = `I can remove ${data.payload.courseCode} from your active semester.`;
        } else if (data.action === 'add_to_timetable') {
          content = `I can add ${data.payload.courseCode} to your timetable on ${data.payload.day} from ${data.payload.startTime} to ${data.payload.endTime}.`;
        }
        newAiMsg = { 
          role: 'ai', 
          content,
          type: 'action_required',
          action: data.action,
          payload: data.payload,
          ...(data.error ? { error: data.error } : {})
        } as any;
      } else {
        newAiMsg = { role: 'ai', content: data.answer || data.error };
      }

      const finalMessages = [...updatedMessages, newAiMsg];
      
      setMessages(finalMessages);

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

  const executeAction = async (msgIndex: number, action: string, payload: any, confirm: boolean) => {
    if (!userData.uid || !userData.profile || !userData.profile.semesters) return;
    
    if (!confirm) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Action cancelled.' }]);
      return;
    }

    try {
      const semesters = [...userData.profile.semesters];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) {
        setToastMessage("No active semester found.");
        return;
      }
      
      const activeSem = semesters[activeSemIdx];
      
      if (action === 'add_course') {
        if (!activeSem.courses.some((c: any) => c.courseCode === payload.courseCode)) {
          activeSem.courses.push({ courseCode: payload.courseCode, courseTitle: payload.courseTitle, semester: payload.semester });
        }
      } else if (action === 'delete_course') {
        activeSem.courses = activeSem.courses.filter((c: any) => c.courseCode !== payload.courseCode);
      } else if (action === 'add_to_timetable') {
        const newClass = {
          day: payload.day,
          startTime: payload.startTime,
          endTime: payload.endTime,
          courseCode: payload.courseCode.toUpperCase(),
          courseTitle: '',
          location: ''
        };
        const newScheduledClasses = [...timetables, newClass];
        const ttRef = doc(db, 'timetables', userData.uid);
        const ttSnap = await getDoc(ttRef);
        if (ttSnap.exists()) {
          await updateDoc(ttRef, { scheduled_classes: newScheduledClasses });
        } else {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(ttRef, { scheduled_classes: newScheduledClasses });
        }
        setTimetables(newScheduledClasses);
      }

      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { semesters });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      
      setMessages(prev => [...prev, { role: 'ai', content: 'Action completed successfully.' }]);
    } catch (err: any) {
      console.error(err);
      setToastMessage("Failed to execute action.");
    }
  };

  const handleConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim() || isQuerying) return;
    const msg = consoleInput;
    setConsoleInput('');
    await submitQuery(msg);
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
      } catch(e) { console.error("Failed to save feedback", e); }
    }
  };

  const extractionPhases = ['Uploading document...', 'Scanning document structure...', 'Analyzing course codes...', 'Optimizing for high traffic...', 'Finalizing extraction...'];
  
  useEffect(() => {
    let interval: any;
    if (isExtracting) {
      setExtractingPhaseIndex(0);
      interval = setInterval(() => {
        setExtractingPhaseIndex(prev => (prev < extractionPhases.length - 1 ? prev + 1 : prev));
      }, 3000);
    } else {
      setExtractingPhaseIndex(0);
    }
    return () => clearInterval(interval);
  }, [isExtracting]);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes indeterminate-bar {
          0% { left: -30%; }
          100% { left: 100%; }
        }
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
          .console-panel { position: static; width: 100%; max-width: 400px; right: 0; transition: none; display: none; flex-shrink: 0; border-left: 1px solid #27272A; }
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
                    setMessages([{role: 'ai', content: 'Acknowledged. I am >_console. Ask me anything about your uploaded materials.'}]);
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
              <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '-0.05em' }}>My Vault</h1>
              <p style={{ color: '#A1A1AA', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>Your Student Operating System.</p>
            </div>
            <button onClick={() => setIsConsoleOpen(!isConsoleOpen)} className="desktop-toggle-btn" style={{ color: isConsoleOpen ? '#A1A1AA' : '#EA580C' }}>
              <span style={{ color: '#EA580C' }}>&gt;_</span> {isConsoleOpen ? 'Close Console' : 'Open Console'}
            </button>
          </header>

          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '1rem' }}>
            <button onClick={() => setActiveTab('courses')} style={{ background: 'none', border: 'none', color: activeTab === 'courses' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'courses' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'courses' ? '2px solid #EA580C' : '2px solid transparent' }}>My Courses</button>
            <button onClick={() => setActiveTab('timetable')} style={{ background: 'none', border: 'none', color: activeTab === 'timetable' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'timetable' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'timetable' ? '2px solid #EA580C' : '2px solid transparent' }}>My Timetable</button>
            <button onClick={() => setActiveTab('materials')} style={{ background: 'none', border: 'none', color: activeTab === 'materials' ? 'white' : '#A1A1AA', fontWeight: activeTab === 'materials' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', padding: '0.5rem 1rem', borderBottom: activeTab === 'materials' ? '2px solid #EA580C' : '2px solid transparent' }}>Lecture Materials</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {activeTab === 'courses' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Extract from Portal</h3>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload a screenshot of your course registration to auto-fill.</p>
                  
                  <div 
                    onDragOver={handleDragOver} 
                    onDragLeave={handleDragLeave} 
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processCourseFile(e.dataTransfer.files[0]);
                      }
                    }}
                    style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', textAlign: 'center', position: 'relative', transition: 'all 0.2s' }}
                  >
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processCourseFile(e.target.files[0]);
                      }
                    }} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
                    <span style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: 'bold' }}>{isDragging ? 'Drop form here...' : '+ Select Registration Form'}</span>
                    <p style={{ color: '#71717A', fontSize: '0.75rem', margin: '0.5rem 0 0 0' }}>PNG, JPG, PDF</p>
                  </div>
                  
                  {isExtracting && (
                    <div style={{ backgroundColor: '#27272A', padding: '1.5rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ color: '#E4E4E7', fontWeight: '500', fontSize: '0.95rem' }}>
                          {extractionPhases[extractingPhaseIndex]}
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '4px', backgroundColor: '#3F3F46', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', backgroundColor: '#EA580C', borderRadius: '2px', animation: 'indeterminate-bar 1.5s infinite ease-in-out' }}></div>
                      </div>
                      
                      <p style={{ color: '#71717A', fontSize: '0.75rem', margin: 0 }}>
                        This usually takes a few seconds, but may take up to 30 seconds during high network traffic.
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Manual Entry</h3>
                  <form onSubmit={handleAddManualCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="text" placeholder="Course Code (e.g., CS101)" value={manualCourseCode} onChange={e => setManualCourseCode(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} />
                    <input type="text" placeholder="Course Title" value={manualCourseTitle} onChange={e => setManualCourseTitle(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} />
                    <select value={manualCourseSemester} onChange={e => setManualCourseSemester(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                      <option value="First">First Semester</option>
                      <option value="Second">Second Semester</option>
                    </select>
                    <button type="submit" style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Add Course</button>
                  </form>
                </div>
                
                {toastMessage && (
                  <div style={{ gridColumn: '1 / -1', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#FCA5A5', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{toastMessage}</span>
                    <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </div>
                )}

                <div style={{ gridColumn: '1 / -1', backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Registered Courses</h3>
                     {selectedCourseCodes.length > 0 && (
                       <button onClick={handleBulkDeleteCourses} style={{ backgroundColor: '#DC2626', color: 'white', border: '1px solid #B91C1C', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <Trash2 size={16} /> Delete Selected ({selectedCourseCodes.length})
                       </button>
                     )}
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                     {(() => {
                        const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                        if (!activeSem || !activeSem.courses) return <p style={{ color: '#A1A1AA' }}>No courses added yet for the active academic year.</p>;
                        
                        const firstSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'First');
                        const secondSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'Second');

                        const renderCourse = (course: any, i: number) => {
                          const isSelected = selectedCourseCodes.includes(course.courseCode);
                          return (
                            <div key={i} className={`flex items-center justify-between w-full p-3 sm:p-4 rounded-xl mb-3 gap-3 overflow-hidden transition-all ${isSelected ? 'bg-zinc-800 border border-orange-600' : 'bg-gray-900 border border-transparent hover:border-gray-700'}`}>
                              
                              {/* 1. Left: Checkbox (Protected from shrinking) */}
                              <div className="shrink-0 flex items-center justify-center">
                                <input type="checkbox" checked={isSelected} onChange={() => handleToggleCourseSelection(course.courseCode)} className="accent-orange-600 w-4 h-4 sm:w-5 sm:h-5 cursor-pointer" />
                              </div>

                              {/* 2. Middle: Stacked Text Container (Allows shrinking and wrapping) */}
                              <div className="flex flex-col flex-1 min-w-0">
                                {/* Course Code (Title) */}
                                <span className="text-orange-500 font-bold text-base leading-tight">
                                  {course.courseCode}
                                </span>
                                
                                {/* Course Name (Subtitle - Truncated with Ellipsis) */}
                                <span className="text-gray-400 text-sm truncate mt-0.5" title={course.courseTitle}>
                                  {course.courseTitle}
                                </span>
                              </div>

                              {/* 3. Right: Trash Icon (Protected from shrinking) */}
                              <button onClick={() => handleDropCourse(course.courseCode)} className="shrink-0 p-2 text-gray-500 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer" title="Drop Course">
                                <Trash2 size={18} />
                              </button>

                            </div>
                          );
                        };

                        return (
                          <>
                            <div>
                              {firstSemesterCourses.length > 0 ? (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                    <input type="checkbox" checked={firstSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(firstSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All First Semester" />
                                    <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>First Semester</h4>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {firstSemesterCourses.map(renderCourse)}
                                  </div>
                                </>
                              ) : (
                                <p style={{ color: '#71717A', fontSize: '0.9rem', fontStyle: 'italic' }}>No First Semester courses added yet.</p>
                              )}
                            </div>
                            <div>
                              {secondSemesterCourses.length > 0 ? (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                    <input type="checkbox" checked={secondSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(secondSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All Second Semester" />
                                    <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>Second Semester</h4>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {secondSemesterCourses.map(renderCourse)}
                                  </div>
                                </>
                              ) : (
                                <p style={{ color: '#71717A', fontSize: '0.9rem', fontStyle: 'italic' }}>No Second Semester courses added yet.</p>
                              )}
                            </div>
                          </>
                        );
                     })()}
                   </div>
                </div>
              </div>
            )}
            
            {activeTab === 'timetable' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar className="w-5 h-5 mr-2 text-neutral-400" />
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Timetable</h3>
                  </div>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload your class schedule to keep it handy.</p>
                  
                  <input type="file" accept=".pdf,image/*,.docx,.csv,.xls,.xlsx" ref={timetableInputRef} onChange={handleTimetableUpload} style={{ display: 'none' }} />
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => timetableInputRef.current?.click()} disabled={isTimetableUploading || isExtractingTimetable} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', opacity: (isTimetableUploading || isExtractingTimetable) ? 0.5 : 1 }}>
                      {isExtractingTimetable ? 'Analyzing timetable...' : isTimetableUploading ? 'Uploading...' : (userData.profile?.semesters?.find((s: any) => s.isActive)?.timetableUrl ? 'Replace Timetable' : 'Add Timetable')}
                    </button>
                    <button onClick={() => setShowManualTimetable(!showManualTimetable)} style={{ backgroundColor: showManualTimetable ? '#27272A' : '#18181B', color: 'white', border: '1px solid #27272A', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                      {showManualTimetable ? 'Cancel Manual Entry' : 'Add Manually'}
                    </button>
                    {timetables.length > 0 && (
                      <button onClick={handleClearTimetableClick} style={{ backgroundColor: 'transparent', color: '#EF4444', border: '1px solid #EF4444', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Clear Timetable
                      </button>
                    )}
                  </div>

                  {showManualTimetable && (
                    <form onSubmit={handleAddManualTimetable} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #27272A', width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                      <input type="text" placeholder="Course Code (e.g., CS101)" value={manualTimetableCourseCode} onChange={e => setManualTimetableCourseCode(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} required />
                      <input type="text" placeholder="Course Title" value={manualTimetableCourseTitle} onChange={e => setManualTimetableCourseTitle(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }} required />
                      <select value={manualTimetableDay} onChange={e => setManualTimetableDay(e.target.value)} style={{ backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                      </select>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select title="Start Time" value={manualTimetableTime} onChange={e => setManualTimetableTime(e.target.value)} style={{ flex: 1, backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                          {Array.from({ length: 15 }).map((_, i) => {
                            const hour = i + 7; // 7 AM to 9 PM
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour > 12 ? hour - 12 : hour;
                            const t1 = `${displayHour < 10 ? '0' : ''}${displayHour}:00 ${ampm}`;
                            const t2 = `${displayHour < 10 ? '0' : ''}${displayHour}:30 ${ampm}`;
                            return <React.Fragment key={i}><option value={t1}>{t1}</option><option value={t2}>{t2}</option></React.Fragment>;
                          })}
                        </select>
                        <select title="End Time" value={manualTimetableEndTime} onChange={e => setManualTimetableEndTime(e.target.value)} style={{ flex: 1, backgroundColor: '#111111', color: 'white', border: '1px solid #27272A', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none' }}>
                          {Array.from({ length: 15 }).map((_, i) => {
                            const hour = i + 7; // 7 AM to 9 PM
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour > 12 ? hour - 12 : hour;
                            const t1 = `${displayHour < 10 ? '0' : ''}${displayHour}:00 ${ampm}`;
                            const t2 = `${displayHour < 10 ? '0' : ''}${displayHour}:30 ${ampm}`;
                            return <React.Fragment key={i}><option value={t1}>{t1}</option><option value={t2}>{t2}</option></React.Fragment>;
                          })}
                        </select>
                      </div>
                      <button type="submit" style={{ gridColumn: '1 / -1', backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>{editingClassId ? 'Update Class' : 'Save Class'}</button>
                    </form>
                  )}
                </div>

                {(() => {
                  const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                  
                  return (
                    <>
                      {pendingClashes && pendingClashes.length > 0 && (
                        <div style={{ backgroundColor: 'rgba(153, 27, 27, 0.1)', border: '1px solid #DC2626', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <h4 style={{ color: '#FCA5A5', margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>⚠️ Clashes Detected in Upload</h4>
                          <p style={{ color: '#E4E4E7', fontSize: '0.9rem', margin: 0 }}>The following extracted classes clash with your existing timetable:</p>
                          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {pendingClashes.map((c, i) => (
                              <li key={i} style={{ color: '#A1A1AA', fontSize: '0.85rem', backgroundColor: '#18181B', padding: '0.5rem 1rem', borderRadius: '0.25rem' }}>
                                <span style={{ color: '#EA580C', fontWeight: 'bold' }}>{c.courseCode}</span> on {c.day} at {c.startTime} (Clashes with {c.clashingWith})
                              </li>
                            ))}
                          </ul>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button onClick={handleDiscardClashes} style={{ backgroundColor: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Discard Clashes</button>
                            <button onClick={handleOverrideClashes} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Override & Save All</button>
                          </div>
                        </div>
                      )}
                      {timetables.length > 0 && !showRawTimetable && (() => {
                        // Compute clashes
                        const timetableWithClashes = timetables.map((cls: any, i: number, arr: any[]) => {
                          const isClash = arr.some((otherCls, j) => i !== j && otherCls.day.toLowerCase() === cls.day.toLowerCase() && otherCls.startTime === cls.startTime);
                          return { ...cls, isClash };
                        });
                        
                        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button onClick={() => setShowRawTimetable(true)} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', transition: 'color 0.2s' }}>
                                View Raw File
                              </button>
                            </div>
                            {selectedClasses.length > 0 && (
                              <div style={{ backgroundColor: '#18181B', border: '1px solid #EA580C', borderRadius: '0.75rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedClasses.length} Selected</span>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                  <button onClick={() => setSelectedClasses(timetables.map(c => c.id))} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Select All</button>
                                  <button onClick={() => setSelectedClasses([])} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Deselect All</button>
                                  <button onClick={handleBulkDelete} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Delete Selected</button>
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                              {days.map(day => {
                                const classesForDay = timetableWithClashes.filter((c: any) => c.day.toLowerCase() === day.toLowerCase());
                                if (classesForDay.length === 0) return null;
                                return (
                                  <div key={day} style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <h4 style={{ color: 'white', margin: 0, fontSize: '1.1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>{day}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {classesForDay.map((cls: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', backgroundColor: cls.isClash ? 'rgba(153, 27, 27, 0.1)' : '#18181B', padding: '0.75rem', borderRadius: '0.5rem', border: cls.isClash ? '1px solid rgba(153, 27, 27, 0.5)' : (selectedClasses.includes(cls.id) ? '1px solid #EA580C' : '1px solid #27272A'), transition: 'all 0.2s' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                              <input type="checkbox" checked={selectedClasses.includes(cls.id)} onChange={() => toggleClassSelection(cls.id)} style={{ accentColor: '#EA580C', cursor: 'pointer', marginTop: '0.2rem' }} />
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ color: '#EA580C', fontWeight: 'bold', fontSize: '0.95rem' }}>{cls.courseCode}</span>
                                                {cls.courseTitle && <span className="text-sm text-neutral-400">{cls.courseTitle}</span>}
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                              {cls.location || cls.venue ? (
                                                <span style={{ color: '#A1A1AA', fontSize: '0.75rem' }}>{cls.location || cls.venue}</span>
                                              ) : (
                                                <span style={{ color: '#71717A', fontSize: '0.75rem', padding: '0.1rem 0.4rem', border: '1px solid #27272A', borderRadius: '0.25rem' }}>[ TBD ]</span>
                                              )}
                                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <button onClick={() => handleEditClass(cls)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }} title="Edit">
                                                  <Pencil className="w-3.5 h-3.5 hover:text-white transition-colors" />
                                                </button>
                                                <button onClick={() => handleDeleteClass(cls.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }} title="Delete">
                                                  <Trash2 className="w-3.5 h-3.5 hover:text-red-500 transition-colors" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <span style={{ color: cls.isClash ? '#ef4444' : '#71717A', fontSize: '0.75rem', fontWeight: cls.isClash ? 'bold' : 'normal' }}>{cls.startTime} {cls.endTime ? `- ${cls.endTime}` : ''}</span>
                                            {cls.isClash && (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem' }} title="Schedule Clash">⚠️</span>
                                                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">CLASH</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {(() => {
                  const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                  if (activeSem && activeSem.timetableUrl) {
                    const isPdf = activeSem.timetableUrl.toLowerCase().endsWith('.pdf');
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {timetables.length > 0 && showRawTimetable && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowRawTimetable(false)} style={{ background: 'none', border: '1px solid #3F3F46', color: '#A1A1AA', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', transition: 'color 0.2s' }}>
                              Back to Dashboard
                            </button>
                          </div>
                        )}
                        <div style={{ backgroundColor: '#111111', padding: '1rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', justifyContent: 'center' }}>
                          {isPdf ? (
                            <iframe src={activeSem.timetableUrl} width="100%" height="600px" style={{ border: 'none', borderRadius: '0.5rem' }} title="Timetable PDF" />
                          ) : (
                            <div style={{ color: '#A1A1AA', padding: '2rem', textAlign: 'center' }}>
                              Raw preview not available for this file format.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px dashed #27272A', textAlign: 'center' }}>
                      <p style={{ color: '#A1A1AA' }}>No timetable uploaded for the active semester.</p>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {activeTab === 'materials' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Upload Material</h3>
                  <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>Upload lecture slides or PDFs to build your knowledge base.</p>
                  
                  <input type="file" multiple accept=".pdf,.pptx,.docx,.txt" ref={fileInputRef} onChange={handleFileInput} style={{ display: 'none' }} />

                  <div 
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                    style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', opacity: isUploading ? 0.5 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
                  >
                    <span className="mobile-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>+ Tap to Stage Files</span>
                    <span className="desktop-text" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>{isDragging ? 'Drop files now...' : '+ Click or Drag Files to Stage'}</span>
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
                      
                      {pendingFiles.length > 0 && !isUploading && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <select value={selectedCategory} onChange={(e: any) => setSelectedCategory(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem', borderRadius: '0.25rem', outline: 'none', flex: 1 }}>
                            <option value="Note">Note</option>
                            <option value="Assignment">Assignment</option>
                            <option value="Audio">Audio Recording</option>
                            <option value="Video">Video Recording</option>
                          </select>
                          <button 
                            onClick={handleUploadToVault} disabled={isUploading}
                            style={{ backgroundColor: '#EA580C', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s' }}
                          >
                            Upload to Vault
                          </button>
                        </div>
                      )}

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
                    </div>
                  )}
                </div>
                
                <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Files</h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem', borderRadius: '0.25rem', outline: 'none', fontSize: '0.85rem' }}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="nameAsc">Name (A-Z)</option>
                        <option value="nameDesc">Name (Z-A)</option>
                        <option value="category">Category</option>
                      </select>
                      <div style={{ display: 'flex', backgroundColor: '#18181B', border: '1px solid #3F3F46', borderRadius: '0.25rem', overflow: 'hidden' }}>
                        <button onClick={() => setViewMode('list')} style={{ backgroundColor: viewMode === 'list' ? '#27272A' : 'transparent', color: viewMode === 'list' ? 'white' : '#71717A', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <List size={16} />
                        </button>
                        <button onClick={() => setViewMode('grid')} style={{ backgroundColor: viewMode === 'grid' ? '#27272A' : 'transparent', color: viewMode === 'grid' ? 'white' : '#71717A', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LayoutGrid size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: viewMode === 'grid' ? 'grid' : 'flex', flexDirection: viewMode === 'list' ? 'column' : 'row', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'none', gap: viewMode === 'grid' ? '1rem' : '0.5rem', flex: 1, overflowY: 'auto' }}>
                    {[...vaultFiles].sort((a, b) => {
                      if (sortBy === 'newest') return (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0);
                      if (sortBy === 'oldest') return (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0);
                      if (sortBy === 'nameAsc') return (a.fileName || '').localeCompare(b.fileName || '');
                      if (sortBy === 'nameDesc') return (b.fileName || '').localeCompare(a.fileName || '');
                      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
                      return 0;
                    }).map(file => (
                      viewMode === 'list' ? (
                        <div key={file.id} className="w-full overflow-hidden px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem' }}>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-start sm:items-center w-full min-w-0">
                            <div className="flex flex-col min-w-0 w-full">
                              <span className="break-words whitespace-normal min-w-0 block" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{file.fileName}</span>
                              <span style={{ color: '#71717A', fontSize: '0.75rem' }}>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                              <div style={{ position: 'relative' }}>
                                <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: '0.25rem' }}>
                                  <MoreVertical size={16} />
                                </button>
                                {activeFileDropdown === file.id && (
                                  <div style={{ position: 'absolute', right: 0, top: '100%', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.5rem', zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                    <button onClick={() => handleOpenStudyGuideModal(file)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'white', padding: '0.5rem', cursor: 'pointer', textAlign: 'left', borderRadius: '0.25rem', fontSize: '0.85rem' }} className="hover:bg-zinc-600 transition-colors">
                                      📚 Generate Study Guide
                                    </button>
                                    <button onClick={() => handleDeleteVaultFile(file.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#EF4444', padding: '0.5rem', cursor: 'pointer', textAlign: 'left', borderRadius: '0.25rem', fontSize: '0.85rem', marginTop: '0.25rem' }} className="hover:bg-zinc-600 transition-colors">
                                      <Trash2 size={14} /> Delete File
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {studyGuides.filter(g => g.sourceDocumentId === file.id).length > 0 && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #3F3F46' }}>
                              <button onClick={() => setOpenStudyGuideDropdowns(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])} style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                                {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }}/> : <ChevronRight size={14} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
                              </button>
                              {openStudyGuideDropdowns.includes(file.id) && (
                                <div className="flex flex-col min-w-0 w-full" style={{ gap: '0.25rem', marginTop: '0.5rem', paddingLeft: '1rem' }}>
                                  {studyGuides.filter(g => g.sourceDocumentId === file.id).map(guide => (
                                    <button key={guide.id} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }} className="hover:underline break-words whitespace-normal min-w-0 w-full text-left" style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0' }}>
                                      📖 Study Guide: {guide.sectionConstraint}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div key={file.id} className="w-full overflow-hidden px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', alignSelf: 'flex-start', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: 0 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                              </button>
                              {activeFileDropdown === file.id && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: '0.5rem', width: '200px', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.25rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                  <button onClick={() => handleOpenStudyGuideModal(file)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#F9FAFB', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    📚 Generate Study Guide
                                  </button>
                                  <button onClick={() => handleDeleteVaultFile(file.id)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                    Delete File
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="break-words whitespace-normal min-w-0 block" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={file.fileName}>{file.fileName}</span>
                          <span style={{ color: '#71717A', fontSize: '0.75rem', marginTop: 'auto' }}>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                          
                          {studyGuides.filter(g => g.sourceDocumentId === file.id).length > 0 && (
                            <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed #3F3F46' }}>
                              <button onClick={() => setOpenStudyGuideDropdowns(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])} style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                                {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={12} style={{ transform: 'rotate(-90deg)' }}/> : <ChevronRight size={12} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
                              </button>
                              {openStudyGuideDropdowns.includes(file.id) && (
                                <div className="flex flex-col min-w-0 w-full" style={{ gap: '0.25rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                                  {studyGuides.filter(g => g.sourceDocumentId === file.id).map(guide => (
                                    <button key={guide.id} onClick={() => { setActiveStudyGuide(guide); setIsStudyGuideViewOpen(true); }} className="hover:underline truncate min-w-0 w-full text-left" style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '0.75rem', cursor: 'pointer', padding: '0.1rem 0' }} title={`Study Guide: ${guide.sectionConstraint}`}>
                                      📖 {guide.sectionConstraint}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    ))}
                    {vaultFiles.length === 0 && <p style={{ color: '#A1A1AA', fontSize: '0.9rem', gridColumn: '1 / -1' }}>Your vault is empty.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className={`console-panel ${isConsoleOpen ? 'open' : ''}`}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#EA580C', fontWeight: 'bold' }}>&gt;_</span> 
              <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>console</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => {
                  setCurrentChatId(null);
                  setToastMessage("Fresh session started");
                }}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button className="menu-btn lg:hidden" onClick={() => setIsConsoleOpen(false)}>✕</button>
            </div>
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
                    <button onClick={() => { setEditingMessageIndex(i); setEditInput(msg.content); }} className="hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: '#9CA3AF', padding: 0 }} title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
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
                ) : msg.type === 'action_required' ? (
                  <div className="w-full max-w-md overflow-hidden break-words whitespace-pre-wrap" style={{ backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: (msg as any).error?.status === 'clash' ? '1px solid #DC2626' : '1px solid #EA580C', color: '#E4E4E7', fontSize: '0.9rem' }}>
                    <p className="min-w-0 break-words" style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{msg.content}</p>
                    {(msg as any).error?.status === 'clash' && (
                      <p style={{ margin: '0 0 1rem 0', color: '#FCA5A5', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        ⚠️ WARNING: This class clashes with {(msg as any).error.existingCourse}.
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => executeAction(i, msg.action!, msg.payload, false)} style={{ background: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                      {(msg as any).error?.status === 'clash' ? (
                        <button onClick={() => executeAction(i, msg.action!, msg.payload, true)} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>Override & Save</button>
                      ) : (
                        <button onClick={() => executeAction(i, msg.action!, msg.payload, true)} style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Action</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-full sm:max-w-[90%] break-words whitespace-pre-wrap min-w-0" style={{ 
                    backgroundColor: msg.role === 'user' ? '#27272A' : isError ? '#450a0a' : '#18181B', 
                    padding: '1rem', 
                    borderRadius: '0.5rem', 
                    border: isError ? '1px solid #7f1d1d' : '1px solid #27272A', 
                    color: isError ? '#fca5a5' : '#E4E4E7', 
                    fontSize: '0.9rem', 
                    lineHeight: '1.6'
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
                {msg.role === 'ai' && msg.type !== 'action_required' && !isError && i > 0 && (
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
                      <button disabled={isQuerying} onClick={() => handleRegenerate(i)} className="hover:text-white transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Regenerate">
                        <RefreshCcw className="w-3.5 h-3.5" />
                      </button>
                      <button disabled={isQuerying} onClick={() => handleFeedback(i, 'up')} className="hover:text-green-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'up' ? '#22C55E' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Good response">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button disabled={isQuerying} onClick={() => handleFeedback(i, 'down')} className="hover:text-red-500 transition-colors cursor-pointer" style={{ background: 'none', border: 'none', color: msg.feedback === 'down' ? '#EF4444' : '#9CA3AF', opacity: isQuerying ? 0.5 : 1, padding: 0 }} title="Bad response">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )})}
            
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
            <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={handleConsoleSubmit}>
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
      
      {/* Clear Timetable Custom Modal */}
      {isClearModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div>
              <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Clear Timetable?</h3>
              <p style={{ color: '#A1A1AA', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                Are you sure you want to delete your entire timetable? This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setIsClearModalOpen(false)} 
                style={{ backgroundColor: 'transparent', color: '#E4E4E7', border: '1px solid #3F3F46', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleClearTimetableConfirm} 
                style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
              >
                Wipe Schedule
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Flashcard Active Engine Modal */}
      {flashcardModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272A', paddingBottom: '1rem' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✨ {activeFlashcardTitle}
              </h3>
              <button 
                onClick={() => setFlashcardModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', perspective: '1000px' }}>
              {isGeneratingFlashcards ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid #EA580C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <p style={{ color: '#A1A1AA' }}>Engine is synthesizing flashcards...</p>
                </div>
              ) : flashcards.length > 0 ? (
                <>
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    style={{ 
                      width: '100%', maxWidth: '600px', height: '350px', cursor: 'pointer', position: 'relative', transition: 'transform 0.6s', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front */}
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      <h2 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 'bold' }}>{flashcards[currentFlashcardIndex].front}</h2>
                      <span style={{ position: 'absolute', bottom: '1rem', color: '#71717A', fontSize: '0.85rem' }}>Click to flip</span>
                    </div>
                    {/* Back */}
                    <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', backgroundColor: '#EA580C', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', transform: 'rotateY(180deg)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      <p style={{ color: 'white', fontSize: '1.25rem', lineHeight: '1.6' }}>{flashcards[currentFlashcardIndex].back}</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginTop: '3rem' }}>
                    <button 
                      onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentFlashcardIndex(Math.max(0, currentFlashcardIndex - 1)), 150); }}
                      disabled={currentFlashcardIndex === 0}
                      style={{ background: 'none', border: '1px solid #3F3F46', color: 'white', padding: '0.75rem', borderRadius: '50%', cursor: currentFlashcardIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentFlashcardIndex === 0 ? 0.3 : 1, transition: 'all 0.2s' }}
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <span style={{ color: '#A1A1AA', fontSize: '1.1rem', fontWeight: 'bold' }}>{currentFlashcardIndex + 1} / {flashcards.length}</span>
                    <button 
                      onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentFlashcardIndex(Math.min(flashcards.length - 1, currentFlashcardIndex + 1)), 150); }}
                      disabled={currentFlashcardIndex === flashcards.length - 1}
                      style={{ background: 'none', border: '1px solid #3F3F46', color: 'white', padding: '0.75rem', borderRadius: '50%', cursor: currentFlashcardIndex === flashcards.length - 1 ? 'not-allowed' : 'pointer', opacity: currentFlashcardIndex === flashcards.length - 1 ? 0.3 : 1, transition: 'all 0.2s' }}
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: '#EF4444' }}>No flashcards could be generated.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #27272A', paddingTop: '1.5rem' }}>
              <button 
                onClick={handleSaveDeck}
                disabled={isGeneratingFlashcards || flashcards.length === 0}
                style={{ backgroundColor: '#27272A', color: 'white', border: '1px solid #3F3F46', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: (isGeneratingFlashcards || flashcards.length === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (isGeneratingFlashcards || flashcards.length === 0) ? 0.5 : 1 }}
                className="hover:bg-zinc-800"
              >
                <Save size={18} /> Save Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Guide Guardrail Modal */}
      {isStudyGuideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl mx-4 overflow-hidden p-4 sm:p-8 break-words whitespace-normal flex flex-col gap-6" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📚 Generate Study Guide
              </h3>
              <button 
                onClick={() => setIsStudyGuideModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ color: '#E4E4E7', fontSize: '0.9rem' }}>What section should we cover?</label>
              <input 
                type="text" 
                value={studyGuideConstraint}
                onChange={(e) => setStudyGuideConstraint(e.target.value)}
                placeholder="e.g., Pages 1-5, or Chapter 2: Supply & Demand"
                style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.75rem', borderRadius: '0.5rem', outline: 'none', width: '100%' }}
                autoFocus
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setIsStudyGuideModalOpen(false)}
                style={{ backgroundColor: 'transparent', color: '#E4E4E7', border: '1px solid #3F3F46', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateStudyGuide}
                disabled={isGeneratingStudyGuide || !studyGuideConstraint.trim()}
                style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: (isGeneratingStudyGuide || !studyGuideConstraint.trim()) ? 'not-allowed' : 'pointer', opacity: (isGeneratingStudyGuide || !studyGuideConstraint.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isGeneratingStudyGuide ? 'Generating...' : 'Generate Guide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Guide View Modal */}
      {isStudyGuideViewOpen && activeStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl mx-4 h-[85vh] overflow-hidden break-words whitespace-normal flex flex-col" style={{ backgroundColor: '#111111', border: '1px solid #27272A', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 bg-zinc-900 p-4 sm:p-6 gap-4" style={{ backgroundColor: '#18181B', borderBottomColor: '#27272A' }}>
              <div className="flex flex-col min-w-0 w-full">
                <h3 className="break-words whitespace-normal min-w-0" style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>📖 Study Guide: {activeStudyGuide.sectionConstraint}</h3>
                <span className="break-words whitespace-normal min-w-0" style={{ color: '#71717A', fontSize: '0.85rem' }}>{activeStudyGuide.sourceDocumentName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={handleGenerateFlashcardsFromGuide}
                  disabled={isGeneratingFlashcards}
                  style={{ backgroundColor: '#27272A', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', cursor: isGeneratingFlashcards ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isGeneratingFlashcards ? 0.5 : 1 }}
                  className="hover:bg-zinc-700 transition-colors"
                >
                  {isGeneratingFlashcards ? 'Generating...' : '✨ Generate Flashcards'}
                </button>
                <button 
                  onClick={() => setIsStudyGuideViewOpen(false)} 
                  style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                {activeStudyGuide.markdownContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
