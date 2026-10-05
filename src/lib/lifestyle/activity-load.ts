/* ════════════════════════════════════════════════════════════════════════
   ACTIVITY LOAD PROFILES — what every lifestyle activity actually costs.

   Side activities are never "free": pickleball loads calves, adductors,
   knees, shoulders and rotational patterns; track work loads hamstrings,
   glutes and sprint recovery. The exposure engine and schedule audit read
   these profiles so Monday track + Tuesday heavy legs is analyzed as one
   system, not two unrelated events.

   Numbers are deliberately coarse relative weights (0..1 per muscle,
   fatigue 0..3) — organizational analysis, not physiological measurement.
   ════════════════════════════════════════════════════════════════════════ */

import type { ActivityIntensity, LifestyleActivity, LifestyleActivityType } from "./types";

export type MuscleGroup =
  | "chest" | "back" | "quads" | "hamstrings" | "glutes"
  | "delts" | "arms" | "calves" | "core" | "adductors";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "back", "quads", "hamstrings", "glutes",
  "delts", "arms", "calves", "core", "adductors",
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest", back: "Back", quads: "Quads", hamstrings: "Hamstrings",
  glutes: "Glutes", delts: "Delts", arms: "Arms", calves: "Calves",
  core: "Core", adductors: "Adductors",
};

export type JointTag = "knee" | "shoulder" | "elbow" | "hip" | "spine" | "ankle" | "rotational";

export type ActivityLoadProfile = {
  /** Direct muscle involvement (0..1 relative). */
  direct: Partial<Record<MuscleGroup, number>>;
  /** Indirect / stabilizing involvement (0..1 relative). */
  indirect: Partial<Record<MuscleGroup, number>>;
  joints: JointTag[];
  /** How much this taxes sprint-specific tissue (hamstring/tendon) 0..1. */
  sprintDemand: number;
  /** Overall lower-body recovery demand 0..1. */
  lowerBodyDemand: number;
  conditioningDemand: number;
  /** Base systemic fatigue 0..3 at moderate intensity, ~60 min. */
  baseFatigue: number;
};

const ZERO: ActivityLoadProfile = {
  direct: {}, indirect: {}, joints: [], sprintDemand: 0, lowerBodyDemand: 0, conditioningDemand: 0, baseFatigue: 0,
};

/* ─── Type-level profiles ────────────────────────────────────────────────── */

const TYPE_PROFILES: Record<LifestyleActivityType, ActivityLoadProfile> = {
  /* Strength days: muscle detail comes from the assigned template / focus —
     this is only the generic systemic floor when nothing more is known. */
  strength: { direct: {}, indirect: { core: 0.3 }, joints: [], sprintDemand: 0, lowerBodyDemand: 0.3, conditioningDemand: 0.1, baseFatigue: 2 },
  hypertrophy: { direct: {}, indirect: { core: 0.3 }, joints: [], sprintDemand: 0, lowerBodyDemand: 0.3, conditioningDemand: 0.1, baseFatigue: 2 },

  track: {
    direct: { hamstrings: 0.9, glutes: 0.8, calves: 0.8, quads: 0.5 },
    indirect: { core: 0.4, adductors: 0.4 },
    joints: ["ankle", "knee", "hip"],
    sprintDemand: 0.9, lowerBodyDemand: 0.9, conditioningDemand: 0.6, baseFatigue: 2.4,
  },
  sprint: {
    direct: { hamstrings: 1, glutes: 0.9, calves: 0.8, quads: 0.6 },
    indirect: { core: 0.5, adductors: 0.5 },
    joints: ["ankle", "knee", "hip"],
    sprintDemand: 1, lowerBodyDemand: 1, conditioningDemand: 0.5, baseFatigue: 2.6,
  },
  running: {
    direct: { calves: 0.7, quads: 0.5, hamstrings: 0.5, glutes: 0.4 },
    indirect: { core: 0.3 },
    joints: ["ankle", "knee"],
    sprintDemand: 0.3, lowerBodyDemand: 0.6, conditioningDemand: 0.8, baseFatigue: 1.6,
  },
  conditioning: {
    direct: { quads: 0.4, calves: 0.4 },
    indirect: { core: 0.3, glutes: 0.3 },
    joints: ["knee", "ankle"],
    sprintDemand: 0.2, lowerBodyDemand: 0.5, conditioningDemand: 0.9, baseFatigue: 1.5,
  },
  zone2: {
    direct: { calves: 0.3, quads: 0.3 },
    indirect: {},
    joints: [],
    sprintDemand: 0, lowerBodyDemand: 0.2, conditioningDemand: 0.7, baseFatigue: 0.7,
  },
  hiit: {
    direct: { quads: 0.6, glutes: 0.5, calves: 0.5, hamstrings: 0.4 },
    indirect: { core: 0.5, delts: 0.3, arms: 0.2 },
    joints: ["knee", "ankle", "shoulder"],
    sprintDemand: 0.5, lowerBodyDemand: 0.7, conditioningDemand: 1, baseFatigue: 2.2,
  },
  sport: {
    direct: { quads: 0.5, calves: 0.5, glutes: 0.4 },
    indirect: { core: 0.4, delts: 0.3, adductors: 0.4 },
    joints: ["knee", "ankle", "rotational"],
    sprintDemand: 0.4, lowerBodyDemand: 0.6, conditioningDemand: 0.7, baseFatigue: 1.8,
  },
  mobility: {
    direct: {},
    indirect: { core: 0.2 },
    joints: [],
    sprintDemand: 0, lowerBodyDemand: 0, conditioningDemand: 0.1, baseFatigue: 0.3,
  },
  recovery: ZERO,
  sauna: ZERO,
  "cold-exposure": ZERO,
  "physical-therapy": { ...ZERO, baseFatigue: 0.3 },
  massage: ZERO,
  rest: ZERO,
  sleep: ZERO,
  "meal-prep": ZERO,
  "meal-window": ZERO,
  hydration: ZERO,
  "supplement-reminder": ZERO,
  "biomarker-task": ZERO,
  "check-in": ZERO,
  work: { ...ZERO, baseFatigue: 0.4 },
  travel: { ...ZERO, baseFatigue: 0.6 },
  custom: { ...ZERO, baseFatigue: 0.5 },
};

/* ─── Named-sport refinement (title keywords override the generic sport row) ─ */

const SPORT_PROFILES: Array<{ match: RegExp; profile: ActivityLoadProfile }> = [
  {
    match: /pickleball|padel|tennis|racquet|squash/i,
    profile: {
      direct: { calves: 0.7, adductors: 0.7, quads: 0.5, delts: 0.5 },
      indirect: { core: 0.5, glutes: 0.4, arms: 0.4, hamstrings: 0.3 },
      joints: ["knee", "shoulder", "ankle", "rotational"],
      sprintDemand: 0.4, lowerBodyDemand: 0.6, conditioningDemand: 0.7, baseFatigue: 1.8,
    },
  },
  {
    match: /basketball|soccer|football|rugby|lacrosse/i,
    profile: {
      direct: { quads: 0.7, calves: 0.7, hamstrings: 0.6, glutes: 0.6 },
      indirect: { core: 0.5, adductors: 0.5 },
      joints: ["knee", "ankle", "rotational"],
      sprintDemand: 0.7, lowerBodyDemand: 0.8, conditioningDemand: 0.9, baseFatigue: 2.2,
    },
  },
  {
    match: /golf/i,
    profile: {
      direct: { core: 0.5 },
      indirect: { glutes: 0.3, back: 0.3, delts: 0.2 },
      joints: ["rotational", "spine"],
      sprintDemand: 0, lowerBodyDemand: 0.2, conditioningDemand: 0.3, baseFatigue: 0.8,
    },
  },
  {
    match: /swim/i,
    profile: {
      direct: { back: 0.6, delts: 0.6, chest: 0.4 },
      indirect: { core: 0.5, arms: 0.4 },
      joints: ["shoulder"],
      sprintDemand: 0, lowerBodyDemand: 0.2, conditioningDemand: 0.8, baseFatigue: 1.4,
    },
  },
  {
    match: /cycling|bike/i,
    profile: {
      direct: { quads: 0.7, calves: 0.4 },
      indirect: { glutes: 0.4, hamstrings: 0.3 },
      joints: ["knee"],
      sprintDemand: 0, lowerBodyDemand: 0.5, conditioningDemand: 0.9, baseFatigue: 1.4,
    },
  },
];

const INTENSITY_SCALE: Record<ActivityIntensity, number> = {
  low: 0.6, moderate: 1, high: 1.35, max: 1.7,
};

export type ResolvedActivityLoad = ActivityLoadProfile & {
  /** Intensity+duration-scaled systemic fatigue 0..~5. */
  fatigue: number;
};

/** Resolve the load an activity contributes — sport titles refine the profile,
    intensity and duration scale the fatigue. */
export function resolveActivityLoad(activity: Pick<LifestyleActivity, "type" | "title" | "intensity" | "durationMinutes">): ResolvedActivityLoad {
  let profile = TYPE_PROFILES[activity.type] ?? ZERO;
  if (activity.type === "sport" || activity.type === "custom") {
    const named = SPORT_PROFILES.find((s) => s.match.test(activity.title));
    if (named) profile = named.profile;
  }
  const intensityScale = INTENSITY_SCALE[activity.intensity ?? "moderate"];
  const durationScale = activity.durationMinutes
    ? Math.min(1.6, Math.max(0.4, activity.durationMinutes / 60))
    : 1;
  return { ...profile, fatigue: profile.baseFatigue * intensityScale * durationScale };
}

/** Scaled sprint demand for an activity (0..~1.7) — drives the
    sprint → next-day lower-body analysis. */
export function sprintLoadOf(activity: Pick<LifestyleActivity, "type" | "title" | "intensity" | "durationMinutes">): number {
  const load = resolveActivityLoad(activity);
  return load.sprintDemand * INTENSITY_SCALE[activity.intensity ?? "moderate"];
}
