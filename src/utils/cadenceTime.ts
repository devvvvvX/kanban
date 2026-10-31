import type { TodoCadence } from "../lib/todos/todoService";

/**
 * Returns number of days left in the current week (assuming week ends on Sunday 23:59).
 */
export function getDaysLeftInWeek(now = new Date()): number {
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // If Sunday (0), it's the last day of the week: 0 days left
  if (dayOfWeek === 0) return 0;
  return 7 - dayOfWeek;
}

/**
 * Returns number of days left in the current month.
 */
export function getDaysLeftInMonth(now = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  return Math.max(0, lastDay - currentDay);
}

/**
 * Returns number of days left in the current quarter.
 */
export function getDaysLeftInQuarter(now = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  let quarterEndMonth = 2; // Q1: March
  if (month >= 9) quarterEndMonth = 11; // Q4: Dec
  else if (month >= 6) quarterEndMonth = 8; // Q3: Sep
  else if (month >= 3) quarterEndMonth = 5; // Q2: Jun

  const quarterEndDate = new Date(year, quarterEndMonth + 1, 0);
  const diffTime = quarterEndDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Returns a human-friendly string for cadence time remaining.
 */
export function getCadenceRemainingLabel(cadence: TodoCadence, now = new Date()): string | null {
  if (cadence === "weekly") {
    const days = getDaysLeftInWeek(now);
    if (days === 0) return "Ends today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  }
  if (cadence === "monthly") {
    const days = getDaysLeftInMonth(now);
    if (days === 0) return "Ends today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  }
  if (cadence === "quarterly") {
    const days = getDaysLeftInQuarter(now);
    if (days === 0) return "Ends today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  }
  return null;
}

/**
 * Returns relative countdown label for target dates (e.g. "Due today", "3 days left", "Overdue by 2d").
 */
export function getTargetDateRemainingLabel(targetDateStr: string, now = new Date()): string | null {
  if (!targetDateStr) return null;
  try {
    const [year, month, day] = targetDateStr.split("-").map(Number);
    if (!year || !month || !day) return null;
    const target = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1) return `${diffDays} days left`;
    return `Overdue by ${Math.abs(diffDays)}d`;
  } catch {
    return null;
  }
}

/**
 * Returns the user's local timezone name (e.g. "Asia/Kolkata", "America/New_York").
 */
export function getLocalTimezoneFull(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  } catch {
    return "Local";
  }
}

/**
 * Returns a short local timezone label (e.g. "IST", "EDT", "GMT+5:30").
 */
export function getLocalTimezoneShort(): string {
  try {
    const d = new Date();
    const str = d.toLocaleDateString([], { timeZoneName: "short" });
    const parts = str.split(" ");
    return parts[parts.length - 1] || getLocalTimezoneFull();
  } catch {
    return "Local";
  }
}

/**
 * Converts a Date or ISO timestamp into a local datetime string "YYYY-MM-DDTHH:mm"
 * suitable for inputs and local pickers without UTC offset shifts.
 */
export function toLocalDatetimeString(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a Date or ISO timestamp into a local date string "YYYY-MM-DD".
 */
export function toLocalDateString(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts a local datetime string "YYYY-MM-DDTHH:mm" to a standard ISO string.
 */
export function localDatetimeToISO(localStr: string): string {
  if (!localStr) return "";
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Formats an ISO reminder timestamp in the user's local timezone.
 * E.g. "Today at 4:30 PM", "Tomorrow at 9:00 AM", "Sat, Nov 15 at 2:00 PM"
 */
export function formatLocalReminder(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Tomorrow at ${timeStr}`;
  if (diffDays === -1) return `Yesterday at ${timeStr}`;
  if (diffDays > 1 && diffDays < 7) {
    const dayName = d.toLocaleDateString([], { weekday: "short" });
    return `${dayName} at ${timeStr}`;
  }
  const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dateStr} at ${timeStr}`;
}
