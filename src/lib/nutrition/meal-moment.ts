import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import { LOG_MOMENT_ARRIVAL_MS, planLogMoment, springSamples, type LogMilestone, type LogMomentPlan } from "@/lib/ui/log-moment";

/* ════════════════════════════════════════════════════════════════════════
   MEAL MOMENT — what the system says, and how hard it lands, when a meal is
   logged or cleared in Nutrition.

   Every number comes from the same fuel plan estimate the hero prints
   (protein and calories per planned meal, against the plan's own estimated
   protein target), so the line can never disagree with the screen. The copy
   names what happened and where the day stands. No praise, no health claim,
   no promise of an outcome.

   Milestones, strongest first (one per log):
     day-fueled      the log completed every planned meal today
     protein-target  the log carried estimated protein across the target
     first-meal      the first meal logged today
   A clear (Undo) is never a milestone.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type MealMomentMeal = { id: string; label: string; proteinG: number; calories: number };

export type MealMomentTone = "log" | "clear";
export type MealMilestone = "first-meal" | "protein-target" | "day-fueled";

export type MealMoment = {
  tone: MealMomentTone;
  mealId: string;
  mealLabel: string;
  loggedCount: number;
  total: number;
  proteinBefore: number;
  proteinAfter: number;
  proteinTargetG: number;
  caloriesBefore: number;
  caloriesAfter: number;
  milestone: MealMilestone | null;
  /** The milestone's short headline ("Day fueled."), or null. */
  headline: string | null;
  /** "Pre-Workout Meal logged" */
  lead: string;
  /** "3 of 5 · est. 142 g protein today" */
  detail: string;
};

export const MILESTONE_HEADLINE: Record<MealMilestone, string> = {
  "first-meal": "Fuel day open.",
  "protein-target": "Protein target reached.",
  "day-fueled": "Day fueled.",
};

function totals(meals: readonly MealMomentMeal[], ids: ReadonlySet<string>) {
  let protein = 0;
  let calories = 0;
  let count = 0;
  for (const meal of meals) {
    if (!ids.has(meal.id)) continue;
    count += 1;
    protein += meal.proteinG;
    calories += meal.calories;
  }
  return { count, protein: Math.round(protein), calories: Math.round(calories) };
}

/**
 * The moment for one change to today's logged meals. Null when nothing in the
 * plan changed (a repeat log, an id that is not today's plan, or no plan).
 */
export function resolveMealMoment(input: {
  meals: readonly MealMomentMeal[];
  before: readonly string[];
  after: readonly string[];
  proteinTargetG: number;
}): MealMoment | null {
  const { meals } = input;
  if (meals.length === 0) return null;
  const before = new Set(input.before);
  const after = new Set(input.after);
  const added = meals.find((meal) => after.has(meal.id) && !before.has(meal.id));
  const removed = added ? undefined : meals.find((meal) => before.has(meal.id) && !after.has(meal.id));
  const changed = added ?? removed;
  if (!changed) return null;

  const tone: MealMomentTone = added ? "log" : "clear";
  const was = totals(meals, before);
  const now = totals(meals, after);
  const target = input.proteinTargetG > 0 ? Math.round(input.proteinTargetG) : 0;

  let milestone: MealMilestone | null = null;
  if (tone === "log") {
    if (now.count === meals.length && was.count < meals.length) milestone = "day-fueled";
    else if (target > 0 && was.protein < target && now.protein >= target) milestone = "protein-target";
    else if (was.count === 0 && now.count === 1) milestone = "first-meal";
  }

  return {
    tone,
    mealId: changed.id,
    mealLabel: changed.label,
    loggedCount: now.count,
    total: meals.length,
    proteinBefore: was.protein,
    proteinAfter: now.protein,
    proteinTargetG: target,
    caloriesBefore: was.calories,
    caloriesAfter: now.calories,
    milestone,
    headline: milestone ? MILESTONE_HEADLINE[milestone] : null,
    lead: `${changed.label} ${tone === "log" ? "logged" : "cleared"}`,
    detail: `${now.count} of ${meals.length} · est. ${now.protein} g protein today`,
  };
}

/* ─── Choreography ─────────────────────────────────────────────────────── */

/* The meal moment is the shared log moment at its full tier
   (src/lib/ui/log-moment.ts); these names stay for Nutrition's callers. */
export type MealMomentPlan = LogMomentPlan;
export const MEAL_MOMENT_ARRIVAL_MS = LOG_MOMENT_ARRIVAL_MS;
export { springSamples };

export const MILESTONE_INTENSITY: Record<MealMilestone, number> = {
  "first-meal": 1.4,
  "protein-target": 1.4,
  "day-fueled": 1.7,
};

/** A meal milestone in the shared moment's shape. */
export function mealLogMilestone(milestone: MealMilestone | null): LogMilestone | null {
  return milestone ? { key: milestone, headline: MILESTONE_HEADLINE[milestone], intensity: MILESTONE_INTENSITY[milestone] } : null;
}

/**
 * How much of the moment runs under each motion setting.
 *   full     everything; a milestone lands harder and holds longer
 *   reduced  no motion: the words and a still check, the numbers already true
 *   static   the same still words (the member paused motion, or the tab is
 *            hidden): no animation, no canvas, no vibration; the live region
 *            announces the log as always
 */
export function planMealMoment(moment: Pick<MealMoment, "tone" | "milestone">, motion: AmbientMotion): MealMomentPlan {
  return planLogMoment({ tier: "full", tone: moment.tone, milestone: mealLogMilestone(moment.tone === "log" ? moment.milestone : null) }, motion);
}
