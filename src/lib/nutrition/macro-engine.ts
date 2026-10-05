/* ════════════════════════════════════════════════════════════════════════
   MACRO ENGINE
   ------------------------------------------------------------------------
   Estimated nutrition targets based on member profile. Performance support
   only — not medical advice and does not treat any condition.
   ════════════════════════════════════════════════════════════════════════ */

import { dietStyleMeta } from "./diet-styles";
import { FUEL_REFERENCE_BODYWEIGHT_LB } from "./fuel-plan";
import type { DayType, DietStyleKey, GoalKey, MacroTargets } from "./types";

/** Calorie multiplier per pound of bodyweight, by goal. */
const CAL_PER_LB: Record<GoalKey, { training: number; rest: number }> = {
  cut: { training: 13, rest: 11 },
  "lean-bulk": { training: 16.5, rest: 15 },
  recomp: { training: 15, rest: 13 },
  maintenance: { training: 15, rest: 14 },
  performance: { training: 16, rest: 14.5 },
  prep: { training: 12.5, rest: 10.5 },
};

/** Protein g per pound, by goal (higher in a deficit to protect muscle). */
const PROTEIN_PER_LB: Record<GoalKey, number> = {
  cut: 1.1,
  "lean-bulk": 1.0,
  recomp: 1.1,
  maintenance: 1.0,
  performance: 1.0,
  prep: 1.2,
};

/** Optional member body data — when sex/height/age exist, calories are personalized
    via a clamped TDEE ratio instead of bodyweight alone. All fields optional. */
export type BodyProfile = {
  sex?: "male" | "female" | "other";
  heightIn?: number;
  age?: number;
  /** Small activity factor on the TDEE maintenance anchor (more days → slightly higher). */
  trainingDaysPerWeek?: number;
};

const LB_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

/** Personalization ratio from a Mifflin–St Jeor TDEE maintenance estimate vs the
    bodyweight-only maintenance assumption (bw × 14.5). Returns 1 (no change) when
    sex/height/age are missing or out of a sane range, so the bodyweight estimator
    stays the fallback. Clamped to ±12% so it informs the protocol-intended target
    without ever causing extreme calorie swings or flipping goal direction:
    protein and the goal/phase guardrails stay fully in control. */
function tdeePersonalizationRatio(bodyweightLb: number, p?: BodyProfile | null): number {
  if (!p || !p.sex || !p.heightIn || !p.age) return 1;
  if (p.heightIn < 36 || p.heightIn > 90 || p.age < 14 || p.age > 90) return 1;
  const kg = bodyweightLb * LB_TO_KG;
  const cm = p.heightIn * IN_TO_CM;
  const base = 10 * kg + 6.25 * cm - 5 * p.age;
  // Mifflin–St Jeor sex constant; "other"/unspecified uses the midpoint (−78).
  const bmr = p.sex === "male" ? base + 5 : p.sex === "female" ? base - 161 : base - 78;
  const activity = Math.min(1.55, Math.max(1.4, 1.4 + 0.02 * (p.trainingDaysPerWeek ?? 4)));
  const tdeeMaintenance = bmr * activity;
  const bodyweightMaintenance = bodyweightLb * 14.5; // midpoint of the maintenance multipliers
  if (bodyweightMaintenance <= 0) return 1;
  return Math.min(1.12, Math.max(0.88, tdeeMaintenance / bodyweightMaintenance));
}

/** How the active training architecture loads the week — so nutrition follows
    training (hypertrophy/conditioning volume raises carbs; strength biases
    protein; frequency raises training-day glycogen). All values fractional. */
export type TrainingLoad = {
  intentMix: { strength: number; hypertrophy: number; conditioning: number };
  trainingDaysPerWeek: number;
};

/** Training-day carb-share nudge from the architecture's intent mix + frequency.
    Clamped so training architecture INFORMS carbs without ever flipping the
    diet-style/goal posture. Rest days get a fraction of the shift. */
function loadCarbNudge(load: TrainingLoad, dayType: DayType): number {
  const demand = load.intentMix.hypertrophy * 0.07 + load.intentMix.conditioning * 0.06 - load.intentMix.strength * 0.04;
  const freq = Math.max(-0.02, Math.min(0.03, (load.trainingDaysPerWeek - 4) * 0.01));
  const nudge = Math.max(-0.06, Math.min(0.08, demand + freq));
  return dayType === "training" ? nudge : nudge * 0.4;
}

/** Strength-dominant architectures bias protein up slightly (g/lb). */
function loadProteinBias(load: TrainingLoad): number {
  return load.intentMix.strength >= 0.4 ? 0.05 : 0;
}

export function computeMacroTargets(input: {
  goal: GoalKey;
  /** The member's weight, or null — the disclosed reference weight is then used and named in `basis`. */
  bodyweightLb: number | null;
  dayType: DayType;
  dietStyle: DietStyleKey;
  /** Optional — when sex/height/age exist, personalizes calories via a clamped TDEE ratio. */
  bodyProfile?: BodyProfile | null;
  /** Optional — the active training architecture's load, so nutrition derives
      from training. Absent → behaviour is unchanged. */
  trainingLoad?: TrainingLoad | null;
}): MacroTargets {
  const { goal, bodyweightLb, dayType, dietStyle, trainingLoad } = input;
  /* The member's weight, or the same disclosed reference the fuel log uses — never a silent default. */
  const memberBw = typeof bodyweightLb === "number" && bodyweightLb > 60 ? Math.max(80, bodyweightLb) : null;
  const bw = memberBw ?? FUEL_REFERENCE_BODYWEIGHT_LB;
  const style = dietStyleMeta(dietStyle);

  // Calories: protocol-intended bodyweight estimate, personalized by a clamped TDEE
  // ratio (1.0 when body data is absent). Protein stays strictly bodyweight-based.
  const ratio = tdeePersonalizationRatio(bw, input.bodyProfile);
  const calories = Math.round(bw * CAL_PER_LB[goal][dayType === "training" ? "training" : "rest"] * ratio);
  const proteinG = Math.round(bw * (PROTEIN_PER_LB[goal] + (trainingLoad ? loadProteinBias(trainingLoad) : 0)));
  const proteinCals = proteinG * 4;

  // Carb posture: diet style + day type.
  let carbShare =
    style.carbPosture === "very-low" ? 0.08
    : style.carbPosture === "low" ? 0.22
    : dayType === "training" ? 0.46 : 0.36;

  // Fat posture nudges.
  if (style.fatPosture === "high") carbShare = Math.max(0.05, carbShare - 0.1);
  if (style.fatPosture === "low") carbShare = Math.min(0.55, carbShare + 0.08);

  // Training-architecture nudge — carbs follow training load (not for very-low/low
  // carb styles, which are the member's fixed dietary posture).
  if (trainingLoad && style.carbPosture !== "very-low" && style.carbPosture !== "low") {
    carbShare = Math.max(0.05, Math.min(0.6, carbShare + loadCarbNudge(trainingLoad, dayType)));
  }

  const remainingCals = Math.max(0, calories - proteinCals);
  const carbCals = Math.round(remainingCals * carbShare);
  const fatCals = Math.max(0, remainingCals - carbCals);

  const carbsG = Math.round(carbCals / 4);
  const fatG = Math.round(fatCals / 9);
  const fiberG = Math.max(20, Math.round((calories / 1000) * 14));
  // Conditioning-heavy training days lift hydration modestly.
  const conditioningHeavy = !!trainingLoad && trainingLoad.intentMix.conditioning >= 0.35;
  const hydrationMl = dayType === "training" ? (conditioningHeavy ? 5000 : 4500) : 3500;

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    hydrationMl,
    basis: memberBw !== null
      ? "Estimated nutrition target based on member profile."
      : `Estimate assumes ${FUEL_REFERENCE_BODYWEIGHT_LB} lb — no bodyweight on file. Log a weigh-in to personalize.`,
  };
}

/** Whether the chosen diet style makes the carb target hard to reach (surface a hint, not advice). */
export function carbTargetFeasibilityNote(dietStyle: DietStyleKey, carbsG: number): string | null {
  const style = dietStyleMeta(dietStyle);
  if ((style.carbPosture === "very-low") && carbsG > 80) {
    return "Macro target may require adjustment or additional allowed food sources for this diet style.";
  }
  return null;
}
