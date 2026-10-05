/* ════════════════════════════════════════════════════════════════════════
   MY MEAL PLAN — the member's own meal plan inside Reserve.
   ------------------------------------------------------------------------
   Members are never trapped in generated nutrition: they can author the
   plan they actually eat — a training-day set and a rest-day set, meal by
   meal, with the amounts written on each item — and run it INSTEAD of the
   Reserve-generated fuel plan.

   This is the nutrition counterpart of lib/custom/workout-plans.ts. Pure
   data + helpers. Macros come from the deterministic ingredient estimator
   and are always framed as estimates — never medical nutrition claims, and
   never a recommendation about what anyone should eat.
   ════════════════════════════════════════════════════════════════════════ */

import type { FuelMacros, IngredientGroup, MealSlot } from "./fuel-plan";
import { estimateMealMacros } from "./ingredient-estimator";

/**
 * Whether the amounts on this plan's items are weighed cooked or raw.
 * The estimator's food table is cooked-basis for the foods that are eaten
 * cooked, so a "cooked" plan estimates directly. A "raw" plan is disclosed
 * in the UI so the member knows which number they are reading — Reserve
 * never silently converts one into the other.
 */
export type PlanWeighIn = "cooked" | "raw";

export const WEIGH_IN_LABEL: Record<PlanWeighIn, string> = {
  cooked: "Weighed cooked",
  raw: "Weighed raw",
};

export type MemberPlanItem = {
  id: string;
  /** Food name, matched against the estimator, e.g. "93/7 Ground Beef". */
  name: string;
  /** What the card shows, e.g. "230g" or "2 whole". The member's own words. */
  display: string;
  /** Grams used for the estimate. Null means "not counted" and is disclosed. */
  grams: number | null;
  group: IngredientGroup;
};

export type MemberPlanMeal = {
  id: string;
  /** The member's label, e.g. "Meal 1" or "Pre-Workout". */
  name: string;
  slot: MealSlot;
  /** Position in the day. Meals are always read in this order. */
  order: number;
  items: MemberPlanItem[];
  /** The member's own note on this meal, e.g. "Eat 1 hour before training". */
  note?: string;
  /** A meal the member can skip with nothing missed. */
  optional?: boolean;
};

export type MemberMealPlan = {
  id: string;
  name: string;
  weighIn: PlanWeighIn;
  trainingDay: MemberPlanMeal[];
  restDay: MemberPlanMeal[];
  /** The member's own note on the plan as a whole. Never written by Reserve. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export function newMealPlanId(): string {
  return `mplan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export function newPlanMealId(): string {
  return `pmeal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export function newPlanItemId(): string {
  return `pitem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyMemberMealPlan(name: string, at: Date = new Date()): MemberMealPlan {
  const now = at.toISOString();
  return { id: newMealPlanId(), name, weighIn: "cooked", trainingDay: [], restDay: [], createdAt: now, updatedAt: now };
}

/** The meals for a day type, in the member's own order. */
export function planMealsFor(plan: MemberMealPlan, isTrainingDay: boolean): MemberPlanMeal[] {
  const meals = isTrainingDay ? plan.trainingDay : plan.restDay;
  return [...meals].sort((a, b) => a.order - b.order);
}

/** A plan with no meals for the day being asked for has nothing to show. */
export function planCoversDay(plan: MemberMealPlan, isTrainingDay: boolean): boolean {
  return planMealsFor(plan, isTrainingDay).length > 0;
}

const ZERO: FuelMacros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export type PlanMealEstimate = {
  macros: FuelMacros;
  /** Item names the estimator could not match — surfaced, never guessed at zero. */
  unmatched: string[];
  /** Items the member left without an amount. Counted as unmatched for honesty. */
  uncounted: string[];
};

/**
 * Estimate one meal. The method is "raw" (as-assembled) on purpose: a member's
 * plan already names its own cooking fat, so adding a method's fat on top
 * would double-count it.
 */
export function estimatePlanMeal(meal: MemberPlanMeal): PlanMealEstimate {
  const counted = meal.items.filter((i) => i.grams != null && i.grams > 0);
  const uncounted = meal.items.filter((i) => i.grams == null || i.grams <= 0).map((i) => i.name);
  if (counted.length === 0) return { macros: ZERO, unmatched: [], uncounted };
  const est = estimateMealMacros(counted.map((i) => ({ name: i.name, grams: i.grams })), "raw", 1);
  return { macros: est.total, unmatched: est.unmatched, uncounted };
}

export function addMacros(a: FuelMacros, b: FuelMacros): FuelMacros {
  return {
    calories: a.calories + b.calories,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

/**
 * The day's totals: the sum of the plan's own meals.
 *
 * These become the day's TARGETS when a plan is active. A fixed plan is the
 * member's target — measuring it against a generated bodyweight estimate
 * would show them missing a number their plan never aimed at.
 */
export function planDayTotals(meals: readonly MemberPlanMeal[]): FuelMacros {
  return meals.reduce((acc, m) => addMacros(acc, estimatePlanMeal(m).macros), ZERO);
}

/** Every item name across the plan the estimator cannot price. Drives one honest UI line. */
export function planUnknownItems(plan: MemberMealPlan): string[] {
  const out = new Set<string>();
  for (const meal of [...plan.trainingDay, ...plan.restDay]) {
    const est = estimatePlanMeal(meal);
    for (const n of [...est.unmatched, ...est.uncounted]) out.add(n);
  }
  return [...out];
}
