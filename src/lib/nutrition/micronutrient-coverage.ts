/* ════════════════════════════════════════════════════════════════════════
   FOOD-BASED MICRONUTRIENT COVERAGE

   Estimates likely nutrition coverage FROM FOODS in the day's plan / logs.
   This is NOT lab interpretation and NOT a medical deficiency diagnosis. It
   surfaces food-based coverage signals and food suggestions only.

   Language stays food-based: "low coverage", "possible intake gap",
   "coverage watch" — never "deficient", never "treat", never "dose".
   ════════════════════════════════════════════════════════════════════════ */

export type CoverageStatus = "strong" | "watch" | "low" | "unknown";

export const COVERAGE_STATUS_LABEL: Record<CoverageStatus, string> = {
  strong: "Strong Coverage",
  watch: "Coverage Watch",
  low: "Low Coverage",
  unknown: "Unknown",
};

export type CoverageCategory = {
  key: string;
  label: string;
  /** Food-based suggestion when coverage is low. */
  foodSuggestion: string;
  /** Plain-language food reason. No medical claims. */
  whyItMatters: string;
  /** Optional clinician note for categories people often ask about medically. */
  clinicianNote?: boolean;
};

/** Ordered category library. Keys match the `covers` tags used by fuel-plan meals. */
export const COVERAGE_CATEGORIES: CoverageCategory[] = [
  { key: "protein", label: "Protein Distribution", foodSuggestion: "Spread protein across meals — eggs, chicken, beef, fish, Greek yogurt, or whey.", whyItMatters: "Even protein across the day supports training and recovery food coverage." },
  { key: "vitamin-c", label: "Vitamin C Foods", foodSuggestion: "Add orange juice, kiwi, strawberries, bell peppers, or citrus with a meal.", whyItMatters: "Citrus and peppers raise vitamin C food coverage in the daily plan." },
  { key: "vitamin-d", label: "Vitamin D Foods", foodSuggestion: "Add salmon, trout, eggs, or fortified dairy across the week.", whyItMatters: "Fatty fish and eggs add vitamin D food sources to the plan.", clinicianNote: true },
  { key: "iron", label: "Iron Foods", foodSuggestion: "Add lean steak, ground beef, turkey, eggs, beans, or spinach across the week.", whyItMatters: "Red meat, poultry, beans, and greens raise iron food coverage.", clinicianNote: true },
  { key: "omega-3", label: "Omega-3 Foods", foodSuggestion: "Add fatty fish 1–2 times this week based on preference.", whyItMatters: "Fatty fish adds omega-3 food coverage to the weekly plan.", clinicianNote: true },
  { key: "magnesium", label: "Magnesium Foods", foodSuggestion: "Add spinach, pumpkin seeds, almonds, black beans, or dark chocolate.", whyItMatters: "Greens, seeds, and legumes raise magnesium food coverage." },
  { key: "potassium", label: "Potassium Foods", foodSuggestion: "Add potatoes, bananas, avocado, beans, or yogurt.", whyItMatters: "Potatoes, fruit, and dairy raise potassium food coverage around training." },
  { key: "calcium", label: "Calcium Foods", foodSuggestion: "Add Greek yogurt, cottage cheese, milk, or fortified alternatives.", whyItMatters: "Dairy and fortified foods raise calcium food coverage." },
  { key: "fiber", label: "Fiber Foods", foodSuggestion: "Add beans, berries, oats, broccoli, or whole grains.", whyItMatters: "Legumes, fruit, and whole grains raise daily fiber food coverage." },
  { key: "folate", label: "Greens / Folate", foodSuggestion: "Add spinach, romaine, asparagus, broccoli, or avocado.", whyItMatters: "Leafy greens raise folate and vegetable food coverage." },
  { key: "zinc", label: "Zinc Foods", foodSuggestion: "Add beef, turkey, eggs, pumpkin seeds, or chickpeas.", whyItMatters: "Meat, eggs, and seeds raise zinc food coverage." },
  { key: "fruit-veg", label: "Fruit / Vegetable Diversity", foodSuggestion: "Add a second fruit or vegetable color to the day.", whyItMatters: "More fruit and vegetable variety widens overall food coverage." },
];

/** Top fish options for omega-3 food coverage, with cooking methods. */
export const OMEGA3_FISH_OPTIONS: { name: string; methods: string[]; smartRead: string }[] = [
  { name: "Salmon", methods: ["grilled", "air fryer", "baked", "pan-seared"], smartRead: "High-quality protein with strong omega-3 food coverage." },
  { name: "Sardines", methods: ["toast bowl", "rice bowl", "salad"], smartRead: "Convenient, shelf-stable omega-3 and calcium food coverage." },
  { name: "Trout", methods: ["pan-seared", "baked", "grilled"], smartRead: "Mild fish with omega-3 and vitamin D food sources." },
  { name: "Tuna", methods: ["no-cook bowl", "seared", "salad"], smartRead: "Lean, fast protein with omega-3 food coverage." },
  { name: "Mackerel", methods: ["grilled", "broiled", "pan-seared"], smartRead: "Rich omega-3 food coverage; pair with rice or greens." },
];

export type CoverageSignal = {
  key: string;
  label: string;
  status: CoverageStatus;
  foodSuggestion: string;
  whyItMatters: string;
  clinicianNote: boolean;
};

export type CoverageInput = {
  /** Coverage keys provided by today's planned (or logged) foods. */
  coveredKeys: string[];
  /** How many meals have been logged today (drives unknown vs watch). */
  loggedCount: number;
  /** Whether a meal plan exists for context. */
  hasPlan: boolean;
};

export function buildNutritionCoverage(input: CoverageInput): CoverageSignal[] {
  const covered = new Set(input.coveredKeys);
  return COVERAGE_CATEGORIES.map((c) => {
    let status: CoverageStatus;
    if (covered.has(c.key)) status = "strong";
    else if (input.hasPlan || input.loggedCount > 0) status = c.key === "protein" || c.key === "fruit-veg" ? "watch" : "low";
    else status = "unknown";
    return {
      key: c.key,
      label: c.label,
      status,
      foodSuggestion: c.foodSuggestion,
      whyItMatters: c.whyItMatters,
      clinicianNote: Boolean(c.clinicianNote),
    };
  });
}

/** Compact summary counts for headers. */
export function coverageSummary(signals: CoverageSignal[]): { strong: number; watch: number; low: number } {
  return signals.reduce(
    (acc, s) => {
      if (s.status === "strong") acc.strong += 1;
      else if (s.status === "watch") acc.watch += 1;
      else if (s.status === "low") acc.low += 1;
      return acc;
    },
    { strong: 0, watch: 0, low: 0 },
  );
}
