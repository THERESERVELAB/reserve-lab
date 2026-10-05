import { localDateKey } from "@/lib/dates/local-day";
/* ────────────────────────────────────────────────────────────────────────────
   PHYSIQUE COMMAND V2 — DATA MODELS

   A private, premium transformation cockpit. Observational/logged tracking only.
   No medical claims, no diagnosis, no exact body-fat from photos, no body
   shaming, no guaranteed-result language. Careful language everywhere:
   "visual trend", "progress signal", "based on logged data", "data limited".
   ──────────────────────────────────────────────────────────────────────── */

export type MeasurementSite =
  | "waist"
  | "chest"
  | "shoulders"
  | "arms"
  | "forearms"
  | "hips"
  | "glutes"
  | "thighs"
  | "calves";

export const MEASUREMENT_SITES: { id: MeasurementSite; label: string }[] = [
  { id: "waist", label: "Waist" },
  { id: "chest", label: "Chest" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "forearms", label: "Forearms" },
  { id: "hips", label: "Hips" },
  { id: "glutes", label: "Glutes" },
  { id: "thighs", label: "Thighs" },
  { id: "calves", label: "Calves" },
];

export type AdherenceSnapshot = {
  training: number; // 0–100
  nutrition: number;
  hydration: number;
  recovery: number;
  sleep?: number;
};

export type PhysiqueEntry = {
  id: string;
  date: string; // ISO date
  bodyWeightLb: number;
  bodyFatPct?: number; // optional, member-entered estimate only
  measurements: Partial<Record<MeasurementSite, number>>; // inches
  restingHeartRate?: number;
  adherence?: AdherenceSnapshot;
  notes?: string;
};

export type PhotoPoseType =
  | "front-relaxed"
  | "side-relaxed"
  | "back-relaxed"
  | "front-flexed"
  | "side-flexed"
  | "back-flexed"
  | "custom";

export const PHOTO_POSES: { id: PhotoPoseType; label: string }[] = [
  { id: "front-relaxed", label: "Front Relaxed" },
  { id: "side-relaxed", label: "Side Relaxed" },
  { id: "back-relaxed", label: "Back Relaxed" },
  { id: "front-flexed", label: "Front Flexed" },
  { id: "side-flexed", label: "Side Flexed" },
  { id: "back-flexed", label: "Back Flexed" },
  { id: "custom", label: "Custom Pose" },
];

export type PhotoQualityChecklistItem =
  | "same-lighting"
  | "same-distance"
  | "same-time"
  | "same-pose"
  | "same-angle"
  | "same-clothing"
  | "no-pump-baseline";

export const PHOTO_QUALITY_ITEMS: { id: PhotoQualityChecklistItem; label: string }[] = [
  { id: "same-lighting", label: "Same lighting" },
  { id: "same-distance", label: "Same distance" },
  { id: "same-time", label: "Same time of day" },
  { id: "same-pose", label: "Same pose" },
  { id: "same-angle", label: "Same camera angle" },
  { id: "same-clothing", label: "Same clothing style" },
  { id: "no-pump-baseline", label: "No pump photos for baseline" },
];

export type PhotoCheckIn = {
  id: string;
  date: string;
  poses: PhotoPoseType[];
  lightingNotes?: string;
  bodyWeightLb?: number;
  notes?: string;
  /** 0–100 from the consistency checklist. Image binaries are not persisted. */
  consistencyScore: number;
  linkedEntryId?: string;
};

export type WeakPoint =
  | "upper-chest"
  | "delts"
  | "arms"
  | "back-width"
  | "back-thickness"
  | "abs"
  | "waist"
  | "glutes"
  | "hamstrings"
  | "quads"
  | "calves";

export const WEAK_POINTS: { id: WeakPoint; label: string; measurement?: MeasurementSite }[] = [
  { id: "upper-chest", label: "Upper Chest", measurement: "chest" },
  { id: "delts", label: "Delts", measurement: "shoulders" },
  { id: "arms", label: "Arms", measurement: "arms" },
  { id: "back-width", label: "Back Width" },
  { id: "back-thickness", label: "Back Thickness" },
  { id: "abs", label: "Abs", measurement: "waist" },
  { id: "waist", label: "Waist", measurement: "waist" },
  { id: "glutes", label: "Glutes", measurement: "glutes" },
  { id: "hamstrings", label: "Hamstrings", measurement: "thighs" },
  { id: "quads", label: "Quads", measurement: "thighs" },
  { id: "calves", label: "Calves", measurement: "calves" },
];

export type PhysiqueGoalV2 = "fat-loss" | "recomp" | "lean-tone" | "athletic" | "strength" | "muscle-building";

/* ─── Member Muscle Priority (Focus Engine) ──────────────────────────────────
   Member-selected muscle priorities. Member-specific, never global, never
   assumed from gender. Drives architecture → weekly bias → session directive →
   movement order → Apex/Training/Recovery/Nutrition context. */
export type MusclePriority =
  | "chest"
  | "upper-chest"
  | "back-width"
  | "back-thickness"
  | "delts"
  | "arms"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "core"
  | "conditioning"
  | "mobility";

export type MuscleRegion = "upper" | "lower" | "core" | "general";

export const MUSCLE_PRIORITIES: { id: MusclePriority; label: string; region: MuscleRegion }[] = [
  { id: "chest", label: "Chest", region: "upper" },
  { id: "upper-chest", label: "Upper Chest", region: "upper" },
  { id: "back-width", label: "Back Width", region: "upper" },
  { id: "back-thickness", label: "Back Thickness", region: "upper" },
  { id: "delts", label: "Delts", region: "upper" },
  { id: "arms", label: "Arms", region: "upper" },
  { id: "glutes", label: "Glutes", region: "lower" },
  { id: "quads", label: "Quads", region: "lower" },
  { id: "hamstrings", label: "Hamstrings", region: "lower" },
  { id: "calves", label: "Calves", region: "lower" },
  { id: "core", label: "Abs / Core", region: "core" },
  { id: "conditioning", label: "Conditioning", region: "general" },
  { id: "mobility", label: "Mobility", region: "general" },
];

export function musclePriorityLabel(id: MusclePriority): string {
  return MUSCLE_PRIORITIES.find((m) => m.id === id)?.label ?? id;
}

/** Women's Performance physique tracks — shape-frequency architecture, not a
    bro split. Premium model / runway language; never assumed from gender. */
export type WomensTrack =
  | "runway"
  | "glute-quad"
  | "lean-recomp"
  | "glute-upper"
  | "athletic-model"
  | "lifestyle-shape"
  | "signature-shape"
  | "hybrid-pilates"
  | "sport-strength";

/** Member-specific focus selection. Persisted per profile, future multi-profile ready. */
export type PhysiqueFocus = {
  primary: MusclePriority | null;
  secondary: MusclePriority[];
  support: MusclePriority[];
  /** Selected women's physique track (takes precedence over muscle focus). */
  track?: WomensTrack | null;
  updatedAt: string | null;
};

export const DEFAULT_PHYSIQUE_FOCUS: PhysiqueFocus = {
  primary: null,
  secondary: [],
  support: [],
  track: null,
  updatedAt: null,
};

export type PhysiqueCommandState = {
  goal: PhysiqueGoalV2;
  entries: PhysiqueEntry[];
  photoCheckIns: PhotoCheckIn[];
  weakPoints: WeakPoint[];
  checkInIntervalDays: number;
  /** Member-selected muscle priorities (Focus Engine). */
  focus: PhysiqueFocus;
};

/* ─── Defaults ────────────────────────────────────────────────────────────
   Sample entries are demo-only (NEXT_PUBLIC_ENABLE_DEMO_DATA=true). Real
   members start with honest empty physique history. ─────────────────────── */

const DEMO_DATA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDateKey(d);
}

const DEMO_PHYSIQUE_SEED: Pick<PhysiqueCommandState, "entries" | "photoCheckIns"> = {
  entries: [
    {
      id: "seed-baseline",
      date: isoDaysAgo(28),
      bodyWeightLb: 185.2,
      bodyFatPct: 14.5,
      measurements: { waist: 34.5, chest: 43, shoulders: 50, arms: 16, forearms: 12.5, hips: 39, thighs: 24, calves: 15.5 },
      restingHeartRate: 58,
      adherence: { training: 88, nutrition: 82, hydration: 80, recovery: 74, sleep: 78 },
      notes: "Baseline check-in.",
    },
    {
      id: "seed-recent",
      date: isoDaysAgo(5),
      bodyWeightLb: 184.1,
      bodyFatPct: 13.6,
      measurements: { waist: 33.4, chest: 43.2, shoulders: 50.3, arms: 16.1, forearms: 12.6, hips: 38.6, thighs: 24.1, calves: 15.6 },
      restingHeartRate: 56,
      adherence: { training: 92, nutrition: 88, hydration: 84, recovery: 76, sleep: 80 },
      notes: "Waist down, weight stable — strong recomp signal.",
    },
  ],
  photoCheckIns: [
    {
      id: "seed-photo",
      date: isoDaysAgo(5),
      poses: ["front-relaxed", "side-relaxed", "back-relaxed"],
      lightingNotes: "Bathroom morning light",
      bodyWeightLb: 184.1,
      consistencyScore: 71,
      linkedEntryId: "seed-recent",
    },
  ],
};

export const DEFAULT_PHYSIQUE_COMMAND: PhysiqueCommandState = {
  goal: "recomp",
  checkInIntervalDays: 7,
  weakPoints: ["delts", "upper-chest"],
  focus: DEFAULT_PHYSIQUE_FOCUS,
  ...(DEMO_DATA_ENABLED ? DEMO_PHYSIQUE_SEED : { entries: [], photoCheckIns: [] }),
};

export const PHYSIQUE_GOAL_LABELS: Record<PhysiqueGoalV2, string> = {
  "fat-loss": "Fat Loss",
  recomp: "Recomp",
  "lean-tone": "Lean Tone",
  athletic: "Athletic",
  strength: "Strength",
  "muscle-building": "Muscle Building",
};
