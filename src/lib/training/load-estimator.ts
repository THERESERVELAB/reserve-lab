/* ════════════════════════════════════════════════════════════════════════
   STARTING-LOAD ESTIMATOR
   ------------------------------------------------------------------------
   Turns the member's OWN body data (bodyweight, height, sex) and training
   experience into a starting working-set load for a movement, so a session
   never opens with an empty number and "your call on set 1".

   This is a STARTING ESTIMATE, not a prescription and not the member's
   history. The moment a real top set is logged, logged history wins and the
   estimate is never shown again for that movement. Every surface that shows
   it labels it as an estimate and lets the member type their own number.

   Training instruction only — no medical claims, no dosing, no guarantees.

   ── How a number is built ───────────────────────────────────────────────
     1. Classify the movement into a LIFT PATTERN from its name / target.
     2. Pattern → total system load as a multiple of bodyweight, anchored on
        a clean 9-rep working set for an ADVANCED male trainee.
     3. Scale by training experience, then by sex (upper vs lower body).
     4. Scale by the movement's own rep target (Epley-inverse).
     5. Scale by height on leverage-sensitive lifts — longer levers move a
        longer range, so the same effort carries slightly less load.
     6. Convert to the equipment's own unit (bar total, per-hand dumbbell,
        stack pin) and round to a real gym increment.

   Pure + deterministic: same inputs, same number, every time.
   ════════════════════════════════════════════════════════════════════════ */

import type { EquipmentKind } from "./session-movement";
import type { TrainingExperience } from "./workout-templates";

/* ─── Patterns ───────────────────────────────────────────────────────────── */

export type LiftPattern =
  | "squat"
  | "hinge"
  | "leg-press"
  | "lunge"
  | "hip-thrust"
  | "leg-extension"
  | "leg-curl"
  | "calf"
  | "abduction"
  | "horizontal-press"
  | "incline-press"
  | "overhead-press"
  | "chest-fly"
  | "row"
  | "pulldown"
  | "pullover"
  | "rear-delt"
  | "shrug"
  | "lateral-raise"
  | "front-raise"
  | "biceps"
  | "triceps"
  | "forearm"
  | "core"
  | "carry"
  | "loadless";

type PatternSpec = {
  /** Total system load ÷ bodyweight for a clean 9-rep set, advanced male. */
  multiplier: number;
  /** Upper-body lifts take the upper-body sex factor; lower take the lower. */
  region: "upper" | "lower";
  /** Long-range lifts where limb length meaningfully changes the load moved. */
  leverageSensitive: boolean;
  /** Per-equipment conversion overrides. Raises and single-arm cable work are
      run ONE LIMB AT A TIME, so each side carries half the system with no
      bilateral deficit — the shared factors would read far too heavy. */
  equipmentOverride?: Partial<Record<EquipmentKind, number>>;
};

const PATTERNS: Record<LiftPattern, PatternSpec> = {
  squat: { multiplier: 1.25, region: "lower", leverageSensitive: true },
  hinge: { multiplier: 1.4, region: "lower", leverageSensitive: true },
  "leg-press": { multiplier: 2.0, region: "lower", leverageSensitive: true },
  lunge: { multiplier: 0.5, region: "lower", leverageSensitive: true },
  "hip-thrust": { multiplier: 1.4, region: "lower", leverageSensitive: false },
  "leg-extension": { multiplier: 0.55, region: "lower", leverageSensitive: false },
  "leg-curl": { multiplier: 0.42, region: "lower", leverageSensitive: false },
  calf: { multiplier: 1.0, region: "lower", leverageSensitive: false },
  abduction: { multiplier: 0.55, region: "lower", leverageSensitive: false },
  "horizontal-press": { multiplier: 0.95, region: "upper", leverageSensitive: true },
  "incline-press": { multiplier: 0.8, region: "upper", leverageSensitive: true },
  "overhead-press": { multiplier: 0.58, region: "upper", leverageSensitive: true },
  "chest-fly": { multiplier: 0.42, region: "upper", leverageSensitive: false },
  row: { multiplier: 0.9, region: "upper", leverageSensitive: false },
  pulldown: { multiplier: 0.8, region: "upper", leverageSensitive: false },
  pullover: { multiplier: 0.4, region: "upper", leverageSensitive: false },
  "rear-delt": { multiplier: 0.22, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5, cable: 0.5 } },
  shrug: { multiplier: 1.1, region: "upper", leverageSensitive: false },
  "lateral-raise": { multiplier: 0.25, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5, cable: 0.5 } },
  "front-raise": { multiplier: 0.24, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5, cable: 0.5 } },
  biceps: { multiplier: 0.38, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5 } },
  triceps: { multiplier: 0.45, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5 } },
  forearm: { multiplier: 0.3, region: "upper", leverageSensitive: false, equipmentOverride: { dumbbell: 0.5 } },
  core: { multiplier: 0.25, region: "upper", leverageSensitive: false },
  carry: { multiplier: 0.75, region: "upper", leverageSensitive: false },
  loadless: { multiplier: 0, region: "upper", leverageSensitive: false },
};

/* Most specific first — the first rule that matches wins. Matched against
   "<name> · <target muscle> · <equipment>" lowercased. */
const PATTERN_RULES: ReadonlyArray<{ pattern: LiftPattern; test: RegExp }> = [
  // Loadless / assisted / timed first, so "assisted pull-up" never reads as a pulldown.
  { pattern: "loadless", test: /assisted|band[- ]|bodyweight|push-?up|plank|dead ?bug|bird ?dog|hollow|stretch flow|mobility|carry\b(?=.*bodyweight)/ },
  /* Ambulatory conditioning — but NOT when the movement is a loaded carry or a
     lunge. "Walking Lunge" contains "walk" and was being called loadless, so a
     dumbbell walking lunge showed no load to estimate at all. */
  { pattern: "loadless", test: /^(?!.*(lunge|carry|farmer|suitcase|step-?up)).*(sled push|treadmill|\bbike\b|rower|jump rope|stair|\bwalk|sprint|\brun\b|jog)/ },
  { pattern: "loadless", test: /^(?!.*weighted).*\b(pull-?up|chin-?up|dip|inverted row|nordic|glute bridge|hip extension|back extension|hyperextension|leg raise|knee raise|sit-?up|crunch|ab wheel|mountain climber|russian twist)\b/ },

  // Lower body.
  { pattern: "leg-press", test: /leg press|hack squat|pendulum squat|v-?squat|belt squat/ },
  { pattern: "hip-thrust", test: /hip thrust|glute bridge|glute drive/ },
  { pattern: "leg-extension", test: /leg extension|quad extension/ },
  { pattern: "leg-curl", test: /leg curl|hamstring curl|ham curl/ },
  { pattern: "calf", test: /calf|soleus|tibialis/ },
  { pattern: "abduction", test: /abduct|adduct|hip machine|cable kickback|glute kickback/ },
  { pattern: "lunge", test: /lunge|split squat|step-?up|bulgarian/ },
  { pattern: "hinge", test: /deadlift|romanian|rdl|good morning|hip hinge|back extension|hyperextension|pull-?through|kettlebell swing/ },
  { pattern: "squat", test: /squat|leg day compound/ },

  // Pulling.
  { pattern: "pulldown", test: /pulldown|lat pull|pull-?down/ },
  { pattern: "pullover", test: /pullover/ },
  { pattern: "shrug", test: /shrug|trap raise/ },
  { pattern: "rear-delt", test: /rear[- ]delt|reverse (fly|pec|peck)|face pull|rear fly/ },
  { pattern: "row", test: /\brow\b|pull-?up|chin-?up/ },

  // Pressing.
  { pattern: "overhead-press", test: /overhead press|shoulder press|military press|push press|arnold press|\bohp\b/ },
  { pattern: "incline-press", test: /incline.*(press)|(press).*incline/ },
  { pattern: "chest-fly", test: /\bfly\b|flye|pec deck|pec dec|cable crossover|chest fly/ },
  { pattern: "horizontal-press", test: /bench press|chest press|\bdip\b|floor press|decline press|\bpress\b(?!.*(leg|overhead|shoulder))/ },

  // Delts / arms.
  { pattern: "lateral-raise", test: /lateral raise|lat raise|side raise|upright row|\blateral\b/ },
  { pattern: "front-raise", test: /front raise|plate raise/ },
  { pattern: "triceps", test: /tricep|pushdown|push-?down|skull|overhead extension|kickback|close-?grip/ },
  { pattern: "biceps", test: /bicep|curl(?!.*leg)/ },
  { pattern: "forearm", test: /forearm|wrist|grip/ },

  // Trunk / loaded carries.
  { pattern: "carry", test: /carry|farmer|suitcase|yoke/ },
  { pattern: "core", test: /core|\bab\b|abs\b|oblique|pallof|woodchop|cable crunch|rotation/ },
];

/** Classify a movement into its lift pattern. Unrecognised → "core"-weight
    conservative isolation rather than a heavy guess. */
export function classifyPattern(input: {
  name: string;
  targetMuscle?: string;
  equipment?: string;
}): LiftPattern {
  const hay = `${input.name} · ${input.targetMuscle ?? ""} · ${input.equipment ?? ""}`.toLowerCase();
  for (const rule of PATTERN_RULES) {
    if (rule.test.test(hay)) return rule.pattern;
  }
  return "core";
}

/* ─── Scaling factors ────────────────────────────────────────────────────── */

/** Relative to an advanced trainee (1.00). Honest training levels, not tiers. */
const EXPERIENCE_FACTOR: Record<TrainingExperience, number> = {
  beginner: 0.55,
  intermediate: 0.78,
  advanced: 1.0,
  "full-gym-advanced": 1.05,
  athlete: 1.05,
};

/** Published strength-standard ratios, applied per body region. */
const SEX_FACTOR = {
  male: { upper: 1.0, lower: 1.0 },
  female: { upper: 0.62, lower: 0.75 },
  /* Unstated sex → the midpoint, never a silent assumption either way. */
  unstated: { upper: 0.81, lower: 0.88 },
} as const;

const REFERENCE_HEIGHT_IN = { male: 70, female: 65, unstated: 68 } as const;

/** Anchor rep count the pattern multipliers were tuned at. */
const ANCHOR_REPS = 9;

/** Epley-inverse: the same relative effort carries less load at higher reps. */
function repFactor(reps: number): number {
  const r = Math.max(1, Math.min(30, reps));
  return (1 + ANCHOR_REPS / 30) / (1 + r / 30);
}

/** Longer levers move a longer range — modest, capped, leverage-lifts only. */
function heightFactor(heightIn: number | null, reference: number): number {
  if (heightIn == null || heightIn < 48 || heightIn > 90) return 1;
  const raw = 1 - (heightIn - reference) * 0.006;
  return Math.min(1.07, Math.max(0.93, raw));
}

/** Per-equipment conversion from total system load to what the member loads. */
const EQUIPMENT_FACTOR: Record<EquipmentKind, number> = {
  barbell: 1.0,
  /* Counterbalanced guided bar — the member only loads plates. */
  smith: 0.92,
  machine: 1.0,
  cable: 0.85,
  /* Per hand: half the system, minus the bilateral deficit of two free weights. */
  dumbbell: 0.425,
};

/** An empty Olympic bar. A barbell estimate never lands below it. */
export const OLYMPIC_BAR_LB = 45;
/** EZ / curl / trap bars are far lighter — flooring them at 45 would overload. */
export const LIGHT_BAR_LB = 25;

/** The empty bar this movement is actually loaded on. */
export function emptyBarWeight(equipment: string | undefined, name: string): number {
  const hay = `${equipment ?? ""} ${name}`.toLowerCase();
  if (/ez-?bar|ez bar|curl bar|cambered|fixed bar|short bar/.test(hay)) return LIGHT_BAR_LB;
  return OLYMPIC_BAR_LB;
}

function roundToIncrement(load: number, kind: EquipmentKind): number {
  const increment = (kind === "machine" || kind === "cable") && load >= 100 ? 10 : 5;
  return Math.max(0, Math.round(load / increment) * increment);
}

/** Midpoint of a rep target like "8-10", "12", "15-20". Non-numeric → null. */
export function repsFromTargetRange(target: string | null | undefined): number | null {
  if (!target) return null;
  /* "6-10 min", "45 sec", "AMRAP" carry no rep count we can load against. */
  if (/min|sec|amrap|max|fail|each side|per side|\bmile|\bm\b/i.test(target)) {
    const bare = target.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!bare) return null;
  }
  const range = target.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = target.match(/(\d+)/);
  return single ? Number(single[1]) : null;
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export type LoadProfile = {
  /** The member's real bodyweight in lb, or null when never entered. */
  bodyweightLb: number | null;
  heightIn?: number | null;
  sex?: "male" | "female" | "other" | null;
  experience: TrainingExperience;
};

export type LoadEstimate = {
  /** What to load, in the movement's own unit. 0 = no external load. */
  load: number;
  pattern: LiftPattern;
  /** Short, honest basis line for the UI. Always says "estimate". */
  basis: string;
  /** True when the movement carries no external load to estimate. */
  loadless: boolean;
  /** True when the estimate floored at an empty bar. */
  barOnly: boolean;
};

type MovementInput = {
  name: string;
  targetMuscle?: string;
  equipment?: string;
  equipmentKind: EquipmentKind;
  /** The movement's rep target, e.g. "8-10". */
  reps?: string;
};

function heightLabel(heightIn: number | null | undefined): string | null {
  if (heightIn == null || heightIn < 48 || heightIn > 90) return null;
  return `${Math.floor(heightIn / 12)}'${Math.round(heightIn % 12)}"`;
}

/**
 * A starting working-set load for one movement, from the member's own body
 * data. Returns null when there is no bodyweight on file — the app then keeps
 * its honest "set your load" state rather than inventing a number.
 */
export function estimateStartingLoad(
  movement: MovementInput,
  profile: LoadProfile,
): LoadEstimate | null {
  const bw = profile.bodyweightLb;
  if (bw == null || bw <= 0) return null;

  const pattern = classifyPattern(movement);
  const spec = PATTERNS[pattern];
  const sexKey = profile.sex === "male" || profile.sex === "female" ? profile.sex : "unstated";

  const reps = repsFromTargetRange(movement.reps);
  const basisHeight = heightLabel(profile.heightIn);
  const basis = `Estimate from your ${Math.round(bw)} lb${basisHeight ? ` · ${basisHeight}` : ""} — adjust it to what you own`;

  /* Loadless work (bodyweight, assisted, timed, conditioning) has nothing to
     estimate. Say so honestly rather than printing a number. */
  if (spec.multiplier === 0 || reps == null) {
    return { load: 0, pattern, basis: "Bodyweight or timed — no load to estimate", loadless: true, barOnly: false };
  }

  const total =
    bw *
    spec.multiplier *
    EXPERIENCE_FACTOR[profile.experience] *
    SEX_FACTOR[sexKey][spec.region] *
    repFactor(reps) *
    (spec.leverageSensitive ? heightFactor(profile.heightIn ?? null, REFERENCE_HEIGHT_IN[sexKey]) : 1);

  const equipmentFactor = spec.equipmentOverride?.[movement.equipmentKind] ?? EQUIPMENT_FACTOR[movement.equipmentKind];
  const converted = total * equipmentFactor;

  /* A barbell can never be lighter than the bar it is loaded on. */
  if (movement.equipmentKind === "barbell") {
    const bar = emptyBarWeight(movement.equipment, movement.name);
    if (converted < bar) {
      return { load: bar, pattern, basis: "Start with the empty bar and own the pattern", loadless: false, barOnly: true };
    }
  }

  const load = roundToIncrement(converted, movement.equipmentKind);
  if (load <= 0) {
    return { load: 0, pattern, basis: "Bodyweight or timed — no load to estimate", loadless: true, barOnly: false };
  }
  return { load, pattern, basis, loadless: false, barOnly: false };
}

/* ─── Applying estimates to a session queue ──────────────────────────────── */

type LoadableMovement = {
  name: string;
  target?: string;
  equipmentName?: string;
  equipmentKind: EquipmentKind;
  reps: string;
  suggestedLoad: number;
  /** The member's own last top set. Real history always outranks an estimate. */
  lastLoad?: number;
  loadBasis?: string;
  loadIsEstimate?: boolean;
};

/**
 * Give every movement in a session queue a starting load from the member's own
 * body data. A movement the member has already logged keeps its real history
 * untouched — an estimate never overwrites, or competes with, a number the
 * member actually lifted. Returns a new array; inputs are not mutated.
 */
export function withStartingLoads<T extends LoadableMovement>(
  movements: readonly T[],
  profile: LoadProfile,
): T[] {
  return movements.map((m) => {
    /* Logged history wins outright — nothing to estimate. */
    if (m.lastLoad != null && m.lastLoad > 0) {
      return { ...m, loadIsEstimate: false, loadBasis: undefined };
    }
    const estimate = estimateStartingLoad(
      {
        name: m.name,
        targetMuscle: m.target,
        equipment: m.equipmentName,
        equipmentKind: m.equipmentKind,
        reps: m.reps,
      },
      profile,
    );
    /* No bodyweight on file → keep the honest "set your load" state. */
    if (!estimate || estimate.loadless) {
      return { ...m, suggestedLoad: 0, loadIsEstimate: false, loadBasis: estimate?.loadless ? estimate.basis : undefined };
    }
    return { ...m, suggestedLoad: estimate.load, loadIsEstimate: true, loadBasis: estimate.basis };
  });
}
