/* ════════════════════════════════════════════════════════════════════════
   DECISION LOG FORMATTING — what a member reads, not what the engine stores.

   Two defects the page audit found on the Decision Log:

     · "Weeks 2949–2958". Date-only evidence (body composition, nutrition)
       keys its weeks as whole weeks since 1970 (`isoWeeksForDates` in
       domains.ts); session evidence uses program week numbers. The log
       printed both raw. A key that large is a calendar week, so it is shown
       as the dates it covers; a program week stays "Program week 3".
     · "-0.22 kg per week" shown to a member whose settings say imperial and
       whose check-ins are logged in lb. The engine works in kg; the log now
       speaks the member's unit.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

const WEEK_MS = 7 * 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KG_TO_LB = 2.20462;

/** Anything this large cannot be a program week: ten years of weekly blocks. */
const CALENDAR_WEEK_FLOOR = 520;

/** The calendar day an epoch-week key starts on, as a local date with the same Y/M/D. */
function calendarWeekStart(week: number): Date {
  const utc = new Date(week * WEEK_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function monthDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Sep 15, 2026" — deterministic, locale-independent, from a local day. */
export function formatLogDay(date: Date): string {
  return `${monthDay(date)}, ${date.getFullYear()}`;
}

/**
 * The weeks an entry covers, in words a member can read.
 * Returns null when there are none.
 */
export function formatAffectedWeeks(weeks: readonly number[]): string | null {
  const sorted = [...new Set(weeks)].filter((week) => Number.isFinite(week)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (first >= CALENDAR_WEEK_FLOOR) {
    const start = calendarWeekStart(first);
    const end = addDays(calendarWeekStart(last), 6);
    const range =
      start.getFullYear() === end.getFullYear()
        ? `${monthDay(start)} – ${monthDay(end)}, ${end.getFullYear()}`
        : `${formatLogDay(start)} – ${formatLogDay(end)}`;
    return `${sorted.length === 1 ? "Week of" : "Weeks of"} ${range}`;
  }

  if (sorted.length === 1) return `Program week ${first}`;
  return `Program weeks ${first}–${last}`;
}

export type UnitSystem = "imperial" | "metric";

/**
 * Rewrites a body-weight rate the engine phrased in kg into the member's unit.
 * Only the rate phrase changes; the rest of the sentence is the engine's own.
 */
export function localizeWeightRate(text: string, units: UnitSystem): string {
  if (units !== "imperial") return text;
  return text.replace(/(-?\d+(?:\.\d+)?)\s*kg(?:\s+per\s+week|\/week)/g, (_match, value: string) => {
    const lb = Math.round(Number(value) * KG_TO_LB * 100) / 100;
    return `${lb} lb per week`;
  });
}
