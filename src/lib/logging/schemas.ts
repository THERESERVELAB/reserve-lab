/**
 * FINAL BOSS ATHLETE — Logging Schemas
 *
 * Zod schemas for all structured logging types:
 * - Per-set workout logs (weight, reps, RIR, tempo, joint feedback, pump score)
 * - Training session logs
 * - Nutrition day logs (meals, macros, day type)
 * - Recovery logs (HRV, sleep, readiness)
 * - Backfill requests (previous-day editing)
 *
 * All types are offline-safe — no Supabase dependency.
 */

import { z } from "zod";

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

const boundedQueryInteger = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    },
    z.number().int().min(min).max(max),
  );

export const dateLimitQuerySchema = z.object({
  date: dateStringSchema.optional(),
  limit: boundedQueryInteger(7, 1, 90),
});

export const backfillCalendarQuerySchema = z.object({
  days: boundedQueryInteger(30, 1, 90),
});

/* ─── Set Log ────────────────────────────────────────── */

export const jointFeedbackSchema = z.enum(["none", "mild", "moderate", "significant"]);
export type JointFeedback = z.infer<typeof jointFeedbackSchema>;

export const setLogSchema = z.object({
  setNumber: z.number().int().min(1).max(12),
  weight: z.number().min(0).max(2000).nullable().default(null),    // lbs or kg
  reps: z.number().int().min(0).max(200).nullable().default(null),
  rir: z.number().int().min(0).max(10).nullable().default(null),   // Reps In Reserve
  tempo: z.string().max(20).nullable().default(null),              // e.g. "3-1-X-1"
  notes: z.string().max(500).nullable().default(null),
  jointFeedback: jointFeedbackSchema.default("none"),
  pumpScore: z.number().int().min(1).max(10).nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
});
export type SetLog = z.infer<typeof setLogSchema>;

/* ─── Exercise Log Entry ─────────────────────────────── */

export const exerciseLogEntrySchema = z.object({
  id: z.string().optional(),
  exerciseId: z.string().optional(),
  exerciseName: z.string().min(1).max(200),
  bodyGroup: z.string().max(80).nullable().default(null),
  targetMuscle: z.string().max(120).nullable().default(null),
  sets: z.array(setLogSchema).min(1).max(15),
  notes: z.string().max(1000).nullable().default(null),
  rpe: z.number().min(1).max(10).nullable().default(null),
  prescribedSets: z.number().int().min(0).optional(),
  prescribedReps: z.string().max(40).optional(),
  prescribedRir: z.string().max(40).optional(),
  loggedAt: z.string().datetime().nullable().default(null),
});
export type ExerciseLogEntry = z.infer<typeof exerciseLogEntrySchema>;

/* ─── Training Session Log ───────────────────────────── */

export const trainingSessionLogSchema = z.object({
  id: z.string().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  date: dateStringSchema,
  splitDay: z.number().int().min(0).max(7).nullable().default(null),
  focus: z.string().max(200).nullable().default(null),
  readinessScore: z.number().int().min(0).max(100).nullable().default(null),
  perceivedEffort: z.number().int().min(1).max(10).nullable().default(null),
  exerciseLogs: z.array(exerciseLogEntrySchema).default([]),
  cardioMinutes: z.number().int().min(0).max(180).nullable().default(null),
  saunaMinutes: z.number().int().min(0).max(90).nullable().default(null),
  totalVolumeLbs: z.number().min(0).nullable().default(null),
  totalSetsCompleted: z.number().int().min(0).nullable().default(null),
  mood: z.enum(["great", "good", "okay", "poor"]).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
  status: z.enum(["draft", "completed", "partial", "skipped"]).default("draft"),
  completedAt: z.string().datetime().nullable().default(null),
  source: z.enum(["manual", "quick-log", "repeat", "backfill"]).default("manual"),
});
export type TrainingSessionLog = z.infer<typeof trainingSessionLogSchema>;

/* ─── Quick Log Request ──────────────────────────────── */

export const quickTrainingLogSchema = z.object({
  date: dateStringSchema,
  focus: z.string().max(200).optional(),
  perceivedEffort: z.number().int().min(1).max(10).optional(),
  cardioMinutes: z.number().int().min(0).max(180).optional(),
  saunaMinutes: z.number().int().min(0).max(90).optional(),
  mood: z.enum(["great", "good", "okay", "poor"]).optional(),
  notes: z.string().max(2000).optional(),
  completedSets: z.number().int().min(0).optional(),
  estimatedVolumeLbs: z.number().min(0).optional(),
});
export type QuickTrainingLog = z.infer<typeof quickTrainingLogSchema>;

/* ─── Nutrition Logs ─────────────────────────────────── */

export const mealTimingSchema = z.enum([
  "pre-workout",
  "intra-workout",
  "post-workout",
  "morning",
  "midday",
  "evening",
  "night",
  "snack",
]);
export type MealTiming = z.infer<typeof mealTimingSchema>;

export const nutritionMealLogSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(500),
  calories: z.number().min(0).max(5000),
  timing: mealTimingSchema.nullable().default(null),
  foods: z.array(z.string().max(200)).max(20).default([]),
  isQuickAdd: z.boolean().default(false),
  comboId: z.string().nullable().default(null),
  loggedAt: z.string().datetime().nullable().default(null),
});
export type NutritionMealLog = z.infer<typeof nutritionMealLogSchema>;

export const quickNutritionMealLogSchema = nutritionMealLogSchema.extend({
  date: dateStringSchema.optional(),
});
export type QuickNutritionMealLog = z.infer<typeof quickNutritionMealLogSchema>;

export const nutritionDayLogSchema = z.object({
  id: z.string().optional(),
  userId: z.string().uuid().optional(),
  date: dateStringSchema,
  dayType: z.enum(["training", "rest", "refeed"]).default("training"),
  meals: z.array(nutritionMealLogSchema).default([]),
  totalProtein: z.number().min(0).default(0),
  totalCarbs: z.number().min(0).default(0),
  totalFat: z.number().min(0).default(0),
  totalCalories: z.number().min(0).default(0),
  waterLiters: z.number().min(0).max(20).nullable().default(null),
  adherenceScore: z.number().int().min(0).max(100).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  source: z.enum(["manual", "quick-log", "repeat", "backfill", "combo"]).default("manual"),
});
export type NutritionDayLog = z.infer<typeof nutritionDayLogSchema>;

/* ─── Recovery Log ───────────────────────────────────── */

export const sleepQualitySchema = z.enum(["poor", "fair", "good", "excellent"]);
export type SleepQuality = z.infer<typeof sleepQualitySchema>;

export const recoveryLogSchema = z.object({
  id: z.string().optional(),
  userId: z.string().uuid().optional(),
  date: dateStringSchema,
  hrv: z.number().min(0).max(500).nullable().default(null),           // ms
  restingHr: z.number().int().min(20).max(200).nullable().default(null), // bpm
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  sleepQuality: sleepQualitySchema.nullable().default(null),
  readinessScore: z.number().int().min(0).max(100).nullable().default(null),
  moodScore: z.number().int().min(1).max(10).nullable().default(null),
  jointFeedback: jointFeedbackSchema.nullable().default(null),
  cnsFeeling: z.enum(["sharp", "normal", "foggy", "flat"]).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  source: z.enum(["manual", "wearable", "backfill"]).default("manual"),
});
export type RecoveryLog = z.infer<typeof recoveryLogSchema>;

/* ─── Backfill Request ───────────────────────────────── */

export const backfillRequestSchema = z.discriminatedUnion("logType", [
  z.object({
    logType: z.literal("training"),
    targetDate: dateStringSchema,
    data: trainingSessionLogSchema,
  }),
  z.object({
    logType: z.literal("nutrition"),
    targetDate: dateStringSchema,
    data: nutritionDayLogSchema,
  }),
  z.object({
    logType: z.literal("recovery"),
    targetDate: dateStringSchema,
    data: recoveryLogSchema,
  }),
]);
export type BackfillRequest = z.infer<typeof backfillRequestSchema>;

/* ─── API Response ───────────────────────────────────── */

export const logResponseSchema = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  mode: z.enum(["persisted", "queued", "local_only"]),
  message: z.string(),
});
export type LogResponse = z.infer<typeof logResponseSchema>;

/* ─── Compute totals helper ──────────────────────────── */

export function computeNutritionTotals(meals: NutritionMealLog[]): {
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalCalories: number;
} {
  return meals.reduce(
    (acc, meal) => ({
      totalProtein: acc.totalProtein + meal.protein,
      totalCarbs: acc.totalCarbs + meal.carbs,
      totalFat: acc.totalFat + meal.fat,
      totalCalories: acc.totalCalories + meal.calories,
    }),
    { totalProtein: 0, totalCarbs: 0, totalFat: 0, totalCalories: 0 },
  );
}

export function computeSessionVolume(exerciseLogs: ExerciseLogEntry[]): {
  totalVolumeLbs: number;
  totalSetsCompleted: number;
} {
  let totalVolumeLbs = 0;
  let totalSetsCompleted = 0;

  for (const ex of exerciseLogs) {
    for (const set of ex.sets) {
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      totalVolumeLbs += weight * reps;
      totalSetsCompleted += 1;
    }
  }

  return { totalVolumeLbs, totalSetsCompleted };
}
