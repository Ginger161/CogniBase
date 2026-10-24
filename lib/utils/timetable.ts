import { parseTimeToMinutes } from './schedule';

export interface ScheduledClass {
  courseCode: string;
  day: string;
  startTime: string; // "09:00" or "9:00 AM"
  endTime?: string;
  location?: string;
}

/** True when `a` and `b` are on the same day and their time ranges overlap. Classes without an end time are treated as 1 hour. */
function overlaps(a: ScheduledClass, b: ScheduledClass): boolean {
  if (a.day.trim().toLowerCase() !== b.day.trim().toLowerCase()) return false;
  const aStart = parseTimeToMinutes(a.startTime);
  const bStart = parseTimeToMinutes(b.startTime);
  if (aStart === null || bStart === null) return false;
  const aEnd = parseTimeToMinutes(a.endTime) ?? aStart + 60;
  const bEnd = parseTimeToMinutes(b.endTime) ?? bStart + 60;
  return aStart < bEnd && aEnd > bStart;
}

export function checkClash(
  newClass: ScheduledClass,
  existingClasses: ScheduledClass[]
): { hasClash: boolean; clashingCourse?: string } {
  const clash = existingClasses.find((existing) => overlaps(newClass, existing));
  return clash ? { hasClash: true, clashingCourse: clash.courseCode } : { hasClash: false };
}
