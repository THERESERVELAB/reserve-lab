/* ════════════════════════════════════════════════════════════════════════
   MEAL PLAN PRESETS — a starting point a member can load and then own.
   ------------------------------------------------------------------------
   A preset is food: meals, amounts and the member's own meal order. Loading
   one copies it into the member's plans with fresh ids, so editing it after
   never touches the preset and the preset never edits them back.

   A preset carries NO supplement, compound or dosage content. Supplements
   are added by the member through Support Stack, in their own words and
   their own amounts — Reserve does not ship what anyone should take.
   ════════════════════════════════════════════════════════════════════════ */

import type { IngredientGroup, MealSlot } from "./fuel-plan";
import {
  newMealPlanId,
  newPlanItemId,
  newPlanMealId,
  type MemberMealPlan,
  type MemberPlanMeal,
  type PlanWeighIn,
} from "./member-meal-plan";

/** A preset's item, before it is given ids. */
type PresetItem = [name: string, display: string, grams: number | null, group: IngredientGroup];

type PresetMeal = {
  name: string;
  slot: MealSlot;
  items: PresetItem[];
  note?: string;
  optional?: boolean;
};

export type MealPlanPreset = {
  key: string;
  name: string;
  /** One line describing the shape of the plan — never a claim about results. */
  summary: string;
  weighIn: PlanWeighIn;
  trainingDay: PresetMeal[];
  restDay: PresetMeal[];
  /** A water target the plan carries, in fluid ounces. Applied only if the member says so. */
  waterTargetOz?: number;
  /** How the water target reads in the apply sheet. */
  waterNote?: string;
};

/* ─── Five Meal Standard ──────────────────────────────────────────────────
   A five-meal day built on egg whites, lean ground meat, white rice and
   potatoes, with the pre-workout meal an hour out from the session and the
   post-workout meal after it. The rest day drops the rice from the second
   meal and moves the volume into the last meal. */
const FIVE_MEAL_STANDARD: MealPlanPreset = {
  key: "five-meal-standard",
  name: "Five Meal Standard",
  summary: "Five meals a day — egg whites, lean ground meat, white rice and potatoes, with the day built around the session.",
  weighIn: "cooked",
  waterTargetOz: 168,
  waterNote: "About 5 litres a day, and a full bottle before training.",
  trainingDay: [
    {
      name: "Meal 1",
      slot: "breakfast",
      items: [
        ["Egg Whites", "230g", 230, "protein"],
        ["Whole Eggs", "2 whole", 100, "protein"],
        ["Avocado Oil", "7g", 7, "fat"],
        ["Veggies", "50g", 50, "produce"],
      ],
    },
    {
      name: "Meal 2",
      slot: "lunch",
      items: [
        ["93/7 Ground Turkey", "150g", 150, "protein"],
        ["White Rice", "75g", 75, "carb"],
        ["Veggies", "50g", 50, "produce"],
      ],
      note: "Ground chicken works the same here.",
    },
    {
      name: "Meal 3",
      slot: "lunch",
      items: [
        ["93/7 Ground Turkey", "150g", 150, "protein"],
        ["White Rice", "50g", 50, "carb"],
        ["Veggies", "50g", 50, "produce"],
      ],
      note: "Ground chicken works the same here.",
    },
    {
      name: "Meal 4",
      slot: "pre-workout",
      items: [
        ["Cream of Rice", "40g", 40, "carb"],
        ["Whey Isolate", "45g", 45, "protein"],
        ["Banana", "40g", 40, "produce"],
        ["Frozen Berries", "25g", 25, "produce"],
        ["Nut Butter", "10g", 10, "fat"],
      ],
      note: "An hour before training.",
    },
    {
      name: "Intra-Workout",
      slot: "snack",
      items: [["EAAs", "1 scoop", 12, "finish"]],
      note: "During the session.",
      optional: true,
    },
    {
      name: "Meal 5",
      slot: "post-workout",
      items: [
        ["93/7 Ground Beef", "150g", 150, "protein"],
        ["Potatoes", "120g", 120, "carb"],
        ["Veggies", "50g", 50, "produce"],
      ],
    },
  ],
  restDay: [
    {
      name: "Meal 1",
      slot: "breakfast",
      items: [
        ["Egg Whites", "230g", 230, "protein"],
        ["Whole Eggs", "2 whole", 100, "protein"],
        ["Avocado Oil", "7g", 7, "fat"],
        ["Veggies", "50g", 50, "produce"],
      ],
    },
    {
      name: "Meal 2",
      slot: "lunch",
      items: [
        ["93/7 Ground Turkey", "150g", 150, "protein"],
        ["Veggies", "50g", 50, "produce"],
      ],
      note: "No rice on a rest day. Ground chicken works the same here.",
    },
    {
      name: "Meal 3",
      slot: "lunch",
      items: [
        ["93/7 Ground Turkey", "150g", 150, "protein"],
        ["White Rice", "50g", 50, "carb"],
        ["Veggies", "50g", 50, "produce"],
      ],
      note: "Ground chicken works the same here.",
    },
    {
      name: "Meal 4",
      slot: "lunch",
      items: [
        ["Cream of Rice", "30g", 30, "carb"],
        ["Whey Isolate", "45g", 45, "protein"],
        ["Banana", "40g", 40, "produce"],
        ["Frozen Berries", "25g", 25, "produce"],
        ["Nut Butter", "10g", 10, "fat"],
      ],
    },
    {
      name: "Meal 5",
      slot: "dinner",
      items: [
        ["93/7 Ground Beef", "175g", 175, "protein"],
        ["Potatoes", "75g", 75, "carb"],
        ["Veggies", "50g", 50, "produce"],
      ],
    },
  ],
};

/* ─── Lean Phase (cut / lean direction) ───────────────────────────────────
   Four meals, protein anchored, carbs kept around training and pulled tighter
   on the rest day. A leaner visual direction — food only, amounts are yours. */
const LEAN_PHASE: MealPlanPreset = {
  key: "lean-phase",
  name: "Lean Phase",
  summary: "Four protein-anchored meals with carbs kept around training and tighter on rest days — built to support a leaner visual direction.",
  weighIn: "cooked",
  waterTargetOz: 160,
  waterNote: "About 4.7 litres a day, and a full bottle before training.",
  trainingDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "250g", 250, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Veggies", "80g", 80, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Turkey", "170g", 170, "protein"], ["White Rice", "60g", 60, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "pre-workout", items: [["Chicken Breast", "170g", 170, "protein"], ["Potatoes", "120g", 120, "carb"], ["Green Beans", "100g", 100, "produce"]], note: "About an hour before training." },
    { name: "Meal 4", slot: "post-workout", items: [["White Fish (Cod)", "200g", 200, "protein"], ["White Rice", "60g", 60, "carb"], ["Broccoli", "150g", 150, "produce"]] },
  ],
  restDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "250g", 250, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Veggies", "80g", 80, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Turkey", "170g", 170, "protein"], ["Veggies", "150g", 150, "produce"]], note: "No rice on a rest day." },
    { name: "Meal 3", slot: "lunch", items: [["Chicken Breast", "170g", 170, "protein"], ["Potatoes", "80g", 80, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 4", slot: "dinner", items: [["White Fish (Cod)", "200g", 200, "protein"], ["Broccoli", "150g", 150, "produce"], ["Avocado", "40g", 40, "fat"]] },
  ],
};

/* ─── Recomp (near maintenance) ────────────────────────────────────────────
   Five meals, protein anchored, carbs around training, a small step down on
   the rest day — built to support a gradual composition trend. */
const RECOMP: MealPlanPreset = {
  key: "recomp",
  name: "Recomp",
  summary: "Five meals near maintenance — protein anchored, carbs placed around training — built to support a gradual composition trend.",
  weighIn: "cooked",
  waterTargetOz: 168,
  waterNote: "About 5 litres a day, and a full bottle before training.",
  trainingDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "200g", 200, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Sourdough", "60g", 60, "carb"], ["Veggies", "60g", 60, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Turkey", "170g", 170, "protein"], ["White Rice", "90g", 90, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "lunch", items: [["Chicken Breast", "170g", 170, "protein"], ["Potatoes", "150g", 150, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 4", slot: "pre-workout", items: [["Cream of Rice", "40g", 40, "carb"], ["Whey Isolate", "40g", 40, "protein"], ["Banana", "100g", 100, "produce"]], note: "About an hour before training." },
    { name: "Meal 5", slot: "post-workout", items: [["93/7 Ground Beef", "170g", 170, "protein"], ["White Rice", "90g", 90, "carb"], ["Broccoli", "150g", 150, "produce"]] },
  ],
  restDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "200g", 200, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Veggies", "80g", 80, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Turkey", "170g", 170, "protein"], ["White Rice", "60g", 60, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "lunch", items: [["Chicken Breast", "170g", 170, "protein"], ["Potatoes", "120g", 120, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 4", slot: "snack", items: [["Greek Yogurt", "200g", 200, "protein"], ["Berries", "100g", 100, "produce"], ["Almonds", "20g", 20, "fat"]] },
    { name: "Meal 5", slot: "dinner", items: [["93/7 Ground Beef", "170g", 170, "protein"], ["Potatoes", "100g", 100, "carb"], ["Broccoli", "150g", 150, "produce"]] },
  ],
};

/* ─── Growth (lean gain) ───────────────────────────────────────────────────
   Six meals, carbs increased around priority sessions and eased back a little
   on the rest day — built to support progressive training and recovery. */
const GROWTH: MealPlanPreset = {
  key: "growth",
  name: "Growth",
  summary: "Six meals with carbs increased around priority sessions — built to support progressive lower-body and full-body training with recovery protected.",
  weighIn: "cooked",
  waterTargetOz: 180,
  waterNote: "About 5.3 litres a day, and a full bottle before training.",
  trainingDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Whole Eggs", "3 whole", 150, "protein"], ["Egg Whites", "150g", 150, "protein"], ["Oats", "80g", 80, "carb"], ["Banana", "100g", 100, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Beef", "170g", 170, "protein"], ["White Rice", "150g", 150, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "lunch", items: [["Chicken Breast", "200g", 200, "protein"], ["Potatoes", "200g", 200, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 4", slot: "pre-workout", items: [["Cream of Rice", "60g", 60, "carb"], ["Whey Isolate", "40g", 40, "protein"], ["Banana", "120g", 120, "produce"], ["Nut Butter", "15g", 15, "fat"]], note: "About an hour before training." },
    { name: "Meal 5", slot: "post-workout", items: [["93/7 Ground Turkey", "200g", 200, "protein"], ["White Rice", "200g", 200, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 6", slot: "dinner", items: [["Salmon", "170g", 170, "protein"], ["Sweet Potato", "200g", 200, "carb"], ["Asparagus", "130g", 130, "produce"]] },
  ],
  restDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Whole Eggs", "3 whole", 150, "protein"], ["Egg Whites", "150g", 150, "protein"], ["Oats", "60g", 60, "carb"], ["Berries", "100g", 100, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["93/7 Ground Beef", "170g", 170, "protein"], ["White Rice", "120g", 120, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "lunch", items: [["Chicken Breast", "200g", 200, "protein"], ["Potatoes", "150g", 150, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 4", slot: "snack", items: [["Greek Yogurt", "250g", 250, "protein"], ["Banana", "100g", 100, "produce"], ["Nut Butter", "15g", 15, "fat"]] },
    { name: "Meal 5", slot: "lunch", items: [["93/7 Ground Turkey", "200g", 200, "protein"], ["White Rice", "120g", 120, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 6", slot: "dinner", items: [["Salmon", "170g", 170, "protein"], ["Sweet Potato", "150g", 150, "carb"], ["Asparagus", "130g", 130, "produce"]] },
  ],
};

/* ─── Performance Hybrid ───────────────────────────────────────────────────
   Five meals with carbs matched to combined training and conditioning load,
   eased on the rest day — built to support output and recovery across a
   mixed-activity week. */
const PERFORMANCE_HYBRID: MealPlanPreset = {
  key: "performance-hybrid",
  name: "Performance Hybrid",
  summary: "Five meals with carbs matched to training and conditioning load — built to support output and recovery across a mixed-activity week.",
  weighIn: "cooked",
  waterTargetOz: 180,
  waterNote: "About 5.3 litres a day, more on heavy conditioning days.",
  trainingDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "200g", 200, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Oats", "60g", 60, "carb"], ["Berries", "100g", 100, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["Chicken Breast", "200g", 200, "protein"], ["White Rice", "120g", 120, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "pre-workout", items: [["Cream of Rice", "50g", 50, "carb"], ["Whey Isolate", "40g", 40, "protein"], ["Banana", "120g", 120, "produce"]], note: "About an hour before training or conditioning." },
    { name: "Meal 4", slot: "post-workout", items: [["93/7 Ground Beef", "170g", 170, "protein"], ["Potatoes", "200g", 200, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 5", slot: "dinner", items: [["Salmon", "170g", 170, "protein"], ["Quinoa", "180g", 180, "carb"], ["Asparagus", "130g", 130, "produce"]] },
  ],
  restDay: [
    { name: "Meal 1", slot: "breakfast", items: [["Egg Whites", "200g", 200, "protein"], ["Whole Eggs", "2 whole", 100, "protein"], ["Sourdough", "60g", 60, "carb"], ["Veggies", "60g", 60, "produce"]] },
    { name: "Meal 2", slot: "lunch", items: [["Chicken Breast", "200g", 200, "protein"], ["White Rice", "90g", 90, "carb"], ["Veggies", "100g", 100, "produce"]] },
    { name: "Meal 3", slot: "snack", items: [["Greek Yogurt", "200g", 200, "protein"], ["Berries", "100g", 100, "produce"], ["Almonds", "20g", 20, "fat"]] },
    { name: "Meal 4", slot: "lunch", items: [["93/7 Ground Turkey", "170g", 170, "protein"], ["Potatoes", "120g", 120, "carb"], ["Green Beans", "100g", 100, "produce"]] },
    { name: "Meal 5", slot: "dinner", items: [["White Fish (Cod)", "200g", 200, "protein"], ["Quinoa", "150g", 150, "carb"], ["Broccoli", "150g", 150, "produce"]] },
  ],
};

/* Five Meal Standard stays first as the base; the goal presets follow it. */
export const MEAL_PLAN_PRESETS: MealPlanPreset[] = [
  FIVE_MEAL_STANDARD,
  LEAN_PHASE,
  RECOMP,
  GROWTH,
  PERFORMANCE_HYBRID,
];

export function mealPlanPresetByKey(key: string): MealPlanPreset | undefined {
  return MEAL_PLAN_PRESETS.find((p) => p.key === key);
}

function materializeMeals(meals: readonly PresetMeal[], seed: number): MemberPlanMeal[] {
  return meals.map((m, order) => ({
    id: `${newPlanMealId()}-${seed}-${order}`,
    name: m.name,
    slot: m.slot,
    order,
    note: m.note,
    optional: m.optional,
    items: m.items.map(([name, display, grams, group]) => ({
      id: newPlanItemId(),
      name,
      display,
      grams,
      group,
    })),
  }));
}

/**
 * Copy a preset into a plan the member owns. Fresh ids throughout, so editing
 * the result never reaches back into the preset.
 */
export function mealPlanFromPreset(preset: MealPlanPreset, at: Date = new Date()): MemberMealPlan {
  const now = at.toISOString();
  return {
    id: newMealPlanId(),
    name: preset.name,
    weighIn: preset.weighIn,
    trainingDay: materializeMeals(preset.trainingDay, 1),
    restDay: materializeMeals(preset.restDay, 2),
    createdAt: now,
    updatedAt: now,
  };
}
