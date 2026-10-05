/* ════════════════════════════════════════════════════════════════════════
   FUEL PLAN — schedule + training-aware daily / weekly meal intelligence.

   Food-based planning only. Estimates are clearly labelled as estimates. No
   medical claims, no supplement/dosage guidance, no lab interpretation. The
   plan adapts to the active goal, today's training vs recovery status, and the
   member's meal-timing windows. Pure data + deterministic helpers.
   ════════════════════════════════════════════════════════════════════════ */

export type FuelGoal = "shred" | "lean-bulk" | "recomp" | "performance" | "maintenance";

export const FUEL_GOAL_LABEL: Record<FuelGoal, string> = {
  shred: "Shred / Cut",
  "lean-bulk": "Lean Bulk",
  recomp: "Recomp",
  performance: "Performance",
  maintenance: "Maintenance",
};

import { avoidKeyTags, ingredientTags, ingredientsHitAllergy } from "./food-matcher";
import type { MacroTargets } from "./types";
import { dayIndexOfDate, parsePlateId, planDayPlates, resolveKitchen, type ComposedPlate, type RotationSlot } from "./plate-rotation";
import { buildPreWorkoutShake, type PreWorkoutShakeStyle } from "./pre-workout-shake";

/* ─── Local time helpers (self-contained, no schedule-engine import needed) ── */
export function hhmToMins(t: string | null | undefined): number | null {
  if (!t || t === "—") return null;
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function minsToHHMM(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Map any free-text goal to a fuel goal. */
export function fuelGoalFromString(goal: string | undefined | null): FuelGoal {
  const g = (goal ?? "").toLowerCase();
  if (/cut|shred|lean out|fat loss|lose/.test(g)) return "shred";
  if (/bulk|mass|size|gain/.test(g)) return "lean-bulk";
  if (/recomp/.test(g)) return "recomp";
  if (/perform|strength|athlet|power/.test(g)) return "performance";
  return "maintenance";
}

export type FuelMacros = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type MealSlot = "breakfast" | "pre-workout" | "lunch" | "post-workout" | "dinner" | "snack";

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  "pre-workout": "Pre-Workout",
  lunch: "Lunch",
  "post-workout": "Post-Workout",
  dinner: "Dinner",
  snack: "Snack",
};

/** Protein source group for same-day variety rotation — prevents the same source at every meal. */
export type ProteinGroup = "beef" | "poultry" | "fish-seafood" | "egg" | "dairy";

/** Plate composition role — drives the grouped premium card layout. */
export type IngredientGroup = "protein" | "carb" | "produce" | "fat" | "finish";

/**
 * Weighted ingredient for premium plate display. Backward-compatible add-on —
 * the legacy `ingredients: string[]` field stays the source of truth for
 * favorites, swaps, logging, and saved configs. Weights are cooked unless the
 * `note` says otherwise.
 */
export type DetailedIngredient = {
  name: string;
  /** Display amount, e.g. "170g", "2 slices", "10g". */
  amount: string;
  group?: IngredientGroup;
  note?: string;
};

/** Helper copy — shown beside weighted plates and macro estimates. */
export const WEIGHT_NOTE = "Weights shown cooked unless noted.";
export const MACRO_ESTIMATE_NOTE = "Macros are planning estimates.";

export type FuelMeal = {
  id: string;
  name: string;
  slot: MealSlot;
  goalFit: FuelGoal[];
  ingredients: string[];
  /** Optional weighted plate composition (premium display). Falls back to `ingredients`. */
  ingredientsDetailed?: DetailedIngredient[];
  macros: FuelMacros;
  prep: string[];
  /** Food-coverage tags this meal contributes to (keys from micronutrient-coverage). */
  covers: string[];
  smartRead: string;
  /** Protein source group for same-day variety rotation. */
  proteinGroup?: ProteinGroup;
  /**
   * Higher-fat / heavier plates (e.g. ribeye) — deprioritised when a meal would
   * land near the sleep window, so the engine never serves a heavy late-night
   * steak. Still selectable for earlier slots.
   */
  avoidLateEvening?: boolean;
};

/** Group ordering for plate composition rows. */
export const INGREDIENT_GROUP_ORDER: IngredientGroup[] = ["protein", "carb", "produce", "fat", "finish"];

export const INGREDIENT_GROUP_LABEL: Record<IngredientGroup, string> = {
  protein: "Protein",
  carb: "Carb",
  produce: "Produce",
  fat: "Fat",
  finish: "Finish",
};

/**
 * Build a short one-line composition string from weighted ingredients, e.g.
 * "170g wild salmon · jasmine rice · asparagus". Leads with protein + carb,
 * keeps it compact for tight surfaces (Apex). Falls back to the string list.
 */
export function shortComposition(
  detailed: DetailedIngredient[] | undefined,
  fallback: string[],
  max = 3,
): string {
  if (!detailed || detailed.length === 0) return fallback.slice(0, max).join(" · ");
  const lead = [
    ...detailed.filter((d) => d.group === "protein"),
    ...detailed.filter((d) => d.group === "carb"),
    ...detailed.filter((d) => d.group === "produce"),
    ...detailed.filter((d) => !["protein", "carb", "produce"].includes(d.group ?? "")),
  ].slice(0, max);
  return lead
    .map((d, i) => (i === 0 ? `${d.amount} ${d.name}` : d.name))
    .join(" · ");
}

/** Group weighted ingredients into ordered composition rows for the plate layout. */
export function plateComposition(
  detailed: DetailedIngredient[] | undefined,
): { group: IngredientGroup; items: DetailedIngredient[] }[] {
  if (!detailed || detailed.length === 0) return [];
  return INGREDIENT_GROUP_ORDER
    .map((group) => ({ group, items: detailed.filter((d) => (d.group ?? "finish") === group) }))
    .filter((row) => row.items.length > 0);
}

/* ─── Premium seed meal library (food-based, brand-neutral) ───────────────── */
export const FUEL_MEALS: FuelMeal[] = [

  /* ── BREAKFAST ──────────────────────────────────────────────────────────── */
  {
    id: "reserve-breakfast-plate",
    name: "Reserve Performance Breakfast Plate",
    slot: "breakfast",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["3 pasture-raised whole eggs", "120g egg whites", "2 slices sourdough toast", "natural fruit spread", "mixed berries"],
    ingredientsDetailed: [
      { name: "pasture-raised whole eggs", amount: "3", group: "protein" },
      { name: "egg whites", amount: "120g", group: "protein" },
      { name: "sourdough toast", amount: "2 slices, 90g", group: "carb" },
      { name: "mixed berries", amount: "80g", group: "produce" },
      { name: "natural fruit spread", amount: "15g", group: "finish" },
    ],
    macros: { calories: 520, proteinG: 44, carbsG: 50, fatG: 16 },
    prep: ["non-stick", "stovetop", "soft-scramble"],
    covers: ["vitamin-c", "protein", "fruit-veg", "iron"],
    proteinGroup: "egg",
    smartRead: "Pasture-raised eggs anchor the morning with complete protein and iron food coverage. Sourdough and berries add steady carbs and vitamin C without loading fat. A reliable high-protein start on any day of the week.",
  },
  {
    id: "steak-egg-performance-plate",
    name: "Sirloin & Egg Morning Plate",
    slot: "breakfast",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["4oz top sirloin", "2 pasture-raised whole eggs", "roasted golden potatoes", "wilted baby spinach", "garlic olive oil", "sea salt"],
    ingredientsDetailed: [
      { name: "top sirloin", amount: "115g", group: "protein" },
      { name: "pasture-raised whole eggs", amount: "2", group: "protein" },
      { name: "roasted golden potatoes", amount: "180g", group: "carb" },
      { name: "baby spinach", amount: "60g", group: "produce" },
      { name: "garlic olive oil", amount: "10g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 620, proteinG: 52, carbsG: 42, fatG: 24 },
    prep: ["grilled", "pan-seared", "air fryer", "oven"],
    covers: ["iron", "zinc", "protein", "folate", "potassium"],
    proteinGroup: "beef",
    smartRead: "Sirloin and eggs together deliver iron, zinc, and a complete protein base with the potassium-rich carb load needed before a heavy day. Spinach adds folate food coverage without adding bulk.",
  },
  {
    id: "greek-yogurt-power-bowl",
    name: "Greek Yogurt Protein Bowl",
    slot: "breakfast",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["1.5 cups 2% Greek yogurt", "mixed berries", "honey drizzle", "chia seeds", "sliced almonds"],
    ingredientsDetailed: [
      { name: "2% Greek yogurt", amount: "250g", group: "protein" },
      { name: "mixed berries", amount: "80g", group: "produce" },
      { name: "chia seeds", amount: "10g", group: "fat" },
      { name: "sliced almonds", amount: "15g", group: "fat" },
      { name: "honey drizzle", amount: "10g", group: "finish" },
    ],
    macros: { calories: 390, proteinG: 35, carbsG: 44, fatG: 10 },
    prep: ["no-cook", "assemble"],
    covers: ["calcium", "fiber", "fruit-veg", "omega-3", "protein"],
    proteinGroup: "dairy",
    smartRead: "Fast no-cook calcium and protein with fruit and omega-3 seed coverage. Keeps morning prep to zero and positions the day with a clean protein anchor and fiber from the berries.",
  },
  {
    id: "egg-white-veggie-scramble",
    name: "Egg White Scramble & Sourdough Toast",
    slot: "breakfast",
    goalFit: ["shred", "recomp"],
    ingredients: ["5 egg whites", "2 whole eggs", "roasted red peppers", "baby spinach", "1 slice sourdough toast", "sea salt"],
    ingredientsDetailed: [
      { name: "egg whites", amount: "165g", group: "protein" },
      { name: "whole eggs", amount: "2", group: "protein" },
      { name: "sourdough toast", amount: "1 slice, 45g", group: "carb" },
      { name: "roasted red peppers", amount: "70g", group: "produce" },
      { name: "baby spinach", amount: "50g", group: "produce" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 420, proteinG: 42, carbsG: 32, fatG: 12 },
    prep: ["non-stick", "stovetop", "soft-scramble"],
    covers: ["protein", "vitamin-c", "folate", "fruit-veg"],
    proteinGroup: "egg",
    smartRead: "High egg-white volume keeps calories controlled while protecting protein on a cut. Roasted peppers add vitamin C food coverage and color without fat — ideal when the goal is lean output.",
  },
  {
    id: "cream-of-rice-morning-build",
    name: "Cream of Rice Morning Build",
    slot: "breakfast",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["cream of rice", "150g egg whites", "banana", "cinnamon", "honey", "sea salt"],
    ingredientsDetailed: [
      { name: "cream of rice", amount: "240g", group: "carb", note: "cooked from ~50g dry" },
      { name: "egg whites", amount: "150g", group: "protein" },
      { name: "banana", amount: "120g", group: "produce" },
      { name: "honey", amount: "10g", group: "finish" },
      { name: "cinnamon", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 450, proteinG: 30, carbsG: 72, fatG: 3 },
    prep: ["stovetop", "microwave"],
    covers: ["potassium", "protein"],
    proteinGroup: "egg",
    smartRead: "Carb-forward breakfast that places glycogen ahead of a demanding day. Egg whites keep protein present without adding fat. Easy to prep and digest — leaves room to eat clean before an evening session.",
  },

  /* ── PRE-WORKOUT ────────────────────────────────────────────────────────── */
  {
    id: "cream-of-rice-training-bowl",
    name: "Cream of Rice Pre-Session Bowl",
    slot: "pre-workout",
    goalFit: ["lean-bulk", "performance", "recomp"],
    ingredients: ["cream of rice", "banana", "honey", "120g egg whites", "pinch of sea salt"],
    ingredientsDetailed: [
      { name: "cream of rice", amount: "240g", group: "carb", note: "cooked from ~50g dry" },
      { name: "egg whites", amount: "120g", group: "protein" },
      { name: "banana", amount: "120g", group: "produce" },
      { name: "honey", amount: "10g", group: "finish" },
      { name: "sea salt", amount: "pinch", group: "finish" },
    ],
    macros: { calories: 430, proteinG: 32, carbsG: 70, fatG: 3 },
    prep: ["stovetop", "microwave"],
    covers: ["potassium", "protein"],
    proteinGroup: "egg",
    smartRead: "Easy-digesting carbs and light protein placed 60–90 minutes before the session. Banana potassium and rice starch fuel the first working sets without sitting heavy.",
  },
  {
    id: "rice-cake-banana-pre-fuel",
    name: "Rice Cake & Banana Pre-Fuel",
    slot: "pre-workout",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["3 rice cakes", "banana", "1 tbsp almond butter", "sea salt"],
    ingredientsDetailed: [
      { name: "rice cakes", amount: "3 cakes, 27g", group: "carb" },
      { name: "banana", amount: "120g", group: "produce" },
      { name: "almond butter", amount: "16g", group: "fat" },
      { name: "sea salt", amount: "pinch", group: "finish" },
    ],
    macros: { calories: 360, proteinG: 8, carbsG: 60, fatG: 9 },
    prep: ["no-cook", "assemble"],
    covers: ["potassium", "magnesium", "fruit-veg"],
    smartRead: "Lowest-prep pre-session carb option — fast-digesting rice and banana with a small amount of fat from almond butter to slow the glucose curve slightly. Easy on the stomach in the last 30 minutes before a session.",
  },
  {
    id: "sweet-potato-chicken-preworkout",
    name: "Sweet Potato & Chicken Pre-Workout Plate",
    slot: "pre-workout",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["5oz air-fried chicken breast", "baked sweet potato", "mixed greens", "olive oil", "sea salt"],
    ingredientsDetailed: [
      { name: "air-fried chicken breast", amount: "140g", group: "protein" },
      { name: "baked sweet potato", amount: "180g", group: "carb" },
      { name: "mixed greens", amount: "60g", group: "produce" },
      { name: "olive oil", amount: "10g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 480, proteinG: 44, carbsG: 52, fatG: 8 },
    prep: ["air fryer", "baked", "oven"],
    covers: ["protein", "potassium", "vitamin-c", "folate"],
    proteinGroup: "poultry",
    smartRead: "Chicken and sweet potato deliver the protein-carb combination for a demanding session — best placed 90 minutes out for full digestion. A filling but not heavy plate that supports high-output lifting.",
  },

  /* ── LUNCH ──────────────────────────────────────────────────────────────── */
  {
    id: "lean-ground-beef-bowl",
    name: "Grass-Fed Beef Performance Bowl",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["93/7 grass-fed ground beef", "jasmine rice", "black beans", "roasted bell peppers", "pico de gallo", "avocado lime crema"],
    ingredientsDetailed: [
      { name: "93/7 grass-fed ground beef", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "black beans", amount: "80g", group: "carb" },
      { name: "roasted bell peppers", amount: "75g", group: "produce" },
      { name: "avocado", amount: "40g", group: "fat" },
      { name: "pico de gallo", amount: "30g", group: "finish" },
      { name: "avocado lime crema", amount: "20g", group: "finish" },
    ],
    macros: { calories: 590, proteinG: 50, carbsG: 58, fatG: 18 },
    prep: ["skillet", "stovetop", "meal-prep"],
    covers: ["iron", "zinc", "fiber", "vitamin-c", "protein", "magnesium"],
    proteinGroup: "beef",
    smartRead: "Grass-fed beef provides iron and zinc food coverage with a complete amino acid profile. Black beans and peppers add fiber and vitamin C, while avocado lime crema keeps the fat source clean without seed oil.",
  },
  {
    id: "chicken-sourdough-plate",
    name: "Lemon-Herb Chicken Sourdough Plate",
    slot: "lunch",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["grilled lemon-herb chicken breast", "toasted sourdough", "mixed greens", "tomato", "cucumber", "olive oil", "sea salt"],
    ingredientsDetailed: [
      { name: "grilled lemon-herb chicken breast", amount: "180g", group: "protein" },
      { name: "toasted sourdough", amount: "2 slices, 90g", group: "carb" },
      { name: "mixed greens", amount: "70g", group: "produce" },
      { name: "tomato", amount: "60g", group: "produce" },
      { name: "cucumber", amount: "50g", group: "produce" },
      { name: "olive oil", amount: "10g", group: "fat" },
      { name: "lemon herb seasoning", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 480, proteinG: 46, carbsG: 40, fatG: 14 },
    prep: ["grilled", "pan-seared", "stovetop"],
    covers: ["protein", "folate", "vitamin-c", "fruit-veg"],
    proteinGroup: "poultry",
    smartRead: "Lean chicken breast on sourdough with greens and tomato — folate and vitamin C food coverage without excess fat. Olive oil keeps the meal satiating while protein distribution stays high through midday.",
  },
  {
    id: "turkey-rice-bowl",
    name: "Ground Turkey Harvest Bowl",
    slot: "lunch",
    goalFit: ["shred", "recomp", "performance", "maintenance"],
    ingredients: ["96/4 ground turkey", "jasmine rice", "roasted broccoli florets", "ginger soy glaze", "sesame seeds"],
    ingredientsDetailed: [
      { name: "96/4 ground turkey", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "roasted broccoli florets", amount: "90g", group: "produce" },
      { name: "sesame seeds", amount: "8g", group: "fat" },
      { name: "ginger soy glaze", amount: "20g", group: "finish" },
    ],
    macros: { calories: 510, proteinG: 47, carbsG: 52, fatG: 12 },
    prep: ["skillet", "stovetop", "meal-prep"],
    covers: ["protein", "fiber", "zinc", "potassium", "fruit-veg"],
    proteinGroup: "poultry",
    smartRead: "96/4 ground turkey is one of the leanest protein sources available. Broccoli adds fiber and vitamin C food coverage while the ginger soy glaze keeps the meal interesting without adding fat.",
  },
  {
    id: "bison-sweet-potato-bowl",
    name: "Bison & Sweet Potato Performance Bowl",
    slot: "lunch",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["lean bison", "roasted sweet potato cubes", "roasted bell peppers", "garlic herb olive oil", "sea salt"],
    ingredientsDetailed: [
      { name: "lean bison", amount: "170g", group: "protein" },
      { name: "roasted sweet potato cubes", amount: "180g", group: "carb" },
      { name: "roasted bell peppers", amount: "75g", group: "produce" },
      { name: "garlic herb olive oil", amount: "10g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 560, proteinG: 48, carbsG: 46, fatG: 18 },
    prep: ["skillet", "oven", "grilled", "stovetop"],
    covers: ["iron", "zinc", "potassium", "vitamin-c", "protein"],
    proteinGroup: "beef",
    smartRead: "Bison is ultra-lean with a rich iron and mineral profile. Sweet potato adds beta-carotene and a slow-digesting carb base that sustains energy through a demanding afternoon without spiking and crashing.",
  },
  {
    id: "garlic-herb-chicken-basmati",
    name: "Garlic Herb Chicken Thigh & Basmati Bowl",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["garlic herb chicken thighs (trimmed)", "basmati rice", "roasted asparagus", "lemon olive oil dressing"],
    ingredientsDetailed: [
      { name: "garlic herb chicken thighs, trimmed", amount: "170g", group: "protein" },
      { name: "basmati rice", amount: "180g", group: "carb" },
      { name: "roasted asparagus", amount: "80g", group: "produce" },
      { name: "lemon olive oil dressing", amount: "12g", group: "fat" },
    ],
    macros: { calories: 540, proteinG: 48, carbsG: 46, fatG: 18 },
    prep: ["grilled", "air fryer", "oven"],
    covers: ["protein", "folate", "potassium", "zinc"],
    proteinGroup: "poultry",
    smartRead: "Trimmed chicken thighs have a slightly higher fat content than breast — useful for lean mass phases where satiety matters. Basmati rice and asparagus round out the plate with fiber and a clean carb base.",
  },

  /* ── POST-WORKOUT ───────────────────────────────────────────────────────── */
  {
    id: "tuna-avocado-rice-bowl",
    name: "Ahi Tuna Avocado Rice Bowl",
    slot: "post-workout",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["ahi tuna", "sushi rice", "sliced avocado", "cucumber", "edamame", "sesame seeds", "citrus tamari"],
    ingredientsDetailed: [
      { name: "ahi tuna", amount: "150g", group: "protein" },
      { name: "sushi rice", amount: "180g", group: "carb" },
      { name: "edamame", amount: "50g", group: "produce" },
      { name: "cucumber", amount: "50g", group: "produce" },
      { name: "sliced avocado", amount: "50g", group: "fat" },
      { name: "sesame seeds", amount: "6g", group: "fat" },
      { name: "citrus tamari", amount: "15g", group: "finish" },
    ],
    macros: { calories: 530, proteinG: 44, carbsG: 50, fatG: 18 },
    prep: ["no-cook", "assemble"],
    covers: ["omega-3", "protein", "potassium", "magnesium", "folate"],
    proteinGroup: "fish-seafood",
    smartRead: "Cold ahi tuna requires zero cook time — ideal immediately post-session when prep effort is low. Sushi rice refills glycogen fast and avocado fat slows nothing at this volume. Citrus tamari replaces the need for salt-heavy sauces.",
  },
  {
    id: "chicken-jasmine-recovery-plate",
    name: "Chicken & Jasmine Rice Recovery Plate",
    slot: "post-workout",
    goalFit: ["lean-bulk", "performance", "recomp"],
    ingredients: ["6oz air-fried chicken breast", "jasmine rice", "roasted zucchini", "garlic yogurt sauce"],
    ingredientsDetailed: [
      { name: "air-fried chicken breast", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "200g", group: "carb" },
      { name: "roasted zucchini", amount: "90g", group: "produce" },
      { name: "garlic yogurt sauce", amount: "30g", group: "finish" },
    ],
    macros: { calories: 530, proteinG: 50, carbsG: 52, fatG: 12 },
    prep: ["air fryer", "stovetop", "oven"],
    covers: ["protein", "calcium", "potassium", "zinc"],
    proteinGroup: "poultry",
    smartRead: "Air-fried chicken breast and jasmine rice hit the post-session protein-carb window fast. Garlic yogurt sauce adds calcium without excess fat. Zucchini keeps the plate light while protecting micronutrient variety.",
  },
  {
    id: "cod-potato-recovery-bowl",
    name: "Cod & Roasted Potato Recovery Bowl",
    slot: "post-workout",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["6oz baked cod", "roasted fingerling potatoes", "asparagus spears", "lemon-dill seasoning", "olive oil"],
    ingredientsDetailed: [
      { name: "baked cod", amount: "170g", group: "protein" },
      { name: "roasted fingerling potatoes", amount: "180g", group: "carb" },
      { name: "asparagus spears", amount: "80g", group: "produce" },
      { name: "olive oil", amount: "8g", group: "fat" },
      { name: "lemon-dill seasoning", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 470, proteinG: 42, carbsG: 44, fatG: 12 },
    prep: ["baked", "oven", "air fryer"],
    covers: ["protein", "folate", "potassium", "vitamin-c"],
    proteinGroup: "fish-seafood",
    smartRead: "Baked cod is one of the cleanest lean-protein recovery options — very low fat and high protein food quality. Fingerling potatoes replenish glycogen without excess calories. Asparagus adds folate and mineral coverage post-training.",
  },

  /* ── DINNER ─────────────────────────────────────────────────────────────── */
  {
    id: "salmon-rice-bowl",
    name: "Wild Salmon Recovery Bowl",
    slot: "dinner",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["wild salmon fillet", "jasmine rice", "sliced cucumber", "avocado", "roasted asparagus", "ginger-lime sauce"],
    ingredientsDetailed: [
      { name: "wild salmon", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "170g", group: "carb" },
      { name: "roasted asparagus", amount: "80g", group: "produce" },
      { name: "sliced cucumber", amount: "50g", group: "produce" },
      { name: "avocado", amount: "40g", group: "fat" },
      { name: "ginger-lime sauce", amount: "20g", group: "finish" },
    ],
    macros: { calories: 620, proteinG: 46, carbsG: 52, fatG: 24 },
    prep: ["grilled", "air fryer", "baked", "pan-seared"],
    covers: ["omega-3", "potassium", "protein", "vitamin-d", "folate"],
    proteinGroup: "fish-seafood",
    smartRead: "Wild salmon adds omega-3 and vitamin D food coverage — two of the most commonly under-covered categories. Jasmine rice keeps the plate easy to digest before sleep. Avocado fat is slow-acting without causing overnight discomfort.",
  },
  {
    id: "shrimp-rice-bowl",
    name: "Garlic Shrimp & Jasmine Rice Plate",
    slot: "dinner",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["jumbo shrimp", "jasmine rice", "roasted asparagus", "garlic lemon butter sauce", "sea salt"],
    ingredientsDetailed: [
      { name: "jumbo shrimp", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "roasted asparagus", amount: "80g", group: "produce" },
      { name: "garlic lemon butter sauce", amount: "15g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 470, proteinG: 42, carbsG: 52, fatG: 10 },
    prep: ["pan-seared", "grilled", "air fryer"],
    covers: ["protein", "zinc", "vitamin-c", "folate"],
    proteinGroup: "fish-seafood",
    smartRead: "Shrimp is one of the leanest proteins per serving with zinc food coverage and very low fat. Garlic lemon butter keeps the flavor strong without excess calories. Light on digestion, which supports a clean wind-down.",
  },
  {
    id: "mahi-mahi-citrus-bowl",
    name: "Mahi-Mahi Citrus Bowl",
    slot: "dinner",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["mahi-mahi fillet", "basmati rice", "cucumber", "light mango salsa", "lime", "cilantro"],
    ingredientsDetailed: [
      { name: "mahi-mahi fillet", amount: "170g", group: "protein" },
      { name: "basmati rice", amount: "170g", group: "carb" },
      { name: "cucumber", amount: "50g", group: "produce" },
      { name: "light mango salsa", amount: "40g", group: "finish" },
      { name: "lime + cilantro", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 460, proteinG: 44, carbsG: 50, fatG: 10 },
    prep: ["grilled", "baked", "pan-seared"],
    covers: ["protein", "vitamin-c", "potassium", "fruit-veg"],
    proteinGroup: "fish-seafood",
    smartRead: "Mahi-mahi is a firm white fish with minimal fat and strong protein density. Light mango salsa adds vitamin C food coverage without adding fat. Basmati rice stays easy on digestion at the end of the day.",
  },
  {
    id: "sirloin-roasted-potato-plate",
    name: "Sirloin & Roasted Potato Dinner Plate",
    slot: "dinner",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["5oz top sirloin steak", "roasted golden potatoes", "wilted baby spinach", "garlic olive oil", "sea salt"],
    ingredientsDetailed: [
      { name: "top sirloin steak", amount: "140g", group: "protein" },
      { name: "roasted golden potatoes", amount: "200g", group: "carb" },
      { name: "baby spinach", amount: "60g", group: "produce" },
      { name: "garlic olive oil", amount: "10g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 620, proteinG: 52, carbsG: 46, fatG: 22 },
    prep: ["grilled", "pan-seared", "oven"],
    covers: ["iron", "zinc", "protein", "potassium", "folate"],
    proteinGroup: "beef",
    avoidLateEvening: true,
    smartRead: "Sirloin delivers iron and zinc food coverage with a full amino acid profile. Roasted potatoes provide the carbs needed to support recovery and glycogen restoration. Best placed as an earlier dinner — kept away from the sleep window when the meal would land late.",
  },
  {
    id: "ground-chicken-veggie-bowl",
    name: "Ground Chicken & Roasted Veggie Bowl",
    slot: "dinner",
    goalFit: ["shred", "recomp", "lean-bulk", "maintenance"],
    ingredients: ["96/4 ground chicken", "jasmine rice", "roasted zucchini", "roasted red peppers", "garlic herb sauce"],
    ingredientsDetailed: [
      { name: "96/4 ground chicken", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "roasted zucchini", amount: "90g", group: "produce" },
      { name: "roasted red peppers", amount: "75g", group: "produce" },
      { name: "garlic herb sauce", amount: "25g", group: "finish" },
    ],
    macros: { calories: 490, proteinG: 48, carbsG: 50, fatG: 12 },
    prep: ["skillet", "stovetop", "meal-prep"],
    covers: ["protein", "zinc", "vitamin-c", "fruit-veg", "potassium"],
    proteinGroup: "poultry",
    smartRead: "96/4 ground chicken is one of the leanest dinner proteins available — easy to portion and prepare in bulk. Roasted zucchini and peppers add vitamin C and fiber coverage while keeping the evening plate light and easy to digest.",
  },

  /* ════ PREMIUM UNIVERSE — extended variety (chef-style rotation) ════════════ */

  /* ── BREAKFAST (extended) ───────────────────────────────────────────────── */
  {
    id: "citrus-sunrise-egg-plate",
    name: "Citrus Sunrise Egg Plate",
    slot: "breakfast",
    goalFit: ["shred", "recomp", "maintenance", "performance"],
    ingredients: ["3 pasture-raised whole eggs", "100g egg whites", "2 slices sourdough toast", "grapefruit segments", "fresh orange"],
    ingredientsDetailed: [
      { name: "pasture-raised whole eggs", amount: "3", group: "protein" },
      { name: "egg whites", amount: "100g", group: "protein" },
      { name: "sourdough toast", amount: "2 slices, 90g", group: "carb" },
      { name: "grapefruit segments", amount: "100g", group: "produce" },
      { name: "fresh orange", amount: "1", group: "produce" },
    ],
    macros: { calories: 500, proteinG: 42, carbsG: 50, fatG: 15 },
    prep: ["non-stick", "stovetop", "soft-scramble"],
    covers: ["vitamin-c", "protein", "fruit-veg"],
    proteinGroup: "egg",
    smartRead: "Citrus at breakfast brings strong vitamin C food coverage alongside a complete egg-protein base. Grapefruit and orange keep the morning bright and light while sourdough provides steady carbs.",
  },
  {
    id: "cottage-cheese-berry-bowl",
    name: "Cottage Cheese Berry Bowl",
    slot: "breakfast",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["250g cottage cheese", "mixed berries", "blueberries", "honey", "almond butter"],
    ingredientsDetailed: [
      { name: "cottage cheese", amount: "250g", group: "protein" },
      { name: "mixed berries", amount: "60g", group: "produce" },
      { name: "blueberries", amount: "40g", group: "produce" },
      { name: "almond butter", amount: "12g", group: "fat" },
      { name: "honey", amount: "10g", group: "finish" },
    ],
    macros: { calories: 360, proteinG: 31, carbsG: 30, fatG: 13 },
    prep: ["no-cook", "assemble"],
    covers: ["calcium", "protein", "fruit-veg", "fiber"],
    proteinGroup: "dairy",
    smartRead: "Slow-digesting cottage-cheese protein with berry fruit coverage and a touch of almond butter for satiety. Calcium and fiber food coverage in a zero-cook bowl.",
  },
  {
    id: "oats-protein-power-bowl",
    name: "Oats & Protein Power Bowl",
    slot: "breakfast",
    goalFit: ["lean-bulk", "performance", "recomp"],
    ingredients: ["60g rolled oats (dry)", "1 scoop whey protein", "banana", "blueberries", "almond butter", "cinnamon"],
    ingredientsDetailed: [
      { name: "rolled oats", amount: "60g", group: "carb", note: "dry" },
      { name: "whey protein", amount: "1 scoop, 32g", group: "protein" },
      { name: "banana", amount: "100g", group: "produce" },
      { name: "blueberries", amount: "60g", group: "produce" },
      { name: "almond butter", amount: "12g", group: "fat" },
      { name: "cinnamon", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 540, proteinG: 38, carbsG: 66, fatG: 13 },
    prep: ["stovetop", "microwave", "no-cook"],
    covers: ["fiber", "potassium", "protein", "fruit-veg"],
    proteinGroup: "dairy",
    smartRead: "Whole-grain oats and whey build a carb-forward morning with fiber and potassium food coverage. Banana and blueberries add fruit variety to support a higher-output training day.",
  },

  /* ── PRE-WORKOUT (extended) ─────────────────────────────────────────────── */
  {
    id: "date-banana-pre-lift",
    name: "Date & Banana Pre-Lift Fuel",
    slot: "pre-workout",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["2 medjool dates", "banana", "2 rice cakes", "sea salt"],
    ingredientsDetailed: [
      { name: "banana", amount: "120g", group: "produce" },
      { name: "medjool dates", amount: "2 dates, 48g", group: "produce" },
      { name: "rice cakes", amount: "2 cakes, 18g", group: "carb" },
      { name: "sea salt", amount: "pinch", group: "finish" },
    ],
    macros: { calories: 340, proteinG: 6, carbsG: 76, fatG: 2 },
    prep: ["no-cook", "assemble", "portable"],
    covers: ["potassium", "fruit-veg"],
    smartRead: "Dates and banana deliver fast natural carbs and potassium right before the session — a clean, low-fat fuel option that digests quickly in the last 30–45 minutes pre-lift.",
  },

  /* ── LUNCH (extended — premium red-meat cuts live at midday, off the
        sleep window) ────────────────────────────────────────────────────── */
  {
    id: "skirt-steak-chimichurri-plate",
    name: "Skirt Steak Chimichurri Plate",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["170g skirt steak", "roasted baby potatoes", "asparagus", "peppers & onions", "chimichurri", "citrus finish"],
    ingredientsDetailed: [
      { name: "skirt steak", amount: "170g", group: "protein" },
      { name: "roasted baby potatoes", amount: "220g", group: "carb" },
      { name: "asparagus", amount: "80g", group: "produce" },
      { name: "peppers & onions", amount: "50g", group: "produce" },
      { name: "chimichurri", amount: "20g", group: "finish" },
      { name: "citrus finish", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 610, proteinG: 48, carbsG: 56, fatG: 22 },
    prep: ["grilled", "pan-seared", "skillet"],
    covers: ["iron", "zinc", "potassium", "vitamin-c", "protein"],
    proteinGroup: "beef",
    smartRead: "Skirt steak is a deeply flavorful cut with strong iron and zinc food coverage. Bright chimichurri and citrus cut the richness, while baby potatoes restore glycogen — a chef-style midday plate.",
  },
  {
    id: "ribeye-reserve-plate",
    name: "Ribeye Reserve Plate",
    slot: "lunch",
    goalFit: ["lean-bulk", "performance"],
    ingredients: ["140g ribeye steak (controlled portion)", "roasted potatoes", "green beans", "mushrooms", "garlic herb + sea salt"],
    ingredientsDetailed: [
      { name: "ribeye steak", amount: "140g", group: "protein", note: "controlled portion" },
      { name: "roasted potatoes", amount: "200g", group: "carb" },
      { name: "green beans", amount: "100g", group: "produce" },
      { name: "mushrooms", amount: "60g", group: "produce" },
      { name: "garlic herb + sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 640, proteinG: 46, carbsG: 52, fatG: 28 },
    prep: ["grilled", "pan-seared", "cast-iron"],
    covers: ["iron", "zinc", "potassium", "protein"],
    proteinGroup: "beef",
    avoidLateEvening: true,
    smartRead: "A premium higher-fat steak plate kept portion-controlled and paired with potatoes and vegetables rather than added fats. Placed at midday and away from the sleep window — not an every-day or late-night plate.",
  },
  {
    id: "filet-tips-rice-bowl",
    name: "Filet Tips & Jasmine Rice Bowl",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["170g filet tips", "jasmine rice", "broccoli", "peppers", "light teriyaki"],
    ingredientsDetailed: [
      { name: "filet tips", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "broccoli", amount: "90g", group: "produce" },
      { name: "peppers", amount: "60g", group: "produce" },
      { name: "light teriyaki", amount: "18g", group: "finish" },
    ],
    macros: { calories: 580, proteinG: 50, carbsG: 58, fatG: 16 },
    prep: ["skillet", "pan-seared", "stovetop"],
    covers: ["iron", "zinc", "fiber", "protein", "fruit-veg"],
    proteinGroup: "beef",
    smartRead: "Tender filet tips are a leaner premium cut with strong iron and zinc coverage. Broccoli and peppers add fiber and vitamin C, and a light teriyaki keeps it flavorful without heavy fat.",
  },
  {
    id: "flank-steak-sweet-potato",
    name: "Flank Steak & Sweet Potato Plate",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["170g flank steak", "roasted sweet potato", "arugula", "tomato", "chimichurri"],
    ingredientsDetailed: [
      { name: "flank steak", amount: "170g", group: "protein" },
      { name: "roasted sweet potato", amount: "200g", group: "carb" },
      { name: "arugula", amount: "40g", group: "produce" },
      { name: "tomato", amount: "60g", group: "produce" },
      { name: "chimichurri", amount: "20g", group: "finish" },
    ],
    macros: { calories: 560, proteinG: 48, carbsG: 48, fatG: 20 },
    prep: ["grilled", "pan-seared", "skillet"],
    covers: ["iron", "zinc", "potassium", "vitamin-c", "folate"],
    proteinGroup: "beef",
    smartRead: "Lean flank steak with sweet potato delivers iron, zinc, and beta-carotene food coverage. Peppery arugula and bright chimichurri make it a restaurant-style plate with a slow-digesting carb base.",
  },
  {
    id: "turkey-breast-quinoa-bowl",
    name: "Turkey Breast & Quinoa Bowl",
    slot: "lunch",
    goalFit: ["shred", "recomp", "performance", "maintenance"],
    ingredients: ["170g turkey breast", "quinoa", "green beans", "carrots", "lemon herb finish"],
    ingredientsDetailed: [
      { name: "turkey breast", amount: "170g", group: "protein" },
      { name: "quinoa", amount: "180g", group: "carb" },
      { name: "green beans", amount: "80g", group: "produce" },
      { name: "carrots", amount: "60g", group: "produce" },
      { name: "lemon herb finish", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 500, proteinG: 46, carbsG: 52, fatG: 10 },
    prep: ["grilled", "stovetop", "meal-prep"],
    covers: ["protein", "fiber", "folate", "potassium", "fruit-veg"],
    proteinGroup: "poultry",
    smartRead: "Sliced turkey breast over quinoa adds a complete-protein grain with fiber and folate food coverage. Green beans and carrots widen vegetable variety on a lean, clean midday plate.",
  },
  {
    id: "rotisserie-chicken-bowl",
    name: "Rotisserie Chicken & Basmati Bowl",
    slot: "lunch",
    goalFit: ["shred", "recomp", "maintenance", "performance"],
    ingredients: ["170g rotisserie chicken breast meat", "basmati rice", "roasted carrots", "arugula", "garlic yogurt sauce"],
    ingredientsDetailed: [
      { name: "rotisserie chicken breast meat", amount: "170g", group: "protein" },
      { name: "basmati rice", amount: "180g", group: "carb" },
      { name: "roasted carrots", amount: "80g", group: "produce" },
      { name: "arugula", amount: "40g", group: "produce" },
      { name: "garlic yogurt sauce", amount: "25g", group: "finish" },
    ],
    macros: { calories: 520, proteinG: 48, carbsG: 50, fatG: 14 },
    prep: ["no-cook", "assemble", "meal-prep"],
    covers: ["protein", "potassium", "folate", "calcium"],
    proteinGroup: "poultry",
    smartRead: "Rotisserie chicken breast meat is the ultimate low-prep lean protein — pull, plate, and go. Basmati and roasted carrots round it out, with a garlic yogurt sauce for calcium food coverage.",
  },
  {
    id: "sirloin-citrus-sourdough-plate",
    name: "Sirloin Citrus Sourdough Plate",
    slot: "lunch",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["170g top sirloin", "sourdough", "arugula", "tomato", "olive oil", "orange or grapefruit side"],
    ingredientsDetailed: [
      { name: "top sirloin", amount: "170g", group: "protein" },
      { name: "sourdough", amount: "90g", group: "carb" },
      { name: "arugula", amount: "70g", group: "produce" },
      { name: "tomato", amount: "60g", group: "produce" },
      { name: "olive oil", amount: "10g", group: "fat" },
      { name: "orange or grapefruit side", amount: "1", group: "produce" },
    ],
    macros: { calories: 540, proteinG: 48, carbsG: 46, fatG: 18 },
    prep: ["grilled", "pan-seared", "skillet"],
    covers: ["iron", "zinc", "vitamin-c", "folate", "protein"],
    proteinGroup: "beef",
    smartRead: "Lean sirloin over sourdough with peppery arugula, and a citrus side for vitamin C food coverage. A bistro-style plate that keeps iron and zinc high without heavy fat.",
  },

  /* ── POST-WORKOUT (extended) ────────────────────────────────────────────── */
  {
    id: "ahi-tuna-pineapple-rice-bowl",
    name: "Ahi Tuna Pineapple Rice Bowl",
    slot: "post-workout",
    goalFit: ["shred", "recomp", "performance", "maintenance"],
    ingredients: ["170g ahi tuna", "sushi rice", "pineapple", "cucumber", "sesame", "citrus tamari"],
    ingredientsDetailed: [
      { name: "wild-caught ahi tuna", amount: "170g", group: "protein" },
      { name: "sushi rice", amount: "180g", group: "carb" },
      { name: "pineapple", amount: "80g", group: "produce" },
      { name: "cucumber", amount: "50g", group: "produce" },
      { name: "sesame", amount: "8g", group: "fat" },
      { name: "citrus tamari", amount: "15g", group: "finish" },
    ],
    macros: { calories: 510, proteinG: 44, carbsG: 56, fatG: 12 },
    prep: ["no-cook", "assemble"],
    covers: ["protein", "vitamin-c", "potassium", "fruit-veg"],
    proteinGroup: "fish-seafood",
    smartRead: "Cold ahi tuna and sushi rice make a zero-cook post-session refuel. Pineapple adds a digestion-friendly fruit and vitamin C food coverage — bright, light, and fast to assemble.",
  },
  {
    id: "shrimp-scallop-rice-bowl",
    name: "Shrimp & Scallop Rice Bowl",
    slot: "post-workout",
    goalFit: ["shred", "recomp", "performance", "maintenance"],
    ingredients: ["170g shrimp & scallops", "jasmine rice", "asparagus", "lemon butter", "sea salt"],
    ingredientsDetailed: [
      { name: "shrimp & scallops", amount: "170g", group: "protein" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "asparagus", amount: "80g", group: "produce" },
      { name: "lemon butter", amount: "12g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 500, proteinG: 44, carbsG: 52, fatG: 12 },
    prep: ["pan-seared", "skillet"],
    covers: ["protein", "zinc", "folate", "vitamin-c"],
    proteinGroup: "fish-seafood",
    smartRead: "Seared shrimp and scallops are lean, fast-cooking shellfish with zinc food coverage. Jasmine rice refills glycogen and a light lemon butter finishes the plate — premium without being heavy.",
  },
  {
    id: "chicken-tenderloin-potato-bowl",
    name: "Chicken Tenderloin & Potato Bowl",
    slot: "post-workout",
    goalFit: ["lean-bulk", "recomp", "performance"],
    ingredients: ["175g chicken tenderloins", "roasted baby potatoes", "broccoli", "garlic yogurt sauce"],
    ingredientsDetailed: [
      { name: "chicken tenderloins", amount: "175g", group: "protein" },
      { name: "roasted baby potatoes", amount: "200g", group: "carb" },
      { name: "broccoli", amount: "90g", group: "produce" },
      { name: "garlic yogurt sauce", amount: "30g", group: "finish" },
    ],
    macros: { calories: 520, proteinG: 50, carbsG: 50, fatG: 12 },
    prep: ["air fryer", "grilled", "oven"],
    covers: ["protein", "potassium", "fiber", "calcium"],
    proteinGroup: "poultry",
    smartRead: "Chicken tenderloins cook fast and stay lean — an easy post-session protein. Baby potatoes restore glycogen, broccoli adds fiber, and garlic yogurt sauce brings calcium food coverage.",
  },
  {
    id: "tilapia-citrus-potato-plate",
    name: "Tilapia Citrus Potato Plate",
    slot: "post-workout",
    goalFit: ["shred", "recomp", "maintenance", "performance"],
    ingredients: ["190g tilapia", "roasted sweet potato", "spinach", "tomato", "lemon garlic finish"],
    ingredientsDetailed: [
      { name: "tilapia", amount: "190g", group: "protein" },
      { name: "roasted sweet potato", amount: "220g", group: "carb" },
      { name: "spinach", amount: "80g", group: "produce" },
      { name: "tomato", amount: "60g", group: "produce" },
      { name: "lemon garlic finish", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 470, proteinG: 44, carbsG: 50, fatG: 9 },
    prep: ["baked", "pan-seared", "air fryer"],
    covers: ["protein", "vitamin-c", "folate", "potassium"],
    proteinGroup: "fish-seafood",
    smartRead: "Tilapia is a very lean, mild white fish that plates fast post-training. Sweet potato restores glycogen with beta-carotene, while spinach and tomato add folate and vitamin C food coverage.",
  },

  /* ── DINNER (extended — lighter wild-caught proteins for the evening) ────── */
  {
    id: "wild-cod-performance-plate",
    name: "Wild-Caught Cod Performance Plate",
    slot: "dinner",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["190g wild-caught cod", "jasmine rice", "zucchini", "cucumber & tomato", "lemon herb sauce"],
    ingredientsDetailed: [
      { name: "wild-caught cod", amount: "190g", group: "protein" },
      { name: "jasmine rice", amount: "190g", group: "carb" },
      { name: "zucchini", amount: "90g", group: "produce" },
      { name: "cucumber & tomato", amount: "60g", group: "produce" },
      { name: "lemon herb sauce", amount: "20g", group: "finish" },
    ],
    macros: { calories: 480, proteinG: 44, carbsG: 50, fatG: 10 },
    prep: ["baked", "pan-seared", "air fryer"],
    covers: ["protein", "folate", "potassium", "vitamin-c"],
    proteinGroup: "fish-seafood",
    smartRead: "Wild-caught cod is one of the leanest white-fish proteins — light and easy to digest before sleep. Jasmine rice and zucchini keep the evening plate clean with a fresh lemon herb finish.",
  },
  {
    id: "mahi-mango-rice-bowl",
    name: "Mahi Mahi Mango Rice Bowl",
    slot: "dinner",
    goalFit: ["shred", "recomp", "performance", "maintenance"],
    ingredients: ["180g wild-caught mahi mahi", "basmati rice", "mango salsa", "cucumber", "avocado", "lime finish"],
    ingredientsDetailed: [
      { name: "wild-caught mahi mahi", amount: "180g", group: "protein" },
      { name: "basmati rice", amount: "180g", group: "carb" },
      { name: "mango salsa", amount: "80g", group: "produce" },
      { name: "cucumber", amount: "60g", group: "produce" },
      { name: "avocado", amount: "40g", group: "fat" },
      { name: "lime finish", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 520, proteinG: 42, carbsG: 56, fatG: 14 },
    prep: ["grilled", "baked", "pan-seared"],
    covers: ["protein", "vitamin-c", "potassium", "fruit-veg"],
    proteinGroup: "fish-seafood",
    smartRead: "Firm wild-caught mahi mahi pairs with a bright mango salsa for tropical vitamin C food coverage. Avocado adds a slow fat without heaviness — a vibrant, easy-to-digest evening bowl.",
  },
  {
    id: "sockeye-salmon-potato-plate",
    name: "Sockeye Salmon & Potato Plate",
    slot: "dinner",
    goalFit: ["shred", "recomp", "lean-bulk", "performance", "maintenance"],
    ingredients: ["170g wild-caught sockeye salmon", "roasted baby potatoes", "asparagus", "olive oil", "lemon + dill"],
    ingredientsDetailed: [
      { name: "wild-caught sockeye salmon", amount: "170g", group: "protein" },
      { name: "roasted baby potatoes", amount: "200g", group: "carb" },
      { name: "asparagus", amount: "80g", group: "produce" },
      { name: "olive oil", amount: "8g", group: "fat" },
      { name: "lemon + dill", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 560, proteinG: 44, carbsG: 44, fatG: 24 },
    prep: ["baked", "grilled", "pan-seared"],
    covers: ["omega-3", "vitamin-d", "potassium", "protein", "folate"],
    proteinGroup: "fish-seafood",
    smartRead: "Wild-caught sockeye salmon is rich in omega-3 and vitamin D food coverage — two commonly under-covered categories. Baby potatoes and asparagus keep the evening plate balanced and easy to digest.",
  },
  {
    id: "sea-bass-citrus-plate",
    name: "Wild Sea Bass Citrus Plate",
    slot: "dinner",
    goalFit: ["recomp", "performance", "maintenance", "lean-bulk"],
    ingredients: ["175g wild sea bass", "jasmine rice", "green beans", "arugula", "citrus tamari"],
    ingredientsDetailed: [
      { name: "wild-caught sea bass", amount: "175g", group: "protein", note: "premium" },
      { name: "jasmine rice", amount: "180g", group: "carb" },
      { name: "green beans", amount: "80g", group: "produce" },
      { name: "arugula", amount: "40g", group: "produce" },
      { name: "citrus tamari", amount: "15g", group: "finish" },
    ],
    macros: { calories: 500, proteinG: 42, carbsG: 50, fatG: 14 },
    prep: ["baked", "pan-seared", "grilled"],
    covers: ["protein", "folate", "potassium", "vitamin-c"],
    proteinGroup: "fish-seafood",
    smartRead: "Wild sea bass is a premium, buttery white fish kept light over jasmine rice and greens. A citrus tamari finish adds brightness — a refined dinner that stays easy before sleep.",
  },
  {
    id: "seared-scallop-asparagus-plate",
    name: "Seared Scallop & Asparagus Plate",
    slot: "dinner",
    goalFit: ["shred", "recomp", "maintenance"],
    ingredients: ["170g seared scallops", "basmati rice", "asparagus", "lemon butter", "sea salt"],
    ingredientsDetailed: [
      { name: "seared scallops", amount: "170g", group: "protein" },
      { name: "basmati rice", amount: "180g", group: "carb" },
      { name: "asparagus", amount: "90g", group: "produce" },
      { name: "lemon butter", amount: "10g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 460, proteinG: 38, carbsG: 52, fatG: 10 },
    prep: ["pan-seared", "skillet"],
    covers: ["protein", "zinc", "folate"],
    proteinGroup: "fish-seafood",
    smartRead: "Seared scallops are a lean, elegant shellfish protein with zinc food coverage. Basmati and asparagus keep the plate refined and light — a quiet, premium way to close the day.",
  },
];

/* ─── Snack intelligence ──────────────────────────────────────────────────── */
export type SnackKind = "protein" | "pre-workout" | "post-workout" | "night" | "travel" | "low-prep" | "recovery";

export type FuelSnack = {
  name: string;
  kind: SnackKind;
  ingredients: string[];
  /** Optional weighted plate composition (premium display). Falls back to `ingredients`. */
  ingredientsDetailed?: DetailedIngredient[];
  macros: FuelMacros;
  smartRead: string;
};

export const FUEL_SNACKS: FuelSnack[] = [
  {
    name: "Greek Yogurt · Mixed Berries · Honey",
    kind: "protein",
    ingredients: ["2% Greek yogurt", "mixed berries", "honey drizzle", "chia seeds"],
    ingredientsDetailed: [
      { name: "2% Greek yogurt", amount: "250g", group: "protein" },
      { name: "mixed berries", amount: "80g", group: "produce" },
      { name: "chia seeds", amount: "8g", group: "fat" },
      { name: "honey drizzle", amount: "10g", group: "finish" },
    ],
    macros: { calories: 240, proteinG: 23, carbsG: 28, fatG: 4 },
    smartRead: "Protects protein distribution between meals with fruit and omega-3 seed coverage. No prep needed — a clean protein bridge at any point in the day.",
  },
  {
    name: "Cream of Rice + Egg Whites + Banana",
    kind: "pre-workout",
    ingredients: ["cream of rice", "egg whites", "banana", "cinnamon"],
    ingredientsDetailed: [
      { name: "cream of rice", amount: "200g", group: "carb", note: "cooked" },
      { name: "egg whites", amount: "120g", group: "protein" },
      { name: "banana", amount: "100g", group: "produce" },
      { name: "cinnamon", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 320, proteinG: 26, carbsG: 52, fatG: 2 },
    smartRead: "A clean carb and protein option before training — easy-digesting rice starch and banana potassium with egg whites for a protein base.",
  },
  {
    name: "Cottage Cheese + Pineapple + Cinnamon",
    kind: "night",
    ingredients: ["cottage cheese", "fresh pineapple", "cinnamon"],
    ingredientsDetailed: [
      { name: "cottage cheese", amount: "200g", group: "protein" },
      { name: "fresh pineapple", amount: "80g", group: "produce" },
      { name: "cinnamon", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 220, proteinG: 24, carbsG: 20, fatG: 5 },
    smartRead: "Slow-digesting protein for the night without sitting heavy before sleep. Pineapple adds a digestive enzyme and vitamin C food coverage.",
  },
  {
    name: "Turkey Roll-Ups + Apple Slices",
    kind: "travel",
    ingredients: ["sliced turkey", "apple slices", "sea salt"],
    ingredientsDetailed: [
      { name: "sliced turkey", amount: "120g", group: "protein" },
      { name: "apple", amount: "120g", group: "produce" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 250, proteinG: 26, carbsG: 24, fatG: 6 },
    smartRead: "Portable protein with fruit food coverage — no refrigeration needed for short trips. Clean protein and natural sugar without processed carbs.",
  },
  {
    name: "Rice Cakes + Almond Butter + Banana",
    kind: "low-prep",
    ingredients: ["rice cakes", "almond butter", "banana"],
    ingredientsDetailed: [
      { name: "rice cakes", amount: "2 cakes, 18g", group: "carb" },
      { name: "banana", amount: "100g", group: "produce" },
      { name: "almond butter", amount: "16g", group: "fat" },
    ],
    macros: { calories: 270, proteinG: 8, carbsG: 36, fatG: 11 },
    smartRead: "Lowest-prep carbs with healthy fat food coverage and potassium from banana. A reliable between-meals option that takes 60 seconds.",
  },
  {
    name: "Post-Session Protein Smoothie",
    kind: "post-workout",
    ingredients: ["whey protein", "banana", "mixed berries", "milk or water"],
    ingredientsDetailed: [
      { name: "whey protein", amount: "1 scoop, 32g", group: "protein" },
      { name: "banana", amount: "100g", group: "produce" },
      { name: "mixed berries", amount: "60g", group: "produce" },
      { name: "milk or water", amount: "250ml", group: "finish" },
    ],
    macros: { calories: 310, proteinG: 32, carbsG: 38, fatG: 4 },
    smartRead: "Fast post-session protein and carbs with fruit food coverage — absorbs quickly when a full meal isn't ready. Banana potassium replaces what's lost during training.",
  },
  {
    name: "Sourdough Toast + Egg Whites",
    kind: "recovery",
    ingredients: ["sourdough toast", "egg whites", "sea salt", "olive oil drizzle"],
    ingredientsDetailed: [
      { name: "egg whites", amount: "120g", group: "protein" },
      { name: "sourdough toast", amount: "1 slice, 45g", group: "carb" },
      { name: "olive oil drizzle", amount: "5g", group: "fat" },
      { name: "sea salt", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 280, proteinG: 22, carbsG: 30, fatG: 6 },
    smartRead: "Light protein and carbs for a recovery day snack or morning bridge meal. Egg whites keep protein present without adding fat, and sourdough provides steady energy.",
  },
  {
    name: "Greek Yogurt + Pomegranate + Walnuts",
    kind: "protein",
    ingredients: ["Greek yogurt", "pomegranate seeds", "walnuts", "honey"],
    ingredientsDetailed: [
      { name: "2% Greek yogurt", amount: "200g", group: "protein" },
      { name: "pomegranate seeds", amount: "60g", group: "produce" },
      { name: "walnuts", amount: "12g", group: "fat" },
      { name: "honey", amount: "8g", group: "finish" },
    ],
    macros: { calories: 260, proteinG: 20, carbsG: 26, fatG: 9 },
    smartRead: "Greek yogurt with jewel-like pomegranate and walnuts — protein, fruit variety, and a healthy fat source in one quick no-cook bowl.",
  },
  {
    name: "Cottage Cheese + Cherries + Kiwi",
    kind: "night",
    ingredients: ["cottage cheese", "cherries", "kiwi", "cinnamon"],
    ingredientsDetailed: [
      { name: "cottage cheese", amount: "200g", group: "protein" },
      { name: "cherries", amount: "60g", group: "produce" },
      { name: "kiwi", amount: "1, 75g", group: "produce" },
      { name: "cinnamon", amount: "to taste", group: "finish" },
    ],
    macros: { calories: 230, proteinG: 24, carbsG: 22, fatG: 4 },
    smartRead: "A light evening fruit option — slow-digesting cottage cheese with cherries and kiwi, easy before sleep without a heavy meal.",
  },
  {
    name: "Greek Yogurt + Papaya + Pineapple",
    kind: "recovery",
    ingredients: ["Greek yogurt", "papaya", "pineapple", "honey"],
    ingredientsDetailed: [
      { name: "2% Greek yogurt", amount: "200g", group: "protein" },
      { name: "papaya", amount: "80g", group: "produce" },
      { name: "pineapple", amount: "60g", group: "produce" },
      { name: "honey", amount: "8g", group: "finish" },
    ],
    macros: { calories: 240, proteinG: 20, carbsG: 32, fatG: 3 },
    smartRead: "Papaya and pineapple are digestion-friendly tropical fruits over Greek yogurt — a light recovery-day snack with vitamin C food coverage.",
  },
  {
    name: "Watermelon + Cottage Cheese",
    kind: "night",
    ingredients: ["watermelon", "cottage cheese", "sea salt"],
    ingredientsDetailed: [
      { name: "cottage cheese", amount: "180g", group: "protein" },
      { name: "watermelon", amount: "150g", group: "produce" },
      { name: "sea salt", amount: "pinch", group: "finish" },
    ],
    macros: { calories: 200, proteinG: 21, carbsG: 18, fatG: 4 },
    smartRead: "Hydrating watermelon with slow-digesting cottage cheese — a very light, refreshing evening option that keeps protein present without sitting heavy.",
  },
];

export function recommendSnack(goal: FuelGoal, isTrainingDay: boolean): FuelSnack {
  if (isTrainingDay) return FUEL_SNACKS.find((s) => s.kind === "post-workout") ?? FUEL_SNACKS[0];
  if (goal === "shred") return FUEL_SNACKS.find((s) => s.kind === "protein") ?? FUEL_SNACKS[0];
  if (goal === "lean-bulk" || goal === "performance") return FUEL_SNACKS.find((s) => s.kind === "pre-workout") ?? FUEL_SNACKS[0];
  return FUEL_SNACKS.find((s) => s.kind === "night") ?? FUEL_SNACKS[0];
}

/** Personalization-aware snack recommender — prefers low-prep when requested. */
export function recommendSnackPersonalized(goal: FuelGoal, isTrainingDay: boolean, p: MealPersonalization): FuelSnack {
  if (p.prepPreference === "low-prep") {
    const lowPrep = FUEL_SNACKS.find((s) => s.kind === "low-prep");
    if (lowPrep) return lowPrep;
  }
  return recommendSnack(goal, isTrainingDay);
}

/* ─── Targets (estimates only) ────────────────────────────────────────────── */
export type FuelTargets = {
  proteinG: number;
  calories: number;
  /** Carbs and fat split the calories left after protein: fat from bodyweight, carbs the rest. */
  carbsG: number;
  fatG: number;
  estimated: true;
  note: string;
  /** "member-weight" — built from the member's own bodyweight. "reference-weight" —
      no bodyweight is on file, so the estimate uses FUEL_REFERENCE_BODYWEIGHT_LB and
      every surface must say so and invite a weigh-in. "member-plan" — the member
      is running their own meal plan, so the target is that plan's own totals. */
  basis: "member-weight" | "reference-weight" | "member-plan";
};

/** The planning reference used ONLY when a member has no bodyweight on file. Always disclosed. */
export const FUEL_REFERENCE_BODYWEIGHT_LB = 185;

/** Fat, grams per pound of bodyweight, by goal. Carbs take the calories that remain. */
const FAT_PER_LB: Record<FuelGoal, number> = { shred: 0.3, recomp: 0.35, maintenance: 0.35, performance: 0.35, "lean-bulk": 0.4 };

/** Food-based planning estimate. Not a metabolic prediction. */
export function estimateDailyTargets(goal: FuelGoal, bodyweightLb: number | null, isTrainingDay: boolean): FuelTargets {
  const known = Boolean(bodyweightLb && bodyweightLb > 60);
  const bw = known ? (bodyweightLb as number) : FUEL_REFERENCE_BODYWEIGHT_LB;
  const proteinG = Math.round(bw * (goal === "lean-bulk" ? 1.0 : 0.95));
  const calBase = goal === "shred" ? 13 : goal === "lean-bulk" ? 16.5 : 15;
  const calories = Math.round(bw * calBase + (isTrainingDay ? 180 : 0));
  const fatG = Math.round(bw * FAT_PER_LB[goal]);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return known
    ? { proteinG, calories, carbsG, fatG, estimated: true, basis: "member-weight", note: "Planning estimate from goal and bodyweight — not a metabolic measurement." }
    : {
        proteinG,
        calories,
        carbsG,
        fatG,
        estimated: true,
        basis: "reference-weight",
        note: `Planning estimate at a ${FUEL_REFERENCE_BODYWEIGHT_LB} lb reference — no bodyweight on file. Log a weigh-in to personalize. Not a metabolic measurement.`,
      };
}

/**
 * Turn the protocol↔nutrition engine's resolved day macros into the plan's
 * target shape. Returns null when there are no usable numbers (so the caller
 * falls back to the goal + bodyweight estimate). No numbers are invented here —
 * the engine already returns null when it has no bodyweight to work from.
 */
export function fuelTargetsFromMacros(
  macro: MacroTargets | null | undefined,
  bodyweightLb: number | null,
): FuelTargets | null {
  if (!macro || !(macro.calories > 0) || !(macro.proteinG > 0)) return null;
  const known = Boolean(bodyweightLb && bodyweightLb > 60);
  return {
    proteinG: Math.round(macro.proteinG),
    calories: Math.round(macro.calories),
    carbsG: Math.round(macro.carbsG),
    fatG: Math.round(macro.fatG),
    estimated: true,
    basis: known ? "member-weight" : "reference-weight",
    note: "Planning estimate tuned to your protocol, phase and today's training — not a metabolic measurement.",
  };
}

/* ─── Daily fuel plan ─────────────────────────────────────────────────────── */
export type PlannedFuelMeal = {
  id: string;
  slot: MealSlot;
  windowLabel: string;
  time: string | null;
  name: string;
  ingredients: string[];
  /** Optional weighted plate composition (premium display). Falls back to `ingredients`. */
  ingredientsDetailed?: DetailedIngredient[];
  macros: FuelMacros;
  prep: string[];
  covers: string[];
  smartRead: string;
  isSnack: boolean;
  /** True for a slot the member can skip with nothing missed (the pre-workout shake). */
  optional?: boolean;
  /** True when sourced from one of the member's favorite (signature) meals. */
  fromFavorite?: boolean;
  favoriteId?: string;
  /** Applied configuration label, when a configuration has been chosen. */
  config?: string;
  /** The meal as planned, before a configuration scaled it (so re-configuring never compounds). */
  configBase?: Pick<PlannedFuelMeal, "macros" | "prep" | "smartRead">;
  /**
   * Quiet personalization signals — one short phrase per reason this meal was
   * chosen based on the member's preferences (e.g. "Salmon · your pick",
   * "Low-prep", "No grill needed"). Shown as subtle chips in the UI.
   */
  personalizationTags?: string[];
};

export type MealWindowInput = {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
  /** The fuel slot the schedule engine gave this window. Falls back to the window id. */
  slot?: MealSlot;
  /** A slot the member can skip with nothing missed. */
  optional?: boolean;
  /** "shake": the food-only pre-workout shake slot, never a plate. */
  kind?: "meal" | "shake";
  shakeStyle?: PreWorkoutShakeStyle;
};

/* ─── Favorites influence ─────────────────────────────────────────────────── */
export type PlanFavoriteInput = { id: string; name: string; slot: MealSlot; macros: FuelMacros | null; ingredients?: string[] };

/** Map a signature-meal purpose to a fuel slot. */
export function purposeToSlot(purpose: string): MealSlot {
  switch (purpose) {
    case "morning-anchor": return "breakfast";
    case "pre-workout": return "pre-workout";
    case "post-workout": return "post-workout";
    case "night-recovery": return "dinner";
    case "macro-rescue": return "snack";
    default: return "lunch";
  }
}

/* ─── Personalization helpers ─────────────────────────────────────────────── */

export type MealPersonalization = {
  /** Ingredients the member dislikes — meals where ANY ingredient matches are deprioritised. */
  dislikedFoods?: string[];
  /** Allergies / foods to avoid — meals where ANY ingredient matches are excluded entirely. */
  allergies?: string[];
  /** Preferred protein source keywords — meals containing a match are boosted. */
  favoriteProteinSources?: string[];
  /** Preferred carb source keywords — meals containing a match are boosted. */
  favoriteCarbSources?: string[];
  /** Meal-prep preference — influences snack selection and "low-prep" affinity. */
  prepPreference?: "batch" | "cook-fresh" | "low-prep";
  /**
   * Cooking equipment available. A meal is excluded only when NONE of its prep
   * methods matches ANY available equipment (prep lists are options, not requirements).
   * An empty array means "no restriction" (fall back to full library).
   */
  cookingEquipment?: string[];
  /** Foods the member never wants — excluded like an allergy. */
  excludedFoods?: string[];
  /** The member's diet style key (diet-styles.ts). Rules foods out of the rotation. */
  dietStyle?: string;
  /** False when the member keeps dairy out. */
  dairyAllowed?: boolean;
  /**
   * Peak Mode's kitchen answers (the proteins, carbs and foods to avoid the
   * member chose). Passed only while Peak Mode is on: then its avoid list is a
   * hard exclusion and its proteins and carbs join the member's picks.
   */
  kitchen?: { proteins: string[]; carbs: string[]; avoid: string[] } | null;
};

/** Normalize a string for loose keyword matching. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** True when any item in `terms` appears as a substring of any `targets` entry. */
export function anyMatch(terms: string[], targets: string[]): boolean {
  const normTargets = targets.map(normalize);
  return terms.some((term) => normTargets.some((t) => t.includes(normalize(term))));
}

/**
 * True when a meal's ingredient lines hit an allergy (by what an ingredient is —
 * "shell fish" rules out shrimp — or by the words typed), a food the member
 * excluded, or Peak Mode's avoid list while Peak Mode is on. Hard exclusions.
 */
export function ingredientsExcluded(lines: readonly string[], p: MealPersonalization): boolean {
  if (p.allergies?.length && (anyMatch(p.allergies, [...lines]) || ingredientsHitAllergy(lines, p.allergies))) return true;
  if (p.excludedFoods?.length && ingredientsHitAllergy(lines, p.excludedFoods)) return true;
  if (p.kitchen?.avoid.length) {
    const avoid = new Set(p.kitchen.avoid.flatMap(avoidKeyTags));
    if (lines.some((line) => ingredientTags(line).some((t) => avoid.has(t)))) return true;
  }
  return false;
}

/** Score a meal for personalization (additive on top of slot/goal scoring). */
function personalizationScore(meal: FuelMeal, p: MealPersonalization): number {
  let s = 0;
  // Favourite sources → boost when ingredients contain a keyword.
  if (p.favoriteProteinSources?.length && anyMatch(p.favoriteProteinSources, meal.ingredients)) s += 3;
  if (p.favoriteCarbSources?.length && anyMatch(p.favoriteCarbSources, meal.ingredients)) s += 2;
  // Disliked — soft penalty (still usable as fallback when nothing else fits).
  if (p.dislikedFoods?.length && anyMatch(p.dislikedFoods, meal.ingredients)) s -= 5;
  // Low-prep preference — boost assemble/no-cook meals.
  if (p.prepPreference === "low-prep" && meal.prep.some((pr) => /no-cook|assemble|portable/.test(pr))) s += 2;
  return s;
}

/**
 * Return true when this meal should be excluded based on hard constraints
 * (allergies, or equipment — only when the equipment list is non-empty AND
 * none of the meal's prep options are available).
 */
function isExcluded(meal: FuelMeal, p: MealPersonalization): boolean {
  // Hard exclude: allergies, exclusions and Peak Mode's avoid list.
  if (ingredientsExcluded(meal.ingredients, p)) return true;
  // Equipment gate: only apply when the member listed at least one piece of equipment.
  const equipment = p.cookingEquipment ?? [];
  if (equipment.length > 0) {
    const EQUIPMENT_PREP_MAP: Record<string, string[]> = {
      stovetop: ["stovetop", "pan", "skillet", "non-stick", "pan-seared", "soft-scramble", "meal-prep"],
      oven: ["baked", "oven", "roasted"],
      grill: ["grilled"],
      "air-fryer": ["air fryer", "air-fryer"],
      microwave: ["microwave"],
      "slow-cooker": ["slow-cooker", "slow cooker"],
    };
    // Collect the full set of prep keywords available to this member.
    const availablePrep = equipment.flatMap((eq) => EQUIPMENT_PREP_MAP[eq] ?? []);
    // A meal is excluded only when NONE of its prep options match any available prep.
    const hasNoCookOption = meal.prep.some((pr) => /no-cook|assemble|portable/.test(pr));
    if (!hasNoCookOption) {
      const anyAvailable = meal.prep.some((pr) =>
        availablePrep.some((ap) => normalize(pr).includes(normalize(ap)) || normalize(ap).includes(normalize(pr))),
      );
      if (!anyAvailable) return true;
    }
  }
  return false;
}

function pickMeal(
  slot: MealSlot,
  goal: FuelGoal,
  isTrainingDay: boolean,
  personalization?: MealPersonalization,
  usedProteinGroups?: Set<ProteinGroup>,
  nearSleep = false,
): FuelMeal {
  const p = personalization ?? {};
  const allForSlot = FUEL_MEALS.filter((m) => m.slot === slot);
  // Remove hard-excluded meals (allergy / equipment-only).
  const eligible = allForSlot.filter((m) => !isExcluded(m, p));
  // Fallback to full slot list (then all meals) so the plan never breaks.
  const pool = eligible.length ? eligible : allForSlot.length ? allForSlot : FUEL_MEALS;
  // Filter by goal then apply personalization score.
  const goalFit = pool.filter((m) => m.goalFit.includes(goal));
  const candidates = goalFit.length ? goalFit : pool;
  // Sort: higher personalization score first; variety rotation soft penalty;
  // late-evening penalty for heavy plates; training-day tie-break.
  const sorted = [...candidates].sort((a, b) => {
    let sa = personalizationScore(a, p);
    let sb = personalizationScore(b, p);
    // Soft penalty (-4) when protein group already appeared today — prefer rotation.
    if (usedProteinGroups && a.proteinGroup && usedProteinGroups.has(a.proteinGroup)) sa -= 4;
    if (usedProteinGroups && b.proteinGroup && usedProteinGroups.has(b.proteinGroup)) sb -= 4;
    // Strong penalty (-8) for heavy plates (e.g. ribeye) when the slot is near sleep.
    if (nearSleep && a.avoidLateEvening) sa -= 8;
    if (nearSleep && b.avoidLateEvening) sb -= 8;
    if (sb !== sa) return sb - sa;
    return isTrainingDay ? 0 : 1;
  });
  return sorted[0] ?? FUEL_MEALS[0];
}

const WINDOW_TO_SLOT: Record<string, MealSlot> = {
  "morning-anchor": "breakfast",
  midday: "lunch",
  "pre-workout": "pre-workout",
  "post-workout": "post-workout",
  night: "dinner",
};

export type DailyFuelPlanInput = {
  goal: FuelGoal;
  isTrainingDay: boolean;
  sessionName: string;
  mealWindows: MealWindowInput[];
  bodyweightLb: number | null;
  /** Member favorite (signature) meals — preferred when they fit the slot. */
  favorites?: PlanFavoriteInput[];
  /** Optional personalization — filters and boosts meal selection. Safe defaults when omitted. */
  personalization?: MealPersonalization;
  /**
   * "HH:MM" sleep target. Meals whose engine-computed time falls at or after
   * (sleepTarget - 30 min) are removed from the generated plan. This prevents
   * late meals appearing after the member's bedtime.
   */
  sleepTarget?: string;
  /** "HH:MM" wake time — used to avoid inserting smart snacks before the member is up. */
  wakeTime?: string;
  /**
   * True when a user-entered evening log (peptide/compound/hormone) exists near
   * the sleep window. Adds a safe log-only note to the plan — no compound guidance.
   */
  hasEveningLog?: boolean;
  /**
   * The plan's date ("YYYY-MM-DD"). With a date the day's plates rotate
   * through the member's own foods, the same way every time for that date.
   * Without one the plan keeps the fixed library plates.
   */
  date?: string;
  /** Meals already logged today: a logged plate stays exactly as logged. */
  loggedMealIds?: readonly string[];
  /**
   * The protocol↔nutrition engine's resolved macro set for today (already picked
   * by day kind — training / rest / lower-body / high-output / conditioning).
   * When present it REPLACES the goal+bodyweight estimate as the day's target, so
   * the plates scale to the protocol, phase and today's training. Omit (or null)
   * to keep the estimate — e.g. in Peak Mode, where the look sets the intent, or
   * when no bodyweight is on file so the engine returns no numbers.
   */
  macroTarget?: MacroTargets | null;
};

export type DailyFuelPlan = {
  goal: FuelGoal;
  isTrainingDay: boolean;
  sessionName: string;
  targets: FuelTargets;
  meals: PlannedFuelMeal[];
  snack: FuelSnack;
  summary: string;
  /**
   * Quiet note about any timing adjustments made — bedtime cutoff, smart snack
   * insertion, or evening-log awareness. Shown as a secondary line in the UI.
   * Undefined when no adjustments were needed.
   */
  timingNote?: string;
  /** Set when the member's filters left too few foods and the rotation widened within safe foods. */
  varietyNote?: string;
};

/** Build the quiet personalization tags for a meal that was chosen from the seed library. */
function buildPersonalizationTags(meal: FuelMeal, p: MealPersonalization): string[] {
  const tags: string[] = [];
  // Favourite protein match.
  const matchedProtein = (p.favoriteProteinSources ?? []).find((src) =>
    meal.ingredients.some((ing) => normalize(ing).includes(normalize(src))),
  );
  if (matchedProtein) tags.push(`${matchedProtein} · your pick`);
  // Favourite carb match.
  const matchedCarb = (p.favoriteCarbSources ?? []).find((src) =>
    meal.ingredients.some((ing) => normalize(ing).includes(normalize(src))),
  );
  if (matchedCarb) tags.push(`${matchedCarb} · your pick`);
  // Low-prep match.
  if (p.prepPreference === "low-prep" && meal.prep.some((pr) => /no-cook|assemble|portable/.test(pr))) {
    tags.push("Low-prep");
  }
  return tags;
}

/* ─── Window shares ───────────────────────────────────────────────────────
   How today's targets split across the plated meals. Protein is spread
   evenly with a little more after training; carbs lean toward the session;
   fat sits away from it. Fixed plates (favourites, smart snacks) come off
   the day first, so the plates add up to the day. */
const SHARE_WEIGHT: Record<MealSlot, { p: number; c: number; f: number }> = {
  breakfast: { p: 1, c: 1, f: 1.2 },
  lunch: { p: 1, c: 1, f: 1 },
  "pre-workout": { p: 0.75, c: 1.25, f: 0.35 },
  "post-workout": { p: 1.1, c: 1.35, f: 0.5 },
  dinner: { p: 1, c: 0.8, f: 1.15 },
  snack: { p: 0.6, c: 0.6, f: 0.6 },
};
/** A plated meal never shrinks below this, however much the fixed plates already cover. */
const SHARE_FLOOR: FuelMacros = { proteinG: 25, carbsG: 15, fatG: 5, calories: 300 };

/** Each plated slot's share of what the day has left after fixed plates. */
export function windowShares(slots: readonly MealSlot[], day: Pick<FuelMacros, "proteinG" | "carbsG" | "fatG">, fixed: FuelMacros): FuelMacros[] {
  const left = {
    proteinG: Math.max(0, day.proteinG - fixed.proteinG),
    carbsG: Math.max(0, day.carbsG - fixed.carbsG),
    fatG: Math.max(0, day.fatG - fixed.fatG),
  };
  const total = slots.reduce((acc, s) => ({ p: acc.p + SHARE_WEIGHT[s].p, c: acc.c + SHARE_WEIGHT[s].c, f: acc.f + SHARE_WEIGHT[s].f }), { p: 0, c: 0, f: 0 });
  return slots.map((s) => {
    const w = SHARE_WEIGHT[s];
    const proteinG = Math.max(SHARE_FLOOR.proteinG, Math.round((left.proteinG * w.p) / (total.p || 1)));
    const carbsG = Math.max(SHARE_FLOOR.carbsG, Math.round((left.carbsG * w.c) / (total.c || 1)));
    const fatG = Math.max(SHARE_FLOOR.fatG, Math.round((left.fatG * w.f) / (total.f || 1)));
    return { proteinG, carbsG, fatG, calories: Math.max(SHARE_FLOOR.calories, proteinG * 4 + carbsG * 4 + fatG * 9) };
  });
}

/** Daytime smart snacks rotate through these kinds. */
const SNACK_DAY_KINDS = new Set<SnackKind>(["protein", "travel", "recovery", "low-prep"]);

/** A snack the member's allergies, exclusions or Peak Mode avoid list rule out. */
function snackExcluded(snack: FuelSnack, p: MealPersonalization): boolean {
  const lines = [...snack.ingredients, ...(snack.ingredientsDetailed ?? []).map((d) => d.name)];
  return ingredientsExcluded(lines, p) || (p.dairyAllowed === false && lines.some((l) => ingredientTags(l).includes("dairy")));
}

const addMacros = (a: FuelMacros, b: FuelMacros): FuelMacros => ({
  calories: a.calories + b.calories,
  proteinG: a.proteinG + b.proteinG,
  carbsG: a.carbsG + b.carbsG,
  fatG: a.fatG + b.fatG,
});
const ZERO_MACROS: FuelMacros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function buildDailyFuelPlan(input: DailyFuelPlanInput): DailyFuelPlan {
  const { goal, isTrainingDay, mealWindows } = input;
  const favorites = input.favorites ?? [];
  const p = input.personalization ?? {};
  /* Protocol-aligned macros take over the day's target when the engine has them;
     otherwise fall back to the goal + bodyweight estimate (Peak Mode, or no
     bodyweight on file). Either way the plates scale to `targets` below. */
  const targets = fuelTargetsFromMacros(input.macroTarget, input.bodyweightLb) ?? estimateDailyTargets(goal, input.bodyweightLb, isTrainingDay);

  /* ── Bedtime cutoff ────────────────────────────────────────────────────────
     Any meal whose scheduled time falls within 30 min of the sleep target (or
     after it) is removed from the plan. This prevents the plan from showing
     meals at 10–11 PM when the member's bedtime is 9:30 PM.
     The cutoff is sleep − 30 min so there's a quiet wind-down buffer.
     Midnight crossover is handled by shifting sub-4-AM times to the next day. */
  const sleepMins = hhmToMins(input.sleepTarget);
  const wakeMins = hhmToMins(input.wakeTime) ?? 6 * 60;
  /* The member's day runs from wake: anything before wake is after midnight, so a
     shift worker sleeping at 7 AM keeps a 5 AM meal before their sleep target. */
  const onDay = (mins: number) => (mins < wakeMins ? mins + 1440 : mins);
  const adjSleep = sleepMins !== null ? (sleepMins <= wakeMins ? sleepMins + 1440 : sleepMins) : null;
  const sleepCutoff = adjSleep !== null ? adjSleep - 30 : null;

  const windows = mealWindows.filter((w) => {
    if (!w.enabled) return false;
    if (sleepCutoff !== null) {
      const mealMin = hhmToMins(w.time);
      if (mealMin !== null) {
        const adjMeal = onDay(mealMin);
        if (adjMeal >= sleepCutoff) return false;
      }
    }
    return true;
  });

  /* Track how many enabled windows were filtered out for the timing note. */
  const filteredCount = mealWindows.filter((w) => w.enabled).length - windows.length;

  /* ── Smart snack insertion — bridge gaps > 4 hours during waking hours ──
     Gaps wider than 4 hours between consecutive planned meals get a smart
     snack inserted at roughly 2.5 hours after the earlier meal.
     Evening snacks are protein-forward and kept light (night kind).
     The snack is skipped when it would fall past the sleep cutoff. The
     optional shake is not fuel the day can count on, so gaps are measured
     between real meals. Snacks depend only on the meal times, so they are
     known before any meal is plated. */
  const smartSnacks: PlannedFuelMeal[] = [];
  const snackDay = input.date ? dayIndexOfDate(input.date) : 0;
  const mealTimings = windows
    .filter((w) => w.kind !== "shake")
    .map((w) => ({ id: w.id, mins: hhmToMins(w.time) }))
    .filter((m): m is { id: string; mins: number } => m.mins !== null)
    .sort((a, b) => onDay(a.mins) - onDay(b.mins));

  for (let i = 0; i < mealTimings.length - 1; i++) {
    const aMin = onDay(mealTimings[i].mins);
    const bMin = onDay(mealTimings[i + 1].mins);
    const gap = bMin - aMin;
    if (gap <= 240) continue; // ≤ 4 hours — no snack needed
    const snackAt = aMin + 150; // ~2.5 h after the earlier meal
    if (snackAt < wakeMins) continue; // before wake — skip
    if (sleepCutoff !== null && snackAt >= sleepCutoff) continue; // past sleep cutoff — skip
    const isEvening = (snackAt % 1440) >= 19 * 60;
    /* With a date, the snack rotates through the ones the member can have; without one it is the first of its kind. */
    const rotating = input.date
      ? FUEL_SNACKS.filter((s) => (isEvening ? s.kind === "night" : SNACK_DAY_KINDS.has(s.kind) && s.macros.proteinG >= 15) && !snackExcluded(s, p))
      : [];
    const snack = rotating.length
      ? rotating[(((snackDay + i) % rotating.length) + rotating.length) % rotating.length]
      : isEvening
        ? (FUEL_SNACKS.find((s) => s.kind === "night") ?? FUEL_SNACKS[0])
        : (FUEL_SNACKS.find((s) => s.kind === "protein") ?? FUEL_SNACKS[0]);
    const snackTimeStr = minsToHHMM(snackAt % 1440);
    smartSnacks.push({
      id: `fuel-smart-snack-${snackTimeStr.replace(":", "")}`,
      slot: "snack",
      windowLabel: isEvening ? "Evening Smart Snack" : "Mid-Day Smart Snack",
      time: snackTimeStr,
      name: snack.name,
      ingredients: snack.ingredients,
      ingredientsDetailed: snack.ingredientsDetailed,
      macros: snack.macros,
      prep: ["no-cook", "assemble"],
      covers: ["protein"],
      smartRead: `Smart snack to bridge a ${Math.round(gap / 60)}-hour gap. ${snack.smartRead}`,
      isSnack: true,
    });
  }

  /* ── Each window: the shake, a favourite, or a plate ─────────────────────── */
  const slotOf = (w: MealWindowInput): MealSlot => w.slot ?? WINDOW_TO_SLOT[w.id] ?? "snack";
  const nearSleepOf = (w: MealWindowInput): boolean => {
    if (adjSleep === null) return false;
    const mMin = hhmToMins(w.time);
    return mMin !== null && onDay(mMin) >= adjSleep - 150;
  };
  const trainingNoteOf = (slot: MealSlot) =>
    slot === "pre-workout" ? " Carbs are placed close to the session to fuel output."
      : slot === "post-workout" ? " Protein and carbs land in the recovery window after training."
        : "";

  const usedFavorites = new Set<string>();
  const favoriteFor = new Map<string, PlanFavoriteInput>();
  for (const w of windows) {
    if (w.kind === "shake") continue;
    const fav = favorites.find((f) => f.slot === slotOf(w) && f.macros && !usedFavorites.has(f.id));
    if (fav) {
      usedFavorites.add(fav.id);
      favoriteFor.set(w.id, fav);
    }
  }

  /* The day's rotation: on when the plan knows its date (and serves the member's diet style). */
  const kitchen = input.date
    ? resolveKitchen({
        favoriteProteins: p.favoriteProteinSources,
        favoriteCarbs: p.favoriteCarbSources,
        kitchen: p.kitchen ?? null,
        allergies: p.allergies,
        excluded: p.excludedFoods,
        disliked: p.dislikedFoods,
        dietStyle: p.dietStyle,
        dairyAllowed: p.dairyAllowed,
        prepPreference: p.prepPreference,
      })
    : null;
  const plated = kitchen
    ? windows.filter((w) => w.kind !== "shake" && !favoriteFor.has(w.id) && slotOf(w) !== "snack")
    : [];
  const composed = new Map<string, ComposedPlate | null>();
  const pinnedLibrary = new Map<string, FuelMeal>();
  if (kitchen && plated.length) {
    const fixed = [...smartSnacks.map((m) => m.macros), ...[...favoriteFor.values()].map((f) => f.macros as FuelMacros)].reduce(addMacros, ZERO_MACROS);
    const shares = windowShares(plated.map(slotOf), targets, fixed);
    const logged = input.loggedMealIds ?? [];
    const slots: RotationSlot[] = plated.map((w, i) => {
      /* A meal logged in this window today stays exactly as logged, even if the plan's inputs moved since. */
      const prefix = `fuel-${w.id}-`;
      const rest = logged.find((id) => id.startsWith(prefix))?.slice(prefix.length) ?? null;
      const pinned = rest ? parsePlateId(rest) : null;
      if (rest && !pinned) {
        const library = FUEL_MEALS.find((m) => m.id === rest);
        if (library) pinnedLibrary.set(w.id, library);
      }
      return { key: w.id, slot: slotOf(w), nearSleep: nearSleepOf(w), target: shares[i], pinned };
    });
    /* Library meals logged earlier today keep their window; the rest of the day rotates around them. */
    const open = slots.filter((s) => !pinnedLibrary.has(s.key));
    const plates = planDayPlates({ dayIndex: dayIndexOfDate(input.date as string), kitchen, slots: open });
    open.forEach((s, i) => composed.set(s.key, plates[i]));
  }

  const usedProteinGroups = new Set<ProteinGroup>();
  const meals: PlannedFuelMeal[] = windows.map((w) => {
    const slot = slotOf(w);
    /* The pre-workout shake slot is food only, optional, and never a plate or a favorite. */
    if (w.kind === "shake") {
      const shake = buildPreWorkoutShake(w.shakeStyle ?? "fasted", p);
      return {
        id: `fuel-${w.id}-${shake.id}`,
        slot, windowLabel: w.label, time: w.time, name: shake.name,
        ingredients: shake.ingredients, ingredientsDetailed: shake.ingredientsDetailed,
        macros: shake.macros, prep: ["no-cook", "assemble"], covers: [],
        smartRead: shake.smartRead,
        isSnack: true,
        optional: true,
      };
    }
    const trainingNote = trainingNoteOf(slot);
    const fav = favoriteFor.get(w.id);
    if (fav && fav.macros) {
      return {
        id: `fuel-${w.id}-fav-${fav.id}`,
        slot, windowLabel: w.label, time: w.time, name: fav.name,
        ingredients: fav.ingredients ?? [], macros: fav.macros, prep: ["your recipe"], covers: ["protein"],
        smartRead: `From your favorites — repeated for consistency.${trainingNote}`,
        isSnack: false, fromFavorite: true, favoriteId: fav.id,
      };
    }
    const plate = composed.get(w.id);
    if (plate) {
      return {
        id: `fuel-${w.id}-${plate.id}`,
        slot, windowLabel: w.label, time: w.time, name: plate.name,
        ingredients: plate.ingredients, ingredientsDetailed: plate.ingredientsDetailed,
        macros: plate.macros, prep: plate.prep, covers: plate.covers,
        smartRead: plate.smartRead + trainingNote,
        isSnack: false,
        personalizationTags: plate.personalizationTags.length ? plate.personalizationTags : undefined,
      };
    }
    const meal = pinnedLibrary.get(w.id) ?? pickMeal(slot, goal, isTrainingDay, p, usedProteinGroups, nearSleepOf(w));
    // Register protein group so the next slot avoids the same source.
    if (meal.proteinGroup) usedProteinGroups.add(meal.proteinGroup);
    const tags = buildPersonalizationTags(meal, p);
    return {
      id: `fuel-${w.id}-${meal.id}`,
      slot, windowLabel: w.label, time: w.time, name: meal.name,
      ingredients: meal.ingredients, ingredientsDetailed: meal.ingredientsDetailed,
      macros: meal.macros, prep: meal.prep, covers: meal.covers,
      smartRead: meal.smartRead + trainingNote,
      isSnack: false,
      personalizationTags: tags.length ? tags : undefined,
    };
  });

  /* Merge and sort all meals chronologically. */
  const allMeals = [...meals, ...smartSnacks].sort((a, b) => {
    const aMin = hhmToMins(a.time);
    const bMin = hhmToMins(b.time);
    return (aMin === null ? 9999 : onDay(aMin)) - (bMin === null ? 9999 : onDay(bMin));
  });

  /* ── Build output ─────────────────────────────────────────────────────── */
  const snackRec = recommendSnackPersonalized(goal, isTrainingDay, p);

  const baseSum = isTrainingDay
    ? `High-output day. Protein is distributed across meals and carbs concentrate around ${input.sessionName || "training"}.`
    : "Recovery day. Protein stays consistent, carbs are controlled, and vegetable-forward foods lead.";

  const adjustments: string[] = [];
  if (filteredCount > 0 && input.sleepTarget) {
    adjustments.push(`Late meals moved earlier to protect the sleep window.`);
  }
  if (smartSnacks.length > 0) {
    adjustments.push(`Smart snack inserted to prevent long fuel gaps.`);
  }
  if (input.hasEveningLog) {
    adjustments.push(`Meal timing keeps the sleep window clear around user-entered logs.`);
  }
  const timingNote = adjustments.length ? adjustments.join(" ") : undefined;

  return {
    goal, isTrainingDay, sessionName: input.sessionName, targets,
    meals: allMeals, snack: snackRec,
    summary: baseSum,
    timingNote,
    varietyNote: kitchen?.notes[0],
  };
}

/** Protein from the meals the member logged — the one sum every surface shows ("est · logged meals"). */
export function summarizeLoggedProtein(
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "macros">>,
  loggedMealIds: readonly string[],
  overrides: Readonly<Record<string, Pick<PlannedFuelMeal, "macros">>> = {},
): number {
  return meals
    .filter((m) => loggedMealIds.includes(m.id))
    .reduce((sum, m) => sum + (overrides[m.id] ?? m).macros.proteinG, 0);
}

/** Everything the member logged today, from the plan's estimates — protein, carbs, fat and calories. */
export type LoggedMacros = FuelMacros & { mealsLogged: number };

/** Macros from the meals the member logged (the same estimates `summarizeLoggedProtein` sums). */
export function summarizeLoggedMacros(
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "macros">>,
  loggedMealIds: readonly string[],
  overrides: Readonly<Record<string, Pick<PlannedFuelMeal, "macros">>> = {},
): LoggedMacros {
  return meals
    .filter((m) => loggedMealIds.includes(m.id))
    .reduce<LoggedMacros>(
      (sum, m) => {
        const x = (overrides[m.id] ?? m).macros;
        return {
          calories: sum.calories + x.calories,
          proteinG: sum.proteinG + x.proteinG,
          carbsG: sum.carbsG + x.carbsG,
          fatG: sum.fatG + x.fatG,
          mealsLogged: sum.mealsLogged + 1,
        };
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, mealsLogged: 0 },
    );
}

/* ─── Night closeout (late-day intelligence) ──────────────────────────────
   Late in the day the system stops acting like every missed meal is still
   open. Within 90 min of sleep — or once the final planned window has passed —
   Reserve shifts into closeout: protect sleep, don't backload heavy food, offer
   at most one light protein-forward snack, and point at tomorrow's reset.
   Pure + deterministic. No medical, hormone, or dosage language. ─────────── */
export type NightCloseoutInput = {
  /** Current wall-clock time in minutes from midnight. */
  nowMinutes: number;
  /** "HH:MM" sleep target. */
  sleepTarget?: string | null;
  /** Today's planned meals. */
  meals: PlannedFuelMeal[];
  loggedMealIds: string[];
  proteinLogged: number;
  proteinTarget: number;
};

export type NightCloseoutPlan = {
  /** Closeout mode is on — render calm closeout instead of an open-day spreadsheet. */
  active: boolean;
  minutesToSleep: number | null;
  /** Count of planned (non-snack) meals whose window passed and were not logged. */
  missedCount: number;
  proteinBehind: boolean;
  /** True when protein is behind and bedtime is near — offer ONE light snack. */
  recommendSnack: boolean;
  /** The single light, protein-forward closeout option (or null). */
  snack: FuelSnack | null;
  headline: string;
  /** Calm closeout copy lines. */
  lines: string[];
  /** Tomorrow's fuel priorities — coaching the next move, not shaming today. */
  tomorrowPriorities: string[];
};

const NIGHT_TOMORROW_PRIORITIES = [
  "Breakfast protein anchor",
  "Post-training recovery plate",
  "Midday protein meal",
];

/** A light, protein-forward, low-fat option for the sleep window. */
function pickCloseoutSnack(): FuelSnack | null {
  const light = FUEL_SNACKS.filter((s) => s.macros.fatG <= 6 && s.macros.proteinG >= 18);
  return light.find((s) => s.kind === "night")
    ?? light.find((s) => s.kind === "protein")
    ?? light[0]
    ?? null;
}

export function buildNightCloseout(input: NightCloseoutInput): NightCloseoutPlan {
  const sleepMins = hhmToMins(input.sleepTarget);
  const adjSleep = sleepMins !== null && sleepMins < 4 * 60 ? sleepMins + 1440 : sleepMins;
  const adjNow = input.nowMinutes < 4 * 60 ? input.nowMinutes + 1440 : input.nowMinutes;
  const minutesToSleep = adjSleep !== null ? adjSleep - adjNow : null;

  // Final planned meal window (adjusted for after-midnight crossover).
  const mealMins = input.meals
    .map((m) => hhmToMins(m.time))
    .filter((n): n is number => n !== null)
    .map((n) => (n < 4 * 60 ? n + 1440 : n));
  const lastMealMins = mealMins.length ? Math.max(...mealMins) : null;

  const withinSleepWindow = minutesToSleep !== null && minutesToSleep <= 90;
  const afterFinalWindow = lastMealMins !== null && adjNow >= lastMealMins;
  const active = adjSleep !== null && (withinSleepWindow || afterFinalWindow);

  // Missed = planned meals (not smart snacks) unlogged whose window has passed.
  const missed = input.meals.filter((m) => {
    if (m.isSnack) return false;
    if (input.loggedMealIds.includes(m.id)) return false;
    const t = hhmToMins(m.time);
    if (t === null) return false;
    const adjT = t < 4 * 60 ? t + 1440 : t;
    return adjT <= adjNow;
  });

  const proteinBehind = input.proteinLogged < input.proteinTarget;
  const recommendSnack = active && proteinBehind;
  const snack = recommendSnack ? pickCloseoutSnack() : null;

  const lines: string[] = [];
  if (active) {
    lines.push("Don't chase missed meals into the sleep window.");
    lines.push(recommendSnack
      ? "Use one light protein-forward snack only if needed."
      : "Protein is handled — protect sleep and let the body recover.");
    lines.push("Missed meals are logged as missed signal — tomorrow's fuel plan resets.");
  }

  return {
    active,
    minutesToSleep,
    missedCount: missed.length,
    proteinBehind,
    recommendSnack,
    snack,
    headline: active ? "Close the day." : "Evening fuel",
    lines,
    tomorrowPriorities: NIGHT_TOMORROW_PRIORITIES,
  };
}

/* ─── Weekly fuel plan (aligned to the shared training week) ──────────────── */
export type WeeklyFuelDay = {
  day: string;
  sessionName: string;
  recovery: boolean;
  emphasis: string;
  leadMeal: string;
  carbCue: "higher" | "moderate" | "controlled";
};

export type WeeklyTrainingDayInput = { day: string; sessionName: string; recovery: boolean };

/**
 * The week, day by day. `leadMeals[i]` (when given) is day i's own lead plate
 * from that day's rotation; without it the day falls back to the library.
 */
export function buildWeeklyFuelPlan(week: WeeklyTrainingDayInput[], goal: FuelGoal, leadMeals?: ReadonlyArray<string | null>): WeeklyFuelDay[] {
  return week.map((d, i) => {
    const lead = leadMeals?.[i] ?? (d.recovery ? pickMeal("breakfast", goal, false).name : pickMeal("dinner", goal, !d.recovery).name);
    return {
      day: d.day,
      sessionName: d.sessionName,
      recovery: d.recovery,
      emphasis: d.recovery
        ? "Protein consistent · controlled carbs · vegetable + fiber forward"
        : "Carbs timed near training · protein distributed · easy post-session refuel",
      leadMeal: lead,
      carbCue: d.recovery ? "controlled" : goal === "shred" ? "moderate" : "higher",
    };
  });
}

/* ─── Meal configurations (food portions only — never "dose") ─────────────── */
export type MealConfigKey = "shred" | "muscle" | "recomp" | "high-carb" | "recovery" | "low-prep" | "travel";

type MealConfig = {
  key: MealConfigKey;
  label: string;
  /** Macro multipliers applied to the base meal (estimates). */
  scale: { calories: number; proteinG: number; carbsG: number; fatG: number };
  note: string;
  /** Optional prep override. */
  prep?: string[];
};

export const MEAL_CONFIGS: MealConfig[] = [
  { key: "shred", label: "Shred", scale: { calories: 0.85, proteinG: 1.05, carbsG: 0.8, fatG: 0.78 }, note: "Leaner portions — lean protein forward, smaller carb and fat servings." },
  { key: "muscle", label: "Muscle", scale: { calories: 1.22, proteinG: 1.0, carbsG: 1.4, fatG: 1.1 }, note: "Bigger portions — a full protein serving plus extra carbs to support size." },
  { key: "recomp", label: "Recomp", scale: { calories: 1.0, proteinG: 1.1, carbsG: 0.95, fatG: 0.9 }, note: "Protein-forward portions with steady carbs and slightly lower fat." },
  { key: "high-carb", label: "High-Carb Training Day", scale: { calories: 1.15, proteinG: 1.0, carbsG: 1.45, fatG: 0.82 }, note: "Higher-carb training-day portions placed near the session; fats kept lower." },
  { key: "recovery", label: "Recovery Day", scale: { calories: 0.92, proteinG: 1.0, carbsG: 0.82, fatG: 1.0 }, note: "Recovery-day portions — controlled carbs, vegetable-forward." },
  { key: "low-prep", label: "Low-Prep", scale: { calories: 1.0, proteinG: 1.0, carbsG: 1.0, fatG: 1.0 }, note: "Low-prep version — no-cook or one-pan assembly.", prep: ["no-cook", "one-pan", "assemble"] },
  { key: "travel", label: "Travel", scale: { calories: 1.0, proteinG: 1.0, carbsG: 1.0, fatG: 1.0 }, note: "Travel-friendly portable version with minimal prep.", prep: ["portable", "no-cook"] },
];

export function getMealConfig(key: MealConfigKey): MealConfig {
  return MEAL_CONFIGS.find((c) => c.key === key) ?? MEAL_CONFIGS[0];
}

/** Return a configuration-adjusted copy of a planned meal (food portions, estimates). */
export function applyMealConfig(meal: PlannedFuelMeal, key: MealConfigKey): PlannedFuelMeal {
  const cfg = getMealConfig(key);
  const base = meal.config ? stripConfig(meal) : meal;
  const macros: FuelMacros = {
    calories: Math.round(base.macros.calories * cfg.scale.calories),
    proteinG: Math.round(base.macros.proteinG * cfg.scale.proteinG),
    carbsG: Math.round(base.macros.carbsG * cfg.scale.carbsG),
    fatG: Math.round(base.macros.fatG * cfg.scale.fatG),
  };
  return {
    ...base,
    macros,
    prep: cfg.prep ?? base.prep,
    smartRead: `${base.smartRead} ${cfg.note}`,
    config: cfg.label,
    configBase: { macros: base.macros, prep: base.prep, smartRead: base.smartRead },
  };
}

/** Restore a meal's base macros/read before re-configuring: the copy kept on the meal, else the seed. */
function stripConfig(meal: PlannedFuelMeal): PlannedFuelMeal {
  if (meal.configBase) return { ...meal, ...meal.configBase, config: undefined, configBase: undefined };
  const seed = FUEL_MEALS.find((m) => m.name === meal.name);
  if (!seed) return { ...meal, config: undefined };
  return { ...meal, macros: seed.macros, prep: seed.prep, smartRead: seed.smartRead, config: undefined };
}
