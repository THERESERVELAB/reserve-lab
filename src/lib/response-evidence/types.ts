import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import type { SleepLog } from "@/lib/recovery/types";
import type { SessionExecutionRecord, WeekExecutionSummary } from "@/lib/training/session-execution";

export const RESPONSE_EVIDENCE_VERSION = 1;

export type EvidenceQuality = "insufficient" | "low" | "moderate" | "high";

export type ResponseEvidenceSource =
  | "session"
  | "movement"
  | "set"
  | "week"
  | "activity"
  | "readiness"
  | "sleep"
  | "pain"
  | "weight"
  | "measurement"
  | "nutrition"
  | "athlete-feedback";

export type ResponseEvidenceDomain =
  | "volume"
  | "frequency"
  | "exercise"
  | "performance"
  | "recovery"
  | "conditioning"
  | "body-composition"
  | "nutrition"
  | "adherence"
  | "pain";

export type ResponseEvidenceRecord = {
  id: string;
  athleteId: string;
  observedAt: string;
  calendarDate: string;
  source: ResponseEvidenceSource;
  domain: ResponseEvidenceDomain;
  metric: string;
  value: number | string | boolean | null;
  unit?: string;
  context: Record<string, string | number | boolean | null>;
  comparisonKey?: string;
  provenance: {
    executionRecordId?: string;
    movementRecordId?: string;
    setRecordId?: string;
    activityId?: string;
    weekNumber?: number;
    decisionRecordId?: string;
    migrated?: boolean;
  };
  quality: EvidenceQuality;
  limitations: string[];
};

export type MovementPattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "locomotion"
  | "rotation"
  | "anti-rotation"
  | "trunk-flexion"
  | "trunk-extension"
  | "calf-and-ankle"
  | "power"
  | "jump"
  | "sprint"
  | "aerobic"
  | "repeated-effort"
  | "mobility"
  | "recovery"
  | "knee-flexion"
  | "hip-extension"
  | "isolation";

export type ExerciseExposureProfile = {
  exerciseId: string;
  movementPatterns: MovementPattern[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  directExposureWeight: number;
  indirectExposureWeight: number;
  resistanceVolumeEligible: boolean;
  characteristics: {
    compound: boolean;
    unilateral: boolean;
    axialLoad: "none" | "low" | "moderate" | "high";
    impact: "none" | "low" | "moderate" | "high";
    stabilityDemand: "low" | "moderate" | "high";
    eccentricDemand: "low" | "moderate" | "high";
    systemicDemand: "low" | "moderate" | "high";
  };
  provenance: "movement-library" | "frozen-session-metadata";
  limitations: string[];
};

export type SetModality =
  | "loaded-reps"
  | "bodyweight-reps"
  | "assisted-reps"
  | "timed"
  | "distance"
  | "carry"
  | "interval"
  | "unknown";

export type NormalizedSetExposure = {
  setId: string;
  exerciseId: string;
  modality: SetModality;
  completed: boolean;
  reps?: number;
  load?: number;
  loadUnit?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  actualRir?: number;
  actualRpe?: number;
  effortClass: "unknown" | "low" | "moderate" | "high" | "near-limit";
  volumeContribution: number;
  intensityContribution: number;
  limitations: string[];
};

export type MuscleExposureSummary = {
  muscle: string;
  plannedDirectSets: number;
  completedDirectSetEquivalents: number;
  completedIndirectSetEquivalents: number;
  totalExposureEquivalent: number;
  exposureDays: number;
  completedExposureDates: string[];
  highEffortSets: number;
  nearLimitSets: number;
  addedExposure: number;
  substitutedExposure: number;
  replacementActivityExposure: number;
  confidence: EvidenceQuality;
  limitations: string[];
};

export type MovementExposureSummary = {
  pattern: MovementPattern;
  completedExposureEquivalent: number;
  exposureDays: number;
  exposureDates: string[];
  highEffortSets: number;
  nearLimitSets: number;
  contributingMovementIds: string[];
  confidence: EvidenceQuality;
  limitations: string[];
};

export type FrequencyEvidence = {
  target: string;
  category: "muscle" | "movement-pattern" | "primary-lift";
  plannedWeeklyFrequency: number;
  completedWeeklyFrequency: number;
  exposureDates: string[];
  spacingHours: number[];
  averageSpacingHours?: number;
  minimumSpacingHours?: number;
  maximumSpacingHours?: number;
};

export type ExercisePerformanceObservation = {
  id: string;
  executionRecordId: string;
  movementRecordId: string;
  exerciseId: string;
  performedName: string;
  performedAt: string;
  comparisonKey: string;
  bestCompletedLoad?: number;
  loadUnit?: string;
  totalCompletedReps?: number;
  completedSets: number;
  failedSets: number;
  averageActualRir?: number;
  averageActualRpe?: number;
  painMax?: number;
  stimulusRating?: number;
  difficultyRating?: number;
  sessionQuality?: number;
  comparableToPrevious: boolean;
  comparabilityLimitations: string[];
  comparisonContext: {
    variation: string;
    repTarget?: string;
    unilateral?: boolean;
    phaseId?: string;
    sessionRole?: string;
    conditioningProximityHours?: number;
    nutritionPhase?: string;
    recoveryContext?: string;
    weeklyTrainingContext?: string;
  };
};

export type ConditioningEvidence = {
  id: string;
  activityId?: string;
  sourceActivityId?: string;
  activityRevisionId?: string;
  occurrenceWeekNumber?: number;
  activityRelationship?: AthleteActivity["relationship"];
  sessionId?: string;
  date: string;
  modality: string;
  durationMinutes?: number;
  distanceMeters?: number;
  intensity?: string;
  impact?: string;
  lowerBodyDemand?: string;
  systemicDemand?: string;
  proximityToPreviousLowerTrainingHours?: number;
  proximityToNextLowerTrainingHours?: number;
  limitations: string[];
};

export type AthletePainRecord = { region: string; severity?: number; note?: string };

export type RecoveryContextEvidence = {
  sessionId: string;
  calendarDate: string;
  sleepHours?: number;
  readinessScore?: number;
  restingHeartRate?: number;
  hrv?: number;
  painBefore?: AthletePainRecord[];
  painDuring?: AthletePainRecord[];
  hoursSinceRelatedExposure?: number;
  hoursSinceHighDemandSession?: number;
  recentConditioningDemand?: string;
  recentLocalDemand?: Record<string, number>;
  missingFields: string[];
};

export type BodyCompositionEvidence = {
  id: string;
  observedAt: string;
  weightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  nutritionPhase?: string;
  calorieTarget?: number;
  calorieActual?: number;
  proteinTarget?: number;
  proteinActual?: number;
  adherence?: number;
  source: string;
  limitations: string[];
};

export type ReadinessEvidenceInput = {
  id: string;
  date: string;
  readinessScore?: number;
  restingHeartRate?: number;
  hrv?: number;
  painBefore?: AthletePainRecord[];
};

export type BodyCompositionInput = {
  id: string;
  observedAt: string;
  bodyWeightLb?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  waistInches?: number;
  waistCm?: number;
  source: string;
};

export type NutritionEvidenceInput = {
  id: string;
  observedAt: string;
  nutritionPhase?: string;
  calorieTarget?: number;
  calorieActual?: number;
  proteinTarget?: number;
  proteinActual?: number;
  adherence?: number;
  source: string;
};

export type EvidenceProvenance = {
  contributingSessions: string[];
  contributingMovements: string[];
  contributingSets: string[];
  contributingActivities: string[];
  contributingActivitySources: string[];
  contributingActivityRevisions: string[];
  includedWeeks: number[];
  excludedEvidence: Array<{ id: string; reason: string }>;
};

/** A canonical AthleteActivity materialized for one evidence occurrence. The
    added fields are provenance only; modality, duration, intensity, impact,
    focus, and relationship still come from AthleteActivity. */
export type ResponseActivity = AthleteActivity & {
  sourceActivityId?: string;
  revisionId?: string;
  occurrenceWeekNumber?: number;
};

export type ResponseEvidenceInput = {
  athleteId?: string;
  executionRecords: SessionExecutionRecord[];
  weekSummaries?: WeekExecutionSummary[];
  activities?: ResponseActivity[];
  sleepLogs?: SleepLog[];
  readiness?: ReadinessEvidenceInput[];
  bodyComposition?: BodyCompositionInput[];
  nutrition?: NutritionEvidenceInput[];
};

export type EvidenceComparison = {
  comparable: boolean;
  score: number;
  sharedConditions: string[];
  meaningfulDifferences: string[];
  blockingDifferences: string[];
  confidence: EvidenceQuality;
};

export type ResponseEvidenceBundle = {
  version: number;
  athleteId: string;
  evidence: ResponseEvidenceRecord[];
  normalizedSets: NormalizedSetExposure[];
  muscleExposure: MuscleExposureSummary[];
  movementExposure: MovementExposureSummary[];
  frequency: FrequencyEvidence[];
  performance: ExercisePerformanceObservation[];
  conditioning: ConditioningEvidence[];
  recovery: RecoveryContextEvidence[];
  bodyComposition: BodyCompositionEvidence[];
  provenance: EvidenceProvenance;
  limitations: string[];
};

export type EvidenceWindow =
  | "last-session"
  | "last-comparable-exposure"
  | "current-week"
  | "previous-week"
  | "last-four-weeks"
  | "current-phase"
  | "previous-phase"
  | "entire-training-block";
