/* ════════════════════════════════════════════════════════════════════════
   YOUR OWN BOWLS — the meal a member already eats every day, in their own
   words and their own ingredients.

   A bowl is a plate like any other once it is built: it scales to the meal's
   targets, it shows a match, it can be swapped in, and its foods land on the
   shopping list and in the night-before list. The difference is that Reserve
   did not choose it — the member did, so it is never hidden or rotated away.
   ════════════════════════════════════════════════════════════════════════ */

import type { IngredientGroup, MealSlot } from "./fuel-plan";
import { PEAK_FOODS, dialOf, type PeakFood, type PeakSignature } from "./peak-signatures";

export type BowlIngredient = { food: PeakFood; grams: number };

export type CustomBowl = {
  id: string;
  name: string;
  slot: MealSlot;
  ingredients: BowlIngredient[];
  createdAt: string;
};

export const BOWL_MAX_INGREDIENTS = 12;
export const BOWL_NAME_MAX = 48;
export const BOWL_GRAMS_MAX = 1_000;

/** Bowls are marked so a plate id always says where it came from. */
export const BOWL_PREFIX = "bowl:";

export function isBowlPlateId(id: string): boolean {
  return id.startsWith(BOWL_PREFIX);
}

/**
 * Where an ingredient sits on the plate, from what the food is: protein foods
 * on the protein dial, honey and fruit on the carb dial, oils and nuts on fat.
 * The member picks a food and a weight; Reserve works the rest out.
 */
export function groupFor(food: PeakFood): IngredientGroup {
  const dial = dialOf(food);
  if (dial === "protein") return "protein";
  if (dial === "fat") return "fat";
  const f = PEAK_FOODS[food];
  /* Light, watery foods read as produce; dense ones as a carb. */
  return f.kcal <= 90 ? "produce" : "carb";
}

export type BowlProblem = "no-name" | "no-ingredients" | "too-many" | "bad-weight" | "duplicate";

/** What is wrong with a bowl, or nothing. The builder shows this before it saves. */
export function bowlProblem(draft: { name: string; ingredients: BowlIngredient[] }): BowlProblem | null {
  if (draft.name.trim().length === 0) return "no-name";
  if (draft.ingredients.length === 0) return "no-ingredients";
  if (draft.ingredients.length > BOWL_MAX_INGREDIENTS) return "too-many";
  if (draft.ingredients.some((i) => !Number.isFinite(i.grams) || i.grams <= 0 || i.grams > BOWL_GRAMS_MAX)) return "bad-weight";
  if (new Set(draft.ingredients.map((i) => i.food)).size !== draft.ingredients.length) return "duplicate";
  return null;
}

export const BOWL_PROBLEM_TEXT: Record<BowlProblem, string> = {
  "no-name": "Give the bowl a name.",
  "no-ingredients": "Add at least one ingredient.",
  "too-many": `A bowl holds up to ${BOWL_MAX_INGREDIENTS} ingredients.`,
  "bad-weight": `Every ingredient needs a weight between 1 and ${BOWL_GRAMS_MAX} g.`,
  duplicate: "That ingredient is already in the bowl — change its weight instead.",
};

/**
 * The bowl as a plate. Everything downstream — scaling, macros, recipes, the
 * shopping list, the night-before list — reads plates, so a bowl gets all of
 * it for free.
 */
export function bowlToSignature(bowl: CustomBowl): PeakSignature {
  return {
    id: `${BOWL_PREFIX}${bowl.id}`,
    name: bowl.name.trim(),
    slot: bowl.slot,
    looks: ["lean-hard", "full-hard", "recomp"],
    portions: bowl.ingredients.map((i) => ({ food: i.food, grams: Math.round(i.grams), group: groupFor(i.food) })),
    fits: {},
    smartRead: "Your own bowl. Reserve scales the weights to this meal's targets and leaves the ingredients alone.",
  };
}

/** The member's bowls for one slot, as plates, newest first. */
export function bowlsForSlot(bowls: readonly CustomBowl[], slot: MealSlot): PeakSignature[] {
  return bowls.filter((b) => b.slot === slot).map(bowlToSignature).reverse();
}

/**
 * Where a new build starts, by meal: a lunch or dinner opens with a protein,
 * a carb and a vegetable; a breakfast or a snack opens as a bowl. It is only
 * a starting point — every row can be changed or removed.
 */
export const BOWL_STARTERS: Record<MealSlot, BowlIngredient[]> = {
  breakfast: [{ food: "cream of rice (dry)", grams: 55 }, { food: "whey isolate", grams: 35 }, { food: "banana", grams: 100 }],
  "pre-workout": [{ food: "rice cakes", grams: 27 }, { food: "banana", grams: 100 }, { food: "honey", grams: 10 }],
  "post-workout": [{ food: "cream of rice (dry)", grams: 60 }, { food: "whey isolate", grams: 40 }, { food: "banana", grams: 120 }],
  lunch: [{ food: "chicken breast", grams: 200 }, { food: "jasmine rice", grams: 250 }, { food: "broccoli", grams: 150 }],
  dinner: [{ food: "top sirloin, trimmed", grams: 200 }, { food: "sweet potato", grams: 250 }, { food: "asparagus", grams: 150 }],
  snack: [{ food: "nonfat Greek yogurt", grams: 200 }, { food: "blueberries", grams: 80 }],
};

/** A new bowl's id: stable, sortable and readable in a saved record. */
export function newBowlId(now: Date = new Date()): string {
  return `b${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
