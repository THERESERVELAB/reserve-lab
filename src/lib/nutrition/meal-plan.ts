/* ════════════════════════════════════════════════════════════════════════
   MEAL PLAN COMPOSER
   ------------------------------------------------------------------------
   Assembles a schedule-aware, diet-style-aware daily fuel plan from the
   macro engine, meal-timing engine, food pools, and conflict engine.
   Performance meal-planning support only — no medical/dosing/compound advice.
   ════════════════════════════════════════════════════════════════════════ */

import { detectConflicts } from "./conflict-engine";
import {
  getFoodsForStyle,
  getSwapOptions,
} from "./diet-styles";
import { computeMacroTargets } from "./macro-engine";
import { composeDish } from "./meal-library";
import { buildMealWindows, parseHM, type MealWindow } from "./meal-timing";
import type {
  FoodOption,
  Meal,
  MealFood,
  MealPlan,
  MealPurpose,
  MacroRole,
  NutritionEngineInput,
} from "./types";
import { localDateKey } from "@/lib/dates/local-day";

/** Which macro roles a meal carries, by purpose. */
function rolesForPurpose(purpose: MealPurpose): MacroRole[] {
  switch (purpose) {
    case "pre-workout": return ["carb", "protein"];                  // fast fuel + protein
    case "post-workout": return ["protein", "carb", "produce"];      // recovery
    case "morning-anchor": return ["protein", "carb", "fat"];
    case "rest-day-anchor": return ["protein", "fat", "produce"];
    case "night-recovery": return ["protein", "fat", "produce"];
    case "snack": return ["protein", "snack"];
    default: return ["protein", "carb", "produce"]; // midday / work
  }
}

const PURPOSE_NOTE: Record<MealPurpose, string> = {
  "morning-anchor": "Protein anchor to open the day.",
  "work-meal": "Portable, adherence-friendly work fuel.",
  "midday-meal": "Steady protein + carbs to hold output.",
  "pre-workout": "Training-supportive fuel — carbs + protein before lifting.",
  "post-workout": "Recovery meal window — protein + carbs after training.",
  "night-recovery": "Lighter, digestion-friendly recovery meal before sleep.",
  "rest-day-anchor": "Rest-day protein anchor with controlled carbs.",
  "snack": "Convenience top-up to hit the daily target.",
};

function pickFood(
  role: MacroRole,
  pool: FoodOption[],
  preferred: string[],
  favorites: string[],
  usedIds: Set<string>,
  rotationSeed: number,
): FoodOption | null {
  if (pool.length === 0) return null;
  const norm = (s: string) => s.toLowerCase();
  const fav = favorites.map(norm);
  const pref = preferred.map(norm);
  // favorites first, then preferred, then an unused food rotated by seed, then anything
  const favHit = pool.find((fd) => fav.includes(norm(fd.name)) || fav.includes(fd.id));
  if (favHit) return favHit;
  const prefHit = pool.find((fd) => pref.includes(norm(fd.name)) || pref.includes(fd.id));
  if (prefHit) return prefHit;
  // rotation: start scanning from a seeded offset so daily plans differ.
  const start = ((rotationSeed % pool.length) + pool.length) % pool.length;
  for (let k = 0; k < pool.length; k += 1) {
    const fd = pool[(start + k) % pool.length];
    if (!usedIds.has(fd.id)) return fd;
  }
  return pool[start];
}

export function buildTodaysMealPlan(input: NutritionEngineInput): MealPlan {
  const {
    dayType, goal, bodyweightLb, dietStyle, schedule,
    preferredFoods = [], dislikedFoods = [], excludedFoods = [], allergies = [],
    compoundRules = [], loggedMealIds = [],
    favoriteFoods = [], rotationSeed = 0,
    carnivoreStrictness = "strict",
    macroTargetOverride,
  } = input;

  const filterOpts = { excludedFoods, dislikedFoods, allergies };
  // Single source of macro truth: when the protocol-aligned target is supplied,
  // the plan is built from it so the meals match the strategy card exactly.
  // Otherwise fall back to the bodyweight/goal estimate (graceful, data-light).
  const totalMacros = macroTargetOverride ?? computeMacroTargets({ goal, bodyweightLb, dayType, dietStyle });

  // Setup gaps → graceful empty-state CTAs.
  const setupNeeded: string[] = [];
  if (!schedule.wakeTime) setupNeeded.push("Add wake time");
  if (!schedule.sleepTime) setupNeeded.push("Add sleep time");
  if (dayType === "training" && !schedule.trainingStartTime) setupNeeded.push("Add training time");
  if (!schedule.workStartTime) setupNeeded.push("Add work schedule");

  const windows: MealWindow[] = buildMealWindows(schedule, dayType);
  const mealCount = windows.length || 1;

  // Even macro split across meals (pre/post slightly weighted toward carbs/protein handled by roles).
  const perMeal = {
    calories: Math.round(totalMacros.calories / mealCount),
    proteinG: Math.round(totalMacros.proteinG / mealCount),
    carbsG: Math.round(totalMacros.carbsG / mealCount),
    fatG: Math.round(totalMacros.fatG / mealCount),
  };

  const usedIds = new Set<string>();

  const meals: Meal[] = windows.map((w) => {
    const roles = rolesForPurpose(w.purpose);
    const foods: MealFood[] = [];
    const swapOptions: Record<string, string[]> = {};
    const conflictFlags: Meal["conflictFlags"] = [];

    for (const role of roles) {
      const pool = getFoodsForStyle(role, dietStyle, filterOpts, carnivoreStrictness);
      const choice = pickFood(role, pool, preferredFoods, favoriteFoods, usedIds, rotationSeed + w.order);
      if (choice) {
        usedIds.add(choice.id);
        foods.push({ role, name: choice.name, foodId: choice.id });
        swapOptions[choice.id] = getSwapOptions(choice.id, role, dietStyle, filterOpts, carnivoreStrictness);
      } else if (role === "protein") {
        // No allowed food for a core macro role → diet conflict flag.
        conflictFlags.push({
          conflictId: `${w.order}-${role}`,
          severity: "warning",
          message: `No allowed ${role} source for this diet style and filters in ${w.label}.`,
        });
      }
    }

    // Pre/post carb weighting around training (more carbs pre/post, fewer at night).
    const carbBias =
      w.purpose === "pre-workout" || w.purpose === "post-workout" ? 1.4
      : w.purpose === "night-recovery" ? 0.6
      : 1;
    const carbsG = Math.round(perMeal.carbsG * carbBias);

    const status: Meal["status"] = loggedMealIds.includes(`meal-${w.order}`) ? "logged" : "planned";

    const dish = composeDish({
      foods,
      purpose: w.purpose,
      dietStyle,
      carnivoreStrictness,
      seed: (rotationSeed + w.order) * 7,
    });

    return {
      id: `meal-${w.order}`,
      name: w.label,
      order: w.order,
      timeWindow: w.timeLabel,
      timeMinutes: w.timeMinutes,
      purpose: w.purpose,
      foods,
      dishName: dish.dishName,
      cookingStyle: dish.cookingStyle,
      flavorProfile: dish.flavorProfile,
      macros: { calories: perMeal.calories, proteinG: perMeal.proteinG, carbsG, fatG: perMeal.fatG },
      dietStyle,
      status,
      swapOptions,
      prepNote: PURPOSE_NOTE[w.purpose],
      conflictFlags,
    };
  });

  const conflicts = detectConflicts({
    meals,
    schedule,
    compoundRules,
    trainingStartMinutes: parseHM(schedule.trainingStartTime),
  });

  const completedMeals = meals.filter((m) => m.status === "logged").length;
  const loggedMacros = meals.filter((m) => m.status === "logged").reduce(
    (acc, m) => ({
      calories: acc.calories + m.macros.calories,
      proteinG: acc.proteinG + m.macros.proteinG,
      carbsG: acc.carbsG + m.macros.carbsG,
      fatG: acc.fatG + m.macros.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const remainingMacros = {
    calories: Math.max(0, totalMacros.calories - loggedMacros.calories),
    proteinG: Math.max(0, totalMacros.proteinG - loggedMacros.proteinG),
    carbsG: Math.max(0, totalMacros.carbsG - loggedMacros.carbsG),
    fatG: Math.max(0, totalMacros.fatG - loggedMacros.fatG),
  };

  const nextMeal = meals.find((m) => m.status === "planned") ?? null;

  // Grocery preview grouped by macro role (diet-style + filter aware).
  const groceryPreview: Record<MacroRole, string[]> = { protein: [], carb: [], fat: [], produce: [], sauce: [], snack: [] };
  for (const meal of meals) {
    for (const food of meal.foods) {
      const list = groceryPreview[food.role];
      if (!list.includes(food.name)) list.push(food.name);
    }
  }

  const prepNotes = Array.from(new Set(meals.map((m) => m.prepNote))).slice(0, 4);

  return {
    date: input.date ?? localDateKey(),
    dayType,
    trainingSplit: input.trainingSplit ?? "",
    dietStyle,
    meals,
    totalMacros,
    completedMeals,
    remainingMacros,
    nextMeal,
    conflicts,
    groceryPreview,
    prepNotes,
    setupNeeded,
  };
}
