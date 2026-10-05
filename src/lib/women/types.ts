/* ────────────────────────────────────────────────────────────────────────────
   RESERVE WOMEN — DATA MODELS

   The Women's Performance OS is an optimization platform, not a medical tool.
   Everything here is observational / estimate-only. No diagnosis, no labs
   interpretation, no protocols, no treatment plans. Language stays in the
   approved set: track · monitor · health awareness · trend observation ·
   review with clinician.

   Designed for future expansion without over-engineering: each command owns a
   small, typed slice that can grow its own intelligence layer later.
   ──────────────────────────────────────────────────────────────────────── */

/* ─── Cycle ─────────────────────────────────────────────────────────────── */

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export type CycleFlow = "spotting" | "light" | "medium" | "heavy";

export type CycleSymptom =
  | "cramps"
  | "bloating"
  | "headache"
  | "fatigue"
  | "mood-shift"
  | "breast-tenderness"
  | "low-back"
  | "cravings"
  | "poor-sleep"
  | "none";

export type EnergyLevel = "low" | "moderate" | "high";
export type RecoveryQuality = "limited" | "moderate" | "strong";
export type StressLevel = "low" | "moderate" | "high";
export type TrainingPerformanceTrend = "down" | "steady" | "up";

/** Estimate-only cycle profile — averages the athlete reports or that Reserve observes. */
export type CycleProfile = {
  tracksCycle: boolean;
  averageCycleLengthDays: number;
  averagePeriodLengthDays: number;
  lastPeriodStart: string | null; // ISO date
  regularity: "regular" | "variable" | "unknown";
  /**
   * When the member entered her own days-between-periods and period days.
   * Until then the two averages above are Reserve's assumption, and every
   * screen that uses them must say so (cycle.ts `cycleBasis`).
   */
  lengthsEnteredAt?: string | null;
};

export type CycleLogEntry = {
  id: string;
  date: string; // ISO date
  isPeriodDay?: boolean;
  flow?: CycleFlow;
  phase?: CyclePhase; // optional observed/manual override
  symptoms: CycleSymptom[];
  energy?: EnergyLevel;
  recovery?: RecoveryQuality;
  sleepHours?: number;
  stress?: StressLevel;
  trainingPerformance?: TrainingPerformanceTrend;
  hydrationOnTarget?: boolean;
  notes?: string;
};

/* ─── Goals ─────────────────────────────────────────────────────────────── */

export type WomensNutritionGoal =
  | "fat-loss"
  | "recomp"
  | "muscle-building"
  | "athletic-performance"
  | "lifestyle-fitness";

export type WomensPhysiqueGoal =
  | "fat-loss"
  | "recomp"
  | "lean-tone"
  | "athletic"
  | "strength"
  | "muscle-building";

/* ─── Nutrition ─────────────────────────────────────────────────────────── */

export type WomensNutritionState = {
  goal: WomensNutritionGoal;
  proteinTargetG: number;
  hydrationTargetMl: number;
  fiberTargetG: number;
  /** Most recent rolling adherence observations (0–100), newest last. */
  recentAdherence: number[];
  signatureMealIds: string[];
  rotationMealIds: string[];
};

/* ─── Recovery ──────────────────────────────────────────────────────────── */

export type WomensRecoveryHabit = {
  id: string;
  label: string;
  /** observed adherence 0–100 over the recent window */
  adherence: number;
  direction: "helping" | "hurting" | "watch";
};

export type WomensRecoveryState = {
  /** Recovery Reserve 0–100, observed. Null until the member has a real readout. */
  reserve: number | null;
  recentScores: number[];
  habits: WomensRecoveryHabit[];
};

/* ─── Physique ──────────────────────────────────────────────────────────── */

export type WomensPhysiqueState = {
  goal: WomensPhysiqueGoal;
  startWeightLb?: number;
  currentWeightLb?: number;
  recentWeightsLb: number[]; // newest last, for a trend line
  photoCount: number;
  measurementCount: number;
};

/* ─── Optional module: Fertility (lifestyle optimization only) ──────────── */

export type FertilityFocusArea =
  | "hydration"
  | "nutrition"
  | "recovery"
  | "sleep"
  | "stress"
  | "environment"
  | "lifestyle-habits";

export type FertilityModuleState = {
  enabled: boolean;
  focusAreas: FertilityFocusArea[];
  /** Provider-entered labs only. Reserve stores, never interprets. */
  providerLabsNote: string;
  signatureMealIds: string[];
};

/* ─── Optional module: Pregnancy (lifestyle adherence only) ─────────────── */

export type PregnancyStage = "first-trimester" | "second-trimester" | "third-trimester";

export type PregnancyModuleState = {
  enabled: boolean;
  /** The stage the member entered. Null until she enters one — never a default shown as hers. */
  stage: PregnancyStage | null;
  /** Estimate-only reference date (e.g. last reported period). No medical claims. */
  referenceDate: string | null;
};

/* ─── Top-level Women's slice ───────────────────────────────────────────── */

export type WomensState = {
  /** Whether the Women's Performance OS is surfaced for this member. */
  enabled: boolean;
  nutritionGoal: WomensNutritionGoal;
  cycle: CycleProfile;
  cycleLogs: CycleLogEntry[];
  nutrition: WomensNutritionState;
  recovery: WomensRecoveryState;
  physique: WomensPhysiqueState;
  fertility: FertilityModuleState;
  pregnancy: PregnancyModuleState;
};

/* ─── Defaults — empty. Nothing here is shown as the member's own data until
   the member provides it (DESIGN_BIBLE §12). The sample values these defaults
   once carried live in ./legacy-sample.ts, only so saved state can be cleaned. ─ */

export const DEFAULT_WOMENS_STATE: WomensState = {
  enabled: false,
  nutritionGoal: "recomp",
  cycle: {
    tracksCycle: true,
    averageCycleLengthDays: 28,
    averagePeriodLengthDays: 5,
    lastPeriodStart: null,
    regularity: "unknown",
    lengthsEnteredAt: null,
  },
  cycleLogs: [],
  nutrition: {
    goal: "recomp",
    proteinTargetG: 130,
    hydrationTargetMl: 2800,
    fiberTargetG: 28,
    recentAdherence: [],
    signatureMealIds: [],
    rotationMealIds: [],
  },
  recovery: {
    reserve: null,
    recentScores: [],
    habits: [],
  },
  physique: {
    goal: "recomp",
    recentWeightsLb: [],
    photoCount: 0,
    measurementCount: 0,
  },
  fertility: {
    enabled: false,
    /* Chosen by the member. Five areas once came preselected and fed a "readiness" score. */
    focusAreas: [],
    providerLabsNote: "",
    signatureMealIds: [],
  },
  pregnancy: {
    enabled: false,
    stage: null,
    referenceDate: null,
  },
};

export const WOMENS_NUTRITION_GOAL_LABELS: Record<WomensNutritionGoal, string> = {
  "fat-loss": "Fat Loss",
  recomp: "Recomp",
  "muscle-building": "Muscle Building",
  "athletic-performance": "Athletic Performance",
  "lifestyle-fitness": "Lifestyle Fitness",
};

export const WOMENS_PHYSIQUE_GOAL_LABELS: Record<WomensPhysiqueGoal, string> = {
  "fat-loss": "Fat Loss",
  recomp: "Recomp",
  "lean-tone": "Lean Tone",
  athletic: "Athletic",
  strength: "Strength",
  "muscle-building": "Muscle Building",
};

export const FERTILITY_FOCUS_LABELS: Record<FertilityFocusArea, string> = {
  hydration: "Hydration",
  nutrition: "Nutrition",
  recovery: "Recovery",
  sleep: "Sleep",
  stress: "Stress",
  environment: "Environment",
  "lifestyle-habits": "Lifestyle Habits",
};

export const PREGNANCY_STAGE_LABELS: Record<PregnancyStage, string> = {
  "first-trimester": "First Trimester",
  "second-trimester": "Second Trimester",
  "third-trimester": "Third Trimester",
};
