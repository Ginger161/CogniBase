export type TimetableClass = {
  id?: string;
  courseCode: string;
  courseTitle?: string;
  day: string;
  startTime: string;
  endTime?: string;
  location?: string;
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Minutes after midnight from "09:00", "9:00 AM", "09:00 pm" or "9am". Null when unreadable. */
export function parseTimeToMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? 0);
  if (minutes > 59 || hours > 23) return null;
  if (m[3] === 'pm' && hours < 12) hours += 12;
  if (m[3] === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** Display like "9:00 AM". Falls back to the original text. */
export function formatClassTime(raw: string | undefined): string {
  const mins = parseTimeToMinutes(raw);
  if (mins === null) return raw ?? '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export type NextClass = { cls: TimetableClass; startsAt: Date; isToday: boolean; isTomorrow: boolean };

/** The soonest class that has not started yet, looking up to a week ahead. Uses the viewer's local clock. */
export function findNextClass(classes: TimetableClass[], now: Date = new Date()): NextClass | null {
  let best: NextClass | null = null;
  for (const cls of classes) {
    const dayIdx = DAYS.indexOf((cls.day || '').trim().toLowerCase());
    const mins = parseTimeToMinutes(cls.startTime);
    if (dayIdx < 0 || mins === null) continue;

    for (let offset = 0; offset < 8; offset++) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      if (date.getDay() !== dayIdx) continue;
      date.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
      if (date.getTime() <= now.getTime()) continue;
      if (!best || date < best.startsAt) {
        best = { cls, startsAt: date, isToday: offset === 0, isTomorrow: offset === 1 };
      }
      break;
    }
  }
  return best;
}
