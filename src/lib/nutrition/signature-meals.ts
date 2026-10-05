/* ════════════════════════════════════════════════════════════════════════
   PERSONAL SIGNATURE MEALS
   ------------------------------------------------------------------------
   Member-saved meals they actually eat, treated as first-class meals inside
   Nutrition Command: they feed macros, the daily plan, the grocery list,
   the restock engine, and meal variety. Pure data + transforms only — no
   medical advice, no claims, no compound/supplement prescriptions.
   ════════════════════════════════════════════════════════════════════════ */

import type { GroceryCategory, QualityPreference, StoreKey } from "./grocery-engine";
import type { MacroRole, Meal, MealPurpose } from "./types";

export type SignatureMealPurpose =
  | "morning-anchor" | "pre-workout" | "post-workout" | "night-recovery" | "macro-rescue" | "custom";

/** Ingredient roles extend the macro roles with beverage/hydration/sweetener. */
export type SignatureIngredientRole = MacroRole | "beverage" | "hydration" | "sweetener";

export type IngredientMacros = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type SignatureIngredient = {
  id: string;
  name: string;
  amount?: number;
  unit?: string;              // g, oz, count, slice, scoop, tbsp, cup, ml, container
  role: SignatureIngredientRole;
  groceryCategory: GroceryCategory;
  brand?: string;
  store?: StoreKey;
  qualityPreference?: QualityPreference[];
  /** Optional per-ingredient macros. Missing macros → meal flagged "manual entry needed". */
  macros?: IngredientMacros;
};

export type SignatureMeal = {
  id: string;
  name: string;
  purpose: SignatureMealPurpose;
  ingredients: SignatureIngredient[];
  /** Member-entered totals override computed macros when manualMacros is true. */
  manualMacros: boolean;
  macros?: IngredientMacros | null;
  storePreference?: StoreKey;
  qualityPreference?: QualityPreference[];
  frequencyPerWeek: number;
  favorite: boolean;
  /** One-off placement into today's plan. */
  addedToday: boolean;
  /** Recurring placement (drives weekly grocery + restock). */
  inRotation: boolean;
  createdAt: string;
  lastUsedAt?: string;
  notes?: string;
};

export const SIGNATURE_PURPOSES: Array<{ key: SignatureMealPurpose; label: string }> = [
  { key: "morning-anchor", label: "Morning Protein Anchor" },
  { key: "pre-workout", label: "Pre-Workout" },
  { key: "post-workout", label: "Post-Workout" },
  { key: "night-recovery", label: "Night Recovery" },
  { key: "macro-rescue", label: "Macro Rescue" },
  { key: "custom", label: "Custom" },
];

export const SIGNATURE_INGREDIENT_ROLES: SignatureIngredientRole[] =
  ["protein", "carb", "fat", "produce", "sauce", "snack", "beverage", "hydration", "sweetener"];

/** Map a signature purpose onto a generated meal slot for plan placement. */
export const SIG_PURPOSE_TO_MEAL: Record<SignatureMealPurpose, MealPurpose> = {
  "morning-anchor": "morning-anchor",
  "pre-workout": "pre-workout",
  "post-workout": "post-workout",
  "night-recovery": "night-recovery",
  "macro-rescue": "snack",
  custom: "midday-meal",
};

/** Signature ingredient role → macro role for the meal-card food list. */
export function sigRoleToMacroRole(role: SignatureIngredientRole): MacroRole {
  if (role === "protein" || role === "carb" || role === "fat" || role === "produce" || role === "snack" || role === "sauce") return role;
  return "sauce"; // beverage / hydration / sweetener are flavor/utility on the card
}

const FOOD_ROLES: SignatureIngredientRole[] = ["protein", "carb", "fat", "produce", "snack"];

/**
 * Compute a signature meal's macros. Manual totals win when set. Otherwise we
 * sum per-ingredient macros. `complete` is false when a food-role ingredient
 * is missing macros (→ surface "Manual macro entry needed").
 */
export function computeSignatureMacros(meal: SignatureMeal): { macros: IngredientMacros; complete: boolean } {
  if (meal.manualMacros && meal.macros) {
    return { macros: meal.macros, complete: true };
  }
  const totals: IngredientMacros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  let any = false;
  for (const ing of meal.ingredients) {
    if (!ing.macros) continue;
    any = true;
    totals.calories += ing.macros.calories;
    totals.proteinG += ing.macros.proteinG;
    totals.carbsG += ing.macros.carbsG;
    totals.fatG += ing.macros.fatG;
  }
  const foodIngredients = meal.ingredients.filter((i) => FOOD_ROLES.includes(i.role));
  const complete = any && foodIngredients.length > 0 && foodIngredients.every((i) => !!i.macros);
  return {
    macros: {
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG),
      carbsG: Math.round(totals.carbsG),
      fatG: Math.round(totals.fatG),
    },
    complete,
  };
}

/** One-line ingredient summary for cards, e.g. "espresso · 3 eggs · sourdough · jam". */
export function signatureIngredientSummary(meal: SignatureMeal, max = 8): string {
  const names = meal.ingredients.map((i) => i.name);
  const shown = names.slice(0, max).join(" · ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/**
 * Project a saved signature meal onto a generated meal slot, preserving the
 * slot's id/time/status so logging still works. Presentation + foods + macros
 * come from the member's meal.
 */
export function applySignatureToMeal(meal: Meal, sig: SignatureMeal): Meal {
  const { macros } = computeSignatureMacros(sig);
  return {
    ...meal,
    dishName: sig.name,
    cookingStyle: "Signature",
    flavorProfile: "Personal",
    foods: sig.ingredients.map((ing, i) => ({
      role: sigRoleToMacroRole(ing.role),
      name: ing.name,
      foodId: `sig-${sig.id}-${i}`,
    })),
    macros,
    prepNote: `Your signature meal · used ${sig.frequencyPerWeek}×/week`,
  };
}
