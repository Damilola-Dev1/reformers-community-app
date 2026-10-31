export type DeadlineInfo = {
  dueDate: string;
  dueTime: string;
  extraHours: number;
};

export type Phase = "open" | "extra" | "closed";

// The moment the assignment is due. Old assignments with no time are due at the end of that day.
export function deadlineOf(a: DeadlineInfo): Date | null {
  if (!a.dueDate) return null;
  const [y, m, d] = a.dueDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  if (/^\d{2}:\d{2}$/.test(a.dueTime)) {
    const [hh, mm] = a.dueTime.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// The moment submissions close: the deadline plus the extra hours.
export function closesAtOf(a: DeadlineInfo): Date | null {
  const deadline = deadlineOf(a);
  if (!deadline) return null;
  const hours =
    Number.isFinite(a.extraHours) && a.extraHours > 0 ? a.extraHours : 0;
  return new Date(deadline.getTime() + hours * 60 * 60 * 1000);
}

export function phaseOf(a: DeadlineInfo, now: number): Phase {
  const deadline = deadlineOf(a);
  const closes = closesAtOf(a);
  if (!deadline || !closes) return "open";
  if (now <= deadline.getTime()) return "open";
  if (now <= closes.getTime()) return "extra";
  return "closed";
}

// Reads like: 20 Oct 2026
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "20 Oct 2026" or "20 Oct 2026 at 14:30" when a time was set.
export function formatDeadline(a: DeadlineInfo): string {
  const deadline = deadlineOf(a);
  if (!deadline) return "";
  const base = formatDate(deadline);
  return /^\d{2}:\d{2}$/.test(a.dueTime)
    ? base + " at " + formatTime(deadline)
    : base;
}

// "21 Oct 2026 at 15:30"
export function formatClosing(a: DeadlineInfo): string {
  const closes = closesAtOf(a);
  if (!closes) return "";
  return formatDate(closes) + " at " + formatTime(closes);
}
