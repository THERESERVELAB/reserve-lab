/* ════════════════════════════════════════════════════════════════════════
   INGREDIENT MACRO ESTIMATOR — estimates only, never nutrition claims.
   ------------------------------------------------------------------------
   Deterministic per-ingredient macro estimation for member-authored meals:
   a curated food table (typical per-100g values), fuzzy name matching, and
   preparation-method adjustments. Every output is framed as an ESTIMATE —
   the UI must keep the "estimates, not medical nutrition advice" line.
   ════════════════════════════════════════════════════════════════════════ */

export type MacroEstimate = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type FoodEntry = {
  /** Match keys — first is the display name. */
  keys: string[];
  /** Typical macros per 100 g (cooked where that's how it's eaten). */
  per100g: MacroEstimate;
  /** Default portion in grams when the member gives no amount. */
  defaultGrams: number;
};

/* Typical-values table (per 100 g). Curated for the meals members actually
   log — proteins, carbs, produce, fats, dairy, pantry. */
const FOOD_TABLE: FoodEntry[] = [
  { keys: ["ground beef", "beef mince", "80/20 beef", "90/10 beef", "lean ground beef"], per100g: { calories: 250, proteinG: 26, carbsG: 0, fatG: 16 }, defaultGrams: 170 },
  { keys: ["chicken breast", "chicken"], per100g: { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }, defaultGrams: 170 },
  { keys: ["chicken thigh", "chicken thighs"], per100g: { calories: 209, proteinG: 26, carbsG: 0, fatG: 11 }, defaultGrams: 170 },
  { keys: ["steak", "sirloin", "ribeye", "flank"], per100g: { calories: 271, proteinG: 25, carbsG: 0, fatG: 19 }, defaultGrams: 200 },
  { keys: ["salmon"], per100g: { calories: 208, proteinG: 20, carbsG: 0, fatG: 13 }, defaultGrams: 170 },
  { keys: ["white fish", "cod", "tilapia", "halibut"], per100g: { calories: 105, proteinG: 23, carbsG: 0, fatG: 1 }, defaultGrams: 170 },
  { keys: ["shrimp", "prawns"], per100g: { calories: 99, proteinG: 24, carbsG: 0, fatG: 0.3 }, defaultGrams: 150 },
  { keys: ["ground turkey", "turkey mince", "turkey"], per100g: { calories: 189, proteinG: 27, carbsG: 0, fatG: 8 }, defaultGrams: 170 },
  { keys: ["93/7 ground beef", "93/7 beef", "lean ground beef 93/7"], per100g: { calories: 182, proteinG: 25, carbsG: 0, fatG: 9 }, defaultGrams: 170 },
  { keys: ["93/7 ground turkey", "93/7 turkey", "lean ground turkey"], per100g: { calories: 176, proteinG: 27, carbsG: 0, fatG: 7.5 }, defaultGrams: 170 },
  { keys: ["ground chicken", "chicken mince"], per100g: { calories: 172, proteinG: 24, carbsG: 0, fatG: 8 }, defaultGrams: 170 },
  { keys: ["egg", "eggs", "whole egg"], per100g: { calories: 155, proteinG: 13, carbsG: 1.1, fatG: 11 }, defaultGrams: 100 },
  { keys: ["egg white", "egg whites"], per100g: { calories: 52, proteinG: 11, carbsG: 0.7, fatG: 0.2 }, defaultGrams: 100 },
  { keys: ["greek yogurt", "yogurt"], per100g: { calories: 73, proteinG: 10, carbsG: 4, fatG: 1.9 }, defaultGrams: 170 },
  { keys: ["cottage cheese"], per100g: { calories: 98, proteinG: 11, carbsG: 3.4, fatG: 4.3 }, defaultGrams: 150 },
  { keys: ["whey protein", "protein powder", "whey", "protein scoop"], per100g: { calories: 380, proteinG: 78, carbsG: 8, fatG: 5 }, defaultGrams: 32 },
  { keys: ["whey isolate", "protein isolate", "isolate"], per100g: { calories: 400, proteinG: 86, carbsG: 4, fatG: 1 }, defaultGrams: 32 },
  { keys: ["eaa", "eaas", "essential amino acids", "intra-workout aminos"], per100g: { calories: 400, proteinG: 95, carbsG: 0, fatG: 0 }, defaultGrams: 12 },
  { keys: ["tofu"], per100g: { calories: 76, proteinG: 8, carbsG: 1.9, fatG: 4.8 }, defaultGrams: 150 },
  { keys: ["jasmine rice", "white rice", "rice"], per100g: { calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 }, defaultGrams: 200 },
  { keys: ["brown rice"], per100g: { calories: 112, proteinG: 2.6, carbsG: 24, fatG: 0.9 }, defaultGrams: 200 },
  { keys: ["gold potatoes", "potato", "potatoes", "yukon"], per100g: { calories: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1 }, defaultGrams: 200 },
  { keys: ["sweet potato", "sweet potatoes"], per100g: { calories: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1 }, defaultGrams: 200 },
  { keys: ["pasta", "spaghetti", "penne"], per100g: { calories: 157, proteinG: 5.8, carbsG: 31, fatG: 0.9 }, defaultGrams: 180 },
  { keys: ["oats", "oatmeal"], per100g: { calories: 379, proteinG: 13, carbsG: 68, fatG: 6.5 }, defaultGrams: 60 },
  { keys: ["cream of rice", "rice cereal"], per100g: { calories: 370, proteinG: 6.5, carbsG: 82, fatG: 0.5 }, defaultGrams: 40 },
  { keys: ["bread", "toast", "sourdough"], per100g: { calories: 265, proteinG: 9, carbsG: 49, fatG: 3.2 }, defaultGrams: 60 },
  { keys: ["tortilla", "wrap"], per100g: { calories: 310, proteinG: 8, carbsG: 51, fatG: 8 }, defaultGrams: 60 },
  { keys: ["quinoa"], per100g: { calories: 120, proteinG: 4.4, carbsG: 21, fatG: 1.9 }, defaultGrams: 180 },
  { keys: ["banana"], per100g: { calories: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 }, defaultGrams: 118 },
  { keys: ["berries", "blueberries", "strawberries", "raspberries"], per100g: { calories: 50, proteinG: 0.7, carbsG: 12, fatG: 0.3 }, defaultGrams: 120 },
  { keys: ["apple"], per100g: { calories: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 }, defaultGrams: 180 },
  { keys: ["watermelon"], per100g: { calories: 30, proteinG: 0.6, carbsG: 8, fatG: 0.2 }, defaultGrams: 200 },
  { keys: ["avocado"], per100g: { calories: 160, proteinG: 2, carbsG: 9, fatG: 15 }, defaultGrams: 75 },
  { keys: ["broccoli"], per100g: { calories: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4 }, defaultGrams: 150 },
  { keys: ["asparagus"], per100g: { calories: 20, proteinG: 2.2, carbsG: 3.9, fatG: 0.1 }, defaultGrams: 130 },
  { keys: ["green beans"], per100g: { calories: 31, proteinG: 1.8, carbsG: 7, fatG: 0.2 }, defaultGrams: 130 },
  { keys: ["spinach", "greens", "kale"], per100g: { calories: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 }, defaultGrams: 80 },
  { keys: ["mixed vegetables", "vegetables", "veggies"], per100g: { calories: 40, proteinG: 2, carbsG: 8, fatG: 0.3 }, defaultGrams: 150 },
  { keys: ["cucumber"], per100g: { calories: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 }, defaultGrams: 100 },
  { keys: ["tomato", "tomatoes"], per100g: { calories: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 }, defaultGrams: 100 },
  { keys: ["onion", "onions"], per100g: { calories: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1 }, defaultGrams: 60 },
  { keys: ["cilantro", "parsley", "mint", "basil", "herbs"], per100g: { calories: 23, proteinG: 2.1, carbsG: 3.7, fatG: 0.5 }, defaultGrams: 10 },
  { keys: ["olive oil", "oil"], per100g: { calories: 884, proteinG: 0, carbsG: 0, fatG: 100 }, defaultGrams: 14 },
  { keys: ["avocado oil"], per100g: { calories: 884, proteinG: 0, carbsG: 0, fatG: 100 }, defaultGrams: 14 },
  { keys: ["butter", "ghee"], per100g: { calories: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81 }, defaultGrams: 14 },
  { keys: ["peanut butter", "almond butter", "nut butter"], per100g: { calories: 588, proteinG: 25, carbsG: 20, fatG: 50 }, defaultGrams: 32 },
  { keys: ["almonds", "nuts", "cashews", "walnuts"], per100g: { calories: 579, proteinG: 21, carbsG: 22, fatG: 50 }, defaultGrams: 30 },
  { keys: ["cheese", "cheddar", "mozzarella"], per100g: { calories: 402, proteinG: 25, carbsG: 1.3, fatG: 33 }, defaultGrams: 30 },
  { keys: ["honey", "maple syrup"], per100g: { calories: 304, proteinG: 0.3, carbsG: 82, fatG: 0 }, defaultGrams: 21 },
  { keys: ["milk"], per100g: { calories: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 }, defaultGrams: 240 },
  { keys: ["almond milk"], per100g: { calories: 17, proteinG: 0.6, carbsG: 0.7, fatG: 1.2 }, defaultGrams: 240 },
  { keys: ["coconut water"], per100g: { calories: 19, proteinG: 0.7, carbsG: 3.7, fatG: 0.2 }, defaultGrams: 330 },
  { keys: ["chia seeds", "chia"], per100g: { calories: 486, proteinG: 17, carbsG: 42, fatG: 31 }, defaultGrams: 15 },
  { keys: ["lime", "lemon"], per100g: { calories: 30, proteinG: 0.7, carbsG: 11, fatG: 0.2 }, defaultGrams: 30 },
  { keys: ["salt", "pepper", "sea salt", "spices", "seasoning"], per100g: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, defaultGrams: 2 },
  { keys: ["black beans", "beans", "chickpeas", "lentils"], per100g: { calories: 132, proteinG: 8.9, carbsG: 24, fatG: 0.5 }, defaultGrams: 130 },
  { keys: ["corn"], per100g: { calories: 96, proteinG: 3.4, carbsG: 21, fatG: 1.5 }, defaultGrams: 120 },
  { keys: ["salsa", "pico"], per100g: { calories: 36, proteinG: 1.5, carbsG: 7, fatG: 0.2 }, defaultGrams: 60 },
];

export type CookingMethod = "boiled" | "steamed" | "grilled" | "baked" | "pan-seared" | "fried" | "raw" | "air-fried";

export const COOKING_METHODS: { value: CookingMethod; label: string; note: string }[] = [
  { value: "boiled", label: "Boiled", note: "No added fat" },
  { value: "steamed", label: "Steamed", note: "No added fat" },
  { value: "grilled", label: "Grilled", note: "Minimal added fat" },
  { value: "baked", label: "Baked", note: "Minimal added fat" },
  { value: "air-fried", label: "Air-fried", note: "Minimal added fat" },
  { value: "pan-seared", label: "Pan-seared", note: "≈ +1 tsp cooking fat" },
  { value: "fried", label: "Fried", note: "≈ +1 tbsp cooking fat" },
  { value: "raw", label: "Raw / assembled", note: "As-is" },
];

/** Added cooking fat by method (grams of oil-equivalent). */
const METHOD_FAT_G: Record<CookingMethod, number> = {
  boiled: 0, steamed: 0, grilled: 2, baked: 2, "air-fried": 1, "pan-seared": 5, fried: 14, raw: 0,
};

export type IngredientInput = { name: string; grams?: number | null };

export type IngredientEstimate = {
  name: string;
  matchedAs: string | null;
  grams: number;
  macros: MacroEstimate;
};

export type MealEstimate = {
  perServing: MacroEstimate;
  total: MacroEstimate;
  ingredients: IngredientEstimate[];
  unmatched: string[];
  methodNote: string;
};

function matchFood(name: string): FoodEntry | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  // Exact/contains match against every key, longest key first for specificity.
  let best: { entry: FoodEntry; keyLen: number } | null = null;
  for (const entry of FOOD_TABLE) {
    for (const key of entry.keys) {
      if (n === key || n.includes(key) || key.includes(n)) {
        if (!best || key.length > best.keyLen) best = { entry, keyLen: key.length };
      }
    }
  }
  return best?.entry ?? null;
}

function scale(per100g: MacroEstimate, grams: number): MacroEstimate {
  const f = grams / 100;
  return {
    calories: per100g.calories * f,
    proteinG: per100g.proteinG * f,
    carbsG: per100g.carbsG * f,
    fatG: per100g.fatG * f,
  };
}

function roundMacros(m: MacroEstimate): MacroEstimate {
  return { calories: Math.round(m.calories), proteinG: Math.round(m.proteinG), carbsG: Math.round(m.carbsG), fatG: Math.round(m.fatG) };
}

/** Estimate a member-authored meal. Servings ≥ 1; unknown ingredients are
    reported (never silently guessed as zero-calorie mystery food). */
export function estimateMealMacros(
  ingredients: IngredientInput[],
  method: CookingMethod,
  servings: number,
): MealEstimate {
  const total: MacroEstimate = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const detail: IngredientEstimate[] = [];
  const unmatched: string[] = [];

  for (const ing of ingredients) {
    const entry = matchFood(ing.name);
    if (!entry) {
      if (ing.name.trim()) unmatched.push(ing.name.trim());
      continue;
    }
    const grams = ing.grams && ing.grams > 0 ? ing.grams : entry.defaultGrams;
    const macros = scale(entry.per100g, grams);
    total.calories += macros.calories;
    total.proteinG += macros.proteinG;
    total.carbsG += macros.carbsG;
    total.fatG += macros.fatG;
    detail.push({ name: ing.name.trim(), matchedAs: entry.keys[0], grams, macros: roundMacros(macros) });
  }

  // Preparation adjustment — cooking fat.
  const addedFat = METHOD_FAT_G[method] ?? 0;
  total.fatG += addedFat;
  total.calories += addedFat * 9;

  const safeServings = Math.max(1, Math.round(servings));
  const perServing = roundMacros({
    calories: total.calories / safeServings,
    proteinG: total.proteinG / safeServings,
    carbsG: total.carbsG / safeServings,
    fatG: total.fatG / safeServings,
  });

  const methodMeta = COOKING_METHODS.find((m) => m.value === method);
  return {
    perServing,
    total: roundMacros(total),
    ingredients: detail,
    unmatched,
    methodNote: methodMeta ? `${methodMeta.label} · ${methodMeta.note}` : "",
  };
}
