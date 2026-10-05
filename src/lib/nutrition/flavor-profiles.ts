/* ════════════════════════════════════════════════════════════════════════
   FLAVOR PROFILE SYSTEM
   ------------------------------------------------------------------------
   Same macros, different taste — keeps adherence high. Flavor is presentation
   only; it never changes the macro target or the diet-style food rules.
   ════════════════════════════════════════════════════════════════════════ */

import type { DietStyleKey, Meal } from "./types";

export type FlavorProfileKey =
  | "classic" | "mediterranean" | "mexican" | "teriyaki" | "steakhouse"
  | "breakfast" | "sweet" | "savory" | "low-prep" | "bowl" | "restaurant" | "simple";

export type FlavorProfile = {
  key: FlavorProfileKey;
  label: string;
  blurb: string;
  /** Seasoning / sauce cues (no macros — flavor only). */
  cues: string[];
  /** Diet styles where the profile reads naturally; "all" otherwise. */
  styles: DietStyleKey[] | "all";
};

export const FLAVOR_PROFILES: FlavorProfile[] = [
  { key: "classic", label: "Classic", blurb: "Clean bodybuilding prep.", cues: ["sea salt", "pepper", "light olive oil"], styles: "all" },
  { key: "mediterranean", label: "Mediterranean", blurb: "Olive oil, lemon, herbs.", cues: ["lemon", "oregano", "olive oil", "garlic"], styles: "all" },
  { key: "mexican", label: "Mexican", blurb: "Lime, cumin, salsa.", cues: ["lime", "cumin", "salsa", "cilantro"], styles: "all" },
  { key: "teriyaki", label: "Japanese / Teriyaki", blurb: "Sweet-savory glaze.", cues: ["low-sugar teriyaki", "ginger", "sesame"], styles: ["standard", "high-protein", "pescatarian", "vegetarian", "vegan", "low-fat", "mediterranean"] },
  { key: "steakhouse", label: "Steakhouse", blurb: "Char, garlic, butter.", cues: ["garlic", "black pepper", "butter or tallow"], styles: ["standard", "high-protein", "animal-based", "carnivore", "keto", "paleo", "halal", "kosher"] },
  { key: "breakfast", label: "Breakfast-Style", blurb: "Eggs, oats, fruit.", cues: ["cinnamon", "vanilla", "fruit"], styles: "all" },
  { key: "sweet", label: "Sweet", blurb: "Honey, cinnamon, fruit.", cues: ["honey", "cinnamon", "berries"], styles: "all" },
  { key: "savory", label: "Savory", blurb: "Umami, herbs, salt.", cues: ["soy or coconut aminos", "garlic", "herbs"], styles: "all" },
  { key: "low-prep", label: "Low-Prep", blurb: "Rotisserie / pre-cooked.", cues: ["pre-cooked protein", "microwave rice", "bagged greens"], styles: "all" },
  { key: "bowl", label: "Meal-Prep Bowl", blurb: "Stackable bowl format.", cues: ["base + protein + sauce", "batch-cooked"], styles: "all" },
  { key: "restaurant", label: "Restaurant-Style", blurb: "Order-out friendly.", cues: ["grilled protein", "side swap", "sauce on side"], styles: "all" },
  { key: "simple", label: "Simple Digestible", blurb: "Plain, easy on the gut.", cues: ["sea salt only", "white rice", "lean protein"], styles: "all" },
];

export function flavorProfile(key: FlavorProfileKey): FlavorProfile {
  return FLAVOR_PROFILES.find((f) => f.key === key) ?? FLAVOR_PROFILES[0];
}

/** Flavor options that read naturally for a meal's diet style. */
export function getFlavorOptionsForStyle(style: DietStyleKey): FlavorProfile[] {
  return FLAVOR_PROFILES.filter((f) => f.styles === "all" || f.styles.includes(style));
}

/** Present a meal under a flavor profile, e.g. "Teriyaki chicken + rice bowl". */
export function flavoredMealName(meal: Meal, flavor: FlavorProfileKey): string {
  const protein = meal.foods.find((f) => f.role === "protein")?.name;
  const carb = meal.foods.find((f) => f.role === "carb")?.name;
  const base = [protein, carb].filter(Boolean).join(" + ");
  const fp = flavorProfile(flavor);
  if (!base) return `${fp.label} ${meal.name}`;
  if (flavor === "classic" || flavor === "simple") return base;
  if (flavor === "bowl" || flavor === "low-prep") return `${base} ${fp.label.toLowerCase()}`;
  return `${fp.label} ${base.toLowerCase()} bowl`;
}
