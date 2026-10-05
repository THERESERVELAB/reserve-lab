/**
 * FINAL BOSS ATHLETE — Offline-Safe Logging Store
 *
 * localStorage-backed store for all log types.
 * Works fully offline. Queues changes for sync when Supabase becomes available.
 *
 * Pattern matches analytics/offline-queue.ts — proven in this codebase.
 */

import type {
  ExerciseLogEntry,
  NutritionDayLog,
  NutritionMealLog,
  RecoveryLog,
  TrainingSessionLog,
} from "./schemas";
import { computeNutritionTotals, computeSessionVolume } from "./schemas";

/* ─── Storage Keys ───────────────────────────────────── */

const KEYS = {
  training: "fba.logs.training.v1",
  nutrition: "fba.logs.nutrition.v1",
  recovery: "fba.logs.recovery.v1",
  pendingSync: "fba.logs.pending.v1",
} as const;

export const LOCAL_LOGS_CHANGED_EVENT = "reserve:local-logs-changed";

const MAX_LOG_DAYS = 90; // Keep up to 90 days locally

/* ─── Date Utilities ─────────────────────────────────── */

export function toDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDate(): string {
  return toDateString(new Date());
}

export function yesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

export function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateString(d);
}

/* ─── Safe localStorage Helpers ─────────────────────── */

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(LOCAL_LOGS_CHANGED_EVENT));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/* ─── Pending Sync Queue ─────────────────────────────── */

type PendingItem = {
  type: "training" | "nutrition" | "recovery";
  date: string;
  queuedAt: string;
};

export function queueForSync(type: PendingItem["type"], date: string): void {
  const queue = readJson<PendingItem[]>(KEYS.pendingSync, []);
  const exists = queue.some((item) => item.type === type && item.date === date);
  if (!exists) {
    queue.push({ type, date, queuedAt: new Date().toISOString() });
    writeJson(KEYS.pendingSync, queue);
  }
}

export function dequeueSync(type: PendingItem["type"], date: string): void {
  const queue = readJson<PendingItem[]>(KEYS.pendingSync, []);
  writeJson(
    KEYS.pendingSync,
    queue.filter((item) => !(item.type === type && item.date === date)),
  );
}

export function readPendingSync(): PendingItem[] {
  return readJson<PendingItem[]>(KEYS.pendingSync, []);
}

/* ─── Training Logs ──────────────────────────────────── */

type TrainingLogMap = Record<string, TrainingSessionLog>;

function readTrainingMap(): TrainingLogMap {
  return readJson<TrainingLogMap>(KEYS.training, {});
}

export function saveTrainingLog(log: TrainingSessionLog): void {
  const { totalVolumeLbs, totalSetsCompleted } = computeSessionVolume(log.exerciseLogs);
  const hydrated: TrainingSessionLog = {
    ...log,
    totalVolumeLbs,
    totalSetsCompleted,
    status: log.status === "draft" ? "completed" : log.status,
    completedAt: log.completedAt ?? new Date().toISOString(),
  };
  const map = readTrainingMap();
  map[log.date] = hydrated;
  pruneMap(map, MAX_LOG_DAYS);
  writeJson(KEYS.training, map);
  queueForSync("training", log.date);
}

export function getTrainingLog(date: string): TrainingSessionLog | null {
  return readTrainingMap()[date] ?? null;
}

export function getTodayTrainingLog(): TrainingSessionLog | null {
  return getTrainingLog(todayDate());
}

export function getYesterdayTrainingLog(): TrainingSessionLog | null {
  return getTrainingLog(yesterdayDate());
}

export function getRecentTrainingLogs(limit = 7): TrainingSessionLog[] {
  const map = readTrainingMap();
  return Object.values(map)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function deleteTrainingLog(date: string): void {
  const map = readTrainingMap();
  delete map[date];
  writeJson(KEYS.training, map);
}

/**
 * Clone the most recent completed session to a new date.
 * Exercise prescriptions carry over; set actuals are cleared.
 */
export function repeatPreviousTrainingDay(targetDate: string): TrainingSessionLog | null {
  const map = readTrainingMap();
  const previous = Object.values(map)
    .filter((l) => l.status === "completed" && l.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!previous) return null;

  return {
    ...previous,
    id: undefined,
    date: targetDate,
    status: "draft",
    completedAt: null,
    totalVolumeLbs: null,
    totalSetsCompleted: null,
    source: "repeat",
    exerciseLogs: previous.exerciseLogs.map((ex) => ({
      ...ex,
      id: undefined,
      loggedAt: null,
      sets: ex.sets.map((s) => ({
        ...s,
        // Keep prescribed weight/reps as targets; clear completion metadata
        completedAt: null,
        notes: null,
        jointFeedback: "none" as const,
        pumpScore: null,
      })),
    })),
  };
}

/**
 * Build a draft session log from a training plan prescription.
 * Caller passes in the exercise list from TrainingView.
 */
export function buildDraftSessionLog(
  date: string,
  focus: string,
  splitDay: number | null,
  exercises: Array<{
    exerciseName: string;
    bodyGroup?: string;
    targetMuscle?: string;
    prescribedSets: number;
    prescribedReps: string;
    prescribedRir?: string;
  }>,
): TrainingSessionLog {
  const exerciseLogs: ExerciseLogEntry[] = exercises
    .filter((ex) => ex.prescribedSets > 0)
    .map((ex) => ({
      exerciseName: ex.exerciseName,
      bodyGroup: ex.bodyGroup ?? null,
      targetMuscle: ex.targetMuscle ?? null,
      prescribedSets: ex.prescribedSets,
      prescribedReps: ex.prescribedReps,
      prescribedRir: ex.prescribedRir,
      rpe: null,
      notes: null,
      loggedAt: null,
      sets: Array.from({ length: ex.prescribedSets }, (_, i) => ({
        setNumber: i + 1,
        weight: null,
        reps: null,
        rir: null,
        tempo: null,
        notes: null,
        jointFeedback: "none" as const,
        pumpScore: null,
        completedAt: null,
      })),
    }));

  return {
    date,
    splitDay,
    focus,
    status: "draft",
    source: "manual",
    exerciseLogs,
    readinessScore: null,
    perceivedEffort: null,
    cardioMinutes: null,
    saunaMinutes: null,
    totalVolumeLbs: null,
    totalSetsCompleted: null,
    mood: null,
    notes: null,
    completedAt: null,
  };
}

/* ─── Nutrition Logs ─────────────────────────────────── */

type NutritionLogMap = Record<string, NutritionDayLog>;

function readNutritionMap(): NutritionLogMap {
  return readJson<NutritionLogMap>(KEYS.nutrition, {});
}

export function saveNutritionLog(log: NutritionDayLog): void {
  const totals = computeNutritionTotals(log.meals);
  const hydrated: NutritionDayLog = { ...log, ...totals };
  const map = readNutritionMap();
  map[log.date] = hydrated;
  pruneMap(map, MAX_LOG_DAYS);
  writeJson(KEYS.nutrition, map);
  queueForSync("nutrition", log.date);
}

export function addMealToDay(date: string, meal: NutritionMealLog): NutritionDayLog {
  const map = readNutritionMap();
  const existing = map[date] ?? buildEmptyNutritionDay(date);
  const updated: NutritionDayLog = {
    ...existing,
    meals: [...existing.meals, { ...meal, id: `meal-${Date.now()}` }],
  };
  const totals = computeNutritionTotals(updated.meals);
  const hydrated = { ...updated, ...totals };
  map[date] = hydrated;
  writeJson(KEYS.nutrition, map);
  queueForSync("nutrition", date);
  return hydrated;
}

export function removeMealFromDay(date: string, mealId: string): NutritionDayLog | null {
  const map = readNutritionMap();
  const existing = map[date];
  if (!existing) return null;
  const updated: NutritionDayLog = {
    ...existing,
    meals: existing.meals.filter((m) => m.id !== mealId),
  };
  const totals = computeNutritionTotals(updated.meals);
  const hydrated = { ...updated, ...totals };
  map[date] = hydrated;
  writeJson(KEYS.nutrition, map);
  return hydrated;
}

export function getNutritionLog(date: string): NutritionDayLog | null {
  return readNutritionMap()[date] ?? null;
}

export function getTodayNutritionLog(): NutritionDayLog | null {
  return getNutritionLog(todayDate());
}

export function getRecentNutritionLogs(limit = 7): NutritionDayLog[] {
  const map = readNutritionMap();
  return Object.values(map)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function repeatPreviousNutritionDay(targetDate: string): NutritionDayLog | null {
  const map = readNutritionMap();
  const previous = Object.values(map)
    .filter((l) => l.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!previous) return null;

  return {
    ...previous,
    id: undefined,
    date: targetDate,
    source: "repeat",
    meals: previous.meals.map((m) => ({
      ...m,
      id: undefined,
      loggedAt: new Date().toISOString(),
    })),
  };
}

function buildEmptyNutritionDay(date: string): NutritionDayLog {
  return {
    date,
    dayType: "training",
    meals: [],
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalCalories: 0,
    waterLiters: null,
    adherenceScore: null,
    notes: null,
    source: "manual",
  };
}

/* ─── Recovery Logs ──────────────────────────────────── */

type RecoveryLogMap = Record<string, RecoveryLog>;

function readRecoveryMap(): RecoveryLogMap {
  return readJson<RecoveryLogMap>(KEYS.recovery, {});
}

export function saveRecoveryLog(log: RecoveryLog): void {
  const map = readRecoveryMap();
  map[log.date] = log;
  pruneMap(map, MAX_LOG_DAYS);
  writeJson(KEYS.recovery, map);
  queueForSync("recovery", log.date);
}

export function getRecoveryLog(date: string): RecoveryLog | null {
  return readRecoveryMap()[date] ?? null;
}

export function getTodayRecoveryLog(): RecoveryLog | null {
  return getRecoveryLog(todayDate());
}

export function getRecentRecoveryLogs(limit = 14): RecoveryLog[] {
  const map = readRecoveryMap();
  return Object.values(map)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/* ─── Backfill Any Log Type ──────────────────────────── */

export function backfillTrainingLog(log: TrainingSessionLog): void {
  const map = readTrainingMap();
  map[log.date] = { ...log, source: "backfill" };
  writeJson(KEYS.training, map);
  queueForSync("training", log.date);
}

export function backfillNutritionLog(log: NutritionDayLog): void {
  const totals = computeNutritionTotals(log.meals);
  const map = readNutritionMap();
  map[log.date] = { ...log, ...totals, source: "backfill" };
  writeJson(KEYS.nutrition, map);
  queueForSync("nutrition", log.date);
}

export function backfillRecoveryLog(log: RecoveryLog): void {
  const map = readRecoveryMap();
  map[log.date] = { ...log, source: "backfill" };
  writeJson(KEYS.recovery, map);
  queueForSync("recovery", log.date);
}

/* ─── Streak / Adherence Helpers ─────────────────────── */

export function computeTrainingStreak(): number {
  const map = readTrainingMap();
  let streak = 0;
  const cursor = new Date();

  for (let i = 0; i < 90; i++) {
    const dateStr = toDateString(cursor);
    const log = map[dateStr];
    if (log && (log.status === "completed" || log.status === "partial")) {
      streak++;
    } else if (i > 0) {
      // Allow one rest day before breaking streak
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function computeNutritionAdherence(days = 7): number {
  const logs = getRecentNutritionLogs(days);
  if (logs.length === 0) return 0;
  const scored = logs.filter((l) => l.adherenceScore !== null);
  if (scored.length === 0) return 0;
  const avg = scored.reduce((sum, l) => sum + (l.adherenceScore ?? 0), 0) / scored.length;
  return Math.round(avg);
}

/* ─── Private Helpers ────────────────────────────────── */

function pruneMap<T extends { date: string }>(
  map: Record<string, T>,
  maxDays: number,
): void {
  const entries = Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  const pruned = entries.slice(0, maxDays);
  const toDelete = entries.slice(maxDays);
  for (const [key] of toDelete) {
    delete map[key];
  }
  void pruned; // used implicitly
}

export type LocalLogSnapshot = {
  training: TrainingLogMap;
  nutrition: NutritionLogMap;
  recovery: RecoveryLogMap;
  pendingSync: PendingItem[];
};

const EMPTY_LOCAL_LOGS: LocalLogSnapshot = {
  training: {},
  nutrition: {},
  recovery: {},
  pendingSync: [],
};

export function serializeLocalLogs(): LocalLogSnapshot {
  return {
    training: readJson(KEYS.training, {}),
    nutrition: readJson(KEYS.nutrition, {}),
    recovery: readJson(KEYS.recovery, {}),
    pendingSync: readJson(KEYS.pendingSync, []),
  };
}

export function hasMeaningfulLocalLogs(snapshot: LocalLogSnapshot): boolean {
  return (
    Object.keys(snapshot.training).length > 0 ||
    Object.keys(snapshot.nutrition).length > 0 ||
    Object.keys(snapshot.recovery).length > 0
  );
}

export function hydrateLocalLogs(snapshot: LocalLogSnapshot | null | undefined): void {
  const next = snapshot ?? EMPTY_LOCAL_LOGS;
  writeJson(KEYS.training, next.training ?? {});
  writeJson(KEYS.nutrition, next.nutrition ?? {});
  writeJson(KEYS.recovery, next.recovery ?? {});
  writeJson(KEYS.pendingSync, next.pendingSync ?? []);
}

export function clearLocalLogs(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(KEYS)) window.localStorage.removeItem(key);
}
