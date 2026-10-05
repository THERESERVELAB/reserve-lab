/* ════════════════════════════════════════════════════════════════════════
   MEAL TIMING ENGINE
   ------------------------------------------------------------------------
   Builds meal windows from the member's day: wake, sleep, work/commute,
   training, meal spacing, and bedtime buffer. Pure scheduling — no advice.
   ════════════════════════════════════════════════════════════════════════ */

import type { DailySchedule, DayType, MealPurpose } from "./types";

export type MealWindow = {
  order: number;
  label: string;
  purpose: MealPurpose;
  timeMinutes: number;
  timeLabel: string;
};

export function parseHM(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return null;
  return (h || 0) * 60 + (m || 0);
}

export function formatHM(total: number): string {
  const norm = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function overlapsBlock(min: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null) return false;
  return min >= start && min <= end;
}

function nudgeOutOfBlock(min: number, blocks: Array<[number | null, number | null]>): number {
  let t = min;
  for (const [s, e] of blocks) {
    if (overlapsBlock(t, s, e) && s !== null) {
      // push to just before the block start (eat before work/commute) if there's room, else after
      t = s - 30;
    }
  }
  return t;
}

const PURPOSE_LABEL: Record<MealPurpose, string> = {
  "morning-anchor": "Meal 1 · Morning Anchor",
  "work-meal": "Work Meal",
  "midday-meal": "Midday Meal",
  "pre-workout": "Pre-Workout Meal",
  "post-workout": "Post-Workout Meal",
  "night-recovery": "Night Recovery Meal",
  "rest-day-anchor": "Rest-Day Anchor",
  "snack": "Snack",
};

/**
 * Build evenly-spaced meal windows anchored to wake/sleep, with a pre-workout
 * meal ~90-150 min before training and a post-workout meal after training.
 * Meals avoid work/commute blocks where possible and respect the bedtime buffer.
 */
export function buildMealWindows(schedule: DailySchedule, dayType: DayType): MealWindow[] {
  const wake = parseHM(schedule.wakeTime) ?? 7 * 60;
  let sleep = parseHM(schedule.sleepTime) ?? 23 * 60;
  if (sleep <= wake) sleep += 1440; // crosses midnight
  const bedBufferH = schedule.lastMealBeforeBedHours ?? 2;
  const lastMealLatest = sleep - bedBufferH * 60;

  const trainStart = parseHM(schedule.trainingStartTime);
  const trainEnd = parseHM(schedule.trainingEndTime) ?? (trainStart !== null ? trainStart + 90 : null);

  const workBlock: [number | null, number | null] = [parseHM(schedule.workStartTime), parseHM(schedule.workEndTime)];
  const commuteBlock: [number | null, number | null] = [parseHM(schedule.commuteStartTime), parseHM(schedule.commuteEndTime)];
  const blocks: Array<[number | null, number | null]> = [workBlock, commuteBlock];

  const count = Math.max(2, Math.min(7, schedule.preferredMealCount ?? (dayType === "training" ? 5 : 4)));

  const windows: MealWindow[] = [];
  const firstMeal = wake + 30;

  // Reserve pre/post workout slots when training time is known.
  const hasTraining = dayType === "training" && trainStart !== null;

  // Distribute "anchor" meals across the eating day, then inject pre/post-workout.
  const span = Math.max(60, lastMealLatest - firstMeal);
  const anchorCount = hasTraining ? Math.max(2, count - 2) : count;
  const step = span / Math.max(1, anchorCount - 1);

  const anchors: number[] = [];
  for (let i = 0; i < anchorCount; i += 1) {
    anchors.push(Math.round(firstMeal + step * i));
  }

  const raw: Array<{ time: number; purpose: MealPurpose }> = [];
  anchors.forEach((t, i) => {
    const purpose: MealPurpose =
      i === 0 ? (dayType === "training" ? "morning-anchor" : "rest-day-anchor")
      : i === anchorCount - 1 ? "night-recovery"
      : "midday-meal";
    raw.push({ time: nudgeOutOfBlock(t, blocks), purpose });
  });

  if (hasTraining && trainStart !== null) {
    raw.push({ time: trainStart - 105, purpose: "pre-workout" });        // ~90-150 min before
    raw.push({ time: (trainEnd ?? trainStart + 90) + 30, purpose: "post-workout" }); // after training
  }

  // Sort, clamp into the eating day, and label.
  raw.sort((a, b) => a.time - b.time);
  raw.forEach((slot, i) => {
    const clamped = Math.max(firstMeal, Math.min(lastMealLatest + 75, slot.time)); // post-workout may run slightly past
    windows.push({
      order: i + 1,
      label: PURPOSE_LABEL[slot.purpose],
      purpose: slot.purpose,
      timeMinutes: clamped,
      timeLabel: formatHM(clamped),
    });
  });

  return windows;
}
