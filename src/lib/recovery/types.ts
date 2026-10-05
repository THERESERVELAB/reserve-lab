import { localDateKey } from "@/lib/dates/local-day";
/* ────────────────────────────────────────────────────────────────────────────
   RECOVERY COMMAND V2 — DATA MODELS

   Recovery is a first-class operating system inside The Reserve Lab. Everything
   here is lifestyle / behavior / adherence tracking — NOT medical data. No
   diagnosis, no treatment, no supplement or compound guidance, no lab
   interpretation. Designed for future expansion without over-engineering.
   ──────────────────────────────────────────────────────────────────────── */

export type RecoveryClass =
  | "optimal"
  | "strong"
  | "stable"
  | "watch"
  | "recovery-limited"
  | "data-limited";

export type MomentumState = "improving" | "stable" | "slipping" | "data-limited";

export type StressLoadLevel = "low" | "moderate" | "elevated" | "high" | "data-limited";

export type SleepLog = {
  date: string; // ISO date
  hours: number;
  bedtime?: string; // "HH:MM"
  wakeTime?: string; // "HH:MM"
  /** Optional detailed log — member-entered, observational only. */
  deepSleepHours?: number;
  /** 1–10 subjective quality. */
  quality?: number;
  notes?: string;
};

export type HydrationLog = {
  date: string;
  oz: number;
  electrolytes?: boolean;
};

export type MobilityKind = "pre-session" | "post-session" | "recovery" | "standalone" | "walk";

export type MobilityLog = {
  date: string;
  kind: MobilityKind;
  minutes: number;
  focus?: string;
};

/** Today's step count, entered by the member from their phone or watch. One per day. */
export type StepLog = {
  date: string;
  steps: number;
  updatedAt: string;
};

export type StressCheckIn = {
  date: string;
  /** 1 (calm) – 5 (very stressed). */
  stress: number;
  energy?: number; // 1–5
  mood?: number; // 1–5
};

export type RecoveryCommandState = {
  sleepTargetHours: number;
  hydrationTargetOz: number;
  mobilityWeeklyTarget: number;
  sleepLogs: SleepLog[];
  hydrationLogs: HydrationLog[];
  mobilityLogs: MobilityLog[];
  stressCheckIns: StressCheckIn[];
  /** Optional so older saved and synced records without it still load. */
  stepLogs?: StepLog[];
  /** The member's usual pour, in oz. Optional so older records still load. */
  waterPourOz?: number;
  /** Recovery Suite tool ids completed today. */
  suiteCompletedToday: string[];
  /** Date the suite-completed list applies to (resets across days). */
  suiteDate: string | null;
};

/* ─── Derived snapshot types (engine output) ────────────────────────────── */

export type RecoveryDebt = {
  sleepDebtHours: number | null; // negative = behind; null = no sleep logged
  hydrationMissed: number; // target misses this week
  mobilityMissed: number | null; // sessions short of weekly target; null = mobility never logged
  stressDebt: StressLoadLevel;
  /** "unknown" when there is not enough evidence to read a reserve. */
  trainingFatigue: "unknown" | "low" | "elevated" | "high";
  overall: "clear" | "building" | "accumulating";
};

export type RecoveryInsight = {
  id: string;
  label: string;
  detail: string;
  source: string;
};

export type RecoveryActionTone = "primary" | "support" | "complete";

export type RecoveryAction = {
  id: string;
  label: string;
  reason: string;
  tone: RecoveryActionTone;
  /** Optional view to route to. */
  target?: string;
};

export type SuiteRecommendation = "recommended" | "optional" | "not-needed" | "skipped";

export type RecoverySuiteTool = {
  id: string;
  name: string;
  durationLabel: string;
  recommendation: SuiteRecommendation;
  reason: string;
  completed: boolean;
};

export type RecoveryTimelineWindow = "today" | "week" | "month";

export type RecoveryTimelineRow = {
  label: string;
  sleep: string;
  hydration: string;
  mobility: string;
  stress: string;
  recovery: string;
};

/* ─── Defaults (sample baseline so the command reads as finished) ───────── */

/** The member's own calendar day. Shared with every module that logs against a day (see lib/dates/local-day). */
export { localDateKey };

function isoDaysAgo(daysAgo: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return localDateKey(d);
}

function seedSampleRecovery(): Pick<RecoveryCommandState, "sleepLogs" | "hydrationLogs" | "mobilityLogs" | "stressCheckIns"> {
  const sleepHours = [8.1, 7.6, 8.3, 7.4, 7.9, 8.2, 7.8];
  const hydrationOz = [120, 96, 124, 88, 118, 110, 84];
  const stressVals = [2, 3, 2, 3, 2, 3, 3];
  const sleepLogs: SleepLog[] = sleepHours.map((h, i) => ({
    date: isoDaysAgo(6 - i),
    hours: h,
    bedtime: "22:45",
    wakeTime: "06:40",
  }));
  const hydrationLogs: HydrationLog[] = hydrationOz.map((oz, i) => ({
    date: isoDaysAgo(6 - i),
    oz,
    electrolytes: i % 2 === 0,
  }));
  const mobilityLogs: MobilityLog[] = [
    { date: isoDaysAgo(5), kind: "post-session", minutes: 8, focus: "Hips" },
    { date: isoDaysAgo(4), kind: "recovery", minutes: 12, focus: "Full body" },
    { date: isoDaysAgo(2), kind: "pre-session", minutes: 6, focus: "Shoulders" },
    { date: isoDaysAgo(1), kind: "post-session", minutes: 9, focus: "Hamstrings" },
  ];
  const stressCheckIns: StressCheckIn[] = stressVals.map((s, i) => ({
    date: isoDaysAgo(6 - i),
    stress: s,
    energy: 4,
    mood: 4,
  }));
  return { sleepLogs, hydrationLogs, mobilityLogs, stressCheckIns };
}

/**
 * Demo seeding is opt-in only (NEXT_PUBLIC_ENABLE_DEMO_DATA=true). Real
 * members start with honest empty logs — fabricated sleep/hydration/mobility
 * records must never contaminate production recovery intelligence.
 */
const DEMO_DATA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

export const DEFAULT_RECOVERY_COMMAND: RecoveryCommandState = {
  sleepTargetHours: 8,
  hydrationTargetOz: 120,
  mobilityWeeklyTarget: 5,
  suiteCompletedToday: [],
  suiteDate: null,
  ...(DEMO_DATA_ENABLED
    ? seedSampleRecovery()
    : { sleepLogs: [], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] }),
};

export const RECOVERY_CLASS_META: Record<RecoveryClass, { label: string; color: string }> = {
  optimal: { label: "Optimal", color: "#6ee7b7" },
  strong: { label: "Strong", color: "#6ee7b7" },
  stable: { label: "Stable", color: "#5fb7d5" },
  watch: { label: "Watch", color: "#e8c87a" },
  "recovery-limited": { label: "Recovery Limited", color: "#ef7d55" },
  "data-limited": { label: "Data Limited", color: "#8ea0b8" },
};

export const STRESS_LOAD_META: Record<StressLoadLevel, { label: string; color: string }> = {
  low: { label: "Low", color: "#6ee7b7" },
  moderate: { label: "Moderate", color: "#e8c87a" },
  elevated: { label: "Elevated", color: "#e8a24a" },
  high: { label: "High", color: "#ef7d55" },
  "data-limited": { label: "Data Limited", color: "#8ea0b8" },
};
