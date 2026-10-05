/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE ROOM — what the top of the Schedule screen says, and why.

   Every line comes from a real source (Bible §12): the day status is the one
   training-day resolver's answer (useTodayTrainingDay), the times are the
   member's own, and a schedule the member has not set is said to be unset
   rather than shown as a plan.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { fuelDayClock } from "@/lib/nutrition/fuel-horizon";

import { isSessionDone, sessionWindow } from "./day-horizon";
import { formatTime12, minutesToTime, type SleepConflictSeverity, type TrainingScheduleContext } from "./engine";
import type { MemberScheduleProfile } from "./types";

/** The setup step the onboarding wizard and this screen's editor record when the member sets their day. */
export const SCHEDULE_SETUP_STEP = "schedule";

/** The member has set (or confirmed) their operating times. Starting times alone are not a schedule. */
export function scheduleIsSet(completedSteps: readonly string[] | null | undefined): boolean {
  return (completedSteps ?? []).includes(SCHEDULE_SETUP_STEP);
}

/* ─── Day status ───────────────────────────────────────────────────────── */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-17" → "Thu, Sep 17". Null for anything unreadable. */
export function shortDate(iso: string | null | undefined): string | null {
  const match = typeof iso === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(match[3])) return null;
  return `${WEEKDAY[date.getDay()]}, ${MONTH[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Training day or recovery day, and how the session was moved, exactly as the
 * training-day resolver has it. Nutrition's hero reads the same resolver.
 */
export function scheduleDayStatus(input: {
  trainingPlanned: boolean;
  context: Pick<TrainingScheduleContext, "direction" | "targetDate">;
  sessionLabel: string | null;
}): string {
  const label = input.sessionLabel?.trim() || "Training";
  const { direction, targetDate } = input.context;
  if (input.trainingPlanned) {
    if (direction === "moved-here") return `Training day · ${label} · moved here`;
    if (direction === "swapped") return `Training day · ${label} · swapped in`;
    return `Training day · ${label}`;
  }
  if (direction === "moved-away") {
    const to = shortDate(targetDate);
    return `Recovery day · ${label} moved ${to ? `to ${to}` : "off today"}`;
  }
  if (direction === "set-aside") return `Recovery day · ${label} set aside`;
  return "Recovery day";
}

type TimesInput = {
  schedule: Pick<MemberScheduleProfile, "wakeTime" | "sleepTarget" | "preferredTrainingStart" | "preferredTrainingEnd">;
  trainingPlanned: boolean;
};

/** The member's own operating times, one part per time. The training window only on a day that trains. */
export function scheduleTimesParts(input: TimesInput): string[] {
  const { schedule } = input;
  const parts = [`Wake ${formatTime12(schedule.wakeTime)}`];
  if (input.trainingPlanned) {
    parts.push(`Training ${formatTime12(schedule.preferredTrainingStart)} to ${formatTime12(schedule.preferredTrainingEnd)}`);
  }
  parts.push(`Sleep lock ${formatTime12(schedule.sleepTarget)}`);
  return parts;
}

/** The same times in one line. */
export function scheduleTimesLine(input: TimesInput): string {
  return scheduleTimesParts(input).join(" · ");
}

/* ─── Statement ────────────────────────────────────────────────────────── */

export type ScheduleDayState = "not-set" | "before-wake" | "after-sleep-lock" | "live" | "conflict" | "open";

export function scheduleDayState(input: {
  now: Date;
  schedule: Pick<MemberScheduleProfile, "wakeTime" | "sleepTarget" | "preferredTrainingStart" | "preferredTrainingEnd">;
  scheduleSet: boolean;
  trainingPlanned: boolean;
  sessionMode: string | null | undefined;
  sleepConflict: SleepConflictSeverity;
}): ScheduleDayState {
  if (!input.scheduleSet) return "not-set";
  const { wakeMin, sleepMin, dayMin, nowMin } = fuelDayClock(input.now, input.schedule);
  if (input.trainingPlanned && input.sessionMode === "live") return "live";
  if (nowMin < wakeMin) return "before-wake";
  if (nowMin >= sleepMin) return "after-sleep-lock";
  if (input.trainingPlanned && input.sleepConflict === "conflict" && !isSessionDone(input.sessionMode)) {
    const win = sessionWindow(input.schedule, dayMin);
    if (nowMin < win.startMin - 20) return "conflict";
  }
  return "open";
}

/** One statement per state of the day. The screen is designed around it. */
export function scheduleStatement(input: { state: ScheduleDayState; trainingPlanned: boolean }): string {
  switch (input.state) {
    case "not-set":
      return "Set Your Day.";
    case "before-wake":
      return "Day Staged.";
    case "after-sleep-lock":
      return "Day Closed.";
    case "live":
      return "Session Live.";
    case "conflict":
      return "Clear The Sleep Window.";
    case "open":
      return input.trainingPlanned ? "Session Day Mapped." : "Recovery Day Mapped.";
  }
}

/** "4:12 PM" for a day-space minute. */
export const clockLabel = (min: number): string => formatTime12(minutesToTime(min));
