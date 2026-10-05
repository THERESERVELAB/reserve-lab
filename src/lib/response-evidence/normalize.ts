import { estimateActivityStress, type AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import type { ResponseActivity } from "./types";
import type { CompletedSetRecord, MovementExecutionRecord } from "@/lib/training/session-execution";

import type {
  BodyCompositionEvidence,
  BodyCompositionInput,
  ConditioningEvidence,
  ExerciseExposureProfile,
  NormalizedSetExposure,
  NutritionEvidenceInput,
} from "./types";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function poundsToKilograms(pounds: number): number {
  return round(pounds * 0.45359237, 3);
}

export function inchesToCentimeters(inches: number): number {
  return round(inches * 2.54, 2);
}

export function effortFromSet(set: CompletedSetRecord): Pick<NormalizedSetExposure, "effortClass" | "intensityContribution"> {
  const rir = set.actualRir;
  const rpe = set.actualRpe;
  if (rir == null && rpe == null) return { effortClass: "unknown", intensityContribution: 0 };
  const intensity = rpe != null ? Math.min(1, Math.max(0, rpe / 10)) : Math.min(1, Math.max(0, 1 - (rir ?? 10) / 10));
  if ((rpe ?? 0) >= 9.5 || (rir ?? 10) <= 0) return { effortClass: "near-limit", intensityContribution: round(intensity) };
  if ((rpe ?? 0) >= 8 || (rir ?? 10) <= 2) return { effortClass: "high", intensityContribution: round(intensity) };
  if ((rpe ?? 0) >= 6 || (rir ?? 10) <= 4) return { effortClass: "moderate", intensityContribution: round(intensity) };
  return { effortClass: "low", intensityContribution: round(intensity) };
}

export function normalizeCompletedSet(
  set: CompletedSetRecord,
  movement: MovementExecutionRecord,
  profile: ExerciseExposureProfile | null,
): NormalizedSetExposure {
  const limitations: string[] = [];
  let modality: NormalizedSetExposure["modality"] = "unknown";
  if (set.completedDurationSeconds != null) {
    modality = profile?.movementPatterns.includes("repeated-effort") ? "interval" : "timed";
  } else if (set.completedDistanceMeters != null) {
    modality = profile?.movementPatterns.includes("carry") ? "carry" : "distance";
  } else if (set.loadUnit === "assisted") {
    modality = "assisted-reps";
  } else if (set.loadUnit === "bodyweight") {
    modality = "bodyweight-reps";
  } else if (set.completedReps != null && (set.completedLoad != null || set.loadUnit === "band")) {
    modality = "loaded-reps";
  }

  if (set.completedLoad == null && modality === "loaded-reps" && set.loadUnit !== "band") limitations.push("Completed load was not logged.");
  if (set.completedReps == null && ["loaded-reps", "bodyweight-reps", "assisted-reps"].includes(modality)) limitations.push("Completed repetitions were not logged.");
  if (set.actualRir == null) limitations.push("Actual RIR was not logged.");
  if (set.actualRpe == null) limitations.push("Actual RPE was not logged.");
  if (!profile) limitations.push(`Exercise ${movement.performedName} has no classified exposure profile.`);
  if (modality === "unknown") limitations.push("Set modality cannot be determined from actual logged fields.");
  if (!set.completed) limitations.push("The set was recorded as incomplete and contributes no completed exposure.");

  const effort = effortFromSet(set);
  return {
    setId: set.id,
    exerciseId: profile?.exerciseId ?? movement.exerciseId,
    modality,
    completed: set.completed,
    reps: set.completedReps,
    load: set.completedLoad,
    loadUnit: set.loadUnit,
    durationSeconds: set.completedDurationSeconds,
    distanceMeters: set.completedDistanceMeters,
    actualRir: set.actualRir,
    actualRpe: set.actualRpe,
    effortClass: effort.effortClass,
    volumeContribution: set.completed && profile?.resistanceVolumeEligible ? profile.directExposureWeight : 0,
    intensityContribution: set.completed ? effort.intensityContribution : 0,
    limitations,
  };
}

function demandLabel(value: number): string {
  if (value >= 7) return "high";
  if (value >= 4) return "moderate";
  return "low";
}

function impactLabel(activity: AthleteActivity): string {
  if (activity.activityType === "running" || activity.activityType === "sport") return activity.intensity === "high" ? "high" : "moderate";
  if (activity.activityType === "group-fitness") return "moderate";
  if (activity.activityType === "mobility" || activity.activityType === "recovery" || activity.activityType === "conditioning") return "low";
  return "unknown";
}

export function activityDateTime(activity: AthleteActivity): Date | null {
  if (!activity.date) return null;
  const time = activity.startTime && /^\d{2}:\d{2}$/.test(activity.startTime) ? activity.startTime : "12:00";
  const parsed = new Date(`${activity.date}T${time}:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeActivity(activity: ResponseActivity): ConditioningEvidence {
  const stress = estimateActivityStress(activity);
  const limitations: string[] = [];
  if (!activity.date) limitations.push("Activity has no concrete calendar date; proximity cannot be calculated.");
  if (activity.intensity === "unknown") limitations.push("Activity intensity was not reported.");
  if (!activity.expectedStress) limitations.push("Demand labels use the existing deterministic activity-stress estimate.");
  return {
    id: `conditioning:activity:${activity.id}`,
    activityId: activity.id,
    sourceActivityId: activity.sourceActivityId ?? activity.id,
    activityRevisionId: activity.revisionId,
    occurrenceWeekNumber: activity.occurrenceWeekNumber,
    activityRelationship: activity.relationship,
    date: activity.date ?? "unknown",
    modality: activity.activityType === "custom" ? activity.title : activity.activityType,
    durationMinutes: activity.durationMinutes,
    intensity: activity.intensity,
    impact: impactLabel(activity),
    lowerBodyDemand: demandLabel(stress.lowerBody),
    systemicDemand: demandLabel(stress.systemic),
    limitations,
  };
}

export function normalizeBodyComposition(
  body: BodyCompositionInput[],
  nutrition: NutritionEvidenceInput[],
): BodyCompositionEvidence[] {
  const byDate = new Map<string, BodyCompositionEvidence>();
  for (const observation of body) {
    const date = observation.observedAt.slice(0, 10);
    const limitations: string[] = [];
    if (observation.weightKg == null && observation.bodyWeightLb == null) limitations.push("Body weight was not logged.");
    if (observation.bodyFatPercent == null) limitations.push("Body-fat percentage was not logged.");
    if (observation.waistCm == null && observation.waistInches == null) limitations.push("Waist measurement was not logged.");
    byDate.set(date, {
      id: `body:${observation.id}`,
      observedAt: observation.observedAt,
      weightKg: observation.weightKg ?? (observation.bodyWeightLb != null ? poundsToKilograms(observation.bodyWeightLb) : undefined),
      bodyFatPercent: observation.bodyFatPercent,
      waistCm: observation.waistCm ?? (observation.waistInches != null ? inchesToCentimeters(observation.waistInches) : undefined),
      source: observation.source,
      limitations,
    });
  }
  for (const observation of nutrition) {
    const date = observation.observedAt.slice(0, 10);
    const existing = byDate.get(date);
    const limitations = existing?.limitations ? [...existing.limitations] : ["No body-composition observation was logged on this date."];
    if (observation.calorieActual == null) limitations.push("Actual calorie intake was not logged.");
    if (observation.proteinActual == null) limitations.push("Actual protein intake was not logged.");
    byDate.set(date, {
      id: existing?.id ?? `nutrition:${observation.id}`,
      observedAt: existing?.observedAt ?? observation.observedAt,
      weightKg: existing?.weightKg,
      bodyFatPercent: existing?.bodyFatPercent,
      waistCm: existing?.waistCm,
      nutritionPhase: observation.nutritionPhase,
      calorieTarget: observation.calorieTarget,
      calorieActual: observation.calorieActual,
      proteinTarget: observation.proteinTarget,
      proteinActual: observation.proteinActual,
      adherence: observation.adherence,
      source: existing ? `${existing.source}+${observation.source}` : observation.source,
      limitations: [...new Set(limitations)],
    });
  }
  return [...byDate.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

export const aggregateBodyCompositionEvidence = normalizeBodyComposition;
