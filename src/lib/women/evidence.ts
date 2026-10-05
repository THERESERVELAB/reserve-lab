/* ════════════════════════════════════════════════════════════════════════
   RESERVE WOMEN — THE MEMBER'S OWN EVIDENCE.

   Builds `WomensEvidence` from the logs the product actually writes:

     cycle        womens.cycle + womens.cycleLogs (Cycle Command's own logs)
     sleep/water  recoveryCommand (the Recovery room's loggers)
     meals        nutritionPrefs (the Nutrition room's meal confirmations)
     check-ins    physiqueCommand (the Physique and Progress Photos loggers)
     training     the resolved training day every room reads

   The women's slice also carries `recovery`, `nutrition.recentAdherence` and
   `physique` — no action writes them, so nothing here reads them.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import {
  cycleBasis,
  estimatePhaseOn,
  localISODate,
  periodStarts,
} from "./cycle";
import type { WomensEvidence } from "./primary-actions";
import type { CycleLogEntry, CycleProfile, FertilityModuleState, PregnancyModuleState } from "./types";

export type WomensEvidenceInput = {
  now: Date;
  cycle: CycleProfile;
  cycleLogs: readonly CycleLogEntry[];
  fertility: Pick<FertilityModuleState, "enabled" | "focusAreas">;
  pregnancy: Pick<PregnancyModuleState, "enabled" | "stage">;
  sleepLogs: readonly { date: string }[];
  hydrationLogs: readonly { date: string; oz: number }[];
  /** The Recovery room's own label, only when it has enough to read. */
  recoveryLabel: string | null;
  loggedMealIds: readonly string[];
  nutritionLogDate: string | null;
  nutritionLogHistory: Readonly<Record<string, readonly string[]>>;
  checkIns: readonly { date: string }[];
  photoCheckIns: readonly { date: string }[];
  trainingPlannedToday: boolean;
  sessionTitle: string | null;
};

/** Areas a member can track in Fertility Command — each backed by a log Reserve keeps. */
export const TRACKABLE_FERTILITY_AREAS = ["sleep", "hydration", "stress", "nutrition", "recovery"] as const;
export type TrackableFertilityArea = (typeof TRACKABLE_FERTILITY_AREAS)[number];

export function isTrackableFertilityArea(area: string): area is TrackableFertilityArea {
  return (TRACKABLE_FERTILITY_AREAS as readonly string[]).includes(area);
}

/** Days with at least one logged meal: archived days plus today's live log. */
export function mealDayKeys(input: Pick<WomensEvidenceInput, "loggedMealIds" | "nutritionLogDate" | "nutritionLogHistory">): string[] {
  const days = new Set(Object.entries(input.nutritionLogHistory).filter(([, ids]) => ids.length > 0).map(([day]) => day));
  if (input.nutritionLogDate && input.loggedMealIds.length > 0) days.add(input.nutritionLogDate);
  return [...days].sort();
}

export function buildWomensEvidence(input: WomensEvidenceInput): WomensEvidence {
  const today = localISODate(input.now);
  const starts = periodStarts(input.cycle, input.cycleLogs);
  const estimate = estimatePhaseOn(today, input.cycle, starts);
  const basis = cycleBasis(input.cycle);
  const loggedDays = new Set(input.cycleLogs.map((l) => l.date));
  const feltDays = new Set(input.cycleLogs.filter((l) => l.trainingPerformance).map((l) => l.date));
  const sleepDays = new Set(input.sleepLogs.map((l) => l.date));

  return {
    cycle: {
      entered: starts.length > 0 && estimate.start !== null,
      dayOfCycle: estimate.dayOfCycle,
      phase: estimate.phase,
      beyondEstimate: estimate.beyondEstimate,
      basisEntered: basis.entered,
      daysBetweenStarts: basis.daysBetweenStarts,
    },
    loggedDays: loggedDays.size,
    dayLoggedToday: loggedDays.has(today),
    trainingFeltDays: feltDays.size,
    trainingFeltToday: feltDays.has(today),
    trainingPlannedToday: input.trainingPlannedToday,
    sessionTitle: input.sessionTitle,
    sleepNights: sleepDays.size,
    sleepLoggedToday: sleepDays.has(today),
    waterLoggedToday: input.hydrationLogs.some((l) => l.date === today && l.oz > 0),
    recoveryLabel: input.recoveryLabel,
    mealsToday: input.nutritionLogDate === today ? input.loggedMealIds.length : 0,
    mealDays: mealDayKeys(input).length,
    checkIns: input.checkIns.length,
    photoCheckIns: input.photoCheckIns.length,
    fertilityEnabled: input.fertility.enabled,
    fertilityAreas: input.fertility.focusAreas.filter(isTrackableFertilityArea).length,
    pregnancyEnabled: input.pregnancy.enabled,
    pregnancyStage: input.pregnancy.stage ?? null,
  };
}
