/* ════════════════════════════════════════════════════════════════════════
   SPLIT-SPECIFIC WORKOUT TEMPLATE SYSTEM
   ------------------------------------------------------------------------
   Single source of truth for which exercises belong to which training split.
   The Mission Runway / live session selects a template by split key so every
   split renders its own correct workout. No split silently falls back to the
   Upper Specialization workout.

   This module is pure data + mapping. It contains NO medical, dosing, or
   supplement guidance — training programming only.
   ════════════════════════════════════════════════════════════════════════ */

import type { SessionArchetype } from "./split-blueprints";
import { WORKOUT_DEMAND_META } from "./workout-demand";

export type WorkoutPhaseKey = "primary-output" | "secondary-volume" | "detail-work";
export type MovementRole =
  | "primer"
  | "activation"
  | "primary"
  | "secondary"
  | "stretch"
  | "volume"
  | "finisher"
  | "recovery";
export type MovementDifficulty = "beginner" | "intermediate" | "advanced";
export type WorkoutPriority = "P1" | "P2" | "P3";

/** An intensity technique that closes out a movement's LAST working set.
 *  Applied only to safe isolation / machine / cable work — never to a heavy
 *  free-weight compound, and never on a first training level. Training
 *  instruction only: stop the set if anything hurts. */
export type FinishingTechnique = {
  kind: "drop-set" | "rest-pause";
  /** Short badge label, e.g. "Drop set". */
  label: string;
  /** What to actually do on the last set. */
  instruction: string;
};

export const FINISHING_TECHNIQUES: Record<FinishingTechnique["kind"], FinishingTechnique> = {
  "drop-set": {
    kind: "drop-set",
    label: "Drop set",
    instruction: "Last set only — hit your reps, cut the load about a third, and go again with no rest until form breaks.",
  },
  "rest-pause": {
    kind: "rest-pause",
    label: "Rest-pause",
    instruction: "Last set only — hit your reps, rest 15 seconds, then squeeze out as many clean reps as the same load allows. Twice.",
  },
};

export type TemplateMovement = {
  id: string;
  order: number;
  name: string;
  sets: number;
  targetReps: string;
  targetMuscle: string;
  equipment: string;
  phase: WorkoutPhaseKey;
  role: MovementRole;
  roleLabel: string;
  rest: string;
  tempo: string;
  intensity: string;
  difficulty: MovementDifficulty;
  weakPointTags: string[];
  phaseTags: string[];
  notes?: string;
  /** Elite intent layer — every movement carries these so each split is intentional. */
  purpose: string;
  progressionRule: string;
  progressionTarget: string;
  substitutions: string[];
  plateauRule: string;
  fatigueNote?: string;
  /** Experience layer — superset group label when this movement is paired (advanced+). */
  superset?: string;
  /** The movement this one is paired with — so a card can name it, not just badge it. */
  supersetPartner?: string;
  /** Experience layer — a drop set / rest-pause finish on the LAST set of a
      safe isolation movement. Never on a heavy free-weight compound. */
  finishingTechnique?: FinishingTechnique;
  /** Member-preference layer — true when the member flagged this a favorite. */
  preferred?: boolean;
  /** Member-preference layer — original movement name when swapped for a preference. */
  swappedFrom?: string;
};

export type TemplatePhase = {
  id: string;
  priority: WorkoutPriority;
  phase: WorkoutPhaseKey;
  label: string;
  movements: TemplateMovement[];
};

export type WorkoutTemplate = {
  id: string;
  splitKey: SplitKey;
  displayName: string;
  focus: string;
  sessionIntent: string;
  targetMuscles: string[];
  weakPointPriority: string;
  warmUpPrimer: string;
  recoveryHandoff: string;
  executionStandard: string;
  optionalAddOns: string[];
  estimatedDurationMin: number;
  phases: TemplatePhase[];
  /* Protocol-aware intensity layer (set by applyProtocolIntensity; undefined = base template). */
  intensityTier?: IntensityTier;
  intensityLabel?: string;
  intensityNote?: string;
  /* Focus-priority layer (set by applyChestPriority / applyGlutePriority;
     undefined = no member muscle priority leading this session). */
  focusPriority?: FocusPriorityMeta;
  /** @deprecated kept for backward-compat — mirrors focusPriority for chest. */
  chestPriority?: FocusPriorityMeta;
  /* Experience-scaling layer (set by applyExperienceScaling; undefined = unscaled). */
  experienceTarget?: TrainingExperience;
  experienceLabel?: string;
  supersetCount?: number;
  volumeTier?: VolumeTier;
  densityTier?: DensityTier;
  /** AUTHORED: this session is a circuit — high volume, light load, short rest.
      Same-muscle accessory pairing is the point of it, not an error, so the
      pairing rule relaxes for non-heavy work. Never set by a transform. */
  circuitStyle?: boolean;
  /* Core-timing layer (set by applyCoreTiming; undefined = core handled by the
     end-of-session Core Command panel). */
  corePlacement?: CorePlacement;
  /* Long-protocol phase layer (set by applyPhaseProgression; undefined = no
     active long protocol → the session runs at its standard progression). */
  trainingPhase?: TrainingPhase;
  phaseLabel?: string;
  phaseNote?: string;
};

export type ChestReadiness = "strong" | "moderate" | "limited";

export type FocusPriorityMeta = {
  active: boolean;
  /** Which priority leads this session. */
  kind: "chest" | "glute" | "quad" | "posterior";
  /** True when chest/upper-chest gets first exposure. */
  upperChestFirst: boolean;
  readiness: ChestReadiness;
  /** True when low readiness pulled back pump / finisher volume. */
  reducedForRecovery: boolean;
  /** The lead tissue label, e.g. "Chest", "Glutes". */
  priorityTissue: string;
  /** Today's win condition for the lead movement. */
  winCondition: string;
  /** What the lead movement should feel like. */
  targetFeel: string;
  /** One execution cue for the lead pattern. */
  executionCue: string;
};

/** @deprecated alias retained for existing imports. */
export type ChestPriorityMeta = FocusPriorityMeta;

export type RecoveryRunwayItem = {
  id: string;
  label: string;
  detail: string;
  duration: string;
  status: "required" | "recommended" | "optional";
};

export type RecoveryRunway = {
  id: "recovery";
  displayName: string;
  focus: string;
  items: RecoveryRunwayItem[];
};

export type SplitKey =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "upper"
  | "lower"
  | "full-body"
  | "upper-specialization"
  | "push"
  | "pull"
  | "legs"
  | "arms-delts"
  | "chest-back"
  | "lower-posterior";

export type ResolvedSplit = SplitKey | "recovery" | null;

const PHASE_LABEL: Record<WorkoutPriority, string> = {
  P1: "Primary Output",
  P2: "Secondary Volume",
  P3: "Detail Work",
};

const PHASE_FOR_PRIORITY: Record<WorkoutPriority, WorkoutPhaseKey> = {
  P1: "primary-output",
  P2: "secondary-volume",
  P3: "detail-work",
};

/* ════════════════════════════════════════════════════════════════════════
   MOVEMENT POOLS — by pattern / muscle.
   Each slot draws substitutions from its pool so movements can rotate
   intelligently (anti-plateau) without changing the training intent.
   ════════════════════════════════════════════════════════════════════════ */

export type PoolKey =
  | "upper-chest-press" | "mid-chest-press" | "chest-iso"
  | "back-width" | "back-thickness" | "lat-iso"
  | "shoulder-press" | "side-delts" | "rear-delts"
  | "biceps" | "triceps"
  | "quads" | "hamstrings" | "glutes" | "calves" | "adductors" | "tibialis"
  | "core" | "conditioning" | "recovery";

export const BODYBUILDING_MOVEMENT_LIBRARY: Record<"chest" | "back" | "shoulders" | "arms" | "legs", string[]> = {
  chest: [
    "Low Incline Barbell Press", "Incline Dumbbell Press", "Smith Incline Press", "Plate-Loaded Incline Press", "Machine Incline Press",
    "Incline Cable Press", "Flat Barbell Press", "Flat Dumbbell Press", "Converging Chest Press", "Machine Chest Press",
    "Smith Flat Press", "Weighted Dip", "Assisted Dip", "Decline Machine Press", "High-to-Low Cable Press",
    "Low-to-High Cable Fly", "Incline Cable Fly", "Pec Deck", "Machine Pec Fly", "Flat Cable Fly",
    "Dumbbell Fly", "Deficit Push-Up", "Feet-Elevated Push-Up", "Banded Push-Up", "Neutral-Grip Machine Press",
    "Single-Arm Cable Press", "Floor Press", "Incline Squeeze Press", "Machine Press Back-Off", "Paused Incline Press",
    "Cable Squeeze Press", "Decline Cable Fly", "Cross-Body Cable Fly", "Stretch Push-Up", "Close-Grip Machine Press",
    "Low Incline Smith Press", "Seated Cable Chest Press", "Plate-Loaded Flat Press", "Mechanical Push-Up Drop", "Single-Arm Pec Deck",
    "Incline Machine Fly", "Bench-Supported Cable Fly", "Slow-Eccentric Dumbbell Press", "Bottom-Range Chest Press", "Upper-Chest Cable Ladder",
    "Lower-Chest Cable Squeeze", "Chest Dip Pump Set", "Iso-Hold Machine Press",
  ],
  back: [
    "Wide Grip Lat Pulldown", "Weighted Pull-Up", "Neutral Grip Pulldown", "Assisted Pull-Up", "Machine Pulldown",
    "Single-Arm Cable Pulldown", "Kneeling Cable Pulldown", "Underhand Pulldown", "Chest-Supported Row", "Barbell Row",
    "T-Bar Row", "Seated Cable Row", "Meadows Row", "Single-Arm Cable Row", "Plate-Loaded Row",
    "Seal Row", "Machine High Row", "Machine Low Row", "Dumbbell Row", "Rack-Supported Row",
    "Cable Row High-to-Low", "Cable Row Low-to-High", "Machine Pullover", "Straight-Arm Pulldown", "Cable Pullover",
    "Dumbbell Pullover", "Lat Prayer Pulldown", "Incline Bench Cable Row", "Wide Neutral Pulldown", "Close-Grip Pulldown",
    "Chest-Supported Dumbbell Row", "Iso-Lateral Row", "Reverse-Grip Machine Row", "Scapular Pull-Up", "Lat Stretch Pulldown",
    "Mid-Back Row Pause", "Rear-Delt Row", "Face Pull", "Trap Raise", "Cable Rear-Delt Row",
    "Back Extension Row", "Smith Machine Row", "Landmine Row", "One-Arm Machine Row", "Pulldown Mechanical Drop",
    "Row Mechanical Drop", "Lengthened Lat Row", "Upper-Back Cable Finisher",
  ],
  shoulders: [
    "Rear Delt Cable Fly", "Reverse Pec Deck", "Chest-Supported Rear-Delt Raise", "High Cable Rear-Delt Row", "Face Pull",
    "Machine Shoulder Press", "Seated Dumbbell Shoulder Press", "Smith Shoulder Press", "Barbell Overhead Press", "Neutral-Grip Machine Press",
    "Cable Lateral Raise", "Machine Lateral Raise", "Dumbbell Lateral Raise", "Lean-Away Lateral Raise", "Cable Y-Raise",
    "Behind-Body Cable Lateral", "Seated Dumbbell Lateral", "Partial Lateral Raise", "One-Arm Machine Lateral", "Incline Bench Lateral",
    "Upright Cable Raise", "Plate Front Raise", "Cable Front Raise", "Dumbbell Front Raise", "Rear-Delt Row",
    "Reverse Cable Crossover", "Bent-Over Dumbbell Reverse Fly", "Supported Rear-Delt Swing", "Trap-3 Raise", "Prone Y-Raise",
    "Machine Press Back-Off", "Rotational DB Press", "High-Incline Dumbbell Press", "Cable Lateral Ladder", "Lateral Raise Mechanical Drop",
    "Rear-Delt Mechanical Drop", "Wide-Grip Machine Press", "Single-Arm Cable Press", "Scaption Raise", "Bottom-Half Lateral Raise",
    "Top-Half Lateral Raise", "Cable External Rotation", "Band Pull Apart", "Shoulder CARs", "Scapular Wall Slide",
    "Upper-Trap Cable Raise", "Dumbbell Shrug", "Cable Shrug",
  ],
  arms: [
    "Incline Dumbbell Curl", "EZ-Bar Curl", "Cable Curl", "Preacher Curl", "Hammer Curl",
    "Machine Preacher Curl", "Bayesian Cable Curl", "Spider Curl", "Dumbbell Supinating Curl", "Reverse Curl",
    "Rope Hammer Curl", "Concentration Curl", "High Cable Curl", "Single-Arm Cable Curl", "Drag Curl",
    "Rope Pressdown", "Overhead Cable Triceps Extension", "Close-Grip Bench Press", "Machine Dip", "V-Bar Pressdown",
    "Cross-Body Cable Extension", "Single-Arm Pressdown", "Overhead Rope Extension", "Skull Crusher", "PJR Pullover",
    "Dumbbell Overhead Extension", "Cable Kickback", "Dip Machine Pump Set", "JM Press", "Close-Grip Push-Up",
    "Preacher Curl Mechanical Drop", "Cable Curl 21s", "Reverse-Grip Pressdown", "Long-Head Cable Ladder", "Triceps Extension Mechanical Drop",
    "Wrist Curl", "Reverse Wrist Curl", "Behind-Back Cable Curl", "Dual Cable Curl", "Strict Barbell Curl",
    "Seated Dumbbell Curl", "Incline Hammer Curl", "Rope Curl Finisher", "Bench Dip Pump", "Cable Pressdown Cluster",
    "Overhead Extension Stretch Set", "Biceps Stretch Curl", "Triceps Lockout Finisher",
  ],
  legs: [
    "Hack Squat", "Smith Machine Squat", "Leg Press", "Pendulum Squat", "Leg Extension",
    "Heel-Elevated Smith Squat", "Belt Squat", "Front Squat", "Back Squat", "Goblet Squat",
    "Romanian Deadlift", "Smith Romanian Deadlift", "Dumbbell Romanian Deadlift", "Stiff-Leg Deadlift", "Seated Leg Curl",
    "Lying Leg Curl", "Single-Leg Curl", "Nordic Curl", "Hip Thrust", "Machine Hip Thrust",
    "Back Extension", "Cable Pull-Through", "Bulgarian Split Squat", "Walking Lunge", "Reverse Lunge",
    "Leg Press Calf Raise", "Standing Calf Raise", "Seated Calf Raise", "Donkey Calf Raise", "Tibialis Raise",
    "Adductor Machine", "Abductor Machine", "Cossack Squat", "Sissy Squat", "Cyclist Squat",
    "Split Squat", "Step-Up", "Glute Bridge", "Glute Kickback Machine", "Cable Glute Kickback",
    "Hamstring Slider Curl", "Leg Extension Mechanical Drop", "Leg Curl Mechanical Drop", "Calf Raise Mechanical Drop", "Quad Stretch Finisher",
    "Hamstring Lengthened Partial", "Leg Press Widow Set", "Smith Squat Back-Off",
  ],
};

export const MOVEMENT_POOLS: Record<PoolKey, string[]> = {
  "upper-chest-press": BODYBUILDING_MOVEMENT_LIBRARY.chest.filter((n) => /incline|upper|low-to-high|feet-elevated|y/i.test(n)),
  "mid-chest-press": BODYBUILDING_MOVEMENT_LIBRARY.chest.filter((n) => /flat|converging|dip|machine chest|decline|push-up|squeeze|press/i.test(n)),
  "chest-iso": BODYBUILDING_MOVEMENT_LIBRARY.chest.filter((n) => /fly|pec|cable|stretch|squeeze|finisher|iso/i.test(n)),
  "back-width": BODYBUILDING_MOVEMENT_LIBRARY.back.filter((n) => /pulldown|pull-up|lat|pullover|prayer/i.test(n)),
  "back-thickness": BODYBUILDING_MOVEMENT_LIBRARY.back.filter((n) => /row|back extension|trap|face pull/i.test(n)),
  "lat-iso": BODYBUILDING_MOVEMENT_LIBRARY.back.filter((n) => /pullover|straight-arm|lat|prayer/i.test(n)),
  "shoulder-press": BODYBUILDING_MOVEMENT_LIBRARY.shoulders.filter((n) => /press/i.test(n)),
  "side-delts": BODYBUILDING_MOVEMENT_LIBRARY.shoulders.filter((n) => /lateral|y-raise|scaption|upright/i.test(n)),
  "rear-delts": BODYBUILDING_MOVEMENT_LIBRARY.shoulders.filter((n) => /rear|reverse|face pull|trap|pull apart/i.test(n)),
  "biceps": BODYBUILDING_MOVEMENT_LIBRARY.arms.filter((n) => /curl|biceps/i.test(n)),
  "triceps": BODYBUILDING_MOVEMENT_LIBRARY.arms.filter((n) => /pressdown|extension|dip|skull|triceps|jm|push-up|lockout/i.test(n)),
  "quads": BODYBUILDING_MOVEMENT_LIBRARY.legs.filter((n) => /squat|leg press|extension|lunge|step-up|quad/i.test(n)),
  "hamstrings": BODYBUILDING_MOVEMENT_LIBRARY.legs.filter((n) => /deadlift|curl|hamstring|rdl|nordic/i.test(n)),
  "glutes": BODYBUILDING_MOVEMENT_LIBRARY.legs.filter((n) => /glute|hip thrust|pull-through|lunge|split|extension/i.test(n)),
  "calves": BODYBUILDING_MOVEMENT_LIBRARY.legs.filter((n) => /calf|tibialis/i.test(n)),
  "adductors": ["Adductor Machine", "Cossack Squat"],
  "tibialis": ["Tibialis Raise", "Toe Raise"],
  "core": ["Cable Crunch", "Hanging Knee Raise", "Ab Wheel Rollout", "Pallof Press", "Weighted Decline Crunch", "Loaded Carry"],
  "conditioning": ["Incline Treadmill Walk", "Stationary Bike", "Stair Climber", "Rower"],
  "recovery": ["Sauna", "Mobility Flow", "Breathwork", "Foam Rolling"],
};

/** Map a target-muscle label to its movement pool. */
export function poolForMuscle(muscle: string): PoolKey | null {
  const m = muscle.toLowerCase();
  if (m.includes("upper chest")) return "upper-chest-press";
  if (m.includes("lower chest") || m.includes("mid chest") || m === "chest") return "mid-chest-press";
  if (m.includes("lat")) return m.includes("iso") ? "lat-iso" : "back-width";
  if (m.includes("mid-back") || m.includes("back")) return "back-thickness";
  if (m.includes("rear delt")) return "rear-delts";
  if (m.includes("front delt")) return "shoulder-press";
  if (m.includes("upper delt")) return "side-delts";
  if (m.includes("delt")) return "side-delts";
  if (m.includes("bicep")) return "biceps";
  if (m.includes("tricep") || m.includes("long-head")) return "triceps";
  if (m.includes("quad")) return "quads";
  if (m.includes("hamstring")) return "hamstrings";
  if (m.includes("glute")) return "glutes";
  if (m.includes("soleus") || m.includes("gastro") || m.includes("calf") || m.includes("calves")) return "calves";
  if (m.includes("adductor")) return "adductors";
  if (m.includes("tibialis")) return "tibialis";
  if (m.includes("core") || m.includes("ab")) return "core";
  return null;
}

function substitutionsFor(name: string, muscle: string): string[] {
  const key = poolForMuscle(muscle);
  if (!key) return [];
  return MOVEMENT_POOLS[key].filter((n) => n.toLowerCase() !== name.toLowerCase()).slice(0, 5);
}

const PROGRESSION_RULE: Record<WorkoutPhaseKey, string> = {
  "primary-output": "Add 1 clean rep before adding load. Add the smallest practical load once the top set is clean across the range.",
  "secondary-volume": "Hold load and earn reps. Progress volume only when every set reaches the top of the range.",
  "detail-work": "Chase contraction quality and reps. Small load bumps only when form stays locked.",
};

const PLATEAU_RULE = "Rotate to a substitution if top-set performance stalls for 3 consecutive exposures.";

const ROLE_LABEL: Record<MovementRole, string> = {
  primer: "PRIME THE TARGET",
  activation: "ACTIVATION MOVEMENT",
  primary: "PRIMARY OUTPUT",
  secondary: "CONTROLLED OVERLOAD",
  stretch: "STRETCH-BIASED VOLUME",
  volume: "STABLE VOLUME",
  finisher: "PUMP FINISHER",
  recovery: "RECOVERY HANDOFF",
};

const ROLE_REST: Record<MovementRole, string> = {
  primer: "0:30-0:45",
  activation: "0:45-1:00",
  primary: "2:30-3:15",
  secondary: "1:45-2:30",
  stretch: "1:15-1:45",
  volume: "1:00-1:30",
  finisher: "0:30-1:00",
  recovery: "0:30-0:45",
};

const ROLE_TEMPO: Record<MovementRole, string> = {
  primer: "2-1-2-0",
  activation: "2-1-2-1",
  primary: "3-1-1-0",
  secondary: "3-1-1-0",
  stretch: "4-1-1-0",
  volume: "2-1-2-1",
  finisher: "2-0-2-1",
  recovery: "2-2-2-0",
};

const ROLE_INTENSITY: Record<MovementRole, string> = {
  primer: "Easy tissue connection; stop far from failure.",
  activation: "2-3 RIR; feel the target before loading.",
  primary: "1-2 RIR on working sets; no form drift.",
  secondary: "1-2 RIR with repeatable reps.",
  stretch: "1-3 RIR; own the lengthened range.",
  volume: "1-2 RIR; keep the machine or cable path stable.",
  finisher: "Hard pump set; stop before technique breaks.",
  recovery: "Low effort; restore range and breathing.",
};

function roleFor(phase: WorkoutPhaseKey, index: number): MovementRole {
  if (phase === "primary-output") return index === 0 ? "activation" : index === 1 ? "primary" : "secondary";
  if (phase === "secondary-volume") return index === 0 ? "stretch" : "volume";
  return index >= 2 ? "finisher" : "volume";
}

function difficultyFor(role: MovementRole, equipment: string): MovementDifficulty {
  const e = equipment.toLowerCase();
  if (role === "primary" || e.includes("barbell") || e.includes("t-bar") || e.includes("weighted")) return "advanced";
  if (role === "activation" || role === "primer" || role === "recovery") return "beginner";
  return "intermediate";
}

function weakPointTagsFor(muscle: string, role: MovementRole): string[] {
  const m = muscle.toLowerCase();
  const tags: string[] = [];
  if (m.includes("upper chest")) tags.push("upper-chest");
  if (m.includes("lower chest")) tags.push("lower-chest");
  if (m.includes("lat")) tags.push("lat-width");
  if (m.includes("mid-back") || m.includes("back")) tags.push("back-thickness");
  if (m.includes("side delt") || m.includes("upper delt")) tags.push("shoulder-width");
  if (m.includes("rear delt")) tags.push("rear-delt-detail");
  if (m.includes("quad")) tags.push("quad-sweep");
  if (m.includes("hamstring")) tags.push("hamstring-sweep");
  if (m.includes("calf")) tags.push("calves");
  if (m.includes("bicep")) tags.push("arm-detail");
  if (m.includes("tricep")) tags.push("arm-detail");
  if (role === "stretch") tags.push("lengthened-tension");
  if (role === "finisher") tags.push("pump-density");
  return tags.length > 0 ? tags : ["balanced-physique"];
}

function phaseTagsFor(phase: WorkoutPhaseKey, role: MovementRole): string[] {
  return [phase, role === "primary" ? "heavy-tension" : role === "finisher" ? "metabolic-finish" : role === "stretch" ? "lengthened-bias" : "hypertrophy"];
}

function purposeFor(phase: WorkoutPhaseKey, muscle: string, notes?: string): string {
  if (notes) return notes;
  if (phase === "primary-output") return `Primary ${muscle.toLowerCase()} output`;
  if (phase === "secondary-volume") return `${muscle} hypertrophy volume`;
  return `${muscle} detail and finisher work`;
}

function fatigueNoteFor(phase: WorkoutPhaseKey, equipment: string): string | undefined {
  const e = equipment.toLowerCase();
  if (phase === "primary-output" && (e.includes("barbell") || e.includes("t-bar"))) {
    return "Heavy systemic exposure — keep 1–2 reps in reserve on early sets.";
  }
  return undefined;
}

/* ─── Compact builder ───────────────────────────── */
type RawMovement = [
  name: string,
  sets: number,
  reps: string,
  muscle: string,
  equipment: string,
  notes?: string,
  role?: MovementRole,
  tempo?: string,
  intensity?: string,
  /** Authored rest, "m:ss" or "m:ss-m:ss". Density sessions state their own
      rest instead of inheriting the role default — a 15-second circuit rest
      is a real coaching choice, not a role side effect. */
  rest?: string,
];

type TemplateMeta = Partial<Pick<
  WorkoutTemplate,
  "sessionIntent" | "targetMuscles" | "weakPointPriority" | "warmUpPrimer" | "recoveryHandoff" | "executionStandard" | "optionalAddOns" | "circuitStyle"
>>;

function phase(splitKey: SplitKey, priority: WorkoutPriority, raws: RawMovement[], startOrder: number): { phase: TemplatePhase; nextOrder: number } {
  const phaseKey = PHASE_FOR_PRIORITY[priority];
  const movements: TemplateMovement[] = raws.map(([name, sets, targetReps, targetMuscle, equipment, notes, rawRole, rawTempo, rawIntensity, rawRest], i) => {
    const role = rawRole ?? roleFor(phaseKey, i);
    const progressionTarget = role === "primary"
      ? "BEAT THIS NEXT TIME: add one clean rep before load, then make the smallest practical jump."
      : role === "finisher"
        ? "BEAT THIS NEXT TIME: match reps with cleaner contractions or one extra controlled rep."
        : "BEAT THIS NEXT TIME: reach the top of the rep range with the same form standard.";
    return {
      id: `${splitKey}-${slug(name)}`,
      order: startOrder + i,
      name,
      sets,
      targetReps,
      targetMuscle,
      equipment,
      phase: phaseKey,
      role,
      roleLabel: ROLE_LABEL[role],
      rest: rawRest ?? ROLE_REST[role],
      tempo: rawTempo ?? ROLE_TEMPO[role],
      intensity: rawIntensity ?? ROLE_INTENSITY[role],
      difficulty: difficultyFor(role, equipment),
      weakPointTags: weakPointTagsFor(targetMuscle, role),
      phaseTags: phaseTagsFor(phaseKey, role),
      notes,
      purpose: purposeFor(phaseKey, targetMuscle, notes),
      progressionRule: PROGRESSION_RULE[phaseKey],
      progressionTarget,
      substitutions: substitutionsFor(name, targetMuscle),
      plateauRule: PLATEAU_RULE,
      fatigueNote: fatigueNoteFor(phaseKey, equipment),
    };
  });
  return {
    phase: { id: `${splitKey}-${priority.toLowerCase()}`, priority, phase: phaseKey, label: PHASE_LABEL[priority], movements },
    nextOrder: startOrder + raws.length,
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function template(
  splitKey: SplitKey,
  displayName: string,
  focus: string,
  estimatedDurationMin: number,
  p1: RawMovement[],
  p2: RawMovement[],
  p3: RawMovement[],
  meta: TemplateMeta = {},
): WorkoutTemplate {
  const a = phase(splitKey, "P1", p1, 1);
  const b = phase(splitKey, "P2", p2, a.nextOrder);
  const c = phase(splitKey, "P3", p3, b.nextOrder);
  const targetMuscles = Array.from(new Set([...a.phase.movements, ...b.phase.movements, ...c.phase.movements].map((m) => m.targetMuscle)));
  return {
    id: `template-${splitKey}`,
    splitKey,
    displayName,
    focus,
    sessionIntent: meta.sessionIntent ?? "Advanced Bodybuilding Structure: build the priority tissue first, then move through controlled overload, stretch-biased volume, stable machine/cable work, and a pump finish.",
    targetMuscles: meta.targetMuscles ?? targetMuscles,
    weakPointPriority: meta.weakPointPriority ?? targetMuscles.slice(0, 3).join(" · "),
    warmUpPrimer: meta.warmUpPrimer ?? "Warm-Up / Mobility Primer: 5-10 minutes of joint prep, ramp sets, and target-tissue activation before the first hard set.",
    recoveryHandoff: meta.recoveryHandoff ?? "RECOVERY HANDOFF: log performance, hydrate, downshift, and review recovery signals before the next exposure.",
    executionStandard: meta.executionStandard ?? "RESERVE TRAINING STANDARD: controlled eccentrics, stable setup, target feel first, load second.",
    optionalAddOns: meta.optionalAddOns ?? ["Optional Abs", "Optional Zone 2 Cooldown", "Optional Sauna if already tolerated"],
    circuitStyle: meta.circuitStyle,
    estimatedDurationMin,
    phases: [a.phase, b.phase, c.phase],
  };
}

/* ════════════════════════════════════════════════════════════════════════
   TEMPLATES
   ════════════════════════════════════════════════════════════════════════ */

export const WORKOUT_TEMPLATES: Record<SplitKey, WorkoutTemplate> = {
  chest: template(
    "chest",
    "Chest",
    "Classic Physique Structure for upper chest, heavy press output, fly stretch, and cable squeeze",
    104,
    [
      ["Low Cable Chest Primer", 2, "15-20", "Upper Chest", "Cable Stack", "Prime pec tension without fatiguing the press.", "primer"],
      ["Incline Machine Press", 2, "10-12", "Upper Chest", "Incline Press Machine", "Activation sets: feel upper chest before the heavy slot.", "activation"],
      ["Low Incline Barbell Press", 4, "5-8", "Upper Chest", "Barbell · Adjustable Bench", "Primary heavy press with the upper shelf as the target.", "primary"],
      ["Flat Dumbbell Press", 3, "8-10", "Mid Chest", "Dumbbells · Bench", "Secondary press for controlled overload after the incline priority.", "secondary"],
    ],
    [
      ["Incline Dumbbell Fly", 3, "10-14", "Upper Chest", "Dumbbells · Bench", "Stretch-biased chest volume; own the bottom range.", "stretch"],
      ["Converging Machine Chest Press", 3, "9-12", "Mid Chest", "Chest Press Machine", "Stable machine volume with a consistent bar path.", "volume"],
      ["Low-to-High Cable Fly", 3, "12-16", "Upper Chest", "Cable Stack", "Cable squeeze movement for clavicular pec finish.", "volume"],
    ],
    [
      ["High-to-Low Cable Fly", 2, "15-20", "Lower Chest", "Cable Stack", "Lower-chest weak-point finisher; squeeze down and in.", "finisher"],
      ["Upper-Chest Cable Ladder", 2, "12-15 / angle", "Upper Chest", "Cable Stack", "Upper-chest weak-point pump with clean angles.", "finisher"],
      ["Rope Pressdown Handoff", 2, "12-16", "Triceps", "Cable Stack", "Optional triceps handoff if elbows feel clean.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: upper chest first, heavy press second, stable hypertrophy third, then stretch and squeeze work to finish the chest signal.",
      targetMuscles: ["Upper Chest", "Mid Chest", "Lower Chest", "Triceps"],
      weakPointPriority: "Upper chest shelf · lower-chest finish · pressing stability",
      warmUpPrimer: "PRIME THE TARGET: thoracic extension, band pull-aparts, scapular push-ups, cuff work, then two ramp sets before the primary press.",
    },
  ),

  back: template(
    "back",
    "Back",
    "Lat width, lengthened lat work, mid-back thickness, and pullover finish",
    106,
    [
      ["Straight-Arm Cable Pulldown", 2, "15-20", "Lats", "Cable Stack", "Lat primer: feel the shoulder extend before rows or pulls.", "primer"],
      ["Scapular Pull-Up", 2, "8-10", "Lats", "Pull-Up Bar", "Activation for depression and clean lat line.", "activation"],
      ["Weighted Pull-Up", 4, "5-8", "Lats", "Pull-Up Bar", "Primary width output; pulldown is the swap if bodyweight is not clean.", "primary"],
      ["Chest-Supported Row", 4, "7-10", "Mid-Back", "Row Machine", "Heavy stable row for mid-back thickness.", "primary"],
    ],
    [
      ["Single-Arm Cable Lat Row", 3, "10-13", "Lats", "Cable Stack", "Lengthened lat work: reach, then row elbow to hip.", "stretch"],
      ["Seated Cable Row", 3, "9-12", "Mid-Back", "Cable Stack", "Controlled overload for rhomboids and lower traps.", "secondary"],
      ["Machine Pullover", 3, "10-15", "Lats", "Pullover Machine", "Pullover slot for lat length and ribcage line.", "volume"],
    ],
    [
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear delt and upper-back accessory if needed.", "volume"],
      ["Cable Row Mechanical Drop", 2, "12-15 + drop", "Mid-Back", "Cable Stack", "Pump finisher for thickness without extra hinge fatigue.", "finisher"],
      ["Straight-Arm Pulldown Burnout", 2, "15-20", "Lats", "Cable Stack", "Lat pump finisher: long arms, no triceps takeover.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: open with lat connection, secure one heavy pull and one heavy row, then finish with lengthened lat work, thickness volume, and a pump close.",
      targetMuscles: ["Lats", "Mid-Back", "Rear Delts", "Traps"],
      weakPointPriority: "Lat width · mid-back density · rear-delt cap",
      warmUpPrimer: "PRIME THE TARGET: thoracic rotation, lat opener, scapular depression, light band rows, then ramp the first pull.",
    },
  ),

  shoulders: template(
    "shoulders",
    "Shoulders",
    "Rear delt primer, press output, lateral raise volume, and width-focused pump",
    92,
    [
      ["Rear Delt Cable Fly", 2, "15-20", "Rear Delts", "Cable Stack", "Rear delt primer before pressing keeps the shoulder centered.", "primer"],
      ["Cable Lateral Raise", 2, "15-20", "Side Delts", "Cable Stack", "Activation for side-delt target feel.", "activation"],
      ["Machine Shoulder Press", 4, "6-10", "Front Delts", "Shoulder Press Machine", "Primary stable press; stay stacked and controlled.", "primary"],
      ["Seated Dumbbell Shoulder Press", 3, "8-10", "Front Delts", "Dumbbells · Bench", "Secondary press only if control stays clean.", "secondary"],
    ],
    [
      ["Cable Lateral Raise", 4, "12-18", "Side Delts", "Cable Stack", "Lengthened lateral raise volume.", "stretch"],
      ["Machine Lateral Raise", 4, "12-20", "Side Delts", "Lateral Raise Machine", "Stable machine volume for shoulder width.", "volume"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear delt and upper-back balance.", "volume"],
    ],
    [
      ["Cable Y-Raise", 3, "12-18", "Upper Delts", "Cable Stack", "Upper-delt line without trap takeover.", "volume"],
      ["Dumbbell Shrug", 2, "10-14", "Traps", "Dumbbells", "Optional traps if neck and setup feel clean.", "finisher"],
      ["Lateral Raise Mechanical Drop", 2, "12-15 + drop", "Side Delts", "Dumbbells", "Fascia Pump Finisher for side-delt cap.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: rear delts first, press while stable, then stack lateral raise volume until the shoulder cap is the clear signal.",
      targetMuscles: ["Rear Delts", "Side Delts", "Front Delts", "Traps"],
      weakPointPriority: "Shoulder width · rear-delt detail · press stability",
    },
  ),

  arms: template(
    "arms",
    "Arms",
    "Coach-level biceps and triceps execution with stretch, overload, and pump sequencing",
    84,
    [
      ["Rope Pressdown Primer", 2, "15-20", "Triceps", "Cable Stack", "Prime elbow extension and lockout control.", "primer"],
      ["Cable Curl Primer", 2, "15-20", "Biceps", "Cable Stack", "Prime elbow flexion without swinging.", "primer"],
      ["Close-Grip Bench Press", 3, "6-10", "Triceps", "Barbell", "Primary triceps overload with tucked elbows.", "primary"],
      ["EZ-Bar Curl", 3, "8-12", "Biceps", "EZ-Bar", "Primary curl output with strict upper-arm position.", "primary"],
    ],
    [
      ["Overhead Cable Triceps Extension", 3, "10-14", "Long-Head Triceps", "Cable Stack", "Stretch-biased long-head triceps work.", "stretch"],
      ["Incline Dumbbell Curl", 3, "8-12", "Biceps", "Dumbbells · Bench", "Stretch-biased biceps work; no shoulder swing.", "stretch"],
      ["Machine Dip", 3, "10-14", "Triceps", "Dip Machine", "Stable triceps volume and lockout control.", "volume"],
    ],
    [
      ["Machine Preacher Curl", 3, "10-14", "Biceps", "Curl Machine", "Stable biceps volume with planted upper arms.", "volume"],
      ["Rope Curl Finisher", 2, "15-20", "Biceps", "Cable Stack", "Pump finisher for elbow flexors.", "finisher"],
      ["Cable Pressdown Cluster", 2, "12-15 + cluster", "Triceps", "Cable Stack", "Pump finisher for triceps density.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: alternate elbow extension and flexion so joints stay warm, overload is controlled, and the finish is pump-driven.",
      targetMuscles: ["Biceps", "Triceps", "Long-Head Triceps", "Forearms"],
      weakPointPriority: "Arm detail · long-head triceps · strict curl control",
    },
  ),

  legs: template(
    "legs",
    "Legs",
    "Mobility primer, hamstring activation, squat/press output, curls, extensions, calves, and recovery close",
    118,
    [
      ["Bodyweight RDL Patterning", 2, "10-12", "Hamstrings", "Bodyweight", "Mobility primer: groove hinge and hamstring tension.", "primer"],
      ["Seated Leg Curl", 2, "12-15", "Hamstrings", "Leg Curl Machine", "Hamstring activation before squat or press loading.", "activation"],
      ["Hack Squat", 4, "6-10", "Quads", "Hack Squat", "Primary squat pattern; Smith Machine Squat is an available option.", "primary"],
      ["Romanian Deadlift", 4, "6-9", "Hamstrings", "Barbell", "Primary hinge for loaded lengthened posterior tension.", "primary"],
    ],
    [
      ["Leg Press", 3, "10-14", "Quads", "Leg Press", "Stable machine overload after the free-weight work.", "secondary"],
      ["Walking Lunge", 3, "10-12 / leg", "Quads", "Dumbbells", "Free-weight unilateral — breaks the machine stack, exposes balance.", "secondary"],
      ["Lying Leg Curl", 3, "9-12", "Hamstrings", "Leg Curl Machine", "Lengthened hamstring curl slot.", "stretch"],
    ],
    [
      ["Leg Extension", 3, "12-18", "Quads", "Leg Extension", "Shortened quad volume; hold the top.", "volume"],
      ["Cable Pull-Through", 3, "12-15", "Glutes", "Cable Stack", "Cable tension for the hinge — posterior balance, no spinal load.", "volume"],
      ["Standing Calf Raise", 4, "8-12", "Calves", "Calf Raise Machine", "Straight-leg calf output with full stretch.", "finisher"],
      ["Optional Abs / Cardio / Sauna Handoff", 1, "8-20 min", "Recovery", "Optional", "Optional abs, easy walk, or sauna only if already tolerated.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: mobilize, activate hamstrings, secure squat and hinge output, then finish with curls, extensions, calves, and a recovery handoff.",
      targetMuscles: ["Quads", "Hamstrings", "Glutes", "Calves", "Abs"],
      weakPointPriority: "Quad sweep · hamstring length · calf finish",
      warmUpPrimer: "PRIME THE TARGET: hip hinge rehearsal, ankle mobility, glute bridge activation, hamstring floss, and ramp sets.",
    },
  ),

  push: template(
    "push",
    "Push",
    "Chest, shoulders, and triceps with incline priority and stable machine volume",
    98,
    [
      ["Cable Chest Primer", 2, "15-20", "Upper Chest", "Cable Stack", "Prime upper chest before pressing.", "primer"],
      ["Incline Barbell Press", 4, "5-8", "Upper Chest", "Barbell · Adjustable Bench", "Primary incline output.", "primary"],
      ["Machine Shoulder Press", 3, "7-10", "Front Delts", "Shoulder Press Machine", "Stable press after chest priority.", "secondary"],
    ],
    [
      ["Converging Machine Chest Press", 3, "9-12", "Mid Chest", "Chest Press Machine", "Stable machine press volume.", "volume"],
      ["Cable Lateral Raise", 4, "12-18", "Side Delts", "Cable Stack", "Side-delt volume for width.", "stretch"],
      ["Incline Cable Fly", 3, "12-16", "Upper Chest", "Cable Stack", "Stretch-squeeze fly slot.", "stretch"],
    ],
    [
      ["Rope Pressdown", 3, "12-16", "Triceps", "Cable Stack", "Triceps handoff after presses.", "volume"],
      ["Overhead Cable Triceps Extension", 3, "10-14", "Long-Head Triceps", "Cable Stack", "Long-head stretch work.", "stretch"],
      ["Push-Up Mechanical Drop", 2, "near technical limit", "Chest", "Bodyweight", "Stretch-Pump Finisher; stop before technique breaks.", "finisher"],
    ],
  ),

  pull: template(
    "pull",
    "Pull",
    "Lat primer, heavy pull, heavy row, lengthened lat work, traps, then biceps and forearms",
    98,
    [
      ["Straight-Arm Pulldown", 2, "15-20", "Lats", "Cable Stack", "Lat primer before loaded pulling.", "primer"],
      ["Weighted Pull-Up", 4, "6-10", "Lats", "Pull-Up Bar", "Primary vertical pull.", "primary"],
      ["Chest-Supported Row", 4, "8-12", "Mid-Back", "Row Machine", "Primary thickness row.", "primary"],
    ],
    [
      ["Single-Arm Cable Lat Row", 3, "10-13", "Lats", "Cable Stack", "Lengthened unilateral lat work.", "stretch"],
      ["Neutral Grip Pulldown", 3, "8-12", "Lower Lats", "Pulldown Station", "Controlled lat volume.", "volume"],
      ["Dumbbell Shrug", 3, "10-14", "Traps", "Dumbbells", "Upper-trap volume with a one-second hold at the top.", "volume"],
    ],
    [
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear delt accessory.", "volume"],
      ["Incline Dumbbell Curl", 3, "8-12", "Biceps", "Dumbbells · Bench", "Lengthened biceps finish.", "stretch"],
      ["Reverse-Grip EZ-Bar Curl", 2, "12-15", "Forearms", "EZ-Bar", "Forearm and brachialis finish — wrists stay neutral.", "finisher"],
    ],
  ),

  upper: template(
    "upper",
    "Upper",
    "Upper-body hypertrophy with chest/back priority and shoulder-arm detail",
    104,
    [
      ["Band Pull Apart", 2, "15-20", "Rear Delts", "Band", "Prime upper back and shoulders.", "primer"],
      ["Incline Dumbbell Press", 4, "8-11", "Upper Chest", "Dumbbells · Bench", "Primary upper-chest press.", "primary"],
      ["Chest-Supported Row", 4, "8-12", "Mid-Back", "Row Machine", "Primary upper-back row.", "primary"],
    ],
    [
      ["Neutral Grip Pulldown", 3, "8-12", "Lats", "Pulldown Station", "Lat volume.", "volume"],
      ["Machine Shoulder Press", 3, "8-12", "Front Delts", "Shoulder Press Machine", "Stable press volume.", "secondary"],
      ["Cable Lateral Raise", 4, "12-18", "Side Delts", "Cable Stack", "Side-delt width volume.", "stretch"],
    ],
    [
      ["Pec Deck", 3, "12-16", "Chest", "Pec Deck", "Chest squeeze slot.", "volume"],
      ["Rope Pressdown", 2, "12-16", "Triceps", "Cable Stack", "Triceps pump.", "finisher"],
      ["Cable Curl", 2, "12-16", "Biceps", "Cable Stack", "Biceps pump.", "finisher"],
    ],
  ),

  lower: template(
    "lower",
    "Lower",
    "Lower-body hypertrophy with squat pattern, hinge, curls, extensions, and calves",
    108,
    [
      ["Ankle Mobility + Bodyweight Squat", 2, "8-10", "Quads", "Bodyweight", "Mobility primer for clean depth.", "primer"],
      ["Seated Leg Curl", 2, "12-15", "Hamstrings", "Leg Curl Machine", "Hamstring activation.", "activation"],
      ["Back Squat", 4, "6-10", "Quads", "Barbell", "Primary free-weight squat — real iron leads the session (Smith / Hack are clean swaps).", "primary"],
      ["Romanian Deadlift", 3, "6-9", "Hamstrings", "Barbell", "Primary hinge pattern.", "primary"],
    ],
    [
      ["Leg Press", 3, "10-14", "Quads", "Leg Press", "Stable press volume.", "secondary"],
      ["Lying Leg Curl", 3, "9-12", "Hamstrings", "Leg Curl Machine", "Lengthened curl work.", "stretch"],
      ["Bulgarian Split Squat", 3, "8-12 / leg", "Glutes", "Dumbbells", "Unilateral glute and quad control.", "volume"],
    ],
    [
      ["Leg Extension", 3, "12-18", "Quads", "Leg Extension", "Quad contraction volume.", "volume"],
      ["Standing Calf Raise", 4, "8-12", "Calves", "Calf Raise Machine", "Calf output.", "volume"],
      ["Leg Curl Mechanical Drop", 2, "12-15 + drop", "Hamstrings", "Leg Curl Machine", "Hamstring pump finisher.", "finisher"],
    ],
  ),

  "full-body": template(
    "full-body",
    "Full Body",
    "Full-body bodybuilding day with one priority slot per region",
    96,
    [
      ["Full-Body Mobility Flow", 1, "6-8 min", "Recovery", "Bodyweight", "Prime joints and movement quality.", "primer"],
      ["Incline Machine Press", 3, "8-11", "Upper Chest", "Incline Press Machine", "Chest priority output.", "primary"],
      ["Chest-Supported Row", 3, "8-12", "Mid-Back", "Row Machine", "Back priority output.", "primary"],
      ["Hack Squat", 3, "8-12", "Quads", "Hack Squat", "Lower-body priority output.", "primary"],
    ],
    [
      ["Romanian Deadlift", 3, "8-10", "Hamstrings", "Barbell", "Hinge slot for posterior chain.", "secondary"],
      ["Cable Lateral Raise", 3, "12-18", "Side Delts", "Cable Stack", "Shoulder width volume.", "stretch"],
      ["Machine Pullover", 3, "10-15", "Lats", "Pullover Machine", "Lat isolation.", "volume"],
    ],
    [
      ["Leg Extension", 2, "12-18", "Quads", "Leg Extension", "Quad finish.", "volume"],
      ["Rope Pressdown", 2, "12-16", "Triceps", "Cable Stack", "Arm pump.", "finisher"],
      ["Cable Curl", 2, "12-16", "Biceps", "Cable Stack", "Arm pump.", "finisher"],
    ],
  ),

  "upper-specialization": template(
    "upper-specialization",
    "Upper Specialization",
    "Upper chest, delts, arms, and back detail",
    124,
    [
      ["Band Pull Apart", 2, "15-20", "Rear Delts", "Band", "Prime rear delts and scapular control.", "primer"],
      ["Low Incline Barbell Press", 5, "4-6", "Upper Chest", "Barbell · Adjustable Bench", "Heavy upper-chest tension before fatigue dilutes the press.", "primary"],
      ["Plate-Loaded Incline Press", 4, "8-11", "Upper Chest", "Plate-Loaded Incline", "Stable volume after the primary press.", "secondary"],
      ["Wide Grip Lat Pulldown", 4, "8-12", "Lats", "Cable Stack", "Width-biased vertical pull, elbows outside the ribs.", "primary"],
      ["Chest-Supported Row", 4, "8-12", "Mid-Back", "Row Machine", "Pad-supported thickness, pause each rep.", "primary"],
    ],
    [
      ["Low Incline Dumbbell Press", 3, "8-11", "Upper Chest", "Dumbbells · Bench", "Deeper stretch, control the bottom.", "stretch"],
      ["Meadows Row", 3, "10-13", "Lats", "Landmine", "Unilateral lat sweep, elbow to hip.", "volume"],
      ["Single-Arm Cable Lat Row", 3, "10-13", "Lats", "Cable Stack", "Let the shoulder blade reach, then row.", "stretch"],
    ],
    [
      ["Low-to-High Cable Fly", 3, "12-15", "Upper Chest", "Cable Stack", "Finish hands above sternum, pecs fully shortened.", "volume"],
      ["Incline Smith Press Back-Off", 2, "12-15", "Upper Chest", "Smith Machine", "Mechanical back-off set, controlled tempo.", "finisher"],
      ["Machine Pullover", 3, "10-15", "Lats", "Pullover Machine", "Lat length and ribcage line, soft elbows.", "volume"],
      ["Reverse Fly Machine", 4, "12-18", "Rear Delts", "Rear-Delt Machine", "Sweep wide, avoid turning it into a row.", "finisher"],
    ],
  ),

  "arms-delts": template(
    "arms-delts",
    "Arms / Delts",
    "Delts, biceps, triceps",
    92,
    [
      ["Rear Delt Cable Fly", 2, "15-20", "Rear Delts", "Cable Stack", "Rear delt primer before pressing.", "primer"],
      ["Machine Shoulder Press", 4, "6-10", "Front Delts", "Shoulder Press Machine", "Stable heavy press, ribs stacked.", "primary"],
      ["Cable Lateral Raise", 4, "12-18", "Side Delts", "Cable Stack", "Lengthened isolation, lead with elbows.", "stretch"],
      ["Close-Grip Bench Press", 3, "8-12", "Triceps", "Barbell", "Elbows tucked; machine dip swap is fine.", "secondary"],
    ],
    [
      ["Incline Dumbbell Curl", 3, "8-12", "Biceps", "Dumbbells · Bench", "Lengthened biceps bias.", "stretch"],
      ["Rope Pressdown", 3, "12-16", "Triceps", "Cable Stack", "Lock out, split the rope.", "volume"],
      ["Machine Lateral Raise", 3, "12-20", "Side Delts", "Lateral Raise Machine", "Pause where the delt is fully shortened.", "volume"],
    ],
    [
      ["Preacher Curl", 3, "10-14", "Biceps", "Curl Machine", "Upper arm planted, no bounce.", "volume"],
      ["Overhead Cable Extension", 3, "10-14", "Long-Head Triceps", "Cable Stack", "Travel high, control the stretch.", "stretch"],
      ["Lateral Raise Mechanical Drop", 2, "12-15 + drop", "Side Delts", "Dumbbells", "Fascia Pump Finisher for width.", "finisher"],
    ],
  ),

  "chest-back": template(
    "chest-back",
    "Chest / Back",
    "Upper chest, lats, mid-back",
    120,
    [
      ["Straight-Arm Cable Pulldown", 2, "15-20", "Lats", "Cable Stack", "Prime lats before loaded pulling.", "primer"],
      ["Incline Dumbbell Press", 4, "8-11", "Upper Chest", "Dumbbells · Bench", "Deep bottom stretch, drive up and in.", "primary"],
      ["Weighted Pull-Up", 4, "6-10", "Lats", "Pull-Up Bar", "Width primer; lat pulldown substitute is fine.", "primary"],
      ["Chest-Supported T-Bar Row", 4, "8-12", "Mid-Back", "T-Bar", "Pad-supported thickness, pause each rep.", "primary"],
    ],
    [
      ["Machine Incline Press", 3, "9-12", "Upper Chest", "Incline Press Machine", "Constant-tension press, no shrug.", "volume"],
      ["Seated Cable Row", 3, "10-14", "Mid-Back", "Cable Stack", "Pull to the navel, proud chest.", "secondary"],
      ["Low-to-High Cable Fly", 3, "12-15", "Upper Chest", "Cable Stack", "Finish hands above sternum.", "stretch"],
    ],
    [
      ["Machine Pullover", 3, "10-15", "Lats", "Pullover Machine", "Lat length, soft elbows.", "volume"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Sweep wide, no row.", "volume"],
      ["Cable Squeeze Press", 2, "15-20", "Chest", "Cable Stack", "Stretch-Pump Finisher for chest density.", "finisher"],
      ["Upper-Back Cable Finisher", 2, "15-20", "Mid-Back", "Cable Stack", "Pump finisher for back detail.", "finisher"],
    ],
  ),

  "lower-posterior": template(
    "lower-posterior",
    "Lower / Posterior",
    "Hamstrings, glutes, lower back, calves",
    112,
    [
      ["Hip Hinge Rehearsal", 2, "10-12", "Hamstrings", "Bodyweight", "Primer for hinge mechanics and hamstring length.", "primer"],
      ["Seated Leg Curl", 2, "12-15", "Hamstrings", "Leg Curl Machine", "Hamstring activation before the hinge.", "activation"],
      ["Romanian Deadlift", 4, "6-9", "Hamstrings", "Barbell", "Loaded lengthened tension, brace hard.", "primary"],
      ["Hip Thrust", 4, "8-12", "Glutes", "Barbell", "Posterior tilt at lockout, no lumbar takeover.", "primary"],
    ],
    [
      ["Hack Squat", 3, "8-12", "Quads", "Hack Squat", "Secondary knee-dominant volume; leg press swap is fine.", "secondary"],
      ["Lying Leg Curl", 4, "8-12", "Hamstrings", "Leg Curl Machine", "Hips heavy, curl through the pad.", "stretch"],
      ["Back Extension", 3, "10-14", "Glutes / Lower Back", "45 Degree Bench", "Round slightly, squeeze glutes at lockout.", "volume"],
    ],
    [
      ["Walking Lunge", 3, "10-12 / leg", "Glutes", "Dumbbells", "Long stride, no bounce.", "volume"],
      ["Seated Calf Raise", 4, "10-15", "Calves", "Calf Raise Machine", "Pause low, full peak.", "volume"],
      ["Standing Calf Raise", 3, "12-16", "Calves", "Calf Raise Machine", "Straight-leg calf pump.", "finisher"],
    ],
  ),
};

/* ════════════════════════════════════════════════════════════════════════
   ARCHETYPE-SPECIFIC WORKOUT TEMPLATES (Protocol Architecture 2.0 — depth layer)
   ------------------------------------------------------------------------
   The split templates above are pattern-level (chest / back / lower-posterior).
   Many blueprint archetypes used to collapse onto the same split template, so
   Glute Strength / Shape / Pump / Detail (and many others) felt identical
   underneath even though the weekly schedule differed.

   These templates give each archetype its OWN training identity: distinct
   movement bias, rep style, tempo, supersets/finishers, and session demand —
   while reusing the same builder so progression, substitutions, intensity
   scaling, and experience scaling all keep working. Programming only — no
   medical, dosing, hormone, or supplement content.
   ════════════════════════════════════════════════════════════════════════ */

/** Build an archetype template via the shared builder, then namespace every id
 *  by archetype so multiple archetypes can safely share a base SplitKey without
 *  colliding on movement / phase ids (React keys, logging, preferences). */
function archetypeTemplate(
  archetype: SessionArchetype,
  splitKey: SplitKey,
  displayName: string,
  focus: string,
  estimatedDurationMin: number,
  p1: RawMovement[],
  p2: RawMovement[],
  p3: RawMovement[],
  meta: TemplateMeta = {},
): WorkoutTemplate {
  const t = template(splitKey, displayName, focus, estimatedDurationMin, p1, p2, p3, meta);
  return {
    ...t,
    id: `archetype-${archetype}`,
    phases: t.phases.map((ph) => ({
      ...ph,
      id: `${archetype}-${ph.priority.toLowerCase()}`,
      movements: ph.movements.map((m) => ({ ...m, id: `${archetype}-${slug(m.name)}` })),
    })),
  };
}

export const ARCHETYPE_TEMPLATES: Partial<Record<SessionArchetype, WorkoutTemplate>> = {
  /* ─── Chest-led ─────────────────────────────────────────────────────────── */
  "chest-strength": archetypeTemplate(
    "chest-strength", "chest", "Chest Priority", "Heavy incline press output, flat press support, triceps lockout", 96,
    [
      ["Low Cable Chest Primer", 2, "15-20", "Upper Chest", "Cable Stack", "Prime the pecs without spending the press.", "primer"],
      ["Low Incline Barbell Press", 5, "4-6", "Upper Chest", "Barbell · Adjustable Bench", "Primary heavy press — beat last week's top set.", "primary"],
      ["Flat Barbell Press", 4, "5-8", "Mid Chest", "Barbell · Bench", "Heavy flat support after the incline priority.", "secondary"],
    ],
    [
      ["Weighted Dip", 3, "6-10", "Lower Chest", "Dip Station", "Loaded lower-chest pressing strength.", "secondary"],
      ["Incline Dumbbell Press", 3, "8-10", "Upper Chest", "Dumbbells · Bench", "Controlled stretch overload, own the bottom.", "stretch"],
    ],
    [
      ["Close-Grip Bench Press", 3, "8-10", "Triceps", "Barbell", "Triceps lockout support for the press.", "volume"],
      ["High-to-Low Cable Fly", 2, "12-15", "Lower Chest", "Cable Stack", "Squeeze finisher to close the chest signal.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: heavy press identity — low reps, full recovery between top sets, progressive overload on the incline lead.",
      weakPointPriority: "Upper-chest pressing strength · flat support · triceps lockout",
      warmUpPrimer: "PRIME THE TARGET: t-spine extension, band pull-aparts, cuff work, two ramp sets into the heavy incline.",
    },
  ),
  "chest-hypertrophy": archetypeTemplate(
    "chest-hypertrophy", "chest", "Chest Hypertrophy", "Controlled-tempo press volume and constant-tension pump", 92,
    [
      ["Incline Machine Press", 2, "12-15", "Upper Chest", "Incline Press Machine", "Feel the upper chest before loading.", "activation"],
      ["Incline Dumbbell Press", 4, "8-12", "Upper Chest", "Dumbbells · Bench", "Primary volume — controlled eccentric.", "primary", "3-1-1-0"],
      ["Converging Machine Chest Press", 4, "10-12", "Mid Chest", "Chest Press Machine", "Constant-tension press volume.", "secondary", "3-1-1-1"],
    ],
    [
      ["Pec Deck", 3, "12-15", "Mid Chest", "Pec Deck", "Stretch-biased fly, control the open.", "stretch", "3-1-1-1"],
      ["Low-to-High Cable Fly", 3, "12-16", "Upper Chest", "Cable Stack", "Clavicular pec volume.", "volume"],
    ],
    [
      ["Cable Squeeze Press", 3, "15-20", "Chest", "Cable Stack", "Peak-contraction pump set.", "finisher"],
      ["Machine Press Back-Off", 2, "15-20", "Chest", "Chest Press Machine", "Mechanical back-off pump.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: hypertrophy identity — moderate reps, slow controlled tempo, constant tension, pump to finish.",
      weakPointPriority: "Chest volume · controlled tempo · pump density",
      warmUpPrimer: "PRIME THE TARGET: scapular control, light fly ramp, then build into the working press.",
    },
  ),
  "chest-detail": archetypeTemplate(
    "chest-detail", "chest", "Chest Detail", "Upper-chest fly patterns, squeeze, and density", 84,
    [
      ["Low-to-High Cable Fly", 3, "12-15", "Upper Chest", "Cable Stack", "Open the session on the upper-chest line.", "activation"],
      ["Incline Cable Press", 4, "10-12", "Upper Chest", "Cable Stack", "Constant-tension upper-chest press.", "primary", "2-1-2-1"],
      ["Incline Dumbbell Fly", 3, "12-15", "Upper Chest", "Dumbbells · Bench", "Deep stretch, control the bottom.", "stretch", "4-1-1-0"],
    ],
    [
      ["Cross-Body Cable Fly", 3, "12-16", "Inner Chest", "Cable Stack", "Cross-body squeeze for inner density.", "volume"],
      ["Pec Deck", 3, "15-20", "Mid Chest", "Pec Deck", "Hold the shortened squeeze.", "volume", "2-2-2-1"],
    ],
    [
      ["Cable Squeeze Press", 3, "15-20", "Chest", "Cable Stack", "Density squeeze finisher.", "finisher"],
      ["Incline Squeeze Press", 2, "12-15", "Upper Chest", "Dumbbells · Bench", "Press the dumbbells together — constant tension.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: detail identity — fly and squeeze patterns, shortened-range emphasis, density over load.",
      weakPointPriority: "Upper-chest line · inner-chest density · squeeze quality",
      warmUpPrimer: "PRIME THE TARGET: scapular set, light cable flys, then build the working angles.",
    },
  ),

  /* ─── Chest + Back combo days ────────────────────────────────────────────
     Full upper-torso push/pull sessions. The week runs two of these — a heavy
     STRENGTH exposure (barbell press + weighted pull lead) and a controlled
     VOLUME exposure (machine / cable, rear-delt balance, pump finish) — so the
     two "Chest / Back" days never render the same workout. */
  "chest-back-strength": archetypeTemplate(
    "chest-back-strength", "chest-back", "Chest / Back Strength", "Heavy press + vertical pull, free-weight upper-torso strength", 120,
    [
      // P1 · Heavy Output — chest compound + back vertical-pull compound.
      ["Low Incline Barbell Press", 5, "4-6", "Upper Chest", "Barbell · Adjustable Bench", "Heavy incline press lead — beat last week's top set, full recovery between top sets.", "primary"],
      ["Weighted Pull-Up", 4, "5-8", "Lats", "Pull-Up Bar · Dip Belt", "Heavy vertical pull for width; assisted-pull-up or lat-pulldown swap is fine.", "primary"],
    ],
    [
      // P2 · Growth Volume — free-weight press + heavy supported row.
      ["Flat Dumbbell Press", 4, "6-10", "Mid Chest", "Dumbbells · Bench", "Heavy free-weight press volume — own the stretch, drive clean.", "secondary"],
      ["Chest-Supported T-Bar Row", 4, "8-12", "Mid-Back", "T-Bar", "Pad-supported thickness, pause each rep — no body english.", "secondary"],
    ],
    [
      // P3 · Stretch / pump superset + pressing finisher.
      ["Low-to-High Cable Fly", 3, "12-15", "Upper Chest", "Cable Stack", "Lengthened-tension fly — supersets with the rear-delt sweep.", "stretch"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt and upper-back balance for posture and shoulder health.", "volume"],
      ["Weighted Dip", 3, "8-12", "Lower Chest", "Dip Station", "Loaded lower-chest pressing finish.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: strength identity — heavy barbell press and loaded vertical pull lead, low reps and full recovery, then stretch-biased volume and a pressing finish.",
      weakPointPriority: "Press strength · vertical-pull width · upper-back density",
      warmUpPrimer: "PRIME THE TARGET: t-spine extension, band pull-aparts, scapular set, two ramp sets into the heavy incline.",
    },
  ),
  "chest-back-volume": archetypeTemplate(
    "chest-back-volume", "chest-back", "Chest / Back Volume", "Upper-chest + machine press volume, horizontal row, pump finish", 116,
    [
      // P1 · Heavy Output — upper-chest press (tempo) + heavy horizontal row.
      ["Incline Dumbbell Press", 4, "8-12", "Upper Chest", "Dumbbells · Bench", "Primary volume — slow controlled eccentric, own the bottom.", "primary", "3-1-1-0"],
      ["Chest-Supported Row", 4, "10-12", "Mid-Back", "Row Machine", "Heavy machine row — retract hard, no body english.", "primary"],
    ],
    [
      // P2 · Growth Volume — machine press + vertical-pull width to balance the row.
      ["Machine Incline Press", 4, "10-12", "Upper Chest", "Incline Press Machine", "Constant-tension press volume after the free-weight lead.", "secondary", "3-1-1-1"],
      ["Wide Grip Lat Pulldown", 4, "10-12", "Lats", "Cable Stack", "Vertical width to balance the horizontal row.", "secondary"],
    ],
    [
      // P3 · Stretch / pump superset + pump finisher.
      ["Pec Deck", 3, "12-15", "Mid Chest", "Pec Deck", "Stretch-biased fly — supersets with the rear-delt sweep.", "stretch", "3-1-1-1"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt and upper-back balance for posture and shoulder health.", "volume"],
      ["Cable Squeeze Press", 3, "15-20", "Chest", "Cable Stack", "Peak-contraction pump finish.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: volume identity — upper-chest and machine press volume with a heavy horizontal row, slow controlled tempo, constant tension, rear-delt balance, pump to finish.",
      weakPointPriority: "Upper-chest volume · row volume · rear-delt balance",
      warmUpPrimer: "PRIME THE TARGET: scapular set, light cable rows and flys, then build the working angles.",
    },
  ),
  "chest-back-pump": archetypeTemplate(
    "chest-back-pump", "chest-back", "Chest / Back Pump", "Cable / machine detail, lengthened tension, density pump", 108,
    [
      // P1 · moderate compounds — pump/detail day leads lighter than A/B.
      ["Incline Dumbbell Press", 4, "10-12", "Upper Chest", "Dumbbells · Bench", "Moderate-load press — chase the stretch and squeeze, not a max.", "primary", "3-1-1-0"],
      ["Seated Cable Row", 4, "12-15", "Mid-Back", "Cable Stack", "Constant-tension row, full retraction, no swing.", "primary"],
    ],
    [
      // P2 · stretch-biased detail volume.
      ["Low-to-High Cable Fly", 3, "15-20", "Upper Chest", "Cable Stack", "Lengthened-tension fly — supersets with the lat detail.", "stretch"],
      ["Machine Pullover", 3, "12-15", "Lats", "Pullover Machine", "Lat length and detail, soft elbows.", "volume"],
    ],
    [
      // P3 · pump superset + density finisher.
      ["Pec Deck", 3, "15-20", "Mid Chest", "Pec Deck", "Shortened-range squeeze — hold the contraction.", "stretch", "2-2-2-1"],
      ["Reverse Pec Deck", 3, "15-20", "Rear Delts", "Rear-Delt Machine", "Rear-delt detail and posture balance.", "volume"],
      ["Cable Squeeze Press", 3, "15-20", "Chest", "Cable Stack", "Peak-contraction density pump to close.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: pump / detail identity — moderate compounds then cable / machine isolation, higher reps, lengthened tension and density to chase blood flow and detail without heavy joint stress.",
      weakPointPriority: "Chest detail · lat detail · rear-delt balance",
      warmUpPrimer: "PRIME THE TARGET: scapular set, light cable flys and rows, ramp into the working pump ranges.",
    },
  ),

  /* ─── Back / pull ───────────────────────────────────────────────────────── */
  "back-width": archetypeTemplate(
    "back-width", "back", "Back Width", "Lat-biased vertical pulling and lengthened lat work", 92,
    [
      ["Straight-Arm Pulldown", 2, "15-20", "Lats", "Cable Stack", "Lat primer — feel the shoulder extend.", "primer"],
      ["Wide Grip Lat Pulldown", 4, "8-12", "Lats", "Cable Stack", "Width-biased vertical pull, elbows wide.", "primary"],
      ["Weighted Pull-Up", 3, "6-10", "Lats", "Pull-Up Bar", "Loaded width; assisted pull-up swap is fine.", "primary"],
    ],
    [
      ["Single-Arm Cable Pulldown", 3, "10-13", "Lats", "Cable Stack", "Lengthened unilateral lat work.", "stretch"],
      ["Neutral Grip Pulldown", 3, "10-12", "Lower Lats", "Pulldown Station", "Controlled lat volume.", "volume"],
    ],
    [
      ["Machine Pullover", 3, "12-15", "Lats", "Pullover Machine", "Lat length and ribcage line.", "volume"],
      ["Straight-Arm Pulldown Burnout", 2, "15-20", "Lats", "Cable Stack", "Lat pump finisher, no triceps takeover.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: width identity — vertical pulls and lat isolation lead, rows stay minimal so the lats own the session.",
      weakPointPriority: "Lat width · lengthened lat tension · pull-down line",
      warmUpPrimer: "PRIME THE TARGET: lat opener, scapular depression, light band rows, then ramp the first pull.",
    },
  ),
  "back-thickness": archetypeTemplate(
    "back-thickness", "back", "Back Thickness", "Heavy rows, hinges, and mid-back density", 96,
    [
      ["Chest-Supported Row", 4, "6-10", "Mid-Back", "Row Machine", "Heavy pad-supported row, pause each rep.", "primary"],
      ["Barbell Row", 4, "6-9", "Mid-Back", "Barbell", "Loaded hinge row for mid-back density.", "primary"],
    ],
    [
      ["Seated Cable Row", 3, "9-12", "Mid-Back", "Cable Stack", "Pull to the navel, proud chest.", "secondary"],
      ["T-Bar Row", 3, "8-12", "Mid-Back", "T-Bar", "Thickness volume with a strong base.", "volume"],
    ],
    [
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt and upper-back balance.", "volume"],
      ["Cable Row Mechanical Drop", 2, "12-15 + drop", "Mid-Back", "Cable Stack", "Density pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: thickness identity — horizontal rows and hinges lead, heavier loads, mid-back density over width.",
      weakPointPriority: "Mid-back density · row strength · rear-delt balance",
      warmUpPrimer: "PRIME THE TARGET: hip-hinge rehearsal, scapular retraction, light cable rows, then ramp the first row.",
    },
  ),
  "upper-back-posture": archetypeTemplate(
    "upper-back-posture", "back", "Posture Upper", "Back, rear delts, and posture — elegant upper line", 72,
    [
      ["Face Pull", 3, "15-20", "Rear Delts", "Cable Stack", "Posture primer — lower traps and external rotation.", "activation"],
      ["Chest-Supported Row", 4, "10-13", "Mid-Back", "Row Machine", "Posture-led row, set the scapula.", "primary"],
      ["Wide Grip Lat Pulldown", 3, "10-12", "Lats", "Cable Stack", "Upper-frame width.", "secondary"],
    ],
    [
      ["Reverse Pec Deck", 4, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt cap, no row takeover.", "volume"],
      ["Cable Rear-Delt Row", 3, "12-15", "Rear Delts", "Cable Stack", "High-elbow rear-delt detail.", "volume"],
    ],
    [
      ["Trap Raise", 3, "12-15", "Lower Traps", "Dumbbells · Bench", "Lower-trap posture detail.", "volume"],
      ["Band Pull Apart", 2, "20-25", "Rear Delts", "Band", "Posture pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: posture identity — rear delts, mid-back, and lower traps to build an elegant, tall upper line. No heavy spinal loading.",
      weakPointPriority: "Posture · rear-delt detail · upper-back line",
      warmUpPrimer: "PRIME THE TARGET: t-spine opener, scapular set, band pull-aparts before the first pull.",
    },
  ),

  /* ─── Shoulders / arms ──────────────────────────────────────────────────── */
  "delts-arms": archetypeTemplate(
    "delts-arms", "arms-delts", "Delts + Arms", "Shoulder press and width with biceps / triceps support", 88,
    [
      ["Rear Delt Cable Fly", 2, "15-20", "Rear Delts", "Cable Stack", "Centre the shoulder before pressing.", "primer"],
      ["Machine Shoulder Press", 4, "6-10", "Front Delts", "Shoulder Press Machine", "Stable heavy press, ribs stacked.", "primary"],
      ["Cable Lateral Raise", 4, "12-18", "Side Delts", "Cable Stack", "Lengthened width volume.", "stretch"],
    ],
    [
      ["Close-Grip Bench Press", 3, "8-12", "Triceps", "Barbell", "Elbows tucked — triceps strength.", "secondary"],
      ["Incline Dumbbell Curl", 3, "8-12", "Biceps", "Dumbbells · Bench", "Lengthened biceps bias.", "stretch"],
    ],
    [
      ["Machine Lateral Raise", 3, "12-20", "Side Delts", "Lateral Raise Machine", "Shortened side-delt volume.", "volume"],
      ["Rope Pressdown", 3, "12-16", "Triceps", "Cable Stack", "Triceps pump.", "volume"],
      ["Cable Curl", 2, "12-16", "Biceps", "Cable Stack", "Biceps pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: delts lead the session, arms support — press and lateral width first, then biceps / triceps volume.",
      weakPointPriority: "Shoulder width · press strength · arm detail",
    },
  ),
  "arms-pump": archetypeTemplate(
    "arms-pump", "arms", "Arms Pump", "Biceps and triceps volume with high-density finishers", 72,
    [
      ["Cable Curl Primer", 2, "15-20", "Biceps", "Cable Stack", "Prime elbow flexion, no swing.", "primer"],
      ["EZ-Bar Curl", 4, "8-12", "Biceps", "EZ-Bar", "Primary curl output, strict upper arm.", "primary"],
      ["Close-Grip Bench Press", 3, "8-12", "Triceps", "Barbell", "Primary triceps output.", "primary"],
    ],
    [
      ["Incline Dumbbell Curl", 3, "10-12", "Biceps", "Dumbbells · Bench", "Lengthened biceps volume.", "stretch"],
      ["Overhead Cable Triceps Extension", 3, "12-15", "Long-Head Triceps", "Cable Stack", "Long-head stretch volume.", "stretch"],
    ],
    [
      ["Cable Curl 21s", 3, "21", "Biceps", "Cable Stack", "Density 21s finisher.", "finisher"],
      ["Rope Pressdown", 3, "15-20", "Triceps", "Cable Stack", "Triceps pump, short rest.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: arm-pump identity — alternating flexion / extension volume, short rest, density finishers. Build the pump, not the 1RM.",
      weakPointPriority: "Arm volume · pump density · elbow-flexor and triceps detail",
    },
  ),

  /* ─── Upper composites ──────────────────────────────────────────────────── */
  "upper-strength": archetypeTemplate(
    "upper-strength", "upper", "Upper Strength", "Heavy upper compounds — press and pull strength", 96,
    [
      ["Band Pull Apart", 2, "15-20", "Rear Delts", "Band", "Prime the upper back and cuff.", "primer"],
      ["Incline Barbell Press", 4, "4-6", "Upper Chest", "Barbell · Adjustable Bench", "Heavy upper press lead.", "primary"],
      ["Weighted Pull-Up", 4, "4-6", "Lats", "Pull-Up Bar", "Heavy vertical pull.", "primary"],
    ],
    [
      ["Seated Barbell Overhead Press", 3, "5-8", "Front Delts", "Barbell", "Overhead pressing strength.", "secondary"],
      ["Chest-Supported Row", 3, "6-10", "Mid-Back", "Row Machine", "Heavy row support.", "secondary"],
    ],
    [
      ["Close-Grip Bench Press", 3, "6-10", "Triceps", "Barbell", "Triceps strength.", "volume"],
      ["Cable Lateral Raise", 3, "10-15", "Side Delts", "Cable Stack", "Width volume to finish.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: upper-strength identity — heavy compound press and pull, low reps, full recovery between top sets.",
      weakPointPriority: "Upper pressing strength · vertical pull strength · overhead press",
      warmUpPrimer: "PRIME THE TARGET: cuff and scapular prep, ramp sets into each heavy compound.",
    },
  ),
  "upper-tone": archetypeTemplate(
    "upper-tone", "upper", "Upper Tone", "Shoulders, arms, and back definition — not chest-heavy", 64,
    [
      ["Cable Lateral Raise", 3, "12-18", "Side Delts", "Cable Stack", "Shoulder-line activation.", "activation"],
      ["Lat Pulldown", 4, "10-12", "Lats", "Cable Stack", "Back definition lead.", "primary"],
      ["Seated Dumbbell Shoulder Press", 3, "10-12", "Front Delts", "Dumbbells · Bench", "Controlled shoulder press.", "secondary"],
    ],
    [
      ["Chest-Supported Row", 3, "10-14", "Mid-Back", "Row Machine", "Back-line tone.", "volume"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt cap.", "volume"],
    ],
    [
      ["Rope Pressdown", 3, "12-16", "Triceps", "Cable Stack", "Triceps definition.", "volume"],
      ["Cable Curl", 3, "12-16", "Biceps", "Cable Stack", "Biceps definition.", "volume"],
      ["Lateral Raise Mechanical Drop", 2, "12-15 + drop", "Side Delts", "Dumbbells", "Shoulder-line pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: upper-tone identity — shoulders, arms, and back definition with controlled loads. Deliberately not chest-heavy.",
      weakPointPriority: "Shoulder shape · back definition · arm tone",
    },
  ),
  "posture-upper": archetypeTemplate(
    "posture-upper", "upper", "Posture Upper", "Back, rear delts, shoulders, and posture — elegant upper tone", 60,
    [
      ["Band Pull Apart", 2, "20-25", "Rear Delts", "Band", "Posture and cuff primer.", "activation"],
      ["Face Pull", 3, "15-20", "Rear Delts", "Cable Stack", "Lower-trap and posture activation.", "activation"],
      ["Lat Pulldown", 4, "10-12", "Lats", "Cable Stack", "Upper-frame width lead.", "primary"],
    ],
    [
      ["Chest-Supported Row", 4, "10-14", "Mid-Back", "Row Machine", "Posture-led back-line work.", "volume"],
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt detail.", "volume"],
    ],
    [
      ["Cable Lateral Raise", 3, "12-16", "Side Delts", "Cable Stack", "Clean shoulder-line shape.", "volume"],
      ["Anti-Extension Core Hold", 3, "30-45 sec", "Core", "Bodyweight", "Posture brace — ribs down.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: posture identity — rear delts, mid-back, shoulders, and core bracing for a tall, elegant upper line.",
      weakPointPriority: "Posture · rear-delt detail · shoulder-line shape",
      warmUpPrimer: "PRIME THE TARGET: t-spine opener, band pull-aparts, scapular set before the first pull.",
    },
  ),

  /* ─── Lower composites / athletic ───────────────────────────────────────── */
  "lower-power": archetypeTemplate(
    "lower-power", "lower", "Lower Power", "Explosive lower output and athletic force", 80,
    [
      ["Box Jump", 4, "3-5", "Power", "Plyo Box", "Explosive intent — land soft, full reset.", "primer", "X-X-X-X"],
      ["Trap Bar Deadlift", 4, "3-5", "Glutes", "Trap Bar", "Explosive concentric, full recovery between sets.", "primary", "X-1-X-1"],
      ["Back Squat", 4, "4-6", "Quads", "Barbell", "Force production — controlled down, drive up.", "primary"],
    ],
    [
      ["Bulgarian Split Squat", 3, "6-8 / leg", "Quads", "Dumbbells", "Unilateral force and balance.", "secondary"],
      ["Romanian Deadlift", 3, "6-8", "Hamstrings", "Barbell", "Posterior-chain strength support.", "secondary"],
    ],
    [
      ["Standing Calf Raise", 3, "8-12", "Calves", "Calf Raise Machine", "Stiff-ankle power support.", "volume"],
      ["Weighted Plank", 3, "30-45 sec", "Core", "Plate", "Trunk stiffness for force transfer.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: power identity — explosive intent, low reps, full recovery between sets. Bar speed and quality over fatigue.",
      weakPointPriority: "Explosive force · lower-body strength · rate of force",
      warmUpPrimer: "PRIME THE TARGET: dynamic hips and ankles, low-volume jumps, then ramp the main lift. Stop a set if bar speed drops.",
    },
  ),
  "sprint-power": archetypeTemplate(
    "sprint-power", "lower", "Sprint Power", "Acceleration mechanics and plyometric conditioning", 70,
    [
      ["A-Skip + Pogo Primer", 2, "20 m", "Power", "Track", "Groove sprint mechanics and stiffness.", "primer", "X-X-X-X"],
      ["Sprint Acceleration", 6, "20-30 m", "Power", "Track", "Quality accelerations — full recovery between reps.", "primary", "X-X-X-X"],
      ["Broad Jump", 4, "3", "Power", "Bodyweight", "Horizontal force, reset every rep.", "primary", "X-X-X-X"],
    ],
    [
      ["Hip Thrust", 3, "5-8", "Glutes", "Barbell", "Hip-extension force for sprinting.", "secondary"],
      ["Sled Push", 4, "15-20 m", "Quads", "Sled", "Acceleration-specific resistance.", "volume"],
      ["Sled Pull", 3, "15-20 m", "Hamstrings", "Sled · Harness", "Backward drag — the posterior half the push never trains.", "volume"],
    ],
    [
      ["Pogo Hops", 3, "10", "Calves", "Bodyweight", "Reactive ankle stiffness.", "finisher", "X-X-X-X"],
      ["Hanging Knee Raise", 3, "12-15", "Core", "Pull-Up Bar", "Sprint-posture core.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: sprint identity — acceleration and plyo quality with full recovery. This is a CNS / mechanics day, never a fatigue grind.",
      weakPointPriority: "Acceleration · reactive stiffness · hip-extension power",
      warmUpPrimer: "PRIME THE TARGET: thorough dynamic warm-up, build-up runs, then quality sprints. Stop a rep set when output drops. Stop with pain and follow clinician guidance.",
    },
  ),
  "quad-focus": archetypeTemplate(
    "quad-focus", "legs", "Quad Shape", "Knee-dominant volume and quad-sweep detail", 84,
    [
      ["Heel-Elevated Smith Squat", 2, "10-12", "Quads", "Smith Machine", "Quad-biased primer and ramp.", "activation"],
      ["Hack Squat", 4, "8-12", "Quads", "Hack Squat", "Knee-dominant lead, full depth.", "primary"],
      ["Leg Press", 4, "10-14", "Quads", "Leg Press", "Quad volume — feet low for quad bias.", "secondary"],
    ],
    [
      ["Bulgarian Split Squat", 3, "10-12 / leg", "Quads", "Dumbbells", "Unilateral quad volume.", "volume"],
      ["Landmine Squat", 3, "10-14", "Quads", "Landmine", "Upright drive on a fixed arc — depth without the lower back.", "volume", "2-1-1-1"],
      ["Leg Extension", 4, "12-16", "Quads", "Leg Extension Machine", "Shortened quad volume, hold the top.", "stretch", "3-1-1-1"],
    ],
    [
      ["Walking Lunge", 3, "12 / leg", "Quads", "Dumbbells", "Long stride, no bounce — the station that lengthens the leg line.", "finisher"],
      ["Sissy Squat", 3, "12-15", "Quads", "Bodyweight", "Lengthened quad detail.", "finisher"],
      ["Cyclist Squat", 2, "15-20", "Quads", "Smith Machine", "Quad-sweep pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: quad identity — knee-dominant patterns lead, hinge stays minimal so the quads own the volume and the sweep.",
      weakPointPriority: "Quad sweep · knee-dominant volume · teardrop detail",
      warmUpPrimer: "PRIME THE TARGET: knee and ankle mobility, light extensions, then ramp the squat pattern.",
    },
  ),
  "hamstring-glute": archetypeTemplate(
    "hamstring-glute", "lower-posterior", "Hamstring Glute", "RDL / curl / hinge focus with glute support", 84,
    [
      ["Hip Hinge Rehearsal", 2, "10-12", "Hamstrings", "Bodyweight", "Groove the hinge and hamstring length.", "primer"],
      ["Romanian Deadlift", 4, "6-9", "Hamstrings", "Barbell", "Loaded lengthened hinge lead.", "primary"],
      ["Lying Leg Curl", 4, "8-12", "Hamstrings", "Leg Curl Machine", "Knee-flexion hamstring volume.", "secondary"],
    ],
    [
      ["Seated Leg Curl", 3, "10-14", "Hamstrings", "Leg Curl Machine", "Lengthened hamstring volume.", "stretch", "4-1-1-0"],
      ["Single-Leg Romanian Deadlift", 3, "10-12 / leg", "Hamstrings", "Dumbbells", "One leg at a time — balance exposes the side that is behind.", "volume", "3-1-1-1"],
      ["Cable Pull-Through", 3, "12-15", "Glutes", "Cable Stack", "Glute-supported hinge.", "volume"],
    ],
    [
      ["45-Degree Back Extension", 3, "12-15", "Glutes", "45 Degree Bench", "Glute-biased posterior shape.", "volume"],
      ["Kettlebell Swing", 3, "15-20", "Glutes", "Kettlebell", "Ballistic hinge — hips snap, arms stay passive.", "finisher"],
      ["Nordic Curl", 2, "6-10", "Hamstrings", "Bodyweight", "Eccentric hamstring finisher.", "finisher", "4-1-1-0"],
    ],
    {
      sessionIntent: "SESSION INTENT: hamstring identity — hinge and curl lead, glutes support. Both knee-flexion and hip-hinge hamstring functions trained.",
      weakPointPriority: "Hamstring length · hinge strength · glute support",
      warmUpPrimer: "PRIME THE TARGET: hinge rehearsal, hamstring floss, glute bridge, then ramp the RDL.",
    },
  ),

  /* ─── Glute-led (women's identities) ────────────────────────────────────── */
  "glute-strength": archetypeTemplate(
    "glute-strength", "lower-posterior", "Glute Strength", "Heavy hip thrust / squat / hinge bias — progressive overload", 88,
    [
      ["Glute Bridge", 2, "12-15", "Glutes", "Bodyweight", "Glute activation before the heavy hinge.", "activation"],
      ["Barbell Hip Thrust", 5, "6-8", "Glutes", "Barbell", "Top hip-extension lead — beat last week's load.", "primary"],
      ["Romanian Deadlift", 4, "6-8", "Glutes", "Barbell", "Loaded hinge for glutes and hamstrings.", "secondary"],
    ],
    [
      ["Bulgarian Split Squat", 3, "8-10 / leg", "Glutes", "Dumbbells", "Glute-biased unilateral strength.", "secondary"],
      ["45-Degree Back Extension", 3, "10-12", "Glutes", "45 Degree Bench", "Round slightly, squeeze at lockout.", "volume"],
    ],
    [
      ["Abductor Machine", 3, "12-15", "Glutes", "Abductor Machine", "Glute medius strength.", "volume"],
      ["Cable Pull-Through", 2, "12-15", "Glutes", "Cable Stack", "Hip-hinge contraction finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: glute-strength identity — heavy hip thrust and hinge lead, lower reps, progressive overload. The glutes drive every rep, not the lower back.",
      weakPointPriority: "Glute strength · hip-extension load · hinge strength",
      warmUpPrimer: "PRIME THE TARGET: glute bridges, hip mobility, banded activation, then ramp the hip thrust.",
    },
  ),
  "glute-shape": archetypeTemplate(
    "glute-shape", "lower-posterior", "Glute Shape", "Glute medius and upper glute — medium reps, controlled tempo", 80,
    [
      ["Banded Glute Bridge", 2, "15-20", "Glutes", "Band", "Activate the upper glute and medius.", "activation"],
      ["Hip Thrust", 4, "10-12", "Glutes", "Barbell", "Controlled-tempo glute volume.", "primary", "2-1-2-1"],
      ["Bulgarian Split Squat", 3, "10-12 / leg", "Glutes", "Dumbbells", "Glute-biased unilateral shape.", "secondary"],
    ],
    [
      ["Abductor Machine", 4, "15-20", "Glutes", "Abductor Machine", "Glute medius shape — controlled.", "volume", "2-1-2-1"],
      ["Cable Glute Kickback", 3, "12-15 / side", "Glutes", "Cable Stack", "Upper-glute contraction.", "volume"],
    ],
    [
      ["Single-Leg Hip Thrust", 3, "12 / side", "Glutes", "Bench", "Unilateral upper-glute shape.", "finisher"],
      ["Banded Lateral Walk", 2, "20 / side", "Glutes", "Band", "Glute medius pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: glute-shape identity — glute medius and upper glute, medium reps, controlled tempo. Shape and roundness, not max load.",
      weakPointPriority: "Glute medius · upper-glute shape · hip stability",
      warmUpPrimer: "PRIME THE TARGET: banded activation, hip mobility, then build into the working sets.",
    },
  ),
  /* A nine-station circuit, not a lifting session with the word "pump" on it.
     Its intent always promised short rest; the rests were role defaults of a
     minute and a half, so it read as a slow accessory day. Rest is authored
     here: fifteen seconds between stations, one real rest on the single loaded
     lead. Light load, high reps, free weights alongside the cables — goblet,
     curtsy and landmine work sculpt the leg line without adding thickness. */
  "glute-pump": archetypeTemplate(
    "glute-pump", "lower-posterior", "Glute Pump", "Nine stations, light load, high reps, fifteen-second rests", 58,
    [
      ["Banded Glute Bridge", 3, "20-25", "Glutes", "Band", "Build the pump before anything is loaded.", "activation", undefined, undefined, "0:15"],
      ["Hip Thrust", 4, "15-20", "Glutes", "Barbell", "The one loaded lead — the only real rest in the session.", "primary", "2-0-1-1", undefined, "0:45"],
      ["Goblet Squat", 3, "15-20", "Glutes", "Kettlebell", "Upright torso, deep and controlled — legs long, not blocky.", "secondary", "2-1-1-1", undefined, "0:15"],
    ],
    [
      ["Cable Glute Kickback", 4, "15-20 / side", "Glutes", "Cable Stack", "Constant tension, no swing from the lower back.", "volume", undefined, undefined, "0:15"],
      ["Abductor Machine", 4, "20-25", "Glutes", "Abductor Machine", "Medius volume — hold the top for a beat.", "volume", undefined, undefined, "0:15"],
      ["Curtsy Lunge", 3, "15 / leg", "Glutes", "Dumbbells", "Cross behind and sit — the glute sweep station.", "volume", "2-1-1-1", undefined, "0:15"],
    ],
    [
      ["Landmine Squat", 3, "15-20", "Glutes", "Landmine", "Light sleeve, upright drive. Knee-friendly depth under load.", "finisher", "2-1-1-1", undefined, "0:15"],
      ["Banded Lateral Walk", 3, "20 / side", "Glutes", "Band", "Stay low — the burn is the point.", "finisher", undefined, undefined, "0:15"],
      ["Frog Pump", 2, "30", "Glutes", "Bodyweight", "Heels together, knees out. Close the session out.", "finisher", undefined, undefined, "0:15"],
    ],
    {
      sessionIntent: "SESSION INTENT: glute-pump identity — nine stations, light load, high reps, fifteen seconds between them. One loaded lead gets a real rest; everything after it runs as a circuit. Chase tension and the burn, never the weight on the bar.",
      weakPointPriority: "Glute metabolic volume · medius burn · pump density",
      warmUpPrimer: "PRIME THE TARGET: banded activation and hip mobility, then keep rest short and tension constant all the way through.",
      executionStandard: "RESERVE STANDARD: load stays light enough to hold form at the top of every rep range. If a station breaks down, drop the weight rather than the reps. Stop with pain and follow clinician guidance.",
      optionalAddOns: ["Optional Incline Walk Cooldown", "Optional Core Finisher"],
      circuitStyle: true,
    },
  ),
  "glute-detail": archetypeTemplate(
    "glute-detail", "lower-posterior", "Glute Detail", "Single-leg, abductors, and glute-ham tie-in — shape refinement", 76,
    [
      ["Single-Leg Glute Bridge", 2, "12 / side", "Glutes", "Bodyweight", "Unilateral activation and balance.", "activation"],
      ["Single-Leg Hip Thrust", 4, "10-12 / side", "Glutes", "Bench", "Unilateral glute detail lead.", "primary"],
      ["Step-Up", 3, "10-12 / leg", "Glutes", "Dumbbells", "Glute-biased step, control the descent.", "secondary"],
    ],
    [
      ["Cable Glute Kickback", 4, "15-20 / side", "Glutes", "Cable Stack", "Upper-glute contraction detail.", "volume"],
      ["Abductor Machine", 3, "15-20", "Glutes", "Abductor Machine", "Glute medius refinement.", "volume"],
    ],
    [
      ["45-Degree Back Extension", 3, "12-15", "Glutes", "45 Degree Bench", "Glute-ham tie-in.", "volume"],
      ["Curtsy Lunge", 2, "12 / leg", "Glutes", "Dumbbells", "Glute-sweep detail finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: glute-detail identity — single-leg work, abductors, and the glute-ham tie-in for shape refinement and side-to-side balance.",
      weakPointPriority: "Single-leg glute detail · medius shape · glute-ham tie-in",
      warmUpPrimer: "PRIME THE TARGET: single-leg balance drills, banded activation, then build the unilateral work.",
    },
  ),
  abductors: archetypeTemplate(
    "abductors", "lower-posterior", "Abductors + Glute Medius", "Hip abduction and lateral glute stability", 56,
    [
      ["Banded Lateral Walk", 2, "20 / side", "Glutes", "Band", "Medius activation primer.", "activation"],
      ["Abductor Machine", 5, "15-20", "Glutes", "Abductor Machine", "Primary medius volume.", "primary", "2-1-2-1"],
      ["Cable Hip Abduction", 4, "15-20 / side", "Glutes", "Cable Stack", "Standing medius load.", "secondary"],
    ],
    [
      ["Single-Leg Hip Thrust", 3, "12 / side", "Glutes", "Bench", "Unilateral glute support.", "volume"],
      ["Lateral Lunge", 3, "10-12 / leg", "Glutes", "Dumbbells", "Frontal-plane glute work.", "volume"],
    ],
    [
      ["Banded Clamshell", 3, "20 / side", "Glutes", "Band", "Medius detail.", "finisher"],
      ["Glute Bridge Abduction", 2, "20", "Glutes", "Band", "Bridge-and-abduct pump finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: abductor identity — frontal-plane hip abduction and lateral glute stability for medius shape and hip control.",
      weakPointPriority: "Glute medius · hip abduction · lateral stability",
    },
  ),
  "legs-waistline": archetypeTemplate(
    "legs-waistline", "legs", "Legs + Waistline", "Leg work with core / waistline conditioning — not heavy bodybuilding", 64,
    [
      ["Goblet Squat", 3, "12-15", "Quads", "Dumbbell", "Controlled squat pattern, moderate load.", "activation"],
      ["Walking Lunge", 3, "12 / leg", "Glutes", "Dumbbells", "Long-stride leg conditioning.", "primary"],
      ["Romanian Deadlift", 3, "10-12", "Hamstrings", "Dumbbells", "Moderate hinge for the posterior chain.", "secondary"],
    ],
    [
      ["Leg Extension", 3, "15-20", "Quads", "Leg Extension Machine", "Quad volume, controlled.", "volume"],
      ["Lying Leg Curl", 3, "12-15", "Hamstrings", "Leg Curl Machine", "Hamstring volume.", "volume"],
    ],
    [
      ["Cable Crunch", 3, "15-20", "Core", "Cable Stack", "Loaded waistline flexion.", "volume"],
      ["Anti-Rotation Core Brace", 3, "10-12 / side", "Core", "Cable Stack", "Waist control — resist rotation.", "volume"],
      ["Incline Walk", 1, "10-15 min", "Conditioning", "Treadmill", "Conditioning handoff.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: legs + waistline identity — moderate leg volume paired with core and waistline conditioning. Conditioning-led, not a heavy bodybuilding leg day.",
      weakPointPriority: "Leg conditioning · waist control · core endurance",
      optionalAddOns: ["Optional Zone 2 Extension", "Optional Sauna if hydrated"],
    },
  ),
  calves: archetypeTemplate(
    "calves", "legs", "Calves + Lower Leg", "Complete calf and lower-leg development", 48,
    [
      ["Standing Calf Raise", 4, "10-12", "Calves", "Calf Raise Machine", "Straight-leg gastroc output, full stretch.", "primary", "2-2-1-1"],
      ["Seated Calf Raise", 4, "12-16", "Calves", "Calf Raise Machine", "Bent-knee soleus work.", "secondary", "2-2-1-1"],
    ],
    [
      ["Leg Press Calf Raise", 3, "12-15", "Calves", "Leg Press", "Loaded calf volume.", "volume"],
      ["Tibialis Raise", 3, "15-20", "Tibialis", "Tibialis Bar", "Anterior lower-leg balance.", "volume"],
    ],
    [
      ["Donkey Calf Raise", 2, "15-20", "Calves", "Calf Raise Machine", "Stretched gastroc finisher.", "finisher"],
      ["Single-Leg Calf Raise", 2, "12 / side", "Calves", "Bodyweight", "Unilateral calf detail.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: lower-leg identity — straight-leg and bent-knee calf work plus tibialis balance, full range and long pauses.",
      weakPointPriority: "Gastrocnemius · soleus · tibialis balance",
    },
  ),

  /* ─── Athletic / conditioning ───────────────────────────────────────────── */
  "full-body-athletic": archetypeTemplate(
    "full-body-athletic", "full-body", "Full Body Athletic", "Athletic strength, carries, core, and conditioning", 72,
    [
      ["Trap Bar Deadlift", 4, "5", "Glutes", "Trap Bar", "Athletic pull — strong and explosive.", "primary"],
      ["Push Press", 3, "5-8", "Front Delts", "Barbell", "Total-body overhead drive.", "primary"],
      ["Chin-Up", 3, "6-10", "Lats", "Pull-Up Bar", "Vertical pull strength.", "secondary"],
    ],
    [
      ["Walking Lunge", 3, "10 / leg", "Quads", "Dumbbells", "Loaded carry-over leg work.", "volume"],
      ["Sled Push", 3, "20 m", "Quads", "Sled", "Horizontal drive — the hybrid conditioning station.", "volume"],
      ["Farmer Carry", 3, "40 m", "Core", "Dumbbells", "Loaded carry — trunk and grip.", "volume"],
    ],
    [
      ["Pallof Press", 3, "10-12 / side", "Core", "Cable Stack", "Anti-rotation trunk control.", "volume"],
      ["Kettlebell Swing", 3, "15", "Glutes", "Kettlebell", "Ballistic hip-hinge conditioning finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: athletic identity — full-body compound strength, loaded carries, and core that transfers to performance. Conditioning close.",
      weakPointPriority: "Total-body strength · carries · trunk control",
      warmUpPrimer: "PRIME THE TARGET: full-body dynamic warm-up, then ramp the main lifts.",
    },
  ),
  conditioning: archetypeTemplate(
    "conditioning", "full-body", "Conditioning + Core", "Interval conditioning and core capacity", 44,
    [
      ["Rower Intervals", 6, "250 m", "Conditioning", "Rower", "Hard interval, equal recovery.", "primary", "X-X-X-X"],
      ["Kettlebell Swing", 4, "15", "Glutes", "Kettlebell", "Ballistic hinge conditioning.", "secondary"],
    ],
    [
      ["Sled Push", 4, "20 m", "Quads", "Sled", "Low-impact power conditioning.", "volume"],
      ["Battle Rope", 4, "30 sec", "Conditioning", "Battle Rope", "Upper conditioning intervals.", "volume"],
    ],
    [
      ["Hanging Knee Raise", 3, "12-15", "Core", "Pull-Up Bar", "Core capacity.", "volume"],
      ["Plank", 3, "45 sec", "Core", "Bodyweight", "Trunk endurance finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: conditioning identity — interval work capacity and core endurance. Manage intensity by breathing, not failure.",
      weakPointPriority: "Work capacity · conditioning · core endurance",
      warmUpPrimer: "PRIME THE TARGET: easy aerobic build-up and joint prep before the first interval.",
    },
  ),
  "sport-conditioning": archetypeTemplate(
    "sport-conditioning", "full-body", "Sport Conditioning", "Agility, intervals, and movement capacity", 52,
    [
      ["Dynamic Agility Warm-Up", 2, "1 round", "Conditioning", "Cones", "Movement prep and change of direction.", "primer", "X-X-X-X"],
      ["Shuttle Run", 6, "1 set", "Conditioning", "Track", "Change-of-direction intervals, quality first.", "primary", "X-X-X-X"],
      ["Lateral Bound", 4, "4 / side", "Power", "Bodyweight", "Frontal-plane reactive power.", "primary", "X-X-X-X"],
    ],
    [
      ["Sled Push", 4, "20 m", "Quads", "Sled", "Acceleration conditioning.", "volume"],
      ["Med Ball Rotational Throw", 3, "8 / side", "Core", "Medicine Ball", "Rotational power and capacity.", "volume"],
    ],
    [
      ["Farmer Carry", 3, "40 m", "Core", "Dumbbells", "Loaded movement capacity.", "volume"],
      ["Anti-Rotation Core Brace", 3, "10 / side", "Core", "Cable Stack", "Trunk control finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: sport identity — agility, change of direction, and movement capacity. Quality reps with full recovery, never a fatigue grind.",
      weakPointPriority: "Agility · movement capacity · rotational power",
      warmUpPrimer: "PRIME THE TARGET: thorough dynamic warm-up and movement prep. Stop with pain and follow clinician guidance.",
    },
  ),

  /* ─── Core / waist / low-impact ─────────────────────────────────────────── */
  core: archetypeTemplate(
    "core", "full-body", "Core", "Braced and anti-rotation core training", 40,
    [
      ["Dead Bug", 2, "10 / side", "Core", "Bodyweight", "Brace primer — ribs down.", "activation"],
      ["Cable Crunch", 4, "12-15", "Core", "Cable Stack", "Loaded spinal flexion.", "primary"],
      ["Hanging Leg Raise", 3, "10-12", "Core", "Pull-Up Bar", "Lower-ab control.", "secondary"],
    ],
    [
      ["Pallof Press", 3, "10-12 / side", "Core", "Cable Stack", "Anti-rotation control.", "volume"],
      ["Ab Wheel Rollout", 3, "8-12", "Core", "Ab Wheel", "Anti-extension strength.", "volume"],
    ],
    [
      ["Weighted Plank", 3, "30-45 sec", "Core", "Plate", "Brace endurance.", "finisher"],
      ["Side Plank", 2, "30 sec / side", "Core", "Bodyweight", "Lateral trunk finisher.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: core identity — loaded flexion, anti-rotation, and anti-extension. Bracing quality over rep count.",
      weakPointPriority: "Trunk control · anti-rotation · brace endurance",
    },
  ),
  waistline: archetypeTemplate(
    "waistline", "full-body", "Waistline", "Waist control, anti-rotation, low-impact conditioning", 36,
    [
      ["Dead Bug", 2, "10 / side", "Core", "Bodyweight", "Brace primer.", "activation"],
      ["Cable Woodchop", 3, "12 / side", "Core", "Cable Stack", "Rotational waist control.", "primary"],
      ["Hanging Knee Raise", 3, "12-15", "Core", "Pull-Up Bar", "Lower-ab control.", "secondary"],
    ],
    [
      ["Pallof Press", 3, "12 / side", "Core", "Cable Stack", "Anti-rotation control.", "volume"],
      ["Anti-Extension Core Hold", 3, "30-45 sec", "Core", "Bodyweight", "Waist brace, ribs down.", "volume"],
    ],
    [
      ["Bicycle Crunch", 3, "15 / side", "Core", "Bodyweight", "Oblique detail.", "finisher"],
      ["Incline Walk", 1, "10-15 min", "Conditioning", "Treadmill", "Low-impact conditioning handoff.", "finisher"],
    ],
    {
      sessionIntent: "SESSION INTENT: waistline identity — anti-rotation and waist control paired with low-impact conditioning. Control and posture over loaded flexion.",
      weakPointPriority: "Waist control · anti-rotation · obliques",
      optionalAddOns: ["Optional Zone 2 Extension"],
    },
  ),
  pilates: archetypeTemplate(
    "pilates", "full-body", "Pilates", "Controlled core, mobility, posture, and breath — low-impact", 38,
    [
      ["Breath + Pelvic Control", 2, "8 breaths", "Core", "Mat", "Set breathing and deep-core connection.", "activation", "4-2-4-0"],
      ["Pilates Hundred", 3, "100", "Core", "Mat", "Controlled core endurance with breath.", "primary", "controlled"],
      ["Single-Leg Stretch", 3, "10 / side", "Core", "Mat", "Coordinated core control.", "secondary", "controlled"],
    ],
    [
      ["Roll-Up", 3, "8-10", "Core", "Mat", "Segmental spinal control.", "volume", "controlled"],
      ["Side-Lying Leg Series", 3, "12 / side", "Glutes", "Mat", "Hip and glute-medius control.", "volume", "controlled"],
    ],
    [
      ["Spine Stretch + Mobility Flow", 2, "8", "Mobility", "Mat", "Mobility and posture flow.", "recovery"],
      ["Standing Posture Reset", 1, "5 min", "Mobility", "Bodyweight", "Posture and breath reset.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: pilates identity — controlled core, mobility, posture, and breath. Low-impact, quality of control over load or fatigue.",
      weakPointPriority: "Core control · posture · mobility · breath",
      warmUpPrimer: "PRIME THE TARGET: breathing and pelvic-floor connection before the first flow.",
      executionStandard: "RESERVE STANDARD: controlled tempo, full breath, no momentum. Stop with pain and follow clinician guidance.",
      optionalAddOns: ["Optional Mobility Extension"],
    },
  ),
  /* zone2 / yoga / mobility used to resolve to no session at all. They are not
     decoration: the aggressive recovery preference swaps a rest day for a zone2
     TRAINING day on ~23 protocols, and a gym+yoga activity stack injects a yoga
     TRAINING day into every protocol. Members reached those days and found
     nothing to run. Placement and structure only — Reserve never claims a
     metabolic or body-composition outcome for a cardio route. */
  zone2: archetypeTemplate(
    "zone2", "full-body", "Zone 2", "One steady conversational effort — pick a route or split it", 35,
    [
      ["Zone 2 Walk", 1, "5 min", "Conditioning", "Treadmill · Outdoor", "Easy start — nasal breathing from the first minute.", "activation"],
      ["Zone 2 Steady Block", 1, "25 min", "Conditioning", "Treadmill · Outdoor · Stair Climber", "Conversational pace: you can hold a full sentence without breaking breath.", "primary"],
      ["Zone 2 Cooldown", 1, "5 min", "Conditioning", "Treadmill · Outdoor", "Bring the pace down before you stop.", "recovery"],
    ],
    [
      ["Incline Treadmill Walk", 1, "20 min", "Conditioning", "Treadmill", "Split route — use this with the stair block instead of the single 25.", "volume"],
      ["Stair Climber", 1, "10 min", "Conditioning", "Stair Climber", "Back half of the split route. Same zone, steady steps.", "volume"],
    ],
    [
      ["Stationary Bike", 1, "25 min", "Conditioning", "Stationary Bike", "No-impact route — use it when the legs are already loaded.", "volume"],
      ["Hip + Calf Mobility", 1, "4 min", "Mobility", "Mat", "Open hips and calves after steady state.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: zone 2 identity — one steady conversational effort, nasal breathing, no intervals. Run it as 25 minutes straight, or split it 20 minutes treadmill and 10 on the stair climber. The bike is there when the legs are loaded.",
      weakPointPriority: "Aerobic base · steady-state output · low joint load",
      warmUpPrimer: "PRIME THE TARGET: five easy minutes before the steady block, nasal breathing the whole way.",
      executionStandard: "RESERVE STANDARD: one zone, held. If you cannot hold a sentence, slow down. Stop with pain, dizziness or anything unusual and follow clinician guidance.",
    },
  ),
  yoga: archetypeTemplate(
    "yoga", "full-body", "Yoga", "Mobility, breath and posture — low-impact", 40,
    [
      ["Breath + Centering", 2, "8 breaths", "Mobility", "Mat", "Set the breath before the first flow.", "activation", "4-2-4-0"],
      ["Sun Salutation Flow", 3, "5 rounds", "Mobility", "Mat", "Link breath to movement — never force a position.", "primary", "controlled"],
      ["Standing Balance Series", 3, "45 sec / side", "Mobility", "Mat", "Hip and ankle control under balance.", "secondary", "controlled"],
    ],
    [
      ["Hip Opening Series", 3, "60 sec / side", "Mobility", "Mat", "Hips after a loaded training week.", "volume", "controlled"],
      ["Spinal Twist Series", 2, "45 sec / side", "Mobility", "Mat", "Thoracic rotation with the ribs soft.", "volume", "controlled"],
    ],
    [
      ["Forward Fold + Hamstring Release", 2, "60 sec", "Mobility", "Mat", "Hamstrings release after a week of hinging.", "recovery"],
      ["Final Rest + Breath", 1, "5 min", "Mobility", "Mat", "Close the session flat and quiet.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: yoga identity — mobility, breath and posture. Low-impact by design; quality of control over range or effort.",
      weakPointPriority: "Mobility · posture · breath · balance",
      warmUpPrimer: "PRIME THE TARGET: breath and centering before the first salutation.",
      executionStandard: "RESERVE STANDARD: breathe through every position and never force an end range. Stop with pain and follow clinician guidance.",
    },
  ),
  mobility: archetypeTemplate(
    "mobility", "full-body", "Mobility", "Joint prep and range work — short and low-impact", 22,
    [
      ["Cat-Camel", 2, "10", "Mobility", "Mat", "Wake the spine one segment at a time.", "activation"],
      ["90/90 Hip Rotation", 3, "8 / side", "Mobility", "Mat", "Internal and external hip range.", "primary", "controlled"],
      ["Thoracic Opener", 3, "8 / side", "Mobility", "Mat", "Open the upper back ahead of a pressing week.", "secondary", "controlled"],
    ],
    [
      ["Ankle Dorsiflexion Drill", 2, "10 / side", "Mobility", "Bodyweight", "Ankle range feeds the squat pattern.", "volume"],
      ["Shoulder Pass-Through", 2, "12", "Mobility", "Band", "Shoulder range — no forcing the end position.", "volume"],
    ],
    [
      ["Deep Squat Hold", 2, "45 sec", "Mobility", "Bodyweight", "Sit into the range and breathe.", "recovery"],
      ["Hip Flexor Stretch", 2, "45 sec / side", "Mobility", "Mat", "Close with the hips long.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: mobility identity — joint prep and range work, kept short. It protects the next hard session rather than adding fatigue to this one.",
      weakPointPriority: "Hip range · thoracic rotation · ankle range",
      executionStandard: "RESERVE STANDARD: controlled range, no bouncing, no forcing. Stop with pain and follow clinician guidance.",
    },
  ),
};

/* ════════════════════════════════════════════════════════════════════════
   CARDIO & LOW-IMPACT VARIANTS — so a cardio day is never copy-pasted.

   A member on an aggressive recovery preference, or a yoga / pilates activity
   stack, meets the same archetype several times a week. One fixed block handed
   back every time reads as a stub. Each cardio / low-impact identity now carries
   two or three authored routes; a caller rotates them by day so consecutive
   cardio days differ while a given calendar day always shows the same one.

   Variant A is the ARCHETYPE_TEMPLATES entry above, UNCHANGED — its movement
   ids are what started sessions were snapshotted against, so it keeps them.
   Only B and C carry a namespaced id, and every route holds the same identity
   and the same placement-only framing: no metabolic or body-composition claim
   is ever made for a cardio route.
   ════════════════════════════════════════════════════════════════════════ */

/** Namespace a variant's ids so routes never collide with variant A or each other. */
function withVariantId(t: WorkoutTemplate, tag: string): WorkoutTemplate {
  return {
    ...t,
    id: `${t.id}-${tag}`,
    phases: t.phases.map((ph) => ({
      ...ph,
      id: `${ph.id}-${tag}`,
      movements: ph.movements.map((m) => ({ ...m, id: `${m.id}-${tag}` })),
    })),
  };
}

const ZONE2_BIKE = withVariantId(
  archetypeTemplate(
    "zone2", "full-body", "Zone 2", "One steady conversational effort — no-impact lead", 35,
    [
      ["Easy Spin", 1, "5 min", "Conditioning", "Stationary Bike", "Easy start — nasal breathing from the first minute.", "activation"],
      ["Zone 2 Bike Block", 1, "25 min", "Conditioning", "Stationary Bike", "Conversational pace held: you can hold a full sentence without breaking breath.", "primary"],
      ["Spin Cooldown", 1, "5 min", "Conditioning", "Stationary Bike", "Bring the cadence down before you stop.", "recovery"],
    ],
    [
      ["Rower Steady", 1, "20 min", "Conditioning", "Rower", "Swap route — steady pulls, same zone, same breath.", "volume"],
      ["Easy Spin Finish", 1, "10 min", "Conditioning", "Stationary Bike", "Back half of the split route, light and smooth.", "volume"],
    ],
    [
      ["Incline Treadmill Walk", 1, "25 min", "Conditioning", "Treadmill", "On-feet route when the legs are fresh and you want the steps.", "volume"],
      ["Hip + Calf Mobility", 1, "4 min", "Mobility", "Mat", "Open hips and calves after steady state.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: zone 2 identity, no-impact lead — one steady conversational effort on the bike, nasal breathing, no intervals. Use this route when the legs are already loaded; the rower is the swap, the incline walk is there on fresh legs.",
      weakPointPriority: "Aerobic base · steady-state output · no joint load",
      warmUpPrimer: "PRIME THE TARGET: five easy minutes of spinning before the steady block, nasal breathing the whole way.",
      executionStandard: "RESERVE STANDARD: one zone, held. If you cannot hold a sentence, slow down. Stop with pain, dizziness or anything unusual and follow clinician guidance.",
    },
  ),
  "b",
);

const ZONE2_OUTDOOR = withVariantId(
  archetypeTemplate(
    "zone2", "full-body", "Zone 2", "One steady conversational effort — outdoor route", 35,
    [
      ["Easy Walk Out", 1, "5 min", "Conditioning", "Outdoor", "Easy start — nasal breathing, let the pace settle.", "activation"],
      ["Zone 2 Outdoor Block", 1, "25 min", "Conditioning", "Outdoor", "Conversational pace on a flat-to-rolling route: a full sentence without breaking breath.", "primary"],
      ["Walk-In Cooldown", 1, "5 min", "Conditioning", "Outdoor", "Ease the pace down the last five minutes home.", "recovery"],
    ],
    [
      ["Rolling-Hill Route", 1, "25 min", "Conditioning", "Outdoor", "Swap route — let gentle hills hold the zone instead of pace.", "volume"],
    ],
    [
      ["Incline Treadmill Walk", 1, "25 min", "Conditioning", "Treadmill", "Indoor fallback when the weather turns — same steady zone.", "volume"],
      ["Hip + Calf Mobility", 1, "4 min", "Mobility", "Mat", "Open hips and calves after steady state.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: zone 2 identity, outdoor route — one steady conversational effort, nasal breathing, no intervals. Let a flat-to-rolling route hold the zone; the treadmill is the indoor fallback.",
      weakPointPriority: "Aerobic base · steady-state output · low joint load",
      warmUpPrimer: "PRIME THE TARGET: five easy minutes before the steady block, nasal breathing the whole way.",
      executionStandard: "RESERVE STANDARD: one zone, held. If you cannot hold a sentence, slow down. Stop with pain, dizziness or anything unusual and follow clinician guidance.",
    },
  ),
  "c",
);

const YOGA_HIP_OPENER = withVariantId(
  archetypeTemplate(
    "yoga", "full-body", "Yoga", "Hip and hamstring opening — low-impact", 40,
    [
      ["Breath + Centering", 2, "8 breaths", "Mobility", "Mat", "Set the breath before the first flow.", "activation", "4-2-4-0"],
      ["Low Lunge Flow", 3, "45 sec / side", "Mobility", "Mat", "Open the front of the hip — never force the depth.", "primary", "controlled"],
      ["Pigeon Prep", 3, "60 sec / side", "Mobility", "Mat", "Deep glute and hip release, breath into the stretch.", "secondary", "controlled"],
    ],
    [
      ["Lizard Hold", 2, "45 sec / side", "Mobility", "Mat", "Inner-thigh and hip-flexor length.", "volume", "controlled"],
      ["Half-Split Hamstring", 3, "45 sec / side", "Mobility", "Mat", "Hamstring length after a week of hinging.", "volume", "controlled"],
    ],
    [
      ["Reclined Figure-Four", 2, "60 sec / side", "Mobility", "Mat", "Quiet glute release on the floor.", "recovery"],
      ["Final Rest + Breath", 1, "5 min", "Mobility", "Mat", "Close the session flat and quiet.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: yoga identity, hip and hamstring focus — mobility, breath and posture. Low-impact by design; quality of control over range or effort.",
      weakPointPriority: "Hip range · hamstring length · glute release · breath",
      warmUpPrimer: "PRIME THE TARGET: breath and centering before the first lunge.",
      executionStandard: "RESERVE STANDARD: breathe through every position and never force an end range. Stop with pain and follow clinician guidance.",
    },
  ),
  "b",
);

const YOGA_RESTORATIVE = withVariantId(
  archetypeTemplate(
    "yoga", "full-body", "Yoga", "Restorative and breath-led — low-impact", 40,
    [
      ["Extended Breath", 2, "10 breaths", "Mobility", "Mat", "Longer exhales to settle the nervous system.", "activation", "4-2-6-0"],
      ["Supported Child's Pose", 2, "90 sec", "Mobility", "Mat", "Let the back and hips soften over support.", "primary", "controlled"],
      ["Reclined Twist", 2, "75 sec / side", "Mobility", "Mat", "Gentle thoracic rotation, ribs soft.", "secondary", "controlled"],
    ],
    [
      ["Legs-Up Rest", 1, "4 min", "Mobility", "Mat", "Quiet recovery position after a loaded week.", "volume"],
      ["Supported Bridge Hold", 2, "75 sec", "Mobility", "Mat", "Open the front of the hips with support under the pelvis.", "volume", "controlled"],
    ],
    [
      ["Forward Fold + Hamstring Release", 2, "60 sec", "Mobility", "Mat", "Hamstrings release, neck heavy.", "recovery"],
      ["Final Rest + Breath", 1, "6 min", "Mobility", "Mat", "Close the session flat and quiet.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: yoga identity, restorative — breath-led, supported holds, kept gentle. The route for the highest-fatigue day of the week.",
      weakPointPriority: "Recovery · breath · gentle posture · hip opening",
      warmUpPrimer: "PRIME THE TARGET: extended breath before the first hold.",
      executionStandard: "RESERVE STANDARD: breathe through every position and never force an end range. Stop with pain and follow clinician guidance.",
    },
  ),
  "c",
);

const MOBILITY_LOWER = withVariantId(
  archetypeTemplate(
    "mobility", "full-body", "Mobility", "Lower-body range — short and low-impact", 22,
    [
      ["90/90 Hip Rotation", 3, "8 / side", "Mobility", "Mat", "Internal and external hip range.", "primary", "controlled"],
      ["Deep Squat Hold", 2, "45 sec", "Mobility", "Bodyweight", "Sit into the range and breathe.", "secondary"],
    ],
    [
      ["Ankle Dorsiflexion Drill", 2, "10 / side", "Mobility", "Bodyweight", "Ankle range feeds the squat pattern.", "volume"],
      ["Adductor Rock-Back", 2, "10 / side", "Mobility", "Mat", "Inner-thigh range for the hinge and squat.", "volume"],
    ],
    [
      ["Hip Flexor Stretch", 2, "45 sec / side", "Mobility", "Mat", "Close with the hips long.", "recovery"],
      ["Seated Hamstring Float", 2, "45 sec / side", "Mobility", "Mat", "Easy hamstring length to finish.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: mobility identity, lower-body range — joint prep for the hips, ankles and adductors, kept short. It protects the next lower day rather than adding fatigue to this one.",
      weakPointPriority: "Hip range · ankle range · adductor length",
      executionStandard: "RESERVE STANDARD: controlled range, no bouncing, no forcing. Stop with pain and follow clinician guidance.",
    },
  ),
  "b",
);

const MOBILITY_UPPER = withVariantId(
  archetypeTemplate(
    "mobility", "full-body", "Mobility", "Upper-body range — short and low-impact", 22,
    [
      ["Cat-Camel", 2, "10", "Mobility", "Mat", "Wake the spine one segment at a time.", "activation"],
      ["Thoracic Opener", 3, "8 / side", "Mobility", "Mat", "Open the upper back ahead of a pressing week.", "primary", "controlled"],
      ["Wall Slides", 2, "10", "Mobility", "Wall", "Groove overhead range without shrugging.", "secondary", "controlled"],
    ],
    [
      ["Shoulder Pass-Through", 2, "12", "Mobility", "Band", "Shoulder range — no forcing the end position.", "volume"],
      ["Wrist + Forearm Prep", 2, "10 / side", "Mobility", "Bodyweight", "Wrist range for pressing and carries.", "volume"],
    ],
    [
      ["Doorway Pec Stretch", 2, "45 sec / side", "Mobility", "Bodyweight", "Open the chest after a loaded pressing week.", "recovery"],
      ["Neck + Trap Release", 2, "45 sec / side", "Mobility", "Mat", "Let the neck and traps soften to finish.", "recovery"],
    ],
    {
      sessionIntent: "SESSION INTENT: mobility identity, upper-body range — joint prep for the thoracic spine, shoulders and wrists, kept short. It protects the next pressing or pulling day rather than adding fatigue to this one.",
      weakPointPriority: "Thoracic rotation · shoulder range · wrist range",
      executionStandard: "RESERVE STANDARD: controlled range, no bouncing, no forcing. Stop with pain and follow clinician guidance.",
    },
  ),
  "c",
);

/**
 * Authored routes per cardio / low-impact archetype, variant A first (the
 * ARCHETYPE_TEMPLATES entry, unchanged). getTemplateForArchetype rotates them by
 * a caller-supplied day key; with no key it returns variant A, so every existing
 * caller is unchanged.
 */
export const CARDIO_VARIANTS: Partial<Record<SessionArchetype, WorkoutTemplate[]>> = {
  zone2: [ARCHETYPE_TEMPLATES.zone2!, ZONE2_BIKE, ZONE2_OUTDOOR],
  yoga: [ARCHETYPE_TEMPLATES.yoga!, YOGA_HIP_OPENER, YOGA_RESTORATIVE],
  mobility: [ARCHETYPE_TEMPLATES.mobility!, MOBILITY_LOWER, MOBILITY_UPPER],
};

/** How many authored routes an archetype rotates through (0 = not a rotating cardio identity). */
export function cardioVariantCount(archetype: SessionArchetype): number {
  return CARDIO_VARIANTS[archetype]?.length ?? 0;
}

/** Archetype-specific template only (no SplitKey fallback) — used by the live
 *  cockpit so a blueprint day renders its own identity when one is authored. */
export function getArchetypeOnlyTemplate(archetype: SessionArchetype): WorkoutTemplate | null {
  return ARCHETYPE_TEMPLATES[archetype] ?? null;
}

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY RUNWAY (rest days — no lifting queue)
   ════════════════════════════════════════════════════════════════════════ */

export const RECOVERY_RUNWAY: RecoveryRunway = {
  id: "recovery",
  displayName: "Recovery Runway",
  focus: "Restore output · mobility · easy conditioning",
  items: [
    { id: "mobility", label: "Mobility Block", detail: "T-spine, hips, shoulders — slow and deliberate.", duration: "10–15 min", status: "recommended" },
    { id: "zone2", label: "Zone 2 Walk", detail: "Conversational pace, nasal breathing.", duration: "20–30 min", status: "recommended" },
    { id: "steps", label: "Daily Steps", detail: "Hit your step target across the day.", duration: "8–10k", status: "recommended" },
    { id: "sauna", label: "Sauna", detail: "Optional heat block if already tolerated.", duration: "15–20 min", status: "optional" },
    { id: "hydration", label: "Hydration", detail: "Even fluids + electrolytes across the day.", duration: "All day", status: "required" },
    { id: "sleep", label: "Sleep Target", detail: "Protect the window — 8h minimum.", duration: "8h", status: "required" },
    { id: "checkin", label: "Check-in / Journal", detail: "Log readiness, soreness, and tomorrow's plan.", duration: "2 min", status: "required" },
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   SPLIT KEY MAPPING — robust alias resolution
   ════════════════════════════════════════════════════════════════════════ */

const ALIASES: Array<{ key: ResolvedSplit; needles: string[] }> = [
  // Recovery first so "recovery day" never matches a lifting key.
  { key: "recovery", needles: ["recovery", "rest day", "rest", "off day", "posing", "mobility day", "deload day"] },
  { key: "upper-specialization", needles: ["upper specialization", "upper-specialization", "upper spec", "specialization", "upper day", "upper body day", "build day"] },
  { key: "chest-back", needles: ["chest / back", "chest/back", "chest back", "chest and back", "chest-back"] },
  { key: "lower-posterior", needles: ["lower / posterior", "lower posterior", "posterior legs", "posterior chain", "posterior", "hamstrings glutes", "ham glute"] },
  { key: "arms-delts", needles: ["arms / delts", "arms delts", "arms-delts", "delts / arms", "arm shoulder", "shoulders arms", "delts arms"] },
  { key: "full-body", needles: ["full body", "full-body", "total body"] },
  { key: "shoulders", needles: ["shoulders", "shoulder day", "delt specialization", "delts only"] },
  { key: "arms", needles: ["arms only", "arm day", "arms day", "biceps triceps", "biceps and triceps", "direct arms"] },
  { key: "chest", needles: ["chest day", "chest", "pec day", "pecs"] },
  { key: "back", needles: ["back day", "back", "lat day", "lats"] },
  { key: "push", needles: ["push", "chest shoulders triceps"] },
  { key: "pull", needles: ["pull", "back biceps", "back day"] },
  { key: "upper", needles: ["upper", "upper body"] },
  { key: "lower", needles: ["lower", "lower body"] },
  { key: "legs", needles: ["legs", "leg day", "leg", "lower body", "lower", "quad day", "quads"] },
];

/**
 * Resolve any human split label into a canonical split key.
 * Returns "recovery" for rest days, or null when nothing matches —
 * callers must show a missing-template state rather than fall back to upper.
 */
export function resolveSplitKey(raw: string | undefined | null): ResolvedSplit {
  if (!raw) return null;
  const text = raw.toLowerCase().trim();
  for (const { key, needles } of ALIASES) {
    if (needles.some((n) => text.includes(n))) return key;
  }
  return null;
}

/** Map the dashboard / Reserve Method split-day index (1=Mon … 7=Sun) to a label. */
export function splitDayLabel(splitDay: number | undefined | null): string {
  switch (splitDay) {
    case 1: return "Push";
    case 2: return "Pull";
    case 3: return "Legs";
    case 4: return "Arm Day";
    case 5: return "Upper";
    case 6: return "Lower";
    case 7: return "Recovery";
    default: return "";
  }
}

export function isRecoverySplit(raw: string | undefined | null): boolean {
  return resolveSplitKey(raw) === "recovery";
}

/**
 * Return the workout template for a split label, or null when:
 *  - it is a recovery/rest day (use RECOVERY_RUNWAY instead), or
 *  - the split cannot be matched to a template (show missing-template state).
 * NEVER returns the Upper Specialization template as a silent fallback.
 */
export function getWorkoutTemplateForSplit(raw: string | undefined | null): WorkoutTemplate | null {
  if (!raw) return null;
  /* `raw` may already BE an engine key. resolveActiveSession passes
     `day.splitKey`, and "arms" is a key that is NOT one of its own title
     aliases — the table matches "arm day" / "arms day" / "arms only", never
     bare "arms". So every caller that handed over the key got null for Arm
     Day: the template has existed the whole time, and a member who set Arm
     Day on the 7-day rail, in Build Studio or in a program got an empty
     cockpit and "Build Today's Session", every week, with nothing telling
     them Reserve had a session it simply could not find.

     A key we hold a template for is now taken at face value; anything else
     still goes through the alias table as a title. */
  const direct = raw.trim().toLowerCase();
  if (direct !== "recovery" && Object.prototype.hasOwnProperty.call(WORKOUT_TEMPLATES, direct)) {
    return WORKOUT_TEMPLATES[direct as SplitKey] ?? null;
  }
  const key = resolveSplitKey(raw);
  if (key === null || key === "recovery") return null;
  return WORKOUT_TEMPLATES[key] ?? null;
}

/* ════════════════════════════════════════════════════════════════════════
   ARCHETYPE → TEMPLATE (Protocol Architecture 2.0)
   ------------------------------------------------------------------------
   Maps each blueprint SessionArchetype to the best-fit exercise template in
   the existing pool. null = a low-impact / recovery / log day with no
   prescribed lifting template (the blueprint supplies the session identity).
   ════════════════════════════════════════════════════════════════════════ */
export const ARCHETYPE_TO_SPLIT: Record<SessionArchetype, SplitKey | null> = {
  "chest-strength": "chest",
  /* A chest-led pressing day, not a chest-and-back day. Mapping it to
     "chest-back" labelled "Push Hypertrophy" days Chest · Back on the rail. */
  "chest-hypertrophy": "chest",
  "chest-detail": "chest",
  "chest-back-strength": "chest-back",
  "chest-back-volume": "chest-back",
  "chest-back-pump": "chest-back",
  "back-width": "back",
  "back-thickness": "back",
  "upper-back-posture": "back",
  "delts-arms": "arms-delts",
  "arms-pump": "arms",
  shoulders: "shoulders",
  push: "push",
  pull: "pull",
  "upper-strength": "upper",
  "upper-hypertrophy": "upper-specialization",
  "upper-tone": "upper",
  "posture-upper": "upper",
  legs: "legs",
  "lower-strength": "lower",
  "lower-power": "lower",
  "quad-focus": "legs",
  "posterior-chain": "lower-posterior",
  "hamstring-glute": "lower-posterior",
  "glute-strength": "lower-posterior",
  "glute-shape": "lower-posterior",
  "glute-pump": "lower-posterior",
  "glute-detail": "lower-posterior",
  abductors: "lower-posterior",
  "legs-waistline": "legs",
  calves: "legs",
  "full-body-athletic": "full-body",
  "sprint-power": "lower",
  explosive: "lower",
  conditioning: "full-body",
  "sport-conditioning": "full-body",
  "outdoor-distance": "full-body",
  zone2: null,
  core: null,
  waistline: null,
  pilates: null,
  yoga: null,
  mobility: null,
  recovery: null,
  logged: null,
};

/** Resolve the best-fit exercise template for a blueprint archetype (or null).
 *  Prefers the archetype-specific template (its own training identity) and falls
 *  back to the pattern-level split template so untouched archetypes are unchanged. */
export function getTemplateForArchetype(archetype: SessionArchetype, rotateKey?: number | null): WorkoutTemplate | null {
  // A cardio / low-impact identity rotates through its authored routes by the
  // caller's day key, so consecutive cardio days differ. No key → variant A,
  // which IS the ARCHETYPE_TEMPLATES entry, so every existing caller is unchanged.
  const variants = CARDIO_VARIANTS[archetype];
  if (variants && variants.length > 0 && rotateKey != null && Number.isFinite(rotateKey)) {
    const n = variants.length;
    return variants[((Math.trunc(rotateKey) % n) + n) % n];
  }
  const direct = ARCHETYPE_TEMPLATES[archetype];
  if (direct) return direct;
  const key = ARCHETYPE_TO_SPLIT[archetype];
  return key ? WORKOUT_TEMPLATES[key] : null;
}

export function allTemplateMovements(t: WorkoutTemplate): TemplateMovement[] {
  return t.phases.flatMap((p) => p.movements);
}

/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL-AWARE TRAINING INTENSITY

   The base templates are the Reserve Training Standard. When an advanced /
   bodybuilding protocol is active, Training upgrades the session: more working
   sets per role, extra specialization volume, and an extra pump finisher on
   the highest tier. Recovery/log-only protocols stay deliberately lighter.

   Pure transform — programming only, no medical / dosing / supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

export type IntensityTier =
  | "log-only"
  | "foundation"
  | "lifestyle"
  | "standard"
  | "hypertrophy"
  | "advanced"
  | "specialization"
  | "championship";

export const INTENSITY_TIER_META: Record<IntensityTier, { label: string; note: string; advanced: boolean }> = {
  "log-only":     { label: "LOG-ONLY SESSION", note: "Observational training log. Working volume stays member-defined.", advanced: false },
  foundation:     { label: "FOUNDATION OUTPUT", note: "Sustainable working volume while consistency is being built.", advanced: false },
  lifestyle:      { label: "LIFESTYLE OUTPUT", note: "Maintainable structure — quality over maximum volume.", advanced: false },
  standard:       { label: "RESERVE TRAINING STANDARD", note: "Standard working volume.", advanced: false },
  hypertrophy:    { label: "HYPERTROPHY OUTPUT", note: "Elevated working sets for steady muscle gain.", advanced: false },
  advanced:       { label: "ADVANCED HYPERTROPHY OUTPUT", note: "Extra working sets unlocked by your active protocol. Recovery demand elevated — beat execution quality before adding load.", advanced: true },
  specialization: { label: "SPECIALIZATION OUTPUT", note: "Weak-point specialization volume unlocked by your active protocol. Recovery demand elevated — earn every added set.", advanced: true },
  championship:   { label: "CHAMPIONSHIP HYPERTROPHY OUTPUT", note: "High-output, stage-ready volume unlocked by your active protocol. Recovery demand elevated — execution quality before load.", advanced: true },
};

/** Target working sets by movement role for each tier. Roles not listed keep their base set count. */
const TIER_SET_TARGETS: Record<IntensityTier, Partial<Record<MovementRole, number>>> = {
  "log-only":     { primary: 2, secondary: 2, stretch: 2, volume: 2, finisher: 1, activation: 1, primer: 1 },
  foundation:     { primary: 3, secondary: 2, stretch: 2, volume: 2, finisher: 1 },
  lifestyle:      { primary: 3, secondary: 2, stretch: 2, volume: 2, finisher: 1 },
  standard:       {},
  hypertrophy:    { primary: 4, secondary: 3, stretch: 3, volume: 3, finisher: 2 },
  advanced:       { primary: 5, secondary: 4, stretch: 4, volume: 4, finisher: 3 },
  specialization: { primary: 5, secondary: 4, stretch: 4, volume: 4, finisher: 3 },
  championship:   { primary: 5, secondary: 4, stretch: 4, volume: 4, finisher: 4 },
};

/** Flagship splits that carry the most muscle — they get extra advanced volume. */
const HERO_SPLITS: ReadonlySet<SplitKey> = new Set<SplitKey>(["chest", "back"]);

type Addon = { name: string; reps: string; muscle: string; equipment: string; purpose: string; role: MovementRole };

/** Extra specialization (P2 volume) + pump (P3 finisher) movements added on advanced tiers. */
const SPLIT_ADDONS: Record<SplitKey, { spec: Addon; finisher: Addon }> = {
  chest: {
    spec: { name: "Plate-Loaded Incline Press", reps: "8-12", muscle: "Upper Chest", equipment: "Plate-Loaded Incline", purpose: "Specialization volume — extra upper-chest tonnage after the primary press.", role: "volume" },
    finisher: { name: "Pec Deck Burnout", reps: "15-20", muscle: "Chest", equipment: "Pec Deck", purpose: "Championship pump finisher — squeeze and hold each rep.", role: "finisher" },
  },
  back: {
    spec: { name: "Wide-Grip Lat Pulldown", reps: "8-12", muscle: "Lats", equipment: "Pulldown Station", purpose: "Specialization volume for lat width, elbows outside the ribs.", role: "volume" },
    finisher: { name: "Rope Lat Pullover Burnout", reps: "15-20", muscle: "Lats", equipment: "Cable Stack", purpose: "Championship lat pump finisher — long arms, no triceps takeover.", role: "finisher" },
  },
  shoulders: {
    spec: { name: "Cable Lateral 21s", reps: "21s", muscle: "Side Delts", equipment: "Cable Stack", purpose: "Specialization side-delt volume across the full range.", role: "volume" },
    finisher: { name: "Rear-Delt Machine Burnout", reps: "18-25", muscle: "Rear Delts", equipment: "Rear-Delt Machine", purpose: "Championship rear-delt pump finisher.", role: "finisher" },
  },
  arms: {
    spec: { name: "Spider Curl", reps: "10-14", muscle: "Biceps", equipment: "Incline Bench", purpose: "Specialization shortened-position biceps volume.", role: "volume" },
    finisher: { name: "Triceps Pressdown Burnout", reps: "18-25", muscle: "Triceps", equipment: "Cable Stack", purpose: "Championship triceps pump finisher.", role: "finisher" },
  },
  legs: {
    spec: { name: "Pendulum Squat", reps: "8-12", muscle: "Quads", equipment: "Pendulum Squat", purpose: "Specialization quad volume with a deep, stable path.", role: "volume" },
    finisher: { name: "Leg Extension Burnout", reps: "18-25", muscle: "Quads", equipment: "Leg Extension", purpose: "Championship quad pump finisher — hold the top.", role: "finisher" },
  },
  push: {
    spec: { name: "Machine Chest Press Back-Off", reps: "10-14", muscle: "Mid Chest", equipment: "Chest Press Machine", purpose: "Specialization back-off volume after the primary press.", role: "volume" },
    finisher: { name: "Cable Lateral Burnout", reps: "18-25", muscle: "Side Delts", equipment: "Cable Stack", purpose: "Championship side-delt pump finisher.", role: "finisher" },
  },
  pull: {
    spec: { name: "Neutral-Grip Lat Pulldown", reps: "8-12", muscle: "Lower Lats", equipment: "Pulldown Station", purpose: "Specialization lat volume with a neutral grip.", role: "volume" },
    finisher: { name: "Rope Pullover Burnout", reps: "15-20", muscle: "Lats", equipment: "Cable Stack", purpose: "Championship lat pump finisher.", role: "finisher" },
  },
  upper: {
    spec: { name: "Plate-Loaded Row", reps: "8-12", muscle: "Mid-Back", equipment: "Plate-Loaded Row", purpose: "Specialization mid-back thickness volume.", role: "volume" },
    finisher: { name: "Cable Lateral Burnout", reps: "18-25", muscle: "Side Delts", equipment: "Cable Stack", purpose: "Championship side-delt pump finisher.", role: "finisher" },
  },
  lower: {
    spec: { name: "Pendulum Squat", reps: "8-12", muscle: "Quads", equipment: "Pendulum Squat", purpose: "Specialization quad volume with a deep, stable path.", role: "volume" },
    finisher: { name: "Seated Leg Curl Burnout", reps: "15-20", muscle: "Hamstrings", equipment: "Leg Curl Machine", purpose: "Championship hamstring pump finisher.", role: "finisher" },
  },
  "full-body": {
    spec: { name: "Pendulum Squat", reps: "8-12", muscle: "Quads", equipment: "Pendulum Squat", purpose: "Specialization lower-body volume.", role: "volume" },
    finisher: { name: "Pec Deck Burnout", reps: "15-20", muscle: "Chest", equipment: "Pec Deck", purpose: "Championship chest pump finisher.", role: "finisher" },
  },
  "upper-specialization": {
    spec: { name: "Upper-Chest Cable Ladder", reps: "12-15 / angle", muscle: "Upper Chest", equipment: "Cable Stack", purpose: "Specialization upper-chest volume across clean angles.", role: "volume" },
    finisher: { name: "Rear-Delt Machine Burnout", reps: "18-25", muscle: "Rear Delts", equipment: "Rear-Delt Machine", purpose: "Championship rear-delt pump finisher.", role: "finisher" },
  },
  "arms-delts": {
    spec: { name: "Machine Preacher Curl", reps: "10-14", muscle: "Biceps", equipment: "Curl Machine", purpose: "Specialization biceps volume with planted upper arms.", role: "volume" },
    finisher: { name: "Triceps Pressdown Burnout", reps: "18-25", muscle: "Triceps", equipment: "Cable Stack", purpose: "Championship triceps pump finisher.", role: "finisher" },
  },
  "chest-back": {
    spec: { name: "Plate-Loaded Incline Press", reps: "8-12", muscle: "Upper Chest", equipment: "Plate-Loaded Incline", purpose: "Specialization upper-chest volume.", role: "volume" },
    finisher: { name: "Rope Pullover Burnout", reps: "15-20", muscle: "Lats", equipment: "Cable Stack", purpose: "Championship lat pump finisher.", role: "finisher" },
  },
  "lower-posterior": {
    spec: { name: "Glute-Ham Raise", reps: "8-12", muscle: "Hamstrings", equipment: "GHR Bench", purpose: "Specialization lengthened hamstring volume.", role: "volume" },
    finisher: { name: "Standing Calf Burnout", reps: "18-25", muscle: "Calves", equipment: "Calf Raise Machine", purpose: "Championship calf pump finisher.", role: "finisher" },
  },
};

function synthMovement(splitKey: SplitKey, order: number, a: Addon, sets: number): TemplateMovement {
  const phaseKey: WorkoutPhaseKey = a.role === "finisher" ? "detail-work" : "secondary-volume";
  const progressionTarget = a.role === "finisher"
    ? "BEAT THIS NEXT TIME: match reps with cleaner contractions or one extra controlled rep."
    : "BEAT THIS NEXT TIME: reach the top of the rep range with the same form standard.";
  return {
    id: `${splitKey}-${slug(a.name)}-spec`,
    order,
    name: a.name,
    sets,
    targetReps: a.reps,
    targetMuscle: a.muscle,
    equipment: a.equipment,
    phase: phaseKey,
    role: a.role,
    roleLabel: ROLE_LABEL[a.role],
    rest: ROLE_REST[a.role],
    tempo: ROLE_TEMPO[a.role],
    intensity: ROLE_INTENSITY[a.role],
    difficulty: difficultyFor(a.role, a.equipment),
    weakPointTags: weakPointTagsFor(a.muscle, a.role),
    phaseTags: phaseTagsFor(phaseKey, a.role),
    notes: a.purpose,
    purpose: a.purpose,
    progressionRule: PROGRESSION_RULE[phaseKey],
    progressionTarget,
    substitutions: substitutionsFor(a.name, a.muscle),
    plateauRule: PLATEAU_RULE,
    fatigueNote: undefined,
  };
}

/** Classify the active protocol into an intensity tier. Accepts the minimal fields
 *  (no import of the protocol/store types, keeping this module dependency-free). */
export function protocolIntensityTier(
  input: { category?: string | null; difficulty?: string | null; logOnly?: boolean } | null | undefined,
): IntensityTier {
  if (!input) return "standard";
  const cat = (input.category ?? "").toLowerCase();
  const diff = (input.difficulty ?? "").toLowerCase();
  if (input.logOnly || cat.includes("log-only") || cat.includes("fertility") || cat.includes("pregnancy")) return "log-only";
  if (cat.includes("lifestyle")) return "lifestyle";
  if (cat === "classic-physique") return "specialization";
  if (cat === "premium-advanced" || diff === "elite") return "championship";
  if (diff === "advanced") return "advanced";
  if (diff === "intermediate") return "hypertrophy";
  if (diff === "accessible") return "foundation";
  return "standard";
}

/** Sum working sets (excludes primer / activation / recovery slots). */
export function countWorkingSets(t: WorkoutTemplate): number {
  return allTemplateMovements(t)
    .filter((m) => m.role !== "primer" && m.role !== "activation" && m.role !== "recovery")
    .reduce((s, m) => s + m.sets, 0);
}

/**
 * Return an intensity-adjusted copy of a template for the given tier.
 * "standard" returns the base template (only tagged with its label).
 * Advanced tiers bump working sets and append specialization + pump volume.
 */
export function applyProtocolIntensity(template: WorkoutTemplate, tier: IntensityTier): WorkoutTemplate {
  const meta = INTENSITY_TIER_META[tier];
  const targets = TIER_SET_TARGETS[tier];

  const phases: TemplatePhase[] = template.phases.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      const target = targets[m.role];
      return target != null ? { ...m, sets: target } : { ...m };
    }),
  }));

  if (meta.advanced) {
    const addon = SPLIT_ADDONS[template.splitKey];
    if (addon) {
      // Chest and Back are the flagship hero splits — they carry the most muscle
      // and earn the extra pump finisher on every advanced tier, not just championship.
      const isHero = HERO_SPLITS.has(template.splitKey);
      let order = template.phases.reduce(
        (mx, p) => p.movements.reduce((m2, mv) => Math.max(m2, mv.order), mx),
        0,
      );
      const p2 = phases.find((p) => p.priority === "P2");
      if (p2) {
        order += 1;
        p2.movements = [...p2.movements, synthMovement(template.splitKey, order, addon.spec, targets.volume ?? 4)];
      }
      if (tier === "championship" || isHero) {
        const p3 = phases.find((p) => p.priority === "P3");
        if (p3) {
          order += 1;
          p3.movements = [...p3.movements, synthMovement(template.splitKey, order, addon.finisher, targets.finisher ?? 4)];
        }
      }
    }
  }

  const upgraded: WorkoutTemplate = {
    ...template,
    phases,
    intensityTier: tier,
    intensityLabel: meta.label,
    intensityNote: meta.note,
  };
  const workingSets = countWorkingSets(upgraded);
  upgraded.estimatedDurationMin = Math.round(workingSets * 2.6 + 16);
  return upgraded;
}

/* ════════════════════════════════════════════════════════════════════════
   CHEST-PRIORITY LAYER

   When chest / upper chest is a selected weak point or priority tissue, the
   balanced Chest / Back day becomes Chest Priority + Back Support: chest leads
   in order and volume, upper chest gets first exposure, back work stays for
   width and posture, and an optional chest finisher is gated by readiness.
   Recovery-limited days keep the priority press + one back anchor and pull
   back pump / finisher volume (never the priority). Pure + deterministic.
   Training / recovery instruction only — no medical claims. Stop with pain.
   ════════════════════════════════════════════════════════════════════════ */

/** Detect chest / upper-chest priority from the member's weak-point selections. */
export function chestPriorityFromWeakPoints(weakPoints: string[] | undefined): { active: boolean; upperChest: boolean } {
  const wp = (weakPoints ?? []).map((w) => w.toLowerCase().replace(/-/g, " "));
  const upperChest = wp.some((w) => w.includes("upper chest"));
  const active = upperChest || wp.some((w) => w.includes("chest"));
  return { active, upperChest };
}

/** Map a recovery reserve (0–100) to a chest-priority readiness band. */
export function chestReadinessFrom(reserve: number | null, hasData: boolean): ChestReadiness {
  if (!hasData || reserve == null) return "moderate";
  if (reserve >= 70) return "strong";
  if (reserve >= 55) return "moderate";
  return "limited";
}

/**
 * Rebuild a Chest / Back template as Chest Priority + Back Support.
 * No-op (returns the input unchanged) unless the split is chest-back AND chest
 * is an active priority — so every other split and every non-chest-focused
 * member is completely unaffected. Runs AFTER applyProtocolIntensity and
 * preserves its intensity metadata.
 */
export function applyChestPriority(
  template: WorkoutTemplate,
  opts: { active: boolean; upperChest: boolean; readiness: ChestReadiness },
): WorkoutTemplate {
  if (!opts.active || template.splitKey !== "chest-back") return template;

  const tier = template.intensityTier ?? "standard";
  const advanced = INTENSITY_TIER_META[tier]?.advanced ?? false;
  const pressSets = advanced ? 5 : 4;
  const { readiness, upperChest } = opts;

  const primaryPress: RawMovement = upperChest
    ? ["Plate-Loaded Incline Press", pressSets, "6-9", "Upper Chest", "Plate-Loaded Machine", "Top chest priority — the upper-chest shelf is the lead tissue.", "primary"]
    : ["Low Incline Barbell Press", pressSets, "5-8", "Upper Chest", "Barbell · Adjustable Bench", "Top chest priority press.", "primary"];

  // P1 — chest leads, anchored by one back-width movement.
  const p1: RawMovement[] = [
    primaryPress,
    ["Incline Dumbbell Press", 4, "8-11", "Upper Chest", "Dumbbells · Bench", "Secondary press — upper-chest volume after the priority slot.", "secondary"],
    ["Low-to-High Cable Fly", 3, "12-16", "Upper Chest", "Cable Stack", "Lengthened upper-chest stretch and squeeze.", "stretch"],
    ["Weighted Pull-Up", 4, "6-10", "Lats", "Pull-Up Bar", "Back width anchor — assisted / lat pulldown substitute is fine.", "primary"],
  ];

  // P2 — back thickness for posture, then a chest pump.
  const p2: RawMovement[] = [
    ["Chest-Supported T-Bar Row", 4, "8-12", "Mid-Back", "T-Bar", "Back thickness — pad-supported, supports posture and width.", "secondary"],
    ["Cable Squeeze Press", 3, "12-16", "Chest", "Cable Stack", "Chest pump in the shortened position.", "volume"],
  ];

  // P3 — rear-delt / scapular support, plus an optional readiness-gated chest finisher.
  const p3: RawMovement[] = [
    ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear delt / scapular support for shoulder balance.", "volume"],
  ];

  let reducedForRecovery = false;
  if (readiness === "strong") {
    p3.push(["Pec Deck", 3, "12-16", "Chest", "Pec Deck", "Optional chest specialization finisher — readiness allows.", "finisher"]);
  } else if (readiness === "limited") {
    // Keep the priority press + secondary press + one back anchor + posture work.
    // Pull back the chest pump and stretch volume first — never the priority.
    reducedForRecovery = true;
    p2.length = 0;
    p1.splice(2, 1); // drop the lengthened fly; keep two presses + back anchor
  }
  // "moderate" keeps the full session minus the optional finisher.

  const a = phase("chest-back", "P1", p1, 1);
  const b = phase("chest-back", "P2", p2, a.nextOrder);
  const c = phase("chest-back", "P3", p3, b.nextOrder);
  const phases = [a.phase, b.phase, c.phase].filter((p) => p.movements.length > 0);

  const winCondition = upperChest
    ? "Beat the top incline press by one clean rep with the upper-chest shelf leading."
    : "Beat the top chest press by one clean rep before adding load.";

  const focusPriority: FocusPriorityMeta = {
    active: true, kind: "chest", upperChestFirst: upperChest, readiness, reducedForRecovery,
    priorityTissue: upperChest ? "Upper Chest" : "Chest",
    winCondition,
    targetFeel: "Chest loaded through a deep stretch — pecs driving, shoulders set back and down.",
    executionCue: "Set the scapula, lead with the chest, and own the bottom stretch before pressing up and in.",
  };

  const rebuilt: WorkoutTemplate = {
    ...template,
    focus: "Chest priority · upper chest first · back support",
    sessionIntent: reducedForRecovery
      ? "RECOVERY PROTECTED: chest stays the lead tissue, but pump and finisher volume are pulled back today. Keep the priority press and one back anchor clean — do not force extra volume."
      : "SESSION INTENT: chest leads. Upper chest gets first exposure, then back work supports width and posture before a controlled chest finisher.",
    weakPointPriority: "Upper-chest architecture · chest density · back width + posture support",
    warmUpPrimer: "Prime shoulders, scapula, and upper chest before the first press.",
    recoveryHandoff: "RECOVERY HANDOFF: log the top press, chest pump quality, and any shoulder irritation. Back work supports posture — do not let rows turn into junk volume. Stop with pain and follow clinician guidance.",
    phases,
    focusPriority,
    chestPriority: focusPriority,
  };
  rebuilt.estimatedDurationMin = Math.round(countWorkingSets(rebuilt) * 2.6 + 16);
  return rebuilt;
}

/* ════════════════════════════════════════════════════════════════════════
   GLUTE / QUAD PRIORITY LAYER

   When glutes or quads is a selected priority, the lower-body days become
   glute- or quad-led: a hip-extension or knee-dominant lead, dedicated
   volume, the rest of the lower body supporting, and an optional finisher
   gated by readiness. Mirrors the chest-priority layer; no-op for any other
   split or any non-lower-focused member. Instruction only — no medical
   claims. Stop with pain and follow clinician guidance.
   ════════════════════════════════════════════════════════════════════════ */

/** Detect chest priority from the member's focus selection (primary + secondary). */
export function chestPriorityFromFocus(
  primary: string | null | undefined,
  secondary: string[] | undefined,
): { active: boolean; upperChest: boolean } {
  const p = (primary ?? "").toLowerCase();
  const sec = (secondary ?? []).map((s) => s.toLowerCase());
  const active = p === "chest" || p === "upper-chest";
  const upperChest = p === "upper-chest" || sec.includes("upper-chest");
  return { active, upperChest };
}

/** Detect lower-body priority (glutes / quads) from the member's selection. */
export function lowerPriorityFromFocus(
  primary: string | null | undefined,
  secondary: string[] | undefined,
): { active: boolean; glutes: boolean; quads: boolean; lead: "glute" | "quad" } {
  const p = (primary ?? "").toLowerCase();
  const sec = (secondary ?? []).map((s) => s.toLowerCase());
  const glutes = p === "glutes" || sec.includes("glutes");
  const quads = p === "quads" || sec.includes("quads");
  const active = p === "glutes" || p === "quads";
  // The PRIMARY selection leads; if primary isn't lower, this stays inactive.
  const lead: "glute" | "quad" = p === "quads" ? "quad" : "glute";
  return { active, glutes, quads, lead };
}

/**
 * Rebuild a lower-body template (legs / lower-posterior) as Glute- or
 * Quad-Priority. No-op unless the split is a lower day AND a lower-body
 * priority is active. Runs AFTER applyProtocolIntensity; preserves intensity.
 */
export function applyGlutePriority(
  template: WorkoutTemplate,
  opts: { active: boolean; glutes: boolean; quads: boolean; lead: "glute" | "quad"; readiness: ChestReadiness },
): WorkoutTemplate {
  if (!opts.active) return template;
  if (template.splitKey !== "legs" && template.splitKey !== "lower-posterior") return template;

  const tier = template.intensityTier ?? "standard";
  const advanced = INTENSITY_TIER_META[tier]?.advanced ?? false;
  const leadSets = advanced ? 5 : 4;
  const { readiness, lead } = opts;
  // The posterior day is always the glute / hamstring shape day; the front
  // lower day leads with whichever lower tissue the member prioritizes.
  const shapeDay = template.splitKey === "lower-posterior";
  const quadLead = lead === "quad" && !shapeDay;

  let p1: RawMovement[];
  let p2: RawMovement[];
  let p3: RawMovement[];
  let sessionLabel: string;
  let priorityTissue: string;
  let winCondition: string;
  let targetFeel: string;
  let executionCue: string;

  if (shapeDay) {
    // Glute / Hamstring shape day.
    sessionLabel = "Glute / Hamstring Shape";
    priorityTissue = "Glutes / Hamstrings";
    winCondition = "Own the lengthened hinge — load the hamstrings and glutes without lower-back takeover.";
    targetFeel = "Hamstrings and glutes under a deep, controlled stretch — hips hinging, spine neutral.";
    executionCue = "Ribs down, soft knees, push the hips back and feel the stretch before driving to lockout.";
    p1 = [
      ["Hip Hinge Rehearsal", 2, "10-12", "Hamstrings", "Bodyweight", "Primer for hinge mechanics and hamstring length.", "primer"],
      ["Romanian Deadlift", leadSets, "6-9", "Hamstrings", "Barbell", "Lengthened hinge lead — brace hard, hips back.", "primary"],
      ["Single-Leg Hip Thrust", 3, "10-12 / side", "Glutes", "Bench", "Unilateral glute shape and balance.", "secondary"],
    ];
    p2 = [
      ["Lying Leg Curl", 4, "8-12", "Hamstrings", "Leg Curl Machine", "Hamstring volume — curl through the pad.", "volume"],
      ["Abductor Machine", 3, "15-20", "Glutes", "Abductor Machine", "Glute medius shape work.", "volume"],
    ];
    p3 = [
      ["Walking Lunge", 3, "10-12 / leg", "Glutes", "Dumbbells", "Long stride, glute-biased.", "volume"],
    ];
  } else if (quadLead) {
    // Quad volume priority day.
    sessionLabel = "Quad Volume Priority";
    priorityTissue = "Quads";
    winCondition = "Beat the top hack squat by one clean rep with full depth and control.";
    targetFeel = "Quads loaded through full depth — knees tracking, tension held top to bottom.";
    executionCue = "Heels planted, controlled descent, drive through mid-foot without losing depth.";
    p1 = [
      ["Heel-Elevated Smith Squat", 2, "10-12", "Quads", "Smith Machine", "Quad-biased primer and ramp.", "activation"],
      ["Hack Squat", leadSets, "6-10", "Quads", "Hack Squat", "Knee-dominant lead — full depth, controlled.", "primary"],
      ["Leg Press", 4, "10-14", "Quads", "Leg Press", "Quad volume — feet low for quad bias.", "secondary"],
    ];
    p2 = [
      ["Bulgarian Split Squat", 3, "8-12 / leg", "Quads", "Dumbbells", "Unilateral quad volume and balance.", "volume"],
      ["Hip Thrust", 3, "8-12", "Glutes", "Barbell", "Glute support — keep the posterior chain progressing.", "secondary"],
    ];
    p3 = [
      ["Leg Extension", 4, "12-16", "Quads", "Leg Extension Machine", "Quad isolation finish.", "volume"],
    ];
  } else {
    // Glute strength priority day.
    sessionLabel = "Glute Strength Priority";
    priorityTissue = "Glutes";
    winCondition = "Own the top hip-extension pattern — load the glutes without lower-back takeover.";
    targetFeel = "Glutes loaded and contracting hard at lockout — hips driving, not the lower back.";
    executionCue = "Ribs down, pelvis controlled, pause and squeeze at full hip extension.";
    p1 = [
      ["Glute Bridge", 2, "12-15", "Glutes", "Bodyweight", "Glute activation primer before the heavy hinge.", "activation"],
      ["Hip Thrust", leadSets, "6-10", "Glutes", "Barbell", "Top hip-extension lead — posterior tilt at lockout.", "primary"],
      ["Bulgarian Split Squat", 4, "8-12 / leg", "Glutes", "Dumbbells", "Glute-biased unilateral strength.", "secondary"],
    ];
    p2 = [
      ["45-Degree Back Extension", 4, "10-15", "Glutes", "45 Degree Bench", "Glute-biased — round slightly, squeeze at lockout.", "volume"],
      ["Hack Squat", 3, "8-12", "Quads", "Hack Squat", "Quad support — keep the front of the legs progressing.", "secondary"],
    ];
    p3 = [
      ["Abductor Machine", 3, "15-20", "Glutes", "Abductor Machine", "Glute medius shape work.", "volume"],
    ];
  }

  let reducedForRecovery = false;
  if (readiness === "strong") {
    p3.push(["Cable Glute Kickback", 3, "15-20 / side", "Glutes", "Cable Stack", "Optional glute finisher — readiness allows.", "finisher"]);
  } else if (readiness === "limited") {
    // Keep the lead + one support + posture work; pull back isolation / finisher.
    reducedForRecovery = true;
    p3.length = 0;
    if (p2.length > 1) p2.length = 1;
  }

  const a = phase(template.splitKey, "P1", p1, 1);
  const b = phase(template.splitKey, "P2", p2, a.nextOrder);
  const c = phase(template.splitKey, "P3", p3, b.nextOrder);
  const phases = [a.phase, b.phase, c.phase].filter((p) => p.movements.length > 0);

  const focusPriority: FocusPriorityMeta = {
    active: true, kind: quadLead ? "quad" : shapeDay ? "posterior" : "glute",
    upperChestFirst: false, readiness, reducedForRecovery,
    priorityTissue, winCondition, targetFeel, executionCue,
  };

  const rebuilt: WorkoutTemplate = {
    ...template,
    displayName: sessionLabel,
    focus: shapeDay ? "Glutes · hamstrings · shape" : quadLead ? "Quads · lower-body priority" : "Glutes · lower-body priority",
    sessionIntent: reducedForRecovery
      ? `RECOVERY PROTECTED: ${priorityTissue.toLowerCase()} stay the lead, but isolation and finisher volume are pulled back today. Keep the lead pattern clean — do not force extra volume.`
      : `SESSION INTENT: ${sessionLabel.toLowerCase()}. The lead pattern comes first, lower body supports, and upper body stays maintained across the week.`,
    weakPointPriority: shapeDay ? "Glute / hamstring shape · posterior chain" : quadLead ? "Quad volume · lower-body priority" : "Glute strength · hip extension · lower-body priority",
    warmUpPrimer: "Prime hips, knees, and the lower back before the first heavy set.",
    recoveryHandoff: "RECOVERY HANDOFF: log the lead pattern and any hip, knee, or lower-back irritation. Stop with pain and follow clinician guidance.",
    phases,
    focusPriority,
  };
  rebuilt.estimatedDurationMin = Math.round(countWorkingSets(rebuilt) * 2.6 + 16);
  return rebuilt;
}

/* ════════════════════════════════════════════════════════════════════════
   WOMEN'S LAYERED PHYSIQUE SESSIONS

   Top-tier model / runway physique work is SHAPE-FREQUENCY architecture, not a
   one-muscle bro split. Every session layers: a priority block, a shape/support
   block, plus waist control / posture and a conditioning handoff — all serving
   one physique direction. Premium language only; no sexualized copy, no
   guarantees. Recovery-limited days keep the priority and trim finishers.
   The cockpit still loads by engine key; per-movement substitutions surface
   home (dumbbell / band / bodyweight) swaps. Stop with pain, follow clinician.
   ════════════════════════════════════════════════════════════════════════ */

export type WomensSessionKind =
  | "glute-strength-waist"
  | "quad-shape-glute-support"
  | "quad-shape-upper-finish"
  | "back-line-delts-conditioning"
  | "glute-hamstring-shape"
  | "upper-sculpt-posture";

type WomensSessionSpec = {
  label: string;
  priorityTissue: string;
  focus: string;
  win: string;
  feel: string;
  cue: string;
  warmUp: string;
  p1: (lead: number) => RawMovement[];
  p2: RawMovement[];
  /** P3 — the last entry is the trim-first conditioning finisher on low readiness. */
  p3: RawMovement[];
};

const WOMENS_SESSIONS: Record<WomensSessionKind, WomensSessionSpec> = {
  "glute-strength-waist": {
    label: "Glute Strength + Waist Control",
    priorityTissue: "Glutes · Core control",
    focus: "Glutes · waist control · hip stability",
    win: "Own the top hip-extension pattern with the glutes — no lower-back takeover.",
    feel: "Glutes loaded and squeezing hard at lockout while the waist stays braced and controlled.",
    cue: "Ribs down, pelvis controlled, pause and squeeze at full hip extension.",
    warmUp: "Prime glutes, hips, and the deep core before the first heavy hinge.",
    p1: (lead) => [
      ["Glute Bridge", 2, "12-15", "Glutes", "Bodyweight", "Glute activation before the heavy hinge.", "activation"],
      ["Hip Thrust", lead, "6-10", "Glutes", "Barbell", "Primary glute output — posterior tilt at lockout.", "primary"],
      ["Bulgarian Split Squat", 4, "8-12 / leg", "Glutes", "Dumbbells", "Glute-biased unilateral strength and balance.", "secondary"],
    ],
    p2: [
      ["45-Degree Back Extension", 4, "12-15", "Glutes", "45 Degree Bench", "Glute-biased — round slightly, squeeze at lockout.", "volume"],
      ["Heel-Elevated Goblet Squat", 3, "10-14", "Quads", "Dumbbell", "Quad support — keep the front of the legs progressing without stealing glute recovery.", "secondary"],
      ["Abductor Machine", 3, "15-20", "Glutes", "Abductor Machine", "Glute medius shape and hip stability.", "volume"],
    ],
    p3: [
      ["Anti-Extension Core Hold", 3, "30-45 sec", "Core", "Bodyweight", "Waist control — brace, no lumbar flare.", "volume"],
      ["Incline Walk", 1, "10-15 min", "Conditioning", "Treadmill", "Conditioning handoff — steps protect leanness.", "finisher"],
    ],
  },
  "quad-shape-glute-support": {
    label: "Quad Shape + Glute Support",
    priorityTissue: "Quads · Glute support",
    focus: "Quads · glute support · knee control",
    win: "Beat the top quad-dominant set with full depth and clean knee tracking.",
    feel: "Quads loaded through full depth with tension held; knees tracking over the toes.",
    cue: "Heels planted, controlled descent, drive through mid-foot without losing depth.",
    warmUp: "Prime knees, quads, and ankles before the first loaded squat pattern.",
    p1: (lead) => [
      ["Heel-Elevated Smith Squat", 2, "10-12", "Quads", "Smith Machine", "Quad-biased primer and ramp.", "activation"],
      ["Leg Press", lead, "8-12", "Quads", "Leg Press", "Knee-dominant lead — feet low for quad bias.", "primary"],
      ["Bulgarian Split Squat", 3, "8-12 / leg", "Quads", "Dumbbells", "Unilateral quad volume and balance.", "secondary"],
    ],
    p2: [
      ["Leg Extension", 4, "12-16", "Quads", "Leg Extension Machine", "Quad isolation and shape.", "volume"],
      ["Lying Leg Curl", 3, "10-14", "Hamstrings", "Leg Curl Machine", "Hamstring support — keep the posterior chain progressing alongside the quads.", "volume"],
      ["Abductor Machine", 3, "15-20", "Glutes", "Abductor Machine", "Glute medius support and hip stability.", "volume"],
    ],
    p3: [
      ["Standing Calf Raise", 3, "12-16", "Calves", "Calf Raise Machine", "Calf shape — pause low, full peak.", "volume"],
      ["Anti-Rotation Core Brace", 3, "10-12 / side", "Core", "Cable Stack", "Waist control — resist rotation.", "finisher"],
    ],
  },
  "quad-shape-upper-finish": {
    label: "Quads + Calves + Upper Finish",
    priorityTissue: "Quads · Calves · Upper Frame",
    focus: "Quads · calves · upper-frame detail",
    win: "Own the quad pattern, complete the calves, then finish the upper frame without adding unnecessary leg fatigue.",
    feel: "Quads loaded through full depth, calves working through full range, and the upper frame finished with clean control.",
    cue: "Control the squat pattern, pause the calf work, then keep the upper finish crisp and submaximal.",
    warmUp: "Prime knees, quads, ankles, and shoulders before the combined strength session.",
    p1: (lead) => [
      ["Heel-Elevated Smith Squat", 2, "10-12", "Quads", "Smith Machine", "Quad-biased primer and ramp.", "activation"],
      ["Leg Press", lead, "8-12", "Quads", "Leg Press", "Knee-dominant lead with controlled depth.", "primary"],
      ["Lying Leg Curl", 3, "10-14", "Hamstrings", "Leg Curl Machine", "Posterior support without a second heavy hinge.", "secondary"],
    ],
    p2: [
      ["Leg Extension", 3, "12-16", "Quads", "Leg Extension Machine", "Quad detail with controlled tempo.", "volume"],
      ["Standing Calf Raise", 4, "10-15", "Calves", "Calf Raise Machine", "Complete the lower leg through full range.", "volume"],
      ["Abductor Machine", 2, "15-20", "Glutes", "Abductor Machine", "Low-fatigue glute support without compromising the next sport exposure.", "volume"],
      ["Chest-Supported Row", 3, "10-14", "Mid-Back", "Row Machine", "Upper-frame posture without loading the lower back.", "volume"],
    ],
    p3: [
      ["Cable Lateral Raise", 3, "12-16", "Side Delts", "Cable Stack", "Controlled shoulder-line finish.", "volume"],
      ["Anti-Rotation Core Brace", 3, "10-12 / side", "Core", "Cable Stack", "Core control before the next sport exposure.", "finisher"],
    ],
  },
  "back-line-delts-conditioning": {
    label: "Back Line + Delts + Conditioning",
    priorityTissue: "Back Line · Delts",
    focus: "Back line · posture · delts · conditioning",
    win: "Own the pulldown and row with the back, not the arms — build the model frame.",
    feel: "Lats and mid-back working through a full stretch and squeeze; delts capping the frame.",
    cue: "Set the scapula, lead with the elbows, and own the squeeze before the stretch.",
    warmUp: "Prime scapula, lats, and the rotator cuff before the first pull.",
    p1: (lead) => [
      ["Assisted Pull-Up", lead, "6-10", "Lats", "Assisted Pull-Up Machine", "Back-width lead — lat pulldown substitute is fine.", "primary"],
      ["Chest-Supported Row", 4, "8-12", "Mid-Back", "Row Machine", "Back-line thickness and posture.", "secondary"],
    ],
    p2: [
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt and posture support.", "volume"],
      ["Lateral Raise", 4, "12-16", "Side Delts", "Dumbbells", "Delt shape to cap the frame — clean, no swing.", "volume"],
    ],
    p3: [
      ["Face Pull", 3, "15-20", "Rear Delts", "Cable Stack", "Lower-trap and posture detail.", "volume"],
      ["Incline Walk", 1, "12-18 min", "Conditioning", "Treadmill", "Conditioning handoff — StairMaster works if recovery allows.", "finisher"],
    ],
  },
  "glute-hamstring-shape": {
    label: "Glute / Hamstring Shape",
    priorityTissue: "Glutes · Hamstrings",
    focus: "Glute + hamstring shape · lengthened hinge · core",
    win: "Own the lengthened hinge — load hamstrings and glutes without lower-back takeover.",
    feel: "Hamstrings and glutes under a deep, controlled stretch; hips hinging, spine neutral.",
    cue: "Ribs down, soft knees, push the hips back and feel the stretch before driving to lockout.",
    warmUp: "Prime the hinge, hamstrings, and glutes before the first loaded RDL.",
    p1: (lead) => [
      ["Romanian Deadlift", lead, "6-9", "Hamstrings", "Barbell", "Lengthened hinge lead — brace hard, hips back.", "primary"],
      ["Single-Leg Hip Thrust", 3, "10-12 / side", "Glutes", "Bench", "Unilateral glute shape and balance.", "secondary"],
    ],
    p2: [
      ["Lying Leg Curl", 4, "8-12", "Hamstrings", "Leg Curl Machine", "Hamstring shape — curl through the pad.", "volume"],
      ["45-Degree Back Extension", 3, "12-15", "Glutes", "45 Degree Bench", "Glute-biased posterior shape.", "volume"],
    ],
    p3: [
      ["Cable Glute Kickback", 3, "15-20 / side", "Glutes", "Cable Stack", "Glute shape and contraction.", "volume"],
      ["Seated Calf Raise", 3, "12-16", "Calves", "Calf Raise Machine", "Calf shape — pause low, full peak.", "volume"],
      ["Hanging Knee Raise", 3, "12-15", "Core", "Pull-Up Bar", "Waist control — controlled, no swing.", "finisher"],
    ],
  },
  "upper-sculpt-posture": {
    label: "Upper Sculpt + Posture",
    priorityTissue: "Back Line · Posture",
    focus: "Upper sculpt · posture · delts · core",
    win: "Build the upper frame with clean pulls and presses — posture leads.",
    feel: "Back and delts working through full range; posture tall, core braced.",
    cue: "Proud chest, scapula set, control every rep top to bottom.",
    warmUp: "Prime scapula, shoulders, and t-spine before the first set.",
    p1: (lead) => [
      ["Lat Pulldown", lead, "8-12", "Lats", "Cable Stack", "Back-width lead for the upper frame.", "primary"],
      ["Incline Dumbbell Press", 3, "8-12", "Upper Chest", "Dumbbells · Bench", "Upper sculpt press — controlled.", "secondary"],
    ],
    p2: [
      ["Chest-Supported Row", 4, "10-14", "Mid-Back", "Row Machine", "Posture and back-line thickness.", "volume"],
      ["Lateral Raise", 4, "12-16", "Side Delts", "Dumbbells", "Delt shape — clean, no swing.", "volume"],
    ],
    p3: [
      ["Reverse Pec Deck", 3, "12-18", "Rear Delts", "Rear-Delt Machine", "Rear-delt and posture support.", "volume"],
      ["Anti-Extension Core Hold", 3, "30-45 sec", "Core", "Bodyweight", "Waist control and posture brace.", "finisher"],
    ],
  },
};

/**
 * Rebuild a template as a LAYERED women's physique session. The base template
 * is loaded by the resolver's engine key; this fully rebuilds the phases so the
 * session matches its display title (e.g. "Glute Strength + Waist Control" is
 * glutes + waist control + conditioning, never a plain glute-only day).
 */
export function applyWomensSession(
  template: WorkoutTemplate,
  kind: WomensSessionKind,
  readiness: ChestReadiness,
): WorkoutTemplate {
  const spec = WOMENS_SESSIONS[kind];
  const tier = template.intensityTier ?? "standard";
  const advanced = INTENSITY_TIER_META[tier]?.advanced ?? false;
  const leadSets = advanced ? 5 : 4;

  const p1 = spec.p1(leadSets);
  const p2 = [...spec.p2];
  const p3 = [...spec.p3];

  let reducedForRecovery = false;
  if (readiness === "limited") {
    // Keep the priority + core; trim the conditioning finisher and an isolation
    // block to protect hips, knees, and the lower back.
    reducedForRecovery = true;
    if (p3.length > 1) p3.pop(); // drop the trailing conditioning finisher
    if (p2.length > 1) p2.length = 1;
  } else if (readiness === "moderate") {
    // Trim only the trailing conditioning finisher; keep the shape work.
    if (p3.length > 1) p3.pop();
  }

  const a = phase(template.splitKey, "P1", p1, 1);
  const b = phase(template.splitKey, "P2", p2, a.nextOrder);
  const c = phase(template.splitKey, "P3", p3, b.nextOrder);
  const phases = [a.phase, b.phase, c.phase].filter((p) => p.movements.length > 0);

  const focusPriority: FocusPriorityMeta = {
    active: true,
    kind: kind === "quad-shape-glute-support" || kind === "quad-shape-upper-finish" ? "quad" : kind === "glute-hamstring-shape" ? "posterior" : "glute",
    upperChestFirst: false, readiness, reducedForRecovery,
    priorityTissue: spec.priorityTissue, winCondition: spec.win, targetFeel: spec.feel, executionCue: spec.cue,
  };

  const rebuilt: WorkoutTemplate = {
    ...template,
    displayName: spec.label,
    focus: spec.focus,
    sessionIntent: reducedForRecovery
      ? `RECOVERY PROTECTED: ${spec.label.toLowerCase()} keeps its priority block, but conditioning and isolation volume are pulled back today. Keep the lead pattern and core control clean.`
      : `SESSION INTENT: ${spec.label.toLowerCase()} — a layered physique session. The priority block leads, shape and posture work supports it, and waist control plus a conditioning handoff serve the physique direction.`,
    weakPointPriority: spec.focus,
    warmUpPrimer: spec.warmUp,
    recoveryHandoff: "RECOVERY HANDOFF: log the lead pattern, core control, and any hip, knee, or lower-back irritation. Stop with pain and follow clinician guidance.",
    phases,
    focusPriority,
  };
  rebuilt.estimatedDurationMin = Math.round(countWorkingSets(rebuilt) * 2.6 + 16);
  return rebuilt;
}

/* ════════════════════════════════════════════════════════════════════════
   TRAINING EXPERIENCE / INTENSITY SCALING LAYER

   The protocol decides WHAT the week trains and its base intensity tier.
   This layer decides HOW HARD the member is trained inside that — honest
   training experience, NOT a product tier. A beginner is never shown an
   overwhelming pro-level session; a Full-Gym / Athlete member is pushed with
   supersets, density, finishers, and fatigue-aware structure.

   Runs AFTER applyProtocolIntensity + focus / women transforms, so the
   protocol identity and architecture names are untouched. Pure + deterministic.
   Training instruction only — no medical claims, no dosing. Stop with pain.
   ════════════════════════════════════════════════════════════════════════ */

export type TrainingExperience =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "full-gym-advanced"
  | "athlete";

/** Honest training-level label (Beginner is fine here — it is a training level,
    NOT a public product tier). */
export const EXPERIENCE_LABEL: Record<TrainingExperience, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  "full-gym-advanced": "Full Gym Advanced",
  athlete: "Athlete / High Output",
};

export type ExperienceSpec = {
  label: string;
  /** One-line training-style summary. */
  style: string;
  /** Hard cap on total movements (protects beginners from giant sessions). 0 = no cap. */
  maxMovements: number;
  /** Per-role set caps — caps protocol volume DOWN so it never overwhelms. Empty = protocol governs. */
  setCap: Partial<Record<MovementRole, number>>;
  /** Supersets allowed (advanced sequencing). */
  supersetsAllowed: boolean;
  /** How many COMPLETE pairs a session may carry at this level. */
  maxSupersets: number;
  /** Pair only stable machine / cable work — the confidence-building guard for
      a first training level. Free-weight accessories stay solo. */
  supersetMachineOnly: boolean;
  /** How many safe isolation movements may finish with a drop set / rest-pause. */
  maxIntensityTechniques: number;
  /** Keep pump / finisher movements. */
  allowFinishers: boolean;
  /** Bias primary / secondary lifts toward stable machines (beginner confidence). */
  machineBias: boolean;
  /** Append a performance / conditioning finisher (athlete / high output). */
  performanceFinisher: boolean;
  /** Progression rules surfaced to the member for this level. */
  progression: string[];
};

export const EXPERIENCE_SPECS: Record<TrainingExperience, ExperienceSpec> = {
  beginner: {
    label: "Beginner",
    style: "Fewer movements, stable machines, clear rest, confidence-building completion — no overwhelming sessions.",
    maxMovements: 6,
    setCap: { primary: 3, secondary: 2, stretch: 2, volume: 2, finisher: 0, activation: 1, primer: 1 },
    supersetsAllowed: true,
    maxSupersets: 2,
    supersetMachineOnly: true,
    maxIntensityTechniques: 0,
    allowFinishers: false,
    machineBias: true,
    performanceFinisher: false,
    progression: [
      "Master the movement before adding load.",
      "Add reps before weight — stay inside the rep range.",
      "Complete every movement cleanly before adding volume.",
      "Leave reps in reserve — no training to failure.",
    ],
  },
  intermediate: {
    label: "Intermediate",
    style: "Moderate volume, some supersets, more movement variety, controlled progression.",
    maxMovements: 8,
    setCap: { primary: 4, secondary: 3, stretch: 3, volume: 3, finisher: 2 },
    supersetsAllowed: true,
    maxSupersets: 3,
    supersetMachineOnly: false,
    maxIntensityTechniques: 1,
    allowFinishers: true,
    machineBias: false,
    performanceFinisher: false,
    progression: [
      "Add load when you hit the top of the rep range with clean form.",
      "Add one set on a priority movement only when recovery is good.",
      "Use controlled supersets on accessories — never on the heavy lead.",
    ],
  },
  advanced: {
    label: "Advanced",
    style: "Higher volume, supersets, top-set / back-off where safe, advanced sequencing.",
    maxMovements: 10,
    setCap: {},
    supersetsAllowed: true,
    maxSupersets: 5,
    supersetMachineOnly: false,
    maxIntensityTechniques: 2,
    allowFinishers: true,
    machineBias: false,
    performanceFinisher: false,
    progression: [
      "Double progression — earn reps across the range, then add load.",
      "Top set then back-off sets on the primary where appropriate.",
      "Rest-pause or drop sets only on safe accessory movements.",
      "Superset accessories and run higher-density finishers.",
    ],
  },
  "full-gym-advanced": {
    label: "Full Gym Advanced",
    style: "Premium challenge — supersets, mechanical intensity, density blocks, pump finishers. Structured and recoverable.",
    maxMovements: 12,
    setCap: {},
    supersetsAllowed: true,
    maxSupersets: 6,
    supersetMachineOnly: false,
    maxIntensityTechniques: 3,
    allowFinishers: true,
    machineBias: false,
    performanceFinisher: false,
    progression: [
      "Double progression with mechanical drop options on accessories.",
      "Density blocks — compress rest on paired accessory work.",
      "Pump finishers to close, RIR / RPE managed across the session.",
      "Fatigue-aware — back off volume if recovery signals drop.",
    ],
  },
  athlete: {
    label: "Athlete / High Output",
    style: "Advanced work capacity, conditioning support, performance finisher, fatigue-aware session design.",
    maxMovements: 12,
    setCap: {},
    supersetsAllowed: true,
    maxSupersets: 6,
    supersetMachineOnly: false,
    maxIntensityTechniques: 3,
    allowFinishers: true,
    machineBias: false,
    performanceFinisher: true,
    progression: [
      "Train work capacity — manage density and conditioning across the week.",
      "Double progression on strength leads; quality output on conditioning.",
      "Performance finisher tracked for output, not random fatigue.",
      "Fatigue-aware — protect output, never bury recovery.",
    ],
  },
};

/** Stable machine swaps for beginner machineBias — keeps the training intent but
    removes intimidating / less-stable patterns. */
const BEGINNER_MACHINE_SWAP: Record<string, { name: string; equipment: string }> = {
  "Hip Thrust": { name: "Machine Hip Thrust", equipment: "Hip Thrust Machine" },
  "Romanian Deadlift": { name: "Seated Leg Curl", equipment: "Leg Curl Machine" },
  "Weighted Pull-Up": { name: "Machine Pulldown", equipment: "Pulldown Station" },
  "Assisted Pull-Up": { name: "Machine Pulldown", equipment: "Pulldown Station" },
  "Low Incline Barbell Press": { name: "Machine Incline Press", equipment: "Incline Press Machine" },
  "Incline Barbell Press": { name: "Machine Incline Press", equipment: "Incline Press Machine" },
  "Close-Grip Bench Press": { name: "Machine Dip", equipment: "Dip Machine" },
  "EZ-Bar Curl": { name: "Machine Preacher Curl", equipment: "Curl Machine" },
  "Barbell Overhead Press": { name: "Machine Shoulder Press", equipment: "Shoulder Press Machine" },
  "Chest-Supported T-Bar Row": { name: "Chest-Supported Row", equipment: "Row Machine" },
  "Bulgarian Split Squat": { name: "Leg Press", equipment: "Leg Press" },
};

function beginnerSwap(m: TemplateMovement): TemplateMovement {
  const e = m.equipment.toLowerCase();
  const intimidating = /barbell|pull-up bar|t-bar|landmine|weighted/.test(e);
  if (!intimidating) return m;
  const swap = BEGINNER_MACHINE_SWAP[m.name];
  if (!swap) return m;
  return { ...m, name: swap.name, equipment: swap.equipment, swappedFrom: m.name, difficulty: "beginner" };
}

/** A heavy free-weight compound that should never be supersetted with another. */
function isHeavyCompound(m: TemplateMovement): boolean {
  return /barbell|trap bar|t-bar/i.test(m.equipment) && (m.role === "primary" || m.role === "secondary");
}

/** Coarse muscle GROUP for a target-muscle label, so "Triceps" and "Long-Head
 *  Triceps" are recognised as the same tissue. Comparing the raw labels paired
 *  a rope pressdown straight into an overhead extension and called it
 *  complementary. Delt heads stay distinct on purpose — front / side / rear do
 *  different jobs and pair together well. */
export function muscleGroup(target: string): string {
  const t = target.trim().toLowerCase();
  if (/rear[- ]delt|rear deltoid|posterior delt/.test(t)) return "rear-delts";
  if (/side delt|lateral delt|medial delt/.test(t)) return "side-delts";
  if (/front delt|anterior delt/.test(t)) return "front-delts";
  if (/tricep/.test(t)) return "triceps";
  if (/bicep|brachial/.test(t)) return "biceps";
  if (/forearm|grip|wrist/.test(t)) return "forearms";
  if (/pec|chest/.test(t)) return "chest";
  if (/trap/.test(t)) return "traps";
  if (/\blats?\b|latissimus|back width/.test(t)) return "lats";
  if (/back/.test(t)) return "back";
  if (/quad/.test(t)) return "quads";
  if (/ham|posterior chain/.test(t)) return "hamstrings";
  if (/glute/.test(t)) return "glutes";
  if (/calf|calves|soleus|gastroc|tibialis/.test(t)) return "calves";
  if (/adduct|abduct|hip/.test(t)) return "hips";
  if (/core|\babs?\b|oblique/.test(t)) return "core";
  return t;
}

/** Whether two accessory movements form an intelligent superset:
 *  never two heavy iron compounds; two pump finishers may pair (same area is
 *  fine for a burn); otherwise require COMPLEMENTARY (different) muscle groups
 *  so we pair antagonists / accessories, never two same-muscle movements early. */
function canSuperset(a: TemplateMovement, b: TemplateMovement, circuit = false): boolean {
  if (isHeavyCompound(a) || isHeavyCompound(b)) return false;
  if (a.role === "finisher" && b.role === "finisher") return true;
  /* A circuit session pairs the same muscle on purpose — a glute round of
     kickback into abduction is the whole method, not a sequencing mistake. */
  if (circuit) return true;
  return muscleGroup(a.targetMuscle) !== muscleGroup(b.targetMuscle);
}

/** Rest after a completed superset round. Two movements back to back earn a
 *  shorter round rest than two separate ones — roughly two thirds, floored at
 *  fifteen seconds and capped at a minute so density stays density. */
function pairRest(rest: string): string {
  const first = rest.split("-")[0]?.trim() ?? "";
  const m = first.match(/^(\d+):(\d{2})$/);
  if (!m) return "0:30";
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const next = Math.min(60, Math.max(15, Math.round(total * 0.66)));
  return `${Math.floor(next / 60)}:${String(next % 60).padStart(2, "0")}`;
}

/**
 * Scale a (protocol-intensified) template by training experience.
 * Beginner: caps volume, drops finishers, biases to machines, no supersets,
 * trims to a manageable movement count. Advanced+: supersets + finishers kept,
 * density flagged. Athlete: a performance conditioning finisher is appended.
 */
/* ════════════════════════════════════════════════════════════════════════
   WORKOUT DEMAND SCALING — the member's chosen session-depth tier.

   Runs AFTER experience scaling, on the already-safe session. The gate
   (lib/training/workout-demand.ts) has already clamped the tier by training
   age / readiness / pain / deload, so this stage only expresses depth.

   It reads WORKOUT_DEMAND_META and does what the meta says. That sounds
   obvious; it was not true. The meta advertised a set multiplier, a rest
   bias, an exercise delta and a technique ceiling, and this function used
   none of them — it added one set to two roles and stopped. An Elite Volume
   leg day promised "added angles" and built 34 sets where High Output built
   31. The member read one session and got another.

   Now the numbers in the meta ARE the session: change 1.25 and the sets
   change. Nothing here can make a session harder than the gate allowed,
   because the gate already chose the tier being expressed.
   ════════════════════════════════════════════════════════════════════════ */

/** Nobody trains past this on one movement, whatever the multiplier says. */
const DEMAND_SET_CEILING = 6;

export function applyWorkoutDemand(
  template: WorkoutTemplate,
  demand: import("@/lib/training/workout-demand").WorkoutDemandLevel,
): WorkoutTemplate {
  const meta = WORKOUT_DEMAND_META[demand];

  /* Rest is authored as "1:45-2:30". The old scaler matched `90s`, a format
     no template has ever used, so "tighter rest" moved nothing. Clamped at
     30s — compressed rest is a density choice, not a licence to remove rest. */
  const REST_FLOOR_S = 30;
  const scaleRest = (rest: string, factor: number) =>
    rest.replace(/(\d+):([0-5]\d)/g, (_m, mins: string, secs: string) => {
      const raw = Number(mins) * 60 + Number(secs);
      /* A zero rest is a superset instruction — go straight into the partner.
         The floor below must never turn that into a thirty-second pause, at
         any session depth, or the pairing stops being a pairing. */
      if (raw === 0) return "0:00";
      const total = Math.max(REST_FLOOR_S, Math.round(raw * factor));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    });
  const restFactor = meta.restBias === "compressed" ? 0.85 : meta.restBias === "full" ? 1.15 : 1;

  /* The heavy lead keeps its authored sets on the way down — trimming a
     top-set movement changes what the session IS, not how deep it goes. */
  const scaleSets = (sets: number, role: MovementRole): number => {
    if (meta.setMultiplier < 1 && role === "primary") return sets;
    const scaled = Math.round(sets * meta.setMultiplier);
    const floor = role === "primary" ? Math.min(sets, 3) : 1;
    return Math.max(floor, Math.min(DEMAND_SET_CEILING, scaled));
  };

  let phases = template.phases.map((p) => {
    let movements = p.movements.map((m) => ({
      ...m,
      sets: scaleSets(m.sets, m.role),
      rest: restFactor === 1 ? m.rest : scaleRest(m.rest, restFactor),
    }));
    // A negative delta comes off detail work first — essentials only.
    if (meta.exerciseDelta < 0 && p.phase === "detail-work" && p.movements.length > 1) {
      movements = movements.slice(0, meta.exerciseDelta);
    }
    return { ...p, movements };
  });

  /* Added angles come from the split's own specialization pool, the same one
     the advanced protocol tiers draw on — so depth never invents a movement
     the split does not own. A movement an earlier stage already added is
     skipped rather than duplicated. */
  if (meta.exerciseDelta > 0) {
    const addon = template.splitKey ? SPLIT_ADDONS[template.splitKey] : null;
    if (addon) {
      const present = new Set(phases.flatMap((p) => p.movements.map((m) => m.name.trim().toLowerCase())));
      const wanted: Addon[] = [addon.spec, addon.finisher].slice(0, meta.exerciseDelta);
      let order = phases.reduce((mx, p) => p.movements.reduce((m2, mv) => Math.max(m2, mv.order), mx), 0);
      for (const a of wanted) {
        if (present.has(a.name.trim().toLowerCase())) continue;
        const wantedPhase: WorkoutPhaseKey = a.role === "finisher" ? "detail-work" : "secondary-volume";
        const host = phases.find((p) => p.phase === wantedPhase) ?? phases[phases.length - 1];
        if (!host) continue;
        order += 1;
        host.movements = [...host.movements, synthMovement(template.splitKey, order, a, scaleSets(3, a.role))];
        present.add(a.name.trim().toLowerCase());
      }
    }
  }

  /* Technique ceiling. Only ever removes: Precision carries none, and a tier
     never gains a drop-set it was not already given upstream. */
  let techniques = 0;
  phases = phases.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      if (!m.finishingTechnique) return m;
      if (techniques < meta.intensityTechniques) {
        techniques += 1;
        return m;
      }
      const capped = { ...m };
      delete capped.finishingTechnique;
      return capped;
    }),
  }));

  phases = phases.filter((p) => p.movements.length > 0);

  /* Every other stage recomputes the estimate from the sets it left behind.
     Demand runs last and did not, so a 45-set Elite Volume leg day still
     advertised the 31-set session's "76 min" while the horizon directly
     below it laid the same session out across 129. Per-set cost follows the
     rest bias, because rest is what changed between the sets. */
  const scaled: WorkoutTemplate = { ...template, phases };
  const perSetMin = meta.restBias === "compressed" ? 2.4 : meta.restBias === "full" ? 3.0 : 2.6;
  scaled.estimatedDurationMin = Math.round(countWorkingSets(scaled) * perSetMin + 14);
  return scaled;
}


export function applyExperienceScaling(template: WorkoutTemplate, experience: TrainingExperience): WorkoutTemplate {
  const spec = EXPERIENCE_SPECS[experience];

  // 1) Per-phase movement transforms: set caps, finisher gating, machine bias.
  let phases: TemplatePhase[] = template.phases.map((p) => {
    let movements = p.movements.map((m) => {
      const cap = spec.setCap[m.role];
      let next: TemplateMovement = cap != null ? { ...m, sets: Math.min(m.sets, cap) } : { ...m };
      if (spec.machineBias) next = beginnerSwap(next);
      return next;
    });
    // Drop finisher movements entirely when finishers are not allowed (beginner).
    if (!spec.allowFinishers) movements = movements.filter((m) => m.role !== "finisher");
    // Drop any movement whose cap zeroed it out (keep recovery handoffs).
    movements = movements.filter((m) => m.sets > 0 || m.role === "recovery");
    return { ...p, movements };
  });

  // 2) Enforce the movement cap — trim the lowest-priority detail / volume slots first.
  if (spec.maxMovements > 0) {
    const total = () => phases.reduce((s, p) => s + p.movements.length, 0);
    const trimOrder: WorkoutPhaseKey[] = ["detail-work", "secondary-volume"];
    for (const phaseKey of trimOrder) {
      while (total() > spec.maxMovements) {
        const p = phases.find((ph) => ph.phase === phaseKey && ph.movements.length > 0);
        if (!p) break;
        p.movements = p.movements.slice(0, -1); // remove least-essential movement
      }
      if (total() <= spec.maxMovements) break;
    }
  }

  // 3) INTELLIGENT superset pairing on accessory phases when allowed.
  //    Pairs COMPLEMENTARY accessories (antagonist / different target, or two
  //    pump finishers) — never two heavy iron compounds, never the heavy lead,
  //    and never two same-muscle movements outside a pump finish. Count is
  //    capped by experience: a first training level gets a couple of stable
  //    machine pairs so the session has a pulse without being intimidating,
  //    and advanced levels get real density.
  //    Labels are A1/A2, B1/B2 … so the pairing is explicit in the UI, and
  //    each half names its partner so a card can say what comes next.
  let supersetCount = 0;
  if (spec.supersetsAllowed && spec.maxSupersets > 0) {
    const groups = ["A", "B", "C", "D", "E", "F"];
    /* Accessory roles only. `secondary` joins the pool above a first training
       level — a chest-supported row and a cable fly pair perfectly well, and
       isHeavyCompound still blocks anything on free iron. */
    const pairableRole = (role: MovementRole) =>
      role === "volume" || role === "stretch" || role === "finisher" ||
      (role === "secondary" && !spec.supersetMachineOnly);
    /* A first training level pairs stable machines and cables only. */
    const pairableEquipment = (m: TemplateMovement) =>
      !spec.supersetMachineOnly || /machine|cable|pec deck|pulldown|press machine|stack|smith/i.test(m.equipment);

    for (const p of phases) {
      if (supersetCount >= spec.maxSupersets) break;
      if (p.phase === "primary-output") continue; // never superset the heavy lead
      const pool = p.movements.filter((m) => pairableRole(m.role) && pairableEquipment(m) && !m.superset);
      const used = new Set<number>();
      for (let i = 0; i < pool.length && supersetCount < spec.maxSupersets; i++) {
        if (used.has(i)) continue;
        let partner = -1;
        for (let j = i + 1; j < pool.length; j++) {
          if (used.has(j)) continue;
          if (canSuperset(pool[i], pool[j], template.circuitStyle)) { partner = j; break; }
        }
        if (partner === -1) continue;
        const g = groups[supersetCount] ?? `S${supersetCount + 1}`;
        supersetCount += 1;
        pool[i].superset = `${g}1`;
        pool[partner].superset = `${g}2`;
        pool[i].supersetPartner = pool[partner].name;
        pool[partner].supersetPartner = pool[i].name;
        /* The pairing used to be cosmetic: the first half kept its full role
           rest, so a "superset" read as do A1, rest ninety seconds, do A2.
           A pair has no rest inside it — the rest belongs after the round, and
           a paired round earns a shorter one than two separate movements. */
        pool[i].rest = "0:00";
        pool[partner].rest = pairRest(pool[partner].rest);
        used.add(i);
        used.add(partner);
      }
    }
  }

  // 3b) INTENSITY TECHNIQUES — a drop set or rest-pause closing the LAST set of
  //     safe isolation work. Machines and cables only, never a free-weight
  //     compound, never the heavy lead, and never on a first training level.
  //     Alternates the two techniques so a session does not read as one trick.
  if (spec.maxIntensityTechniques > 0) {
    const kinds: FinishingTechnique["kind"][] = ["drop-set", "rest-pause"];
    let applied = 0;
    /* Latest work first — intensity belongs at the end of the session, on the
       movements that close it out, not on the first accessory of the day. */
    const ordered = phases
      .filter((p) => p.phase !== "primary-output")
      .flatMap((p) => p.movements)
      .filter(
        (m) =>
          (m.role === "volume" || m.role === "stretch" || m.role === "finisher") &&
          /machine|cable|pec deck|pulldown|stack|smith|leg curl|leg extension/i.test(m.equipment) &&
          !isHeavyCompound(m) &&
          m.sets >= 2 &&
          /* Never the FIRST half of a pair — the member is meant to go straight
             into the partner, and a rest-pause there breaks the superset. The
             second half can carry one: it closes the round out. */
          !/1$/.test(m.superset ?? ""),
      )
      .reverse();
    for (const m of ordered) {
      if (applied >= spec.maxIntensityTechniques) break;
      m.finishingTechnique = FINISHING_TECHNIQUES[kinds[applied % kinds.length]];
      applied += 1;
    }
  }

  // 4) Athlete performance finisher — appended, fatigue-aware, never on beginners.
  if (spec.performanceFinisher) {
    const p3 = phases.find((p) => p.phase === "detail-work") ?? phases[phases.length - 1];
    if (p3) {
      const order = phases.reduce((mx, p) => p.movements.reduce((m2, mv) => Math.max(m2, mv.order), mx), 0) + 1;
      const condition: Addon = {
        name: "Conditioning Finisher", reps: "6-10 min", muscle: "Conditioning", equipment: "Bike / Rower / Sled",
        purpose: "Performance conditioning handoff — work capacity, output tracked, fatigue-aware.", role: "finisher",
      };
      p3.movements = [...p3.movements, synthMovement(template.splitKey, order, condition, 1)];
    }
  }

  phases = phases.filter((p) => p.movements.length > 0);

  const scaled: WorkoutTemplate = {
    ...template,
    phases,
    experienceTarget: experience,
    experienceLabel: spec.label,
    supersetCount,
  };
  const workingSets = countWorkingSets(scaled);
  scaled.estimatedDurationMin = Math.round(workingSets * (spec.supersetsAllowed ? 2.3 : 2.7) + 14);
  scaled.volumeTier = volumeTierFor(workingSets);
  scaled.densityTier = densityTierFor(supersetCount);
  return scaled;
}

/* ════════════════════════════════════════════════════════════════════════
   LONG-PROTOCOL PHASE PROGRESSION (12–24 week architecture)
   ------------------------------------------------------------------------
   A Reserve protocol is not the same session for 24 weeks. The protocol's
   current week maps to a TRAINING PHASE, and the phase modulates HOW the
   session is run — never WHICH movements are programmed (no junk volume, no
   invented exercises). Heavy compounds stay clean and performance-focused;
   intensity techniques and rep-range rotation land on the safe isolation /
   machine / cable accessory work. This is what stops weeks 9–12 and 17–20
   from feeling identical. Pure transform — no medical / dosing content.
   ════════════════════════════════════════════════════════════════════════ */
export type TrainingPhase =
  | "foundation"      // wk 1–4   · accumulation, execution, baseline data
  | "progression"     // wk 5–8   · progressive overload, top-set/back-off
  | "specialization"  // wk 9–12  · weak-point attack, stretch/pump, rest-pause
  | "intensification" // wk 13–16 · heavier top sets, density blocks
  | "refinement"      // wk 17–20 · rotate angles/reps, lengthened partials
  | "peak";           // wk 21–24 · peak / joint-sparing / reset-deload

/** Map a protocol's current week → training phase. Absolute 4-week bands match
    the documented Reserve phase plan; protocols simply stop at the band their
    length reaches (a 12-week protocol never leaves specialization). The final
    week of a ≥8-week protocol always reads as a peak/reset week. No protocol /
    open-ended → "progression" (a solid advanced default, never a soft block). */
export function phaseForProtocolWeek(currentWeek: number | null | undefined, totalWeeks: number | null | undefined): TrainingPhase {
  const total = totalWeeks ?? 0;
  const wk = Math.max(1, currentWeek ?? 1);
  if (total <= 0) return "progression";
  if (total >= 8 && wk >= total) return "peak";
  if (wk <= 4) return "foundation";
  if (wk <= 8) return "progression";
  if (wk <= 12) return "specialization";
  if (wk <= 16) return "intensification";
  if (wk <= 20) return "refinement";
  return "peak";
}

type PhaseSpec = {
  label: string;
  note: string;
  /** Intensity-technique tag applied to safe accessory work (stretch / volume /
      finisher). Text only — surfaced on the movement, not a new exercise. */
  accessoryTechnique: string | null;
  /** Rep-range override for accessory work (null = keep the authored range). */
  accessoryReps: string | null;
  /** Coaching note on the heavy compound lead — compounds otherwise stay as
      authored (performance-focused, no pump-ifying the main lift). */
  primaryNote: string | null;
  /** Working-set delta by role, applied on top of experience scaling. Kept to
      ±1 on accessory roles so progression is real but never junk volume. */
  setDelta: Partial<Record<MovementRole, number>>;
  /** Conservative numeric progression for the PRIMARY compound lead only.
      setDelta is clamped so a main lift never drops below 3 working sets;
      repShift nudges the authored range to bias strength (−) or rep
      accumulation (+) by phase — heavy compounds stay performance-focused,
      never pump-ified. Secondary compounds keep their authored loading. */
  primarySetDelta: number;
  primaryRepShift: number;
};

const PHASE_SPECS: Record<TrainingPhase, PhaseSpec> = {
  foundation: {
    label: "Foundation · Accumulation",
    note: "Weeks 1–4 — establish execution and clean volume. Straight sets, controlled eccentrics, leave 1–2 reps in reserve, build baseline data.",
    accessoryTechnique: "Controlled eccentric",
    accessoryReps: null,
    primaryNote: "Straight sets — lock the pattern and bank baseline strength data, 1–2 RIR.",
    setDelta: {},
    primarySetDelta: 0,
    primaryRepShift: 0,
  },
  progression: {
    label: "Progressive Overload · Growth",
    note: "Weeks 5–8 — add load, reps, and density. Top set then back-off on the main lift; controlled supersets on accessories.",
    accessoryTechnique: "Controlled superset",
    accessoryReps: null,
    primaryNote: "Top set → back-off sets. Earn reps across the range, then add load.",
    setDelta: { volume: 1 },
    primarySetDelta: 0,
    primaryRepShift: 1,
  },
  specialization: {
    label: "Specialization · Weak-Point Attack",
    note: "Weeks 9–12 — priority tissue earns extra targeted volume. Stretch-biased work and pump finishers with rest-pause on safe isolation.",
    accessoryTechnique: "Stretch-biased · rest-pause",
    accessoryReps: "12-20",
    primaryNote: "Compound stays clean — performance first, then attack the lagging tissue.",
    setDelta: { stretch: 1, finisher: 1 },
    primarySetDelta: 0,
    primaryRepShift: 1,
  },
  intensification: {
    label: "Intensification · Density",
    note: "Weeks 13–16 — heavier top sets, higher-density pump blocks, advanced supersets and mechanical drops on safe machines.",
    accessoryTechnique: "Mechanical drop · density",
    accessoryReps: "10-15",
    primaryNote: "Heavier top set, lower reps with full recovery. Keep the compound clean.",
    setDelta: { volume: 1, finisher: 1 },
    primarySetDelta: 0,
    primaryRepShift: -1,
  },
  refinement: {
    label: "Refinement · Specialization Round 2",
    note: "Weeks 17–20 — rotate angles and rep ranges off the earlier specialization block. Lengthened partials and iso-holds to find new stimulus, not repeat it.",
    accessoryTechnique: "Lengthened partials · iso-hold",
    accessoryReps: "15-20",
    primaryNote: "Rotate the rep range vs the earlier block — sharpen, don't repeat the same stimulus.",
    setDelta: { stretch: 1 },
    primarySetDelta: 0,
    primaryRepShift: 2,
  },
  peak: {
    label: "Peak · Reset",
    note: "Weeks 21–24 — peak output where it counts, trim joint stress, bias machines / cables, reduce junk volume, and reset for the next cycle.",
    accessoryTechnique: "Machine-bias · fatigue-managed",
    accessoryReps: null,
    primaryNote: "Peak the main lift if fresh; otherwise hold and protect the joints — quality over junk volume.",
    setDelta: { volume: -1, finisher: -1 },
    primarySetDelta: -1,
    primaryRepShift: 0,
  },
};

const ACCESSORY_ROLES: ReadonlySet<MovementRole> = new Set<MovementRole>(["stretch", "volume", "finisher"]);

/** Phase metadata for a given training phase (label + focus note). */
export function phaseMeta(phase: TrainingPhase): { label: string; note: string } {
  const s = PHASE_SPECS[phase];
  return { label: s.label, note: s.note };
}

/** Shift a "lo-hi" rep range by delta, preserving any suffix (e.g. " / leg").
    Low end is floored at 2 and kept below the high end. Non-range strings
    (AMRAP, "21s", time holds) are returned unchanged. */
function shiftRepRange(reps: string, delta: number): string {
  if (delta === 0) return reps;
  const m = reps.match(/^(\d+)\s*-\s*(\d+)(.*)$/);
  if (!m) return reps;
  const lo = Math.max(2, parseInt(m[1], 10) + delta);
  const hi = Math.max(lo + 1, parseInt(m[2], 10) + delta);
  return `${lo}-${hi}${m[3]}`;
}

/**
 * Modulate an (already experience-scaled) template by the protocol's training
 * phase. The PRIMARY compound carries a conservative numeric progression
 * (rep-range bias by phase, a set-trim only on the peak/reset block) and the
 * phase coaching note; SECONDARY compounds keep authored loading + the note;
 * the safe accessory work carries the phase's intensity technique, rep-range
 * rotation, and a small ±1 set delta. This is the anti-plateau layer: the same
 * split in week 3 vs week 14 vs week 19 reads and runs differently.
 */
export function applyPhaseProgression(template: WorkoutTemplate, phase: TrainingPhase): WorkoutTemplate {
  const spec = PHASE_SPECS[phase];
  const phases = template.phases.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      // Primary compound lead: conservative numeric progression + coaching note.
      // Never drops below 3 working sets; rep shift keeps it performance-focused.
      if (m.role === "primary") {
        const sets = Math.max(3, m.sets + spec.primarySetDelta);
        const targetReps = shiftRepRange(m.targetReps, spec.primaryRepShift);
        return { ...m, sets, targetReps, fatigueNote: spec.primaryNote ?? m.fatigueNote };
      }
      // Secondary compounds: keep authored loading, add the phase note only.
      if (m.role === "secondary") {
        return spec.primaryNote ? { ...m, fatigueNote: spec.primaryNote } : { ...m };
      }
      if (ACCESSORY_ROLES.has(m.role)) {
        const delta = spec.setDelta[m.role] ?? 0;
        const sets = Math.max(1, m.sets + delta);
        const targetReps = spec.accessoryReps ?? m.targetReps;
        const intensity = spec.accessoryTechnique ? `${m.intensity} · ${spec.accessoryTechnique}` : m.intensity;
        return { ...m, sets, targetReps, intensity };
      }
      return { ...m };
    }),
  }));
  return { ...template, phases, trainingPhase: phase, phaseLabel: spec.label, phaseNote: spec.note };
}

/** Progression rules for the member's experience — surfaced in the cockpit. */
export function progressionRulesFor(experience: TrainingExperience): string[] {
  return EXPERIENCE_SPECS[experience].progression;
}

/* ════════════════════════════════════════════════════════════════════════
   CORE TIMING — configurable / coach-smart core placement.
   ------------------------------------------------------------------------
   Core no longer has to live at the end of the session. The best program is
   the one the member actually finishes — so a member who skips post-workout
   abs can move core BEFORE or AFTER the main lift to lift weekly core
   frequency. Honest coaching rules apply: on heavy lower / compound days,
   pre-core is light activation / bracing ONLY (never fatiguing); upper / tone /
   posture / conditioning days can carry core earlier and harder; glute /
   runway / waistline protocols keep core visibility high.

   Pure + deterministic. Programming only — no medical / dosing content.
   ════════════════════════════════════════════════════════════════════════ */

export type CoreTiming = "auto" | "before_main" | "after_main" | "end";
export type CorePlacementSlot = "before-main" | "after-main" | "end";

export type CorePlacement = {
  slot: CorePlacementSlot;
  /** Light activation / bracing only — set on heavy lower / compound days. */
  lightOnly: boolean;
  /** Premium one-line reason shown to the member. */
  reason: string;
};

export type CorePlacementContext = {
  coreTiming?: CoreTiming;
  /** Lead region of the session (drives the auto rules). */
  region?: "upper" | "lower" | "mixed" | "general";
  /** Session leads with a heavy compound (squat / deadlift / hinge / heavy press). */
  heavyCompoundLead?: boolean;
  /** Glute / runway / waistline / posture protocols — waistline visibility is high. */
  waistlineFocus?: boolean;
  /** Conditioning day — core integrates as a circuit. */
  conditioning?: boolean;
};

/** Resolve where the core block goes + whether it must stay light + why. */
export function resolveCorePlacement(ctx: CorePlacementContext): CorePlacement {
  const timing = ctx.coreTiming ?? "auto";
  const heavy = Boolean(ctx.heavyCompoundLead) || ctx.region === "lower";

  if (timing === "before_main") {
    return {
      slot: "before-main",
      lightOnly: heavy,
      reason: heavy
        ? "Light core activation up front — bracing primes your main lift without fatiguing it."
        : "Core is placed early for consistency — you train it before fatigue sets in.",
    };
  }
  if (timing === "after_main") {
    return { slot: "after-main", lightOnly: false, reason: "Core sits right after your main lift — heavy output stays protected, then brace and waist control." };
  }
  if (timing === "end") {
    return { slot: "end", lightOnly: false, reason: "Core closes the session — full output on the lifts first, then brace and waist-control work." };
  }

  // auto — honest coaching rules.
  // Upper-body days (chest / back, delts, arms) never interrupt push / pull work
  // with abs — core closes the session as the end-of-session brace block. The one
  // exception is a waistline protocol, where core IS the point, so it leads.
  if (ctx.region === "upper" && !ctx.waistlineFocus) {
    return { slot: "end", lightOnly: false, reason: "Upper-body day — full output on press and pull first; core closes the session as the brace / waist-control block." };
  }
  // Lower-body days (legs / glutes) — core also closes the session so it never
  // sits between the squat / hinge and the accessory work. Waistline protocols
  // are the exception (core leads, handled below) since core is the point there.
  if (ctx.region === "lower" && !ctx.waistlineFocus) {
    return { slot: "end", lightOnly: false, reason: "Lower-body day — squats and hinges keep full output; core closes the session as the brace / waist-control block." };
  }
  if (heavy) {
    return ctx.waistlineFocus
      ? { slot: "before-main", lightOnly: true, reason: "Waistline matters here, so core leads as light activation — bracing only, never enough to dull the main lift." }
      : { slot: "after-main", lightOnly: false, reason: "Heavy day — core is placed after the main lift so squats / hinges keep full output." };
  }
  if (ctx.waistlineFocus) {
    return { slot: "before-main", lightOnly: false, reason: "Waistline and posture lead this protocol — core is trained early so it never gets skipped." };
  }
  if (ctx.conditioning) {
    return { slot: "after-main", lightOnly: false, reason: "Conditioning day — core integrates mid-session as part of the circuit." };
  }
  // general / mixed days — core closes the session rather than interrupting it.
  if (ctx.region === "general" || ctx.region === "mixed") {
    return { slot: "end", lightOnly: false, reason: "Core closes the session — full output on the main work first, then brace and waist control." };
  }
  return { slot: "after-main", lightOnly: false, reason: "Core is placed after your main lift so the heavy work keeps full output." };
}

/* Core blocks — light activation (heavy days) vs full contractile/anti-rotation. */
const CORE_BLOCK_LIGHT: Addon[] = [
  { name: "Dead Bug", reps: "2 × 10 / side", muscle: "Core", equipment: "Bodyweight", purpose: "Brace activation — ribs down, no lumbar flare.", role: "activation" },
  { name: "Pallof Press", reps: "2 × 10 / side", muscle: "Core", equipment: "Cable Stack", purpose: "Anti-rotation brace primer for the main lift.", role: "activation" },
];
const CORE_BLOCK_FULL: Addon[] = [
  { name: "Hanging Knee Raise", reps: "3 × 12-15", muscle: "Core", equipment: "Pull-Up Bar", purpose: "Lower-ab control — posterior tilt at the top, no swing.", role: "volume" },
  { name: "Pallof Press", reps: "3 × 10 / side", muscle: "Core", equipment: "Cable Stack", purpose: "Anti-rotation waist control under load.", role: "volume" },
];

/**
 * Inject a VISIBLE core block into the movement queue at the resolved position
 * so core surfaces earlier instead of being buried at the end. "end" placement
 * is a no-op (the end-of-session Core Command panel handles it). Runs last, so
 * intensity / experience scaling never trims the core block. Pure transform.
 */
export function applyCoreTiming(template: WorkoutTemplate, placement: CorePlacement): WorkoutTemplate {
  if (placement.slot === "end") return { ...template, corePlacement: placement };

  const block = placement.lightOnly ? CORE_BLOCK_LIGHT : CORE_BLOCK_FULL;
  const coreMovements: TemplateMovement[] = block.map((a, i) => {
    const m = synthMovement(template.splitKey, 0, a, placement.lightOnly ? 2 : 3);
    return {
      ...m,
      id: `core-${slug(a.name)}`,
      // Pair the full core block as superset group "C"; light activation stays sequential.
      superset: placement.lightOnly ? undefined : `C${i + 1}`,
      notes: placement.reason,
    };
  });

  const phases = template.phases.map((p) => ({ ...p, movements: [...p.movements] }));
  if (placement.slot === "before-main") {
    if (phases[0]) phases[0].movements = [...coreMovements, ...phases[0].movements];
  } else {
    // after-main → lead the secondary-volume phase (right after the heavy work).
    const idx = phases.findIndex((p) => p.phase === "secondary-volume");
    if (idx >= 0) phases[idx].movements = [...coreMovements, ...phases[idx].movements];
    else if (phases[0]) phases[0].movements = [...phases[0].movements, ...coreMovements];
  }

  // Reindex order across the whole session so the queue reads top-to-bottom.
  let order = 1;
  for (const p of phases) for (const m of p.movements) m.order = order++;

  return { ...template, phases, corePlacement: placement };
}

/* ════════════════════════════════════════════════════════════════════════
   SESSION INTENSITY METRICS — exposed on every session card / cockpit.
   Difficulty, intensity 1–10, recovery demand, volume / density tiers, muscle
   load, advanced methods, and nutrition-alignment flags so a high-output leg
   day never gets a low-fuel plan. Pure read — no medical claims, no dosing.
   ════════════════════════════════════════════════════════════════════════ */

export type VolumeTier = "Light" | "Moderate" | "High" | "Very High";
export type DensityTier = "Controlled" | "Moderate" | "High";
export type RecoveryDemandLevel = "Low" | "Moderate" | "High" | "Very High";
export type SessionFuelDemand = "low" | "moderate" | "high";

function volumeTierFor(workingSets: number): VolumeTier {
  if (workingSets < 16) return "Light";
  if (workingSets < 24) return "Moderate";
  if (workingSets < 32) return "High";
  return "Very High";
}
function densityTierFor(supersetCount: number): DensityTier {
  if (supersetCount <= 0) return "Controlled";
  if (supersetCount <= 2) return "Moderate";
  return "High";
}

const TIER_BASE_INTENSITY: Record<IntensityTier, number> = {
  "log-only": 3, foundation: 4, lifestyle: 4, standard: 5, hypertrophy: 6, advanced: 8, specialization: 8, championship: 9,
};

/** Difficulty labels avoid public product words (no "basic / starter"). */
export type SessionDifficultyLabel = "Foundation" | "Standard" | "Strong" | "Advanced" | "High Output" | "Full Gym Challenge";

function difficultyLabelFor(intensity: number, experience: TrainingExperience): SessionDifficultyLabel {
  if (experience === "full-gym-advanced" && intensity >= 8) return "Full Gym Challenge";
  if (experience === "athlete" && intensity >= 8) return "High Output";
  if (intensity <= 4) return "Foundation";
  if (intensity === 5) return "Standard";
  if (intensity === 6) return "Strong";
  if (intensity <= 8) return "Advanced";
  if (intensity === 9) return "High Output";
  return "Full Gym Challenge";
}

export type SessionMetrics = {
  intensityLevel: number;
  experienceTarget: TrainingExperience;
  experienceLabel: string;
  sessionDifficultyLabel: SessionDifficultyLabel;
  recoveryDemand: RecoveryDemandLevel;
  estimatedDuration: number;
  volumeTier: VolumeTier;
  densityTier: DensityTier;
  supersetCount: number;
  totalWorkingSets: number;
  movementCount: number;
  primaryMuscleLoad: string[];
  secondaryMuscleLoad: string[];
  advancedMethods: string[];
  /* Nutrition-alignment flags (read by Nutrition Command / Apex later). */
  sessionFuelDemand: SessionFuelDemand;
  lowerBodyDay: boolean;
  conditioningDay: boolean;
  recoveryDay: boolean;
  highOutputDay: boolean;
};

const LOWER_MUSCLES = /glute|quad|hamstring|calf|calves|adductor|abductor/i;

/**
 * Compute the intensity metrics for a resolved session template.
 * `experience` defaults to the template's own experienceTarget when scaled.
 */
export function computeSessionMetrics(
  template: WorkoutTemplate,
  experience?: TrainingExperience,
): SessionMetrics {
  const exp = experience ?? template.experienceTarget ?? "advanced";
  const tier = template.intensityTier ?? "standard";
  const workingSets = countWorkingSets(template);
  const movements = allTemplateMovements(template);
  const supersetCount = template.supersetCount ?? Math.floor(movements.filter((m) => m.superset).length / 2);

  // Intensity 1–10: tier base, nudged by working-set volume and experience.
  let intensity = TIER_BASE_INTENSITY[tier];
  if (workingSets >= 30) intensity += 1;
  else if (workingSets <= 16) intensity -= 1;
  if (exp === "full-gym-advanced" || exp === "athlete") intensity += 1;
  if (exp === "beginner") intensity = Math.min(intensity, 5);
  if (exp === "intermediate") intensity = Math.min(intensity, 7);
  intensity = Math.max(1, Math.min(10, Math.round(intensity)));

  const advancedTier = INTENSITY_TIER_META[tier]?.advanced ?? false;
  const recoveryDemand: RecoveryDemandLevel =
    exp === "beginner" ? "Low"
      : workingSets >= 32 || (advancedTier && (exp === "full-gym-advanced" || exp === "athlete")) ? "Very High"
        : workingSets >= 24 || advancedTier ? "High"
          : "Moderate";

  // Muscle load tally by working sets.
  const loadMap = new Map<string, number>();
  for (const m of movements) {
    if (m.role === "primer" || m.role === "recovery") continue;
    loadMap.set(m.targetMuscle, (loadMap.get(m.targetMuscle) ?? 0) + m.sets);
  }
  const ranked = [...loadMap.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const primaryMuscleLoad = ranked.slice(0, 2);
  const secondaryMuscleLoad = ranked.slice(2, 4);

  // Advanced methods present in the session.
  const advancedMethods: string[] = [];
  if (supersetCount > 0) advancedMethods.push(`${supersetCount} accessory superset${supersetCount > 1 ? "s" : ""}`);
  const finisher = movements.find((m) => m.role === "finisher");
  if (finisher && (exp === "advanced" || exp === "full-gym-advanced" || exp === "athlete")) advancedMethods.push(`pump finisher · ${finisher.name.toLowerCase()}`);
  if (movements.some((m) => /mechanical|drop|cluster|21s|burnout|ladder/i.test(m.name))) advancedMethods.push("mechanical-intensity options");
  if (exp === "athlete" && movements.some((m) => m.targetMuscle.toLowerCase() === "conditioning")) advancedMethods.push("performance conditioning finisher");

  const lowerBodyDay = template.targetMuscles.some((t) => LOWER_MUSCLES.test(t)) || movements.some((m) => LOWER_MUSCLES.test(m.targetMuscle));
  const conditioningDay = movements.some((m) => m.targetMuscle.toLowerCase() === "conditioning");
  const highOutputDay = intensity >= 8 || advancedTier;
  const sessionFuelDemand: SessionFuelDemand =
    intensity >= 8 || (lowerBodyDay && intensity >= 6) ? "high"
      : intensity >= 5 ? "moderate"
        : "low";

  return {
    intensityLevel: intensity,
    experienceTarget: exp,
    experienceLabel: EXPERIENCE_LABEL[exp],
    sessionDifficultyLabel: difficultyLabelFor(intensity, exp),
    recoveryDemand,
    estimatedDuration: template.estimatedDurationMin,
    volumeTier: template.volumeTier ?? volumeTierFor(workingSets),
    densityTier: template.densityTier ?? densityTierFor(supersetCount),
    supersetCount,
    totalWorkingSets: workingSets,
    movementCount: movements.filter((m) => m.role !== "recovery").length,
    primaryMuscleLoad,
    secondaryMuscleLoad,
    advancedMethods,
    sessionFuelDemand,
    lowerBodyDay,
    conditioningDay,
    recoveryDay: false,
    highOutputDay,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   MOVEMENT PREFERENCE + FATIGUE FEEDBACK HOOKS

   The member can teach Reserve which movements to avoid, which are hard to
   access, preferred substitutes, and favorites — and log per-movement fatigue
   feedback. These drive substitution and (later) real-time intelligence.
   Substitution hooks are deterministic; fatigue feedback is observational only
   (no medical claims, no diagnosis, no dosing).
   ════════════════════════════════════════════════════════════════════════ */

export type MovementPreferences = {
  /** Never recommend these movements. */
  avoid: string[];
  /** Hard to access at the member's gym (deprioritized, swapped when possible). */
  hardToAccess: string[];
  /** Explicit member-chosen substitutes: original → preferred replacement. */
  preferredSubstitutes: Record<string, string>;
  /** Favorite movements (kept and flagged). */
  favorites: string[];
};

export const EMPTY_MOVEMENT_PREFERENCES: MovementPreferences = {
  avoid: [], hardToAccess: [], preferredSubstitutes: {}, favorites: [],
};

function eqName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Resolve the best replacement for a blocked movement: explicit substitute
    first, then the first pool substitution that is not also blocked. */
function resolveSubstitute(m: TemplateMovement, prefs: MovementPreferences): { name: string; equipment: string } | null {
  const explicit = Object.entries(prefs.preferredSubstitutes).find(([from]) => eqName(from, m.name));
  if (explicit) return { name: explicit[1], equipment: m.equipment };
  const blocked = (n: string) => prefs.avoid.some((a) => eqName(a, n)) || prefs.hardToAccess.some((a) => eqName(a, n));
  const sub = m.substitutions.find((s) => !blocked(s));
  return sub ? { name: sub, equipment: m.equipment } : null;
}

/**
 * Apply the member's movement preferences to a resolved template.
 * Swaps avoided / hard-to-access movements (when a clean substitute exists),
 * flags favorites, and records the original name. No-op when prefs are empty.
 */
export function applyMovementPreferences(template: WorkoutTemplate, prefs: MovementPreferences | null | undefined): WorkoutTemplate {
  if (!prefs) return template;
  const hasPrefs = prefs.avoid.length || prefs.hardToAccess.length || Object.keys(prefs.preferredSubstitutes).length || prefs.favorites.length;
  if (!hasPrefs) return template;

  const blocked = (n: string) => prefs.avoid.some((a) => eqName(a, n)) || prefs.hardToAccess.some((a) => eqName(a, n));
  const favorite = (n: string) => prefs.favorites.some((f) => eqName(f, n));

  const phases = template.phases.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      if (blocked(m.name)) {
        const swap = resolveSubstitute(m, prefs);
        if (swap) {
          return {
            ...m,
            name: swap.name,
            equipment: swap.equipment,
            swappedFrom: m.name,
            preferred: favorite(swap.name) || undefined,
            substitutions: substitutionsFor(swap.name, m.targetMuscle),
          };
        }
      }
      return favorite(m.name) ? { ...m, preferred: true } : m;
    }),
  }));

  return { ...template, phases };
}

/** Per-movement fatigue feedback — observational hooks for later intelligence. */
export type MovementFeedbackKind =
  | "felt-great"
  | "equipment-unavailable"
  | "swap-next-time"
  | "do-not-suggest"
  | "muscle-fatigue-high"
  | "pump-strong"
  | "joint-stress"
  | "energy-dropped";

export const MOVEMENT_FEEDBACK_OPTIONS: { kind: MovementFeedbackKind; label: string }[] = [
  { kind: "felt-great", label: "Movement felt great" },
  { kind: "pump-strong", label: "Pump strong" },
  { kind: "muscle-fatigue-high", label: "Muscle fatigue high" },
  { kind: "energy-dropped", label: "Energy dropped" },
  { kind: "joint-stress", label: "Joint stress" },
  { kind: "equipment-unavailable", label: "Too crowded / unavailable" },
  { kind: "swap-next-time", label: "Swap next time" },
  { kind: "do-not-suggest", label: "Do not suggest again" },
];

export type MovementFeedback = {
  movement: string;
  kinds: MovementFeedbackKind[];
  at: string;
};
