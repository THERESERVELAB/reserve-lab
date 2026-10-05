/**
 * FINAL BOSS ATHLETE — Nutrition Quick Combos
 *
 * Pre-defined meal combos for quick logging.
 * Covers pre/post workout, morning, midday, evening, and snacks.
 * All macros are approximate — based on standard food weights.
 *
 * Usage:
 *   import { NUTRITION_COMBOS, comboToMealLog } from "@/lib/logging/nutrition-combos";
 */

import type { NutritionMealLog, MealTiming } from "./schemas";

export type ComboCategory =
  | "pre-workout"
  | "post-workout"
  | "morning"
  | "midday"
  | "evening"
  | "snack";

export type NutritionCombo = {
  id: string;
  name: string;
  category: ComboCategory;
  protein: number;   // grams
  carbs: number;     // grams
  fat: number;       // grams
  calories: number;
  foods: string[];
  timing: string;    // human-readable suggestion
  note: string;      // coaching context
  tags: string[];
};

/* ─── Combo Library ──────────────────────────────────── */

export const NUTRITION_COMBOS: NutritionCombo[] = [
  /* ── Pre-Workout ── */
  {
    id: "pre-rice-chicken",
    name: "Rice + Chicken Pre-Workout",
    category: "pre-workout",
    protein: 40, carbs: 65, fat: 8, calories: 496,
    foods: ["200g white rice (cooked)", "150g chicken breast", "light salt + hot sauce"],
    timing: "60–90 min before training",
    note: "Classic prep meal. High carb, moderate protein, low fat for fast digestion. Sets glycogen top-up before compound work.",
    tags: ["high-carb", "fast-digesting", "chicken", "training-day"],
  },
  {
    id: "pre-oat-whey",
    name: "Oat + Whey Pre-Workout",
    category: "pre-workout",
    protein: 35, carbs: 58, fat: 6, calories: 422,
    foods: ["80g rolled oats", "1 scoop whey (25g)", "1 medium banana", "water or almond milk"],
    timing: "45–60 min before training",
    note: "Mixed-release carbs (oats) + fast protein (whey). Good sustained energy window. Light enough to train on without digestive stress.",
    tags: ["oats", "whey", "training-day", "quick-prep"],
  },
  {
    id: "pre-bagel-egg",
    name: "Bagel + Eggs Pre-Workout",
    category: "pre-workout",
    protein: 32, carbs: 55, fat: 10, calories: 442,
    foods: ["1 large bagel", "3 eggs scrambled", "light spread"],
    timing: "90 min before training",
    note: "Whole food pre-workout. Slightly higher fat — best used when training 90+ min away. Slower digestion than rice meals.",
    tags: ["whole-food", "eggs", "moderate-fat"],
  },

  /* ── Post-Workout ── */
  {
    id: "post-whey-rice",
    name: "Whey + White Rice Post-Workout",
    category: "post-workout",
    protein: 45, carbs: 75, fat: 3, calories: 507,
    foods: ["1.5 scoops whey (37g protein)", "200g white rice (cooked)", "electrolyte drink"],
    timing: "Within 30–45 min of training",
    note: "Fast protein + fast carbs. Classic post-workout window. Prioritize this over whole foods when timeline is tight. High leucine from whey triggers mTOR.",
    tags: ["fast-digesting", "whey", "anabolic-window", "priority-meal"],
  },
  {
    id: "post-eggs-potato",
    name: "Eggs + White Potato Post-Workout",
    category: "post-workout",
    protein: 42, carbs: 52, fat: 14, calories: 502,
    foods: ["4 whole eggs", "200g white potato (boiled)", "light seasoning"],
    timing: "Within 45–60 min of training",
    note: "Whole food alternative when whey is unavailable. Slightly slower but nutrient dense. Potatoes outperform rice on satiety index.",
    tags: ["whole-food", "eggs", "potato", "slower-digesting"],
  },
  {
    id: "post-turkey-rice",
    name: "Ground Turkey + Rice Post-Workout",
    category: "post-workout",
    protein: 50, carbs: 65, fat: 9, calories: 541,
    foods: ["200g ground turkey 93%", "200g white rice (cooked)", "hot sauce + salt"],
    timing: "Within 60 min of training",
    note: "High protein post-workout meal. Turkey is lower fat than beef — maximizes protein density per calorie.",
    tags: ["high-protein", "turkey", "whole-food"],
  },

  /* ── Morning ── */
  {
    id: "morning-eggs-oats",
    name: "High-Protein Breakfast",
    category: "morning",
    protein: 50, carbs: 42, fat: 22, calories: 562,
    foods: ["5 whole eggs", "70g oats", "1 tbsp almond butter", "black coffee"],
    timing: "First meal of the day",
    note: "Strong protein anchor to start the day. Mixed macro profile. Sets leucine threshold early and drives satiety for hours.",
    tags: ["high-protein", "eggs", "oats", "satiety"],
  },
  {
    id: "morning-greek-yogurt",
    name: "Greek Yogurt + Granola Parfait",
    category: "morning",
    protein: 38, carbs: 52, fat: 8, calories: 432,
    foods: ["300g 0% Greek yogurt", "40g granola", "mixed berries", "optional: 0.5 scoop whey"],
    timing: "Morning — quick prep option",
    note: "High in casein (slow) + whey (fast) protein from dairy. Probiotics for gut health. Fast to prepare. Good leucine content.",
    tags: ["dairy", "quick-prep", "probiotics", "mixed-protein"],
  },
  {
    id: "morning-steak-eggs",
    name: "Steak + Eggs (High-Cal Training Day)",
    category: "morning",
    protein: 60, carbs: 5, fat: 30, calories: 530,
    foods: ["180g sirloin steak", "3 whole eggs", "black coffee"],
    timing: "Morning on heavy training days",
    note: "Creatine, iron, and zinc from red meat. Zero carbs — best used when carbs will come later in the day around training.",
    tags: ["red-meat", "high-protein", "low-carb", "creatine-source"],
  },

  /* ── Midday ── */
  {
    id: "midday-chicken-rice",
    name: "Chicken + Rice Bowl",
    category: "midday",
    protein: 50, carbs: 70, fat: 8, calories: 552,
    foods: ["200g chicken breast", "220g white rice (cooked)", "broccoli + olive oil drizzle"],
    timing: "Midday — main meal on training days",
    note: "Cornerstone training-day meal. High protein + high carb to support afternoon or evening training. Clean macro split.",
    tags: ["chicken", "high-carb", "training-day", "cornerstone-meal"],
  },
  {
    id: "midday-beef-rice",
    name: "Lean Beef + Rice Bowl",
    category: "midday",
    protein: 52, carbs: 65, fat: 14, calories: 598,
    foods: ["200g lean ground beef 93%", "200g white rice (cooked)", "hot sauce", "spinach"],
    timing: "Midday main — high-volume training days",
    note: "Beef adds creatine, iron, and B12. Slightly more calorie-dense than chicken — use on heavy training or high-volume days.",
    tags: ["beef", "creatine-source", "high-calorie", "training-day"],
  },
  {
    id: "midday-turkey-wrap",
    name: "Turkey Wrap",
    category: "midday",
    protein: 45, carbs: 48, fat: 12, calories: 472,
    foods: ["200g ground turkey", "1 large whole-grain tortilla", "spinach", "salsa", "light Greek yogurt"],
    timing: "Midday — portable meal option",
    note: "Lean protein source. Portable for on-the-go. Slightly lower carb — good on rest days or lighter activity days.",
    tags: ["turkey", "portable", "moderate-carb", "quick-prep"],
  },

  /* ── Evening ── */
  {
    id: "evening-salmon-rice",
    name: "Salmon + Rice + Roasted Veg",
    category: "evening",
    protein: 52, carbs: 55, fat: 20, calories: 608,
    foods: ["180g salmon fillet", "200g white rice (cooked)", "roasted broccoli + 1 tbsp olive oil"],
    timing: "Evening main meal",
    note: "Omega-3 rich from salmon. Anti-inflammatory support for recovery overnight. Higher fat is fine in the evening — no training impact.",
    tags: ["salmon", "omega-3", "anti-inflammatory", "evening"],
  },
  {
    id: "evening-steak-potato",
    name: "Steak + Sweet Potato",
    category: "evening",
    protein: 55, carbs: 42, fat: 14, calories: 510,
    foods: ["200g sirloin steak", "200g sweet potato (baked)", "asparagus", "salt + pepper"],
    timing: "Evening — high protein, moderate carb",
    note: "Iron-dense red meat with slow-digesting carbs from sweet potato. Creatine + zinc source. Good for heavy training days.",
    tags: ["red-meat", "sweet-potato", "high-protein", "creatine-source"],
  },
  {
    id: "evening-chicken-pasta",
    name: "Chicken + Pasta (Volume Day)",
    category: "evening",
    protein: 55, carbs: 80, fat: 10, calories: 642,
    foods: ["200g chicken breast", "120g dry pasta", "tomato sauce (low fat)", "parmesan 15g"],
    timing: "Evening — high-volume training day",
    note: "Highest calorie evening option. Use on days with 35+ working sets or double sessions. Pasta provides slower carb release.",
    tags: ["high-calorie", "pasta", "volume-day", "high-carb"],
  },

  /* ── Snacks ── */
  {
    id: "snack-cottage-night",
    name: "Cottage Cheese + Night Snack",
    category: "snack",
    protein: 40, carbs: 10, fat: 5, calories: 245,
    foods: ["300g cottage cheese 2%", "cinnamon or vanilla extract", "optional: 10g chia seeds"],
    timing: "Before bed — slow protein release",
    note: "Casein-dominant protein. Slow-digesting overnight. Supports muscle protein synthesis during sleep. Low calorie density.",
    tags: ["casein", "pre-sleep", "low-calorie", "slow-protein"],
  },
  {
    id: "snack-whey-banana",
    name: "Whey + Banana Quick Add",
    category: "snack",
    protein: 28, carbs: 30, fat: 2, calories: 250,
    foods: ["1 scoop whey protein (28g)", "1 medium banana"],
    timing: "Between meals or post-light-cardio",
    note: "Fast protein hit when behind on daily target. Banana provides potassium + quick carbs. Best in the first half of the day.",
    tags: ["quick-add", "whey", "catch-up", "portable"],
  },
  {
    id: "snack-rice-cakes-pb",
    name: "Rice Cakes + Peanut Butter",
    category: "snack",
    protein: 10, carbs: 40, fat: 16, calories: 340,
    foods: ["4 rice cakes", "2 tbsp peanut butter"],
    timing: "Pre-workout snack or midday filler",
    note: "Fast carbs (rice cakes) + fat + some protein. Use as pre-workout snack when a full meal isn't possible. Satisfying and portable.",
    tags: ["carb-snack", "fat", "portable", "quick-energy"],
  },
  {
    id: "snack-beef-jerky-apple",
    name: "Beef Jerky + Apple",
    category: "snack",
    protein: 22, carbs: 28, fat: 3, calories: 228,
    foods: ["60g beef jerky (low sodium)", "1 medium apple"],
    timing: "On-the-go snack or between meals",
    note: "Portable high-protein snack. Low fat. Apple provides fiber and fructose for liver glycogen. Good travel option.",
    tags: ["portable", "on-the-go", "lean", "high-protein"],
  },
];

/* ─── Lookup Helpers ─────────────────────────────────── */

export function getCombosByCategory(category: ComboCategory): NutritionCombo[] {
  return NUTRITION_COMBOS.filter((combo) => combo.category === category);
}

export function getComboById(id: string): NutritionCombo | null {
  return NUTRITION_COMBOS.find((combo) => combo.id === id) ?? null;
}

export function searchCombos(query: string): NutritionCombo[] {
  const q = query.toLowerCase();
  return NUTRITION_COMBOS.filter(
    (combo) =>
      combo.name.toLowerCase().includes(q) ||
      combo.tags.some((t) => t.includes(q)) ||
      combo.foods.some((f) => f.toLowerCase().includes(q)),
  );
}

export function getHighProteinCombos(minProtein = 40): NutritionCombo[] {
  return NUTRITION_COMBOS.filter((c) => c.protein >= minProtein).sort(
    (a, b) => b.protein - a.protein,
  );
}

/* ─── Convert Combo → Meal Log Entry ────────────────── */

export function comboToMealLog(
  combo: NutritionCombo,
  timingOverride?: MealTiming,
): Omit<NutritionMealLog, "id"> {
  const timing: MealTiming | null = timingOverride ?? categoryToTiming(combo.category);
  return {
    name: combo.name,
    protein: combo.protein,
    carbs: combo.carbs,
    fat: combo.fat,
    calories: combo.calories,
    timing,
    foods: combo.foods,
    isQuickAdd: true,
    comboId: combo.id,
    loggedAt: new Date().toISOString(),
  };
}

function categoryToTiming(category: ComboCategory): MealTiming | null {
  const map: Record<ComboCategory, MealTiming | null> = {
    "pre-workout": "pre-workout",
    "post-workout": "post-workout",
    "morning": "morning",
    "midday": "midday",
    "evening": "evening",
    "snack": "snack",
  };
  return map[category] ?? null;
}

/* ─── Quick Day Builder ──────────────────────────────── */

/**
 * Build a full training day meal plan from combos.
 * Returns combos that approximate a target macro split.
 */
export function buildQuickTrainingDay(): NutritionCombo[] {
  return [
    NUTRITION_COMBOS.find((c) => c.id === "morning-eggs-oats")!,
    NUTRITION_COMBOS.find((c) => c.id === "pre-rice-chicken")!,
    NUTRITION_COMBOS.find((c) => c.id === "post-whey-rice")!,
    NUTRITION_COMBOS.find((c) => c.id === "midday-chicken-rice")!,
    NUTRITION_COMBOS.find((c) => c.id === "evening-salmon-rice")!,
    NUTRITION_COMBOS.find((c) => c.id === "snack-cottage-night")!,
  ].filter(Boolean);
}

export function buildQuickRestDay(): NutritionCombo[] {
  return [
    NUTRITION_COMBOS.find((c) => c.id === "morning-eggs-oats")!,
    NUTRITION_COMBOS.find((c) => c.id === "midday-turkey-wrap")!,
    NUTRITION_COMBOS.find((c) => c.id === "evening-steak-potato")!,
    NUTRITION_COMBOS.find((c) => c.id === "snack-cottage-night")!,
  ].filter(Boolean);
}
