/* ════════════════════════════════════════════════════════════════════════
   NUTRITION ROOM — what the top of the Nutrition screen says, and why.

   Every number the hero prints comes from a real source and carries its
   provenance (Bible §12): protein is the fuel plan's estimate for the meals
   the member logged, against the plan's own estimated target; water is the
   member's own hydration log. Nothing here guesses.

   It also adapts the fuel plan into the shape the existing meal confirmation
   drawer reads, so logging from the hero writes the same meal id the Apex
   fuel lane and the fuel log below read.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { formatTime12, timeToMinutes } from "@/lib/schedule/engine";

import { FUEL_REFERENCE_BODYWEIGHT_LB, type DailyFuelPlan, type MealSlot, type PlannedFuelMeal } from "./fuel-plan";
import type { DietStyleKey, Meal, MealPlan, MealPurpose } from "./types";

/* ─── Statement ────────────────────────────────────────────────────────── */

export type NutritionDayState = "no-windows" | "before-wake" | "after-sleep-lock" | "logged" | "open";

/** One statement per state of the fuel day. The screen is designed around it. */
export function nutritionStatement(input: { state: NutritionDayState; trainingPlanned: boolean }): string {
  switch (input.state) {
    case "no-windows":
      return "Map The Fuel Day.";
    case "before-wake":
      return "Fuel Day Staged.";
    case "after-sleep-lock":
      return "Fuel Day Closed.";
    case "logged":
      return "Fuel Handled.";
    case "open":
      return input.trainingPlanned ? "Fuel The Session." : "Fuel Recovery.";
  }
}

/* ─── Reads ────────────────────────────────────────────────────────────── */

export type FuelRead = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  /** Bible §12: estimated says "est.", logged comes from the member's own entries. */
  provenance: "est." | "logged";
};

/**
 * Protein logged today: the fuel plan's estimate for each logged meal, against
 * the plan's estimated target. Null without meal windows: there is nothing to log against.
 */
export function proteinRead(input: {
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "macros">>;
  loggedMealIds: readonly string[];
  targetG: number;
  /** "reference-weight": no bodyweight on file — the detail says so. */
  targetBasis?: "member-weight" | "reference-weight" | "member-plan";
}): FuelRead | null {
  if (input.meals.length === 0 || !(input.targetG > 0)) return null;
  const logged = input.meals.filter((meal) => input.loggedMealIds.includes(meal.id));
  const grams = Math.round(logged.reduce((sum, meal) => sum + meal.macros.proteinG, 0));
  return {
    label: "Protein",
    value: String(grams),
    unit: `/ ${input.targetG} g`,
    detail: input.targetBasis === "reference-weight"
      ? `${logged.length} of ${input.meals.length} meals logged · target assumes ${FUEL_REFERENCE_BODYWEIGHT_LB} lb until you log your weight`
      : `${logged.length} of ${input.meals.length} meals logged`,
    provenance: "est.",
  };
}

/* ─── Macro dials ──────────────────────────────────────────────────────── */

export type MacroKey = "protein" | "carbs" | "fat" | "calories";

/** Where a macro stands against today's target. "empty": nothing logged yet today. */
export type MacroState = "empty" | "under" | "on-target" | "over";

export type MacroDial = {
  key: MacroKey;
  label: string;
  /** Logged so far today (the plan's estimate for each logged meal). */
  logged: number;
  target: number;
  unit: "g" | "kcal";
  /** Arc fill, 0–1. */
  fraction: number;
  state: MacroState;
  /** Plain words: "62 g to go", "On target", "12 g over" ("480 to go" for calories). Empty: "Target". */
  remaining: string;
  /** What a screen reader hears for the dial. */
  ariaLabel: string;
};

export type MacroDials = {
  dials: MacroDial[];
  mealsLogged: number;
  mealsPlanned: number;
  /** Nothing logged today: the dials show targets, never zeros painted as progress. */
  empty: boolean;
};

const MACRO_ORDER: Array<{ key: MacroKey; label: string; field: "proteinG" | "carbsG" | "fatG" | "calories"; unit: "g" | "kcal" }> = [
  { key: "protein", label: "Protein", field: "proteinG", unit: "g" },
  { key: "carbs", label: "Carbs", field: "carbsG", unit: "g" },
  { key: "fat", label: "Fat", field: "fatG", unit: "g" },
  { key: "calories", label: "Calories", field: "calories", unit: "kcal" },
];

/** Close enough to call it on target: within 5 g or 5% (grams), 50 kcal or 3% (calories). */
function onTargetBand(target: number, unit: "g" | "kcal"): number {
  return unit === "g" ? Math.max(5, target * 0.05) : Math.max(50, target * 0.03);
}

/** "62 g" for grams; calories read under their own label, so the number stands alone ("480"). */
const amount = (n: number, unit: "g" | "kcal") => `${Math.round(n).toLocaleString("en-US")}${unit === "g" ? " g" : ""}`;

/**
 * Protein, carbs, fat and calories logged today against today's targets — the
 * fuel plan's estimate for each meal the member logged, never a guess. Null
 * without meal windows: there is nothing to log against.
 */
export function macroDials(input: {
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "macros">>;
  loggedMealIds: readonly string[];
  targets: { proteinG: number; carbsG: number; fatG: number; calories: number };
}): MacroDials | null {
  if (input.meals.length === 0 || !(input.targets.calories > 0)) return null;
  const logged = input.meals.filter((m) => input.loggedMealIds.includes(m.id));
  const empty = logged.length === 0;
  const dials = MACRO_ORDER.map(({ key, label, field, unit }): MacroDial => {
    const target = Math.max(0, Math.round(input.targets[field]));
    const value = Math.round(logged.reduce((sum, m) => sum + m.macros[field], 0));
    const diff = value - target;
    const band = onTargetBand(target, unit);
    const state: MacroState = empty ? "empty" : Math.abs(diff) <= band ? "on-target" : diff > 0 ? "over" : "under";
    const remaining = state === "empty" ? "Target" : state === "on-target" ? "On target" : state === "over" ? `${amount(diff, unit)} over` : `${amount(-diff, unit)} to go`;
    const unitWord = unit === "g" ? "grams" : "calories";
    const ariaLabel = state === "empty"
      ? `${label}: nothing logged today, target ${target} ${unitWord}, estimated.`
      : `${label}, estimated: ${value} of ${target} ${unitWord}. ${remaining}.`;
    return {
      key,
      label,
      logged: value,
      target,
      unit,
      fraction: target > 0 ? Math.min(1, Math.max(0, value / target)) : 0,
      state,
      remaining,
      ariaLabel,
    };
  });
  return { dials, mealsLogged: logged.length, mealsPlanned: input.meals.length, empty };
}

/** Water logged today against the member's target. Null when no target is set. */
export function waterRead(input: { todayOz: number; targetOz: number }): FuelRead | null {
  if (!(input.targetOz > 0)) return null;
  const oz = Math.max(0, Math.round(input.todayOz));
  return {
    label: "Water",
    value: String(oz),
    unit: `/ ${input.targetOz} oz`,
    detail: oz > 0 ? "Logged today" : "Nothing logged today",
    provenance: "logged",
  };
}

/* ─── Meal confirmation adapter ────────────────────────────────────────── */

const SLOT_PURPOSE: Record<MealSlot, MealPurpose> = {
  breakfast: "morning-anchor",
  lunch: "midday-meal",
  "pre-workout": "pre-workout",
  "post-workout": "post-workout",
  dinner: "night-recovery",
  snack: "snack",
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** One fuel plan meal in the meal confirmation's shape. */
export function fuelMealForConfirmation(meal: PlannedFuelMeal, order: number, logged: boolean, dietStyle: DietStyleKey): Meal {
  return {
    id: meal.id,
    name: meal.windowLabel,
    order,
    timeWindow: meal.time ? formatTime12(meal.time) : "Flexible",
    timeMinutes: meal.time ? timeToMinutes(meal.time) : 0,
    purpose: SLOT_PURPOSE[meal.slot] ?? "snack",
    foods: meal.ingredients.map((name, i) => ({ role: "protein", name, foodId: `${slug(name) || "item"}-${i}` })),
    dishName: meal.name,
    cookingStyle: "",
    flavorProfile: "",
    macros: { ...meal.macros },
    dietStyle,
    status: logged ? "logged" : "planned",
    swapOptions: {},
    prepNote: meal.smartRead,
    conflictFlags: [],
  };
}

/**
 * The fuel plan as the meal confirmation reads it. All four targets are the
 * plan's own estimates (the same ones the hero's macro dials read), so the
 * confirmation and the dials never disagree about what is left.
 */
export function fuelPlanForConfirmation(input: {
  plan: Pick<DailyFuelPlan, "meals" | "targets" | "isTrainingDay" | "sessionName">;
  loggedMealIds: readonly string[];
  dietStyle: DietStyleKey;
  date: string;
}): MealPlan {
  const { plan, loggedMealIds, dietStyle } = input;
  const meals = plan.meals.map((meal, i) => fuelMealForConfirmation(meal, i, loggedMealIds.includes(meal.id), dietStyle));
  const sum = (list: Meal[], key: "calories" | "proteinG" | "carbsG" | "fatG") => list.reduce((acc, meal) => acc + meal.macros[key], 0);
  const logged = meals.filter((meal) => meal.status === "logged");
  const totalMacros = {
    calories: plan.targets.calories,
    proteinG: plan.targets.proteinG,
    carbsG: plan.targets.carbsG,
    fatG: plan.targets.fatG,
    fiberG: 0,
    hydrationMl: 0,
    basis: plan.targets.note,
  };
  return {
    date: input.date,
    dayType: plan.isTrainingDay ? "training" : "rest",
    trainingSplit: plan.sessionName,
    dietStyle,
    meals,
    totalMacros,
    completedMeals: logged.length,
    remainingMacros: {
      calories: Math.max(0, totalMacros.calories - sum(logged, "calories")),
      proteinG: Math.max(0, totalMacros.proteinG - sum(logged, "proteinG")),
      carbsG: Math.max(0, totalMacros.carbsG - sum(logged, "carbsG")),
      fatG: Math.max(0, totalMacros.fatG - sum(logged, "fatG")),
    },
    nextMeal: meals.find((meal) => meal.status === "planned") ?? null,
    conflicts: [],
    groceryPreview: { protein: [], carb: [], fat: [], produce: [], sauce: [], snack: [] },
    prepNotes: [],
    setupNeeded: [],
  };
}

/* ─── Where today's targets come from ──────────────────────────────────── */

export type FuelSource = "horizon" | "protocol" | "goal" | "member-plan";

/**
 * One honest line under the hero's reads: what set today's fuel targets.
 *
 * It replaces a panel that said "No active Program Horizon is available"
 * directly under a hero fuelling today's session, which read as if nothing
 * was planned. The targets always come from somewhere real: the member's own
 * meal plan, an active Program Horizon's day, their chosen protocol, or their
 * goal and bodyweight. Only the Horizon carries a demand class.
 *
 * The member's own plan comes first: while it runs, its totals ARE the target,
 * so saying the numbers were built from goal and bodyweight would be untrue.
 */
export function fuelSourceLine(input: {
  horizon: { weekNumber: number; phaseName: string; demandClass: string } | null;
  protocolName: string | null;
  /** The member's own meal plan, when one is running today. */
  memberPlanName?: string | null;
}): { source: FuelSource; text: string } {
  if (input.memberPlanName) {
    return { source: "member-plan", text: `Your own plan · ${input.memberPlanName}` };
  }
  if (input.horizon) {
    const h = input.horizon;
    return {
      source: "horizon",
      text: `Program Horizon · Week ${h.weekNumber} · ${h.phaseName} · ${h.demandClass.replace(/-/g, " ")} fuel demand`,
    };
  }
  if (input.protocolName) {
    return { source: "protocol", text: `Built from ${input.protocolName} · no Program Horizon set` };
  }
  return { source: "goal", text: "Built from your goal and bodyweight · no Program Horizon set" };
}

/**
 * Whether a meal row reads as missed: late in the day, a planned window that
 * has passed and was not logged. Snacks are optional and never "missed".
 * Minutes before 4 AM belong to the previous day, so a 12:30 AM window sits
 * after a 10 PM one.
 */
export function mealWindowMissed(input: { logged: boolean; isSnack: boolean; closeoutActive: boolean; mealTime: string | null; nowMin: number | null }): boolean {
  if (input.logged || input.isSnack || !input.closeoutActive || !input.mealTime || input.nowMin === null) return false;
  const [h, m] = input.mealTime.split(":");
  const mins = parseInt(h ?? "", 10) * 60 + parseInt(m ?? "0", 10);
  if (!Number.isFinite(mins)) return false;
  const shift = (v: number) => (v < 4 * 60 ? v + 1440 : v);
  return shift(mins) <= shift(input.nowMin);
}
