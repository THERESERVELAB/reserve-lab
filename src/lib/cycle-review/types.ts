/* ════════════════════════════════════════════════════════════════════════
   CYCLE REVIEW — shared vocabulary.

   The review's job is never "how can this cycle be stronger". It is: given
   what the member is already doing, how can the plan become more deliberate,
   measurable, goal-aligned and reviewable by a clinician, with less
   preventable risk. Every type here holds what the member told Reserve —
   nothing is inferred, and a missing value stays visibly missing.
   ════════════════════════════════════════════════════════════════════════ */

import type { BurdenKey } from "@/lib/compound-intelligence/burdens";
import type { RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";

/* ─── Goals ───────────────────────────────────────────────────────────── */

export type CyclePrimaryGoal =
  | "fat-loss"
  | "lean-mass"
  | "recomposition"
  | "strength"
  | "performance"
  | "recovery"
  | "clinician-managed-therapy"
  | "other";

export const CYCLE_PRIMARY_GOALS: CyclePrimaryGoal[] = [
  "fat-loss",
  "lean-mass",
  "recomposition",
  "strength",
  "performance",
  "recovery",
  "clinician-managed-therapy",
  "other",
];

export const CYCLE_GOAL_LABEL: Record<CyclePrimaryGoal, string> = {
  "fat-loss": "Fat loss",
  "lean-mass": "Lean mass",
  recomposition: "Recomposition",
  strength: "Strength",
  performance: "Performance",
  recovery: "Recovery",
  "clinician-managed-therapy": "Clinician-managed therapy",
  other: "Other",
};

export type CyclePriority =
  | "maintain-fertility"
  | "minimize-cardiovascular-risk"
  | "minimize-hair-loss"
  | "minimize-acne"
  | "minimize-estrogenic"
  | "minimize-androgenic"
  | "maintain-endurance"
  | "maintain-insulin-sensitivity"
  | "maintain-sexual-health"
  | "maintain-mental-wellbeing";

export const CYCLE_PRIORITIES: CyclePriority[] = [
  "maintain-fertility",
  "minimize-cardiovascular-risk",
  "minimize-hair-loss",
  "minimize-acne",
  "minimize-estrogenic",
  "minimize-androgenic",
  "maintain-endurance",
  "maintain-insulin-sensitivity",
  "maintain-sexual-health",
  "maintain-mental-wellbeing",
];

export const CYCLE_PRIORITY_LABEL: Record<CyclePriority, string> = {
  "maintain-fertility": "Maintain fertility",
  "minimize-cardiovascular-risk": "Minimize cardiovascular risk",
  "minimize-hair-loss": "Minimize hair loss",
  "minimize-acne": "Minimize acne",
  "minimize-estrogenic": "Minimize estrogen-related effects",
  "minimize-androgenic": "Minimize androgenic effects",
  "maintain-endurance": "Maintain endurance",
  "maintain-insulin-sensitivity": "Maintain insulin sensitivity",
  "maintain-sexual-health": "Maintain sexual health",
  "maintain-mental-wellbeing": "Maintain mental wellbeing",
};

/** The loads that work against each priority. Endurance is read from training, not burdens. */
export const PRIORITY_BURDENS: Record<CyclePriority, BurdenKey[]> = {
  "maintain-fertility": ["fertility", "hpta-suppression"],
  "minimize-cardiovascular-risk": ["lipids", "blood-pressure", "heart-structure", "heart-rhythm", "hematocrit"],
  "minimize-hair-loss": ["androgenic"],
  "minimize-acne": ["androgenic"],
  "minimize-estrogenic": ["estrogen-prolactin"],
  "minimize-androgenic": ["androgenic"],
  "maintain-endurance": [],
  "maintain-insulin-sensitivity": ["glucose"],
  "maintain-sexual-health": ["estrogen-prolactin", "hpta-suppression"],
  "maintain-mental-wellbeing": ["mood", "sleep"],
};

/** Why a compound is in the plan — as the member records it. */
export type CompoundPurposeKind = CyclePrimaryGoal | "managing-effects";

export const COMPOUND_PURPOSE_LABEL: Record<CompoundPurposeKind, string> = {
  ...CYCLE_GOAL_LABEL,
  "managing-effects": "Managing another compound's effects",
};

export type CompoundPurpose = { kind: CompoundPurposeKind; note?: string };

/** The member's goal setup for one cycle. */
export type CycleGoalSetup = {
  primaryGoal: CyclePrimaryGoal;
  priorities: CyclePriority[];
  /** Keyed by EnhancementEntry id. */
  compoundPurposes: Record<string, CompoundPurpose>;
  updatedAt: string;
};

/* ─── Weekly check-in ─────────────────────────────────────────────────── */

export type CheckInRatingKey = "training" | "recovery" | "sleepQuality" | "mood" | "libido" | "appetite";

export const CHECK_IN_RATING_LABEL: Record<CheckInRatingKey, string> = {
  training: "Training performance",
  recovery: "Recovery",
  sleepQuality: "Sleep quality",
  mood: "Mood",
  libido: "Libido",
  appetite: "Appetite",
};

export type CheckInRating = 1 | 2 | 3 | 4 | 5;

export type CheckInSymptomKey =
  | "headaches"
  | "sudden-severe-headache"
  | "shortness-of-breath"
  | "chest-discomfort"
  | "palpitations"
  | "ankle-swelling"
  | "one-calf-swelling"
  | "unusual-fatigue"
  | "insomnia"
  | "snoring-breathing-pauses"
  | "mood-changes"
  | "anxiety"
  | "irritability"
  | "self-harm-thoughts"
  | "libido-changes"
  | "erectile-changes"
  | "acne"
  | "hair-shedding"
  | "breast-tenderness"
  | "injection-site-soreness"
  | "injection-site-infection"
  | "abdominal-discomfort"
  | "severe-abdominal-pain"
  | "yellowing-skin-eyes";

export type CheckInSymptomDef = {
  label: string;
  /** The load this symptom is commonly associated with, for the body-system view. */
  burden?: BurdenKey;
  /** When set, selecting it stops the review and routes to care. */
  escalateTo?: RedFlagKey;
};

export const CHECK_IN_SYMPTOMS: Record<CheckInSymptomKey, CheckInSymptomDef> = {
  headaches: { label: "Headaches", burden: "blood-pressure" },
  "sudden-severe-headache": { label: "A sudden, severe headache", escalateTo: "severe-headache" },
  "shortness-of-breath": { label: "Unusual shortness of breath", escalateTo: "shortness-of-breath" },
  "chest-discomfort": { label: "Chest pain, pressure or discomfort", escalateTo: "chest-pain" },
  palpitations: { label: "Palpitations that do not settle", escalateTo: "irregular-heartbeat" },
  "ankle-swelling": { label: "Swelling in both ankles or feet", burden: "blood-pressure" },
  "one-calf-swelling": { label: "Painful swelling in one leg or calf", escalateTo: "calf-swelling" },
  "unusual-fatigue": { label: "Unusual fatigue" },
  insomnia: { label: "Trouble sleeping", burden: "sleep" },
  "snoring-breathing-pauses": { label: "Loud snoring or pauses in breathing during sleep", burden: "sleep" },
  "mood-changes": { label: "Mood changes", burden: "mood" },
  anxiety: { label: "Anxiety", burden: "mood" },
  irritability: { label: "Irritability", burden: "mood" },
  "self-harm-thoughts": { label: "Thoughts of harming yourself", escalateTo: "self-harm-thoughts" },
  "libido-changes": { label: "Libido changes", burden: "hpta-suppression" },
  "erectile-changes": { label: "Erection changes", burden: "estrogen-prolactin" },
  acne: { label: "Acne", burden: "androgenic" },
  "hair-shedding": { label: "Hair shedding", burden: "androgenic" },
  "breast-tenderness": { label: "Breast tissue tenderness or swelling", burden: "estrogen-prolactin" },
  "injection-site-soreness": { label: "Injection-site soreness" },
  "injection-site-infection": { label: "Hot, spreading redness, pus or fever at an injection site", escalateTo: "injection-site-infection" },
  "abdominal-discomfort": { label: "Stomach discomfort" },
  "severe-abdominal-pain": { label: "Severe stomach pain", escalateTo: "severe-abdominal-pain" },
  "yellowing-skin-eyes": { label: "Yellowing of the skin or eyes", escalateTo: "jaundice" },
};

export type CycleCheckIn = {
  id: string;
  cycleId: string | null;
  /** YYYY-MM-DD */
  date: string;
  createdAt: string;
  bodyweightLb?: number;
  systolic?: number;
  diastolic?: number;
  restingHr?: number;
  sleepHours?: number;
  ratings: Partial<Record<CheckInRatingKey, CheckInRating>>;
  symptoms: CheckInSymptomKey[];
  /** Free text, exactly as entered. */
  newMedications?: string;
  outsideChanges?: string;
};

export type CycleCheckInInput = Omit<CycleCheckIn, "id" | "createdAt">;

/* ─── Support plan ────────────────────────────────────────────────────── */

/**
 * One supplement the member chose to track. Everything except the option and
 * when it was added is member entered, exactly as typed — Reserve never
 * proposes an amount, frequency or timing.
 */
export type SupportPlanItem = {
  id: string;
  /** Key in the support options library, or "custom" for a supplement the member named. */
  optionKey: string;
  /** The member's own name for a supplement that is not in the library. */
  customTitle?: string;
  /** ISO timestamp the member added it. */
  addedAt: string;
  amount?: string;
  unit?: string;
  frequency?: string;
  brand?: string;
  /** YYYY-MM-DD, member entered. */
  startDate?: string;
  notes?: string;
};

export type SupportPlanDetails = Pick<SupportPlanItem, "amount" | "unit" | "frequency" | "brand" | "startDate" | "notes">;

/** A clinician summary the member chose to keep, exactly as it was generated. */
export type CycleReviewSnapshot = {
  id: string;
  cycleId: string;
  savedAt: string;
  text: string;
};

/** Symptoms that stop the review and route to care. */
export function escalatingSymptoms(symptoms: CheckInSymptomKey[]): RedFlagKey[] {
  return [...new Set(symptoms.map((key) => CHECK_IN_SYMPTOMS[key]?.escalateTo).filter((flag): flag is RedFlagKey => Boolean(flag)))];
}
