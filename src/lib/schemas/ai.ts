import { z } from "zod";

export const aiBriefRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  persona: z.enum(["beginner", "intermediate", "advanced"]),
  tier: z.enum(["core", "pro", "elite"]),
  readinessScore: z.number().min(0).max(100).optional(),
  adherenceScore: z.number().min(0).max(100).optional(),
  focus: z.string().max(160).optional(),
});

export const aiBriefResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  watchItems: z.array(z.string()).max(5),
  trainingFocus: z.string(),
  retentionNote: z.string(),
  upgradeTeaser: z.string(),
  safetyNote: z.string(),
});

export type AiBriefRequest = z.infer<typeof aiBriefRequestSchema>;
export type AiBriefResponse = z.infer<typeof aiBriefResponseSchema>;

const optionalQueryNumber = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return Number(value);
    },
    z.number().min(min).max(max).optional(),
  );

const optionalQueryInteger = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return Number(value);
    },
    z.number().int().min(min).max(max).optional(),
  );

const queryBoolean = z.preprocess((value) => value === "true" || value === true, z.boolean()).default(false);

export const safeAiContextSchema = z.object({
  userId: z.string().uuid().optional(),
  persona: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  tier: z.enum(["core", "pro", "elite"]).optional(),
  focus: z.string().max(180).optional(),
});

export const intelligenceQuerySchema = safeAiContextSchema.extend({
  persist: queryBoolean,
  name: z.string().min(1).max(80).optional(),
  goal: z.string().min(1).max(160).optional(),
  trainingStyle: z.string().min(1).max(120).optional(),
  primaryFocus: z.string().min(1).max(160).optional(),
  readinessScore: optionalQueryNumber(0, 100),
  adherenceScore: optionalQueryNumber(0, 100),
  bodyweight: optionalQueryNumber(70, 700),
  splitDay: optionalQueryInteger(1, 7),
});

export const trainingIntelligenceRequestSchema = safeAiContextSchema.extend({
  readinessScore: z.number().min(0).max(100).optional(),
  weakPoints: z.array(z.string().max(80)).max(8).default([]),
  recentTrainingNotes: z.string().max(800).optional(),
});

export const projectionRequestSchema = safeAiContextSchema.extend({
  goalState: z.string().max(180).optional(),
  currentMetrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const retentionCoachingRequestSchema = safeAiContextSchema.extend({
  currentStreak: z.number().int().min(0).default(0),
  adherenceScore: z.number().min(0).max(100).optional(),
  churnRiskScore: z.number().min(0).max(100).optional(),
});

export const upgradePersuasionRequestSchema = safeAiContextSchema.extend({
  featureKey: z.string().max(120),
  requiredTier: z.enum(["core", "pro", "elite"]),
  source: z.string().max(120).optional(),
});

export const aiServiceResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()).max(5),
  safetyNote: z.string(),
});

export const rirTargetSchema = z.object({
  min: z.number().int().min(0).max(5),
  max: z.number().int().min(0).max(5),
  label: z.string(),
});

export const tempoPrescriptionSchema = z.object({
  notation: z.string(),
  eccentric: z.string(),
  pause: z.string(),
  concentric: z.string(),
});

export const restPrescriptionSchema = z.object({
  seconds: z.number().int().min(30).max(300),
  range: z.string(),
  note: z.string(),
});

export const progressionRuleSchema = z.object({
  model: z.enum(["double-progression", "load-progression", "rep-quality", "volume-hold", "recovery-gated"]),
  trigger: z.string(),
  nextAction: z.string(),
  deloadSignal: z.string().nullable().optional(),
});

export const substitutionOptionSchema = z.object({
  name: z.string(),
  reason: z.string(),
  equipment: z.string(),
  preservesStimulus: z.string(),
});

export const stimulusFatigueProfileSchema = z.object({
  stimulusType: z.string(),
  localFatigue: z.number().int().min(0).max(10),
  systemicFatigue: z.number().int().min(0).max(10),
  jointStress: z.enum(["low", "moderate", "high"]),
  recoveryDemand: z.enum(["low", "moderate", "high"]),
});

export const exercisePrescriptionSchema = z.object({
  exerciseId: z.string().optional(),
  name: z.string(),
  bodyGroup: z.string(),
  exactMuscle: z.string(),
  stimulusType: z.string(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()).default([]),
  sets: z.number().int().min(1).max(8),
  repRange: z.string(),
  reps: z.string(),
  rir: rirTargetSchema,
  tempo: tempoPrescriptionSchema,
  rest: restPrescriptionSchema,
  executionCue: z.string(),
  progressionRule: progressionRuleSchema,
  substitutionOptions: z.array(substitutionOptionSchema).min(1).max(4),
  fatigueNotes: z.string(),
  stimulusFatigueProfile: stimulusFatigueProfileSchema,
  intensityTarget: z.string().nullable().optional(),
  restSeconds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const recoveryGateSchema = z.object({
  status: z.enum(["green", "yellow", "red"]),
  readinessScore: z.number().min(0).max(100).nullable(),
  decision: z.string(),
  adjustments: z.array(z.string()),
});

export const sessionBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  intent: z.string(),
  bodyGroups: z.array(z.string()),
  estimatedMinutes: z.number().int().min(5).max(90),
  exercises: z.array(exercisePrescriptionSchema),
});

export const muscleTargetSchema = z.object({
  bodyGroup: z.string(),
  exactMuscle: z.string(),
  role: z.enum(["priority", "secondary", "abs", "cardio", "mobility"]),
  targetSets: z.number().int().min(0).optional(),
  note: z.string().nullable().optional(),
});

export const mesocycleStateSchema = z.object({
  week: z.number().int().min(1).max(16),
  phase: z.enum(["accumulation", "intensification", "specialization", "deload", "recovery"]),
  volumeBias: z.enum(["low", "moderate", "high"]),
  intensityBias: z.enum(["moderate", "high"]),
  fatigueTrend: z.enum(["low", "stable", "watch", "high"]),
});

export const trainingSessionPlanSchema = z.object({
  id: z.string(),
  userId: z.string().uuid().optional(),
  title: z.string(),
  focus: z.string(),
  athleteName: z.string(),
  goal: z.string(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  splitName: z.string(),
  splitDay: z.number().int().min(1).max(7),
  scheduledDay: z.string(),
  equipment: z.string(),
  estimatedDurationMinutes: z.number().int().min(20).max(180),
  muscleTargets: z.array(muscleTargetSchema),
  blocks: z.array(sessionBlockSchema),
  cardioMinutes: z.number().int().min(0).max(45),
  saunaMinutes: z.number().int().min(0).max(30),
  recoveryGate: recoveryGateSchema,
  mesocycleState: mesocycleStateSchema,
  scheduledFor: z.string().nullable().optional(),
  readinessContext: z.number().min(0).max(100).nullable().optional(),
  exercises: z.array(exercisePrescriptionSchema),
});

export const dailyMissionSchema = z.object({
  title: z.string(),
  trainingMission: trainingSessionPlanSchema,
  bodyGroups: z.array(z.string()),
  proteinTarget: z.string(),
  hydrationTarget: z.string(),
  steps: z.number().int().min(0),
  cardioMinutes: z.number().int().min(0),
  saunaMinutes: z.number().int().min(0),
  sleepTarget: z.string(),
  completionPercent: z.number().int().min(0).max(100).nullable(),
  priorityWarning: z.string(),
  missionIntensity: z.enum(["recovery", "moderate", "high", "elite"]),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const nutritionMissionSchema = z.object({
  title: z.string(),
  trainingDayMacros: z.object({ calories: z.number(), proteinG: z.number(), carbsG: z.number(), fatG: z.number() }).nullable(),
  restDayMacros: z.object({ calories: z.number(), proteinG: z.number(), carbsG: z.number(), fatG: z.number() }).nullable(),
  highDay: z.string(),
  lowDay: z.string(),
  preWorkoutTiming: z.string(),
  postWorkoutPriority: z.string(),
  hydration: z.string(),
  sodiumStrategyPlaceholder: z.string(),
  bodyweightTrendAdjustment: z.string(),
  adherenceScore: z.number().min(0).max(100).nullable(),
  digestionNotes: z.string(),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const recoveryDecisionSchema = z.object({
  title: z.string(),
  decision: z.enum(["train hard", "train moderate", "recovery priority"]).nullable(),
  failurePermission: z.string(),
  jointStress: z.enum(["low", "moderate", "high"]).nullable(),
  cnsStress: z.enum(["low", "moderate", "high"]).nullable(),
  volumeAdjustment: z.string(),
  cardioRecommendation: z.string(),
  saunaRecommendation: z.string(),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const physiqueCritiqueSchema = z.object({
  title: z.string(),
  weakPoints: z.array(z.string()),
  dominantBodyParts: z.array(z.string()),
  visualBottlenecks: z.array(z.string()),
  specializationRecommendation: z.string(),
  symmetryScore: z.number().int().min(0).max(100).nullable(),
  nextFocusBlock: z.string(),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const projectionSnapshotSchema = z.object({
  week: z.union([z.literal(4), z.literal(8), z.literal(12)]),
  estimatedBodyweight: z.string(),
  estimatedAdherence: z.number().int().min(0).max(100).nullable(),
  visualSummary: z.string(),
  riskNote: z.string(),
  coachNote: z.string(),
});

export const projectionReportSchema = z.object({
  title: z.string(),
  snapshots: z.array(projectionSnapshotSchema).length(3),
  safetyNote: z.string(),
});

export type TrainingIntelligenceRequest = z.infer<typeof trainingIntelligenceRequestSchema>;
export type ProjectionRequest = z.infer<typeof projectionRequestSchema>;
export type RetentionCoachingRequest = z.infer<typeof retentionCoachingRequestSchema>;
export type UpgradePersuasionRequest = z.infer<typeof upgradePersuasionRequestSchema>;
export type AiServiceResponse = z.infer<typeof aiServiceResponseSchema>;
export type IntelligenceQuery = z.infer<typeof intelligenceQuerySchema>;
export type TrainingSessionPlanOutput = z.infer<typeof trainingSessionPlanSchema>;
export type DailyMissionOutput = z.infer<typeof dailyMissionSchema>;
export type NutritionMissionOutput = z.infer<typeof nutritionMissionSchema>;
export type RecoveryDecisionOutput = z.infer<typeof recoveryDecisionSchema>;
export type PhysiqueCritiqueOutput = z.infer<typeof physiqueCritiqueSchema>;
export type ProjectionReportOutput = z.infer<typeof projectionReportSchema>;
