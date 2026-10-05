/* ════════════════════════════════════════════════════════════════════════
   STORE → ENGINE ADAPTER
   ------------------------------------------------------------------------
   Maps existing athlete-store data + member nutrition preferences into the
   pure nutrition-engine input, and composes the full Nutrition Command state
   (plan + macro rescue + grocery + inventory + budget + variety) in one call.
   Performance meal-planning support only — no medical/dosing/compound advice.
   ════════════════════════════════════════════════════════════════════════ */

import { buildTodaysMealPlan } from "./meal-plan";
import { parseHM } from "./meal-timing";
import { suggestMacroRescue, type MacroRescueResult } from "./smoothie-engine";
import {
  buildBudgetSummary, buildGroceryList, buildSignatureGroceryItems, computeInventory,
  mergeGroceryItems, summarizeGrocery,
  type BeveragePreferences, type BudgetSummary, type GroceryItem,
  type GrocerySummary, type InventoryItem, type PurchaseLog, type StorePreferences,
} from "./grocery-engine";
import { applySignatureToMeal, SIG_PURPOSE_TO_MEAL, type SignatureMeal } from "./signature-meals";
import {
  buildWeeklyRotation, dailyVarietyStatus, detectFoodFatigue, tallyWeekFoods,
  type FatigueWarning,
} from "./variety-engine";
import type {
  CompoundTimingRule, DailySchedule, DayType, DietStyleKey, GoalKey,
  MealPlan, NutritionEngineInput,
} from "./types";

export function goalKeyFromString(goal: string | undefined): GoalKey {
  const g = (goal ?? "").toLowerCase();
  if (/prep|peak|competition|stage|contest/.test(g)) return "prep";
  if (/cut|shred|lean out|fat ?loss|deficit/.test(g)) return "cut";
  if (/recomp/.test(g)) return "recomp";
  if (/bulk|mass|gain|grow|hyper/.test(g)) return "lean-bulk";
  if (/performance|strength|power|athlet/.test(g)) return "performance";
  return "maintenance";
}

export type SchedulePlanLike = {
  wakeTime?: string;
  sleepTime?: string;
  workoutTime?: string;
};

export function scheduleFromPlan(plan: SchedulePlanLike, dayType: DayType, mealCount?: number): DailySchedule {
  return {
    wakeTime: plan.wakeTime ?? "07:00",
    sleepTime: plan.sleepTime ?? "23:00",
    trainingStartTime: dayType === "training" ? (plan.workoutTime || undefined) : undefined,
    preferredMealCount: mealCount ?? (dayType === "training" ? 5 : 4),
    lastMealBeforeBedHours: 2,
    minimumMealSpacingMinutes: 150,
  };
}

/** Map enhancement entries into read-only compound timing rules (planned time only,
 *  unless explicit member/provider timing flags are present). No invented rules. */
export function compoundRulesFromEntries(
  entries: Array<{ id: string; name: string; displayName?: string; customTime?: string }>,
): CompoundTimingRule[] {
  return entries
    .filter((e) => parseHM(e.customTime) !== null)
    .map((e) => ({ compoundId: e.id, compoundName: e.displayName ?? e.name, plannedTime: e.customTime }));
}

export type NutritionCommandState = {
  plan: MealPlan;
  rescue: MacroRescueResult;
  grocery: GroceryItem[];
  inventory: InventoryItem[];
  budget: BudgetSummary;
  grocerySummary: GrocerySummary;
  variety: ReturnType<typeof dailyVarietyStatus>;
  weeklyFatigue: FatigueWarning[];
};

export type NutritionCommandInput = NutritionEngineInput & {
  storePrefs?: StorePreferences;
  beverages?: BeveragePreferences;
  purchases?: PurchaseLog[];
  /** Day-type pattern for the weekly rotation / grocery list (defaults 5 train / 2 rest). */
  weekPattern?: DayType[];
  /** Member-saved signature meals (placed into the plan + fed into groceries). */
  signatureMeals?: SignatureMeal[];
  /** Week-stable rotation seed for the weekly grocery list so it does NOT churn
      day-to-day, even while the displayed daily plan rotates its food selection. */
  weekRotationSeed?: number;
};

/** One-call composer for the Nutrition Command page. */
export function buildNutritionCommand(input: NutritionCommandInput): NutritionCommandState {
  const plan = buildTodaysMealPlan(input);

  // Place pinned signature meals (added to today or in rotation) into matching slots.
  const signatureMeals = input.signatureMeals ?? [];
  const pinned = signatureMeals.filter((m) => m.addedToday || m.inRotation);
  for (const sig of pinned) {
    const targetPurpose = SIG_PURPOSE_TO_MEAL[sig.purpose];
    let idx = plan.meals.findIndex((m) => m.purpose === targetPurpose);
    if (idx < 0) idx = plan.meals.findIndex((m) => m.purpose === "midday-meal" || m.purpose === "work-meal");
    if (idx >= 0) plan.meals[idx] = applySignatureToMeal(plan.meals[idx], sig);
  }
  if (pinned.length > 0) {
    plan.nextMeal = plan.meals.find((m) => m.status === "planned") ?? null;
  }

  const remaining = plan.remainingMacros;
  const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const mealWindowsLeft = plan.meals.filter((m) => m.status === "planned" && m.timeMinutes >= nowMin).length;

  const rescue = suggestMacroRescue({
    remaining,
    mealWindowsLeft,
    nowMinutes: nowMin,
    trainingStartTime: input.schedule.trainingStartTime,
    sleepTime: input.schedule.sleepTime,
    dietStyle: input.dietStyle,
    carnivoreStrictness: input.carnivoreStrictness,
    appetiteLevel: input.appetiteLevel,
    filters: { excludedFoods: input.excludedFoods, dislikedFoods: input.dislikedFoods, allergies: input.allergies },
    preferSmoothieRescue: false,
  });

  // Weekly rotation → grocery + fatigue. The weekly list must NOT inherit today's
  // macro override (that target is for today's day-kind only — each week-day resolves
  // its own training/rest macros) and uses a week-stable seed so the grocery list
  // stays steady across the week while the daily plan still rotates day-to-day.
  const weekPattern = input.weekPattern ?? ["training", "training", "rest", "training", "training", "rest", "rest"];
  const weekly = buildWeeklyRotation(
    { ...input, macroTargetOverride: undefined, rotationSeed: input.weekRotationSeed ?? input.rotationSeed ?? 0 },
    weekPattern,
  );
  const weekPlans = weekly.days.map((d) => d.plan);

  const engineGrocery = buildGroceryList({ plans: weekPlans, dietStyle: input.dietStyle, storePrefs: input.storePrefs, beverages: input.beverages });
  // Recurring signature meals contribute their ingredients to the weekly list.
  const rotationMeals = signatureMeals.filter((m) => m.inRotation);
  const grocery = rotationMeals.length > 0
    ? mergeGroceryItems(engineGrocery, buildSignatureGroceryItems(rotationMeals, input.storePrefs))
    : engineGrocery;
  const purchases = input.purchases ?? [];
  const inventory = computeInventory(grocery, purchases, 1);
  const mealCount = weekPlans.reduce((s, p) => s + p.meals.length, 0);
  const budget = buildBudgetSummary(grocery, purchases, mealCount, weekPattern.length);
  const grocerySummary = summarizeGrocery(inventory, budget);

  const variety = dailyVarietyStatus(plan);
  const weeklyFatigue = detectFoodFatigue(tallyWeekFoods(weekPlans), input.dietStyle);

  return { plan, rescue, grocery, inventory, budget, grocerySummary, variety, weeklyFatigue };
}

export type { DietStyleKey, DayType, GoalKey };
