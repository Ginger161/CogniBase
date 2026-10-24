'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase/client';
import { checkClash } from '@/lib/utils/timetable';
import type { TimetableClass } from '@/lib/utils/schedule';

export type Course = { courseCode: string; courseTitle: string; semester: 'First' | 'Second' | string };
export type ClassItem = TimetableClass & { id: string };
export type Clash = ClassItem & { clashingWith?: string };

type Profile = { courses?: Course[]; [key: string]: unknown } | null;

const newId = () => crypto.randomUUID();

async function readError(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === 'string' && data.error) || fallback;
}

function friendlyExtractionError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('503') || m.includes('unavailable') || m.includes('fetch failed') || m.includes('busy')) {
    return 'The AI is busy reading other forms. Wait a few seconds and try again.';
  }
  if (m.includes('valid course form')) return message;
  if (m.includes('timetable')) return "We couldn't find a timetable in that file. Try a clearer image or enter classes by hand.";
  if (m.includes('json') || m.includes('unexpected token')) return "We couldn't read that file. Try a clearer image or enter it by hand.";
  return message || 'Something went wrong. Try again or enter it by hand.';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useSchedule() {
  const [profile, setProfile] = useState<Profile>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingClashes, setPendingClashes] = useState<Clash[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [profRes, ttRes] = await Promise.all([fetch('/api/profile'), fetch('/api/timetable')]);
      if (!profRes.ok || !ttRes.ok) throw new Error(await readError(profRes.ok ? ttRes : profRes, 'Could not load your schedule.'));
      const prof = await profRes.json();
      const tt = await ttRes.json();
      setProfile(prof.profile ?? {});
      setClasses((tt.scheduled_classes ?? []).map((c: ClassItem) => (c.id ? c : { ...c, id: newId() })));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your schedule.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch('/api/profile'), fetch('/api/timetable')])
      .then(async ([profRes, ttRes]) => {
        if (!profRes.ok || !ttRes.ok) throw new Error(await readError(profRes.ok ? ttRes : profRes, 'Could not load your schedule.'));
        return [await profRes.json(), await ttRes.json()] as const;
      })
      .then(([prof, tt]) => {
        if (cancelled) return;
        setProfile(prof.profile ?? {});
        setClasses((tt.scheduled_classes ?? []).map((c: ClassItem) => (c.id ? c : { ...c, id: newId() })));
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const courses: Course[] = profile?.courses ?? [];

  const saveCourses = useCallback(
    async (next: Course[], label: string) => {
      const previous = profile;
      const nextProfile = { ...(profile ?? {}), courses: next };
      setProfile(nextProfile);
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: nextProfile, activityLabel: label }),
        });
        if (!res.ok) throw new Error(await readError(res, 'Could not save your courses.'));
        return true;
      } catch (e) {
        setProfile(previous);
        toast.error(e instanceof Error ? e.message : 'Could not save your courses.');
        return false;
      }
    },
    [profile]
  );

  const saveClasses = useCallback(
    async (next: ClassItem[], label?: string) => {
      const previous = classes;
      setClasses(next);
      try {
        const res = await fetch('/api/timetable', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_classes: next, activityLabel: label }),
        });
        if (!res.ok) throw new Error(await readError(res, 'Could not save your timetable.'));
        return true;
      } catch (e) {
        setClasses(previous);
        toast.error(e instanceof Error ? e.message : 'Could not save your timetable.');
        return false;
      }
    },
    [classes]
  );

  const addCourse = async (course: Course) => {
    const code = course.courseCode.trim().toUpperCase();
    if (courses.some((c) => c.courseCode === code)) {
      toast.error(`${code} is already in your courses.`);
      return false;
    }
    return saveCourses([...courses, { ...course, courseCode: code, courseTitle: course.courseTitle.trim() }], `Added course ${code}`);
  };

  const removeCourses = (codes: string[]) =>
    saveCourses(
      courses.filter((c) => !codes.includes(c.courseCode)),
      codes.length === 1 ? `Removed course ${codes[0]}` : `Removed ${codes.length} courses`
    );

  const extractCourses = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('That file is over 10MB.');
      return;
    }
    setBusy('Uploading your form…');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Please sign in again.');
      const path = `${auth.user.id}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'bin'}`;
      const { error } = await supabase.storage.from('workspace-files').upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('workspace-files').getPublicUrl(path);

      setBusy('Reading your courses…');
      const res = await fetch('/api/engine/extract-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: data.publicUrl }),
      });
      if (!res.ok) throw new Error(await readError(res, `Extraction failed (${res.status}).`));
      const found: Course[] = (await res.json()).courses ?? [];
      const fresh = found.filter((c) => c?.courseCode && !courses.some((e) => e.courseCode === c.courseCode));
      if (fresh.length === 0) {
        toast.message('No new courses found in that form.');
        return;
      }
      if (await saveCourses([...courses, ...fresh], `Extracted ${fresh.length} courses from a registration form`)) {
        toast.success(`Added ${fresh.length} course${fresh.length === 1 ? '' : 's'}`);
      }
    } catch (e) {
      toast.error(friendlyExtractionError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(null);
    }
  };

  const extractTimetable = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      toast.error('That file is over 3MB. Try a smaller or cropped image.');
      return;
    }
    setBusy('Reading your timetable…');
    try {
      const res = await fetch('/api/engine/extract-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: await fileToBase64(file), mimeType: file.type }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Could not read that timetable.'));
      const extracted: Partial<ClassItem & { time: string; venue: string }>[] = (await res.json()).timetable ?? [];

      const merged = [...classes];
      const added: ClassItem[] = [];
      const clashes: Clash[] = [];
      for (const c of extracted) {
        const item: ClassItem = {
          id: newId(),
          courseCode: c.courseCode || '',
          courseTitle: c.courseTitle || '',
          day: c.day || '',
          startTime: c.startTime || c.time || '',
          endTime: c.endTime || '',
          location: c.location || c.venue || '',
        };
        if (!item.courseCode || !item.day || !item.startTime) continue;
        const clash = checkClash(item, merged);
        if (clash.hasClash) clashes.push({ ...item, clashingWith: clash.clashingCourse });
        else {
          added.push(item);
          merged.push(item);
        }
      }

      if (added.length > 0 && (await saveClasses(merged, `Extracted ${added.length} classes from a timetable file`))) {
        toast.success(`Added ${added.length} class${added.length === 1 ? '' : 'es'}`);
      } else if (added.length === 0 && clashes.length === 0) {
        toast.message('No classes found in that file.');
      }
      if (clashes.length > 0) setPendingClashes(clashes);
    } catch (e) {
      toast.error(friendlyExtractionError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(null);
    }
  };

  const keepClashes = async () => {
    if (!pendingClashes) return;
    const withoutFlag = pendingClashes.map((c) => {
      const copy = { ...c };
      delete copy.clashingWith;
      return copy as ClassItem;
    });
    if (await saveClasses([...classes, ...withoutFlag], 'Kept clashing classes')) setPendingClashes(null);
  };

  const saveClass = async (item: Omit<ClassItem, 'id'> & { id?: string }) => {
    const full: ClassItem = { ...item, id: item.id ?? newId(), courseCode: item.courseCode.trim().toUpperCase() };
    const next = item.id ? classes.map((c) => (c.id === item.id ? full : c)) : [...classes, full];
    return saveClasses(next, item.id ? 'Updated a class' : `Added class ${full.courseCode}`);
  };

  const removeClasses = (ids: string[]) =>
    saveClasses(
      classes.filter((c) => !ids.includes(c.id)),
      ids.length === 1 ? 'Deleted a class' : `Deleted ${ids.length} classes`
    );

  const clearClasses = () => saveClasses([], 'Cleared the timetable');

  return {
    courses,
    classes,
    isLoading,
    loadError,
    busy,
    pendingClashes,
    reload: load,
    addCourse,
    removeCourses,
    extractCourses,
    extractTimetable,
    saveClass,
    removeClasses,
    clearClasses,
    keepClashes,
    discardClashes: () => setPendingClashes(null),
  };
}
