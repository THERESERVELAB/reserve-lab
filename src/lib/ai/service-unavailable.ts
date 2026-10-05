/* ════════════════════════════════════════════════════════════════════════
   AI SERVICE UNAVAILABLE — what a member sees when an AI call fails.

   Nothing here is sampled (DESIGN_BIBLE §12): numbers are null, lists are
   empty, and the copy names what is missing and where the member's own logs
   live. The hooks return these instead of the sample objects they once held.
   ════════════════════════════════════════════════════════════════════════ */

import type { DigitalAthleteSnapshot, NutritionCommand, ProgressionSnapshot, RecoveryCommand } from "@/lib/contracts/product";

const SAFETY_NOTE = "Observational tracking only. Not medical advice.";

export const NUTRITION_COMMAND_UNAVAILABLE: NutritionCommand = {
  title: "Nutrition command unavailable",
  repeatYesterday: "Your logged meals are in the fuel log.",
  copyTrainingDay: "Open the fuel log to plan a training day.",
  copyRestDay: "Open the fuel log to plan a rest day.",
  oneClickCombos: [],
  restaurantEstimate: "Log a restaurant meal as an estimate in the fuel log.",
  adherenceScore: null,
  missedMealWarning: "Not available: the nutrition service could not be reached.",
  proteinGap: "Not available. The fuel log shows the protein you logged today.",
  hydrationGap: "Not available. Log water to see today's intake.",
  coachNote: "The nutrition service is unavailable. Reserve does not show sample figures in its place.",
  safetyNote: SAFETY_NOTE,
};

export const PROGRESSION_UNAVAILABLE: ProgressionSnapshot = {
  title: "Progression unavailable",
  beatLastWeek: null,
  addedReps: null,
  addedLoad: "Not available. Your logged top sets are in Training.",
  volumeProgression: "Not available.",
  bodyweightTrend: "Not available. Your weigh-ins are in Physique.",
  recoveryTrend: "Not available.",
  plateauDetection: null,
  nextOverloadTarget: "Beat your last logged top set by one clean rep.",
  coachNote: "The progression service is unavailable. Reserve does not show sample figures in its place.",
  safetyNote: SAFETY_NOTE,
};

export const DIGITAL_ATHLETE_UNAVAILABLE: DigitalAthleteSnapshot = {
  title: "Digital athlete unavailable",
  todaysHighlightedMuscles: [],
  laggingMuscles: [],
  dominantMuscles: [],
  recoveryZones: [],
  symmetryConcerns: [],
  musclePriorityScore: [],
  physiqueStatusSummary:
    "The service could not be reached. Reserve does not score your physique; priority areas come from the weak points you select in Physique.",
  safetyNote: SAFETY_NOTE,
};

export const RECOVERY_COMMAND_UNAVAILABLE: RecoveryCommand = {
  title: "Recovery Command — Today's Decision",
  decision: null,
  nervousSystemReadiness: "Evidence needed — no live readiness metric is available.",
  jointWarning: "Evidence needed — no athlete-reported joint context is available.",
  sleepDebt: "Evidence needed — sleep duration is not available.",
  failurePermission: "No session modification is inferred without live recovery evidence.",
  cardioIntensityRecommendation: "No conditioning adjustment is inferred without an active Program Horizon.",
  saunaRecommendation: "No recovery-tool recommendation is inferred from missing data.",
  coachNote:
    "The recovery service is unavailable. Review the active Horizon and member-entered logs; Reserve will not substitute sample metrics.",
  safetyNote: "Recovery trend observation only. Missing evidence remains missing; not medical advice.",
};
