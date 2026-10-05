/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL ↔ NUTRITION ALIGNMENT ENGINE

   The protocol chooses the training direction; the macros must obey the
   mission. This engine resolves a member + goal + protocol + training
   intensity + activity stack + phase into a nutrition phase, macro bias, and
   day-type strategy — and BLOCKS contradictions (no bulk plan in a summer-lean
   protocol; no aggressive deficit when glute growth is the driver unless the
   member explicitly chose fat-loss priority).

   Pure + deterministic. Food / macro organization only. No medical claims, no
   guaranteed outcomes, no compound / dosing guidance. Safe language throughout:
   "designed to support", "goal direction", "nutrition bias", "progress markers
   to monitor", "with consistent execution".
   ════════════════════════════════════════════════════════════════════════ */

import { computeMacroTargets, type BodyProfile, type TrainingLoad } from "./macro-engine";
import type { DietStyleKey, GoalKey, MacroTargets } from "./types";
import { protocolProduct, type NutritionIntent } from "@/lib/protocol/library";
import { WOMENS_TRACKS } from "@/lib/protocol/architecture";
import type { WomensTrack } from "@/lib/physique/types";
import type { ActivityStack } from "@/lib/training/activity-stack";
import type { TrainingExperience, TrainingPhase } from "@/lib/training/workout-templates";

/* ─── Nutrition phase model (TASK 1) ──────────────────────────────────────── */
export type NutritionPhase =
  | "cut"
  | "controlled-cut"
  | "recomp"
  | "lean-gain"
  | "performance-maintenance"
  | "high-output-hybrid"
  | "recovery-support";

export type CalorieDirection = "deficit" | "modest-deficit" | "near-maintenance" | "modest-surplus" | "maintenance";

export type NutritionPhaseSpec = {
  key: NutritionPhase;
  label: string;
  /** Calorie direction (safe, non-guaranteed). */
  calorieDirection: CalorieDirection;
  calorieBias: string;
  proteinBias: string;
  carbBias: string;
  fatBias: string;
  trainingDayStrategy: string;
  restDayStrategy: string;
  lowerBodyDayStrategy: string;
  conditioningDayStrategy: string;
  recoveryDayStrategy: string;
  /** GoalKey used to bridge into the existing macro engine. */
  macroGoal: GoalKey;
  /** Safe outcome language for protocol cards / Apex (TASK 5). */
  outcomeLanguage: string;
  /** When this phase is the WRONG match — used to phrase conflict warnings. */
  contradictsWhen: string;
};

export const NUTRITION_PHASES: Record<NutritionPhase, NutritionPhaseSpec> = {
  cut: {
    key: "cut",
    label: "Cut / Lean Phase",
    calorieDirection: "deficit",
    calorieBias: "A clear deficit, member-selected — protein held high to protect lean-mass signals.",
    proteinBias: "Protein anchored at every meal.",
    carbBias: "Carbs concentrated around training; lower on rest days.",
    fatBias: "Fat kept to a steady floor for hormones and satiety — not dropped to zero.",
    trainingDayStrategy: "Carbs placed around the session to protect output.",
    restDayStrategy: "Calories pulled back; protein and vegetables stay high.",
    lowerBodyDayStrategy: "Protect carbs around lower-body work even in a deficit — never a low-fuel leg day.",
    conditioningDayStrategy: "Add a small carb buffer around conditioning to protect output.",
    recoveryDayStrategy: "Hold protein, ease calories slightly, prioritize sleep and hydration.",
    macroGoal: "cut",
    outcomeLanguage: "Nutrition alignment: cut bias designed to support body-fat reduction while protecting lean-mass signals when training, recovery, and adherence are consistent.",
    contradictsWhen: "lean-mass or lower-body growth is the primary driver",
  },
  "controlled-cut": {
    key: "controlled-cut",
    label: "Controlled Cut",
    calorieDirection: "modest-deficit",
    calorieBias: "A modest deficit — leaner visual direction without crashing training output.",
    proteinBias: "Protein anchored across the day.",
    carbBias: "Carbs protected around training; trimmed modestly on rest days.",
    fatBias: "Fat held at a steady floor — not dropped too low on high-output leg days.",
    trainingDayStrategy: "Carbs protected around the session; protein anchored.",
    restDayStrategy: "Intake kept tighter; protein and produce stay high.",
    lowerBodyDayStrategy: "Avoid dropping carbs too low on high-output leg days — protect lower-body fuel.",
    conditioningDayStrategy: "Keep carbs steady around conditioning; hydration and sodium consistent.",
    recoveryDayStrategy: "Recovery-support bias: protein anchored, calories eased, hydration up.",
    macroGoal: "cut",
    outcomeLanguage: "Nutrition alignment: controlled cut or recomp bias designed to support a leaner visual direction while keeping training output protected.",
    contradictsWhen: "lower-body growth is the primary driver without a fat-loss priority selected",
  },
  recomp: {
    key: "recomp",
    label: "Recomp",
    calorieDirection: "near-maintenance",
    calorieBias: "Near maintenance — small deficit or surplus based on your trend data.",
    proteinBias: "Protein anchored across the day.",
    carbBias: "Carbs concentrated around training; steady otherwise.",
    fatBias: "Fat held at a balanced floor.",
    trainingDayStrategy: "Carbs around the session; protein anchored; trend read weekly.",
    restDayStrategy: "Slightly lower carbs; protein and produce steady.",
    lowerBodyDayStrategy: "Carbs protected around lower-body work to support output and recovery.",
    conditioningDayStrategy: "Carbs matched to conditioning volume.",
    recoveryDayStrategy: "Recovery meals after the hardest days; calories near maintenance.",
    macroGoal: "recomp",
    outcomeLanguage: "Nutrition alignment: recomp bias designed to support a gradual composition trend — protecting lean-mass signals while body-fat trends are monitored, with consistent execution.",
    contradictsWhen: "an aggressive surplus or aggressive deficit is required",
  },
  "lean-gain": {
    key: "lean-gain",
    label: "Lean Gain",
    calorieDirection: "modest-surplus",
    calorieBias: "A modest surplus — enough to support growth while controlling unnecessary fat gain.",
    proteinBias: "Protein anchored across the day.",
    carbBias: "Carbs increased around priority sessions.",
    fatBias: "Fat at a steady floor; the surplus comes mostly from carbs around training.",
    trainingDayStrategy: "Carbs increased around priority sessions to support output and recovery.",
    restDayStrategy: "Surplus trimmed on rest days; protein anchored.",
    lowerBodyDayStrategy: "Carbs protected and increased around lower-body days to support development.",
    conditioningDayStrategy: "Add carbs to cover conditioning without erasing the surplus.",
    recoveryDayStrategy: "Recovery meals after the heaviest days; sleep and hydration prioritized.",
    macroGoal: "lean-bulk",
    outcomeLanguage: "Nutrition alignment: lean gain or recomp bias designed to support lower-body performance, recovery, and progressive training.",
    contradictsWhen: "a waistline-control or summer-lean direction is active",
  },
  "performance-maintenance": {
    key: "performance-maintenance",
    label: "Performance Maintenance",
    calorieDirection: "maintenance",
    calorieBias: "Around maintenance — fuel that supports recovery and training output.",
    proteinBias: "Protein anchored across the day.",
    carbBias: "Carbs matched to training and conditioning load.",
    fatBias: "Fat at a balanced floor.",
    trainingDayStrategy: "Carbs matched to the day's output.",
    restDayStrategy: "Steady, simple meals; protein anchored.",
    lowerBodyDayStrategy: "Carbs protected around lower-body work.",
    conditioningDayStrategy: "Carbs matched to conditioning volume; hydration and electrolytes consistent.",
    recoveryDayStrategy: "Recovery-support bias; calories steady, sleep prioritized.",
    macroGoal: "maintenance",
    outcomeLanguage: "Nutrition alignment: performance maintenance bias designed to support recovery and training output across the week.",
    contradictsWhen: "a clear fat-loss or growth direction is the goal",
  },
  "high-output-hybrid": {
    key: "high-output-hybrid",
    label: "High-Output Hybrid Support",
    calorieDirection: "maintenance",
    calorieBias: "Around or slightly above maintenance to cover combined training and activity load.",
    proteinBias: "Protein anchored across the day.",
    carbBias: "Carbs protected around training and conditioning days.",
    fatBias: "Fat at a balanced floor; carbs carry the extra output.",
    trainingDayStrategy: "Carbs protected around the session; hydration and electrolytes consistent.",
    restDayStrategy: "Carbs eased on true rest days; protein anchored.",
    lowerBodyDayStrategy: "Carbs protected around lower-body work plus any extra activity load.",
    conditioningDayStrategy: "Carbs matched to conditioning and sport load; hydration up.",
    recoveryDayStrategy: "Recovery-support bias on low days; sleep and hydration prioritized.",
    macroGoal: "performance",
    outcomeLanguage: "Nutrition alignment: performance recomp / high-output bias designed to support conditioning, training output, and recovery across a hybrid week.",
    contradictsWhen: "a tight deficit is selected against a high combined activity load",
  },
  "recovery-support": {
    key: "recovery-support",
    label: "Recovery Support",
    calorieDirection: "near-maintenance",
    calorieBias: "Near maintenance — recovery takes priority over any deficit while signals are low.",
    proteinBias: "Protein anchored to support recovery.",
    carbBias: "Carbs kept present to support recovery and sleep.",
    fatBias: "Fat at a steady floor.",
    trainingDayStrategy: "Lighter sessions; carbs and protein support the work that is done.",
    restDayStrategy: "Calories near maintenance; sleep and hydration lead.",
    lowerBodyDayStrategy: "Carbs protected; volume eased until recovery signals improve.",
    conditioningDayStrategy: "Gentle conditioning; hydration prioritized.",
    recoveryDayStrategy: "Recovery is the priority — protein anchored, calories near maintenance.",
    macroGoal: "maintenance",
    outcomeLanguage: "Nutrition alignment: recovery-support bias designed to support recovery, sleep, and training output while readiness signals are low.",
    contradictsWhen: "an aggressive deficit is pushed against poor recovery",
  },
};

export const NUTRITION_PHASE_LABEL: Record<NutritionPhase, string> = Object.fromEntries(
  (Object.keys(NUTRITION_PHASES) as NutritionPhase[]).map((k) => [k, NUTRITION_PHASES[k].label]),
) as Record<NutritionPhase, string>;

/* ─── Mapping helpers ─────────────────────────────────────────────────────── */

/** Map the existing protocol NutritionIntent → a default nutrition phase.
    A "cut" intent defaults to controlled-cut; aggressive cut only with an
    explicit fat-loss priority (handled by the resolver). */
export function phaseFromIntent(intent: NutritionIntent, fatLossPriority = false): NutritionPhase {
  switch (intent) {
    case "cut": return fatLossPriority ? "cut" : "controlled-cut";
    case "lean-gain": return "lean-gain";
    case "recomp": return "recomp";
    case "performance-maintenance": return "performance-maintenance";
    case "high-output-hybrid": return "high-output-hybrid";
    default: return "recomp";
  }
}

/** Personal Command goal text → nutrition phase (TASK 9). Never forces a phase
    the member explicitly overrode; the resolver flags contradictions instead. */
export function goalToNutritionPhase(goal: string | null | undefined): NutritionPhase | null {
  const g = (goal ?? "").toLowerCase();
  if (!g) return null;
  if (/sport.*strength|strength.*sport|hybrid/.test(g)) return "high-output-hybrid";
  if (/condition/.test(g)) return "performance-maintenance";
  if (/athletic|performance|model/.test(g)) return "high-output-hybrid";
  if (/grow glute|glute growth|build lower|lower body shape|grow|build.*glute/.test(g)) return "lean-gain";
  if (/quad|hamstring|sculpt.*leg|leg/.test(g)) return "recomp";
  if (/runway|recomp/.test(g)) return "recomp";
  if (/vacation|summer|lean|cut|shred|waist|tight/.test(g)) return "controlled-cut";
  if (/maintain|maintenance/.test(g)) return "performance-maintenance";
  return null;
}

/** Explicit, deliberate fat-loss priority — this is what UNLOCKS an aggressive
    deficit. Narrow on purpose: a lean-leaning goal (summer / vacation) is a
    lean DIRECTION, not a mandate for an aggressive cut. */
export function isFatLossPriority(goal: string | null | undefined): boolean {
  const g = (goal ?? "").toLowerCase();
  return /fat loss|fat-loss|lose fat|aggressive cut|shred|get lean|cut priority/.test(g);
}

/** Lean visual DIRECTION (summer / vacation / waistline / lean) — defaults to a
    controlled cut and blocks bulk-style macros, without forcing a deep deficit. */
export function isLeanDirection(goal: string | null | undefined): boolean {
  const g = (goal ?? "").toLowerCase();
  return isFatLossPriority(g) || /summer|vacation|waistline|waist control|lean|tight|cut|shred/.test(g);
}

/** Detect a lower-body growth driver from the focus selection / goal. */
export function isLowerBodyGrowthDriver(
  primaryFocus: string | null | undefined,
  womensTrack: WomensTrack | null | undefined,
  goal: string | null | undefined,
): boolean {
  const p = (primaryFocus ?? "").toLowerCase();
  const g = (goal ?? "").toLowerCase();
  if (p === "glutes" || p === "quads" || p === "hamstrings") return true;
  if (womensTrack === "glute-quad" || womensTrack === "glute-upper") return true;
  if (/grow glute|glute growth|build lower|lower body|glute/.test(g)) return true;
  return false;
}

/* ─── resolveProtocolNutritionBias (TASK 2) ───────────────────────────────── */
export type MacroConfidence = "high" | "moderate" | "limited";

export type NutritionConflict = {
  severity: "info" | "warning";
  message: string;
};

export type ProtocolNutritionResolution = {
  nutritionPhase: NutritionPhase;
  phaseLabel: string;
  /** The phase the protocol would default to, before any member override. */
  defaultPhase: NutritionPhase;
  calorieBias: string;
  proteinBias: string;
  carbBias: string;
  fatBias: string;
  trainingDayStrategy: string;
  restDayStrategy: string;
  lowerBodyDayStrategy: string;
  conditioningDayStrategy: string;
  recoveryDayStrategy: string;
  conflictWarnings: NutritionConflict[];
  outcomeLanguage: string;
  macroConfidence: MacroConfidence;
  /** Source the default phase was derived from (for honest UI). */
  source: string;
  /** Resolved signal flags — read by guardrails + meal-plan hooks. */
  flags: {
    fatLossPriority: boolean;
    leanDirection: boolean;
    lowerGrowth: boolean;
    highOutputActivity: boolean;
    recoveryLimited: boolean;
  };
};

export type ResolveProtocolNutritionBiasInput = {
  protocolId?: string | null;
  protocolCategory?: string | null;
  goal?: string | null;
  primaryFocus?: string | null;
  secondaryFocus?: string[] | null;
  womensTrack?: WomensTrack | null;
  activityStack?: ActivityStack | null;
  trainingExperience?: TrainingExperience | null;
  /** Today's session intensity 1–10, if known. */
  sessionIntensity?: number | null;
  /** Member explicitly chose a fat-loss / waistline priority. */
  fatLossPriority?: boolean;
  /** Recovery signals are low — bias toward recovery support. */
  recoveryLimited?: boolean;
  /** Member explicitly selected a phase (overrides the default; conflicts flagged). */
  currentPhaseOverride?: NutritionPhase | null;
  /** Whether confirmed body data exists (drives macroConfidence). */
  hasBodyData?: boolean;
};

function activityIsHighOutput(stack: ActivityStack | null | undefined): boolean {
  return stack === "gym-sports" || stack === "gym-pilates-sports" || stack === "full-hybrid";
}

export function resolveProtocolNutritionBias(input: ResolveProtocolNutritionBiasInput): ProtocolNutritionResolution {
  const fatLoss = input.fatLossPriority ?? isFatLossPriority(input.goal);
  const leanDirection = fatLoss || isLeanDirection(input.goal);
  const lowerGrowth = isLowerBodyGrowthDriver(input.primaryFocus, input.womensTrack, input.goal);
  const highOutputActivity = activityIsHighOutput(input.activityStack);

  /* 1) Derive the protocol's DEFAULT nutrition phase, in priority order:
        women's track intent → protocol product intent → goal mapping → recomp. */
  let defaultPhase: NutritionPhase;
  let source: string;
  const trackIntent = input.womensTrack ? WOMENS_TRACKS[input.womensTrack]?.nutritionIntent : null;
  const product = input.protocolId ? protocolProduct(input.protocolId) : null;
  if (trackIntent) {
    defaultPhase = phaseFromIntent(trackIntent, fatLoss);
    source = "women's physique track";
  } else if (product) {
    defaultPhase = phaseFromIntent(product.nutritionBias.intent, fatLoss);
    source = "active protocol";
  } else {
    defaultPhase = goalToNutritionPhase(input.goal) ?? "recomp";
    source = input.goal ? "your goal" : "default";
  }

  /* 2) Guardrails on the DEFAULT (engine bias, before member override). */
  // Lower-body growth driver must never default to an aggressive deficit.
  if (lowerGrowth && defaultPhase === "cut" && !fatLoss) defaultPhase = "recomp";
  // High combined activity load shifts a plain maintenance default to hybrid.
  if (activityIsHighOutput(input.activityStack) && defaultPhase === "performance-maintenance") {
    defaultPhase = "high-output-hybrid";
  }
  // Poor recovery overrides toward recovery-support (engine bias only).
  if (input.recoveryLimited && (defaultPhase === "cut" || defaultPhase === "controlled-cut")) {
    defaultPhase = "recovery-support";
  }

  /* 3) Member override normally wins. A lean-direction goal is the hard
        exception: bulk-style calories cannot become the effective phase. */
  const requestedPhase = input.currentPhaseOverride ?? defaultPhase;
  const nutritionPhase: NutritionPhase = leanDirection && requestedPhase === "lean-gain"
    ? "controlled-cut"
    : requestedPhase;
  const spec = NUTRITION_PHASES[nutritionPhase];

  /* 4) Contradiction warnings (TASK 4) — safe wording, no medical claims. */
  const conflictWarnings: NutritionConflict[] = [];
  const isBulkish = requestedPhase === "lean-gain";
  const isDeficit = nutritionPhase === "cut" || nutritionPhase === "controlled-cut";

  if (leanDirection && isBulkish) {
    conflictWarnings.push({
      severity: "warning",
      message: "Summer-lean / waistline direction selected. Bulk-style calories are blocked for this phase.",
    });
  }
  if (lowerGrowth && nutritionPhase === "cut" && !fatLoss) {
    conflictWarnings.push({
      severity: "warning",
      message: "Glute-priority training may need more lower-body day fuel than an aggressive cut allows. Select fat-loss priority to confirm a deeper deficit.",
    });
  }
  if (highOutputActivity && isDeficit) {
    conflictWarnings.push({
      severity: "info",
      message: "High-output activity stack detected. Carbs should be protected around training days.",
    });
  }
  if (input.recoveryLimited && isDeficit) {
    conflictWarnings.push({
      severity: "info",
      message: "Recovery signals are low — recovery-support nutrition is suggested over an aggressive deficit.",
    });
  }
  if (input.currentPhaseOverride && input.currentPhaseOverride !== defaultPhase) {
    conflictWarnings.push({
      severity: "info",
      message: `Your selected nutrition phase differs from this protocol's ${NUTRITION_PHASE_LABEL[defaultPhase].toLowerCase()} bias.`,
    });
  }

  const macroConfidence: MacroConfidence = input.hasBodyData
    ? "high"
    : input.goal || input.protocolId || input.womensTrack
      ? "moderate"
      : "limited";

  return {
    nutritionPhase,
    phaseLabel: spec.label,
    defaultPhase,
    calorieBias: spec.calorieBias,
    proteinBias: spec.proteinBias,
    carbBias: spec.carbBias,
    fatBias: spec.fatBias,
    trainingDayStrategy: spec.trainingDayStrategy,
    restDayStrategy: spec.restDayStrategy,
    lowerBodyDayStrategy: spec.lowerBodyDayStrategy,
    conditioningDayStrategy: spec.conditioningDayStrategy,
    recoveryDayStrategy: spec.recoveryDayStrategy,
    conflictWarnings,
    outcomeLanguage: spec.outcomeLanguage,
    macroConfidence,
    source,
    flags: { fatLossPriority: fatLoss, leanDirection, lowerGrowth, highOutputActivity, recoveryLimited: Boolean(input.recoveryLimited) },
  };
}

/* ─── 12–24 week nutrition phase progression ──────────────────────────────────
   The training block already maps the protocol week → a TrainingPhase. Nutrition
   should not stay identical for 24 weeks, so each phase carries a SUBTLE, carb-led
   modifier on top of the goal/phase macros. Protein is never touched (it stays
   bodyweight-based and protected); rest days stay controlled (no phase carb bump);
   peak/reset eases training carbs without starving. Deltas are kept to ±8% so the
   day-to-day target never bounces. trainingCarbPct nudges every training day;
   lowerBodyExtraPct adds priority-muscle carb timing on lower-body days. */
type PhaseNutritionMod = { trainingCarbPct: number; lowerBodyExtraPct: number; note: string };
const PHASE_NUTRITION_MOD: Record<TrainingPhase, PhaseNutritionMod> = {
  foundation:      { trainingCarbPct:  0.00, lowerBodyExtraPct: 0.00, note: "Foundation — stable baseline macros, clean execution, build adherence." },
  progression:     { trainingCarbPct:  0.04, lowerBodyExtraPct: 0.00, note: "Progression — slight training-day carb support for progressive overload." },
  specialization:  { trainingCarbPct:  0.05, lowerBodyExtraPct: 0.05, note: "Specialization — stronger carb timing on priority lower-body days." },
  intensification: { trainingCarbPct:  0.08, lowerBodyExtraPct: 0.02, note: "Intensification — higher output support on hard days; recovery protected." },
  refinement:      { trainingCarbPct: -0.03, lowerBodyExtraPct: 0.00, note: "Refinement — eased slightly toward composition without crashing output." },
  peak:            { trainingCarbPct: -0.06, lowerBodyExtraPct: 0.00, note: "Peak / reset — fatigue-managed carb pull-back; protein protected, never starved." },
};

/* ─── Macro target resolver (TASK 3) ──────────────────────────────────────── */
export type DayKind = "training" | "rest" | "lower-body" | "high-output" | "conditioning" | "recovery";

export type ResolvedMacroTargets = {
  phase: NutritionPhase;
  phaseLabel: string;
  caloriesTarget: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatsGrams: number | null;
  trainingDayMacros: MacroTargets | null;
  restDayMacros: MacroTargets | null;
  highOutputDayMacros: MacroTargets | null;
  lowerBodyDayMacros: MacroTargets | null;
  conditioningDayMacros: MacroTargets | null;
  macroRationale: string;
  safetyCopy: string;
  missingDataFlags: string[];
  /** True when there is not enough data to finalize numbers. */
  incomplete: boolean;
  /** Long-protocol training phase the macros were tuned for (null = no active week). */
  trainingPhase: TrainingPhase | null;
  /** One-line phase progression note (how this block differs from the others). */
  phaseProgressionNote: string;
  /** "tdee" when sex/height/age personalized the calories, else "bodyweight". */
  calorieBasis: "tdee" | "bodyweight";
};

const SAFETY_COPY =
  "Estimated macro structure for organization only — not medical advice, not a guaranteed outcome. Designed to support the selected protocol with consistent execution.";

/** Bump carbohydrate (and total calories) by a percentage for higher-fuel days,
    keeping protein and fat fixed. Deterministic, estimate-only. */
function bumpCarbs(base: MacroTargets, pct: number): MacroTargets {
  const carbsG = Math.round(base.carbsG * (1 + pct));
  const addedCals = (carbsG - base.carbsG) * 4;
  return { ...base, carbsG, calories: base.calories + addedCals };
}

export type ResolveMacroTargetsInput = {
  phase: NutritionPhase;
  bodyweightLb: number | null;
  dietStyle: DietStyleKey;
  /** True when confirmed body data exists (baseline weight logged). */
  hasConfirmedBodyData?: boolean;
  /** Optional sex/height/age → clamped TDEE personalization of calories. */
  bodyProfile?: BodyProfile | null;
  /** Long-protocol training phase (from the active protocol's week) → subtle,
      carb-led phase progression. null/undefined → foundation (no change). */
  trainingPhase?: TrainingPhase | null;
  /** The active training architecture's load → nutrition follows training
      (hypertrophy/conditioning raise carbs; strength biases protein). */
  trainingLoad?: TrainingLoad | null;
};

export function resolveMacroTargets(input: ResolveMacroTargetsInput): ResolvedMacroTargets {
  const spec = NUTRITION_PHASES[input.phase];
  const mod = PHASE_NUTRITION_MOD[input.trainingPhase ?? "foundation"];
  const missingDataFlags: string[] = [];
  if (!input.bodyweightLb || input.bodyweightLb <= 60) missingDataFlags.push("body weight");
  if (!input.hasConfirmedBodyData) missingDataFlags.push("confirmed body weight + goal phase");

  // Hard incomplete: no usable bodyweight at all.
  const incomplete = !input.bodyweightLb || input.bodyweightLb <= 60;

  const bw = input.bodyweightLb && input.bodyweightLb > 60 ? input.bodyweightLb : null;
  const goal = spec.macroGoal;
  const profile = input.bodyProfile ?? null;
  const calorieBasis: "tdee" | "bodyweight" =
    profile && profile.sex && profile.heightIn && profile.age ? "tdee" : "bodyweight";

  // Never generate placeholder numbers from an invented body weight. Direction
  // and day-type strategy remain available while exact macro sets stay null.
  const trainingBase = bw ? computeMacroTargets({ goal, bodyweightLb: bw, dayType: "training", dietStyle: input.dietStyle, bodyProfile: profile, trainingLoad: input.trainingLoad }) : null;
  const restBase = bw ? computeMacroTargets({ goal, bodyweightLb: bw, dayType: "rest", dietStyle: input.dietStyle, bodyProfile: profile, trainingLoad: input.trainingLoad }) : null;

  // 12–24 week phase progression — subtle, carb-only. Training days carry the phase
  // carb modifier; rest days stay controlled (unmodified) across the whole protocol.
  const training = trainingBase ? bumpCarbs(trainingBase, mod.trainingCarbPct) : null;
  const rest = restBase;

  // Day-type variants — carbs PROTECTED / increased on demanding days. This is
  // the guardrail in action: a high-output leg day is never a low-fuel rest day.
  // Specialization/intensification add extra priority carb timing on lower-body days.
  const lowerBody = training ? bumpCarbs(training, 0.12 + mod.lowerBodyExtraPct) : null;
  const highOutput = training ? bumpCarbs(training, 0.15) : null;
  const conditioning = training ? bumpCarbs(training, 0.08) : null;

  return {
    phase: input.phase,
    phaseLabel: spec.label,
    caloriesTarget: training?.calories ?? null,
    proteinGrams: training?.proteinG ?? null,
    carbsGrams: training?.carbsG ?? null,
    fatsGrams: training?.fatG ?? null,
    trainingDayMacros: training,
    restDayMacros: rest,
    highOutputDayMacros: highOutput,
    lowerBodyDayMacros: lowerBody,
    conditioningDayMacros: conditioning,
    macroRationale: `${spec.label}: ${spec.calorieBias} ${spec.carbBias}`,
    safetyCopy: SAFETY_COPY,
    missingDataFlags,
    incomplete,
    trainingPhase: input.trainingPhase ?? null,
    phaseProgressionNote: mod.note,
    calorieBasis,
  };
}

/** Pick the macro set for a given day kind. */
export function macrosForDay(targets: ResolvedMacroTargets, day: DayKind): MacroTargets | null {
  switch (day) {
    case "lower-body": return targets.lowerBodyDayMacros;
    case "high-output": return targets.highOutputDayMacros;
    case "conditioning": return targets.conditioningDayMacros;
    case "rest":
    case "recovery": return targets.restDayMacros;
    default: return targets.trainingDayMacros;
  }
}

/* ─── Meal-plan matching hooks (TASK 8) ───────────────────────────────────── */
export type MealPlanGuardrails = {
  preWorkoutFuelBias: string;
  postWorkoutMealBias: string;
  lowerBodyDayCarbBias: string;
  restDayCalorieBias: string;
  /** True → block bulk-style macro plans (summer-lean / waistline direction). */
  summerLeanGuard: boolean;
  /** True → block aggressive cuts (glute-growth driver without fat-loss priority). */
  gluteGrowthFuelGuard: boolean;
  /** True → protect carbs around training under combined activity load. */
  highOutputHybridGuard: boolean;
  mealTimingStrategy: string;
};

export function buildMealPlanGuardrails(resolution: ProtocolNutritionResolution): MealPlanGuardrails {
  const spec = NUTRITION_PHASES[resolution.nutritionPhase];
  const f = resolution.flags;
  return {
    preWorkoutFuelBias: "Easy-digesting carbs and light protein placed before the session to support output.",
    postWorkoutMealBias: "Protein anchored with carbs to support recovery after training.",
    lowerBodyDayCarbBias: spec.lowerBodyDayStrategy,
    restDayCalorieBias: spec.restDayStrategy,
    summerLeanGuard: f.leanDirection,
    gluteGrowthFuelGuard: f.lowerGrowth && !f.fatLossPriority,
    highOutputHybridGuard: f.highOutputActivity,
    mealTimingStrategy: spec.trainingDayStrategy,
  };
}
