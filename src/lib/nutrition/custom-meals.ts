/* ════════════════════════════════════════════════════════════════════════
   CUSTOM MEALS — member-authored meals with estimated macros.
   ------------------------------------------------------------------------
   Types + helpers for meals the member builds from their own ingredients
   (e.g. "ground beef + jasmine rice + cilantro + gold potatoes, pan-seared").
   Macros come from the deterministic ingredient estimator and are ALWAYS
   framed as estimates — never medical nutrition claims.
   ════════════════════════════════════════════════════════════════════════ */

import type { CookingMethod, MacroEstimate } from "./ingredient-estimator";

export type CustomMealIngredient = {
  id: string;
  name: string;
  /** Optional amount in grams; the estimator uses a typical portion if empty. */
  grams: number | null;
};

export type CustomMeal = {
  id: string;
  name: string;
  ingredients: CustomMealIngredient[];
  method: CookingMethod;
  servings: number;
  /** Estimated per-serving macros (recomputed on save). */
  est: MacroEstimate;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export function newCustomMealId(): string {
  return `cmeal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export function newIngredientId(): string {
  return `cing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
