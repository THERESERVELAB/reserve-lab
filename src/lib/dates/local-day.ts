/* ════════════════════════════════════════════════════════════════════════
   LOCAL DAY — the member's own calendar day, as YYYY-MM-DD.

   Never `toISOString().slice(0, 10)` for "today" or any day a member logs
   against: that is the UTC day, which in every US time zone rolls over in
   the evening. A meal eaten or water logged at 9pm would be filed under
   tomorrow, and a daily total would reset hours before midnight.

   Timestamps (`createdAt`, `loggedAt`) stay full ISO instants; only day keys
   use this.
   ════════════════════════════════════════════════════════════════════════ */

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A stored day key (or the date part of an ISO instant) as a member reads it —
 * "Jan 4, 2027". Read as the calendar day it names, never shifted by time zone.
 * Null when the text is not a date.
 */
export function calendarDateLabel(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${Number(match[3])}, ${match[1]}` : null;
}

/** The local day `days` after (or before, when negative) `date`. DST-safe. */
export function localDateKeyOffset(date: Date, days: number): string {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return localDateKey(shifted);
}
