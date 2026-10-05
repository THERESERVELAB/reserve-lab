"use client";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { resolveBodyMoment } from "@/lib/log-moments/body";
import {
  activityDayMoment,
  compoundMarkMoment,
  customSessionMoment,
  doneMarkMoment,
  drinkMoment,
  observationMoment,
  resolveDailyCheckInMoment,
  stepsMoment,
  timelineNoteMoment,
} from "@/lib/log-moments/marks";
import { cycleCheckInMoment, labPanelMoment } from "@/lib/log-moments/records";
import { resolveCloseOutMoment } from "@/lib/log-moments/training";
import { localDateKey } from "@/lib/recovery/types";

import { cssAttr, recordLogMoment, stageLogMoment } from "./log-moment-store";

/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT RECORDERS — one call per kind of member log.

   A call site wraps its existing store write: `recordBodyLog(() =>
   addPhysiqueEntry(entry))`. The write runs first and exactly as before; the
   moment is resolved from the member's real before/after record by the pure
   resolvers in src/lib/log-moments, and played by the shell's LogMomentHost.

   A mark that has no before/after to read (a done item, a compound mark)
   is staged after its write with `mark*`.
   ════════════════════════════════════════════════════════════════════════ */

const store = () => useAthleteDashboardStore.getState();

/** A weigh-in, measurements, a progress photo check-in, or a physique check-in carrying both. */
export function recordBodyLog(write: () => void): void {
  recordLogMoment({
    read: () => {
      const { entries, photoCheckIns } = store().physiqueCommand;
      return { entries, photoCheckIns };
    },
    write,
    resolve: (before, after) => {
      const moment = resolveBodyMoment(before, after, localDateKey());
      /* The light lands on the room's first record read (body weight in Measurements). */
      return moment ? { ...moment, key: `body:${moment.kind}`, targets: { readout: "[data-record] dd .tnum" } } : null;
    },
  });
}

/** Closing out a training session. */
export function recordTrainingCloseOut(write: () => void, setsLogged: number): void {
  recordLogMoment({
    read: () => {
      const { sessionMode, executionHistory } = store().trainingSession;
      return { sessionMode: String(sessionMode), executionHistory };
    },
    write,
    resolve: (before, after) => {
      const moment = resolveCloseOutMoment({ before, after, today: localDateKey(), setsLogged });
      return moment ? { ...moment, key: "training:close-out" } : null;
    },
  });
}

/** "Mark Today as Checked In". */
export function recordDailyCheckIn(write: () => void): void {
  recordLogMoment({
    read: () => {
      const { currentStreak, lastCheckInDate } = store().engagement;
      return { currentStreak, lastCheckInDate: lastCheckInDate ?? null };
    },
    write,
    resolve: (before, after) => ({ ...resolveDailyCheckInMoment(before, after, localDateKey()), key: "check-in:day" }),
  });
}

/** A note saved to the member's timeline. The write returns the new note's id, or null when nothing saved. */
export function recordTimelineNote(write: () => string | null, date: string): string | null {
  const id = write();
  if (id) {
    stageLogMoment({
      ...timelineNoteMoment({ date, total: store().timelineNotes.length }),
      key: `note:${id}`,
      /* The new note's own row presses and takes the light. */
      targets: { source: `[data-timeline-note="${cssAttr(id)}"]` },
    });
  }
  return id;
}

/** An observation saved to the timeline. */
export function markObservationSaved(id: string | null): void {
  if (id) stageLogMoment({ ...observationMoment(), key: `observation:${id}` });
}

/**
 * A compound or supplement mark (taken, skipped, a site log). Always the same
 * neutral mark: "Logged". Never a milestone, never the full tier.
 */
export function markCompoundLogged(): void {
  stageLogMoment({ ...compoundMarkMoment(), key: "compound:mark" });
}

/** A planned item marked done or not done. */
export function markDone(input: { key: string; label: string; done: boolean; detail?: string | null }): void {
  stageLogMoment({ ...doneMarkMoment(input), key: `done:${input.key}` });
}

/** A lifestyle-week day recorded done or skipped. */
export function markActivityDay(input: { key: string; label: string; status: "done" | "skipped" }): void {
  stageLogMoment({ ...activityDayMoment(input), key: `activity:${input.key}` });
}

/** Steps saved for a day. */
export function recordSteps(write: () => void, date: string): void {
  recordLogMoment({
    read: () => store().recoveryCommand.stepLogs?.find((log) => log.date === date)?.steps ?? 0,
    write,
    resolve: (before, after) => (after > 0 ? { ...stepsMoment({ before, after }), key: `steps:${date}` } : null),
  });
}

/** A drink logged from the hydration bar. */
export function markDrinkLogged(name: string): void {
  stageLogMoment({ ...drinkMoment({ name }), key: `drink:${name}` });
}

/** A meal logged or cleared outside Nutrition (Apex), where there is no fuel plan readout: a mark. */
export function markMealLogged(mealId: string, logged: boolean): void {
  stageLogMoment({ kind: "meal", tier: "mark", tone: logged ? "log" : "clear", lead: logged ? "Meal logged" : "Meal cleared", detail: [], milestone: null, key: `meal:${mealId}` });
}

/** A custom plan's session marked complete. */
export function markCustomSessionComplete(dayName: string): void {
  stageLogMoment({ ...customSessionMoment({ dayName }), key: `custom-session:${dayName}` });
}

/** A lab panel filed in the Bloodwork Log. Always the quiet mark: a record, never a result. */
export function markLabPanelLogged(input: { markerCount: number; fileCount: number; testDate: string | null }): void {
  stageLogMoment({ ...labPanelMoment(input), key: `lab-panel:${input.testDate ?? "undated"}` });
}

/** A cycle check-in. The day is recorded; what was reported is never judged. */
export function markCycleCheckInLogged(input: { symptomCount: number; date: string }): void {
  stageLogMoment({ ...cycleCheckInMoment(input), key: `cycle-check-in:${input.date}` });
}
