/* ════════════════════════════════════════════════════════════════════════
   COVERAGE PERSONAS — seeded, deterministic synthetic athletes.

   Reserve cannot claim it fits every athlete because the catalogue has
   nineteen cards. It can only claim it when a deterministic sweep across the
   real dimensions of variation produces a credible route for every persona.

   This module builds those personas. It is pure and seeded: the same seed
   always produces the same athletes, so a coverage regression is reproducible
   rather than a rumour. Nothing here touches the store or the network.

   Personas are SYNTHETIC. They must never be written into member state.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteSnapshotInput } from "@/lib/athlete/snapshot";

/* ─── Seeded RNG ──────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, and stable across engines. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length) % xs.length];
}

/* ─── Dimensions ──────────────────────────────────────────────────────── */

export type AgeBand = "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65-74" | "75+";

export const AGE_BANDS: readonly AgeBand[] = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65-74",
  "75+",
];

const AGE_MIDPOINT: Record<AgeBand, number> = {
  "18-24": 21,
  "25-34": 29,
  "35-44": 39,
  "45-54": 49,
  "55-64": 59,
  "65-74": 69,
  "75+": 78,
};

export type SizeContext =
  | "short"
  | "average-height"
  | "tall"
  | "very-tall"
  | "lower-body-weight"
  | "average-body-weight"
  | "higher-body-weight"
  | "high-muscularity"
  | "low-body-fat"
  | "moderate-body-fat"
  | "high-body-fat"
  | "unknown-composition"
  | "recent-major-weight-change";

export const SIZE_CONTEXTS: readonly SizeContext[] = [
  "short",
  "average-height",
  "tall",
  "very-tall",
  "lower-body-weight",
  "average-body-weight",
  "higher-body-weight",
  "high-muscularity",
  "low-body-fat",
  "moderate-body-fat",
  "high-body-fat",
  "unknown-composition",
  "recent-major-weight-change",
];

export type TrainingAgeBand =
  | "never-trained"
  | "beginner"
  | "early-intermediate"
  | "intermediate"
  | "advanced"
  | "elite"
  | "returning-after-layoff";

export const TRAINING_AGES: readonly TrainingAgeBand[] = [
  "never-trained",
  "beginner",
  "early-intermediate",
  "intermediate",
  "advanced",
  "elite",
  "returning-after-layoff",
];

/** Maps a coverage training-age band onto the snapshot's experience vocabulary. */
const EXPERIENCE_FOR: Record<TrainingAgeBand, { level: string; years: number }> = {
  "never-trained": { level: "beginner", years: 0 },
  beginner: { level: "beginner", years: 0.5 },
  "early-intermediate": { level: "novice", years: 1.5 },
  intermediate: { level: "intermediate", years: 4 },
  advanced: { level: "advanced", years: 8 },
  elite: { level: "elite", years: 14 },
  "returning-after-layoff": { level: "novice", years: 3 },
};

export type CoverageGoal =
  | "general-fitness"
  | "healthy-aging"
  | "fat-loss"
  | "lean-gain"
  | "bodybuilding"
  | "classic-physique"
  | "weak-point-specialization"
  | "contest-preparation"
  | "strength"
  | "powerlifting"
  | "powerbuilding"
  | "athletic-performance"
  | "tactical-performance"
  | "hybrid-performance"
  | "running"
  | "cycling"
  | "endurance-physique"
  | "sport-support"
  | "mobility"
  | "recovery-restoration"
  | "event-countdown";

export const COVERAGE_GOALS: readonly CoverageGoal[] = [
  "general-fitness",
  "healthy-aging",
  "fat-loss",
  "lean-gain",
  "bodybuilding",
  "classic-physique",
  "weak-point-specialization",
  "contest-preparation",
  "strength",
  "powerlifting",
  "powerbuilding",
  "athletic-performance",
  "tactical-performance",
  "hybrid-performance",
  "running",
  "cycling",
  "endurance-physique",
  "sport-support",
  "mobility",
  "recovery-restoration",
  "event-countdown",
];

/** The athlete's own words. Suitability reads these, not the enum key. */
const GOAL_PHRASE: Record<CoverageGoal, string> = {
  "general-fitness": "General fitness and health",
  "healthy-aging": "Healthy aging and staying capable",
  "fat-loss": "Lose fat",
  "lean-gain": "Build lean muscle",
  bodybuilding: "Build muscle and improve my physique",
  "classic-physique": "Build a classic physique with better proportion",
  "weak-point-specialization": "Bring up a lagging body part",
  "contest-preparation": "Contest preparation",
  strength: "Get stronger",
  powerlifting: "Powerlifting total",
  powerbuilding: "Strength and size together",
  "athletic-performance": "Athletic performance",
  "tactical-performance": "Tactical fitness and readiness",
  "hybrid-performance": "Hybrid performance — lift and run",
  running: "Running performance",
  cycling: "Cycling performance",
  "endurance-physique": "Endurance with a lean physique",
  "sport-support": "Support my sport",
  mobility: "Mobility and movement quality",
  "recovery-restoration": "Restore my recovery and rebuild",
  "event-countdown": "Look my best for an event",
};

export type AvailabilityContext =
  | "standard"
  | "shift-work"
  | "travel"
  | "early-morning"
  | "evening"
  | "split-sessions"
  | "unpredictable";

export const AVAILABILITY_CONTEXTS: readonly AvailabilityContext[] = [
  "standard",
  "shift-work",
  "travel",
  "early-morning",
  "evening",
  "split-sessions",
  "unpredictable",
];

export type EquipmentContext =
  | "commercial-gym"
  | "home-gym"
  | "dumbbells-only"
  | "barbell-only"
  | "machines-only"
  | "bands-only"
  | "bodyweight-only"
  | "hotel-gym"
  | "minimal-cardio";

export const EQUIPMENT_CONTEXTS: readonly EquipmentContext[] = [
  "commercial-gym",
  "home-gym",
  "dumbbells-only",
  "barbell-only",
  "machines-only",
  "bands-only",
  "bodyweight-only",
  "hotel-gym",
  "minimal-cardio",
];

const EQUIPMENT_LIST: Record<EquipmentContext, string[]> = {
  "commercial-gym": [
    "barbell",
    "dumbbells",
    "machines",
    "cables",
    "squat rack",
    "bench",
    "treadmill",
    "bike",
  ],
  "home-gym": ["barbell", "dumbbells", "squat rack", "bench", "bands"],
  "dumbbells-only": ["dumbbells", "bench"],
  "barbell-only": ["barbell", "squat rack", "bench"],
  "machines-only": ["machines", "cables"],
  "bands-only": ["bands"],
  "bodyweight-only": ["bodyweight"],
  "hotel-gym": ["dumbbells", "machines", "treadmill"],
  "minimal-cardio": ["bodyweight", "bands", "treadmill"],
};

export type ConstraintContext =
  | "high-recovery"
  | "average-recovery"
  | "low-recovery"
  | "poor-sleep"
  | "high-stress"
  | "recurring-sport"
  | "high-running-volume"
  | "joint-limitation"
  | "pain-history"
  | "previous-injury"
  | "low-impact-tolerance"
  | "recovery-constrained"
  | "severe-pain";

export const CONSTRAINT_CONTEXTS: readonly ConstraintContext[] = [
  "high-recovery",
  "average-recovery",
  "low-recovery",
  "poor-sleep",
  "high-stress",
  "recurring-sport",
  "high-running-volume",
  "joint-limitation",
  "pain-history",
  "previous-injury",
  "low-impact-tolerance",
  "recovery-constrained",
  "severe-pain",
];

/* ─── Persona ─────────────────────────────────────────────────────────── */

export type CoverageSex = "male" | "female";

export const COVERAGE_SEXES: readonly CoverageSex[] = ["male", "female"];

export type CoveragePersona = {
  personaId: string;
  /** Hand-authored edge cases carry a label; generated ones do not. */
  label?: string;
  sex: CoverageSex;
  age: AgeBand;
  size: SizeContext;
  trainingAge: TrainingAgeBand;
  goal: CoverageGoal;
  availability: AvailabilityContext;
  availableDays: number;
  sessionMinutes: number;
  equipment: EquipmentContext;
  constraint: ConstraintContext;
  /** The snapshot input the engines actually consume. */
  snapshotInput: AthleteSnapshotInput;
};

const HEIGHT_IN: Record<SizeContext, number> = {
  short: 63,
  "average-height": 69,
  tall: 74,
  "very-tall": 78,
  "lower-body-weight": 69,
  "average-body-weight": 69,
  "higher-body-weight": 70,
  "high-muscularity": 70,
  "low-body-fat": 69,
  "moderate-body-fat": 69,
  "high-body-fat": 69,
  "unknown-composition": 69,
  "recent-major-weight-change": 69,
};

const WEIGHT_LB: Record<SizeContext, number> = {
  short: 150,
  "average-height": 178,
  tall: 205,
  "very-tall": 225,
  "lower-body-weight": 132,
  "average-body-weight": 178,
  "higher-body-weight": 268,
  "high-muscularity": 220,
  "low-body-fat": 165,
  "moderate-body-fat": 190,
  "high-body-fat": 245,
  "unknown-composition": 180,
  "recent-major-weight-change": 205,
};

/** Undefined body fat is a real state — an unknown composition stays unknown. */
const BODY_FAT: Record<SizeContext, number | null> = {
  short: 20,
  "average-height": 20,
  tall: 18,
  "very-tall": 18,
  "lower-body-weight": 18,
  "average-body-weight": 20,
  "higher-body-weight": 34,
  "high-muscularity": 12,
  "low-body-fat": 9,
  "moderate-body-fat": 21,
  "high-body-fat": 36,
  "unknown-composition": null,
  "recent-major-weight-change": 27,
};

const RECOVERY_FOR: Record<ConstraintContext, "low" | "moderate" | "high"> = {
  "high-recovery": "high",
  "average-recovery": "moderate",
  "low-recovery": "low",
  "poor-sleep": "low",
  "high-stress": "low",
  "recurring-sport": "moderate",
  "high-running-volume": "moderate",
  "joint-limitation": "moderate",
  "pain-history": "moderate",
  "previous-injury": "moderate",
  "low-impact-tolerance": "moderate",
  "recovery-constrained": "low",
  "severe-pain": "moderate",
};

/* These separate two severities the constraint vocabulary already claims to
   distinguish. `low-recovery` is an athlete who can still train toward their
   goal at a reduced dose; `recovery-constrained` and `poor-sleep` are severe
   enough that rebuilding capacity becomes the objective. Previously every one
   of them derived to `very-low`, collapsing the distinction. */
const SLEEP_FOR: Record<ConstraintContext, number> = {
  "high-recovery": 8.5,
  "average-recovery": 7.5,
  "low-recovery": 6.8,
  "poor-sleep": 5,
  "high-stress": 6.6,
  "recurring-sport": 7.5,
  "high-running-volume": 7.5,
  "joint-limitation": 7.5,
  "pain-history": 7,
  "previous-injury": 7.5,
  "low-impact-tolerance": 7.5,
  "recovery-constrained": 5.5,
  "severe-pain": 6.5,
};

const DAYS_FOR: Record<AvailabilityContext, number[]> = {
  standard: [3, 4, 5, 6],
  "shift-work": [2, 3, 4],
  travel: [2, 3, 4],
  "early-morning": [3, 4, 5],
  evening: [3, 4, 5],
  "split-sessions": [5, 6, 7],
  unpredictable: [2, 3],
};

const MINUTES_FOR: Record<AvailabilityContext, number[]> = {
  standard: [45, 60, 75],
  "shift-work": [30, 45],
  travel: [20, 30, 45],
  "early-morning": [45, 60],
  evening: [60, 75, 90],
  "split-sessions": [45, 60, 120],
  unpredictable: [20, 30],
};

function constraintDetails(c: ConstraintContext): Pick<
  AthleteSnapshotInput,
  "currentPain" | "injuryHistory" | "exerciseRestrictions" | "lifestyleDemand" | "runningBackground"
> {
  switch (c) {
    case "joint-limitation":
      return {
        exerciseRestrictions: ["deep knee flexion"],
        injuryHistory: ["knee"],
        lifestyleDemand: "active",
      };
    case "pain-history":
      return {
        currentPain: [{ region: "lower back", severity: 4 }],
        injuryHistory: ["lower back"],
        lifestyleDemand: "active",
      };
    case "previous-injury":
      return { injuryHistory: ["shoulder"], lifestyleDemand: "active" };
    /* Severity at the level Reserve will not program through. Recorded as the
       athlete reported it — never interpreted, never diagnosed. */
    case "severe-pain":
      return {
        currentPain: [{ region: "shoulder", severity: 8 }],
        injuryHistory: ["shoulder"],
        lifestyleDemand: "active",
      };
    case "low-impact-tolerance":
      return { exerciseRestrictions: ["running", "jumping"], lifestyleDemand: "sedentary" };
    case "high-running-volume":
      return { runningBackground: "40 miles per week", lifestyleDemand: "active" };
    case "high-stress":
      return { lifestyleDemand: "physical" };
    default:
      return { lifestyleDemand: "active" };
  }
}

function scheduleConstraintsFor(a: AvailabilityContext): string[] {
  switch (a) {
    case "shift-work":
      return ["rotating shift work"];
    case "travel":
      return ["frequent travel"];
    case "unpredictable":
      return ["unpredictable schedule"];
    case "early-morning":
      return ["early morning only"];
    case "evening":
      return ["evening only"];
    case "split-sessions":
      return ["split sessions available"];
    default:
      return [];
  }
}

export function buildPersona(
  personaId: string,
  dims: {
    sex?: CoverageSex;
    age: AgeBand;
    size: SizeContext;
    trainingAge: TrainingAgeBand;
    goal: CoverageGoal;
    availability: AvailabilityContext;
    equipment: EquipmentContext;
    constraint: ConstraintContext;
    availableDays?: number;
    sessionMinutes?: number;
    label?: string;
  },
  rng: () => number = createRng(1),
): CoveragePersona {
  const availableDays = dims.availableDays ?? pick(rng, DAYS_FOR[dims.availability]);
  const sessionMinutes = dims.sessionMinutes ?? pick(rng, MINUTES_FOR[dims.availability]);
  const exp = EXPERIENCE_FOR[dims.trainingAge];
  const details = constraintDetails(dims.constraint);
  const sex: CoverageSex = dims.sex ?? "male";
  /* Female personas carry a lower reference body weight and a higher body-fat
     reference at the same size context. Composition is context here, never a
     capability judgement — it must not change what the athlete may train for. */
  const sexWeightFactor = sex === "female" ? 0.84 : 1;
  const sexBodyFatOffset = sex === "female" ? 8 : 0;
  const bodyFatRaw = BODY_FAT[dims.size];
  const bodyFat = bodyFatRaw == null ? null : bodyFatRaw + sexBodyFatOffset;

  const recentWeights =
    dims.size === "recent-major-weight-change"
      ? [
          { date: "2026-05-01", weightLb: Math.round(WEIGHT_LB[dims.size] * sexWeightFactor) + 24 },
          { date: "2026-06-01", weightLb: Math.round(WEIGHT_LB[dims.size] * sexWeightFactor) + 12 },
          { date: "2026-07-01", weightLb: Math.round(WEIGHT_LB[dims.size] * sexWeightFactor) },
        ]
      : null;

  const snapshotInput: AthleteSnapshotInput = {
    athleteId: personaId,
    capturedAt: "2026-07-29T00:00:00.000Z",
    ageYears: AGE_MIDPOINT[dims.age],
    sex,
    heightIn: sex === "female" ? HEIGHT_IN[dims.size] - 5 : HEIGHT_IN[dims.size],
    bodyWeightLb: Math.round(WEIGHT_LB[dims.size] * sexWeightFactor),
    bodyFatPercent: bodyFat,

    primaryGoal: GOAL_PHRASE[dims.goal],
    secondaryGoals: [],
    goalPriority: "single-focus",
    eventDate: dims.goal === "event-countdown" ? "2026-10-01" : null,

    trainingAgeYears: exp.years,
    experienceLevel: exp.level,
    availableDays,
    sessionDurationMinutes: sessionMinutes,

    recoveryCapacity: RECOVERY_FOR[dims.constraint],
    averageSleepHours: SLEEP_FOR[dims.constraint],
    ...details,

    nutritionPhase: "maintenance",
    recentWeightsLb: recentWeights,

    equipment: EQUIPMENT_LIST[dims.equipment],
    scheduleConstraints: scheduleConstraintsFor(dims.availability),
    recurringActivities: [],
  };

  return {
    personaId,
    label: dims.label,
    sex,
    age: dims.age,
    size: dims.size,
    trainingAge: dims.trainingAge,
    goal: dims.goal,
    availability: dims.availability,
    availableDays,
    sessionMinutes,
    equipment: dims.equipment,
    constraint: dims.constraint,
    snapshotInput,
  };
}

/* ─── Pairwise generation ─────────────────────────────────────────────── */

/**
 * Deterministic sweep across the seven dimensions.
 *
 * A full cross product is ~1.9M athletes, which is not a suite anyone runs.
 * Routing defects are almost always driven by an interaction between TWO
 * dimensions (goal × equipment, recovery × frequency) rather than a seven-way
 * coincidence, so the sweep targets pair spread rather than the cross product.
 *
 * Two things are deliberate here:
 *
 * 1. A covering prefix walks every dimension by `i % len` for the first
 *    `max(len)` personas. That GUARANTEES every value of every dimension is
 *    reached — it does not leave single-value coverage to chance.
 *
 * 2. The remainder is drawn from the seeded RNG independently per dimension.
 *    An earlier version used fixed multiplicative strides, which silently
 *    reached only 3 of 21 goals because the stride shared a factor with the
 *    dimension length, and collapsed the three length-7 dimensions to seven
 *    distinct triples. Independent seeded draws have neither failure mode.
 *
 * Pair spread is MEASURED by `pairwiseCoverage`, not asserted here.
 */
export function generateCoveragePersonas(count: number, seed = 20260729): CoveragePersona[] {
  const rng = createRng(seed);
  const personas: CoveragePersona[] = [];

  const coveringPrefix = Math.max(
    AGE_BANDS.length,
    SIZE_CONTEXTS.length,
    TRAINING_AGES.length,
    COVERAGE_GOALS.length,
    AVAILABILITY_CONTEXTS.length,
    EQUIPMENT_CONTEXTS.length,
    CONSTRAINT_CONTEXTS.length,
  );

  for (let i = 0; i < count; i += 1) {
    const covering = i < coveringPrefix;
    const at = <T>(xs: readonly T[]): T => (covering ? xs[i % xs.length] : pick(rng, xs));

    personas.push(
      buildPersona(
        `gen-${String(i).padStart(6, "0")}`,
        {
          sex: at(COVERAGE_SEXES),
          age: at(AGE_BANDS),
          size: at(SIZE_CONTEXTS),
          trainingAge: at(TRAINING_AGES),
          goal: at(COVERAGE_GOALS),
          availability: at(AVAILABILITY_CONTEXTS),
          equipment: at(EQUIPMENT_CONTEXTS),
          constraint: at(CONSTRAINT_CONTEXTS),
        },
        rng,
      ),
    );
  }

  return personas;
}

/**
 * Measured fraction of two-dimension value pairs the sweep actually produced.
 * Reported rather than assumed — a suite that claims pairwise coverage should
 * be able to show it.
 */
export function pairwiseCoverage(personas: CoveragePersona[]): {
  reached: number;
  possible: number;
  rate: number;
} {
  const keys = [
    "sex",
    "age",
    "size",
    "trainingAge",
    "goal",
    "availability",
    "equipment",
    "constraint",
  ] as const;
  const sizes: Record<(typeof keys)[number], number> = {
    sex: COVERAGE_SEXES.length,
    age: AGE_BANDS.length,
    size: SIZE_CONTEXTS.length,
    trainingAge: TRAINING_AGES.length,
    goal: COVERAGE_GOALS.length,
    availability: AVAILABILITY_CONTEXTS.length,
    equipment: EQUIPMENT_CONTEXTS.length,
    constraint: CONSTRAINT_CONTEXTS.length,
  };

  let possible = 0;
  let reached = 0;
  for (let a = 0; a < keys.length; a += 1) {
    for (let b = a + 1; b < keys.length; b += 1) {
      possible += sizes[keys[a]] * sizes[keys[b]];
      const seen = new Set<string>();
      for (const p of personas) seen.add(`${String(p[keys[a]])}|${String(p[keys[b]])}`);
      reached += seen.size;
    }
  }

  return { reached, possible, rate: possible === 0 ? 0 : reached / possible };
}

/** Every value of every dimension that the generated sweep actually reached. */
export function dimensionCoverage(personas: CoveragePersona[]): Record<string, number> {
  const seen: Record<string, Set<string>> = {
    sex: new Set(),
    age: new Set(),
    size: new Set(),
    trainingAge: new Set(),
    goal: new Set(),
    availability: new Set(),
    equipment: new Set(),
    constraint: new Set(),
  };
  for (const p of personas) {
    seen.sex.add(p.sex);
    seen.age.add(p.age);
    seen.size.add(p.size);
    seen.trainingAge.add(p.trainingAge);
    seen.goal.add(p.goal);
    seen.availability.add(p.availability);
    seen.equipment.add(p.equipment);
    seen.constraint.add(p.constraint);
  }
  return {
    sex: seen.sex.size / COVERAGE_SEXES.length,
    age: seen.age.size / AGE_BANDS.length,
    size: seen.size.size / SIZE_CONTEXTS.length,
    trainingAge: seen.trainingAge.size / TRAINING_AGES.length,
    goal: seen.goal.size / COVERAGE_GOALS.length,
    availability: seen.availability.size / AVAILABILITY_CONTEXTS.length,
    equipment: seen.equipment.size / EQUIPMENT_CONTEXTS.length,
    constraint: seen.constraint.size / CONSTRAINT_CONTEXTS.length,
  };
}

/* ─── Hand-authored edge cases ────────────────────────────────────────── */

type EdgeSpec = Parameters<typeof buildPersona>[1];

/**
 * The athletes a generated sweep is least likely to produce and most likely to
 * be routed badly. These are the cases that decide whether "universal
 * coverage" is honest, so they are written by hand rather than sampled.
 */
const EDGE_SPECS: EdgeSpec[] = [
  {
    label: "75+ never trained, bodyweight only, low recovery",
    age: "75+",
    size: "lower-body-weight",
    trainingAge: "never-trained",
    goal: "healthy-aging",
    availability: "standard",
    equipment: "bodyweight-only",
    constraint: "low-recovery",
    availableDays: 2,
    sessionMinutes: 20,
  },
  {
    label: "Beginner demanding contest prep",
    age: "25-34",
    size: "average-body-weight",
    trainingAge: "never-trained",
    goal: "contest-preparation",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "average-recovery",
    availableDays: 6,
  },
  {
    label: "Elite bodybuilder on bands only",
    age: "25-34",
    size: "high-muscularity",
    trainingAge: "elite",
    goal: "bodybuilding",
    availability: "travel",
    equipment: "bands-only",
    constraint: "average-recovery",
    availableDays: 3,
  },
  {
    label: "Powerlifter with no barbell",
    age: "25-34",
    size: "high-muscularity",
    trainingAge: "advanced",
    goal: "powerlifting",
    availability: "standard",
    equipment: "dumbbells-only",
    constraint: "average-recovery",
  },
  {
    label: "Recovery-constrained athlete demanding 7 days",
    age: "35-44",
    size: "average-body-weight",
    trainingAge: "intermediate",
    goal: "bodybuilding",
    availability: "split-sessions",
    equipment: "commercial-gym",
    constraint: "recovery-constrained",
    availableDays: 7,
  },
  {
    label: "Higher body weight, fat loss, low impact tolerance",
    age: "45-54",
    size: "higher-body-weight",
    trainingAge: "beginner",
    goal: "fat-loss",
    availability: "standard",
    equipment: "machines-only",
    constraint: "low-impact-tolerance",
    availableDays: 3,
  },
  {
    label: "Unknown composition, no goal signal",
    age: "35-44",
    size: "unknown-composition",
    trainingAge: "early-intermediate",
    goal: "general-fitness",
    availability: "unpredictable",
    equipment: "hotel-gym",
    constraint: "average-recovery",
    availableDays: 2,
  },
  {
    label: "Shift worker, hybrid performance, 2 days",
    age: "25-34",
    size: "average-body-weight",
    trainingAge: "intermediate",
    goal: "hybrid-performance",
    availability: "shift-work",
    equipment: "commercial-gym",
    constraint: "poor-sleep",
    availableDays: 2,
  },
  {
    label: "Marathon volume plus physique goal",
    age: "25-34",
    size: "low-body-fat",
    trainingAge: "advanced",
    goal: "endurance-physique",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "high-running-volume",
    availableDays: 6,
  },
  {
    label: "Returning after layoff with pain history",
    age: "45-54",
    size: "moderate-body-fat",
    trainingAge: "returning-after-layoff",
    goal: "lean-gain",
    availability: "standard",
    equipment: "home-gym",
    constraint: "pain-history",
    availableDays: 4,
  },
  {
    label: "Very tall novice, minimal equipment",
    age: "18-24",
    size: "very-tall",
    trainingAge: "beginner",
    goal: "lean-gain",
    availability: "standard",
    equipment: "minimal-cardio",
    constraint: "average-recovery",
    availableDays: 3,
  },
  {
    label: "65-74 strength goal with joint limitation",
    age: "65-74",
    size: "average-body-weight",
    trainingAge: "intermediate",
    goal: "strength",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "joint-limitation",
    availableDays: 3,
  },
  {
    label: "Event countdown in 9 weeks, travel-heavy",
    age: "25-34",
    size: "moderate-body-fat",
    trainingAge: "intermediate",
    goal: "event-countdown",
    availability: "travel",
    equipment: "hotel-gym",
    constraint: "high-stress",
    availableDays: 3,
  },
  {
    label: "Recovery restoration after burnout",
    age: "35-44",
    size: "average-body-weight",
    trainingAge: "advanced",
    goal: "recovery-restoration",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "recovery-constrained",
    availableDays: 3,
  },
  {
    label: "Female intermediate, physique goal, commercial gym",
    sex: "female",
    age: "25-34",
    size: "moderate-body-fat",
    trainingAge: "intermediate",
    goal: "bodybuilding",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "average-recovery",
    availableDays: 5,
  },
  {
    label: "Female masters athlete, healthy aging, home gym",
    sex: "female",
    age: "55-64",
    size: "average-body-weight",
    trainingAge: "early-intermediate",
    goal: "healthy-aging",
    availability: "standard",
    equipment: "home-gym",
    constraint: "average-recovery",
    availableDays: 3,
  },
  {
    label: "Female advanced, strength goal, low recovery",
    sex: "female",
    age: "35-44",
    size: "high-muscularity",
    trainingAge: "advanced",
    goal: "strength",
    availability: "shift-work",
    equipment: "commercial-gym",
    constraint: "low-recovery",
    availableDays: 4,
  },
  {
    label: "Severe reported pain during a strong goal match",
    age: "35-44",
    size: "high-muscularity",
    trainingAge: "advanced",
    goal: "bodybuilding",
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "severe-pain",
    availableDays: 5,
  },
  {
    label: "Mobility-only goal, bodyweight",
    age: "55-64",
    size: "average-body-weight",
    trainingAge: "never-trained",
    goal: "mobility",
    availability: "early-morning",
    equipment: "bodyweight-only",
    constraint: "low-impact-tolerance",
    availableDays: 4,
  },
];

/**
 * Expands the hand-authored specs into the required edge-case count by
 * sweeping each spec across the remaining age bands and equipment contexts.
 * The originals are always included first and keep their labels.
 */
export function edgeCasePersonas(minimum = 150): CoveragePersona[] {
  const rng = createRng(99);
  const out: CoveragePersona[] = EDGE_SPECS.map((spec, i) =>
    buildPersona(`edge-${String(i).padStart(3, "0")}`, spec, rng),
  );

  let i = 0;
  while (out.length < minimum) {
    const spec = EDGE_SPECS[i % EDGE_SPECS.length];
    const round = Math.floor(i / EDGE_SPECS.length);
    const variant: EdgeSpec = {
      ...spec,
      label: `${spec.label} (variant ${round + 1})`,
      age: AGE_BANDS[(AGE_BANDS.indexOf(spec.age) + round + 1) % AGE_BANDS.length],
      equipment:
        EQUIPMENT_CONTEXTS[
          (EQUIPMENT_CONTEXTS.indexOf(spec.equipment) + round + 1) % EQUIPMENT_CONTEXTS.length
        ],
    };
    out.push(buildPersona(`edge-${String(out.length).padStart(3, "0")}`, variant, rng));
    i += 1;
  }

  return out;
}
