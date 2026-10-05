/* ════════════════════════════════════════════════════════════════════════
   MEAL VARIETY ENGINE + FOOD FATIGUE
   ------------------------------------------------------------------------
   Keeps meals optimized for the goal while creating variety: macro-matched
   rotation, food-fatigue detection, weekly rotation, dislike memory, and a
   meal-fit quality score. Adherence support only — no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

import { getSwapOptions } from "./diet-styles";
import { buildTodaysMealPlan } from "./meal-plan";
import type {
  DayType,
  DietStyleKey,
  MacroRole,
  Meal,
  MealPlan,
  MealQuality,
  MacroTargets,
  NutritionEngineInput,
} from "./types";

/* ─── Macro-matched swaps ────────────────────────── */
export function macroMatchedSwaps(
  foodId: string,
  role: MacroRole,
  style: DietStyleKey,
  filters: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] },
): string[] {
  return getSwapOptions(foodId, role, style, filters);
}

/* ─── Food fatigue detection ─────────────────────── */
export type FatigueWarning = {
  id: string;
  severity: "info" | "warning";
  message: string;
  food?: string;
};

export type WeekFoodTally = {
  proteinCounts: Record<string, number>;
  carbCounts: Record<string, number>;
  fullMealCounts: Record<string, number>; // keyed by "protein+carb"
};

/** Tally protein/carb/full-meal occurrences across a set of daily plans. */
export function tallyWeekFoods(plans: MealPlan[]): WeekFoodTally {
  const proteinCounts: Record<string, number> = {};
  const carbCounts: Record<string, number> = {};
  const fullMealCounts: Record<string, number> = {};
  for (const plan of plans) {
    for (const meal of plan.meals) {
      const protein = meal.foods.find((f) => f.role === "protein")?.name;
      const carb = meal.foods.find((f) => f.role === "carb")?.name;
      if (protein) proteinCounts[protein] = (proteinCounts[protein] ?? 0) + 1;
      if (carb) carbCounts[carb] = (carbCounts[carb] ?? 0) + 1;
      if (protein && carb) {
        const key = `${protein} + ${carb}`;
        fullMealCounts[key] = (fullMealCounts[key] ?? 0) + 1;
      }
    }
  }
  return { proteinCounts, carbCounts, fullMealCounts };
}

/** Diet-style-aware rotation hint (stays inside the member's allowed foods). */
function rotationHint(dietStyle?: DietStyleKey): string {
  switch (dietStyle) {
    case "carnivore":
    case "animal-based":
      return "Rotate in salmon, eggs, lamb, bison, or chicken thighs if allowed";
    case "pescatarian":
      return "Rotate in salmon, shrimp, tuna, white fish, or eggs";
    case "vegan":
      return "Rotate in tofu, tempeh, seitan, lentils, or a plant protein";
    case "vegetarian":
      return "Rotate in Greek yogurt, eggs, tofu, tempeh, or cottage cheese";
    default:
      return "Rotate the protein source to keep adherence high";
  }
}

/**
 * Detect food fatigue. Thresholds: same full meal 3+/week, same protein 5+/week,
 * same carb 5+/week. Boredom-kills-compliance support — not medical advice.
 */
export function detectFoodFatigue(tally: WeekFoodTally, dietStyle?: DietStyleKey): FatigueWarning[] {
  const out: FatigueWarning[] = [];
  let n = 0;
  for (const [protein, count] of Object.entries(tally.proteinCounts)) {
    if (count >= 5) out.push({ id: `fat-p-${n++}`, severity: "warning", message: `${protein} appears ${count}× this week. ${rotationHint(dietStyle)}.`, food: protein });
  }
  for (const [carb, count] of Object.entries(tally.carbCounts)) {
    if (count >= 5) out.push({ id: `fat-c-${n++}`, severity: "warning", message: `${carb} appears ${count}× this week. Consider rotating the carb source.`, food: carb });
  }
  for (const [meal, count] of Object.entries(tally.fullMealCounts)) {
    if (count >= 3) out.push({ id: `fat-m-${n++}`, severity: "info", message: `"${meal}" repeats ${count}× this week. Add a variation to keep it fresh.`, food: meal });
  }
  return out;
}

/** Quick single-day variety read for the dashboard ("Strong · no repeated meals today"). */
export function dailyVarietyStatus(plan: MealPlan): { label: "Strong" | "Mixed" | "Repetitive"; note: string } {
  const proteins = plan.meals.map((m) => m.foods.find((f) => f.role === "protein")?.name).filter(Boolean) as string[];
  const unique = new Set(proteins);
  if (proteins.length === 0) return { label: "Mixed", note: "No protein sources placed yet." };
  const ratio = unique.size / proteins.length;
  if (ratio >= 0.75) return { label: "Strong", note: "No repeated meals today." };
  if (ratio >= 0.5) return { label: "Mixed", note: "Some repetition — rotate one source." };
  return { label: "Repetitive", note: "Same source repeats — swap to add variety." };
}

/* ─── Weekly rotation ────────────────────────────── */
export type WeeklyRotation = {
  days: Array<{ dayIndex: number; dayType: DayType; plan: MealPlan }>;
  fatigueWarnings: FatigueWarning[];
};

/**
 * Build a controlled N-day rotation. Each day uses a distinct rotation seed so
 * proteins/carbs rotate, while macros, diet style, and exclusions stay fixed.
 * Training/rest days differ via dayTypes. Favorites are still prioritised.
 */
export function buildWeeklyRotation(
  base: NutritionEngineInput,
  dayTypes: DayType[] = ["training", "training", "rest", "training", "training", "rest", "rest"],
): WeeklyRotation {
  const days = dayTypes.map((dayType, i) => ({
    dayIndex: i,
    dayType,
    plan: buildTodaysMealPlan({ ...base, dayType, rotationSeed: (base.rotationSeed ?? 0) + i * 2 }),
  }));
  const tally = tallyWeekFoods(days.map((d) => d.plan));
  return { days, fatigueWarnings: detectFoodFatigue(tally, base.dietStyle) };
}

/* ─── Dislike / favorite memory (pure transforms) ── */
export type FoodMemory = {
  preferredFoods: string[];
  dislikedFoods: string[];
  excludedFoods: string[];
  favoriteFoods: string[];
};

export type DislikeAction = "swap-today" | "avoid-forward" | "replace-macro";

/** Apply a remove/dislike action, returning updated memory lists (no mutation). */
export function applyDislike(memory: FoodMemory, food: string, action: DislikeAction): FoodMemory {
  const next: FoodMemory = {
    preferredFoods: [...memory.preferredFoods],
    dislikedFoods: [...memory.dislikedFoods],
    excludedFoods: [...memory.excludedFoods],
    favoriteFoods: memory.favoriteFoods.filter((f) => f.toLowerCase() !== food.toLowerCase()),
  };
  if (action === "avoid-forward") {
    if (!next.dislikedFoods.some((f) => f.toLowerCase() === food.toLowerCase())) next.dislikedFoods.push(food);
  }
  // "swap-today" and "replace-macro" do not persist a dislike.
  return next;
}

/** Toggle a favorite (favorites get prioritised when macros/diet style allow). */
export function toggleFavorite(memory: FoodMemory, food: string): FoodMemory {
  const has = memory.favoriteFoods.some((f) => f.toLowerCase() === food.toLowerCase());
  return {
    ...memory,
    favoriteFoods: has
      ? memory.favoriteFoods.filter((f) => f.toLowerCase() !== food.toLowerCase())
      : [...memory.favoriteFoods, food],
  };
}

/* ─── Meal quality / adherence fit score ─────────── */
export function scoreMeal(
  meal: Meal,
  ctx: {
    target: MacroTargets;
    mealCount: number;
    preferredFoods?: string[];
    hasConflict?: boolean;
    fatigued?: boolean;
  },
): MealQuality {
  const factors: string[] = [];
  let score = 100;

  // Macro fit vs even share.
  const fairProtein = ctx.target.proteinG / Math.max(1, ctx.mealCount);
  const proteinDelta = Math.abs(meal.macros.proteinG - fairProtein) / Math.max(1, fairProtein);
  if (proteinDelta > 0.4) { score -= 15; factors.push("Protein share off target"); }
  else factors.push("Protein on target");

  // Diet conflicts on the meal.
  if (meal.conflictFlags.length > 0) { score -= 25; factors.push("Diet/exclusion conflict"); }
  // Schedule conflict.
  if (ctx.hasConflict) { score -= 15; factors.push("Schedule conflict"); }
  // Fatigue.
  if (ctx.fatigued) { score -= 12; factors.push("Repeated food"); }
  // Preferred foods present.
  const pref = (ctx.preferredFoods ?? []).map((p) => p.toLowerCase());
  if (pref.length > 0 && meal.foods.some((f) => pref.includes(f.name.toLowerCase()))) { score += 5; factors.push("Includes preferred food"); }
  // Core macro coverage.
  const hasProtein = meal.foods.some((f) => f.role === "protein");
  if (!hasProtein) { score -= 20; factors.push("Missing protein source"); }

  score = Math.max(0, Math.min(100, score));
  const label: MealQuality["label"] =
    score >= 90 ? "Optimized" : score >= 75 ? "Strong" : score >= 55 ? "Acceptable" : "Needs Review";
  return { score, label, factors };
}
