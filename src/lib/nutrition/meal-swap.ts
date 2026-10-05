/* ════════════════════════════════════════════════════════════════════════
   MEAL SWAP — goal / timing / training-aware replacement suggestions.

   Food-based only. No medical, supplement, or dosage language. Suggests
   alternative whole-food meals that fit the same slot and goal, ranked by
   protein priority and macro similarity, preferring the member's favorites.
   ════════════════════════════════════════════════════════════════════════ */

import {
  anyMatch,
  FUEL_MEALS,
  ingredientsExcluded,
  type DetailedIngredient,
  type FuelGoal,
  type FuelMacros,
  type FuelMeal,
  type MealPersonalization,
  type MealSlot,
  type PlanFavoriteInput,
} from "./fuel-plan";

export type SwapOption = {
  id: string;
  name: string;
  fromFavorite: boolean;
  ingredients: string[];
  /** Optional weighted plate composition (premium display). Falls back to `ingredients`. */
  ingredientsDetailed?: DetailedIngredient[];
  macros: FuelMacros;
  prep: string[];
  covers: string[];
  /** Plain-language reason this swap fits. */
  reason: string;
  /** What the swap protects (protein, timing, etc.). */
  protects: string;
  /** Macro direction vs the current meal. */
  macroDirection: string;
};

export type MealSwapInput = {
  currentName: string;
  currentMacros: FuelMacros;
  slot: MealSlot;
  goal: FuelGoal;
  isTrainingDay: boolean;
  favorites?: PlanFavoriteInput[];
  /** Optional member preferences — excludes allergies, deprioritises dislikes, boosts favourites. */
  personalization?: MealPersonalization;
};

function macroDirection(from: FuelMacros, to: FuelMacros): string {
  const parts: string[] = [];
  const dp = to.proteinG - from.proteinG;
  const dc = to.carbsG - from.carbsG;
  const df = to.fatG - from.fatG;
  if (dp >= 4) parts.push("raises protein");
  else if (dp <= -4) parts.push("eases protein");
  else parts.push("keeps protein steady");
  if (dc >= 6) parts.push("more carbs");
  else if (dc <= -6) parts.push("fewer carbs");
  if (df >= 5) parts.push("more fat");
  else if (df <= -5) parts.push("lower fat");
  return parts.join(" · ");
}

/** Score a candidate against the current meal (higher = better fit). */
function score(candidate: FuelMeal, input: MealSwapInput): number {
  const p = input.personalization ?? {};
  let s = 0;
  if (candidate.goalFit.includes(input.goal)) s += 4;
  if (candidate.slot === input.slot) s += 3;
  // Macro similarity — reward closeness in protein, gentle on carbs/fat.
  s -= Math.abs(candidate.macros.proteinG - input.currentMacros.proteinG) * 0.15;
  s -= Math.abs(candidate.macros.carbsG - input.currentMacros.carbsG) * 0.05;
  // Training-day carb preference.
  if (input.isTrainingDay && candidate.macros.carbsG >= input.currentMacros.carbsG) s += 1;
  // Personalization boosts.
  if (p.favoriteProteinSources?.length && anyMatch(p.favoriteProteinSources, candidate.ingredients)) s += 3;
  if (p.favoriteCarbSources?.length && anyMatch(p.favoriteCarbSources, candidate.ingredients)) s += 2;
  // Soft penalty for disliked.
  if (p.dislikedFoods?.length && anyMatch(p.dislikedFoods, candidate.ingredients)) s -= 5;
  // Low-prep boost.
  if (p.prepPreference === "low-prep" && candidate.prep.some((pr) => /no-cook|assemble|portable/.test(pr))) s += 2;
  return s;
}

export function getMealSwaps(input: MealSwapInput, limit = 4): SwapOption[] {
  const p = input.personalization ?? {};
  const adjacent: Record<MealSlot, MealSlot[]> = {
    breakfast: ["breakfast", "snack"],
    "pre-workout": ["pre-workout", "snack", "breakfast"],
    lunch: ["lunch", "dinner"],
    "post-workout": ["post-workout", "lunch", "snack"],
    dinner: ["dinner", "lunch"],
    snack: ["snack", "pre-workout"],
  };
  const slots = adjacent[input.slot] ?? [input.slot];

  // Seed candidates — hard-exclude allergies, then sort by score.
  const seedOptions: SwapOption[] = FUEL_MEALS
    .filter((m) => {
      if (!slots.includes(m.slot)) return false;
      if (m.name === input.currentName) return false;
      // Hard exclude allergies ("shell fish" rules out shrimp), exclusions and Peak Mode's avoid list.
      if (ingredientsExcluded(m.ingredients, p)) return false;
      return true;
    })
    .map((m) => ({ meal: m, s: score(m, input) }))
    .sort((a, b) => b.s - a.s)
    .map(({ meal }) => {
      // Build a swap reason that reflects personalization.
      const isFavProtein = p.favoriteProteinSources?.length && anyMatch(p.favoriteProteinSources, meal.ingredients);
      const isFavCarb = p.favoriteCarbSources?.length && anyMatch(p.favoriteCarbSources, meal.ingredients);
      let reason = meal.goalFit.includes(input.goal)
        ? `Fits ${input.goal.replace("-", " ")} and the same meal window.`
        : "A solid same-window alternative.";
      if (isFavProtein || isFavCarb) reason = `Matches your preferred ${isFavProtein ? "protein" : "carb"} source. ${reason}`;
      return {
        id: meal.id,
        name: meal.name,
        fromFavorite: false,
        ingredients: meal.ingredients,
        ingredientsDetailed: meal.ingredientsDetailed,
        macros: meal.macros,
        prep: meal.prep,
        covers: meal.covers,
        reason,
        protects: input.slot === "pre-workout" ? "Pre-session carb timing"
          : input.slot === "post-workout" ? "Post-session protein + recovery"
            : "Protein distribution across the day",
        macroDirection: macroDirection(input.currentMacros, meal.macros),
      };
    });

  // Favorite candidates that fit the slot — exclude allergy matches.
  const favOptions: SwapOption[] = (input.favorites ?? [])
    .filter((f) => {
      if (f.slot !== input.slot || !f.macros || f.name === input.currentName) return false;
      if (f.ingredients?.length && ingredientsExcluded(f.ingredients, p)) return false;
      return true;
    })
    .map((f) => ({
      id: `fav-${f.id}`,
      name: f.name,
      fromFavorite: true,
      ingredients: f.ingredients ?? [],
      macros: f.macros as FuelMacros,
      prep: ["your recipe"],
      covers: ["protein"],
      reason: "From your favorites — a meal you already like in this window.",
      protects: "Consistency and adherence",
      macroDirection: macroDirection(input.currentMacros, f.macros as FuelMacros),
    }));

  return [...favOptions, ...seedOptions].slice(0, limit);
}
