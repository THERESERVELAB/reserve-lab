import { z } from "zod";

import { exercisePrescriptionSchema, intelligenceQuerySchema } from "@/lib/schemas/ai";

export const valueEngineQuerySchema = intelligenceQuerySchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const cardioMissionSchema = z.object({
  minutes: z.number().int().min(0).max(60),
  intensity: z.enum(["easy", "moderate", "hard"]),
  modality: z.string(),
  note: z.string(),
});

export const saunaMissionSchema = z.object({
  minutes: z.number().int().min(0).max(30),
  hydrationReminder: z.string(),
  note: z.string(),
});

export const absMissionSchema = z.object({
  movements: z.array(exercisePrescriptionSchema),
  priority: z.enum(["mandatory", "optional"]),
  note: z.string(),
});

export const recoveryCommandSchema = z.object({
  title: z.string(),
  decision: z.enum(["train hard", "train modified", "recover today"]).nullable(),
  nervousSystemReadiness: z.string(),
  jointWarning: z.string(),
  sleepDebt: z.string(),
  failurePermission: z.string(),
  cardioIntensityRecommendation: z.string(),
  saunaRecommendation: z.string(),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const todaysCommandSchema = z.object({
  title: z.string(),
  trainingMission: z.unknown(),
  nutritionMission: z.unknown(),
  recoveryDecision: recoveryCommandSchema,
  cardioMission: cardioMissionSchema,
  saunaMission: saunaMissionSchema,
  absMission: absMissionSchema,
  completionPercent: z.number().int().min(0).max(100).nullable(),
  topWarning: z.string(),
  nextBestAction: z.string(),
  startSessionCta: z.string(),
  logMealCta: z.string(),
  recoveryCheckCta: z.string(),
  safetyNote: z.string(),
});

export const exerciseExecutionStateSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  prescribedSets: z.number().int().min(0).max(20),
  completedSets: z.number().int().min(0).max(20),
  currentSet: z.number().int().min(1).max(20),
  targetReps: z.string(),
  targetRir: z.string(),
  loadAdjustment: z.string(),
  swapOptions: z.array(z.unknown()),
  status: z.enum(["pending", "active", "completed", "swapped"]),
});

export const activeWorkoutSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string().uuid().optional(),
  planId: z.string(),
  title: z.string(),
  startedAt: z.string().datetime(),
  status: z.enum(["active", "completed", "abandoned"]),
  currentExerciseId: z.string().nullable(),
  exercises: z.array(exerciseExecutionStateSchema),
  restTimer: z.unknown().nullable(),
  offlineSafe: z.boolean(),
});

export const sessionStartRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  planId: z.string().max(160).optional(),
  splitDay: z.number().int().min(1).max(7).optional(),
  readinessScore: z.number().min(0).max(100).optional(),
  title: z.string().max(160).optional(),
});

export const sessionSetRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(160),
  exerciseId: z.string().min(1).max(160),
  setNumber: z.number().int().min(1).max(20),
  load: z.number().min(0).max(2000).nullable().optional(),
  reps: z.number().int().min(0).max(200),
  rir: z.number().int().min(0).max(10).nullable().optional(),
});

export const sessionSwapRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(160),
  exerciseId: z.string().min(1).max(160),
  originalExercise: z.string().min(1).max(200),
  replacementExercise: z.string().min(1).max(200),
  reason: z.string().max(300).optional(),
  preservesStimulus: z.string().max(160).optional(),
});

export const sessionCompleteRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(160),
  completedExercises: z.number().int().min(0).max(100).default(0),
  completedSets: z.number().int().min(0).max(200).default(0),
  estimatedVolume: z.number().min(0).max(1000000).default(0),
  status: z.enum(["completed", "partial"]).default("completed"),
});

export const progressionSnapshotSchema = z.object({
  title: z.string(),
  beatLastWeek: z.boolean().nullable(),
  addedReps: z.number().int().nullable(),
  addedLoad: z.string(),
  volumeProgression: z.string(),
  bodyweightTrend: z.string(),
  recoveryTrend: z.string(),
  plateauDetection: z.enum(["none", "watch", "plateau"]).nullable(),
  nextOverloadTarget: z.string(),
  coachNote: z.string(),
  safetyNote: z.string(),
});

export const digitalAthleteSnapshotSchema = z.object({
  title: z.string(),
  todaysHighlightedMuscles: z.array(z.string()),
  laggingMuscles: z.array(z.string()),
  dominantMuscles: z.array(z.string()),
  recoveryZones: z.array(z.object({
    zone: z.string(),
    status: z.enum(["fresh", "trained", "watch", "recovering"]),
    note: z.string(),
  })),
  symmetryConcerns: z.array(z.string()),
  musclePriorityScore: z.array(z.object({
    muscle: z.string(),
    score: z.number().int().min(0).max(100),
    reason: z.string(),
  })),
  physiqueStatusSummary: z.string(),
  safetyNote: z.string(),
});

export const physiquePhotoMetadataSchema = z.object({
  angle: z.enum(["front", "side", "back"]),
  storagePath: z.string().max(500).nullable().optional(),
  fileName: z.string().max(240).nullable().optional(),
  capturedAt: z.string().datetime().nullable().optional(),
  lightingNotes: z.string().max(300).nullable().optional(),
});

export const physiqueCheckInRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  photos: z.array(physiquePhotoMetadataSchema).max(3).default([]),
  notes: z.string().max(1000).optional(),
});

export const quickNutritionRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  mode: z.enum(["repeat-yesterday", "copy-training-day", "copy-rest-day", "combo", "restaurant-estimate"]),
  comboId: z.string().max(120).optional(),
  restaurantName: z.string().max(160).optional(),
  mealName: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ValueEngineQuery = z.infer<typeof valueEngineQuerySchema>;
export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>;
export type SessionSetRequest = z.infer<typeof sessionSetRequestSchema>;
export type SessionSwapRequest = z.infer<typeof sessionSwapRequestSchema>;
export type SessionCompleteRequest = z.infer<typeof sessionCompleteRequestSchema>;
export type PhysiqueCheckInRequest = z.infer<typeof physiqueCheckInRequestSchema>;
export type QuickNutritionRequest = z.infer<typeof quickNutritionRequestSchema>;
