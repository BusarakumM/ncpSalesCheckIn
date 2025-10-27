import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safely formats a date-like value for display.
// - Accepts ISO strings, yyyy-mm-dd, or Date.
// - Returns empty string for invalid/missing inputs to avoid "Invalid Date" rendering.
export function formatDateDisplay(d?: string | Date, locale: string = "en-GB"): string {
  if (!d) return "";
  let dt: Date;
  if (d instanceof Date) {
    dt = d;
  } else if (typeof d === "string") {
    const s = d.trim();
    if (!s) return "";
    // If just a date part (yyyy-mm-dd), coerce to UTC midnight to avoid TZ shifts
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      dt = new Date(`${s}T00:00:00Z`);
    } else {
      dt = new Date(s);
    }
  } else {
    return "";
  }
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}
