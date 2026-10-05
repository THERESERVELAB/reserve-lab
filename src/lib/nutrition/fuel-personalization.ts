/* ════════════════════════════════════════════════════════════════════════
   FUEL PERSONALIZATION — the member's food preferences, read one way.

   Nutrition, Apex, Schedule and Prep all build today's fuel plan. A meal's id
   carries the plate, so if any two of them read the preferences differently
   they build different plates and a meal logged on one never ticks on the
   other. They all read this.
   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { NutritionPrefsState } from "@/lib/athlete-store";

import type { MealPersonalization } from "./fuel-plan";
import { isPeakLook } from "./peak-mode";

type Prefs = Pick<
  NutritionPrefsState,
  | "dislikedFoods" | "allergies" | "excludedFoods" | "favoriteProteinSources" | "favoriteCarbSources"
  | "prepPreference" | "cookingEquipment" | "dietStyle" | "dairyAllowed" | "peakLook" | "peakKitchen"
>;

export function personalizationFromPrefs(prefs: Prefs): MealPersonalization {
  /* Peak Mode's kitchen answers count only while Peak Mode is on. */
  const kitchen = isPeakLook(prefs.peakLook) && prefs.peakKitchen
    ? { proteins: [...prefs.peakKitchen.proteins], carbs: [...prefs.peakKitchen.carbs], avoid: [...prefs.peakKitchen.avoid] }
    : null;
  return {
    dislikedFoods: prefs.dislikedFoods,
    allergies: prefs.allergies,
    excludedFoods: prefs.excludedFoods ?? [],
    favoriteProteinSources: prefs.favoriteProteinSources ?? [],
    favoriteCarbSources: prefs.favoriteCarbSources ?? [],
    prepPreference: prefs.prepPreference ?? "cook-fresh",
    cookingEquipment: prefs.cookingEquipment ?? [],
    dietStyle: prefs.dietStyle || "standard",
    dairyAllowed: prefs.dairyAllowed !== false,
    kitchen,
  };
}
