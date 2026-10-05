/* ════════════════════════════════════════════════════════════════════════
   ATHLETE CONTEXT SNAPSHOT — the versioned record of who the athlete was
   when Reserve chose their programming.

   One snapshot is captured at protocol activation and stored WITH the
   program horizon. Later profile changes may trigger a revision decision,
   but they never erase the context that produced the original selection.

   The builder is PURE: it takes a plain input object (mapped from store
   state at the boundary) and never reads the store itself. Every field is
   optional — missing information becomes an explicit assumption, never an
   invented value.

   Organization + coaching structure only. No medical claims, no diagnosis,
   no dosing, no lab interpretation.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";

export const ATHLETE_SNAPSHOT_VERSION = "athlete-snapshot-1";

export type SnapshotConfidence = "low" | "moderate" | "high";
export type GoalPriority = "single-focus" | "balanced" | "performance-led";
export type RecoveryCapacityLevel = "low" | "moderate" | "high";
export type ExperienceBand = "beginner" | "novice" | "intermediate" | "advanced" | "elite";
export type WeightTrendDirection = "falling-fast" | "falling" | "stable" | "rising" | "rising-fast" | "unknown";

/** Pain is recorded as the athlete reports it — never diagnosed or interpreted. */
export type AthletePainRecord = {
  region: string;
  /** Athlete-reported severity 1–10. Recorded only, never interpreted. */
  severity?: number;
  note?: string;
};

export type AthleteContextSnapshot = {
  athleteId: string;
  snapshotVersion: string;
  capturedAt: string;

  profile: {
    age?: number;
    sex?: "male" | "female";
    heightCm?: number;
    weightKg?: number;
    bodyFatPercent?: number;
    estimatedLeanMassKg?: number;
  };

  objectives: {
    primaryGoal: string;
    secondaryGoals: string[];
    targetWeightKg?: number;
    targetBodyFatPercent?: number;
    eventDate?: string;
    priority: GoalPriority;
  };

  training: {
    trainingAgeYears?: number;
    experienceLevel: ExperienceBand;
    currentSplit?: string;
    availableDays: number;
    sessionDurationMinutes?: number;
    preferredTrainingTime?: string;
    strengthMarkers?: Record<string, number>;
    conditioningBackground?: string;
    runningBackground?: string;
    exercisePreferences?: string[];
    exerciseRestrictions?: string[];
    weakPoints?: string[];
  };

  recovery: {
    recoveryCapacity: RecoveryCapacityLevel;
    averageSleepHours?: number;
    sleepConsistency?: string;
    readinessScore?: number;
    restingHeartRate?: number;
    hrv?: number;
    currentPain?: AthletePainRecord[];
    injuryHistory?: string[];
    lifestyleDemand?: string;
  };

  nutrition: {
    phase: string;
    calories?: number;
    proteinGrams?: number;
    adherence?: number;
    hydrationStatus?: string;
    weightTrend: WeightTrendDirection;
    /** kg/week, signed. Negative = losing. Undefined when unknown. */
    weightTrendKgPerWeek?: number;
  };

  environment: {
    equipment: string[];
    scheduleConstraints: string[];
    recurringActivities: AthleteActivity[];
  };

  evidence: {
    completeFields: string[];
    missingFields: string[];
    assumptions: string[];
    confidence: SnapshotConfidence;
  };
};

/* ─── Unit conversion (the app stores imperial; the snapshot is metric) ─── */

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

export function lbToKg(lb: number | null | undefined): number | undefined {
  if (lb == null || !Number.isFinite(lb) || lb <= 0) return undefined;
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}

export function kgToLb(kg: number | null | undefined): number | undefined {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return undefined;
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function inToCm(inches: number | null | undefined): number | undefined {
  if (inches == null || !Number.isFinite(inches) || inches <= 0) return undefined;
  return Math.round(inches * CM_PER_IN * 10) / 10;
}

/** BMI is CONTEXT only — never the programming decision. */
export function bmi(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/* ─── Input — the plain shape the store adapter fills ─────────────────── */

export type AthleteSnapshotInput = {
  athleteId?: string | null;
  capturedAt?: string;

  ageYears?: number | null;
  sex?: "male" | "female" | "other" | null;
  heightIn?: number | null;
  bodyWeightLb?: number | null;
  bodyFatPercent?: number | null;

  primaryGoal?: string | null;
  secondaryGoals?: string[] | null;
  targetWeightLb?: number | null;
  targetBodyFatPercent?: number | null;
  eventDate?: string | null;
  goalPriority?: GoalPriority | null;

  trainingAgeYears?: number | null;
  experienceLevel?: string | null;
  currentSplit?: string | null;
  availableDays?: number | null;
  sessionDurationMinutes?: number | null;
  preferredTrainingTime?: string | null;
  strengthMarkers?: Record<string, number> | null;
  conditioningBackground?: string | null;
  runningBackground?: string | null;
  exercisePreferences?: string[] | null;
  exerciseRestrictions?: string[] | null;
  weakPoints?: string[] | null;

  recoveryCapacity?: RecoveryCapacityLevel | null;
  averageSleepHours?: number | null;
  sleepConsistency?: string | null;
  readinessScore?: number | null;
  restingHeartRate?: number | null;
  hrv?: number | null;
  currentPain?: AthletePainRecord[] | null;
  injuryHistory?: string[] | null;
  /** Occupation / life load — "sedentary" | "active" | "physical" or free text. */
  lifestyleDemand?: string | null;

  nutritionPhase?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  adherence?: number | null;
  hydrationStatus?: string | null;
  /** Recent bodyweight log entries (lb) — newest LAST. Used for the trend. */
  recentWeightsLb?: Array<{ date: string; weightLb: number }> | null;

  equipment?: string[] | null;
  scheduleConstraints?: string[] | null;
  recurringActivities?: AthleteActivity[] | null;
};

/* ─── Derivations ─────────────────────────────────────────────────────── */

const EXPERIENCE_MAP: Record<string, ExperienceBand> = {
  beginner: "beginner",
  foundation: "beginner",
  novice: "novice",
  intermediate: "intermediate",
  advanced: "advanced",
  elite: "elite",
  competitor: "elite",
};

export function normalizeExperience(raw: string | null | undefined, trainingAgeYears?: number | null): ExperienceBand {
  const key = (raw ?? "").trim().toLowerCase();
  if (EXPERIENCE_MAP[key]) return EXPERIENCE_MAP[key];
  if (trainingAgeYears != null) {
    if (trainingAgeYears < 1) return "beginner";
    if (trainingAgeYears < 2) return "novice";
    if (trainingAgeYears < 5) return "intermediate";
    if (trainingAgeYears < 10) return "advanced";
    return "elite";
  }
  return "intermediate";
}

/**
 * Lean mass estimate. Only produced when a measured body-fat percentage is
 * supplied — Reserve never guesses composition from weight, sex, or age.
 */
export function estimateLeanMassKg(weightKg?: number, bodyFatPercent?: number): number | undefined {
  if (!weightKg || bodyFatPercent == null) return undefined;
  if (bodyFatPercent < 3 || bodyFatPercent > 65) return undefined;
  return Math.round(weightKg * (1 - bodyFatPercent / 100) * 10) / 10;
}

/** Weekly weight trend from real logged entries. Needs ≥2 entries ≥5 days apart. */
export function deriveWeightTrend(
  entries: Array<{ date: string; weightLb: number }> | null | undefined,
): { direction: WeightTrendDirection; kgPerWeek?: number } {
  if (!entries || entries.length < 2) return { direction: "unknown" };
  const sorted = [...entries]
    .filter((e) => Number.isFinite(e.weightLb) && e.weightLb > 0 && !Number.isNaN(Date.parse(e.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (sorted.length < 2) return { direction: "unknown" };

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (days < 5) return { direction: "unknown" };

  const deltaKg = (last.weightLb - first.weightLb) / LB_PER_KG;
  const kgPerWeek = Math.round((deltaKg / (days / 7)) * 100) / 100;

  // Bands are intentionally wide: weekly scale noise is not a trend.
  const direction: WeightTrendDirection =
    kgPerWeek <= -0.9 ? "falling-fast"
      : kgPerWeek <= -0.2 ? "falling"
        : kgPerWeek >= 0.9 ? "rising-fast"
          : kgPerWeek >= 0.2 ? "rising"
            : "stable";
  return { direction, kgPerWeek };
}

/* ─── Builder ─────────────────────────────────────────────────────────── */

type FieldSpec = { key: string; present: boolean; assumption?: string };

/**
 * Build the versioned snapshot. Missing data NEVER becomes an invented value —
 * it becomes an entry in `evidence.missingFields` plus, where an operating
 * default was required, an explicit line in `evidence.assumptions`.
 */
export function buildAthleteSnapshot(input: AthleteSnapshotInput): AthleteContextSnapshot {
  const capturedAt = input.capturedAt ?? new Date().toISOString();

  const weightKg = lbToKg(input.bodyWeightLb);
  const heightCm = inToCm(input.heightIn);
  const bodyFatPercent =
    input.bodyFatPercent != null && input.bodyFatPercent > 2 && input.bodyFatPercent < 70
      ? Math.round(input.bodyFatPercent * 10) / 10
      : undefined;
  const leanMassKg = estimateLeanMassKg(weightKg, bodyFatPercent);
  const sex = input.sex === "male" || input.sex === "female" ? input.sex : undefined;

  const availableDaysRaw = input.availableDays ?? null;
  const availableDays = availableDaysRaw != null ? Math.max(2, Math.min(7, Math.round(availableDaysRaw))) : 4;

  const experienceLevel = normalizeExperience(input.experienceLevel, input.trainingAgeYears);
  const recoveryCapacity: RecoveryCapacityLevel = input.recoveryCapacity ?? "moderate";
  const trend = deriveWeightTrend(input.recentWeightsLb);

  const assumptions: string[] = [];
  const fields: FieldSpec[] = [
    { key: "age", present: input.ageYears != null },
    { key: "sex", present: sex != null },
    { key: "height", present: heightCm != null },
    { key: "bodyWeight", present: weightKg != null },
    { key: "bodyFatPercent", present: bodyFatPercent != null, assumption: "Body-fat percentage was not provided — composition-sensitive decisions are held at lower confidence and lean mass is not estimated." },
    { key: "primaryGoal", present: Boolean(input.primaryGoal?.trim()) },
    { key: "targetWeight", present: input.targetWeightLb != null },
    { key: "eventDate", present: Boolean(input.eventDate) },
    { key: "trainingAge", present: input.trainingAgeYears != null },
    { key: "availableDays", present: availableDaysRaw != null, assumption: "Training availability was not set — Reserve is planning around 4 days per week until you confirm your real availability." },
    { key: "sessionDuration", present: input.sessionDurationMinutes != null },
    { key: "recoveryCapacity", present: input.recoveryCapacity != null, assumption: "Recovery capacity was not set — Reserve is assuming moderate recovery until sleep and readiness data accumulate." },
    { key: "sleep", present: input.averageSleepHours != null, assumption: "Sleep duration was not provided — recovery-sensitive volume decisions are held at lower confidence." },
    { key: "readiness", present: input.readinessScore != null },
    { key: "nutritionPhase", present: Boolean(input.nutritionPhase?.trim()) },
    { key: "calories", present: input.calories != null },
    { key: "protein", present: input.proteinGrams != null },
    { key: "weightTrend", present: trend.direction !== "unknown", assumption: "Not enough logged weigh-ins to establish a trend — body-weight-driven adjustments stay paused until a trend exists." },
    { key: "equipment", present: (input.equipment?.length ?? 0) > 0 },
    { key: "runningBackground", present: Boolean(input.runningBackground?.trim()) },
  ];

  const completeFields = fields.filter((f) => f.present).map((f) => f.key);
  const missingFields = fields.filter((f) => !f.present).map((f) => f.key);
  for (const f of fields) {
    if (!f.present && f.assumption) assumptions.push(f.assumption);
  }

  // Confidence is driven by how much of the CORE programming set is real.
  const core = ["bodyWeight", "primaryGoal", "availableDays", "trainingAge", "recoveryCapacity", "sessionDuration"];
  const coreKnown = core.filter((k) => completeFields.includes(k)).length;
  const confidence: SnapshotConfidence =
    coreKnown >= 5 && completeFields.length >= 12 ? "high"
      : coreKnown >= 3 ? "moderate"
        : "low";

  return {
    athleteId: input.athleteId?.trim() || "athlete-local",
    snapshotVersion: ATHLETE_SNAPSHOT_VERSION,
    capturedAt,
    profile: {
      age: input.ageYears ?? undefined,
      sex,
      heightCm,
      weightKg,
      bodyFatPercent,
      estimatedLeanMassKg: leanMassKg,
    },
    objectives: {
      primaryGoal: input.primaryGoal?.trim() || "General physique development",
      secondaryGoals: input.secondaryGoals?.filter(Boolean) ?? [],
      targetWeightKg: lbToKg(input.targetWeightLb),
      targetBodyFatPercent: input.targetBodyFatPercent ?? undefined,
      eventDate: input.eventDate ?? undefined,
      priority: input.goalPriority ?? "balanced",
    },
    training: {
      trainingAgeYears: input.trainingAgeYears ?? undefined,
      experienceLevel,
      currentSplit: input.currentSplit ?? undefined,
      availableDays,
      sessionDurationMinutes: input.sessionDurationMinutes ?? undefined,
      preferredTrainingTime: input.preferredTrainingTime ?? undefined,
      strengthMarkers: input.strengthMarkers ?? undefined,
      conditioningBackground: input.conditioningBackground ?? undefined,
      runningBackground: input.runningBackground ?? undefined,
      exercisePreferences: input.exercisePreferences ?? undefined,
      exerciseRestrictions: input.exerciseRestrictions ?? undefined,
      weakPoints: input.weakPoints?.filter(Boolean) ?? undefined,
    },
    recovery: {
      recoveryCapacity,
      averageSleepHours: input.averageSleepHours ?? undefined,
      sleepConsistency: input.sleepConsistency ?? undefined,
      readinessScore: input.readinessScore ?? undefined,
      restingHeartRate: input.restingHeartRate ?? undefined,
      hrv: input.hrv ?? undefined,
      currentPain: input.currentPain ?? undefined,
      injuryHistory: input.injuryHistory ?? undefined,
      lifestyleDemand: input.lifestyleDemand ?? undefined,
    },
    nutrition: {
      phase: input.nutritionPhase?.trim() || "unspecified",
      calories: input.calories ?? undefined,
      proteinGrams: input.proteinGrams ?? undefined,
      adherence: input.adherence ?? undefined,
      hydrationStatus: input.hydrationStatus ?? undefined,
      weightTrend: trend.direction,
      weightTrendKgPerWeek: trend.kgPerWeek,
    },
    environment: {
      equipment: input.equipment?.filter(Boolean) ?? [],
      scheduleConstraints: input.scheduleConstraints?.filter(Boolean) ?? [],
      recurringActivities: input.recurringActivities ?? [],
    },
    evidence: { completeFields, missingFields, assumptions, confidence },
  };
}

/** Human label for a weight trend, safe for athlete-facing copy. */
export function weightTrendLabel(t: WeightTrendDirection): string {
  switch (t) {
    case "falling-fast": return "falling quickly";
    case "falling": return "trending down";
    case "stable": return "holding stable";
    case "rising": return "trending up";
    case "rising-fast": return "rising quickly";
    default: return "not yet established";
  }
}
