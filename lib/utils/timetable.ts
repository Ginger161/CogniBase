export interface ScheduledClass {
  courseCode: string;
  day: string;
  startTime: string; // e.g., "09:00"
  endTime: string;   // e.g., "10:30"
  location?: string;
}

export function checkClash(
  newClass: ScheduledClass,
  existingClasses: ScheduledClass[]
): { hasClash: boolean; clashingCourse?: string } {
  // Convert HH:MM to minutes
  const toMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const newStart = toMinutes(newClass.startTime);
  const newEnd = toMinutes(newClass.endTime);

  for (const existing of existingClasses) {
    if (existing.day.toLowerCase() === newClass.day.toLowerCase()) {
      const existingStart = toMinutes(existing.startTime);
      const existingEnd = toMinutes(existing.endTime);

      // Overlap logic: StartA < EndB && EndA > StartB
      if (newStart < existingEnd && newEnd > existingStart) {
        return { hasClash: true, clashingCourse: existing.courseCode };
      }
    }
  }

  return { hasClash: false };
}
