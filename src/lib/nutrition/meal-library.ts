/* ════════════════════════════════════════════════════════════════════════
   PREMIUM MEAL NAMING + COOKING STYLE + FLAVOR
   ------------------------------------------------------------------------
   Turns the engine's macro-driven food picks into a coach-built dish name
   with a cooking style and flavor profile. Presentation only — this never
   changes macros, the diet style, or which foods are allowed. Diet-style
   accuracy is enforced upstream in diet-styles.ts; this layer only names
   what the engine already chose.
   ════════════════════════════════════════════════════════════════════════ */

import type { CarnivoreStrictness, DietStyleKey, MealFood, MealPurpose } from "./types";

export type DishPresentation = {
  dishName: string;
  cookingStyle: string;
  flavorProfile: string;
};

type ProteinClass =
  | "red-meat" | "poultry" | "fish" | "shellfish" | "egg"
  | "broth" | "dairy" | "plant" | "other";

function proteinClass(foodId: string): ProteinClass {
  if (["steak", "sirloin", "lean-beef", "bison", "lamb", "venison", "jerky"].includes(foodId)) return "red-meat";
  if (["chicken", "chicken-thigh", "turkey"].includes(foodId)) return "poultry";
  if (["salmon", "white-fish", "tuna"].includes(foodId)) return "fish";
  if (["shrimp"].includes(foodId)) return "shellfish";
  if (["eggs", "egg-whites"].includes(foodId)) return "egg";
  if (["bone-broth"].includes(foodId)) return "broth";
  if (["greek-yogurt", "cottage-cheese", "whey"].includes(foodId)) return "dairy";
  if (["tofu", "tempeh", "seitan", "lentils", "vegan-protein"].includes(foodId)) return "plant";
  return "other";
}

/** Premium label for the primary protein (id → menu-style name). */
const PROTEIN_LABEL: Record<string, string> = {
  steak: "Ribeye", sirloin: "Sirloin", "lean-beef": "Ground Beef", bison: "Bison",
  lamb: "Lamb Chop", venison: "Venison", jerky: "Beef Jerky",
  chicken: "Chicken Breast", "chicken-thigh": "Chicken Thigh", turkey: "Turkey",
  salmon: "Salmon", "white-fish": "White Fish", tuna: "Tuna", shrimp: "Shrimp",
  eggs: "Pasture Eggs", "egg-whites": "Egg White", "bone-broth": "Bone Broth",
  "greek-yogurt": "Greek Yogurt", "cottage-cheese": "Cottage Cheese", whey: "Whey",
  tofu: "Tofu", tempeh: "Tempeh", seitan: "Seitan", lentils: "Lentil", "vegan-protein": "Plant Protein",
};

const CARB_LABEL: Record<string, string> = {
  "white-rice": "Jasmine Rice", oats: "Oatmeal", potatoes: "Potato", "sweet-potato": "Sweet Potato",
  pasta: "Pasta", quinoa: "Quinoa", sourdough: "Sourdough", fruit: "Fruit", honey: "Honey",
};

const FAT_LABEL: Record<string, string> = {
  "animal-fat": "Tallow", butter: "Ghee", cheese: "Aged Cheddar",
  "olive-oil": "Olive Oil", avocado: "Avocado", nuts: "Toasted Nuts",
};

/** Cooking styles that read naturally for each protein class. */
const COOKING_STYLES: Record<ProteinClass, string[]> = {
  "red-meat": ["Cast-Iron Seared", "Grilled", "Reverse-Seared", "Smoked", "Pan-Seared"],
  poultry: ["Crispy-Skin", "Grilled", "Air-Fried", "Oven-Roasted", "Pan-Seared"],
  fish: ["Seared", "Oven-Roasted", "Grilled", "Pan-Crisped"],
  shellfish: ["Garlic-Seared", "Grilled", "Sautéed"],
  egg: ["Soft-Scrambled", "Over-Easy", "Pan-Fried"],
  broth: ["Slow-Simmered"],
  dairy: ["Chilled", "Whipped"],
  plant: ["Crispy", "Marinated", "Pan-Seared", "Roasted"],
  other: ["Prepped"],
};

/** Flavor profiles per protein class. */
const FLAVOR_BY_CLASS: Record<ProteinClass, string[]> = {
  "red-meat": ["Steakhouse", "Cast-Iron", "Smokehouse"],
  poultry: ["Cast-Iron", "Smokehouse", "Mediterranean", "Breakfast-Style"],
  fish: ["Mediterranean", "Cast-Iron", "Simple Digestible"],
  shellfish: ["Mediterranean", "Cast-Iron"],
  egg: ["Breakfast-Style", "Cast-Iron", "Simple Digestible"],
  broth: ["Bone Broth & Salt"],
  dairy: ["Sweet Bowl", "Breakfast-Style"],
  plant: ["Savory Bowl", "Mediterranean", "Japanese / Teriyaki", "Sweet Bowl"],
  other: ["Classic"],
};

/** Flavor profiles that stay true to strict carnivore (no plant-forward cues). */
const CARNIVORE_FLAVORS = ["Steakhouse", "Cast-Iron", "Smokehouse", "Breakfast-Style", "Simple Digestible", "Bone Broth & Salt"];

function pick<T>(arr: T[], seed: number): T {
  if (arr.length === 0) return arr[0];
  const idx = ((seed % arr.length) + arr.length) % arr.length;
  return arr[idx];
}

function formatForPurpose(purpose: MealPurpose, hasCarb: boolean): string {
  switch (purpose) {
    case "post-workout": return "Recovery Bowl";
    case "pre-workout": return "Fuel Bowl";
    case "night-recovery": return "Recovery Plate";
    case "snack": return "Protein Plate";
    case "morning-anchor":
    case "rest-day-anchor": return "Plate";
    default: return hasCarb ? "Bowl" : "Plate";
  }
}

/**
 * Compose a premium dish name + cooking style + flavor profile from the foods
 * the engine already selected. Deterministic in `seed` so the same plan reads
 * the same way, while different meals/days rotate naturally.
 */
export function composeDish(args: {
  foods: MealFood[];
  purpose: MealPurpose;
  dietStyle: DietStyleKey;
  carnivoreStrictness?: CarnivoreStrictness;
  seed: number;
}): DishPresentation {
  const { foods, purpose, dietStyle, seed } = args;
  const strictCarnivore = dietStyle === "carnivore" && (args.carnivoreStrictness ?? "strict") === "strict";

  const protein = foods.find((fd) => fd.role === "protein");
  const carb = foods.find((fd) => fd.role === "carb");
  const fat = foods.find((fd) => fd.role === "fat");

  if (!protein) {
    // No protein placed (rare) — fall back to a clean descriptor.
    const carbLabel = carb ? (CARB_LABEL[carb.foodId] ?? carb.name) : null;
    return {
      dishName: carbLabel ? `${carbLabel} Plate` : "Meal",
      cookingStyle: "Prepped",
      flavorProfile: "Classic",
    };
  }

  const cls = proteinClass(protein.foodId);
  const proteinLabel = PROTEIN_LABEL[protein.foodId] ?? protein.name;
  const carbLabel = carb ? (CARB_LABEL[carb.foodId] ?? carb.name) : null;
  const fatLabel = fat ? (FAT_LABEL[fat.foodId] ?? null) : null;

  const cookingStyle = pick(COOKING_STYLES[cls], seed);
  const flavorPool = strictCarnivore
    ? FLAVOR_BY_CLASS[cls].filter((f) => CARNIVORE_FLAVORS.includes(f))
    : FLAVOR_BY_CLASS[cls];
  const flavorProfile = pick(flavorPool.length ? flavorPool : CARNIVORE_FLAVORS, seed + 3);

  const format = formatForPurpose(purpose, !!carbLabel);

  let dishName: string;
  if (cls === "broth") {
    dishName = `${proteinLabel} & Sea Salt ${format}`;
  } else if (cls === "dairy") {
    dishName = carbLabel ? `${proteinLabel} ${carbLabel} Bowl` : `${proteinLabel} Protein Bowl`;
  } else if (cls === "egg") {
    dishName = carbLabel ? `${cookingStyle} Eggs & ${carbLabel} ${format}` : `${cookingStyle} Eggs ${format}`;
  } else if (cls === "plant") {
    dishName = carbLabel ? `${cookingStyle} ${proteinLabel} ${carbLabel} Bowl` : `${cookingStyle} ${proteinLabel} ${format}`;
  } else {
    // red-meat / poultry / fish / shellfish
    if (carbLabel) dishName = `${cookingStyle} ${proteinLabel} & ${carbLabel} Bowl`;
    else if (fatLabel) dishName = `${cookingStyle} ${proteinLabel} with ${fatLabel} & Sea Salt`;
    else dishName = `${cookingStyle} ${proteinLabel} ${format}`;
  }

  return { dishName, cookingStyle, flavorProfile };
}
