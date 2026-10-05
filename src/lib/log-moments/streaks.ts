/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT STREAKS — counting the member's own record, nothing else.

   Days are local "YYYY-MM-DD" keys, weeks start on Monday. A streak is the
   run of consecutive days (or weeks) that END today (or this week) with at
   least one entry. A broken streak is simply zero: never mentioned, never
   a penalty.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

const pad = (n: number) => String(n).padStart(2, "0");

function parseKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The local day key `days` from `key` (negative for earlier). */
export function shiftDay(key: string, days: number): string {
  const date = parseKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + days);
  return toKey(date);
}

/** The Monday that starts the week containing `key`. */
export function weekStartKey(key: string): string {
  const date = parseKey(key);
  if (!date) return key;
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toKey(date);
}

/** Consecutive days ending `today` with at least one entry. Zero when today has none. */
export function dayStreak(dates: Iterable<string>, today: string): number {
  const days = new Set(dates);
  let streak = 0;
  for (let day = today; days.has(day); day = shiftDay(day, -1)) streak += 1;
  return streak;
}

/** Consecutive weeks ending this week with at least one entry. Zero when this week has none. */
export function weekStreak(dates: Iterable<string>, today: string): number {
  const weeks = new Set(Array.from(dates, weekStartKey));
  let streak = 0;
  for (let week = weekStartKey(today); weeks.has(week); week = shiftDay(week, -7)) streak += 1;
  return streak;
}

/** Entries on or after the day six days before `today` (the rolling seven days the rooms use). */
export function inLastSevenDays(date: string, today: string): boolean {
  return date >= shiftDay(today, -6) && date <= today;
}

export const DAY_STREAK_MARKS = [3, 7, 14, 30, 60, 100] as const;
export const WEEK_STREAK_MARKS = [4, 8, 12, 26, 52] as const;
export const COUNT_MARKS = [10, 25, 50, 100, 250] as const;

/** The mark this log just reached (`after` is a mark and `before` was below it), or null. */
export function reachedMark(before: number, after: number, marks: readonly number[]): number | null {
  if (after <= before) return null;
  return marks.find((mark) => before < mark && after >= mark && after === mark) ?? null;
}
