/* Builders that produce a DayPlanVersion — the live-day engine's input —
   from structured schedule facts. Used to seed fixture days and to bridge
   the real member's schedule profile into the coaching live-day system. */

import { newId, nowIso } from "../ids";
import type { DayPlanVersion, DayTimelineEntry } from "../types";

export type PlannedDayInput = {
  wakeTime: string;
  bedTime: string;
  trainingTime: string | null;
  sessionTitle: string | null;
  sessionDemand: DayPlanVersion["sessionDemand"];
  mealTimes: Array<{ label: string; time: string }>;
  cardio?: { label: string; time: string; durationMinutes?: number } | null;
  workBlocks?: Array<{ label: string; time: string; durationMinutes?: number }>;
  mobility?: { label: string; time: string } | null;
  createdBy?: DayPlanVersion["createdBy"];
};

export function buildPlannedDay(input: PlannedDayInput): DayPlanVersion {
  const entries: DayTimelineEntry[] = [];
  entries.push({ id: newId("ent"), kind: "wake", label: "Wake", time: input.wakeTime });
  input.mealTimes.forEach((meal) => {
    entries.push({ id: newId("ent"), kind: "meal", label: meal.label, time: meal.time });
  });
  if (input.trainingTime && input.sessionTitle) {
    entries.push({
      id: newId("ent"),
      kind: "training",
      label: input.sessionTitle,
      time: input.trainingTime,
      durationMinutes: 75,
    });
  }
  if (input.cardio) {
    entries.push({
      id: newId("ent"),
      kind: "cardio",
      label: input.cardio.label,
      time: input.cardio.time,
      durationMinutes: input.cardio.durationMinutes ?? 20,
    });
  }
  (input.workBlocks ?? []).forEach((block) => {
    entries.push({
      id: newId("ent"),
      kind: "work",
      label: block.label,
      time: block.time,
      durationMinutes: block.durationMinutes,
    });
  });
  if (input.mobility) {
    entries.push({ id: newId("ent"), kind: "mobility", label: input.mobility.label, time: input.mobility.time });
  }
  entries.push({ id: newId("ent"), kind: "bed", label: "Bedtime", time: input.bedTime });
  entries.sort((a, b) => a.time.localeCompare(b.time));
  return {
    id: newId("dpv"),
    createdAt: nowIso(),
    createdBy: input.createdBy ?? "reserve",
    wakeTime: input.wakeTime,
    bedTime: input.bedTime,
    trainingTime: input.trainingTime,
    sessionTitle: input.sessionTitle,
    sessionDemand: input.sessionDemand,
    entries,
  };
}
