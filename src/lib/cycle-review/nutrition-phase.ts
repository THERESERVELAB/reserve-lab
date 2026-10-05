/* ════════════════════════════════════════════════════════════════════════
   PHASE NUTRITION — fuel driven by goal, body composition, training and
   recovery. Never by when a compound is taken.

   Reads the member's cycle goal beside the nutrition phase their fuel
   strategy already runs on (protocol-alignment.ts), today's estimated
   targets from the macro engine, and their bodyweight trend. It says whether
   the fuel strategy points the same way as the goal, how fast weight is
   moving against a general coaching range, and — when a compound in the plan
   is known to change blood sugar — what their own glucose results show.

   It never builds meal timing around a compound.
   ════════════════════════════════════════════════════════════════════════ */

import { daysBetween, isDateKey } from "@/lib/cycle/cycle-period";
import { NUTRITION_PHASES, type CalorieDirection, type NutritionPhase } from "@/lib/nutrition/protocol-alignment";
import type { MacroTargets } from "@/lib/nutrition/types";

import { MARKER_TREND_STATUS_LABEL, type MarkerTrend } from "./lab-trends";
import { CYCLE_GOAL_LABEL, type CyclePrimaryGoal } from "./types";

export type WeightPoint = { date: string; weightLb: number };

/** Fuel-strategy directions that point the same way as each goal. Null = any direction fits. */
const GOAL_DIRECTIONS: Record<CyclePrimaryGoal, CalorieDirection[] | null> = {
  "fat-loss": ["deficit", "modest-deficit"],
  "lean-mass": ["modest-surplus"],
  recomposition: ["near-maintenance", "modest-deficit", "maintenance"],
  strength: ["near-maintenance", "maintenance", "modest-surplus"],
  performance: ["near-maintenance", "maintenance", "modest-surplus"],
  recovery: ["near-maintenance", "maintenance"],
  "clinician-managed-therapy": null,
  other: null,
};

/** General coaching ranges for weekly bodyweight change, % of bodyweight. */
export const VELOCITY_RANGE: Record<CyclePrimaryGoal, { min: number; max: number } | null> = {
  "fat-loss": { min: -1, max: -0.5 },
  "lean-mass": { min: 0.1, max: 0.5 },
  recomposition: { min: -0.25, max: 0.25 },
  strength: { min: -0.25, max: 0.5 },
  performance: { min: -0.5, max: 0.25 },
  recovery: { min: -0.25, max: 0.25 },
  "clinician-managed-therapy": null,
  other: null,
};

const GOAL_FOCUS: Record<CyclePrimaryGoal, string[]> = {
  "fat-loss": [
    "Calories below maintenance, with protein held high.",
    "Carbohydrates placed around training.",
    "Fiber and whole foods for fullness.",
    "Bodyweight judged by the weekly trend, not a single day.",
  ],
  "lean-mass": [
    "A controlled surplus — gain slowly.",
    "Performance should rise with bodyweight.",
    "Appetite and digestion followed in check-ins.",
    "Conditioning kept in the week to hold cardiovascular fitness.",
  ],
  recomposition: [
    "Near maintenance — bodyweight moves slowly.",
    "Training progression is the main signal.",
    "Recovery and consistency matter more than the scale.",
  ],
  strength: [
    "Enough fuel to support heavy training.",
    "Carbohydrates placed around hard sessions.",
    "Bodyweight held steady or rising slowly.",
  ],
  performance: [
    "Fuel matched to training output.",
    "Carbohydrates placed around hard sessions.",
    "Hydration kept ahead of conditioning work.",
  ],
  recovery: ["Maintenance intake to support recovery.", "Protein targets and sleep held steady."],
  "clinician-managed-therapy": ["Fuel follows your current nutrition phase."],
  other: ["Fuel follows your current nutrition phase."],
};

export type WeightVelocity = {
  status: "within" | "faster" | "slower" | "unknown";
  pctPerWeek?: number;
  lbPerWeek?: number;
  text: string;
};

export type PhaseNutrition = {
  goalLabel: string;
  phaseLabel: string | null;
  phaseMatch: "aligned" | "mismatch" | "unknown";
  phaseNote: string;
  /** Today's estimated targets; "Evidence needed" when none can be derived. */
  targets: Array<{ label: string; value: string }>;
  focus: string[];
  velocity: WeightVelocity;
  glucose: { text: string; markers: MarkerTrend[] } | null;
};

const WINDOW_DAYS = 28;

/** Least-squares bodyweight slope over the last four weeks. Needs 3 weigh-ins across 10+ days. */
export function weeklyWeightRate(points: WeightPoint[], today: string): { pctPerWeek: number; lbPerWeek: number } | null {
  const recent = points
    .map((p) => ({ date: p.date.slice(0, 10), weightLb: p.weightLb }))
    .filter((p) => isDateKey(p.date) && p.weightLb > 0 && daysBetween(p.date, today) >= 0 && daysBetween(p.date, today) <= WINDOW_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length < 3) return null;
  const first = recent[0].date;
  const xs = recent.map((p) => daysBetween(first, p.date));
  if (xs.at(-1)! < 10) return null;
  const ys = recent.map((p) => p.weightLb);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const lbPerWeek = (num / den) * 7;
  return { lbPerWeek, pctPerWeek: (lbPerWeek / my) * 100 };
}

function pct(value: number): string {
  return `${Math.abs(value).toFixed(1).replace(/\.0$/, "")}%`;
}

export function buildPhaseNutrition(input: {
  goal: CyclePrimaryGoal;
  nutritionPhase: NutritionPhase | null;
  todayMacros: MacroTargets | null;
  weights: WeightPoint[];
  today: string;
  /** Plan compounds known to change blood sugar. */
  glucoseCompounds: string[];
  trends: MarkerTrend[];
}): PhaseNutrition {
  const goalLabel = CYCLE_GOAL_LABEL[input.goal];
  const spec = input.nutritionPhase ? NUTRITION_PHASES[input.nutritionPhase] : null;
  const expected = GOAL_DIRECTIONS[input.goal];

  let phaseMatch: PhaseNutrition["phaseMatch"] = "unknown";
  let phaseNote = "Set a nutrition phase in Nutrition to compare it with this goal.";
  if (spec && expected) {
    phaseMatch = expected.includes(spec.calorieDirection) ? "aligned" : "mismatch";
    phaseNote =
      phaseMatch === "aligned"
        ? `Your fuel strategy (${spec.label}) points the same way as your ${goalLabel.toLowerCase()} goal.`
        : `Your cycle goal is ${goalLabel.toLowerCase()}, but your fuel strategy is set to ${spec.label}. Update your nutrition phase in Nutrition so they match.`;
  } else if (spec) {
    phaseNote = `Your fuel strategy runs on ${spec.label}.`;
  }

  const m = input.todayMacros;
  const targets = m
    ? [
        { label: "Calories", value: `${Math.round(m.calories)} kcal · est.` },
        { label: "Protein", value: `${Math.round(m.proteinG)} g` },
        { label: "Carbohydrates", value: `${Math.round(m.carbsG)} g` },
        { label: "Fat", value: `${Math.round(m.fatG)} g` },
        { label: "Fiber", value: `${Math.round(m.fiberG)} g` },
        { label: "Hydration", value: `${(m.hydrationMl / 1000).toFixed(1)} L` },
      ]
    : [{ label: "Targets", value: "Evidence needed — add bodyweight in Nutrition" }];

  const range = VELOCITY_RANGE[input.goal];
  const rate = weeklyWeightRate(input.weights, input.today);
  let velocity: WeightVelocity;
  if (!rate) {
    velocity = { status: "unknown", text: "Evidence needed — log bodyweight at least three times across two weeks." };
  } else {
    const direction = rate.pctPerWeek >= 0 ? "Gaining" : "Losing";
    const base = `${direction} ${pct(rate.pctPerWeek)} of bodyweight a week over the last four weeks (${Math.abs(rate.lbPerWeek).toFixed(1)} lb, est.).`;
    if (!range) {
      velocity = { status: "unknown", ...rate, text: base };
    } else {
      const rangeText = `${range.min > 0 ? "+" : ""}${range.min}% to ${range.max > 0 ? "+" : ""}${range.max}% a week`;
      const status = rate.pctPerWeek < range.min ? (input.goal === "fat-loss" ? "faster" : "slower") : rate.pctPerWeek > range.max ? (input.goal === "fat-loss" ? "slower" : "faster") : "within";
      const tail =
        status === "within"
          ? ` Inside the general coaching range for ${goalLabel.toLowerCase()} (${rangeText}).`
          : ` ${status === "faster" ? "Faster" : "Slower"} than the general coaching range for ${goalLabel.toLowerCase()} (${rangeText}).`;
      velocity = { status, ...rate, text: `${base}${tail}` };
    }
  }

  let glucose: PhaseNutrition["glucose"] = null;
  if (input.glucoseCompounds.length > 0) {
    const markers = input.trends.filter((t) => t.key === "glucose" || t.key === "hba1c" || t.key === "insulin");
    const withData = markers.filter((t) => t.current);
    const names = input.glucoseCompounds.join(", ");
    const lead = `${names} ${input.glucoseCompounds.length === 1 ? "is" : "are"} known to change blood sugar.`;
    glucose = {
      markers,
      text:
        withData.length === 0
          ? `${lead} No glucose, A1c or insulin result is logged — evidence needed. A clinician or a telehealth visit can say whether glucose monitoring applies to you.`
          : `${lead} ${withData.map((t) => `${t.label}: ${t.current!.valueText}${t.unit ? ` ${t.unit}` : ""} (${MARKER_TREND_STATUS_LABEL[t.status].toLowerCase()})`).join(" · ")}.`,
    };
  }

  return {
    goalLabel,
    phaseLabel: spec?.label ?? null,
    phaseMatch,
    phaseNote,
    targets,
    focus: GOAL_FOCUS[input.goal],
    velocity,
    glucose,
  };
}
