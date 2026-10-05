/* ════════════════════════════════════════════════════════════════════════
   CANONICAL PROTOCOL DNA — the authoritative runtime contract.

   One record per selectable protocol describing what that coaching system
   actually DOES: who it serves, the topology it runs, the stimulus it
   creates, how it progresses, what fatigue it generates, its phase
   sequence, its nutrition demand, and the rules that adapt it.

   Two hard design rules:

   1. DNA never duplicates topology. `canonicalWeek`, `muscleFrequency`, and
      `movementFrequency` are DERIVED from the protocol's real blueprint
      (split-blueprints.ts), so DNA and the generated week cannot drift.

   2. DNA drives generation. The program horizon reads phases, progression,
      and stimulus from here — it is not documentation sitting beside the
      engine.

   Organization + training structure only. No medical claims, no dosing,
   no diagnosis, no compound or hormone content.
   ════════════════════════════════════════════════════════════════════════ */

import {
  PROTOCOL_BLUEPRINTS,
  getBlueprintForProtocol,
  type BlueprintDay,
  type SessionArchetype,
  type SplitBlueprint,
} from "./split-blueprints";
import { PROTOCOL_LIBRARY, type ProtocolDefinition } from "@/lib/protocol/library";

export const PROTOCOL_DNA_VERSION = "protocol-dna-1";

/* ─── Families ────────────────────────────────────────────────────────── */

export type ProtocolDNAFamily =
  | "classic-physique"
  | "balanced-hypertrophy"
  | "weak-point-specialization"
  | "contest-preparation"
  | "powerbuilding"
  | "strength"
  | "performance-hybrid"
  | "tactical-hybrid"
  | "grand-touring"
  | "endurance-physique"
  | "fat-loss"
  | "lean-mass"
  | "recomposition"
  | "beginner"
  | "recovery-constrained"
  | "home-gym"
  | "womens-performance"
  | "lifestyle"
  | "log-only";

export const FAMILY_LABEL: Record<ProtocolDNAFamily, string> = {
  "classic-physique": "Classic Physique",
  "balanced-hypertrophy": "Balanced Hypertrophy",
  "weak-point-specialization": "Weak-Point Specialization",
  "contest-preparation": "Contest Preparation",
  powerbuilding: "Powerbuilding",
  strength: "Strength",
  "performance-hybrid": "Performance Hybrid",
  "tactical-hybrid": "Tactical Hybrid",
  "grand-touring": "Grand Touring",
  "endurance-physique": "Endurance–Physique",
  "fat-loss": "Fat Loss",
  "lean-mass": "Lean Mass",
  recomposition: "Recomposition",
  beginner: "Beginner",
  "recovery-constrained": "Recovery Constrained",
  "home-gym": "Home Gym",
  "womens-performance": "Women's Performance",
  lifestyle: "Lifestyle",
  "log-only": "Log Only",
};

/* ─── Movement patterns ───────────────────────────────────────────────── */

export type MovementPattern =
  | "knee-dominant"
  | "hip-hinge"
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "loaded-carry"
  | "explosive"
  | "aerobic"
  | "trunk"
  | "isolation";

const ARCHETYPE_PATTERNS: Partial<Record<SessionArchetype, MovementPattern[]>> = {
  "chest-strength": ["horizontal-push", "vertical-push"],
  "chest-hypertrophy": ["horizontal-push", "isolation"],
  "chest-detail": ["horizontal-push", "isolation"],
  "chest-back-strength": ["horizontal-push", "horizontal-pull", "vertical-pull"],
  "chest-back-volume": ["horizontal-push", "horizontal-pull", "isolation"],
  "chest-back-pump": ["horizontal-push", "horizontal-pull", "isolation"],
  "back-width": ["vertical-pull", "isolation"],
  "back-thickness": ["horizontal-pull", "hip-hinge"],
  "upper-back-posture": ["horizontal-pull", "isolation"],
  "delts-arms": ["vertical-push", "isolation"],
  "arms-pump": ["isolation"],
  shoulders: ["vertical-push", "isolation"],
  push: ["horizontal-push", "vertical-push", "isolation"],
  pull: ["vertical-pull", "horizontal-pull", "isolation"],
  "upper-strength": ["horizontal-push", "horizontal-pull", "vertical-push"],
  "upper-hypertrophy": ["horizontal-push", "vertical-pull", "isolation"],
  "upper-tone": ["horizontal-push", "horizontal-pull", "isolation"],
  "posture-upper": ["horizontal-pull", "trunk"],
  legs: ["knee-dominant", "hip-hinge", "isolation"],
  "lower-strength": ["knee-dominant", "hip-hinge"],
  "lower-power": ["knee-dominant", "explosive"],
  "quad-focus": ["knee-dominant", "isolation"],
  "posterior-chain": ["hip-hinge", "isolation"],
  "hamstring-glute": ["hip-hinge", "isolation"],
  "glute-strength": ["hip-hinge", "knee-dominant"],
  "glute-shape": ["hip-hinge", "isolation"],
  "glute-pump": ["hip-hinge", "isolation"],
  "glute-detail": ["hip-hinge", "isolation"],
  abductors: ["isolation"],
  "legs-waistline": ["knee-dominant", "trunk"],
  calves: ["isolation"],
  "full-body-athletic": ["knee-dominant", "horizontal-push", "horizontal-pull", "loaded-carry"],
  "sprint-power": ["explosive", "aerobic"],
  explosive: ["explosive"],
  conditioning: ["aerobic", "trunk"],
  "sport-conditioning": ["aerobic", "explosive"],
  zone2: ["aerobic"],
  "outdoor-distance": ["aerobic"],
  core: ["trunk"],
  waistline: ["trunk"],
  pilates: ["trunk"],
  yoga: ["trunk"],
  mobility: [],
  recovery: [],
  logged: [],
};

/** Archetypes that are genuinely a conditioning exposure.
    Counting by session INTENT over-counts: several fat-loss blueprints tag a
    lifting day's intent as "conditioning" to signal its bias, which would make
    a five-lift week read as five conditioning sessions. */
export const CONDITIONING_ARCHETYPES: ReadonlySet<SessionArchetype> = new Set<SessionArchetype>([
  "conditioning", "sport-conditioning", "zone2", "outdoor-distance", "sprint-power", "explosive",
]);

/** True when a blueprint day is a real conditioning exposure. */
export function isConditioningDay(d: BlueprintDay): boolean {
  return !d.recovery && CONDITIONING_ARCHETYPES.has(d.archetype);
}

const MUSCLE_ALIASES: Record<string, string> = {
  pecs: "chest", "upper-chest": "chest", lats: "back", traps: "back",
  bicep: "arms", biceps: "arms", tricep: "arms", triceps: "arms",
  delt: "delts", shoulders: "delts", quad: "quads", hamstring: "hamstrings",
  glute: "glutes", calf: "calves", waist: "core", abs: "core",
};

function normalizeMuscle(raw: string): string | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;
  // Non-muscle emphasis tokens don't belong in a muscle-frequency map.
  if (/^(priority|strength|power|conditioning|distance|aerobic|tempo|endurance|mobility|posture|full-body|carries|sport)$/.test(k)) return null;
  return MUSCLE_ALIASES[k] ?? k;
}

/** Weekly exposures per muscle, derived from the protocol's real blueprint. */
export function deriveMuscleFrequency(week: readonly BlueprintDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of week) {
    if (d.recovery) continue;
    const seen = new Set<string>();
    for (const e of d.emphasis) {
      const m = normalizeMuscle(e);
      if (!m || seen.has(m)) continue;
      seen.add(m);
      out[m] = (out[m] ?? 0) + 1;
    }
  }
  return out;
}

/** Weekly exposures per movement pattern, derived from the real blueprint. */
export function deriveMovementFrequency(week: readonly BlueprintDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of week) {
    if (d.recovery) continue;
    for (const p of ARCHETYPE_PATTERNS[d.archetype] ?? []) {
      out[p] = (out[p] ?? 0) + 1;
    }
  }
  return out;
}

/* ─── Phase definitions ───────────────────────────────────────────────── */

export type PhaseKind =
  | "foundation"
  | "accumulation"
  | "intensification"
  | "realization"
  | "specialization"
  | "consolidation"
  | "taper"
  | "deload"
  | "assessment";

export type ProgramPhaseDefinition = {
  id: string;
  name: string;
  kind: PhaseKind;
  objective: string;
  /** Relative share of the program's total weeks. Ignored when fixedWeeks is set. */
  weight: number;
  /** Phases that must be exactly N weeks (deloads, assessments). */
  fixedWeeks?: number;
  /** Multiplier on the protocol's base weekly set targets. */
  volumeMultiplier: number;
  /** Effort target for working sets, expressed as reps in reserve. */
  effortRange: string;
  /** Multiplier on conditioning duration / distance. */
  conditioningMultiplier: number;
  expectedAdaptation: string[];
  entryCriteria: string[];
  exitCriteria: string[];
};

/* ─── The DNA record ──────────────────────────────────────────────────── */

export type ProtocolDNA = {
  protocolId: string;
  architectureVersion: string;

  identity: {
    family: ProtocolDNAFamily;
    primaryObjective: string;
    secondaryObjectives: string[];
    intendedAthletes: string[];
    unsuitableAthletes: string[];
  };

  topology: {
    supportedFrequencies: number[];
    /** DERIVED from the protocol's blueprint — never authored twice. */
    canonicalWeek: BlueprintDay[];
    blueprintId: string;
    blueprintName: string;
    compressionRules: string[];
    expansionRules: string[];
    schedulingPriorities: string[];
  };

  stimulus: {
    /** DERIVED. */
    muscleFrequency: Record<string, number>;
    /** DERIVED. */
    movementFrequency: Record<string, number>;
    weeklySetRanges: Record<string, [number, number]>;
    intensityDistribution: string;
    proximityToFailurePolicy: string;
    primaryLiftPolicy?: string;
    exerciseSelectionPolicy: string;
  };

  progression: {
    model: string;
    loadingProgression: string;
    volumeProgression: string;
    exerciseProgression: string;
    conditioningProgression?: string;
    advancementCriteria: string[];
    regressionCriteria: string[];
  };

  fatigue: {
    localFatiguePattern: string;
    systemicDemand: "low" | "moderate" | "high" | "very-high";
    lowerBodyInterference: "low" | "moderate" | "high";
    recoveryDemand: "low" | "moderate" | "high" | "very-high";
    impactDemand?: "none" | "low" | "moderate" | "high";
  };

  phases: ProgramPhaseDefinition[];

  nutrition: {
    demandClass: "low" | "moderate" | "high" | "very-high";
    trainingDayPattern: string;
    recoveryDayPattern: string;
    conditioningSupport?: string;
    bodyCompositionSupport: string;
  };

  adaptation: {
    readinessRules: string[];
    painRules: string[];
    missedSessionRules: string[];
    scheduleChangeRules: string[];
    bodyWeightTrendRules: string[];
    performanceTrendRules: string[];
    adherenceRules: string[];
  };

  personalization: {
    preferredAthleteProfiles: string[];
    conditionalProfiles: string[];
    frequencySelectionRules: string[];
    bodyCompositionRules: string[];
    recoveryScalingRules: string[];
  };

  /** Eligibility gates — the only reason a protocol is hidden rather than ranked. */
  eligibility: {
    minTrainingAgeYears?: number;
    minExperience?: "beginner" | "novice" | "intermediate" | "advanced" | "elite";
    requiresRunningCapacity?: boolean;
    requiresWeakPointSelection?: boolean;
    /** Never selectable by the recommender (lifestyle-gated or log-only). */
    manualOnly?: boolean;
  };
};

/* ─── Phase sequence library ──────────────────────────────────────────── */

const P = (
  id: string, name: string, kind: PhaseKind, objective: string, weight: number,
  volumeMultiplier: number, effortRange: string, conditioningMultiplier: number,
  expectedAdaptation: string[], entryCriteria: string[], exitCriteria: string[],
  fixedWeeks?: number,
): ProgramPhaseDefinition => ({
  id, name, kind, objective, weight, fixedWeeks, volumeMultiplier, effortRange,
  conditioningMultiplier, expectedAdaptation, entryCriteria, exitCriteria,
});

const DELOAD = (conditioning = 0.6) => P(
  "deload", "Deload", "deload",
  "Shed accumulated fatigue without losing the adaptation the block built.",
  1, 0.55, "4–5 reps in reserve", conditioning,
  ["Fatigue clears while movement patterns stay rehearsed", "Readiness and sleep quality recover"],
  ["Accumulated fatigue is limiting session quality, or the block has reached its planned deload"],
  ["Readiness returns to baseline", "Session quality returns without added effort"],
  1,
);

const ASSESSMENT = (label: string, adaptations: string[]) => P(
  "assessment", "Assessment", "assessment", label, 1, 0.7, "2–3 reps in reserve", 0.8,
  adaptations,
  ["Deload complete and readiness restored"],
  ["Assessment data recorded", "Next block's entry point selected from the result"],
  1,
);

const HYPERTROPHY_PHASES: ProgramPhaseDefinition[] = [
  P("foundation", "Foundation", "foundation", "Establish technique, session structure, and a working-set baseline.", 2, 0.85, "3–4 reps in reserve", 1,
    ["Movement quality and session rhythm are established", "A load baseline exists for every primary movement"],
    ["Program activated"], ["Every primary movement has a logged working load", "Sessions complete inside the planned duration"]),
  P("accumulation", "Accumulation", "accumulation", "Add weekly volume at controlled effort so tissue is exposed repeatedly.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Weekly working-set volume rises", "Work capacity increases across the session"],
    ["Foundation complete"], ["Volume target reached at maintained rep quality"]),
  P("overload", "Overload", "intensification", "Push load and effort while volume holds — the block's hardest training.", 3, 1.1, "1–2 reps in reserve", 0.9,
    ["Working loads increase at the same rep targets", "Muscular fatigue is highest here by design"],
    ["Accumulation volume tolerated for at least two weeks"], ["Load progression stalls on two consecutive exposures", "Or the phase's planned weeks complete"]),
  P("specialization", "Specialization", "specialization", "Concentrate volume on the regions that lag while everything else holds.", 2, 1.05, "1–2 reps in reserve", 0.8,
    ["Priority regions receive elevated weekly sets", "Non-priority regions hold at maintenance"],
    ["Overload complete", "A priority region is identified"], ["Priority-region measurements or performance improve", "Or the phase's planned weeks complete"]),
  DELOAD(),
  ASSESSMENT("Re-measure the physique and re-test the anchor movements.", ["Progress evidence is captured", "The next block starts from measured reality"]),
];

const POWERBUILDING_PHASES: ProgramPhaseDefinition[] = [
  P("technical-base", "Technical Base", "foundation", "Re-groove the primary lifts and establish honest top-set numbers.", 2, 0.85, "3–4 reps in reserve", 1,
    ["Primary-lift technique is consistent", "A real top-set baseline exists for squat, bench, hinge, and press"],
    ["Program activated"], ["Every primary lift has a logged top set at a repeatable technique standard"]),
  P("strength-accumulation", "Strength Accumulation", "accumulation", "Build tonnage on the primary patterns with hypertrophy volume around them.", 3, 1.05, "2–3 reps in reserve", 0.9,
    ["Primary-lift work sets increase", "Accessory volume adds tissue around each pattern"],
    ["Technical base complete"], ["Top sets improve on at least three of four primary lifts"]),
  P("intensity-development", "Intensity Development", "intensification", "Raise intensity on the primary lifts and trim accessory volume to pay for it.", 3, 0.9, "1–2 reps in reserve", 0.7,
    ["Higher loads at lower reps on the primary lifts", "Accessory volume reduces to protect recovery"],
    ["Strength accumulation complete"], ["Planned intensity exposures completed at technique standard"]),
  P("realization", "Realization", "realization", "Reduce volume sharply and express the strength the block built.", 1, 0.6, "1–2 reps in reserve", 0.5,
    ["Accumulated fatigue drops while strength expression rises"],
    ["Intensity development complete"], ["Top-end lifts recorded"]),
  DELOAD(0.5),
  ASSESSMENT("Test the primary lifts and record the block's real strength change.", ["Primary-lift performance is measured, not estimated"]),
];

const STRENGTH_PHASES: ProgramPhaseDefinition[] = [
  P("skill-base", "Skill Base", "foundation", "Rebuild lift execution at submaximal load — the skill is the training effect.", 2, 0.8, "4–5 reps in reserve", 1,
    ["Bar path and bracing become repeatable", "Submaximal work feels identical rep to rep"],
    ["Program activated"], ["Technique holds across all planned sets at the opening load"]),
  P("volume-accumulation", "Volume Accumulation", "accumulation", "Accumulate quality sets on the primary lifts and their supplemental variations.", 3, 1.0, "2–3 reps in reserve", 0.8,
    ["Weekly primary-lift set count rises", "Supplemental variations address the weakest range"],
    ["Skill base complete"], ["Planned weekly set count sustained for two consecutive weeks"]),
  P("intensity-exposure", "Intensity Exposure", "intensification", "Plan real heavy exposures — the specific stimulus strength requires.", 3, 0.85, "1–2 reps in reserve", 0.6,
    ["Repeated exposure to genuinely heavy loads", "Neural efficiency improves on the primary lifts"],
    ["Volume accumulation complete"], ["Planned intensity exposures completed at technique standard"]),
  P("realization", "Realization", "realization", "Strip volume and let the strength express itself.", 1, 0.5, "1–2 reps in reserve", 0.4,
    ["Fatigue drops sharply while lift expression peaks"],
    ["Intensity exposure complete"], ["Top singles or heavy triples recorded"]),
  DELOAD(0.4),
  ASSESSMENT("Test the primary lifts under standard conditions.", ["Measured strength change on each primary lift"]),
];

const GRAND_TOURING_PHASES: ProgramPhaseDefinition[] = [
  P("capacity-foundation", "Capacity Foundation", "foundation", "Establish gym baselines and an honest aerobic entry point at the same time.", 2, 0.85, "3–4 reps in reserve", 0.8,
    ["Lifting baselines are set", "Distance work starts at a duration the athlete can repeat"],
    ["Program activated"], ["Both a lifting baseline and a repeatable distance baseline exist"]),
  P("hybrid-accumulation", "Hybrid Accumulation", "accumulation", "Grow lifting volume and distance together without letting either collapse the other.", 3, 1.0, "2–3 reps in reserve", 1.1,
    ["Weekly lifting volume and weekly distance both increase", "Lower-body interference stays managed by placement"],
    ["Capacity foundation complete"], ["Both lifting volume and distance targets held for two consecutive weeks"]),
  P("integrated-progression", "Integrated Progression", "intensification", "Raise the quality of both halves — heavier lifting, faster distance work.", 3, 1.05, "1–2 reps in reserve", 1.25,
    ["Load increases on the physique days", "Distance work adds quality, not only volume"],
    ["Hybrid accumulation complete"], ["Quality targets met on both the lifting and distance sides"]),
  P("output-development", "Output Development", "specialization", "Push peak output on the performance conditioning day while physique volume holds.", 2, 1.0, "1–2 reps in reserve", 1.35,
    ["Peak conditioning output rises", "Physique volume is protected rather than sacrificed"],
    ["Integrated progression complete"], ["Output targets met, or fatigue markers indicate consolidation"]),
  P("consolidation", "Consolidation", "consolidation", "Hold the gains, reduce the strain, keep both qualities alive.", 1, 0.8, "3–4 reps in reserve", 0.85,
    ["Fatigue drops while both capacities are maintained"],
    ["Output development complete"], ["Readiness recovered with both qualities intact"]),
  ASSESSMENT("Re-test distance capacity and re-measure the physique together.", ["Both halves of the hybrid are measured, not assumed"]),
];

const ENDURANCE_PHASES: ProgramPhaseDefinition[] = [
  P("aerobic-foundation", "Aerobic Foundation", "foundation", "Build the aerobic base at conversational effort before anything gets fast.", 2, 0.8, "3–4 reps in reserve", 0.85,
    ["Easy aerobic duration becomes comfortable", "Resistance work establishes a retention baseline"],
    ["Program activated"], ["The easy session is completed at conversational effort without a spike in next-day soreness"]),
  P("mileage-development", "Mileage Development", "accumulation", "Progress weekly duration or distance in controlled steps.", 3, 0.9, "3–4 reps in reserve", 1.2,
    ["Weekly aerobic volume rises steadily", "Muscle retention holds through the increase"],
    ["Aerobic foundation complete"], ["Target weekly volume sustained for two consecutive weeks without joint complaint"]),
  P("quality-integration", "Quality Integration", "intensification", "Introduce the quality session while the base keeps growing.", 3, 0.85, "3–4 reps in reserve", 1.3,
    ["Tempo and interval work improve pace at the same effort", "Interference is managed by placement, not luck"],
    ["Mileage development complete"], ["Quality sessions completed without degrading the long effort"]),
  P("performance-build", "Performance Build", "specialization", "Sharpen the specific quality the goal event or target needs.", 2, 0.8, "3–4 reps in reserve", 1.35,
    ["Race-specific or goal-specific pace improves"],
    ["Quality integration complete"], ["Goal-specific pace or duration achieved in training"]),
  P("consolidation", "Consolidation / Taper", "taper", "Reduce volume, hold intensity, arrive fresh.", 1, 0.7, "3–4 reps in reserve", 0.6,
    ["Fatigue clears while aerobic sharpness is retained"],
    ["Performance build complete"], ["Readiness restored ahead of the assessment or event"]),
  ASSESSMENT("Re-test the aerobic benchmark and confirm muscle retention.", ["Endurance change and muscle retention are both recorded"]),
];

const FAT_LOSS_PHASES: ProgramPhaseDefinition[] = [
  P("adherence-foundation", "Adherence Foundation", "foundation", "Make the week repeatable before making it harder — adherence is the variable that decides this block.", 2, 0.85, "3–4 reps in reserve", 0.8,
    ["A repeatable weekly rhythm is established", "Resistance baselines are set for retention tracking"],
    ["Program activated"], ["Planned sessions completed for two consecutive weeks"]),
  P("work-capacity", "Work-Capacity Build", "accumulation", "Raise the amount of quality work the week can hold before the deficit deepens.", 3, 1.0, "2–3 reps in reserve", 1.15,
    ["Session density improves", "Conditioning becomes repeatable rather than punishing"],
    ["Adherence foundation complete"], ["Conditioning target met without degrading resistance quality"]),
  P("deficit-progression", "Deficit Progression", "intensification", "Hold resistance quality while expenditure and the deficit do the composition work.", 3, 0.95, "2–3 reps in reserve", 1.25,
    ["Body-composition trend moves", "Strength is retained, which is the honesty check"],
    ["Work-capacity build complete"], ["Composition trend moving at target rate with strength retained"]),
  P("fatigue-management", "Fatigue Management", "consolidation", "Protect recovery as the deficit accumulates — this phase exists because deficits cost recovery.", 2, 0.8, "3–4 reps in reserve", 0.9,
    ["Fatigue is contained while the trend continues", "Sleep and readiness are actively protected"],
    ["Deficit progression complete, or fatigue markers rise"], ["Readiness stabilises"]),
  P("consolidation", "Consolidation", "consolidation", "Hold the result and re-establish a sustainable intake before deciding what is next.", 1, 0.85, "3–4 reps in reserve", 0.8,
    ["Weight stabilises at the new level", "Training quality returns"],
    ["Fatigue management complete"], ["Weight stable for one week with training quality restored"]),
  ASSESSMENT("Re-measure composition and confirm strength retention.", ["Composition change and strength retention are both recorded"]),
];

/* Event Countdown is date-anchored: it front-loads the deficit, then spends
   the last weeks on detail and presentation rather than on further reduction.
   That is a genuinely different sequence from the open-ended fat-loss block. */
const COUNTDOWN_PHASES: ProgramPhaseDefinition[] = [
  P("countdown-setup", "Countdown Setup", "foundation", "Fix the week and the starting point against a real date.", 1, 0.9, "2–3 reps in reserve", 1,
    ["The weekly rhythm is locked to the date", "Starting measurements and photographs are recorded"],
    ["Program activated", "A target date is set"], ["Baseline recorded and the week completed once"]),
  P("deficit-drive", "Deficit Drive", "intensification", "Do the majority of the composition work early, while recovery capacity is highest.", 3, 1.0, "2–3 reps in reserve", 1.3,
    ["The largest share of the composition change happens here", "Conditioning volume peaks"],
    ["Countdown setup complete"], ["Composition on pace for the date"]),
  P("detail-work", "Detail Work", "specialization", "Shift emphasis to the upper frame and waistline detail that the event actually shows.", 2, 1.0, "1–2 reps in reserve", 1.1,
    ["Upper-frame and waistline detail sharpen", "Lower volume reduces to protect recovery"],
    ["Deficit drive complete"], ["Detail targets met, or two weeks remain"]),
  P("presentation-week", "Presentation Week", "taper", "Reduce demand and arrive fresh rather than depleted.", 1, 0.6, "3–4 reps in reserve", 0.6,
    ["Fatigue clears into the date", "Appearance and energy both peak"],
    ["Detail work complete, or the final week is reached"], ["Target date reached"], 1),
  ASSESSMENT("Record the finish and plan the return to maintenance.", ["The result is documented", "A structured return to maintenance is planned"]),
];

const BEGINNER_PHASES: ProgramPhaseDefinition[] = [
  P("movement-foundation", "Movement Foundation", "foundation", "Learn the patterns. Load is earned, not assumed.", 2, 0.7, "4–5 reps in reserve", 0.8,
    ["Each core pattern can be performed consistently", "Sessions finish without excessive soreness"],
    ["Program activated"], ["Each pattern completed at a consistent technique standard for two sessions"]),
  P("consistency", "Consistency", "accumulation", "Turn the sessions into a habit before adding anything.", 2, 0.8, "3–4 reps in reserve", 0.9,
    ["Attendance becomes reliable", "Loads rise gently on the easiest patterns"],
    ["Movement foundation complete"], ["Planned sessions completed for two consecutive weeks"]),
  P("volume-introduction", "Volume Introduction", "accumulation", "Add a small amount of weekly work now that the habit holds.", 3, 0.95, "3–4 reps in reserve", 1,
    ["Weekly set count rises modestly", "Work capacity improves"],
    ["Consistency complete"], ["Added volume tolerated without a drop in session quality"]),
  P("progression", "Progression", "intensification", "Progress load on the core patterns at a still-conservative effort.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Loads increase on every core pattern", "Confidence under the bar improves"],
    ["Volume introduction complete"], ["Load progression achieved on the core patterns"]),
  P("review", "Review", "assessment", "Look at what changed and choose the next step honestly.", 1, 0.75, "3–4 reps in reserve", 0.8,
    ["Progress is reviewed against the starting point"],
    ["Progression complete"], ["Next block selected with the athlete"], 1),
];

const CONTEST_PHASES: ProgramPhaseDefinition[] = [
  P("base", "Base", "foundation", "Establish training baselines and a starting condition record.", 2, 0.9, "2–3 reps in reserve", 0.9,
    ["Baseline condition and strength are documented"],
    ["Program activated", "Training age and base are adequate for a preparation block"], ["Baseline photos, measurements, and working loads recorded"]),
  P("build", "Build", "accumulation", "Accumulate the volume that will be defended later as calories fall.", 3, 1.05, "2–3 reps in reserve", 1,
    ["Weekly volume peaks here while fuel is highest"],
    ["Base complete"], ["Volume target reached with strength maintained"]),
  P("retention", "Retention", "intensification", "Hold strength and volume as the deficit deepens — the whole point of the block.", 3, 0.95, "2–3 reps in reserve", 1.2,
    ["Strength is defended rather than chased", "Conditioning progresses to carry expenditure"],
    ["Build complete"], ["Composition on track with strength within an acceptable band"]),
  P("presentation", "Presentation", "specialization", "Refine presentation work and manage late-phase fatigue.", 2, 0.8, "3–4 reps in reserve", 1.1,
    ["Presentation practice becomes consistent", "Volume reduces as recovery capacity falls"],
    ["Retention complete"], ["Presentation practice consistent and fatigue contained"]),
  P("peak", "Peak", "taper", "Reduce demand into the date.", 1, 0.6, "3–4 reps in reserve", 0.7,
    ["Fatigue clears into the target date"],
    ["Presentation complete"], ["Target date reached"]),
  ASSESSMENT("Record the final condition and plan the recovery block.", ["Final condition documented", "A structured return to maintenance is planned"]),
];

const SPECIALIZATION_PHASES: ProgramPhaseDefinition[] = [
  P("base-hold", "Base Hold", "foundation", "Confirm the base is credible before concentrating volume anywhere.", 1, 0.9, "3–4 reps in reserve", 0.9,
    ["Base sessions are consistent", "Priority-region starting measurements are recorded"],
    ["Program activated", "A priority region is selected"], ["Priority-region baseline recorded"]),
  P("priority-accumulation", "Priority Accumulation", "accumulation", "Raise weekly sets on the priority region while everything else drops to maintenance.", 3, 1.0, "2–3 reps in reserve", 0.8,
    ["Priority-region weekly sets rise substantially", "Non-priority regions hold at maintenance volume"],
    ["Base hold complete"], ["Priority set target sustained for two consecutive weeks"]),
  P("priority-overload", "Priority Overload", "intensification", "Push the priority region hardest while fatigue elsewhere is kept deliberately low.", 3, 1.1, "1–2 reps in reserve", 0.7,
    ["Priority-region load and effort peak", "Systemic fatigue stays contained by the maintenance base"],
    ["Priority accumulation complete"], ["Priority-region progression stalls, or the phase completes"]),
  DELOAD(0.6),
  P("exit-review", "Exit Review", "assessment", "Decide honestly whether the block worked and whether to continue or rotate.", 1, 0.8, "2–3 reps in reserve", 0.8,
    ["Priority-region change is measured against the baseline"],
    ["Deload complete"], ["Continue, rotate the priority, or return to balanced training"], 1),
];

const RECOVERY_PHASES: ProgramPhaseDefinition[] = [
  P("stabilise", "Stabilise", "foundation", "Find the demand the current week can genuinely absorb.", 2, 0.75, "4–5 reps in reserve", 0.7,
    ["Sessions complete without a next-day cost", "A sustainable baseline is found"],
    ["Program activated"], ["Two consecutive weeks completed without readiness decline"]),
  P("rebuild", "Rebuild", "accumulation", "Add work only where readiness has actually improved.", 3, 0.9, "3–4 reps in reserve", 0.85,
    ["Volume rises only when readiness supports it"],
    ["Stabilise complete", "Readiness trend flat or improving"], ["Added volume held for two weeks without readiness decline"]),
  P("consolidate", "Consolidate", "consolidation", "Hold the new level and confirm it is repeatable.", 2, 0.95, "3–4 reps in reserve", 0.9,
    ["The higher level becomes the new normal"],
    ["Rebuild complete"], ["Level sustained with stable readiness"]),
  P("review", "Review", "assessment", "Decide whether the recovery constraint has lifted.", 1, 0.8, "3–4 reps in reserve", 0.8,
    ["Sleep, readiness, and adherence are reviewed together"],
    ["Consolidate complete"], ["Either graduate to a standard architecture or continue here"], 1),
];

const LEAN_MASS_PHASES: ProgramPhaseDefinition[] = [
  P("foundation", "Foundation", "foundation", "Set the loads the surplus will be spent on.", 2, 0.85, "3–4 reps in reserve", 0.9,
    ["Working loads are established across every pattern"],
    ["Program activated"], ["Baseline loads logged"]),
  P("accumulation", "Accumulation", "accumulation", "Grow weekly volume while the surplus supports recovery.", 3, 1.05, "2–3 reps in reserve", 0.85,
    ["Weekly volume and body weight rise together at a controlled rate"],
    ["Foundation complete"], ["Volume target reached with weight gain inside the target band"]),
  P("overload", "Overload", "intensification", "Convert the surplus into load on the anchor lifts.", 3, 1.1, "1–2 reps in reserve", 0.8,
    ["Load increases across the anchor lifts"],
    ["Accumulation complete"], ["Load progression achieved, or gain rate exceeds the target band"]),
  P("consolidation", "Consolidation", "consolidation", "Hold the new size and confirm composition has not drifted.", 1, 0.85, "3–4 reps in reserve", 0.9,
    ["Weight stabilises and measurements are re-checked"],
    ["Overload complete"], ["Composition confirmed acceptable"]),
  DELOAD(0.7),
  ASSESSMENT("Re-measure and decide whether to continue the gain phase.", ["Size change and composition drift are both recorded"]),
];

const RECOMP_PHASES: ProgramPhaseDefinition[] = [
  P("foundation", "Foundation", "foundation", "Establish baselines on both sides — strength and measurement.", 2, 0.85, "3–4 reps in reserve", 0.9,
    ["Strength and measurement baselines exist for the comparison that follows"],
    ["Program activated"], ["Both baselines recorded"]),
  P("build", "Build", "accumulation", "Add resistance volume while calories stay controlled.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Working volume rises at a stable body weight"],
    ["Foundation complete"], ["Volume target held with weight stable"]),
  P("sharpen", "Sharpen", "intensification", "Raise intensity and conditioning while defending strength.", 3, 1.0, "1–2 reps in reserve", 1.15,
    ["Strength holds or rises while measurements move"],
    ["Build complete"], ["Measurement change achieved with strength retained"]),
  P("consolidation", "Consolidation", "consolidation", "Let the change settle and confirm it is real.", 1, 0.85, "3–4 reps in reserve", 0.9,
    ["Recovery is restored and the change is confirmed"],
    ["Sharpen complete"], ["Readiness restored"]),
  DELOAD(0.7),
  ASSESSMENT("Compare strength and measurements against the starting baselines.", ["Recomposition is judged on strength plus measurement, never the scale alone"]),
];

const TACTICAL_PHASES: ProgramPhaseDefinition[] = [
  P("durability-base", "Durability Base", "foundation", "Establish load tolerance before repeated-effort work begins.", 2, 0.85, "3–4 reps in reserve", 0.85,
    ["Carry and trunk capacity are baselined", "Joint response to loaded distance is observed"],
    ["Program activated"], ["Carries and loaded distance completed without next-day joint complaint"]),
  P("capacity-build", "Capacity Build", "accumulation", "Raise repeated-effort capacity and strength endurance together.", 3, 1.0, "2–3 reps in reserve", 1.2,
    ["Repeated efforts hold quality across more rounds", "Strength endurance improves"],
    ["Durability base complete"], ["Round count or carry distance target met"]),
  P("output-build", "Output Build", "intensification", "Increase intensity of the repeated-effort work while durability holds.", 3, 0.95, "1–2 reps in reserve", 1.3,
    ["Peak repeatable output rises"],
    ["Capacity build complete"], ["Output target met without a rise in joint complaint"]),
  P("consolidation", "Consolidation", "consolidation", "Reduce impact accumulation and hold the capacity.", 1, 0.8, "3–4 reps in reserve", 0.8,
    ["Impact load drops while capacity holds"],
    ["Output build complete"], ["Readiness restored"]),
  DELOAD(0.6),
  ASSESSMENT("Run the work-capacity test and record the result.", ["Repeatable work capacity is measured"]),
];

const HOME_PHASES: ProgramPhaseDefinition[] = [
  P("foundation", "Foundation", "foundation", "Establish the movements the available equipment actually supports.", 2, 0.85, "3–4 reps in reserve", 0.9,
    ["Every session runs inside the equipment's real limits"],
    ["Program activated"], ["Baseline reps and loads logged for the available equipment"]),
  P("rep-progression", "Rep Progression", "accumulation", "Progress reps first — the honest lever when load has a ceiling.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Rep targets rise at the same load"],
    ["Foundation complete"], ["Top of the rep range reached on the primary movements"]),
  P("tempo-and-range", "Tempo + Range", "intensification", "When load is capped, tempo, pauses, and range become the progression.", 3, 1.0, "1–2 reps in reserve", 0.95,
    ["Time under tension and range increase at a fixed load", "Unilateral variations raise effective load"],
    ["Rep progression complete"], ["Tempo and range standards met at the top of the rep range"]),
  P("density", "Density", "intensification", "Compress rest and raise work done per minute.", 2, 1.0, "1–2 reps in reserve", 1.1,
    ["The same work is completed in less time"],
    ["Tempo and range complete"], ["Density target met at technique standard"]),
  DELOAD(0.7),
  ASSESSMENT("Re-test reps, tempo standards, and density.", ["Progress is measured on the levers home training actually has"]),
];

const WOMENS_PHASES: ProgramPhaseDefinition[] = [
  P("foundation", "Foundation", "foundation", "Establish the week's rhythm and baseline loads across every exposure.", 2, 0.85, "3–4 reps in reserve", 0.9,
    ["Session rhythm and baseline loads are established"],
    ["Program activated"], ["Baseline loads logged across the week's exposures"]),
  P("accumulation", "Accumulation", "accumulation", "Grow weekly volume on the priority exposures.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Priority exposures carry more weekly sets", "Support work holds its frequency"],
    ["Foundation complete"], ["Volume target sustained for two consecutive weeks"]),
  P("progression", "Progression", "intensification", "Progress load and control on the priority patterns.", 3, 1.05, "1–2 reps in reserve", 0.95,
    ["Load rises on the priority patterns", "Control and lockout quality improve"],
    ["Accumulation complete"], ["Load progression achieved on the priority patterns"]),
  P("refinement", "Refinement", "specialization", "Sharpen detail work and posture while volume holds.", 2, 1.0, "1–2 reps in reserve", 0.9,
    ["Detail and posture work improve the line"],
    ["Progression complete"], ["Detail standards met, or the phase completes"]),
  DELOAD(0.7),
  ASSESSMENT("Re-measure and re-check the priority patterns.", ["Measurement and performance change are both recorded"]),
];

const LIFESTYLE_PHASES: ProgramPhaseDefinition[] = [
  P("restart", "Restart", "foundation", "Rebuild the habit with sessions that are easy to say yes to.", 2, 0.75, "4–5 reps in reserve", 0.8,
    ["Attendance restarts", "Sessions end feeling better than they started"],
    ["Program activated"], ["Two consecutive weeks of planned sessions completed"]),
  P("rhythm", "Rhythm", "accumulation", "Make the week predictable, then slightly fuller.", 3, 0.9, "3–4 reps in reserve", 1,
    ["The week becomes routine", "Work capacity improves"],
    ["Restart complete"], ["Rhythm sustained for three consecutive weeks"]),
  P("build", "Build", "intensification", "Add real progression now that the habit holds.", 3, 1.0, "2–3 reps in reserve", 1,
    ["Loads and conditioning both progress"],
    ["Rhythm complete"], ["Progression achieved across the core sessions"]),
  P("review", "Review", "assessment", "Decide what comes next.", 1, 0.85, "3–4 reps in reserve", 0.9,
    ["Progress and preference are reviewed together"],
    ["Build complete"], ["Next protocol chosen with the athlete"], 1),
];

const LOG_ONLY_PHASES: ProgramPhaseDefinition[] = [
  P("logging", "Logging", "foundation", "Reserve organizes what you record. It does not prescribe sessions here.", 1, 1, "Member-defined", 1,
    ["Training records are organized and reviewable"],
    ["Program activated"], ["Member changes to a prescribing protocol, or continues logging"]),
];

/* ─── Authoring helper ────────────────────────────────────────────────── */

type DNASpec = Omit<ProtocolDNA, "protocolId" | "architectureVersion" | "topology" | "stimulus"> & {
  topology: Omit<ProtocolDNA["topology"], "canonicalWeek" | "blueprintId" | "blueprintName">;
  stimulus: Omit<ProtocolDNA["stimulus"], "muscleFrequency" | "movementFrequency">;
};

function dna(protocolId: string, spec: DNASpec): ProtocolDNA {
  const def = PROTOCOL_LIBRARY.find((p) => p.id === protocolId) ?? null;
  const blueprint: SplitBlueprint =
    PROTOCOL_BLUEPRINTS[protocolId] ?? getBlueprintForProtocol(protocolId, def?.category ?? null);
  const week = blueprint.week.map((d) => ({ ...d, emphasis: [...d.emphasis] }));
  return {
    protocolId,
    architectureVersion: PROTOCOL_DNA_VERSION,
    identity: spec.identity,
    topology: {
      ...spec.topology,
      canonicalWeek: week,
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
    },
    stimulus: {
      ...spec.stimulus,
      muscleFrequency: deriveMuscleFrequency(week),
      movementFrequency: deriveMovementFrequency(week),
    },
    progression: spec.progression,
    fatigue: spec.fatigue,
    phases: spec.phases,
    nutrition: spec.nutrition,
    adaptation: spec.adaptation,
    personalization: spec.personalization,
    eligibility: spec.eligibility,
  };
}

/* ─── Shared adaptation rule sets ─────────────────────────────────────── */

const BASE_READINESS = [
  "Readiness below 50 for two consecutive days: drop the day's top set and hold volume rather than pushing load.",
  "Readiness below 40: convert the session to its recovery variant and keep the week's structure intact.",
  "Readiness above 75 with load progression stalled: allow the next planned load step early.",
];

const BASE_PAIN = [
  "Reported discomfort in a region removes the movements that load it and substitutes a pattern the athlete reports as comfortable. Reserve records the report; it does not assess or treat it.",
  "Discomfort persisting beyond two weeks pauses progression on that pattern and prompts a clinician conversation.",
];

const BASE_MISSED = [
  "One missed session: the week keeps its shape and the missed session's priority work is folded into the next matching day.",
  "Two or more missed sessions in a week: the week is treated as a reduced week and the phase does not advance.",
];

const BASE_SCHEDULE = [
  "A reduction in available days recompresses future weeks to the lower frequency, keeping the highest-priority identity days.",
  "A recurring outside activity is treated as real training load and future weeks are re-planned around it.",
];

const BASE_ADHERENCE = [
  "Adherence below 60% pauses volume progression — the plan is adjusted to what is actually being done.",
  "Adherence above 90% for two weeks unlocks the next planned progression step.",
];

/* ─── The registry ────────────────────────────────────────────────────── */

export const PROTOCOL_DNA: Record<string, ProtocolDNA> = {
  /* ── Classic Physique ───────────────────────────────────────────────── */
  "classic-physique-build": dna("classic-physique-build", {
    identity: {
      family: "classic-physique",
      primaryObjective: "Build classic proportion — shoulder-to-waist presentation with upper-chest, back-width, delt, and arm balance.",
      secondaryObjectives: ["Waist control", "Leg symmetry", "Posture and presentation"],
      intendedAthletes: ["Intermediate and advanced lifters chasing shape rather than a number", "Athletes with the recovery capacity for five quality sessions"],
      unsuitableAthletes: ["Early training age with no established base", "Athletes whose primary goal is maximal strength", "Athletes with fewer than four available days"],
    },
    topology: {
      supportedFrequencies: [4, 5],
      compressionRules: ["At four days the posterior-chain day merges into the lower-strength day; the upper-frame days are never dropped first."],
      expansionRules: ["A sixth day adds a second upper-frame detail exposure rather than another leg day."],
      schedulingPriorities: ["Upper-frame exposures before leg volume", "At least 48 hours between the two chest exposures"],
    },
    stimulus: {
      weeklySetRanges: { chest: [12, 18], back: [14, 20], delts: [12, 18], arms: [10, 16], quads: [8, 14], hamstrings: [8, 12], core: [6, 10] },
      intensityDistribution: "Roughly 25% strength-range work, 65% hypertrophy-range, 10% detail and pump work.",
      proximityToFailurePolicy: "Compound work at 2–3 reps in reserve; isolation and detail work taken to 0–1.",
      exerciseSelectionPolicy: "Movements chosen for the line they build — incline pressing, wide-grip pulling, lateral-biased delt work — rather than maximum load.",
    },
    progression: {
      model: "Volume accumulation into a specialization block, judged on measurement and photograph rather than load alone.",
      loadingProgression: "Add load only when the top of the rep range is reached at the required technique standard.",
      volumeProgression: "One working set per priority region every two weeks up to the range ceiling.",
      exerciseProgression: "Movements hold for a full phase, then rotate within the same pattern to refresh the stimulus.",
      advancementCriteria: ["Priority-region measurement or photograph improves", "Working loads hold or rise at the same rep target"],
      regressionCriteria: ["Session quality degrades for two consecutive weeks", "Readiness trends down while volume is at the ceiling"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue in the upper frame; the lower body carries less than a standard hypertrophy week.",
      systemicDemand: "moderate", lowerBodyInterference: "moderate", recoveryDemand: "moderate", impactDemand: "low",
    },
    phases: HYPERTROPHY_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Protein distributed across the day with carbohydrate concentrated around the upper-frame sessions.",
      recoveryDayPattern: "Protein held constant; carbohydrate reduced toward the lower end.",
      bodyCompositionSupport: "Controlled lean gain or recomposition — waist control is tracked alongside the upper-frame measurements.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Waist measurement rising faster than the upper-frame measurements shifts the phase toward recomposition rather than continued gain."],
      performanceTrendRules: ["Two consecutive stalls on the priority region trigger a movement rotation before a volume increase."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to advanced training age", "Moderate to high recovery capacity", "Four to six available days"],
      conditionalProfiles: ["Novice training age — the base architecture is fine, but the specialization phase is deferred", "Low recovery capacity — supported at four days only"],
      frequencySelectionRules: ["Five days when recovery capacity is moderate or better", "Four days when sleep is under six and a half hours or the job is physically demanding"],
      bodyCompositionRules: ["A higher body-fat starting point shifts the nutrition demand toward recomposition without changing the training topology."],
      recoveryScalingRules: ["Low recovery capacity removes the posterior-chain day before it removes an upper-frame exposure."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Balanced Hypertrophy ───────────────────────────────────────────── */
  "12-week-physique": dna("12-week-physique", {
    identity: {
      family: "balanced-hypertrophy",
      primaryObjective: "Even whole-body development with sustainable frequency and broad movement exposure.",
      secondaryObjectives: ["Repeatable progression", "Work capacity", "Evidence-driven check-ins"],
      intendedAthletes: ["Athletes whose weak points are not yet clearly established", "Anyone who wants a robust default rather than a specialization"],
      unsuitableAthletes: ["Athletes who need maximal strength specificity", "Athletes who need an endurance-priority week"],
    },
    topology: {
      supportedFrequencies: [3, 4, 5],
      compressionRules: ["At four days the posterior-chain conditioning day drops first, then the pull-hypertrophy day merges into the upper-strength day.", "The two strength days are never dropped first — they are the architecture's spine."],
      expansionRules: ["A sixth day adds a second lower exposure before adding upper volume, keeping the balance honest."],
      schedulingPriorities: ["Strength days early in the week", "At least one day between the two lower exposures"],
    },
    stimulus: {
      weeklySetRanges: { chest: [10, 16], back: [12, 18], delts: [9, 14], arms: [8, 14], quads: [10, 16], hamstrings: [8, 14], glutes: [8, 12], core: [6, 10] },
      intensityDistribution: "Roughly 30% strength-range, 60% hypertrophy-range, 10% conditioning.",
      proximityToFailurePolicy: "Compounds at 2–3 reps in reserve, isolation at 0–1.",
      exerciseSelectionPolicy: "One movement per pattern per session with broad exposure across the week — no region is left to leftovers.",
    },
    progression: {
      model: "Linear volume accumulation into a load-progression block, with weekly evidence check-ins.",
      loadingProgression: "Add load when the top of the rep range is cleanly reached on two consecutive exposures.",
      volumeProgression: "One set per region per two weeks up to the range ceiling.",
      exerciseProgression: "Movements hold through a phase and rotate at the phase boundary.",
      advancementCriteria: ["Load or reps improve on the majority of primary movements", "Weekly volume target sustained"],
      regressionCriteria: ["Session quality falls two weeks running", "Readiness declines while volume sits at the ceiling"],
    },
    fatigue: {
      localFatiguePattern: "Evenly distributed local fatigue; no region carries a disproportionate load.",
      systemicDemand: "moderate", lowerBodyInterference: "moderate", recoveryDemand: "moderate", impactDemand: "low",
    },
    phases: HYPERTROPHY_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Protein anchored at every meal, carbohydrate around the session.",
      recoveryDayPattern: "Protein constant, carbohydrate reduced.",
      bodyCompositionSupport: "Works in a surplus, at maintenance, or in a modest deficit — the topology does not need to change, only the fuel.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight falling faster than 1% of body weight per week reduces accessory volume before it touches the strength days."],
      performanceTrendRules: ["A stall across the majority of movements triggers the deload early rather than adding volume."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Novice to advanced", "Any recovery capacity — the frequency scales", "Three to six available days"],
      conditionalProfiles: ["Elite athletes with a clear weak point are usually better served by the specialization architecture"],
      frequencySelectionRules: ["Frequency follows available days directly, capped by recovery capacity"],
      bodyCompositionRules: ["Body composition changes the nutrition demand class, not the weekly structure."],
      recoveryScalingRules: ["Low recovery capacity drops to four days and removes the conditioning-biased posterior day."],
    },
    eligibility: {},
  }),

  /* ── Weak-Point Specialization ──────────────────────────────────────── */
  "reserve-specialization": dna("reserve-specialization", {
    identity: {
      family: "weak-point-specialization",
      primaryObjective: "Bring a specific lagging region up while the rest of the physique is deliberately held at maintenance.",
      secondaryObjectives: ["Fatigue containment", "A credible base that survives the block", "A defined exit"],
      intendedAthletes: ["Athletes with an established base and one clearly identified lagging region"],
      unsuitableAthletes: ["Athletes with no established base", "Athletes who have not identified a priority region", "Athletes who want balanced development right now"],
    },
    topology: {
      supportedFrequencies: [4, 5],
      compressionRules: ["The two priority exposures are never dropped — the base days compress first.", "At four days the posterior base merges into the lower base day."],
      expansionRules: ["A sixth day adds a third priority exposure only when recovery capacity is high."],
      schedulingPriorities: ["Priority exposure opens the week while fresh", "At least 48 hours between the two priority exposures"],
    },
    stimulus: {
      weeklySetRanges: { priority: [16, 24], chest: [6, 10], back: [8, 12], delts: [6, 10], quads: [8, 12], hamstrings: [6, 10], glutes: [6, 10] },
      intensityDistribution: "Roughly 20% strength-range on the base, 80% hypertrophy and detail work concentrated on the priority region.",
      proximityToFailurePolicy: "Priority-region work at 0–2 reps in reserve; maintenance work at 3–4 so it costs nothing it does not have to.",
      exerciseSelectionPolicy: "Three to four distinct movements for the priority region across the week; maintenance regions get one movement each.",
    },
    progression: {
      model: "Concentrated volume on the priority region with an explicit exit review — the block ends rather than drifting.",
      loadingProgression: "Priority region progresses on reps first, then load; maintenance regions hold load.",
      volumeProgression: "Priority sets rise weekly to the ceiling; maintenance sets never rise.",
      exerciseProgression: "Priority movements rotate once mid-block to change the stimulus angle.",
      advancementCriteria: ["Priority-region measurement or working load improves", "Maintenance regions hold their loads"],
      regressionCriteria: ["Maintenance regions start losing load — the block is costing more than it is buying", "Priority-region quality degrades"],
    },
    fatigue: {
      localFatiguePattern: "Very high local fatigue in the priority region; deliberately low everywhere else.",
      systemicDemand: "moderate", lowerBodyInterference: "low", recoveryDemand: "moderate", impactDemand: "none",
    },
    phases: SPECIALIZATION_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Carbohydrate concentrated around the two priority sessions.",
      recoveryDayPattern: "Protein constant, carbohydrate at the lower end.",
      bodyCompositionSupport: "Lean gain or maintenance. A meaningful deficit undercuts the point of a specialization block.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: ["A missed priority session is rescheduled inside the same week — the base days are what get sacrificed, never the priority."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["An aggressive deficit during a specialization block triggers a recommendation to change phase or protocol — the two goals fight."],
      performanceTrendRules: ["Maintenance regions losing load ends the block early."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to elite", "A named priority region", "Moderate or better recovery capacity"],
      conditionalProfiles: ["Novice athletes — balanced hypertrophy will produce more, faster"],
      frequencySelectionRules: ["Five days preferred; four days keeps both priority exposures and merges the base."],
      bodyCompositionRules: ["Deficits reduce the priority set ceiling rather than the exposure count."],
      recoveryScalingRules: ["Low recovery capacity reduces the priority set ceiling, not the number of exposures."],
    },
    eligibility: { minExperience: "intermediate", requiresWeakPointSelection: true },
  }),

  /* ── Contest Preparation ────────────────────────────────────────────── */
  "championship-physique": dna("championship-physique", {
    identity: {
      family: "contest-preparation",
      primaryObjective: "Arrive at a date in condition while defending the muscle and strength built beforehand.",
      secondaryObjectives: ["Muscle retention under a deficit", "Conditioning progression", "Presentation practice", "Late-phase fatigue management"],
      intendedAthletes: ["Advanced athletes with a real base and a date on the calendar", "Athletes prepared for high adherence demands"],
      unsuitableAthletes: ["Early training age", "Athletes without an established base", "Anyone who simply wants aggressive fat loss — the fat-loss architecture is the correct choice"],
    },
    topology: {
      supportedFrequencies: [5, 6],
      compressionRules: ["The upper-specialization day drops before any primary exposure.", "Never compress below five days — retention needs the frequency."],
      expansionRules: ["Additional exposure is added as conditioning, never as more lifting volume."],
      schedulingPriorities: ["Highest-glycogen days carry the leg work", "Presentation practice sits on the lowest-fatigue days"],
    },
    stimulus: {
      weeklySetRanges: { chest: [12, 18], back: [14, 20], delts: [12, 18], arms: [10, 16], quads: [10, 16], hamstrings: [10, 14], glutes: [8, 12], core: [8, 12] },
      intensityDistribution: "Roughly 30% strength-retention work, 60% hypertrophy, 10% detail — the strength work is the retention insurance.",
      proximityToFailurePolicy: "Retention compounds at 2–3 reps in reserve throughout; effort is not increased to compensate for falling calories.",
      exerciseSelectionPolicy: "Stable movement selection through the block. Novelty costs recovery that a deficit cannot pay for.",
    },
    progression: {
      model: "Volume peaks early while fuel is highest, then is defended as calories fall. Conditioning carries the progression instead.",
      loadingProgression: "Hold loads. Maintaining load in a deficit is progress.",
      volumeProgression: "Volume descends across the block by design — the retention phase reduces sets as recovery capacity falls.",
      exerciseProgression: "Movements are held constant from the retention phase onward.",
      conditioningProgression: "Conditioning duration rises before conditioning intensity does.",
      advancementCriteria: ["Composition on trend and working loads within an acceptable retention band"],
      regressionCriteria: ["Load loss beyond the retention band", "Readiness or sleep degrading week over week"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue early, then deliberately managed downward as recovery capacity falls with calories.",
      systemicDemand: "very-high", lowerBodyInterference: "high", recoveryDemand: "very-high", impactDemand: "low",
    },
    phases: CONTEST_PHASES,
    nutrition: {
      demandClass: "very-high",
      trainingDayPattern: "Protein held high throughout; carbohydrate concentrated around the highest-output sessions.",
      recoveryDayPattern: "Protein constant, carbohydrate lowest, hydration and electrolytes emphasised.",
      conditioningSupport: "Conditioning sessions are fuelled rather than fasted as the deficit deepens.",
      bodyCompositionSupport: "A progressive deficit toward a date, with strength retention as the honesty check on the rate.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Late-phase readiness decline reduces volume before it reduces food — training is the adjustable variable here."],
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight loss faster than 1% of body weight per week with strength falling reduces conditioning and volume rather than adding either."],
      performanceTrendRules: ["Strength falling outside the retention band pauses the deficit progression."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Advanced or elite", "High recovery capacity", "Five or six available days", "A dated target"],
      conditionalProfiles: ["Intermediate athletes with a genuine base and a distant date"],
      frequencySelectionRules: ["Six days when recovery capacity is high; five otherwise. Below five days, the fat-loss architecture is recommended instead."],
      bodyCompositionRules: ["A high starting body fat means the fat-loss architecture first — a preparation block starts from a base, not from the beginning."],
      recoveryScalingRules: ["Recovery capacity is the gate. Low recovery capacity makes this architecture inappropriate regardless of motivation."],
    },
    eligibility: { minExperience: "advanced", minTrainingAgeYears: 3 },
  }),

  /* ── Powerbuilding ──────────────────────────────────────────────────── */
  "reserve-powerbuilding": dna("reserve-powerbuilding", {
    identity: {
      family: "powerbuilding",
      primaryObjective: "Progress the squat, bench, hinge, and press measurably while building the muscle around each pattern.",
      secondaryObjectives: ["Hypertrophy accessories", "Work capacity", "Performance testing"],
      intendedAthletes: ["Intermediate and advanced lifters who want both numbers and size", "Athletes willing to log primary-lift performance"],
      unsuitableAthletes: ["Early training age with no lift competence", "Athletes who need an endurance-priority week", "Athletes with fewer than four available days"],
    },
    topology: {
      supportedFrequencies: [4, 5],
      compressionRules: ["The lower-hypertrophy day drops first, then the upper-hypertrophy day — the three top-set days are the architecture."],
      expansionRules: ["A sixth day adds a second press or pull exposure, never a second squat day."],
      schedulingPriorities: ["Each primary pattern gets its own day", "At least 72 hours between squat and hinge top sets"],
    },
    stimulus: {
      weeklySetRanges: { quads: [10, 16], hamstrings: [8, 14], chest: [10, 16], back: [12, 18], delts: [8, 14], arms: [6, 12], calves: [4, 8] },
      intensityDistribution: "Roughly 45% strength-range work on the primaries, 45% hypertrophy accessories, 10% conditioning.",
      proximityToFailurePolicy: "Top sets at 1–2 reps in reserve; back-off and accessory work at 1–3.",
      primaryLiftPolicy: "Squat, bench, hinge, and press each receive one dedicated top-set exposure per week, logged and progressed on measured performance.",
      exerciseSelectionPolicy: "Primary lift first, then accessories chosen specifically to support that pattern's weak range.",
    },
    progression: {
      model: "Strength accumulation into intensity development into realization, with hypertrophy volume inversely tracking primary-lift intensity.",
      loadingProgression: "Top sets progress on measured performance — a rep or a load step when the previous exposure met its standard.",
      volumeProgression: "Accessory volume rises during accumulation and falls during intensity development to pay for the load.",
      exerciseProgression: "Primaries never rotate within a block; accessories rotate at phase boundaries.",
      advancementCriteria: ["Top sets improve on at least three of four primary lifts", "Technique standard maintained"],
      regressionCriteria: ["Two consecutive stalls on the same primary lift", "Technique degrading at the top set"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue around whichever pattern the day owns; the rest of the body is comparatively fresh.",
      systemicDemand: "high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "low",
    },
    phases: POWERBUILDING_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "Carbohydrate concentrated before and after the top-set session; protein distributed.",
      recoveryDayPattern: "Protein constant, carbohydrate at the lower end.",
      bodyCompositionSupport: "Maintenance or a modest surplus. Strength progress and an aggressive deficit are a poor pairing.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness on a top-set day converts the top set to a repeat of last week's load rather than skipping the exposure."],
      painRules: BASE_PAIN,
      missedSessionRules: ["A missed top-set day is rescheduled inside the week — accessory days are what get dropped."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight falling while top sets fall reduces accessory volume and flags the deficit as the likely cause."],
      performanceTrendRules: ["Two stalls on a primary lift trigger a supplemental-variation change before a volume change."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to elite", "Logged strength markers", "Four or five available days"],
      conditionalProfiles: ["Athletes in a deficit — supported, but the strength expectation is retention rather than progression"],
      frequencySelectionRules: ["Five days when recovery capacity is moderate or better; four days keeps all four primary exposures and drops the hypertrophy days."],
      bodyCompositionRules: ["Higher body mass with knee or back discomfort shifts the squat exposure toward a lower-shear variation."],
      recoveryScalingRules: ["Low recovery capacity removes hypertrophy days before it removes a primary exposure."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Strength ───────────────────────────────────────────────────────── */
  "reserve-strength": dna("reserve-strength", {
    identity: {
      family: "strength",
      primaryObjective: "Maximal strength on specific lifts through specificity, planned intensity exposure, and skill practice.",
      secondaryObjectives: ["Lift execution quality", "Fatigue management", "Measured testing"],
      intendedAthletes: ["Athletes whose goal is a number on a specific lift", "Athletes who accept low exercise variety"],
      unsuitableAthletes: ["Athletes who want variety or a pump-led session", "Athletes whose primary goal is visible size", "Early training age without lift competence"],
    },
    topology: {
      supportedFrequencies: [3, 4],
      compressionRules: ["The press day merges into the bench day at three days. Squat and deadlift days are never merged."],
      expansionRules: ["A fifth day adds a second squat or bench exposure at reduced intensity, not a hypertrophy day."],
      schedulingPriorities: ["Full recovery between squat and deadlift", "Highest-intensity exposure on the freshest day of the week"],
    },
    stimulus: {
      weeklySetRanges: { quads: [8, 12], hamstrings: [6, 10], chest: [8, 12], back: [8, 12], delts: [6, 10], arms: [2, 6] },
      intensityDistribution: "Roughly 70% strength-range work, 25% supplemental variation, 5% supporting accessory work.",
      proximityToFailurePolicy: "Primary work at 1–3 reps in reserve and never to failure — failure costs the next exposure.",
      primaryLiftPolicy: "One primary lift per session with a planned intensity exposure, followed by its supplemental variation. No session has two primaries.",
      exerciseSelectionPolicy: "Deliberately narrow. Accessories exist only to support the primary lift's weak range, not to add volume.",
    },
    progression: {
      model: "Volume accumulation into planned intensity exposure into realization and testing.",
      loadingProgression: "Intensity rises on a planned schedule, not on feel. Missed standards repeat the exposure rather than advancing.",
      volumeProgression: "Set count falls as intensity rises — the trade is explicit.",
      exerciseProgression: "Primary lifts never change inside a block. Supplemental variations change once, at the intensity-phase boundary.",
      advancementCriteria: ["Planned intensity exposures completed at technique standard"],
      regressionCriteria: ["A missed planned exposure", "Technique breakdown at the top of a working set"],
    },
    fatigue: {
      localFatiguePattern: "Concentrated fatigue on the day's primary pattern; low overall muscular fatigue.",
      systemicDemand: "high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "none",
    },
    phases: STRENGTH_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Carbohydrate before the primary exposure; protein distributed across the day.",
      recoveryDayPattern: "Protein constant; carbohydrate moderate — recovery between heavy exposures matters more than a lean day.",
      bodyCompositionSupport: "Maintenance or a modest surplus. Deficits are supported but the goal shifts to retention.",
    },
    adaptation: {
      readinessRules: ["Readiness below 55 on a primary day drops the top intensity by one step and keeps the exposure.", "Readiness below 40 moves the exposure rather than deleting it."],
      painRules: BASE_PAIN,
      missedSessionRules: ["A missed primary exposure shifts the whole week rather than being skipped — the exposure schedule is the program."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Falling weight with falling top sets flags the deficit and pauses the intensity progression."],
      performanceTrendRules: ["Two missed planned exposures trigger an early deload rather than a push."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to elite", "Logged strength markers", "Three or four available days"],
      conditionalProfiles: ["Novice athletes — the foundation architecture builds the competence this one assumes"],
      frequencySelectionRules: ["Four days is the standard; three days merges press into bench and keeps the schedule."],
      bodyCompositionRules: ["Body composition does not change this topology — only the fuel and the expectation."],
      recoveryScalingRules: ["Low recovery capacity reduces the number of planned high-intensity exposures per block, not the session count."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Performance Hybrid ─────────────────────────────────────────────── */
  "reserve-athlete-hybrid": dna("reserve-athlete-hybrid", {
    identity: {
      family: "performance-hybrid",
      primaryObjective: "A protected bodybuilding core with athletic power, speed, and capacity layered around it.",
      secondaryObjectives: ["Power and explosive output", "Athletic capacity", "Movement quality", "Recovery discipline"],
      intendedAthletes: ["Athletes who want a physique that also performs", "Athletes with a sport or athletic background"],
      unsuitableAthletes: ["Athletes chasing maximal strength numbers", "Athletes who need endurance to lead the week"],
    },
    topology: {
      supportedFrequencies: [4, 5, 6],
      compressionRules: ["The Reserve Athlete day drops before any of the four builder days — the physique core is the floor."],
      expansionRules: ["Additional capacity is added to the athletic day rather than as a fifth lifting day."],
      schedulingPriorities: ["Builder days protected from athletic-day fatigue", "The athletic day sits after a recovery day"],
    },
    stimulus: {
      weeklySetRanges: { chest: [10, 16], back: [12, 18], delts: [8, 14], arms: [8, 12], quads: [10, 14], hamstrings: [8, 14], glutes: [8, 12], calves: [4, 8] },
      intensityDistribution: "Roughly 35% strength, 40% hypertrophy, 25% power and conditioning.",
      proximityToFailurePolicy: "Builder compounds at 2–3 reps in reserve; power work never taken near failure — speed is the quality being trained.",
      exerciseSelectionPolicy: "Builder days use standard hypertrophy selection; the athletic day uses explosive and multi-planar work.",
    },
    progression: {
      model: "Hypertrophy progression on the builder days with separate output progression on the athletic day.",
      loadingProgression: "Builder loads progress on rep-range completion; power work progresses on output, not load.",
      volumeProgression: "Builder volume rises through accumulation; athletic-day volume is capped by output quality.",
      exerciseProgression: "Builder movements rotate at phase boundaries; athletic-day movements rotate more freely.",
      conditioningProgression: "Athletic-day intensity rises before duration does.",
      advancementCriteria: ["Builder loads rise", "Athletic-day output rises or holds"],
      regressionCriteria: ["Builder quality falling because of athletic-day fatigue — the athletic day reduces first"],
    },
    fatigue: {
      localFatiguePattern: "Balanced upper and lower local fatigue with an additional systemic cost from the athletic day.",
      systemicDemand: "high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "moderate",
    },
    phases: HYPERTROPHY_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "Carbohydrate matched to the session type — highest on the athletic and lower-builder days.",
      recoveryDayPattern: "Protein constant, carbohydrate reduced, hydration emphasised.",
      conditioningSupport: "The athletic day is fuelled before and refuelled after.",
      bodyCompositionSupport: "Year-round lean — the architecture assumes maintenance or a small surplus rather than an aggressive deficit.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness reduces the athletic day before it touches a builder day."],
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Rapid weight loss reduces the athletic day's output demand first."],
      performanceTrendRules: ["Builder-day stalls that coincide with high athletic-day output reduce athletic volume, not builder volume."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to advanced", "Athletic or sport background", "Four to six available days"],
      conditionalProfiles: ["Low recovery capacity — supported at four days with the athletic day reduced to mobility"],
      frequencySelectionRules: ["The four builder days are the floor; days five and six are athletic and recovery."],
      bodyCompositionRules: ["Higher body mass with limited impact history reduces the athletic day's plyometric content."],
      recoveryScalingRules: ["Low recovery capacity converts the athletic day to a recovery-athlete day."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Tactical Hybrid ────────────────────────────────────────────────── */
  "reserve-tactical": dna("reserve-tactical", {
    identity: {
      family: "tactical-hybrid",
      primaryObjective: "Durability and repeatable work capacity under load.",
      secondaryObjectives: ["Loaded carries", "Strength endurance", "Repeated-effort capacity", "Trunk strength"],
      intendedAthletes: ["Athletes who need capacity that repeats day after day", "Athletes with load-carriage or occupational demands"],
      unsuitableAthletes: ["Athletes chasing maximal single-lift strength", "Athletes with current lower-limb discomfort", "Athletes whose goal is purely visual"],
    },
    topology: {
      supportedFrequencies: [4, 5, 6],
      compressionRules: ["The work-capacity day drops first, then the repeated-effort day. The strength and loaded-distance days are the identity."],
      expansionRules: ["Additional days add carries and trunk work rather than more running."],
      schedulingPriorities: ["Loaded distance never sits the day after the lower-durability day", "Repeated-effort work sits mid-week when readiness is highest"],
    },
    stimulus: {
      weeklySetRanges: { "full-body": [8, 14], chest: [6, 12], back: [8, 14], quads: [8, 12], hamstrings: [6, 12], core: [10, 16], carries: [6, 12] },
      intensityDistribution: "Roughly 35% strength, 20% hypertrophy, 45% conditioning and repeated-effort work.",
      proximityToFailurePolicy: "Strength-endurance sets stop with two clean reps left — form failure is the limit, not muscular failure.",
      exerciseSelectionPolicy: "Carries, unilateral work, and multi-joint movements chosen for transfer under load rather than isolation.",
    },
    progression: {
      model: "Capacity build into output build, progressed on rounds and carry distance rather than one-rep load.",
      loadingProgression: "Carry load rises only when the previous distance was completed without grip or posture failure.",
      volumeProgression: "Round count and carry distance rise before intensity does.",
      exerciseProgression: "Movements stay stable; the variables that move are load, distance, and rest.",
      conditioningProgression: "Work-to-rest ratio tightens before intensity rises.",
      advancementCriteria: ["More rounds or more carry distance at the same quality", "No rise in joint complaint"],
      regressionCriteria: ["Joint complaint rising", "Round quality falling within a session"],
    },
    fatigue: {
      localFatiguePattern: "Grip, trunk, and posterior chain carry the highest local fatigue.",
      systemicDemand: "very-high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "high",
    },
    phases: TACTICAL_PHASES,
    nutrition: {
      demandClass: "very-high",
      trainingDayPattern: "Carbohydrate available before repeated-effort and loaded-distance days; protein distributed.",
      recoveryDayPattern: "Protein constant; carbohydrate moderate — this architecture rarely earns a truly low day.",
      conditioningSupport: "Hydration and electrolytes emphasised around loaded distance and repeated-effort work.",
      bodyCompositionSupport: "Maintenance. Aggressive deficits and repeated-effort capacity do not coexist well.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness reduces round count before it reduces load."],
      painRules: [...BASE_PAIN, "Any reported lower-limb discomfort reduces loaded distance before anything else changes."],
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Falling weight with falling round counts reduces conditioning volume and flags fuelling."],
      performanceTrendRules: ["Falling round quality across two weeks triggers the consolidation phase early."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to advanced", "Some conditioning background", "Five or six available days", "No current lower-limb discomfort"],
      conditionalProfiles: ["Limited running history — loaded distance starts as loaded walking and progresses on tolerance"],
      frequencySelectionRules: ["Six days when recovery capacity is high; five otherwise; four keeps strength, loaded distance, and one repeated-effort day."],
      bodyCompositionRules: ["Higher body mass with limited impact history converts loaded distance to loaded walking rather than running."],
      recoveryScalingRules: ["Low recovery capacity is a poor match — the recovery-constrained architecture is recommended instead."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Grand Touring ──────────────────────────────────────────────────── */
  "reserve-grand-touring": dna("reserve-grand-touring", {
    identity: {
      family: "grand-touring",
      primaryObjective: "Physique development and distance capacity held together in one week, without either collapsing the other.",
      secondaryObjectives: ["Push / pull / lower physique work", "Outdoor distance", "Performance conditioning", "Work capacity"],
      intendedAthletes: ["Athletes who want meaningful muscle without giving up endurance or movement capacity", "Athletes with a week that changes and needs to adapt without losing its shape"],
      unsuitableAthletes: ["Athletes who need maximal strength specificity", "Athletes with current lower-limb discomfort that distance work would aggravate", "Athletes with fewer than four available days"],
    },
    topology: {
      supportedFrequencies: [4, 5, 6, 7],
      compressionRules: [
        "The extra upper and lower volume days drop first. The push, pull, posterior, outdoor-distance, and performance-conditioning days carry the hybrid identity and are protected.",
        "Compression never removes both conditioning exposures — a Grand Touring week without distance is not Grand Touring.",
      ],
      expansionRules: ["A seventh day adds the second lower exposure rather than a third conditioning day."],
      schedulingPriorities: [
        "Outdoor distance opens the week on the freshest legs",
        "Posterior lower work never sits the day before outdoor distance",
        "Performance conditioning sits between the two upper days",
      ],
    },
    stimulus: {
      weeklySetRanges: { chest: [9, 14], back: [10, 16], delts: [8, 12], arms: [6, 12], hamstrings: [8, 14], glutes: [8, 12], quads: [8, 14], calves: [4, 10] },
      intensityDistribution: "Roughly 25% strength, 45% hypertrophy, 30% conditioning and distance.",
      proximityToFailurePolicy: "Lifting compounds at 2–3 reps in reserve so distance quality survives; isolation at 0–1.",
      exerciseSelectionPolicy: "Physique-standard selection on the gym days, with lower-body movement chosen to avoid stacking eccentric damage before a distance day.",
    },
    progression: {
      model: "Capacity foundation into hybrid accumulation into integrated progression and output development — both qualities progress on their own terms.",
      loadingProgression: "Gym loads progress on rep-range completion, independently of the distance progression.",
      volumeProgression: "Lifting volume and weekly distance rise on separate schedules so a stall in one does not stall the other.",
      exerciseProgression: "Gym movements rotate at phase boundaries; distance work progresses on duration then quality.",
      conditioningProgression: "Weekly distance rises by roughly 10% per week during accumulation, then quality is added before further volume.",
      advancementCriteria: ["Both lifting loads and distance capacity improve or hold", "No rise in joint complaint"],
      regressionCriteria: ["Lifting quality falling because of distance fatigue", "Joint complaint rising with distance"],
    },
    fatigue: {
      localFatiguePattern: "Upper-body local fatigue from the push and pull days; lower-body fatigue shared between the posterior day and the distance work.",
      systemicDemand: "very-high", lowerBodyInterference: "high", recoveryDemand: "very-high", impactDemand: "high",
    },
    phases: GRAND_TOURING_PHASES,
    nutrition: {
      demandClass: "very-high",
      trainingDayPattern: "Carbohydrate protected around both the lifting and the distance sessions — this architecture cannot run on a low-carbohydrate week.",
      recoveryDayPattern: "Protein constant; carbohydrate moderate rather than low, because the next distance day depends on it.",
      conditioningSupport: "Hydration and electrolytes emphasised around long outdoor sessions; early-morning sessions get an easily digested pre-session carbohydrate.",
      bodyCompositionSupport: "Maintenance or a small deficit. A large deficit and hybrid output do not coexist.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness reduces distance duration before it reduces lifting volume — the physique core is the protected asset."],
      painRules: [...BASE_PAIN, "Reported knee, ankle, shin, or hip discomfort converts outdoor distance to a low-impact modality at the same duration."],
      missedSessionRules: ["A missed gym day folds into the next matching day. A missed distance day is not made up — distance load is not banked."],
      scheduleChangeRules: [...BASE_SCHEDULE, "A recurring lower-body class is treated as a lower-body exposure and the posterior day or distance day is adjusted accordingly."],
      bodyWeightTrendRules: ["Weight falling faster than 0.7 kg per week reduces distance progression first, because that is where the expenditure sits."],
      performanceTrendRules: ["Falling lifting output with rising distance triggers a distance hold rather than a lifting cut."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to advanced", "Some running or conditioning background", "Five to seven available days", "Moderate or better recovery capacity"],
      conditionalProfiles: [
        "Limited running history — the hybrid goal is preserved but the distance work starts on a low-impact modality and progresses on tolerance",
        "Higher body mass with no running history — same adaptation, and the progression rate is halved",
      ],
      frequencySelectionRules: [
        "Six days when recovery capacity is moderate or better",
        "At five days the second lower day drops; at four the second upper day drops too. Both conditioning exposures survive.",
      ],
      bodyCompositionRules: [
        "Body mass and running history together decide the distance modality, never body weight alone.",
        "A higher-mass athlete without running history receives the same weekly structure with cycling, incline walking, or rowing carrying the distance.",
      ],
      recoveryScalingRules: ["Low recovery capacity reduces distance duration and the performance-conditioning intensity before touching the physique days."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Endurance–Physique ─────────────────────────────────────────────── */
  "reserve-endurance-physique": dna("reserve-endurance-physique", {
    identity: {
      family: "endurance-physique",
      primaryObjective: "Aerobic development as the leading quality, with resistance training reduced to what protects muscle and strength.",
      secondaryObjectives: ["Mileage or duration progression", "Quality endurance sessions", "Muscle retention", "Interference management"],
      intendedAthletes: ["Athletes whose primary goal is endurance progression", "Athletes who refuse to lose the physique while chasing it"],
      unsuitableAthletes: ["Athletes whose primary goal is muscle gain — the interference is real and this architecture accepts it deliberately", "Athletes with current lower-limb discomfort"],
    },
    topology: {
      supportedFrequencies: [4, 5, 6],
      compressionRules: ["The easy aerobic day drops first, then a resistance day. The long effort and the quality session are the identity and are never both removed."],
      expansionRules: ["A seventh day adds easy aerobic volume, never a third resistance day."],
      schedulingPriorities: [
        "The long effort sits on the day with the most available time and the freshest legs",
        "Lower-body resistance work never sits the day before the quality session or the long effort",
      ],
    },
    stimulus: {
      weeklySetRanges: { chest: [6, 10], back: [8, 12], delts: [4, 8], arms: [4, 8], quads: [6, 10], hamstrings: [6, 10], glutes: [4, 8] },
      intensityDistribution: "Roughly 60% aerobic work, 30% muscle-retention resistance work, 10% quality endurance intensity.",
      proximityToFailurePolicy: "Resistance work stops at 3–4 reps in reserve throughout. Retention does not require failure and failure costs the next run.",
      exerciseSelectionPolicy: "Few movements, high stability, minimal eccentric damage — the resistance work must not compromise the next endurance session.",
    },
    progression: {
      model: "Aerobic base into mileage development into quality integration and a performance build, tapering into assessment.",
      loadingProgression: "Resistance loads hold. Retention is the goal, not progression.",
      volumeProgression: "Weekly aerobic volume rises by roughly 10% per week with a reduced week every fourth week.",
      exerciseProgression: "Resistance movements are held constant for the whole block.",
      conditioningProgression: "Duration first, then quality, then goal-specific pace.",
      advancementCriteria: ["Weekly aerobic volume target sustained without joint complaint", "Resistance loads retained"],
      regressionCriteria: ["Joint complaint rising with volume", "Resistance loads falling — muscle retention is failing"],
    },
    fatigue: {
      localFatiguePattern: "Lower-body local fatigue dominated by the aerobic work; upper-body fatigue deliberately minimal.",
      systemicDemand: "high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "high",
    },
    phases: ENDURANCE_PHASES,
    nutrition: {
      demandClass: "very-high",
      trainingDayPattern: "Carbohydrate availability before and after the quality session and the long effort; protein distributed for retention.",
      recoveryDayPattern: "Protein constant, carbohydrate moderate — glycogen for the next session matters more than a lean day.",
      conditioningSupport: "Hydration and electrolytes emphasised for long efforts; fuelling during efforts over ninety minutes.",
      bodyCompositionSupport: "Maintenance. Endurance progression under a real deficit reliably costs muscle.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness converts the quality session to easy aerobic work rather than cancelling it."],
      painRules: [...BASE_PAIN, "Reported lower-limb discomfort converts running volume to a low-impact modality at equivalent duration."],
      missedSessionRules: ["A missed long effort is not made up in the same week — aerobic load is not bankable."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight falling with aerobic volume rising flags underfuelling before it flags success."],
      performanceTrendRules: ["Resistance loads falling reduce aerobic volume — muscle retention is the constraint that defines this architecture."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Any training age with an endurance goal", "Existing running or cycling background", "Five or six available days"],
      conditionalProfiles: ["No running history — the architecture holds but the first phase runs entirely on low-impact modalities"],
      frequencySelectionRules: ["Six days at moderate or better recovery; five days drops the easy aerobic session; four keeps long, quality, and both resistance days."],
      bodyCompositionRules: ["Higher body mass without running history keeps the endurance goal and changes the modality, not the plan."],
      recoveryScalingRules: ["Low recovery capacity reduces the quality session's intensity first, then the long effort's duration."],
    },
    eligibility: { minExperience: "beginner" },
  }),

  /* ── Fat Loss ───────────────────────────────────────────────────────── */
  "ultimate-summer-shred": dna("ultimate-summer-shred", {
    identity: {
      family: "fat-loss",
      primaryObjective: "Reduce body fat while preserving muscle and strength, using recoverable conditioning rather than punishment.",
      secondaryObjectives: ["Muscle retention", "Sustainable expenditure", "Adherence"],
      intendedAthletes: ["Athletes at any training age whose primary goal is composition change", "Athletes who need the plan to survive a real week"],
      unsuitableAthletes: ["Athletes whose priority is maximal strength or size right now", "Athletes already very lean who need a preparation structure instead"],
    },
    topology: {
      supportedFrequencies: [3, 4, 5],
      compressionRules: ["The standalone conditioning day drops first — conditioning attached to lifting days survives. Resistance sessions are the muscle-retention floor."],
      expansionRules: ["Extra days add low-impact expenditure, never more high-intensity conditioning."],
      schedulingPriorities: ["Resistance quality protected first", "Conditioning placed so it never precedes the heaviest lower session"],
    },
    stimulus: {
      weeklySetRanges: { chest: [9, 14], back: [10, 16], delts: [8, 12], arms: [6, 10], quads: [8, 14], hamstrings: [8, 12], glutes: [6, 12], core: [8, 14] },
      intensityDistribution: "Roughly 20% strength-retention work, 45% hypertrophy, 35% conditioning.",
      proximityToFailurePolicy: "Compounds at 2–3 reps in reserve. Effort is not raised to compensate for a deficit — that trades muscle for fatigue.",
      exerciseSelectionPolicy: "Stable, familiar movement selection. Novelty costs recovery a deficit cannot afford.",
    },
    progression: {
      model: "Adherence first, then work capacity, then deficit progression with fatigue management built in as its own phase.",
      loadingProgression: "Hold loads. Maintaining load in a deficit is the win condition.",
      volumeProgression: "Resistance volume holds; expenditure progresses instead.",
      exerciseProgression: "Movements held constant across the block.",
      conditioningProgression: "Low-impact duration first, then frequency, then intensity — and only if recovery supports it.",
      advancementCriteria: ["Composition trend moving with loads retained", "Adherence above 80%"],
      regressionCriteria: ["Loads falling more than one step across multiple movements", "Readiness or sleep degrading"],
    },
    fatigue: {
      localFatiguePattern: "Moderate local fatigue everywhere with an additional systemic cost from the deficit itself.",
      systemicDemand: "high", lowerBodyInterference: "moderate", recoveryDemand: "high", impactDemand: "moderate",
    },
    phases: FAT_LOSS_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "Protein highest priority at every meal; carbohydrate concentrated around the resistance session.",
      recoveryDayPattern: "Protein constant, carbohydrate lowest, volume of food maintained through vegetables and hydration.",
      conditioningSupport: "Conditioning is fuelled rather than fasted once the deficit is established.",
      bodyCompositionSupport: "A controlled deficit judged on weekly trend, with strength retention as the rate check.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness reduces conditioning before it reduces resistance work."],
      painRules: BASE_PAIN,
      missedSessionRules: ["Missed conditioning is not made up. Missed resistance sessions are rescheduled — retention depends on them."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: [
        "Weight falling faster than 1% of body weight per week with strength declining reduces conditioning demand and non-essential volume, adds recovery support, and prompts a review of intake. It never adds more training.",
        "Weight stable with high adherence, stable recovery, and maintained performance permits a small intake adjustment, a step-target adjustment, or a modest conditioning progression — one lever at a time.",
        "Weight stable while strength and measurements improve is recomposition, not failure, and no change is made.",
      ],
      performanceTrendRules: ["Strength falling across multiple movements pauses the deficit progression."],
      adherenceRules: [...BASE_ADHERENCE, "Adherence below 60% reduces the plan's demands rather than restating them."],
    },
    personalization: {
      preferredAthleteProfiles: ["Any training age", "Three to five available days", "A stated composition goal"],
      conditionalProfiles: ["Very lean advanced athletes — the preparation architecture handles the late stages better"],
      frequencySelectionRules: ["Frequency follows availability. A higher body weight does not earn more training days — it changes the conditioning modality."],
      bodyCompositionRules: [
        "A higher-body-weight athlete with low conditioning tolerance receives low-impact expenditure and full resistance quality, progressed gradually.",
        "An advanced lean athlete cutting receives higher training specificity, stable movement selection, and volume scaled to recovery and performance.",
      ],
      recoveryScalingRules: ["Low recovery capacity removes the standalone conditioning day first."],
    },
    eligibility: {},
  }),

  /* ── Beginner ───────────────────────────────────────────────────────── */
  "reserve-foundation": dna("reserve-foundation", {
    identity: {
      family: "beginner",
      primaryObjective: "Learn the core movement patterns and build a training habit that survives.",
      secondaryObjectives: ["Technique development", "Consistency", "Conservative fatigue"],
      intendedAthletes: ["Early training age", "Athletes returning after a long absence", "Athletes with no established weak points yet"],
      unsuitableAthletes: ["Athletes with an established base who need progression density"],
    },
    topology: {
      supportedFrequencies: [2, 3, 4],
      compressionRules: ["At two days the full-body session drops and the lower and upper sessions each absorb one composite movement."],
      expansionRules: ["A fourth day repeats the lower session rather than introducing a new one — repetition is the training effect at this stage."],
      schedulingPriorities: ["At least one full day between sessions", "No two training days back to back"],
    },
    stimulus: {
      weeklySetRanges: { quads: [6, 10], hamstrings: [4, 8], glutes: [4, 8], chest: [6, 10], back: [6, 10], delts: [4, 6], arms: [2, 6], core: [4, 8] },
      intensityDistribution: "Roughly 60% technique-focused strength work, 30% controlled hypertrophy, 10% easy conditioning.",
      proximityToFailurePolicy: "Everything at 3–5 reps in reserve. Failure teaches nothing at this stage and costs the next session.",
      exerciseSelectionPolicy: "One movement per pattern, repeated every week. Variety is deliberately withheld until the pattern is owned.",
    },
    progression: {
      model: "Movement foundation into consistency into a small volume increase and only then load progression.",
      loadingProgression: "Load rises only after the technique standard is met across all sets for two consecutive sessions.",
      volumeProgression: "One set added per session every three weeks at most.",
      exerciseProgression: "Movements do not rotate inside the block. Repetition is the point.",
      advancementCriteria: ["Technique standard held across all sets", "Two consecutive weeks of complete attendance"],
      regressionCriteria: ["Technique degrading under load", "Soreness interfering with the next session"],
    },
    fatigue: {
      localFatiguePattern: "Low local fatigue by design; early soreness is expected and planned around.",
      systemicDemand: "low", lowerBodyInterference: "low", recoveryDemand: "low", impactDemand: "low",
    },
    phases: BEGINNER_PHASES,
    nutrition: {
      demandClass: "low",
      trainingDayPattern: "A protein anchor at each meal and consistent meal timing. Nothing more complex is required yet.",
      recoveryDayPattern: "The same structure — consistency matters more than day-type variation at this stage.",
      bodyCompositionSupport: "Works in any phase. The training does not change; the intake does.",
    },
    adaptation: {
      readinessRules: ["Low readiness reduces the working load and keeps the session — attendance is the habit being built."],
      painRules: BASE_PAIN,
      missedSessionRules: ["A missed session is simply moved. The week is never doubled up to compensate."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Body-weight trend does not alter this architecture. Training changes come from technique and consistency, not the scale."],
      performanceTrendRules: ["Progression is gated on technique, never on how motivated the athlete feels."],
      adherenceRules: ["Adherence below 60% simplifies the plan further rather than demanding more."],
    },
    personalization: {
      preferredAthleteProfiles: ["Training age under two years", "Two to four available days", "Any recovery capacity"],
      conditionalProfiles: ["Motivated beginners requesting a six-day plan — the answer is a better three-day plan, and Reserve will say so"],
      frequencySelectionRules: ["Three days is the standard. Four is permitted; more is not, regardless of stated motivation."],
      bodyCompositionRules: ["Body composition changes nutrition guidance only. The training stays a beginner plan."],
      recoveryScalingRules: ["Already conservative. Low recovery capacity drops to two days rather than reducing quality."],
    },
    eligibility: {},
  }),

  /* ── Recovery Constrained ───────────────────────────────────────────── */
  "reserve-restored": dna("reserve-restored", {
    identity: {
      family: "recovery-constrained",
      primaryObjective: "Make real progress under a genuine recovery ceiling instead of pretending the ceiling is not there.",
      secondaryObjectives: ["Reduced overlapping fatigue", "Efficient selection", "Readiness-sensitive volume"],
      intendedAthletes: ["Athletes with poor sleep, high work stress, current discomfort, or limited recovery", "Athletes whose weeks are unpredictable"],
      unsuitableAthletes: ["Athletes with high recovery capacity who would progress faster elsewhere"],
    },
    topology: {
      supportedFrequencies: [2, 3, 4],
      compressionRules: ["The lower-density day drops first, then the upper-density day. The two quality days are the floor."],
      expansionRules: ["A fifth day is not offered — the architecture exists because the ceiling is real."],
      schedulingPriorities: ["A full recovery day between every session in the first half of the week", "No two systemic sessions back to back"],
    },
    stimulus: {
      weeklySetRanges: { chest: [6, 10], back: [8, 12], delts: [4, 8], arms: [4, 8], quads: [6, 10], hamstrings: [6, 10], glutes: [4, 8], core: [4, 8] },
      intensityDistribution: "Roughly 45% strength, 45% hypertrophy, 10% easy conditioning.",
      proximityToFailurePolicy: "Everything at 3–4 reps in reserve. Under a recovery ceiling, proximity to failure is the most expensive variable available.",
      exerciseSelectionPolicy: "Efficient composite movements with low setup cost and low systemic demand — machine and supported variations preferred.",
    },
    progression: {
      model: "Stabilise, then rebuild only where readiness has improved, then consolidate and review.",
      loadingProgression: "Load rises only when the previous two weeks completed without a readiness decline.",
      volumeProgression: "Volume is gated on readiness trend, not on the calendar.",
      exerciseProgression: "Movements stay constant — familiarity reduces cost.",
      advancementCriteria: ["Two consecutive weeks completed with a flat or improving readiness trend"],
      regressionCriteria: ["Any readiness decline across a week", "Sleep falling further"],
    },
    fatigue: {
      localFatiguePattern: "Deliberately low local fatigue with wide spacing between exposures.",
      systemicDemand: "low", lowerBodyInterference: "low", recoveryDemand: "low", impactDemand: "none",
    },
    phases: RECOVERY_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Protein anchored and calories steady. An aggressive deficit alongside a recovery ceiling is a poor combination.",
      recoveryDayPattern: "Identical structure — predictability reduces one more source of strain.",
      bodyCompositionSupport: "Maintenance or a small deficit only, with the deficit paused if readiness declines.",
    },
    adaptation: {
      readinessRules: [
        "Readiness below 50 reduces the session to its two highest-value movements and keeps the athlete in the room.",
        "Readiness above 70 for a full week permits the next volume step.",
      ],
      painRules: BASE_PAIN,
      missedSessionRules: ["Missed sessions are never doubled up. The week is simply shorter."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight falling while readiness declines pauses the deficit before it touches training."],
      performanceTrendRules: ["No progression is applied while the readiness trend is negative, regardless of how the numbers look."],
      adherenceRules: ["Low adherence reduces the plan to two sessions rather than restating four."],
    },
    personalization: {
      preferredAthleteProfiles: ["Low recovery capacity", "Under six and a half hours of sleep", "High occupational or life demand", "Two to four available days"],
      conditionalProfiles: ["High-capacity athletes in a temporary constrained period — appropriate as a bridge, not a destination"],
      frequencySelectionRules: ["Frequency follows readiness, not availability. Four days is the ceiling here."],
      bodyCompositionRules: ["Composition goals are supported but never at the cost of the recovery ceiling."],
      recoveryScalingRules: ["This architecture IS the recovery scaling. Its floor is two quality sessions."],
    },
    eligibility: {},
  }),

  /* ── Home Gym ───────────────────────────────────────────────────────── */
  "at-home-warrior": dna("at-home-warrior", {
    identity: {
      family: "home-gym",
      primaryObjective: "Real progression inside a hard load ceiling, using the levers home training actually has.",
      secondaryObjectives: ["Unilateral progression", "Tempo and range", "Density"],
      intendedAthletes: ["Athletes training at home with limited equipment", "Athletes who need setup time to be part of the plan"],
      unsuitableAthletes: ["Athletes with full gym access who would progress faster on load"],
    },
    topology: {
      supportedFrequencies: [3, 4, 5],
      compressionRules: ["The full-body conditioning day drops first. The lower, push, and pull days are the architecture."],
      expansionRules: ["A fifth day adds a unilateral lower session rather than more upper volume."],
      schedulingPriorities: ["Minimal equipment changeover within a session", "Lower days separated by at least 48 hours"],
    },
    stimulus: {
      weeklySetRanges: { quads: [10, 16], glutes: [8, 14], hamstrings: [8, 12], chest: [10, 16], back: [10, 16], delts: [6, 12], arms: [6, 12], core: [8, 14] },
      intensityDistribution: "Roughly 30% strength-range unilateral work, 60% hypertrophy at higher reps, 10% conditioning.",
      proximityToFailurePolicy: "Closer to failure than a full-gym plan — 0–2 reps in reserve — because load cannot carry the stimulus.",
      exerciseSelectionPolicy: "Unilateral variations, tempo work, paused reps, and extended-range positions selected to make a capped load sufficient.",
    },
    progression: {
      model: "Rep progression first, then tempo and range, then density — the three levers that exist when load has a ceiling.",
      loadingProgression: "Load rises only when equipment allows; otherwise the progression is reps, tempo, range, or rest.",
      volumeProgression: "Reps rise inside the range before sets are added.",
      exerciseProgression: "Progress to a harder unilateral or leverage variation when the top of the rep range is reached at full range.",
      advancementCriteria: ["Top of the rep range reached at the tempo and range standard"],
      regressionCriteria: ["Range or tempo standard slipping to hit a rep target"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue from proximity to failure; low systemic demand from light absolute loads.",
      systemicDemand: "low", lowerBodyInterference: "moderate", recoveryDemand: "moderate", impactDemand: "low",
    },
    phases: HOME_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Protein anchored; carbohydrate around the session.",
      recoveryDayPattern: "Protein constant, carbohydrate lower.",
      bodyCompositionSupport: "Any phase. The equipment constraint does not change the nutrition logic.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: [...BASE_SCHEDULE, "A change in available equipment re-selects the movements and can change the progression lever for future weeks."],
      bodyWeightTrendRules: ["Weight trend changes the nutrition demand, not the progression lever."],
      performanceTrendRules: ["A stall at the top of the rep range advances the variation rather than adding sets."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Any training age", "Limited equipment", "Three to five available days"],
      conditionalProfiles: ["Advanced athletes with strength goals — a load ceiling limits what this architecture can deliver, and Reserve says so up front"],
      frequencySelectionRules: ["Four days is the standard; three keeps lower, push, and pull."],
      bodyCompositionRules: ["Composition goals change fuel and conditioning volume, not the progression model."],
      recoveryScalingRules: ["Low recovery capacity reduces proximity to failure before reducing session count."],
    },
    eligibility: {},
  }),

  /* ── Lean Mass ──────────────────────────────────────────────────────── */
  "lean-bulk-command": dna("lean-bulk-command", {
    identity: {
      family: "lean-mass",
      primaryObjective: "Add size while keeping fat gain controlled, driven by load progression on the anchor lifts.",
      secondaryObjectives: ["Strength progression", "Condition retention"],
      intendedAthletes: ["Athletes ready to spend a surplus on training rather than on the scale"],
      unsuitableAthletes: ["Athletes whose priority is composition reduction right now"],
    },
    topology: {
      supportedFrequencies: [4, 5],
      compressionRules: ["The posterior-chain day merges into the heavy lower day at four days."],
      expansionRules: ["A sixth day adds an arm and delt detail session."],
      schedulingPriorities: ["Heavy days early in the week", "48 hours between pressing exposures"],
    },
    stimulus: {
      weeklySetRanges: { chest: [12, 18], back: [12, 18], delts: [8, 14], arms: [8, 14], quads: [10, 16], hamstrings: [8, 14], calves: [4, 10] },
      intensityDistribution: "Roughly 35% strength-range, 60% hypertrophy, 5% conditioning.",
      proximityToFailurePolicy: "Compounds at 2–3 reps in reserve; isolation at 0–1.",
      exerciseSelectionPolicy: "Heavy compound first on every day, with accessory work chosen to add volume to the same region.",
    },
    progression: {
      model: "Volume accumulation into load overload, with weight-gain rate as the governor.",
      loadingProgression: "Add load when the top of the rep range is reached on two consecutive exposures.",
      volumeProgression: "Sets rise to the ceiling through accumulation and hold through overload.",
      exerciseProgression: "Compounds hold; accessories rotate at phase boundaries.",
      advancementCriteria: ["Load progression across the anchor lifts", "Weight gain inside the target band"],
      regressionCriteria: ["Weight gain outside the band with no load progression — the surplus is not going to training"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue across all regions; the surplus makes it recoverable.",
      systemicDemand: "high", lowerBodyInterference: "moderate", recoveryDemand: "moderate", impactDemand: "none",
    },
    phases: LEAN_MASS_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "Controlled surplus with carbohydrate concentrated around training.",
      recoveryDayPattern: "Surplus reduced toward maintenance; protein constant.",
      bodyCompositionSupport: "Controlled surplus judged on the gain rate and on whether the gain is showing up in the lifts.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: [
        "Weight rising faster than the target band with unfavourable measurement movement and no performance improvement prompts a review of the surplus, adherence quality, activity changes, recovery, and the training stimulus — in that order.",
        "Productive resistance training is never reduced first in response to a gain-rate problem.",
      ],
      performanceTrendRules: ["Weight rising without load progression means the surplus is the problem, not the training."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Novice to advanced", "Four or five available days", "Moderate or better recovery capacity"],
      conditionalProfiles: ["Athletes at higher body fat — recomposition usually serves them better first, and Reserve will say so"],
      frequencySelectionRules: ["Five days when recovery capacity allows; four otherwise."],
      bodyCompositionRules: ["A higher starting body fat shifts the recommendation toward recomposition before a gain phase."],
      recoveryScalingRules: ["Low recovery capacity reduces the set ceiling rather than the session count."],
    },
    eligibility: {},
  }),

  /* ── Recomposition ──────────────────────────────────────────────────── */
  "recomp-protocol": dna("recomp-protocol", {
    identity: {
      family: "recomposition",
      primaryObjective: "Build muscle and reduce fat simultaneously, judged on strength and measurement rather than on the scale.",
      secondaryObjectives: ["Strength retention", "Conditioning", "Measurement trend"],
      intendedAthletes: ["Athletes at a moderate body fat with room to move in both directions", "Athletes who can commit to protein and adherence"],
      unsuitableAthletes: ["Athletes needing rapid composition change for a near date"],
    },
    topology: {
      supportedFrequencies: [3, 4],
      compressionRules: ["The conditioning-biased posterior day drops first."],
      expansionRules: ["A fifth day adds a second lower exposure."],
      schedulingPriorities: ["Strength days ahead of hypertrophy days", "Conditioning placed clear of lower-body recovery"],
    },
    stimulus: {
      weeklySetRanges: { chest: [9, 14], back: [10, 16], delts: [6, 12], arms: [6, 12], quads: [8, 14], hamstrings: [8, 12], glutes: [6, 10], core: [6, 10] },
      intensityDistribution: "Roughly 35% strength, 40% hypertrophy, 25% conditioning.",
      proximityToFailurePolicy: "Compounds at 2–3 reps in reserve; isolation at 0–1.",
      exerciseSelectionPolicy: "Composite sessions covering every region twice weekly at a frequency four days can actually deliver.",
    },
    progression: {
      model: "Build at stable weight, then sharpen intensity, judged on strength plus measurement.",
      loadingProgression: "Load progresses normally — in a recomposition, strength progress is the proof.",
      volumeProgression: "Sets rise through the build phase and hold through sharpening.",
      exerciseProgression: "Movements rotate at phase boundaries.",
      advancementCriteria: ["Strength rising with weight stable", "Measurements moving favourably"],
      regressionCriteria: ["Strength falling — the deficit has gone too deep for a recomposition"],
    },
    fatigue: {
      localFatiguePattern: "Balanced local fatigue with a moderate conditioning cost.",
      systemicDemand: "moderate", lowerBodyInterference: "moderate", recoveryDemand: "moderate", impactDemand: "low",
    },
    phases: RECOMP_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "High protein with carbohydrate concentrated around training; calories near maintenance.",
      recoveryDayPattern: "Protein constant, calories slightly below maintenance.",
      bodyCompositionSupport: "Near maintenance calories with a high protein anchor — the slowest but most durable route.",
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: [
        "A stable scale is the expected outcome here, not a failure. Progress is read from strength, measurements, and photographs.",
        "Weight falling steadily means this has become a deficit and the protocol recommendation is re-evaluated.",
      ],
      performanceTrendRules: ["Strength falling while weight is stable means intake is too low for the training being done."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Novice to advanced", "Three to five available days", "Moderate body fat"],
      conditionalProfiles: ["Very lean athletes — a gain phase produces more", "Very high body fat — a fat-loss phase produces more, faster"],
      frequencySelectionRules: ["Four days is the standard; three keeps both strength days and one hypertrophy day."],
      bodyCompositionRules: ["Body-fat level decides whether recomposition is the right call at all — this is where it is checked."],
      recoveryScalingRules: ["Low recovery capacity removes the conditioning day first."],
    },
    eligibility: {},
  }),

  /* ── High-Performance Hypertrophy (athletic hypertrophy) ────────────── */
  "high-performance-hypertrophy": dna("high-performance-hypertrophy", {
    identity: {
      family: "performance-hybrid",
      primaryObjective: "Methodical muscle gain built on power and movement quality, with exposure tracking to prevent plateaus.",
      secondaryObjectives: ["Plateau prevention", "Exposure tracking", "Athletic movement quality"],
      intendedAthletes: ["Athletes who want size but refuse to lose athleticism", "Athletes who respond to rotation and variety"],
      unsuitableAthletes: ["Athletes who need maximal strength specificity", "Athletes who need an endurance-priority week"],
    },
    topology: {
      supportedFrequencies: [4, 5],
      compressionRules: ["The upper athletic-hypertrophy day drops first; the power and strength days are the identity."],
      expansionRules: ["A sixth day adds conditioning rather than lifting volume."],
      schedulingPriorities: ["Power work on the freshest day", "Conditioning separated from the power day"],
    },
    stimulus: {
      weeklySetRanges: { chest: [9, 14], back: [10, 16], delts: [8, 12], arms: [6, 12], quads: [10, 14], hamstrings: [8, 14], glutes: [6, 12], power: [6, 10] },
      intensityDistribution: "Roughly 40% strength and power, 45% hypertrophy, 15% conditioning.",
      proximityToFailurePolicy: "Power work never near failure; hypertrophy compounds at 2–3 reps in reserve; isolation at 0–1.",
      exerciseSelectionPolicy: "Deliberate movement rotation across blocks with exposure counts tracked to keep the stimulus novel.",
    },
    progression: {
      model: "Overload with tracked exposure counts and scheduled rotation before staleness sets in.",
      loadingProgression: "Load progresses within a movement until its exposure count reaches the rotation threshold.",
      volumeProgression: "Volume rises through accumulation and holds through overload.",
      exerciseProgression: "Movements rotate on exposure count rather than on the calendar.",
      advancementCriteria: ["Load or output rising on the tracked movements"],
      regressionCriteria: ["Exposure count high with no progression — rotate rather than push"],
    },
    fatigue: {
      localFatiguePattern: "Balanced local fatigue with additional neural cost from the power work.",
      systemicDemand: "high", lowerBodyInterference: "high", recoveryDemand: "high", impactDemand: "moderate",
    },
    phases: HYPERTROPHY_PHASES,
    nutrition: {
      demandClass: "high",
      trainingDayPattern: "Carbohydrate around the power and lower days; protein distributed.",
      recoveryDayPattern: "Protein constant, carbohydrate reduced.",
      bodyCompositionSupport: "Maintenance or a small surplus — power output degrades quickly in a deficit.",
    },
    adaptation: {
      readinessRules: [...BASE_READINESS, "Low readiness removes the power work and keeps the strength work."],
      painRules: BASE_PAIN,
      missedSessionRules: BASE_MISSED,
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Falling weight with falling power output flags underfuelling."],
      performanceTrendRules: ["A stall triggers a rotation before a volume increase."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Intermediate to advanced", "Four or five available days", "Athletic background"],
      conditionalProfiles: ["Beginners — the foundation architecture teaches what this one assumes"],
      frequencySelectionRules: ["Five days when recovery allows; four otherwise."],
      bodyCompositionRules: ["Higher body mass with limited impact history reduces the plyometric content of the power day."],
      recoveryScalingRules: ["Low recovery capacity removes the power work before the hypertrophy work."],
    },
    eligibility: { minExperience: "novice" },
  }),

  /* ── Lifestyle ──────────────────────────────────────────────────────── */
  "lifestyle-reset": dna("lifestyle-reset", {
    identity: {
      family: "lifestyle",
      primaryObjective: "Rebuild a sustainable training habit with sessions that are easy to keep saying yes to.",
      secondaryObjectives: ["Consistency", "General conditioning", "Sustainable rhythm"],
      intendedAthletes: ["Athletes restarting after a break", "Athletes for whom consistency is the actual problem"],
      unsuitableAthletes: ["Athletes with an established habit who need progression density"],
    },
    topology: {
      supportedFrequencies: [2, 3],
      compressionRules: ["At two days the third full-body session drops; the remaining two keep full coverage."],
      expansionRules: ["A fourth day is a conditioning or walking day, not a fourth lift."],
      schedulingPriorities: ["A full day between every session", "Walking and mobility fill the gaps"],
    },
    stimulus: {
      weeklySetRanges: { "full-body": [12, 18], core: [4, 8] },
      intensityDistribution: "Roughly 40% strength, 20% hypertrophy, 40% easy conditioning and walking.",
      proximityToFailurePolicy: "Everything at 3–5 reps in reserve. Sessions end feeling better than they started.",
      exerciseSelectionPolicy: "The same handful of full-body movements each session — low decision cost is part of the design.",
    },
    progression: {
      model: "Habit first, rhythm second, progression third. Nothing is added until attendance is reliable.",
      loadingProgression: "Small load increases once the rhythm phase completes.",
      volumeProgression: "Volume rises only after three consecutive complete weeks.",
      exerciseProgression: "Movements stay constant.",
      advancementCriteria: ["Two to three consecutive complete weeks"],
      regressionCriteria: ["Attendance falling — the plan gets smaller, not louder"],
    },
    fatigue: {
      localFatiguePattern: "Low and evenly distributed.",
      systemicDemand: "low", lowerBodyInterference: "low", recoveryDemand: "low", impactDemand: "low",
    },
    phases: LIFESTYLE_PHASES,
    nutrition: {
      demandClass: "low",
      trainingDayPattern: "A protein anchor and consistent meals. Simplicity is the strategy.",
      recoveryDayPattern: "Identical.",
      bodyCompositionSupport: "Any direction, driven by intake rather than by training changes.",
    },
    adaptation: {
      readinessRules: ["Low readiness shortens the session rather than cancelling it."],
      painRules: BASE_PAIN,
      missedSessionRules: ["Missed sessions are moved, never doubled."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["Weight trend informs intake guidance only."],
      performanceTrendRules: ["Progression is gated on attendance."],
      adherenceRules: ["Adherence below 60% reduces the plan to two sessions."],
    },
    personalization: {
      preferredAthleteProfiles: ["Any training age", "Two or three available days", "Consistency is the stated problem"],
      conditionalProfiles: ["Athletes with an established habit — the foundation or balanced architectures progress faster"],
      frequencySelectionRules: ["Three days standard, two days minimum."],
      bodyCompositionRules: ["Composition goals change intake guidance only."],
      recoveryScalingRules: ["Already minimal."],
    },
    eligibility: {},
  }),
};

/* ─── Women's Performance DNA (generated from the track configs) ──────── */

const WOMENS_PROTOCOL_IDS = [
  "glute-ascend", "glute-crown", "sculpted-legs", "runway-shape",
  "vacation-physique", "athletic-model", "signature-shape",
  "hybrid-pilates-shape", "sport-strength-shape",
] as const;

for (const id of WOMENS_PROTOCOL_IDS) {
  const def = PROTOCOL_LIBRARY.find((p) => p.id === id);
  if (!def) continue;
  PROTOCOL_DNA[id] = dna(id, {
    identity: {
      family: "womens-performance",
      primaryObjective: def.primaryGoal,
      secondaryObjectives: def.secondaryGoals,
      intendedAthletes: [def.idealUser, "Athletes selecting a performance and physique architecture on their own goals"],
      unsuitableAthletes: ["Athletes whose stated goal is a different region or quality than this track leads with"],
    },
    topology: {
      supportedFrequencies: [3, 4, 5],
      compressionRules: ["Support and detail days drop before any priority exposure.", "The three priority exposures are the architecture's identity."],
      expansionRules: ["A sixth day adds an upper-frame or conditioning exposure, not a fourth priority day."],
      schedulingPriorities: ["Priority exposures spaced by at least 48 hours", "Conditioning placed clear of priority-day recovery"],
    },
    stimulus: {
      weeklySetRanges: { glutes: [12, 20], quads: [8, 14], hamstrings: [8, 14], calves: [4, 10], back: [8, 12], delts: [6, 12], core: [10, 16] },
      intensityDistribution: "Roughly 30% strength, 55% hypertrophy, 15% conditioning and core.",
      proximityToFailurePolicy: "Compounds at 2–3 reps in reserve; isolation and detail work at 0–1.",
      exerciseSelectionPolicy: "Movement selection follows the track's priority patterns, with control and lockout quality prioritised over load.",
    },
    progression: {
      model: "Volume accumulation into load progression, then a refinement phase for detail and posture.",
      loadingProgression: "Load rises when the top of the rep range is reached with control maintained through the full range.",
      volumeProgression: "Priority-exposure sets rise first; support work holds.",
      exerciseProgression: "Movements rotate at phase boundaries within the same pattern.",
      advancementCriteria: ["Load or control improves on the priority patterns", "Measurement trend moves"],
      regressionCriteria: ["Control degrading to reach a load", "Readiness declining at the volume ceiling"],
    },
    fatigue: {
      localFatiguePattern: "High local fatigue in the track's priority region; upper frame and core moderate.",
      systemicDemand: "moderate", lowerBodyInterference: "high", recoveryDemand: "moderate", impactDemand: "low",
    },
    phases: WOMENS_PHASES,
    nutrition: {
      demandClass: "moderate",
      trainingDayPattern: "Protein distributed with carbohydrate protected around the priority sessions.",
      recoveryDayPattern: "Protein constant, carbohydrate lower.",
      bodyCompositionSupport: `Aligned to the track's intent: ${def.nutritionEmphasis.toLowerCase()}.`,
    },
    adaptation: {
      readinessRules: BASE_READINESS,
      painRules: BASE_PAIN,
      missedSessionRules: ["A missed priority exposure is rescheduled inside the week; support days absorb the change."],
      scheduleChangeRules: BASE_SCHEDULE,
      bodyWeightTrendRules: ["An aggressive deficit while a growth-focused track is active triggers a phase or protocol review."],
      performanceTrendRules: ["Stalled priority-pattern load triggers a movement rotation before a volume increase."],
      adherenceRules: BASE_ADHERENCE,
    },
    personalization: {
      preferredAthleteProfiles: ["Any training age", "Four or five available days", "A stated regional or performance priority"],
      conditionalProfiles: ["Athletes whose priority is upper-body led — a different architecture fits better"],
      frequencySelectionRules: ["Five days standard; four keeps all three priority exposures and merges the support days."],
      bodyCompositionRules: ["Composition goals change the fuel intent, not the weekly structure."],
      recoveryScalingRules: ["Low recovery capacity reduces the priority set ceiling before removing an exposure."],
    },
    eligibility: {},
  });
}

/* ─── Remaining catalogue entries (structural parity with their family) ── */

const FAMILY_INHERIT: Array<[string, string, ProtocolDNAFamily, ProgramPhaseDefinition[]?]> = [
  // [protocolId, inheritFromProtocolId, family, phaseOverride?]
  ["premium-gym-operator", "classic-physique-build", "classic-physique"],
  ["vacation-countdown", "ultimate-summer-shred", "fat-loss", COUNTDOWN_PHASES],
  ["fertility-lifestyle", "lifestyle-reset", "lifestyle"],
  ["pregnancy-lifestyle", "lifestyle-reset", "lifestyle"],
];

for (const [id, inheritFrom, family, phaseOverride] of FAMILY_INHERIT) {
  const base = PROTOCOL_DNA[inheritFrom];
  const def = PROTOCOL_LIBRARY.find((p) => p.id === id);
  if (!base || !def) continue;
  PROTOCOL_DNA[id] = dna(id, {
    identity: {
      family,
      primaryObjective: def.primaryGoal,
      secondaryObjectives: def.secondaryGoals,
      intendedAthletes: [def.idealUser],
      unsuitableAthletes: base.identity.unsuitableAthletes,
    },
    topology: {
      supportedFrequencies: base.topology.supportedFrequencies,
      compressionRules: base.topology.compressionRules,
      expansionRules: base.topology.expansionRules,
      schedulingPriorities: base.topology.schedulingPriorities,
    },
    stimulus: {
      weeklySetRanges: base.stimulus.weeklySetRanges,
      intensityDistribution: base.stimulus.intensityDistribution,
      proximityToFailurePolicy: base.stimulus.proximityToFailurePolicy,
      primaryLiftPolicy: base.stimulus.primaryLiftPolicy,
      exerciseSelectionPolicy: base.stimulus.exerciseSelectionPolicy,
    },
    progression:
      id === "vacation-countdown"
        ? {
            ...base.progression,
            model: "Front-loaded deficit against a fixed date, then a shift to detail work and a presentation-week taper.",
            conditioningProgression: "Conditioning peaks during the deficit drive and reduces through the final two weeks.",
          }
        : base.progression,
    fatigue: base.fatigue,
    phases: phaseOverride ?? base.phases,
    nutrition: { ...base.nutrition, bodyCompositionSupport: `${def.nutritionEmphasis}.` },
    adaptation: base.adaptation,
    personalization: base.personalization,
    eligibility:
      id === "fertility-lifestyle" || id === "pregnancy-lifestyle"
        ? { manualOnly: true }
        : base.eligibility,
  });
}

/* Log-only. */
{
  const def = PROTOCOL_LIBRARY.find((p) => p.id === "enhanced-logbook");
  if (def) {
    PROTOCOL_DNA["enhanced-logbook"] = dna("enhanced-logbook", {
      identity: {
        family: "log-only",
        primaryObjective: "Organize what the athlete records. Reserve does not prescribe or generate sessions here.",
        secondaryObjectives: ["Record keeping", "Trend observation"],
        intendedAthletes: ["Athletes who run their own programming and want Reserve to organize the record"],
        unsuitableAthletes: ["Athletes who want Reserve to write the program"],
      },
      topology: {
        supportedFrequencies: [1, 2, 3, 4, 5, 6, 7],
        compressionRules: ["Log-only weeks are never restructured."],
        expansionRules: ["Log-only weeks are never expanded."],
        schedulingPriorities: ["Member-defined"],
      },
      stimulus: {
        weeklySetRanges: {},
        intensityDistribution: "Member-defined.",
        proximityToFailurePolicy: "Member-defined.",
        exerciseSelectionPolicy: "Member-defined. Reserve records; it does not select.",
      },
      progression: {
        model: "Member-defined. Reserve observes trends and does not prescribe progression.",
        loadingProgression: "Member-defined.",
        volumeProgression: "Member-defined.",
        exerciseProgression: "Member-defined.",
        advancementCriteria: [],
        regressionCriteria: [],
      },
      fatigue: {
        localFatiguePattern: "Not modelled — Reserve does not generate these sessions.",
        systemicDemand: "moderate", lowerBodyInterference: "moderate", recoveryDemand: "moderate",
      },
      phases: LOG_ONLY_PHASES,
      nutrition: {
        demandClass: "moderate",
        trainingDayPattern: "Log-only — Reserve organizes entries and does not generate meal guidance.",
        recoveryDayPattern: "Log-only.",
        bodyCompositionSupport: "Log-only.",
      },
      adaptation: {
        readinessRules: [], painRules: [], missedSessionRules: [],
        scheduleChangeRules: [], bodyWeightTrendRules: [], performanceTrendRules: [], adherenceRules: [],
      },
      personalization: {
        preferredAthleteProfiles: ["Athletes running their own programming"],
        conditionalProfiles: [],
        frequencySelectionRules: ["Member-defined."],
        bodyCompositionRules: ["Member-defined."],
        recoveryScalingRules: ["Member-defined."],
      },
      eligibility: { manualOnly: true },
    });
  }
}

/* ─── Accessors ───────────────────────────────────────────────────────── */

export function getProtocolDNA(protocolId: string | null | undefined): ProtocolDNA | null {
  if (!protocolId) return null;
  return PROTOCOL_DNA[protocolId] ?? null;
}

/** DNA for a protocol definition, falling back to its family peer if unmapped. */
export function dnaForDefinition(def: ProtocolDefinition): ProtocolDNA | null {
  return PROTOCOL_DNA[def.id] ?? null;
}

/** Every protocol that has DNA — the selectable universe for suitability. */
export function allProtocolDNA(): ProtocolDNA[] {
  return Object.values(PROTOCOL_DNA);
}

/** Protocols that the recommender may rank (manual-only ones are excluded). */
export function recommendableProtocolDNA(): ProtocolDNA[] {
  return allProtocolDNA().filter((d) => !d.eligibility.manualOnly);
}
