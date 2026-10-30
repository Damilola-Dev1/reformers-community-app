// src/utils/formatDate.ts
// One place for how dates read in the app: 15 Jan 2006.
// Accepts a YYYY-MM-DD string, a Date, or a Firestore Timestamp.
// Month names are written out here so every phone shows "Sep", never "Sept".

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DateInput =
  | string
  | Date
  | { toDate: () => Date }
  | null
  | undefined;

function two(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(date: Date): Date | null {
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return validDate(value);

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const date = new Date(year, month, day);
      const real =
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day;
      return real ? date : null;
    }
    return validDate(new Date(value));
  }

  if (typeof value.toDate === "function") return validDate(value.toDate());
  return null;
}

// If the text cannot be read as a date, show it as it came rather than hide it.
function asIs(value: DateInput): string {
  return typeof value === "string" ? value : "";
}

// 15 Jan 2006
export function formatDate(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return asIs(value);
  return (
    two(date.getDate()) +
    " " +
    MONTHS[date.getMonth()] +
    " " +
    date.getFullYear()
  );
}

// 15 Jan
export function formatDayMonth(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return asIs(value);
  return two(date.getDate()) + " " + MONTHS[date.getMonth()];
}

// Fri 27 Oct
export function formatWeekdayDate(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return asIs(value);
  return (
    WEEKDAYS[date.getDay()] +
    " " +
    two(date.getDate()) +
    " " +
    MONTHS[date.getMonth()]
  );
}

function twelveHour(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return hour12 + ":" + two(minutes) + " " + suffix;
}

// "19:00" -> 7:00 PM
export function formatTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return "";
  return twelveHour(Number(match[1]), Number(match[2]));
}

// 28 Oct, 4:10 PM
export function formatDateTime(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return asIs(value);
  return (
    two(date.getDate()) +
    " " +
    MONTHS[date.getMonth()] +
    ", " +
    twelveHour(date.getHours(), date.getMinutes())
  );
}
