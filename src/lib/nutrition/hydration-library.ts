/* ════════════════════════════════════════════════════════════════════════
   HYDRATION BAR — performance drinks, smoothie-adjacent, general wellness.
   ------------------------------------------------------------------------
   Curated hydration / refresh / light-fuel drinks the member can browse,
   favorite, and log. Framed strictly as general wellness and performance
   support — never medical treatment, never dosing guidance. Macros shown
   are ESTIMATES. Suggestions rotate by context (training day, recovery day,
   sweat-heavy sessions, evening) and by week for freshness.
   ════════════════════════════════════════════════════════════════════════ */

export type DrinkContext = "training-day" | "recovery-day" | "sweat-heavy" | "morning" | "evening" | "anytime";

export type HydrationDrink = {
  id: string;
  name: string;
  ingredients: string[];
  /** When this drink fits best. */
  contexts: DrinkContext[];
  /** One-line why — wellness framing only. */
  why: string;
  /** Estimated macros for one serving; null for ~zero-calorie drinks. */
  est: { calories: number; proteinG: number; carbsG: number } | null;
  prepMinutes: number;
};

export const HYDRATION_LIBRARY: HydrationDrink[] = [
  {
    id: "lime-salt-mineral", name: "Lime Mineral Water",
    ingredients: ["Water", "Pinch of sea salt", "Fresh lime", "Mint"],
    contexts: ["training-day", "sweat-heavy", "anytime"],
    why: "A clean everyday hydration base — most useful around sweaty sessions.",
    est: null, prepMinutes: 2,
  },
  {
    id: "cucumber-chia-cooler", name: "Cucumber Chia Cooler",
    ingredients: ["Water", "Cucumber slices", "Lime", "Chia seeds", "Mint"],
    contexts: ["recovery-day", "morning", "anytime"],
    why: "Light, refreshing, and easy to sip through a rest day.",
    est: { calories: 70, proteinG: 2, carbsG: 8 }, prepMinutes: 4,
  },
  {
    id: "coconut-lime-refuel", name: "Coconut Lime Refuel",
    ingredients: ["Coconut water", "Lime", "Pinch of sea salt"],
    contexts: ["training-day", "sweat-heavy"],
    why: "A natural post-session refresher after high-sweat work.",
    est: { calories: 65, proteinG: 2, carbsG: 12 }, prepMinutes: 2,
  },
  {
    id: "watermelon-mint", name: "Watermelon Mint Chill",
    ingredients: ["Watermelon", "Mint", "Lime", "Cold water"],
    contexts: ["sweat-heavy", "recovery-day"],
    why: "Summer-weight refreshment that still counts toward fluids.",
    est: { calories: 60, proteinG: 1, carbsG: 15 }, prepMinutes: 5,
  },
  {
    id: "greek-berry-bowl-shake", name: "Greek Berry Cooler",
    ingredients: ["Greek yogurt", "Mixed berries", "Honey", "Ice", "Splash of milk"],
    contexts: ["morning", "recovery-day"],
    why: "A light protein-forward refresher between meals.",
    est: { calories: 220, proteinG: 18, carbsG: 30 }, prepMinutes: 4,
  },
  {
    id: "banana-oat-fuel", name: "Banana Oat Fuel Shake",
    ingredients: ["Banana", "Oats", "Peanut butter", "Whey protein", "Milk or almond milk"],
    contexts: ["training-day", "morning"],
    why: "A real pre-training fuel option when a full meal doesn't fit.",
    est: { calories: 430, proteinG: 35, carbsG: 48 }, prepMinutes: 4,
  },
  {
    id: "citrus-morning-starter", name: "Citrus Morning Starter",
    ingredients: ["Water", "Lemon", "Pinch of sea salt", "Honey (optional)"],
    contexts: ["morning", "anytime"],
    why: "A simple wake-up glass before coffee touches the system.",
    est: { calories: 20, proteinG: 0, carbsG: 6 }, prepMinutes: 1,
  },
  {
    id: "berry-recovery-slush", name: "Berry Recovery Slush",
    ingredients: ["Frozen berries", "Coconut water", "Lime", "Mint"],
    contexts: ["recovery-day", "sweat-heavy"],
    why: "Cold, light, and easy after an outdoor or conditioning day.",
    est: { calories: 90, proteinG: 1, carbsG: 21 }, prepMinutes: 4,
  },
  {
    id: "cocoa-night-wind-down", name: "Cocoa Wind-Down",
    ingredients: ["Warm milk or almond milk", "Cocoa powder", "Honey", "Cinnamon"],
    contexts: ["evening"],
    why: "A warm evening ritual that closes the kitchen calmly.",
    est: { calories: 140, proteinG: 6, carbsG: 18 }, prepMinutes: 4,
  },
  {
    id: "mint-green-refresher", name: "Cold Mint Green Tea",
    ingredients: ["Green tea (chilled)", "Mint", "Lime"],
    contexts: ["morning", "anytime"],
    why: "A no-sugar refresher for long afternoons.",
    est: null, prepMinutes: 3,
  },
  {
    id: "pineapple-ginger-cooler", name: "Pineapple Ginger Cooler",
    ingredients: ["Pineapple", "Fresh ginger", "Cold water", "Lime"],
    contexts: ["recovery-day", "anytime"],
    why: "Bright and aromatic — keeps rest-day hydration interesting.",
    est: { calories: 80, proteinG: 1, carbsG: 20 }, prepMinutes: 5,
  },
  {
    id: "vanilla-protein-frost", name: "Vanilla Protein Frost",
    ingredients: ["Whey protein", "Ice", "Almond milk", "Cinnamon"],
    contexts: ["training-day", "evening"],
    why: "A dessert-feel protein hit that respects the day's targets.",
    est: { calories: 180, proteinG: 30, carbsG: 6 }, prepMinutes: 3,
  },
];

export type HydrationLogEntry = {
  date: string; // ISO date (yyyy-mm-dd)
  drinkId: string;
  name: string;
  loggedAt: string; // ISO timestamp
};

/** Contexts that apply right now, given the member's day. */
export function activeDrinkContexts(input: { isTrainingDay: boolean; sweatHeavy?: boolean; hour: number }): DrinkContext[] {
  const out: DrinkContext[] = ["anytime"];
  out.push(input.isTrainingDay ? "training-day" : "recovery-day");
  if (input.sweatHeavy) out.push("sweat-heavy");
  if (input.hour < 11) out.push("morning");
  if (input.hour >= 19) out.push("evening");
  return out;
}

/** Suggest drinks for the current context, most specific first. */
export function suggestDrinks(contexts: DrinkContext[], limit = 4): HydrationDrink[] {
  const scored = HYDRATION_LIBRARY.map((d) => ({
    d,
    score: d.contexts.reduce((s, c) => s + (contexts.includes(c) ? (c === "anytime" ? 1 : 2) : 0), 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.d);
}

/** Deterministic "drink of the week" — rotates with the game-plan week. */
export function drinkOfTheWeek(weekNumber: number): HydrationDrink {
  const idx = Math.abs(Math.round(weekNumber) - 1) % HYDRATION_LIBRARY.length;
  return HYDRATION_LIBRARY[idx];
}
