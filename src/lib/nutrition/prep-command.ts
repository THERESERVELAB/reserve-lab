/* ════════════════════════════════════════════════════════════════════════
   PREP COMMAND — weekly grocery list + meal-prep guidance derived from the
   Weekly Fuel Plan (per-day fuel plans across the shared training week).

   Food planning and kitchen logistics only. Quantities are shopping
   estimates from the plan's own ingredient amounts — never portion or
   intake directives. No medical claims, no supplement/dosage guidance.
   Pure deterministic helpers; no store access.
   ════════════════════════════════════════════════════════════════════════ */

import type { PlannedFuelMeal } from "./fuel-plan";

/* ─── Categories (shopper-facing buckets) ─────────────────────────────────── */
export type PrepCategory =
  | "protein" | "carbs" | "fruits" | "vegetables"
  | "fats" | "dairy" | "pantry" | "hydration-extras";

export const PREP_CATEGORY_ORDER: PrepCategory[] = [
  "protein", "carbs", "fruits", "vegetables", "fats", "dairy", "pantry", "hydration-extras",
];

export const PREP_CATEGORY_LABEL: Record<PrepCategory, string> = {
  protein: "Protein",
  carbs: "Carbs",
  fruits: "Fruits",
  vegetables: "Vegetables",
  fats: "Fats",
  dairy: "Dairy",
  pantry: "Pantry",
  "hydration-extras": "Hydration / Extras",
};

/** Map an ingredient name to a shopper bucket. Combo strings ("soy + ginger")
    are sauce/aromatic blends and shop as pantry. Order of checks matters. */
export function prepCategoryFor(name: string): PrepCategory {
  const n = name.toLowerCase();
  if (/\+/.test(n) || /(jelly|jam|honey|salsa|sauce|soy\b|mustard|monk fruit|agave|seasoning|\bsalt\b|spice|sweetener)/.test(n)) return "pantry";
  if (/(yogurt|cottage|cheese|milk|whey|parmesan|kefir|creamer|casein)/.test(n)) return "dairy";
  if (/(water|electrolyte|coffee|espresso|cold brew|matcha|\btea\b|sparkling)/.test(n)) return "hydration-extras";
  if (/(avocado|olive oil|\boil\b|nut butter|peanut|almond|walnut|cashew|\bnuts?\b|chia|flax|seeds|sesame|\bbutter\b)/.test(n)) return "fats";
  if (/(berr|banana|apple|citrus|orange|pineapple|lemon|lime|kiwi|melon|grape|fruit)/.test(n)) return "fruits";
  if (/(spinach|greens|broccoli|pepper|cucumber|asparagus|tomato|lettuce|romaine|edamame|onion|garlic|zucchini|kale|\bveg)/.test(n)) return "vegetables";
  if (/(egg|chicken|beef|steak|turkey|salmon|tuna|\bfish\b|shrimp|cod|tilapia|sardine|tofu|tempeh|jerky|ground|protein)/.test(n)) return "protein";
  if (/(rice|sourdough|bread|potato|\boat|granola|pasta|tortilla|cereal|quinoa|bagel)/.test(n)) return "carbs";
  if (/(bean|lentil|chickpea)/.test(n)) return "pantry";
  return "pantry";
}

/* ─── Ingredient parsing (quantity estimates only when safely parseable) ──── */
const UNIT = "(g|kg|oz|ml|l|cups?|tbsp|tsp|slices?|scoops?|shots?|count)";
const RANGE_RE = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*[–—-]\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s+(.+)$`, "i");
const SINGLE_RE = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s+(.+)$`, "i");

type ParsedIngredient = {
  name: string;
  /** Per-use quantity, when the ingredient string carries one. */
  qty: number | null;
  /** Upper bound when the string is a range ("1–2 slices"). */
  qtyHigh: number | null;
  unit: string;
};

function normalizeUnit(u: string | undefined | null): string {
  if (!u) return "count";
  const x = u.toLowerCase();
  if (x === "cups") return "cup";
  if (x === "slices") return "slice";
  if (x === "scoops") return "scoop";
  if (x === "shots") return "shot";
  return x;
}

export function parseIngredient(raw: string): ParsedIngredient {
  const s = raw.replace(/\s*\(optional\)\s*/gi, " ").replace(/\s+/g, " ").trim();
  const range = s.match(RANGE_RE);
  if (range) {
    return { name: range[4].trim(), qty: parseFloat(range[1]), qtyHigh: parseFloat(range[2]), unit: normalizeUnit(range[3]) };
  }
  const single = s.match(SINGLE_RE);
  if (single) {
    return { name: single[3].trim(), qty: parseFloat(single[1]), qtyHigh: null, unit: normalizeUnit(single[2]) };
  }
  return { name: s, qty: null, qtyHigh: null, unit: "count" };
}

/* ─── Weekly grocery list ─────────────────────────────────────────────────── */
export type WeeklyGroceryItem = {
  /** Stable key for bought-state tracking (normalized name). */
  key: string;
  name: string;
  category: PrepCategory;
  /** Times the ingredient appears across the week's planned meals. */
  weeklyUses: number;
  /** Distinct meals this item supports. */
  mealsSupported: string[];
  /** Shopping estimate ("≈ 840 g this week") — null when not safely parseable. */
  quantityEstimate: string | null;
};

export type PrepDayInput = {
  day: string;
  recovery: boolean;
  sessionName: string;
  meals: PlannedFuelMeal[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatEstimate(qty: number, qtyHigh: number | null, unit: string, uses: number): string {
  const total = round1(qty * uses);
  const totalHigh = qtyHigh !== null ? round1(qtyHigh * uses) : null;
  if (unit === "g" && total >= 1000 && totalHigh === null) return `≈ ${round1(total / 1000)} kg this week`;
  const span = totalHigh !== null ? `${total}–${totalHigh}` : `${total}`;
  if (unit === "count") return `≈ ${span} this week`;
  const plural = (totalHigh ?? total) !== 1 && ["cup", "slice", "scoop", "shot"].includes(unit) ? "s" : "";
  return `≈ ${span} ${unit}${plural} this week`;
}

export function buildWeeklyGroceryList(days: PrepDayInput[]): WeeklyGroceryItem[] {
  type Acc = {
    name: string; uses: number; meals: Set<string>;
    qty: number | null; qtyHigh: number | null; unit: string; estimable: boolean;
  };
  const map = new Map<string, Acc>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const raw of meal.ingredients) {
        if (!raw.trim()) continue;
        const p = parseIngredient(raw);
        if (/^water$/i.test(p.name)) continue; // plain water isn't a grocery line
        const key = p.name.toLowerCase();
        const acc = map.get(key) ?? {
          name: p.name, uses: 0, meals: new Set<string>(),
          qty: p.qty, qtyHigh: p.qtyHigh, unit: p.unit, estimable: p.qty !== null,
        };
        acc.uses += 1;
        acc.meals.add(meal.name);
        // Estimate only when every occurrence carries the same per-use amount + unit.
        if (p.qty === null || p.qty !== acc.qty || p.unit !== acc.unit || p.qtyHigh !== acc.qtyHigh) {
          if (acc.uses > 1) acc.estimable = acc.estimable && p.qty === acc.qty && p.unit === acc.unit && p.qtyHigh === acc.qtyHigh;
          else acc.estimable = p.qty !== null;
        }
        map.set(key, acc);
      }
    }
  }

  const items: WeeklyGroceryItem[] = [];
  for (const [key, acc] of map.entries()) {
    items.push({
      key,
      name: acc.name,
      category: prepCategoryFor(acc.name),
      weeklyUses: acc.uses,
      mealsSupported: Array.from(acc.meals),
      quantityEstimate: acc.estimable && acc.qty !== null
        ? formatEstimate(acc.qty, acc.qtyHigh, acc.unit, acc.uses)
        : null,
    });
  }

  items.sort((a, b) => {
    const ca = PREP_CATEGORY_ORDER.indexOf(a.category);
    const cb = PREP_CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    if (b.weeklyUses !== a.weeklyUses) return b.weeklyUses - a.weeklyUses;
    return a.name.localeCompare(b.name);
  });
  return items;
}

export function groupGroceryByCategory(items: WeeklyGroceryItem[]): Array<{ category: PrepCategory; items: WeeklyGroceryItem[] }> {
  return PREP_CATEGORY_ORDER
    .map((category) => ({ category, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);
}

/* ─── Meal prep guidance ──────────────────────────────────────────────────── */
export type PrepStep = { title: string; detail: string };

export type RepeatableMeal = {
  name: string;
  /** Times the meal appears across the week. */
  count: number;
  /** First planned occurrence — used for Save Favorite. */
  meal: PlannedFuelMeal;
};

export type PrepGuidance = {
  cookFirst: PrepStep[];
  batchPrep: PrepStep[];
  keepFresh: PrepStep[];
  repeatable: RepeatableMeal[];
  trainingDayPrep: PrepStep[];
  recoveryDayPrep: PrepStep[];
};

const BATCHABLE_RE = /(rice(?!\s*cake)|ground|chicken|turkey|beef|steak|potato|\boat|quinoa|egg)/i;
const FRESH_SEAFOOD_RE = /(salmon|\bfish\b|shrimp|cod|tilapia)/i;
const FRESH_PRODUCE_RE = /(avocado|berr|greens|spinach|cucumber|tomato|asparagus|lettuce|banana)/i;

function usesLabel(uses: number): string {
  return `${uses} meal${uses === 1 ? "" : "s"}`;
}

export function buildPrepGuidance(days: PrepDayInput[], grocery: WeeklyGroceryItem[]): PrepGuidance {
  /* Batch prep — staples the week leans on (≥3 uses, batch-friendly). */
  const batchItems = grocery.filter((g) => g.weeklyUses >= 3 && BATCHABLE_RE.test(g.name));
  const batchPrep: PrepStep[] = batchItems.slice(0, 5).map((g) => ({
    title: g.name,
    detail: `Appears in ${usesLabel(g.weeklyUses)} this week — cook one batch and portion it out.`,
  }));

  /* Cook first — the protein and carb anchors carrying the most meals. */
  const cookFirst: PrepStep[] = [];
  const leadProtein = batchItems.find((g) => g.category === "protein")
    ?? grocery.find((g) => g.category === "protein" && BATCHABLE_RE.test(g.name));
  const leadCarb = batchItems.find((g) => g.category === "carbs")
    ?? grocery.find((g) => g.category === "carbs" && BATCHABLE_RE.test(g.name));
  if (leadProtein) cookFirst.push({ title: leadProtein.name, detail: `Anchors ${usesLabel(leadProtein.weeklyUses)} — start it first so the rest of prep stacks behind it.` });
  if (leadCarb) cookFirst.push({ title: leadCarb.name, detail: `Carb base for ${usesLabel(leadCarb.weeklyUses)} — cook while the protein works.` });
  const noCookMeals = Array.from(new Set(
    days.flatMap((d) => d.meals).filter((m) => m.prep.some((p) => /no-cook|assemble/.test(p))).map((m) => m.name),
  ));
  if (noCookMeals.length) {
    cookFirst.push({ title: "Assemble-only meals last", detail: `${noCookMeals.slice(0, 3).join(" · ")} need no cooking — portion them after the stove work is done.` });
  }

  /* Keep fresh — items that lose quality when batch-cooked. */
  const keepFresh: PrepStep[] = [];
  for (const g of grocery) {
    if (keepFresh.length >= 5) break;
    if (FRESH_SEAFOOD_RE.test(g.name)) {
      keepFresh.push({ title: g.name, detail: "Cook the day you eat it — seafood doesn't hold quality as a batch." });
    } else if (FRESH_PRODUCE_RE.test(g.name)) {
      keepFresh.push({ title: g.name, detail: "Buy fresh and cut day-of so it holds texture through the week." });
    }
  }

  /* Repeatable — meals the plan already repeats across the week. */
  const mealCounts = new Map<string, RepeatableMeal>();
  for (const day of days) {
    for (const m of day.meals) {
      const existing = mealCounts.get(m.name);
      if (existing) existing.count += 1;
      else mealCounts.set(m.name, { name: m.name, count: 1, meal: m });
    }
  }
  const repeatable = Array.from(mealCounts.values())
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  /* Training-day prep — from the actual high-output days in the week. */
  const trainingDays = days.filter((d) => !d.recovery);
  const trainingDayPrep: PrepStep[] = [];
  if (trainingDays.length) {
    const preMeal = trainingDays.flatMap((d) => d.meals).find((m) => m.slot === "pre-workout");
    const postMeal = trainingDays.flatMap((d) => d.meals).find((m) => m.slot === "post-workout");
    trainingDayPrep.push({
      title: `${trainingDays.length} high-output day${trainingDays.length === 1 ? "" : "s"} · ${trainingDays.map((d) => d.day).join(" · ")}`,
      detail: "Carbs sit closest to the session on these days — have the carb base portioned the night before.",
    });
    if (preMeal) trainingDayPrep.push({ title: `Pre-session · ${preMeal.name}`, detail: "Keep its ingredients staged so the session starts fueled without morning prep." });
    if (postMeal) trainingDayPrep.push({ title: `Post-session · ${postMeal.name}`, detail: "Fast to assemble — keep it ready so the refuel lands right after training." });
  }

  /* Recovery-day prep — from the actual recovery days in the week. */
  const recoveryDays = days.filter((d) => d.recovery);
  const recoveryDayPrep: PrepStep[] = [];
  if (recoveryDays.length) {
    const recoveryDinner = recoveryDays.flatMap((d) => d.meals).find((m) => m.slot === "dinner");
    recoveryDayPrep.push({
      title: `${recoveryDays.length} recovery day${recoveryDays.length === 1 ? "" : "s"} · ${recoveryDays.map((d) => d.day).join(" · ")}`,
      detail: "Vegetable-forward with controlled carbs — prep greens fresh on the day instead of ahead.",
    });
    if (recoveryDinner) recoveryDayPrep.push({ title: `Lead dinner · ${recoveryDinner.name}`, detail: "Lighter and easy on digestion — a good slot to use up fresh produce." });
  }

  return { cookFirst, batchPrep, keepFresh, repeatable, trainingDayPrep, recoveryDayPrep };
}
