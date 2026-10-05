/* ════════════════════════════════════════════════════════════════════════
   SLEEP WINDOW — bedtime and wake time as positions on a slider, and the
   night between them as a duration a person can read at a glance.

   Members drag to when they fell asleep and when they woke. No typing, no
   arithmetic, and a night that crosses midnight is just a night.
   ════════════════════════════════════════════════════════════════════════ */

export const SLEEP_STEP_MINUTES = 15;

/** Each slider covers ten hours, starting at the hour below. */
const SPAN_MINUTES = 10 * 60;
export const BEDTIME_WINDOW = { startHour: 19, span: SPAN_MINUTES } as const; // 7:00 PM → 5:00 AM
export const WAKE_WINDOW = { startHour: 3, span: SPAN_MINUTES } as const; // 3:00 AM → 1:00 PM

type Window = { startHour: number; span: number };

const DAY = 24 * 60;

function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function toTime(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Slider position (minutes from the window's start) → "HH:MM". */
export function positionToTime(position: number, window: Window): string {
  return toTime(window.startHour * 60 + position);
}

/** "HH:MM" → slider position, snapped to the step and clamped into the window. */
export function timeToPosition(hhmm: string, window: Window): number {
  const t = parseTime(hhmm);
  if (t == null) return 0;
  const offset = (t - window.startHour * 60 + DAY) % DAY;
  const snapped = Math.round(offset / SLEEP_STEP_MINUTES) * SLEEP_STEP_MINUTES;
  return Math.min(window.span, Math.max(0, snapped));
}

/** Minutes asleep between bedtime and wake, across midnight. Null until both are set. */
export function sleepMinutes(bedtime: string, wakeTime: string): number | null {
  const b = parseTime(bedtime);
  const w = parseTime(wakeTime);
  if (b == null || w == null) return null;
  const diff = (w - b + DAY) % DAY;
  return diff === 0 ? null : diff;
}

/** 450 → "7h 30m"; 480 → "8h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Stored hours keep one decimal, as every existing sleep log does. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/** How the night sits against the member's own target, in plain words. */
export function targetLine(minutes: number, targetHours: number): string | null {
  if (!(targetHours > 0)) return null;
  const delta = minutes - Math.round(targetHours * 60);
  if (Math.abs(delta) < SLEEP_STEP_MINUTES) return `Right on your ${formatDuration(Math.round(targetHours * 60))} target`;
  return delta > 0
    ? `${formatDuration(delta)} over your ${formatDuration(Math.round(targetHours * 60))} target`
    : `${formatDuration(-delta)} short of your ${formatDuration(Math.round(targetHours * 60))} target`;
}
