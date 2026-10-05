/* ════════════════════════════════════════════════════════════════════════
   SMOOTHIE / SHAKE ENGINE + MACRO RESCUE
   ------------------------------------------------------------------------
   Helps members hit their macro target in a fun, easy way when full meals
   aren't realistic. Status can be Optional / Recommended / Required to hit
   today's macro target — never "medically required". Respects diet style,
   allergies, excluded + disliked foods. No medical claims, no supplement or
   compound prescriptions.
   ════════════════════════════════════════════════════════════════════════ */

import { parseHM } from "./meal-timing";
import type { AppetiteLevel, CarnivoreStrictness, DietStyleKey } from "./types";

export type SmoothieRole =
  | "meal-replacement" | "protein-boost" | "calorie-boost" | "pre-workout"
  | "post-workout" | "macro-rescue" | "low-appetite" | "convenience"
  | "night-recovery" | "greek-yogurt";

export type SmoothieStatus = "optional" | "recommended" | "required";

export type SmoothieFlavorKey =
  | "chocolate-pb" | "vanilla-banana" | "strawberry-cheesecake" | "blueberry-vanilla"
  | "matcha" | "cinnamon-oatmeal" | "mango-tropical" | "coffee-mocha"
  | "honey-banana" | "chocolate-berry" | "simple-vanilla" | "custom";

export type SmoothieTemplate = {
  id: string;
  name: string;
  role: SmoothieRole;
  flavor: SmoothieFlavorKey;
  timingAnchor: string;          // "Pre-workout", "5 PM macro rescue", etc.
  ingredients: string[];
  /** Allergy/diet tags on ingredients so filters can exclude. */
  tags: string[];
  styles: DietStyleKey[] | "all";
  /** Minimum carnivore rung this option needs (only consulted for carnivore). */
  minCarnivore?: CarnivoreStrictness;
  /** Food-style add-on (e.g. beef patty) rather than a blended shake — for copy. */
  kind?: "smoothie" | "food-addon";
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  prepMinutes: number;
  texture: "thick" | "light" | "bowl" | "drinkable";
};

const CARNIVORE_RANK: Record<CarnivoreStrictness, number> = { strict: 0, dairy_allowed: 1, animal_based_flex: 2 };

const DAIRY: DietStyleKey[] = ["standard", "high-protein", "mediterranean", "animal-based", "pescatarian", "vegetarian", "keto", "gluten-free", "halal", "kosher"];
const WHEY_OK: DietStyleKey[] = ["standard", "high-protein", "mediterranean", "pescatarian", "vegetarian", "keto", "gluten-free", "halal", "kosher"];

export const SMOOTHIE_TEMPLATES: SmoothieTemplate[] = [
  {
    id: "pre-workout-fuel", name: "Pre-Workout Fuel Shake", role: "pre-workout", flavor: "honey-banana",
    timingAnchor: "Pre-workout", ingredients: ["Whey protein", "Banana", "Oats or cream of rice", "Honey", "Almond milk", "Pinch sea salt"],
    tags: ["dairy"], styles: WHEY_OK, macros: { calories: 420, proteinG: 35, carbsG: 55, fatG: 6 }, prepMinutes: 4, texture: "drinkable",
  },
  {
    id: "post-workout-recovery", name: "Post-Workout Recovery Shake", role: "post-workout", flavor: "chocolate-berry",
    timingAnchor: "Post-workout", ingredients: ["Whey isolate", "Banana", "Berries", "Greek yogurt", "Honey"],
    tags: ["dairy"], styles: WHEY_OK, macros: { calories: 460, proteinG: 48, carbsG: 52, fatG: 5 }, prepMinutes: 4, texture: "drinkable",
  },
  {
    id: "macro-rescue", name: "Macro Rescue Shake", role: "macro-rescue", flavor: "chocolate-pb",
    timingAnchor: "Macro rescue", ingredients: ["Whey", "Greek yogurt", "Peanut butter", "Banana", "Oats", "Milk"],
    tags: ["dairy", "nut"], styles: WHEY_OK, macros: { calories: 620, proteinG: 50, carbsG: 60, fatG: 18 }, prepMinutes: 5, texture: "thick",
  },
  {
    id: "lean-cut", name: "Lean Cut Shake", role: "protein-boost", flavor: "strawberry-cheesecake",
    timingAnchor: "Low-cal protein", ingredients: ["Whey isolate", "Greek yogurt", "Berries", "Ice", "Water or almond milk", "Cinnamon"],
    tags: ["dairy"], styles: WHEY_OK, macros: { calories: 250, proteinG: 42, carbsG: 14, fatG: 3 }, prepMinutes: 3, texture: "light",
  },
  {
    id: "animal-based-blend", name: "Animal-Based Blend", role: "calorie-boost", flavor: "honey-banana",
    timingAnchor: "Whole-food blend", ingredients: ["Greek yogurt", "Raw honey", "Banana", "Whey or collagen (if allowed)", "Milk (if tolerated)"],
    tags: ["dairy"], styles: ["animal-based", "standard", "high-protein", "mediterranean"], macros: { calories: 480, proteinG: 38, carbsG: 58, fatG: 9 }, prepMinutes: 4, texture: "thick",
  },
  {
    id: "vegan-blend", name: "Vegan Power Blend", role: "meal-replacement", flavor: "chocolate-pb",
    timingAnchor: "Plant-based meal", ingredients: ["Vegan protein", "Banana", "Berries", "Oats", "Peanut butter", "Almond milk"],
    tags: ["nut", "soy"], styles: ["vegan", "vegetarian", "dairy-free"], macros: { calories: 520, proteinG: 36, carbsG: 62, fatG: 14 }, prepMinutes: 5, texture: "thick",
  },
  {
    id: "keto-shake", name: "Keto Protein Shake", role: "protein-boost", flavor: "vanilla-banana",
    timingAnchor: "Low-carb protein", ingredients: ["Protein powder", "Greek yogurt (if allowed)", "Low-carb berries", "Nut butter", "Unsweetened almond milk"],
    tags: ["dairy", "nut"], styles: ["keto", "standard", "high-protein"], macros: { calories: 360, proteinG: 40, carbsG: 12, fatG: 18 }, prepMinutes: 4, texture: "thick",
  },
  // ── Greek yogurt premium variations (plant cues → carnivore only at flex) ──
  {
    id: "gy-matcha", name: "Greek Yogurt + Matcha", role: "greek-yogurt", flavor: "matcha",
    timingAnchor: "Morning / midday", ingredients: ["Greek yogurt", "Matcha", "Honey (if allowed)", "Berries or banana", "Whey (if protein needed)"],
    tags: ["dairy"], styles: [...DAIRY, "carnivore"], minCarnivore: "animal_based_flex", macros: { calories: 320, proteinG: 34, carbsG: 32, fatG: 6 }, prepMinutes: 3, texture: "bowl",
  },
  {
    id: "gy-berry-protein", name: "Greek Yogurt Berry Protein Bowl", role: "greek-yogurt", flavor: "blueberry-vanilla",
    timingAnchor: "Protein anchor", ingredients: ["Greek yogurt", "Berries", "Whey (if allowed)", "Granola or oats (if carbs needed)"],
    tags: ["dairy"], styles: [...DAIRY, "carnivore"], minCarnivore: "animal_based_flex", macros: { calories: 360, proteinG: 40, carbsG: 36, fatG: 6 }, prepMinutes: 3, texture: "bowl",
  },
  {
    id: "gy-banana-honey", name: "Greek Yogurt Banana Honey", role: "greek-yogurt", flavor: "honey-banana",
    timingAnchor: "Sweet protein", ingredients: ["Greek yogurt", "Banana", "Honey", "Cinnamon"],
    tags: ["dairy"], styles: [...DAIRY, "carnivore"], minCarnivore: "animal_based_flex", macros: { calories: 300, proteinG: 26, carbsG: 40, fatG: 4 }, prepMinutes: 2, texture: "bowl",
  },
  {
    id: "gy-cut-bowl", name: "Greek Yogurt Low-Cal Cut Bowl", role: "low-appetite", flavor: "strawberry-cheesecake",
    timingAnchor: "Cut-friendly", ingredients: ["Greek yogurt", "Berries", "Cinnamon", "Stevia (if allowed)"],
    tags: ["dairy"], styles: [...DAIRY, "carnivore"], minCarnivore: "animal_based_flex", macros: { calories: 200, proteinG: 28, carbsG: 16, fatG: 2 }, prepMinutes: 2, texture: "bowl",
  },
  {
    id: "night-casein", name: "Night Recovery Blend", role: "night-recovery", flavor: "cinnamon-oatmeal",
    timingAnchor: "Night recovery", ingredients: ["Greek yogurt or casein", "Cinnamon", "Berries", "Nut butter (small)"],
    tags: ["dairy", "nut"], styles: DAIRY, macros: { calories: 300, proteinG: 32, carbsG: 18, fatG: 10 }, prepMinutes: 3, texture: "bowl",
  },

  // ── Carnivore-native macro rescue (no plants; strict-safe) ──
  {
    id: "carnivore-beef-addon", name: "Beef Patty Add-On", role: "macro-rescue", flavor: "simple-vanilla",
    timingAnchor: "Protein add-on", ingredients: ["Grass-fed beef patty", "Sea salt"],
    tags: [], styles: ["carnivore", "animal-based", "keto", "paleo"], minCarnivore: "strict", kind: "food-addon",
    macros: { calories: 330, proteinG: 40, carbsG: 0, fatG: 19 }, prepMinutes: 8, texture: "bowl",
  },
  {
    id: "carnivore-egg-addon", name: "Egg & Sea Salt Add-On", role: "protein-boost", flavor: "simple-vanilla",
    timingAnchor: "Protein add-on", ingredients: ["Pasture eggs", "Sea salt", "Butter or tallow"],
    tags: ["egg"], styles: ["carnivore", "animal-based", "keto", "paleo"], minCarnivore: "strict", kind: "food-addon",
    macros: { calories: 220, proteinG: 18, carbsG: 1, fatG: 16 }, prepMinutes: 5, texture: "bowl",
  },
  {
    id: "carnivore-salmon-addon", name: "Salmon Add-On", role: "protein-boost", flavor: "simple-vanilla",
    timingAnchor: "Protein add-on", ingredients: ["Wild-caught salmon", "Sea salt"],
    tags: ["fish"], styles: ["carnivore", "animal-based", "keto", "paleo", "pescatarian"], minCarnivore: "strict", kind: "food-addon",
    macros: { calories: 280, proteinG: 34, carbsG: 0, fatG: 15 }, prepMinutes: 10, texture: "bowl",
  },
  {
    id: "carnivore-bone-broth", name: "Bone Broth Protein Support", role: "macro-rescue", flavor: "simple-vanilla",
    timingAnchor: "Easy protein support", ingredients: ["Bone broth", "Collagen or gelatin", "Sea salt"],
    tags: ["broth"], styles: ["carnivore", "animal-based", "keto", "paleo"], minCarnivore: "strict", kind: "food-addon",
    macros: { calories: 150, proteinG: 20, carbsG: 1, fatG: 6 }, prepMinutes: 4, texture: "drinkable",
  },
  // Carnivore + dairy (no plants): only at dairy_allowed and above.
  {
    id: "carnivore-gy-whey", name: "Greek Yogurt + Whey Bowl", role: "greek-yogurt", flavor: "simple-vanilla",
    timingAnchor: "High-protein bowl", ingredients: ["Greek yogurt", "Whey", "Sea salt"],
    tags: ["dairy"], styles: ["carnivore", "standard", "high-protein", "keto"], minCarnivore: "dairy_allowed",
    macros: { calories: 320, proteinG: 50, carbsG: 12, fatG: 6 }, prepMinutes: 2, texture: "bowl",
  },
  {
    id: "carnivore-cottage", name: "Cottage Cheese Protein Bowl", role: "protein-boost", flavor: "simple-vanilla",
    timingAnchor: "High-protein bowl", ingredients: ["Cottage cheese", "Sea salt"],
    tags: ["dairy"], styles: ["carnivore", "standard", "high-protein", "keto"], minCarnivore: "dairy_allowed",
    macros: { calories: 220, proteinG: 28, carbsG: 8, fatG: 8 }, prepMinutes: 2, texture: "bowl",
  },
];

function lc(s: string): string { return s.toLowerCase(); }

/** Diet style + allergy/exclusion/dislike filter for smoothies. */
export function smoothieAllowed(
  s: SmoothieTemplate,
  style: DietStyleKey,
  filters: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] },
  carnivoreStrictness: CarnivoreStrictness = "strict",
): boolean {
  const styleOk = style === "custom" || s.styles === "all" || (s.styles as DietStyleKey[]).includes(style);
  if (!styleOk) return false;
  // Carnivore: gate by the strictness ladder. Templates without an explicit
  // rung are treated as strict-only (must be animal-native).
  if (style === "carnivore") {
    const need = s.minCarnivore ?? "strict";
    if (CARNIVORE_RANK[need] > CARNIVORE_RANK[carnivoreStrictness]) return false;
  }
  // dairy-free / vegan must avoid dairy-tagged blends
  if ((style === "dairy-free" || style === "vegan") && s.tags.includes("dairy")) return false;
  const alg = (filters.allergies ?? []).map(lc);
  if (alg.some((a) => s.tags.map(lc).includes(a))) return false;
  const blocked = [...(filters.excludedFoods ?? []), ...(filters.dislikedFoods ?? [])].map(lc);
  if (s.ingredients.some((ing) => blocked.some((b) => lc(ing).includes(b)))) return false;
  return true;
}

export function smoothiesForStyle(
  style: DietStyleKey,
  filters: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] } = {},
  carnivoreStrictness: CarnivoreStrictness = "strict",
): SmoothieTemplate[] {
  return SMOOTHIE_TEMPLATES.filter((s) => smoothieAllowed(s, style, filters, carnivoreStrictness));
}

/* ─── Macro rescue logic ─────────────────────────── */
export type MacroRescueResult = {
  status: SmoothieStatus;
  smoothie: SmoothieTemplate | null;
  reason: string;
  macrosCovered: { proteinG: number; calories: number } | null;
  availabilityNote?: string;
};

export type MacroRescueInput = {
  remaining: { calories: number; proteinG: number; carbsG: number; fatG: number };
  mealWindowsLeft: number;
  nowMinutes?: number;            // minutes from midnight (defaults to live time)
  trainingStartTime?: string;
  sleepTime?: string;
  dietStyle: DietStyleKey;
  carnivoreStrictness?: CarnivoreStrictness;
  appetiteLevel?: AppetiteLevel;
  filters?: { excludedFoods?: string[]; dislikedFoods?: string[]; allergies?: string[] };
  preferSmoothieRescue?: boolean; // member chose smoothie as preferred rescue method
};

/**
 * Decide whether a smoothie is optional / recommended / required to hit today's
 * macro target, and pick the best-fit blend. "Required" means required for the
 * macro target — never medically required, and only when normal meals can't
 * realistically cover the gap.
 */
export function suggestMacroRescue(input: MacroRescueInput): MacroRescueResult {
  const { remaining, mealWindowsLeft, dietStyle } = input;
  const filters = input.filters ?? {};
  const carnivoreStrictness = input.carnivoreStrictness ?? "strict";
  const pool = smoothiesForStyle(dietStyle, filters, carnivoreStrictness);

  if (pool.length === 0) {
    return { status: "optional", smoothie: null, reason: "No compatible blend for this diet style and filters.", macrosCovered: null, availabilityNote: "Blend availability is limited for this diet style — use a whole-food add-on instead." };
  }

  const now = input.nowMinutes ?? (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const trainStart = parseHM(input.trainingStartTime);
  const sleep = parseHM(input.sleepTime);
  const trainingSoon = trainStart !== null && trainStart - now > 0 && trainStart - now <= 120;
  const lateLowWindows = mealWindowsLeft <= 1;
  const proteinGap = remaining.proteinG;
  const calorieGap = remaining.calories;
  const lowAppetite = input.appetiteLevel === "low";

  // Pick a role-appropriate blend.
  const pick = (roles: SmoothieRole[]): SmoothieTemplate | null =>
    roles.map((r) => pool.find((s) => s.role === r)).find(Boolean) ?? pool[0];

  // Pre-workout: training soon → lighter pre-workout blend.
  if (trainingSoon) {
    const s = pick(["pre-workout", "protein-boost"]);
    return {
      status: proteinGap > 25 || lowAppetite ? "recommended" : "optional",
      smoothie: s,
      reason: "Training starts soon — a lighter pre-workout smoothie beats a heavy full meal.",
      macrosCovered: s ? { proteinG: s.macros.proteinG, calories: s.macros.calories } : null,
    };
  }

  // Behind on protein with few windows left → required for the macro target.
  if ((proteinGap >= 45 && lateLowWindows) || (calorieGap >= 500 && lateLowWindows) || (lowAppetite && proteinGap >= 35 && lateLowWindows)) {
    const s = pick(["macro-rescue", "meal-replacement", "protein-boost", "greek-yogurt"]);
    return {
      status: "required",
      smoothie: s,
      reason: `You're ${proteinGap}g protein short with ${mealWindowsLeft} eating window${mealWindowsLeft === 1 ? "" : "s"} left. Add a smoothie to hit today's target.`,
      macrosCovered: s ? { proteinG: s.macros.proteinG, calories: s.macros.calories } : null,
    };
  }

  // Night, low appetite, or moderate gap → recommended.
  if (lowAppetite || proteinGap >= 30 || (sleep !== null && sleep - now <= 150 && proteinGap >= 20) || input.preferSmoothieRescue) {
    const s = pick(lowAppetite ? ["low-appetite", "greek-yogurt", "protein-boost"] : ["greek-yogurt", "protein-boost", "macro-rescue"]);
    return {
      status: "recommended",
      smoothie: s,
      reason: lowAppetite
        ? "Appetite is low — an easy blend keeps protein on track without a heavy meal."
        : "A protein smoothie is an easy way to close today's remaining target.",
      macrosCovered: s ? { proteinG: s.macros.proteinG, calories: s.macros.calories } : null,
    };
  }

  // Otherwise optional.
  const s = pick(["greek-yogurt", "protein-boost"]);
  return {
    status: "optional",
    smoothie: s,
    reason: "Optional smoothie — normal meals can cover today's target. Add one if you want an easy win.",
    macrosCovered: s ? { proteinG: s.macros.proteinG, calories: s.macros.calories } : null,
  };
}

export const SMOOTHIE_FLAVORS: Array<{ key: SmoothieFlavorKey; label: string }> = [
  { key: "chocolate-pb", label: "Chocolate Peanut Butter" },
  { key: "vanilla-banana", label: "Vanilla Banana" },
  { key: "strawberry-cheesecake", label: "Strawberry Cheesecake" },
  { key: "blueberry-vanilla", label: "Blueberry Vanilla" },
  { key: "matcha", label: "Matcha" },
  { key: "cinnamon-oatmeal", label: "Cinnamon Oatmeal" },
  { key: "mango-tropical", label: "Mango Tropical" },
  { key: "coffee-mocha", label: "Coffee Mocha" },
  { key: "honey-banana", label: "Honey Banana" },
  { key: "chocolate-berry", label: "Chocolate Berry" },
  { key: "simple-vanilla", label: "Simple Vanilla" },
  { key: "custom", label: "Custom" },
];
