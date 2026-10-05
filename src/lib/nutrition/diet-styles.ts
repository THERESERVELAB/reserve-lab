/* ════════════════════════════════════════════════════════════════════════
   DIET STYLES + FOOD POOLS
   ------------------------------------------------------------------------
   Diet style is a member preference, not medical advice. Allergies and
   excluded foods always override the diet style. Disliked foods are removed
   from generated meals.
   ════════════════════════════════════════════════════════════════════════ */

import type { CarnivoreStrictness, DietStyleKey, FoodOption, MacroRole } from "./types";

export type DietStyleMeta = {
  key: DietStyleKey;
  label: string;
  blurb: string;
  /** Carb posture influences the macro engine. */
  carbPosture: "standard" | "low" | "very-low";
  fatPosture: "standard" | "high" | "low";
};

export const DIET_STYLES: DietStyleMeta[] = [
  { key: "standard", label: "Standard Bodybuilding", blurb: "Balanced lean protein, starches, fruit, and veg.", carbPosture: "standard", fatPosture: "standard" },
  { key: "high-protein", label: "High-Protein Balanced", blurb: "Protein-forward with moderate carbs and fats.", carbPosture: "standard", fatPosture: "standard" },
  { key: "animal-based", label: "Animal-Based", blurb: "Meat, eggs, fish, fruit, honey, optional dairy.", carbPosture: "standard", fatPosture: "high" },
  { key: "carnivore", label: "Carnivore", blurb: "Meat, eggs, fish, seafood, animal fats.", carbPosture: "very-low", fatPosture: "high" },
  { key: "pescatarian", label: "Pescatarian", blurb: "Fish + seafood, optional eggs/dairy, plant carbs.", carbPosture: "standard", fatPosture: "standard" },
  { key: "mediterranean", label: "Mediterranean", blurb: "Lean meats, fish, olive oil, produce, legumes.", carbPosture: "standard", fatPosture: "standard" },
  { key: "vegetarian", label: "Vegetarian", blurb: "Eggs/dairy, soy, legumes, grains, produce.", carbPosture: "standard", fatPosture: "standard" },
  { key: "vegan", label: "Vegan", blurb: "Plant proteins, grains, legumes, produce.", carbPosture: "standard", fatPosture: "standard" },
  { key: "paleo", label: "Paleo", blurb: "Meat, fish, eggs, produce, nuts — no grains/dairy.", carbPosture: "low", fatPosture: "high" },
  { key: "keto", label: "Keto / Low Carb", blurb: "High fat, low carb, moderate protein.", carbPosture: "very-low", fatPosture: "high" },
  { key: "low-fat", label: "Low Fat", blurb: "Lower fat, higher carb support.", carbPosture: "standard", fatPosture: "low" },
  { key: "gluten-free", label: "Gluten-Free", blurb: "Standard structure, gluten removed.", carbPosture: "standard", fatPosture: "standard" },
  { key: "dairy-free", label: "Dairy-Free", blurb: "Standard structure, dairy removed.", carbPosture: "standard", fatPosture: "standard" },
  { key: "halal", label: "Halal", blurb: "Halal-compliant protein sourcing.", carbPosture: "standard", fatPosture: "standard" },
  { key: "kosher", label: "Kosher", blurb: "Kosher-compliant sourcing.", carbPosture: "standard", fatPosture: "standard" },
  { key: "custom", label: "Custom", blurb: "Member-defined allowed and excluded foods.", carbPosture: "standard", fatPosture: "standard" },
];

export function dietStyleMeta(key: DietStyleKey): DietStyleMeta {
  return DIET_STYLES.find((d) => d.key === key) ?? DIET_STYLES[0];
}

/* ─── Food pools ─────────────────────────────────── */
const f = (id: string, name: string, role: MacroRole, styles: DietStyleKey[] | "all", tags: string[] = []): FoodOption => ({ id, name, role, styles, tags });

// "plant/omni" styles where most lean proteins fit:
const OMNI: DietStyleKey[] = ["standard", "high-protein", "mediterranean", "paleo", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"];
const MEAT_STYLES: DietStyleKey[] = [...OMNI, "animal-based", "carnivore", "keto"];
const FISH_STYLES: DietStyleKey[] = [...OMNI, "animal-based", "carnivore", "keto", "pescatarian"];
// Plant-leaning styles that may still include fruit (NOT carnivore, NOT strict keto):
const FRUIT_STYLES: DietStyleKey[] = ["standard", "high-protein", "mediterranean", "animal-based", "pescatarian", "vegetarian", "vegan", "paleo", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"];
const PLANT_FAT_STYLES: DietStyleKey[] = ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "vegan", "paleo", "keto", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"];

export const FOOD_POOLS: FoodOption[] = [
  // ── Proteins · red meat ──
  f("steak", "Ribeye Steak", "protein", MEAT_STYLES, ["beef", "red-meat"]),
  f("sirloin", "Sirloin Steak", "protein", MEAT_STYLES, ["beef", "red-meat"]),
  f("lean-beef", "Lean Ground Beef", "protein", MEAT_STYLES, ["beef", "red-meat"]),
  f("bison", "Bison", "protein", MEAT_STYLES, ["red-meat"]),
  f("lamb", "Lamb Chops", "protein", MEAT_STYLES, ["red-meat"]),
  f("venison", "Venison", "protein", ["carnivore", "animal-based", "keto", "paleo", "standard", "high-protein", "gluten-free", "dairy-free", "halal"], ["red-meat", "game"]),
  // ── Proteins · poultry ──
  f("chicken", "Chicken Breast", "protein", [...OMNI, "animal-based", "carnivore", "keto"], ["poultry"]),
  f("chicken-thigh", "Chicken Thigh", "protein", [...OMNI, "animal-based", "carnivore", "keto"], ["poultry"]),
  f("turkey", "Turkey", "protein", [...OMNI, "animal-based", "carnivore", "keto"], ["poultry"]),
  // ── Proteins · eggs ──
  f("eggs", "Pasture Eggs", "protein", [...OMNI, "animal-based", "carnivore", "keto", "pescatarian", "vegetarian"], ["egg"]),
  f("egg-whites", "Egg Whites", "protein", [...OMNI, "animal-based", "carnivore", "pescatarian", "vegetarian"], ["egg"]),
  // ── Proteins · fish + seafood ──
  f("salmon", "Salmon", "protein", FISH_STYLES, ["fish"]),
  f("white-fish", "White Fish", "protein", FISH_STYLES, ["fish"]),
  f("tuna", "Tuna", "protein", FISH_STYLES, ["fish"]),
  f("shrimp", "Shrimp", "protein", FISH_STYLES, ["shellfish"]),
  f("bone-broth", "Bone Broth", "protein", ["carnivore", "animal-based", "keto", "paleo", "standard", "high-protein", "gluten-free", "dairy-free"], ["broth"]),
  // ── Proteins · dairy ──
  f("greek-yogurt", "Greek Yogurt", "protein", ["standard", "high-protein", "mediterranean", "animal-based", "pescatarian", "vegetarian", "keto", "low-fat", "gluten-free", "halal", "kosher"], ["dairy"]),
  f("cottage-cheese", "Cottage Cheese", "protein", ["standard", "high-protein", "mediterranean", "animal-based", "vegetarian", "keto", "gluten-free", "halal", "kosher"], ["dairy"]),
  f("whey", "Whey Protein", "protein", ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "keto", "low-fat", "gluten-free", "halal", "kosher"], ["dairy"]),
  // ── Proteins · plant ──
  f("tofu", "Tofu", "protein", ["vegetarian", "vegan", "pescatarian", "mediterranean", "standard", "high-protein", "low-fat", "gluten-free", "dairy-free"], ["soy", "plant-protein"]),
  f("tempeh", "Tempeh", "protein", ["vegetarian", "vegan", "pescatarian", "mediterranean", "standard", "high-protein", "dairy-free"], ["soy", "plant-protein"]),
  f("seitan", "Seitan", "protein", ["vegetarian", "vegan"], ["gluten", "soy", "plant-protein"]),
  f("lentils", "Lentils", "protein", ["vegetarian", "vegan", "mediterranean", "standard", "high-protein", "low-fat", "gluten-free", "dairy-free"], ["legume", "plant-protein"]),
  f("vegan-protein", "Vegan Protein", "protein", ["vegan", "vegetarian", "dairy-free"], ["plant-protein"]),

  // ── Carbs ──
  f("white-rice", "Jasmine Rice", "carb", [...OMNI, "animal-based", "pescatarian", "vegetarian", "vegan", "low-fat"], ["grain"]),
  f("oats", "Oats", "carb", ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "vegan", "low-fat", "dairy-free", "halal", "kosher"], ["grain", "gluten-optional"]),
  f("potatoes", "Potatoes", "carb", [...OMNI, "animal-based", "pescatarian", "vegetarian", "vegan", "low-fat"], []),
  f("sweet-potato", "Sweet Potato", "carb", [...OMNI, "animal-based", "pescatarian", "vegetarian", "vegan", "low-fat"], []),
  f("pasta", "Pasta", "carb", ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "vegan", "low-fat"], ["grain", "gluten"]),
  f("quinoa", "Quinoa", "carb", ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "vegan", "low-fat", "gluten-free", "dairy-free"], []),
  f("sourdough", "Sourdough", "carb", ["standard", "high-protein", "mediterranean", "vegetarian", "vegan", "low-fat"], ["grain", "gluten"]),
  // fruit / honey: NOT carnivore (handled separately via carnivore flex), NOT strict keto.
  f("fruit", "Fruit", "carb", FRUIT_STYLES, ["fruit"]),
  f("honey", "Honey", "carb", ["animal-based", "standard", "high-protein", "mediterranean", "paleo", "gluten-free", "dairy-free", "halal", "kosher"], []),

  // ── Fats ──
  f("olive-oil", "Olive Oil", "fat", PLANT_FAT_STYLES, ["plant-oil"]),
  f("avocado", "Avocado", "fat", [...PLANT_FAT_STYLES, "animal-based"], ["fruit"]),
  f("nuts", "Mixed Nuts", "fat", ["standard", "high-protein", "mediterranean", "paleo", "keto", "vegetarian", "vegan", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"], ["nut"]),
  f("animal-fat", "Beef Tallow", "fat", ["carnivore", "animal-based", "keto", "paleo"], []),
  f("butter", "Butter / Ghee", "fat", ["animal-based", "keto", "paleo", "standard", "high-protein", "gluten-free", "halal", "kosher"], ["dairy"]),
  f("cheese", "Aged Cheese", "fat", ["standard", "high-protein", "mediterranean", "keto", "vegetarian", "animal-based", "gluten-free", "halal", "kosher"], ["dairy"]),

  // ── Produce ──
  f("greens", "Leafy Greens", "produce", ["standard", "high-protein", "animal-based", "pescatarian", "mediterranean", "vegetarian", "vegan", "paleo", "keto", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"], ["vegetable"]),
  f("veg-mix", "Mixed Vegetables", "produce", ["standard", "high-protein", "animal-based", "pescatarian", "mediterranean", "vegetarian", "vegan", "paleo", "keto", "low-fat", "gluten-free", "dairy-free", "halal", "kosher"], ["vegetable"]),
  f("berries", "Berries", "produce", [...FRUIT_STYLES, "keto"], ["fruit"]),

  // ── Sauce / flavor ──
  f("salsa", "Salsa", "sauce", FRUIT_STYLES, []),
  f("mustard", "Mustard", "sauce", "all", []),
  f("hot-sauce", "Hot Sauce", "sauce", "all", []),

  // ── Snacks ──
  f("rice-cakes", "Rice Cakes", "snack", ["standard", "high-protein", "low-fat", "vegan", "vegetarian", "dairy-free"], ["grain"]),
  f("jerky", "Beef Jerky", "snack", MEAT_STYLES, ["beef", "red-meat"]),
  f("protein-bar", "Protein Bar", "snack", ["standard", "high-protein", "low-fat", "gluten-free"], ["dairy"]),
];

/** Style allows a food? (before allergy/exclusion filters). */
export function styleAllowsFood(food: FoodOption, style: DietStyleKey): boolean {
  if (style === "custom") return true; // custom is governed purely by member allow/exclude lists
  if (food.styles === "all") return true;
  return food.styles.includes(style);
}

/* ─── Carnivore enforcement ──────────────────────────
   Carnivore is gated by its own predicate (not the styles[] array) so the
   strictness ladder controls dairy + flex plants. Strict carnivore is
   animal-only; plant foods never appear unless the member opts into flex. */

function foodOrigin(food: FoodOption): "animal" | "dairy" | "plant" {
  const t = new Set(food.tags);
  if (t.has("dairy")) return "dairy";
  if (
    t.has("beef") || t.has("red-meat") || t.has("game") || t.has("poultry")
    || t.has("fish") || t.has("shellfish") || t.has("egg") || t.has("broth")
    || food.id === "animal-fat"
  ) return "animal";
  return "plant";
}

/** Plant foods permitted only at the "animal_based_flex" rung of carnivore. */
const CARNIVORE_FLEX_PLANTS = new Set(["fruit", "berries", "honey", "white-rice", "potatoes"]);

/** Whether a food is allowed under carnivore + the member's strictness rung. */
export function carnivoreFoodAllowed(food: FoodOption, strictness: CarnivoreStrictness): boolean {
  const origin = foodOrigin(food);
  if (origin === "animal") return true;
  if (origin === "dairy") return strictness === "dairy_allowed" || strictness === "animal_based_flex";
  // plant
  if (strictness === "animal_based_flex") return CARNIVORE_FLEX_PLANTS.has(food.id);
  return false;
}

function lc(s: string): string { return s.toLowerCase().trim(); }

/** Allergy/exclusion filter — these ALWAYS override the diet style. */
export function foodIsExcluded(food: FoodOption, opts: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] }): boolean {
  const ex = (opts.excludedFoods ?? []).map(lc);
  const dis = (opts.dislikedFoods ?? []).map(lc);
  const alg = (opts.allergies ?? []).map(lc);
  const name = lc(food.name);
  if (ex.includes(name) || ex.includes(food.id)) return true;
  if (dis.includes(name) || dis.includes(food.id)) return true;
  if (alg.some((a) => food.tags.map(lc).includes(a))) return true;
  // dairy-free / gluten-free convenience: treat as allergy-style tag filters
  return false;
}

/** Foods available for a (style, role) after allergy/exclusion/dislike filters. */
export function getFoodsForStyle(
  role: MacroRole,
  style: DietStyleKey,
  opts: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] } = {},
  carnivoreStrictness: CarnivoreStrictness = "strict",
): FoodOption[] {
  // Modifier styles apply tag-based exclusions on top of the per-food style list.
  const tagFilters =
    style === "dairy-free" ? ["dairy"]
    : style === "gluten-free" ? ["gluten"]
    : style === "paleo" ? ["grain", "legume", "dairy", "gluten"]
    : style === "kosher" ? ["shellfish"]
    : [];
  const styleOk = (food: FoodOption) =>
    style === "carnivore" ? carnivoreFoodAllowed(food, carnivoreStrictness) : styleAllowsFood(food, style);
  return FOOD_POOLS.filter((food) =>
    food.role === role
    && styleOk(food)
    && !foodIsExcluded(food, opts)
    && !tagFilters.some((t) => food.tags.includes(t)),
  );
}

/**
 * Swap options for a food: other foods that fill the same macro role within
 * the diet style and pass allergy/exclusion filters. Excludes the original.
 */
export function getSwapOptions(
  foodId: string,
  role: MacroRole,
  style: DietStyleKey,
  opts: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] } = {},
  carnivoreStrictness: CarnivoreStrictness = "strict",
): string[] {
  return getFoodsForStyle(role, style, opts, carnivoreStrictness)
    .filter((food) => food.id !== foodId)
    .map((food) => food.name)
    .slice(0, 5);
}
