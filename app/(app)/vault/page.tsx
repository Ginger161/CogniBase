"use client";
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { Pencil, Plus, RefreshCcw, ThumbsUp, ThumbsDown, LayoutGrid, List, Trash2, Calendar, MoreVertical, ChevronLeft, ChevronRight, Save, UploadCloud, File, Play, Loader2, Sparkles, Maximize2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useThrottle } from '../../hooks/useThrottle';
import { checkClash } from '../../../lib/utils/timetable';
import { useUserContext } from '../../../lib/hooks/useUserContext';
import { StudyEngine } from '@/components/StudyEngine';




export default function DashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  



  const [vaultFiles, setVaultFiles] = useState<any[]>([]);

  // Vault state
  const [activeTab, setActiveTab] = useState<'courses' | 'timetable' | 'materials'>('courses');
  const [timetables, setTimetables] = useState<any[]>([]);
  const [pendingClashes, setPendingClashes] = useState<any[] | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Courses state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingPhaseIndex, setExtractingPhaseIndex] = useState(0);
  const [manualCourseCode, setManualCourseCode] = useState('');
  const [manualCourseTitle, setManualCourseTitle] = useState('');
  const [manualCourseSemester, setManualCourseSemester] = useState('First');
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Materials state
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'Note' | 'Assignment'>('Note');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('vaultViewMode') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vaultViewMode', viewMode);
    }
  }, [viewMode]);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Material Selection State
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [activeFileDropdown, setActiveFileDropdown] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Study Guide state
  const [studyGuides, setStudyGuides] = useState<any[]>([]);
  const [isStudyGuideModalOpen, setIsStudyGuideModalOpen] = useState(false);
  const [studyGuideFormat, setStudyGuideFormat] = useState('General Knowledge');
  const [studyGuideTimeframe, setStudyGuideTimeframe] = useState('Standard');
  const [studyGuideLevel, setStudyGuideLevel] = useState('Intermediate');
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
  const [timetableExtractionError, setTimetableExtractionError] = useState(false);
  const [pendingTimetableFile, setPendingTimetableFile] = useState<File | null>(null);
  const timetableInputRef = useRef<HTMLInputElement>(null);



  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userData, setUserData] = useState<any>({ name: 'Loading...', email: '', uid: '', profile: null });
  const { context, isLoading: isContextLoading } = useUserContext();

  useEffect(() => {
    if (context) {
      setUserData(context);
    } else if (!isContextLoading) {
      setUserData({ name: 'Guest Student', email: 'Not signed in', uid: '', profile: null });
    }
  }, [context, isContextLoading]);

  useEffect(() => {
    if (!context?.uid) {
      setVaultFiles([]);
      setTimetables([]);
      setStudyGuides([]);
      setIsLoading(false);
      return;
    }

    const fetchVaultData = async () => {
      // Fetch user profile
      try {
        const profRes = await fetch('/api/profile');
        if (profRes.ok) {
          const profData = await profRes.json();
          setUserData((prev: any) => ({ ...prev, profile: profData.profile || null }));
        }
      } catch (err) { console.error("Error fetching profile", err); }

      // Fetch timetables
      try {
        const timetablesRes = await fetch('/api/timetable');
        if (timetablesRes.ok) {
          const tData = await timetablesRes.json();
          const fetchedClasses = tData.scheduled_classes || [];
          const classesWithIds = fetchedClasses.map((c: any) => c.id ? c : { ...c, id: Date.now().toString(36) + Math.random().toString(36).substring(2) });
          setTimetables(classesWithIds);
        }
      } catch (err) {
        console.error("Error fetching timetables", err);
      }

      // Fetch Vault Files
      try {
        const docsRes = await fetch(`/api/documents`);
        if (docsRes.ok) {
          const docs = await docsRes.json();
          console.log("📋 Data received by UI on load:", docs);
          setVaultFiles(docs.map((d: any) => ({
            id: d.id,
            fileName: d.name,
            downloadURL: d.url,
            uploadedAt: d.createdAt,
            category: 'Note' // Prisma schema doesn't store category yet
          })));
        }
      } catch (e) { console.error("Failed to fetch documents:", e) }


      // Fetch Study Guides
      try {
        const resSq = await fetch('/api/study-guides?userId=' + context.uid);
        if (resSq.ok) {
          const sGuides = await resSq.json();
          if (Array.isArray(sGuides)) {
            sGuides.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setStudyGuides(sGuides);
          } else {
            setStudyGuides([]);
          }
        }
      } catch (e) { console.error(e) }

      setIsLoading(false);
    };

    fetchVaultData();
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

  const handleAddManualCourseCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCourseCode.trim() || !manualCourseTitle.trim() || !userData.uid) return;

    try {
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

      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { ...userData.profile, semesters } })
      });

      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setManualCourseCode('');
      setManualCourseTitle('');
    } catch (err) { console.error(err); }
  };

  const { throttledFunction: handleAddManualCourse, isThrottled: isAddingCourse } = useThrottle(handleAddManualCourseCore);

  const handleDropCourse = async (courseCode: string) => {
    if (!userData.uid) return;
    try {
      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      if (activeSemIdx === -1) return;

      semesters[activeSemIdx].courses = semesters[activeSemIdx].courses.filter((c: any) => c.courseCode !== courseCode);

      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { ...userData.profile, semesters } })
      });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
    } catch (err) { console.error(err); }
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

      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { ...userData.profile, semesters } })
      });
      setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
      setSelectedCourseCodes([]);
    } catch (err) { console.error(err); }
  };

  const processCourseFile = async (file: File) => {
    if (!userData.uid) return;

    setIsExtracting(true);
    try {
      // Step 1: Upload the file to Supabase directly
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('workspace-files')
        .upload(filePath, file);

      if (error) {
        setToastMessage(`Upload Error: ${error.message}`);
        setIsExtracting(false);
        throw error;
      }

      // Step 2: Wait for response to get the secure file url
      const { data: publicUrlData } = supabase.storage
        .from('workspace-files')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      console.log("Vault file successfully uploaded to Supabase:", fileUrl);

      const semesters = [...(userData.profile?.semesters || [])];
      let activeSemIdx = semesters.findIndex((s: any) => s.isActive);
      
      if (activeSemIdx === -1) {
        semesters.push({
          semesterId: Date.now().toString(),
          title: "Current Semester",
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
          isActive: true,
          courses: []
        });
        activeSemIdx = semesters.length - 1;
      }

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

      let extractedData: any;
      try {
        extractedData = await extractRes.json();
      } catch (e) {
        // Ignore JSON parse error if HTML is returned
      }

      if (!extractRes.ok) {
        throw new Error(extractedData?.error || `API Error: ${extractRes.status} ${extractRes.statusText}`);
      }

      if (extractedData?.courses && Array.isArray(extractedData.courses)) {
        const activeSem = semesters[activeSemIdx];
        const newCourses = extractedData.courses.filter((c: any) => !activeSem.courses.some((ext: any) => ext.courseCode === c.courseCode));
        if (newCourses.length > 0) {
          activeSem.courses = [...activeSem.courses, ...newCourses];
          await fetch('/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: { ...userData.profile, semesters } })
          });
          setUserData((prev: any) => ({ ...prev, profile: { ...prev.profile, semesters } }));
        }
      }

    } catch (err: any) {
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

  const renderErrorCard = (onRetry: () => void) => (
    <div
      style={{
        padding: '2rem',
        backgroundColor: '#7f1d1d', // Deep red
        border: '1px solid #991b1b',
        borderRadius: '1rem',
        textAlign: 'center',
        margin: '1rem 0'
      }}
    >
      <h3 style={{ color: '#fee2e2', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
        Our AI is a bit overwhelmed
      </h3>
      <p style={{ color: '#fecaca', marginBottom: '1.5rem' }}>
        The servers are currently experiencing high traffic. Please wait a moment and try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          backgroundColor: '#f87171',
          color: '#450a0a',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Try Again
      </button>
    </div>
  );

  const handleTimetableUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0] || pendingTimetableFile;
    if (!file || !userData.uid) return;

    setTimetableExtractionError(false);
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
            
            let data: any;
            try {
              data = await res.json();
            } catch (e) {
              data = {};
            }

            if (!res.ok) {
              console.error('Full API Error Response:', data);
              reject(new Error(data.error || "Failed to extract timetable"));
              return;
            }
            resolve(data.timetable);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
      });

      // Since extraction succeeded, we safely upload the file
      let finalTimetableUrl = '';
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await supabase.storage
          .from('workspace-files')
          .upload(filePath, file);

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('workspace-files')
          .getPublicUrl(filePath);

        finalTimetableUrl = publicUrlData.publicUrl;
        console.log("Timetable successfully uploaded to Supabase:", finalTimetableUrl);
      } catch (err: any) {
        console.error("Supabase Upload Error:", err);
        setToastMessage(`Timetable image upload failed: ${err.message}`);
        setIsTimetableUploading(false);
        return;
      }

      const semesters = [...(userData.profile?.semesters || [])];
      const activeSemIdx = semesters.findIndex((s: any) => s.isActive);

      if (finalTimetableUrl && activeSemIdx !== -1) {
        semesters[activeSemIdx].timetableUrl = finalTimetableUrl;
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: { ...userData.profile, semesters } })
        });
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
          await fetch('/api/timetable', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_classes: currentTimetables })
          });
          setTimetables(currentTimetables);
        }

        if (clashingClasses.length > 0) {
          setPendingClashes(clashingClasses);
        } else if (newClasses.length > 0) {
          setToastMessage("Timetable extracted and saved successfully!");
        }
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("400")) {
        setToastMessage("Extraction Failed: The image format is not supported or the document is invalid.");
      } else if (err.message?.includes("No timetable detected")) {
        setToastMessage("Extraction Failed: We couldn't detect a valid timetable in that document. Please try a different image or file.");
      } else {
        setTimetableExtractionError(true);
        setPendingTimetableFile(file || null);
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

      await fetch('/api/timetable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_classes: currentTimetables })
      });
      setTimetables(currentTimetables);
      setPendingClashes(null);
      setToastMessage("Clashing classes overridden and saved.");
    } catch (err) {
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

      await fetch('/api/timetable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_classes: newScheduledClasses })
      });

      setTimetables(newScheduledClasses);
      setManualTimetableCourseCode('');
      setManualTimetableCourseTitle('');
      setEditingClassId(null);
      setShowManualTimetable(false);
      setToastMessage(editingClassId ? "Class updated successfully!" : "Class added successfully!");
    } catch (err) {
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
      await fetch('/api/timetable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_classes: newScheduledClasses })
      });
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
    try {
      const newScheduledClasses = timetables.filter(c => !selectedClasses.includes(c.id));
      await fetch('/api/timetable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_classes: newScheduledClasses })
      });
      setTimetables(newScheduledClasses);
      setSelectedClasses([]);
      setToastMessage(`Deleted ${selectedClasses.length} classes.`);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete selected classes.");
    }
    setIsBulkDeleteConfirmOpen(false);
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
      await fetch('/api/timetable', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_classes: [] })
      });
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
    setStudyGuideFormat('General Knowledge');
    setStudyGuideTimeframe('Standard');
    setStudyGuideLevel('Intermediate');
    setIsStudyGuideModalOpen(true);
  };

  const handleGenerateStudyGuide = async () => {
    const payloadConstraint = `Format: ${studyGuideFormat} | Timeframe: ${studyGuideTimeframe} | Level: ${studyGuideLevel}`;
    const file = vaultFiles.find(f => f.id === activeDocumentId);
    if (!file) return;

    setIsGeneratingStudyGuide(true);

    try {
      const res = await fetch('/api/engine/generate-study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: file.downloadURL, sectionConstraint: payloadConstraint })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to generate study guide.");

      const newGuide = {
        userId: userData.uid,
        sourceDocumentId: file.id,
        sourceDocumentName: file.fileName,
        sectionConstraint: payloadConstraint,
        strategyData: data.studyGuide,
        createdAt: new Date().toISOString()
      };

      const docRef = await fetch('/api/study-guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGuide)
      });
      const fullGuide = await docRef.json();

      setStudyGuides(prev => [fullGuide, ...prev]);

      setIsStudyGuideModalOpen(false);
      setActiveStudyGuide(fullGuide);
      setIsStudyGuideViewOpen(true);

    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to generate study guide.");
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  const handleToggleMaterialSelection = (id: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedMaterials(prev => [...prev, id]);
    } else {
      setSelectedMaterials(prev => prev.filter(m => m !== id));
    }
  };

  const handleSelectAllMaterials = (filteredFiles: any[], isSelectAll: boolean) => {
    if (isSelectAll) {
      const allIds = filteredFiles.map(f => f.id);
      setSelectedMaterials(allIds);
    } else {
      setSelectedMaterials([]);
    }
  };

  const handleBulkDeleteMaterials = async () => {
    if (!userData.uid || selectedMaterials.length === 0) return;
    try {
      const deletePromises = selectedMaterials.map(id => fetch('/api/documents?id=' + id, { method: 'DELETE' }));
      await Promise.all(deletePromises);

      setVaultFiles(prev => prev.filter(m => !selectedMaterials.includes(m.id)));
      setSelectedMaterials([]);
      setToastMessage(`Successfully deleted ${selectedMaterials.length} materials.`);
    } catch (err) {
      console.error("Failed to sync deletion with database:", err);
      setToastMessage("Could not delete materials. Please check your connection.");
    }
  };

  const handleDeleteVaultFile = async (id: string) => {
    setActiveFileDropdown(null);
    if (!userData.uid) return;
    try {
      await fetch('/api/documents?id=' + id, { method: 'DELETE' });

      setVaultFiles(prev => prev.filter(m => m.id !== id));
      setToastMessage("File deleted successfully from your Vault.");
    } catch (err) {
      console.error("Failed to sync deletion with database:", err);
      setToastMessage("Could not delete file. Please check your connection.");
    }
  };

  const handleUploadToVaultCore = async () => {
    if (pendingFiles.length === 0 || !userData.uid || isUploading) return;
    setIsUploading(true); setUploadProgress(0); setUploadStatus('Scanning Vault for existing records...');

    try {
      const res = await fetch('/api/documents');
      const existingFiles = await res.json();

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

      setUploadStatus('Uploading to Secure Storage...');

      const uploadedFiles = [];
      for (let i = 0; i < newFilesToUpload.length; i++) {
        const file = newFilesToUpload[i];
        setUploadProgress(((i + 1) / newFilesToUpload.length) * 100);

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
        const uniqueSuffix = Math.random().toString(36).substring(2, 8);
        const filePath = `uploads/${uniqueSuffix}-${cleanFileName}`;

        const { data, error } = await supabase.storage
          .from('workspace-files')
          .upload(filePath, file);

        if (error) {
          console.error("Supabase Upload Error:", error);
          setUploadStatus(`Error: ${error.message || 'Supabase Upload failed.'}`);
          setIsUploading(false); setUploadProgress(0);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('workspace-files')
          .getPublicUrl(filePath);

        const fileUrl = publicUrlData.publicUrl;
        console.log("✅ File uploaded to Bucket:", fileUrl);

        try {
          const dbResponse = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name, // Save the original pretty name to Postgres
              url: fileUrl,
              fileSize: file.size
            })
          });

          // 1. Read as text first to prevent JSON parse crashes on HTML error pages
          const responseText = await dbResponse.text();
          if (!dbResponse.ok) {
            console.error(`❌ Database Save Failed (Status: ${dbResponse.status})`);

            try {
              const errData = JSON.parse(responseText);
              import('sonner').then(mod => mod.toast.error(errData.error || "Failed to save to database."));
            } catch (e) {
              toast.error("Failed to save to database. Check console for details.");
            }

            setUploadStatus('Upload failed.');
            continue;
          }

          // 2. If OK, it is safe to parse
          const data = JSON.parse(responseText);
          console.log("✅ File saved to Database successfully!", data);

          // Trigger the UI to re-fetch the document list immediately
          const docsRes = await fetch(`/api/documents`);
          if (docsRes.ok) {
            const docs = await docsRes.json();
            console.log("📋 Data received by UI after upload:", docs);
            setVaultFiles(docs.map((d: any) => ({
              id: d.id,
              fileName: d.name,
              downloadURL: d.url,
              uploadedAt: d.createdAt,
              category: 'Note'
            })));
          }

        } catch (error) {
          console.error("❌ Network Error during Database Save:", error);
          setUploadStatus('Warning: Transfer succeeded, but database save failed.');
        }
      }

      setUploadStatus('Transfer Complete. Files Secured.');
      router.refresh();
      setTimeout(() => { setPendingFiles([]); setIsUploading(false); setUploadStatus(''); setUploadProgress(0); }, 3000);
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message || 'Upload connection failed.'}`);
      setIsUploading(false); setUploadProgress(0);
    }
  };

  const { throttledFunction: handleUploadToVault, isThrottled: isUploadingThrottled } = useThrottle(handleUploadToVaultCore);

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
      

      <div className="flex flex-col h-full w-full">
        
        
        
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
          

          <header style={{ paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', color: '#EA580C', fontSize: '1.1rem', fontWeight: 700 }}>&gt;_</span>
              <h1 style={{ fontSize: '1.6rem', margin: 0, fontWeight: 700, color: 'white' }}>My Vault</h1>
            </div>
            <p style={{ color: '#71717A', margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>// your student operating system</p>
          </header>

          <div style={{ display: 'flex', gap: '6px', paddingBottom: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('courses')} style={activeTab === 'courses' ? { background: 'linear-gradient(135deg, #EA580C, #C2410C)', color: 'white', fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px -4px rgba(234,88,12,0.5)' } : { background: 'none', border: '1px solid #27272A', color: '#A1A1AA', fontWeight: 600, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer' }}>My Courses</button>
            <button onClick={() => setActiveTab('timetable')} style={activeTab === 'timetable' ? { background: 'linear-gradient(135deg, #EA580C, #C2410C)', color: 'white', fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px -4px rgba(234,88,12,0.5)' } : { background: 'none', border: '1px solid #27272A', color: '#A1A1AA', fontWeight: 600, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer' }}>My Timetable</button>
            <button onClick={() => setActiveTab('materials')} style={activeTab === 'materials' ? { background: 'linear-gradient(135deg, #EA580C, #C2410C)', color: 'white', fontWeight: 700, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px -4px rgba(234,88,12,0.5)' } : { background: 'none', border: '1px solid #27272A', color: '#A1A1AA', fontWeight: 600, fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer' }}>Lecture Materials</button>


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

                <div className="w-full max-w-full" style={{ gridColumn: '1 / -1', backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Registered Courses</h3>
                    {selectedCourseCodes.length > 0 && (
                      <button onClick={handleBulkDeleteCourses} style={{ backgroundColor: '#DC2626', color: 'white', border: '1px solid #B91C1C', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trash2 size={16} /> Delete Selected ({selectedCourseCodes.length})
                      </button>
                    )}
                  </div>
                  <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '0.5rem' }}>
                        {/* Injecting raw CSS to bypass Tailwind completely */}
                        <style>{`
                          @keyframes wavePulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.3; }
                          }
                        `}</style>

                        {[1, 2, 3].map((n, index) => (
                          <div
                            key={n}
                            style={{
                              width: '100%',
                              height: '68px',
                              backgroundColor: '#374151',
                              borderRadius: '0.75rem',
                              marginBottom: '0.75rem',
                              border: '1px solid #4b5563',
                              /* The Sequential Animation Logic */
                              animation: 'wavePulse 1.5s infinite ease-in-out',
                              animationDelay: `${index * 0.2}s`
                            }}
                          ></div>
                        ))}
                      </div>
                    ) : (() => {
                      const activeSem = userData.profile?.semesters?.find((s: any) => s.isActive);
                      if (!activeSem || !activeSem.courses) return <p style={{ color: '#A1A1AA' }}>No courses added yet for the active academic year.</p>;

                      const firstSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'First');
                      const secondSemesterCourses = activeSem.courses.filter((c: any) => c.semester === 'Second');

                      return (
                        <>
                          <div className="w-full max-w-full">
                            {firstSemesterCourses.length > 0 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                  <input type="checkbox" checked={firstSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(firstSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All First Semester" />
                                  <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>First Semester</h4>
                                </div>
                                <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {firstSemesterCourses.map((course: any, index: number) => {
                                    const isSelected = selectedCourseCodes.includes(course.courseCode);

                                    return (
                                      <div
                                        key={course.courseCode || index}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          width: '100%',
                                          padding: '1rem',
                                          marginBottom: '0.75rem',
                                          borderRadius: '0.75rem',
                                          border: '1px solid #374151',
                                          backgroundColor: '#1f2937' /* Forces the dark gray */
                                        }}
                                      >

                                        {/* Left: Checkbox and Course Code */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCourseSelection(course.courseCode)}
                                            style={{ width: '1.25rem', height: '1.25rem', accentColor: '#f97316', cursor: 'pointer' }}
                                          />
                                          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#f97316' }}>
                                            {course.courseCode}
                                          </span>
                                        </div>

                                        {/* Right: Trash Icon */}
                                        <button
                                          onClick={() => handleDropCourse(course.courseCode)}
                                          style={{ padding: '0.5rem', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        >
                                          <Trash2 size={20} />
                                        </button>

                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <p style={{ color: '#71717A', fontSize: '0.9rem', fontStyle: 'italic' }}>No First Semester courses added yet.</p>
                            )}
                          </div>
                          <div className="w-full max-w-full">
                            {secondSemesterCourses.length > 0 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #27272A', paddingBottom: '0.5rem' }}>
                                  <input type="checkbox" checked={secondSemesterCourses.every((c: any) => selectedCourseCodes.includes(c.courseCode))} onChange={(e) => handleToggleSemesterSelection(secondSemesterCourses, !e.target.checked)} style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }} title="Select All Second Semester" />
                                  <h4 style={{ color: '#A1A1AA', fontSize: '1rem', margin: 0, fontWeight: 'normal' }}>Second Semester</h4>
                                </div>
                                <div className="w-full max-w-full" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {secondSemesterCourses.map((course: any, index: number) => {
                                    const isSelected = selectedCourseCodes.includes(course.courseCode);

                                    return (
                                      <div
                                        key={course.courseCode || index}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          width: '100%',
                                          padding: '1rem',
                                          marginBottom: '0.75rem',
                                          borderRadius: '0.75rem',
                                          border: '1px solid #374151',
                                          backgroundColor: '#1f2937' /* Forces the dark gray */
                                        }}
                                      >

                                        {/* Left: Checkbox and Course Code */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleCourseSelection(course.courseCode)}
                                            style={{ width: '1.25rem', height: '1.25rem', accentColor: '#f97316', cursor: 'pointer' }}
                                          />
                                          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#f97316' }}>
                                            {course.courseCode}
                                          </span>
                                        </div>

                                        {/* Right: Trash Icon */}
                                        <button
                                          onClick={() => handleDropCourse(course.courseCode)}
                                          style={{ padding: '0.5rem', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        >
                                          <Trash2 size={20} />
                                        </button>

                                      </div>
                                    );
                                  })}
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

                  {timetableExtractionError && renderErrorCard(() => handleTimetableUpload())}

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => timetableInputRef.current?.click()}
                      disabled={isTimetableUploading || isExtractingTimetable}
                      style={{
                        backgroundColor: '#f97316',
                        color: '#ffffff',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: (isTimetableUploading || isExtractingTimetable) ? 0.5 : 1
                      }}
                    >
                      {/* If timetable exists, show 'Replace', otherwise show 'Add' */}
                      {isExtractingTimetable ? 'Analyzing timetable...' : isTimetableUploading ? 'Uploading...' : (timetables.length > 0 ? "Replace timetable" : "Add timetable")}
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
                                  <button onClick={() => setIsBulkDeleteConfirmOpen(true)} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Delete Selected</button>
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
                <div style={{ position: 'relative', backgroundColor: '#111111', padding: '1.75rem', borderRadius: '14px', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #EA580C, transparent)' }}></div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontFamily: 'monospace' }}>01 · Upload</p>
                  <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Feed the machine.</h3>
                  <p style={{ color: '#A1A1AA', fontSize: '0.85rem', margin: 0 }}>Upload lecture slides or PDFs to build your knowledge base.</p>
                  <input type="file" disabled={isUploading} multiple accept=".pdf,.pptx,.docx,.txt" ref={fileInputRef} onChange={handleFileInput} style={{ display: 'none' }} />
                  <div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                    style={{ backgroundColor: isDragging ? '#27272A' : '#18181B', padding: '1.5rem', borderRadius: '0.5rem', border: isDragging ? '1px dashed #EA580C' : '1px dashed #3F3F46', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', opacity: isUploading ? 0.5 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
                  >
                    <span className="sm:hidden" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>+ Tap to Stage Files</span>
                    <span className="hidden sm:inline" style={{ color: isDragging ? '#EA580C' : 'white', fontWeight: '500' }}>{isDragging ? 'Drop files now...' : '+ Click or Drag Files to Stage'}</span>
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
                          <select
                            value={selectedCategory}
                            onChange={(e: any) => setSelectedCategory(e.target.value)}
                            className="transition-colors hover:border-[#EA580C] focus:border-[#EA580C]"
                            style={{ backgroundColor: '#18181B', color: 'white', border: '1px solid #3F3F46', padding: '0.5rem', borderRadius: '0.25rem', outline: 'none', flex: 1 }}
                          >
                            <option value="Note">Note</option>
                            <option value="Assignment">Assignment</option>
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

                {(() => {
                  const filteredSortedFiles = [...vaultFiles].sort((a, b) => {
                    if (sortBy === 'newest') return (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0);
                    if (sortBy === 'oldest') return (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0);
                    if (sortBy === 'nameAsc') return (a.fileName || '').localeCompare(b.fileName || '');
                    if (sortBy === 'nameDesc') return (b.fileName || '').localeCompare(a.fileName || '');
                    if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
                    return 0;
                  });
                  const allSelected = filteredSortedFiles.length > 0 && filteredSortedFiles.every(f => selectedMaterials.includes(f.id));

                  return (
                    <div style={{ backgroundColor: '#111111', padding: '2rem', borderRadius: '1rem', border: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                          <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>My Files</h3>
                          {filteredSortedFiles.length > 0 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#A1A1AA', fontSize: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => handleSelectAllMaterials(filteredSortedFiles, e.target.checked)}
                                style={{ accentColor: '#EA580C', width: '1rem', height: '1rem', cursor: 'pointer' }}
                              />
                              Select All
                            </label>
                          )}
                          {selectedMaterials.length > 0 && (
                            <button onClick={handleBulkDeleteMaterials} style={{ backgroundColor: '#DC2626', color: 'white', border: '1px solid #B91C1C', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                              <Trash2 size={14} /> Delete Selected ({selectedMaterials.length})
                            </button>
                          )}
                        </div>
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
                        {isLoading ? (
                          <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr', gap: '1rem', width: '100%' }}>
                            <style>{`
                              @keyframes wavePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
                            `}</style>
                            {[1, 2, 3, 4].map((n, index) => (
                              <div
                                key={n}
                                style={{
                                  height: viewMode === 'grid' ? '150px' : '68px',
                                  backgroundColor: '#27272A',
                                  borderRadius: '0.75rem',
                                  animation: 'wavePulse 1.5s infinite ease-in-out',
                                  animationDelay: `${index * 0.2}s`
                                }}
                              ></div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {filteredSortedFiles.map(file => (
                              viewMode === 'list' ? (
                                <div key={file.id} className="w-full px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem' }}>
                                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-start sm:items-center w-full min-w-0">
                                    <div className="flex flex-row min-w-0 w-full items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedMaterials.includes(file.id)}
                                        onChange={(e) => handleToggleMaterialSelection(file.id, e.target.checked)}
                                        style={{ accentColor: '#EA580C', width: '1.1rem', height: '1.1rem', cursor: 'pointer', flexShrink: 0 }}
                                      />
                                      <div className="flex flex-col min-w-0 w-full">
                                        <a href={`/lecture-materials/${file.id}`} className="hover:text-[#EA580C] hover:underline break-words whitespace-normal min-w-0 block transition-colors" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{file.fileName}</a>
                                        <span style={{ color: '#71717A', fontSize: '0.75rem' }}>{(file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : '0.00')} MB</span>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                      <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                                      <div style={{ position: 'relative' }}>
                                        <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: '0.25rem' }}>
                                          <MoreVertical size={16} />
                                        </button>
                                        {activeFileDropdown === file.id && (
                                          <div className="absolute right-0 mt-2 origin-top-right z-50" style={{ top: '100%', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', minWidth: '180px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
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
                                        {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={14} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
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
                                <div key={file.id} className="w-full px-3 sm:px-4" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#18181B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #27272A', gap: '0.5rem', position: 'relative' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedMaterials.includes(file.id)}
                                        onChange={(e) => handleToggleMaterialSelection(file.id, e.target.checked)}
                                        style={{ accentColor: '#EA580C', width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                      />
                                      <span style={{ backgroundColor: '#27272A', color: '#A1A1AA', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', alignSelf: 'flex-start', border: '1px solid #3F3F46' }}>{file.category || 'Note'}</span>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <button onClick={() => setActiveFileDropdown(activeFileDropdown === file.id ? null : file.id)} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: 0 }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                      </button>
                                      {activeFileDropdown === file.id && (
                                        <div className="absolute right-0 mt-2 origin-top-right z-50" style={{ top: '100%', width: '200px', backgroundColor: '#27272A', border: '1px solid #3F3F46', borderRadius: '0.5rem', padding: '0.25rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                                          <button onClick={() => handleOpenStudyGuideModal(file)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#F9FAFB', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            📚 Generate Study Guide
                                          </button>
                                          <button onClick={() => handleDeleteVaultFile(file.id)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3F3F46'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            Delete File
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <a href={`/lecture-materials/${file.id}`} className="hover:text-[#EA580C] hover:underline break-words whitespace-normal min-w-0 block transition-colors" style={{ color: 'white', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={file.fileName}>{file.fileName}</a>
                                  <span style={{ color: '#71717A', fontSize: '0.75rem', marginTop: 'auto' }}>{(file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : '0.00')} MB</span>

                                  {studyGuides.filter(g => g.sourceDocumentId === file.id).length > 0 && (
                                    <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed #3F3F46' }}>
                                      <button onClick={() => setOpenStudyGuideDropdowns(prev => prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id])} style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                                        {openStudyGuideDropdowns.includes(file.id) ? <ChevronLeft size={12} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={12} />} Study Guides ({studyGuides.filter(g => g.sourceDocumentId === file.id).length})
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
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            

          </div>
        </div>
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

            <div className="flex flex-col gap-6">
              {/* Target Format */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Target Format</label>
                <div className="flex flex-wrap gap-2">
                  {['Multiple Choice', 'Written Essay', 'General Knowledge'].map(format => (
                    <button
                      key={format}
                      onClick={() => setStudyGuideFormat(format)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideFormat === format
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Timeframe</label>
                <div className="flex flex-wrap gap-2">
                  {['Cramming (<24h)', 'Standard', 'Deep Study'].map(timeframe => (
                    <button
                      key={timeframe}
                      onClick={() => setStudyGuideTimeframe(timeframe)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideTimeframe === timeframe
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Level */}
              <div className="flex flex-col gap-3">
                <label className="text-zinc-400 font-semibold text-sm uppercase tracking-wider">Current Level</label>
                <div className="flex flex-wrap gap-2">
                  {['Beginner', 'Intermediate', 'Expert'].map(level => (
                    <button
                      key={level}
                      onClick={() => setStudyGuideLevel(level)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${studyGuideLevel === level
                        ? 'bg-[#EA580C] text-white shadow-[0_0_15px_rgba(234,88,12,0.4)] border border-[#EA580C]'
                        : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
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
                disabled={isGeneratingStudyGuide}
                style={{ backgroundColor: '#EA580C', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', cursor: isGeneratingStudyGuide ? 'not-allowed' : 'pointer', opacity: isGeneratingStudyGuide ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
                  onClick={() => setIsStudyGuideViewOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#A1A1AA', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-3 sm:px-8 py-3 sm:py-8" style={{ flex: 1, overflowY: 'auto', color: '#E4E4E7', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <StudyEngine guideData={activeStudyGuide.strategyData || activeStudyGuide.markdownContent} />
            </div>
          </div>
        </div>
      )}

      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete {selectedClasses.length} Classes?</h3>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
