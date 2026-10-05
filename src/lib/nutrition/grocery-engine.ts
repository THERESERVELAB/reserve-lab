/* ════════════════════════════════════════════════════════════════════════
   WEEKLY GROCERY LIST + FOOD INVENTORY + RESTOCK ENGINE
   ------------------------------------------------------------------------
   Turns the weekly meal plan (+ smoothies + beverages) into shopping
   quantities, lets members log what they actually bought, then computes
   inventory burn rate, restock status, and budget rollups.

   Grocery planning, budgeting, and inventory tracking only — no medical
   advice or claims. Store/quality preferences are member choices; no store
   is asserted as medically superior.
   ════════════════════════════════════════════════════════════════════════ */

import type { SignatureMeal } from "./signature-meals";
import type { DietStyleKey, MacroRole, MealPlan } from "./types";
import { canConvert, convert, unitDimension } from "./units";

/* ─── Categories & stores ────────────────────────── */
export type GroceryCategory =
  | "protein" | "carb" | "fat" | "fruit" | "vegetable"
  | "smoothie" | "dairy" | "coffee" | "hydration"
  | "seasoning" | "pantry" | "frozen" | "supplement";

export type StoreKey =
  | "whole-foods" | "sprouts" | "costco" | "aldi" | "trader-joes"
  | "farmers-market" | "publix" | "walmart" | "target" | "sams-club"
  | "butcher" | "seafood-market" | "online" | "custom";

export type StoreTier = "premium" | "bulk" | "budget" | "local" | "standard" | "online";

export const STORES: Array<{ key: StoreKey; label: string; tier: StoreTier; note: string }> = [
  { key: "whole-foods", label: "Whole Foods", tier: "premium", note: "Premium clean-label option" },
  { key: "sprouts", label: "Sprouts", tier: "premium", note: "Clean-label option" },
  { key: "costco", label: "Costco", tier: "bulk", note: "Bulk protein / staples" },
  { key: "sams-club", label: "Sam's Club", tier: "bulk", note: "Bulk option" },
  { key: "aldi", label: "Aldi", tier: "budget", note: "Budget-friendly option" },
  { key: "walmart", label: "Walmart", tier: "budget", note: "Budget option" },
  { key: "trader-joes", label: "Trader Joe's", tier: "standard", note: "Standard option" },
  { key: "publix", label: "Publix", tier: "standard", note: "Standard option" },
  { key: "target", label: "Target", tier: "standard", note: "Standard option" },
  { key: "farmers-market", label: "Local Farmers Market", tier: "local", note: "Local produce" },
  { key: "butcher", label: "Local Butcher", tier: "local", note: "Meat quality option" },
  { key: "seafood-market", label: "Seafood Market", tier: "local", note: "Fish / seafood quality option" },
  { key: "online", label: "Online / Delivery", tier: "online", note: "Delivery option" },
  { key: "custom", label: "Custom", tier: "standard", note: "Member-defined" },
];

export function storeTier(key: StoreKey): StoreTier {
  return STORES.find((s) => s.key === key)?.tier ?? "standard";
}

export type QualityPreference =
  | "organic" | "grass-fed" | "pasture-raised" | "wild-caught" | "local"
  | "frozen-ok" | "bulk-ok" | "budget-first" | "clean-label" | "avoid-seed-oils"
  | "avoid-artificial-sweeteners" | "avoid-high-sugar-sauces" | "avoid-ultraprocessed";

export type StorePreferences = {
  preferredStores?: StoreKey[];
  qualityPreferences?: QualityPreference[];
};

/* ─── Beverage preferences ───────────────────────── */
export type CaffeineStyle =
  | "iced-coffee" | "cold-brew" | "espresso" | "black-coffee"
  | "coffee-with-milk" | "matcha" | "tea" | "caffeine-free"
  | "pre-workout" | "electrolyte";

export type BeveragePreferences = {
  preferredCaffeineStyle?: CaffeineStyle;
  caffeineCutoffTime?: string;
  coffeeAddIns?: string[];
  dairyAllowed?: boolean;
  sweetenerPreference?: string;
  electrolytesInPlan?: boolean;
};

/* ─── Grocery + inventory types ──────────────────── */
export type RestockPriority = "low" | "normal" | "high";

export type GroceryItem = {
  id: string;
  name: string;
  category: GroceryCategory;
  role?: MacroRole;
  quantityNeeded: number;
  unit: string;
  weeklyUses: number;
  mealsSupported: string[];
  estimatedCost: number;
  preferredStore?: StoreKey;
  alternativeStore?: StoreKey;
  qualityNote?: string;
  priority: RestockPriority;
};

export type PurchaseLog = {
  id: string;
  itemName: string;
  category: GroceryCategory;
  quantityPurchased: number;
  unit: string;
  packageSize?: string;
  store: StoreKey;
  pricePaid: number;
  purchaseDate: string;
  expirationDate?: string;
  qualityTags?: string[];
  notes?: string;
};

export type InventoryStatus =
  | "stocked" | "low-soon" | "re-up-needed" | "overbought" | "unit-review" | "not-purchased";

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  stocked: "Stocked",
  "low-soon": "Low Soon",
  "re-up-needed": "Re-Up Needed",
  overbought: "Overbought",
  "unit-review": "Unit Review Needed",
  "not-purchased": "Not Purchased",
};

export type InventoryItem = {
  itemName: string;
  category: GroceryCategory;
  neededQty: number;
  neededUnit: string;
  purchasedQty: number | null;
  purchasedUnit: string | null;
  remainingQty: number | null;
  remainingUnit: string | null;
  weeksOfSupply: number | null;
  costPerServing: number | null;
  weeklyCost: number | null;
  restockEstimate: string;
  status: InventoryStatus;
  note: string;
};

/* ─── Default serving sizes per macro role ───────── */
function defaultServing(role: MacroRole, name: string): { qty: number; unit: string } {
  const n = name.toLowerCase();
  if (role === "protein") return { qty: 170, unit: "g" };
  if (role === "carb") {
    if (n.includes("fruit") || n.includes("banana") || n.includes("berries")) return { qty: 1, unit: "count" };
    return { qty: 150, unit: "g" };
  }
  if (role === "fat") return { qty: 15, unit: "g" };
  if (role === "produce") return { qty: 100, unit: "g" };
  if (role === "snack") return { qty: 1, unit: "count" };
  return { qty: 1, unit: "count" };
}

function categoryForFood(role: MacroRole, name: string): GroceryCategory {
  const n = name.toLowerCase();
  if (n.includes("yogurt") || n.includes("cheese") || n.includes("milk") || n.includes("whey")) return "dairy";
  if (n.includes("fruit") || n.includes("berries") || n.includes("banana") || n.includes("apple")) return "fruit";
  if (role === "protein") return "protein";
  if (role === "carb") return "carb";
  if (role === "fat") return "fat";
  if (role === "produce") return "vegetable";
  if (role === "sauce") return "seasoning";
  if (role === "snack") return "pantry";
  return "pantry";
}

/* ─── Cost estimation (rough, per base unit by category × store tier) ── */
const COST_PER_G: Record<string, number> = { protein: 0.013, carb: 0.004, fat: 0.02, fruit: 0.006, vegetable: 0.005, dairy: 0.01 };
const TIER_MULT: Record<StoreTier, number> = { premium: 1.4, standard: 1.0, bulk: 0.8, budget: 0.75, local: 1.25, online: 1.15 };

function estimateCost(category: GroceryCategory, qty: number, unit: string, tier: StoreTier): number {
  const perG = COST_PER_G[category];
  if (perG !== undefined && unitDimension(unit) === "mass") {
    const grams = convert(qty, unit, "g") ?? qty;
    return Math.round(grams * perG * TIER_MULT[tier] * 100) / 100;
  }
  // count-based default per-unit price
  const perCount = category === "fruit" ? 0.9 : category === "coffee" ? 6 : category === "smoothie" ? 2.5 : 1.5;
  return Math.round(qty * perCount * TIER_MULT[tier] * 100) / 100;
}

/* ─── Food-aware quality classification ──────────────
   Quality tags must match the actual food, not just the macro role. Plant
   foods (tofu, tempeh, lentils, grains, produce, coffee) must NEVER carry
   animal-quality language like "grass-fed". */
type QualityClass =
  | "red-meat" | "poultry" | "egg" | "seafood" | "dairy"
  | "produce" | "grain" | "legume" | "plant-protein" | "nut" | "fat-oil" | "coffee" | "other";

function qualityClassForFood(name: string, role?: MacroRole): QualityClass {
  const n = name.toLowerCase();
  // Plant proteins first — must not be mistaken for animal protein.
  if (/(tofu|tempeh|seitan|edamame|soy|plant protein|vegan protein)/.test(n)) return "plant-protein";
  if (/(lentil|chickpea|black bean|bean|legume)/.test(n)) return "legume";
  if (/(coffee|espresso|cold brew|matcha|tea)/.test(n)) return "coffee";
  if (/(olive oil|avocado oil|coconut oil|seed oil|\boil\b|seeds|chia|flax)/.test(n)) return "fat-oil";
  if (/(almond|peanut|walnut|cashew|pistachio|mixed nut|nut butter|nuts)/.test(n)) return "nut";
  if (/(salmon|tuna|fish|shrimp|seafood|cod|tilapia|sardine|mackerel|scallop)/.test(n)) return "seafood";
  if (/(egg)/.test(n)) return "egg";
  if (/(chicken|turkey|poultry|duck)/.test(n)) return "poultry";
  if (/(beef|bison|lamb|venison|steak|ribeye|sirloin|tallow|jerky|red meat|game|brisket|short rib)/.test(n)) return "red-meat";
  if (/(yogurt|cheese|milk|whey|kefir|cottage|butter|ghee|cream|casein|parmesan)/.test(n)) return "dairy";
  if (/(rice|oat|pasta|quinoa|sourdough|bread|granola|cereal|rice cake)/.test(n)) return "grain";
  if (/(fruit|berries|berry|banana|apple|greens|vegetable|veg|avocado|potato|honey|jam)/.test(n)) return "produce";
  if (role === "protein") return "other"; // unknown animal/blend protein → no animal-quality claim
  return "other";
}

function qualityNoteFor(name: string, role: MacroRole, prefs?: StorePreferences): string | undefined {
  const q = prefs?.qualityPreferences ?? [];
  const has = (p: QualityPreference) => q.includes(p);
  const cls = qualityClassForFood(name, role);

  switch (cls) {
    case "red-meat":
      if (has("grass-fed")) return "Grass-fed preferred";
      if (has("organic")) return "Organic preferred";
      break;
    case "poultry":
      if (has("pasture-raised")) return "Pasture-raised preferred";
      if (has("organic")) return "Organic preferred";
      break;
    case "egg":
      if (has("pasture-raised")) return "Pasture-raised preferred";
      if (has("organic")) return "Organic preferred";
      break;
    case "seafood":
      if (has("wild-caught")) return "Wild-caught preferred";
      if (has("organic")) return "Sustainably sourced preferred";
      break;
    case "dairy":
      if (has("grass-fed")) return "Grass-fed dairy preferred";
      if (has("organic")) return "Organic dairy preferred";
      break;
    case "produce":
      if (has("local")) return "Local preferred";
      if (has("organic")) return "Organic preferred";
      break;
    case "plant-protein":
      if (has("organic")) return "Organic / non-GMO preferred";
      break;
    case "grain":
    case "legume":
    case "nut":
      if (has("organic")) return "Organic preferred";
      break;
    case "fat-oil":
      if (has("organic")) return "Organic / cold-pressed preferred";
      if (has("clean-label")) return "Clean-label preferred";
      break;
    case "coffee":
      if (has("organic") || has("clean-label")) return "Organic / clean-label preferred";
      break;
    default:
      break;
  }
  // Safe, food-agnostic fallbacks (never animal-quality language).
  if (has("clean-label")) return "Clean-label preferred";
  if (has("budget-first")) return "Budget-friendly option";
  return undefined;
}

function preferredStoreFor(category: GroceryCategory, prefs?: StorePreferences): { preferred?: StoreKey; alt?: StoreKey } {
  const stores = prefs?.preferredStores ?? [];
  if (stores.length === 0) return {};
  // Light routing: protein → butcher/costco if present; fish → seafood; produce → farmers market.
  const find = (...keys: StoreKey[]) => keys.find((k) => stores.includes(k));
  if (category === "protein") return { preferred: find("butcher", "costco", "whole-foods") ?? stores[0], alt: stores[1] };
  if (category === "fruit" || category === "vegetable") return { preferred: find("farmers-market", "sprouts", "whole-foods") ?? stores[0], alt: stores[1] };
  if (category === "dairy" || category === "smoothie") return { preferred: find("whole-foods", "sprouts", "costco") ?? stores[0], alt: stores[1] };
  return { preferred: stores[0], alt: stores[1] };
}

/* ════════════════════════════════════════════════════════════════════════
   GROCERY LIST GENERATION
   ════════════════════════════════════════════════════════════════════════ */

export type GroceryListInput = {
  plans: MealPlan[];                 // 1–7 day plans
  dietStyle: DietStyleKey;
  storePrefs?: StorePreferences;
  beverages?: BeveragePreferences;
};

export function buildGroceryList(input: GroceryListInput): GroceryItem[] {
  const { plans, storePrefs, beverages } = input;
  const tier = storePrefs?.preferredStores?.length ? storeTier(storePrefs.preferredStores[0]) : "standard";

  type Acc = { name: string; role: MacroRole; uses: number; meals: Set<string> };
  const map = new Map<string, Acc>();

  for (const plan of plans) {
    for (const meal of plan.meals) {
      for (const food of meal.foods) {
        const key = `${food.role}:${food.name.toLowerCase()}`;
        const acc = map.get(key) ?? { name: food.name, role: food.role, uses: 0, meals: new Set<string>() };
        acc.uses += 1;
        acc.meals.add(meal.name);
        map.set(key, acc);
      }
    }
  }

  const items: GroceryItem[] = [];
  let n = 0;
  for (const acc of map.values()) {
    const serving = defaultServing(acc.role, acc.name);
    const category = categoryForFood(acc.role, acc.name);
    const quantityNeeded = Math.round(serving.qty * acc.uses * 10) / 10;
    const route = preferredStoreFor(category, storePrefs);
    const itemTier = route.preferred ? storeTier(route.preferred) : tier;
    items.push({
      id: `g-${n++}`,
      name: acc.name,
      category,
      role: acc.role,
      quantityNeeded,
      unit: serving.unit,
      weeklyUses: acc.uses,
      mealsSupported: Array.from(acc.meals),
      estimatedCost: estimateCost(category, quantityNeeded, serving.unit, itemTier),
      preferredStore: route.preferred,
      alternativeStore: route.alt,
      qualityNote: qualityNoteFor(acc.name, acc.role, storePrefs),
      priority: acc.uses >= 4 ? "high" : acc.uses >= 2 ? "normal" : "low",
    });
  }

  // Beverages
  for (const bev of buildBeverageItems(beverages, storePrefs, tier)) {
    items.push({ ...bev, id: `g-${n++}` });
  }

  return items;
}

/* ─── Signature meal grocery contribution ───────────
   Recurring signature meals (in rotation) add their ingredients to the weekly
   grocery list at amount × frequency, so the restock engine sees real usage. */
export function buildSignatureGroceryItems(meals: SignatureMeal[], storePrefs?: StorePreferences): GroceryItem[] {
  const fallbackTier = storePrefs?.preferredStores?.length ? storeTier(storePrefs.preferredStores[0]) : "standard";
  const items: GroceryItem[] = [];
  let n = 0;
  for (const meal of meals) {
    const freq = Math.max(1, Math.round(meal.frequencyPerWeek || 1));
    for (const ing of meal.ingredients) {
      const cleanName = ing.name.trim();
      if (/^water$/i.test(cleanName)) continue; // water isn't a grocery line
      const amount = ing.amount ?? 1;
      const unit = ing.unit ?? "count";
      const category = ing.groceryCategory;
      const quantityNeeded = Math.round(amount * freq * 10) / 10;
      const route = preferredStoreFor(category, storePrefs);
      const store = ing.store ?? route.preferred;
      const itemTier = store ? storeTier(store) : fallbackTier;
      const displayName = ing.brand ? `${cleanName} · ${ing.brand}` : cleanName;
      items.push({
        id: `sig-g-${n++}`,
        name: displayName,
        category,
        quantityNeeded,
        unit,
        weeklyUses: freq,
        mealsSupported: [meal.name],
        estimatedCost: estimateCost(category, quantityNeeded, unit, itemTier),
        preferredStore: store,
        alternativeStore: route.alt,
        qualityNote: qualityNoteFor(cleanName, "snack", storePrefs),
        priority: freq >= 4 ? "high" : freq >= 2 ? "normal" : "low",
      });
    }
  }
  return items;
}

/** Merge signature grocery items into the engine list, summing same name+unit. */
export function mergeGroceryItems(base: GroceryItem[], extra: GroceryItem[]): GroceryItem[] {
  const out = base.map((g) => ({ ...g, mealsSupported: [...g.mealsSupported] }));
  for (const sg of extra) {
    const match = out.find((g) => g.name.toLowerCase() === sg.name.toLowerCase() && g.unit === sg.unit);
    if (match) {
      match.quantityNeeded = Math.round((match.quantityNeeded + sg.quantityNeeded) * 10) / 10;
      match.weeklyUses += sg.weeklyUses;
      match.estimatedCost = Math.round((match.estimatedCost + sg.estimatedCost) * 100) / 100;
      match.mealsSupported = Array.from(new Set([...match.mealsSupported, ...sg.mealsSupported]));
      match.priority = match.weeklyUses >= 4 ? "high" : match.weeklyUses >= 2 ? "normal" : "low";
    } else {
      out.push({ ...sg });
    }
  }
  return out;
}

function buildBeverageItems(beverages: BeveragePreferences | undefined, prefs: StorePreferences | undefined, tier: StoreTier): Omit<GroceryItem, "id">[] {
  if (!beverages?.preferredCaffeineStyle || beverages.preferredCaffeineStyle === "caffeine-free") {
    return beverages?.electrolytesInPlan ? [electrolyteItem(tier)] : [];
  }
  const out: Omit<GroceryItem, "id">[] = [];
  const style = beverages.preferredCaffeineStyle;
  const dairyOk = beverages.dairyAllowed ?? true;

  const coffeeBase: Omit<GroceryItem, "id"> = {
    name: style === "cold-brew" ? "Cold Brew Concentrate"
      : style === "espresso" ? "Espresso Pods / Beans"
      : style === "matcha" ? "Matcha Powder"
      : style === "tea" ? "Tea"
      : "Coffee Beans / Cold Brew",
    category: "coffee", quantityNeeded: 1, unit: "count", weeklyUses: 7,
    mealsSupported: ["Caffeine routine"], estimatedCost: estimateCost("coffee", 1, "count", tier),
    preferredStore: prefs?.preferredStores?.[0], priority: "normal",
  };
  out.push(coffeeBase);

  if (style === "iced-coffee" || style === "coffee-with-milk" || style === "matcha") {
    out.push({
      name: dairyOk ? "Milk / Creamer" : "Almond / Oat Milk",
      category: dairyOk ? "dairy" : "pantry", quantityNeeded: 1, unit: "count", weeklyUses: 7,
      mealsSupported: ["Coffee add-in"], estimatedCost: estimateCost("dairy", 1, "count", tier),
      preferredStore: prefs?.preferredStores?.[0], priority: "low",
    });
  }
  if (beverages.electrolytesInPlan) out.push(electrolyteItem(tier));
  return out;
}

function electrolyteItem(tier: StoreTier): Omit<GroceryItem, "id"> {
  return {
    name: "Electrolytes", category: "hydration", quantityNeeded: 1, unit: "count", weeklyUses: 7,
    mealsSupported: ["Hydration"], estimatedCost: estimateCost("hydration", 1, "count", tier), priority: "low",
  };
}

/* ════════════════════════════════════════════════════════════════════════
   INVENTORY / RESTOCK ENGINE
   ════════════════════════════════════════════════════════════════════════ */

function restockEstimateFor(status: InventoryStatus, weeksOfSupply: number | null): string {
  switch (status) {
    case "re-up-needed": return "Re-up before this week's prep";
    case "low-soon": return "Re-up before next prep";
    case "overbought": return weeksOfSupply ? `Covered ~${Math.round(weeksOfSupply)} weeks` : "Surplus on hand";
    case "stocked": return weeksOfSupply && weeksOfSupply > 1 ? `Covered ~${weeksOfSupply.toFixed(1)} weeks` : "Enough for this week";
    case "unit-review": return "Unit conversion needs review";
    default: return "Not purchased yet";
  }
}

/** Match a purchase to a grocery item by name (case-insensitive contains). */
function findPurchase(item: GroceryItem, purchases: PurchaseLog[]): PurchaseLog | null {
  const name = item.name.toLowerCase();
  return purchases.find((p) => {
    const pn = p.itemName.toLowerCase();
    return pn === name || pn.includes(name) || name.includes(pn);
  }) ?? null;
}

export function computeInventory(items: GroceryItem[], purchases: PurchaseLog[], weeksPlanned = 1): InventoryItem[] {
  return items.map((item) => {
    const purchase = findPurchase(item, purchases);
    const neededTotal = item.quantityNeeded; // already across the supplied plan window
    const servingSize = item.weeklyUses > 0 ? item.quantityNeeded / item.weeklyUses : item.quantityNeeded;

    if (!purchase) {
      return {
        itemName: item.name, category: item.category,
        neededQty: neededTotal, neededUnit: item.unit,
        purchasedQty: null, purchasedUnit: null,
        remainingQty: null, remainingUnit: null,
        weeksOfSupply: null, costPerServing: null, weeklyCost: item.estimatedCost,
        restockEstimate: restockEstimateFor("not-purchased", null),
        status: "not-purchased",
        note: `Plan needs ${neededTotal}${item.unit} — not purchased yet.`,
      };
    }

    // Convert purchased qty into the needed unit.
    if (!canConvert(purchase.unit, item.unit)) {
      return {
        itemName: item.name, category: item.category,
        neededQty: neededTotal, neededUnit: item.unit,
        purchasedQty: purchase.quantityPurchased, purchasedUnit: purchase.unit,
        remainingQty: null, remainingUnit: null,
        weeksOfSupply: null, costPerServing: null, weeklyCost: item.estimatedCost,
        restockEstimate: restockEstimateFor("unit-review", null),
        status: "unit-review",
        note: `Purchased in ${purchase.unit}, plan uses ${item.unit}. Unit conversion needs review.`,
      };
    }

    const purchasedInNeeded = convert(purchase.quantityPurchased, purchase.unit, item.unit) ?? 0;
    const remaining = purchasedInNeeded - neededTotal;
    const servingsRemaining = servingSize > 0 ? remaining / servingSize : 0;
    const weeksOfSupply = neededTotal > 0 ? (purchasedInNeeded / neededTotal) * weeksPlanned : null;
    const costPerServing = servingSize > 0 ? Math.round((purchase.pricePaid / Math.max(1, purchasedInNeeded / servingSize)) * 100) / 100 : null;

    let status: InventoryStatus;
    if (purchasedInNeeded < neededTotal * 0.95) status = "re-up-needed";
    else if (servingsRemaining <= item.weeklyUses * 0.15 + 0.5) status = "low-soon";
    else if (weeksOfSupply !== null && weeksOfSupply >= 1.8) status = "overbought";
    else status = "stocked";

    const bufferTxt = remaining > 0 ? `${Math.round(remaining * 10) / 10}${item.unit} buffer` : `${Math.round(Math.abs(remaining) * 10) / 10}${item.unit} short`;

    return {
      itemName: item.name, category: item.category,
      neededQty: neededTotal, neededUnit: item.unit,
      purchasedQty: purchase.quantityPurchased, purchasedUnit: purchase.unit,
      remainingQty: Math.round(remaining * 10) / 10, remainingUnit: item.unit,
      weeksOfSupply: weeksOfSupply !== null ? Math.round(weeksOfSupply * 10) / 10 : null,
      costPerServing,
      weeklyCost: item.estimatedCost,
      restockEstimate: restockEstimateFor(status, weeksOfSupply),
      status,
      note: `${Math.round(purchasedInNeeded)}${item.unit} purchased · ${neededTotal}${item.unit} needed · ${bufferTxt}.`,
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   BUDGET ROLLUP
   ════════════════════════════════════════════════════════════════════════ */

export type BudgetSummary = {
  estimatedTotal: number;
  actualSpent: number;
  byCategory: Record<string, number>;
  byStore: Record<string, number>;
  costPerMeal: number | null;
  costPerDay: number | null;
};

export function buildBudgetSummary(items: GroceryItem[], purchases: PurchaseLog[], mealCount: number, days: number): BudgetSummary {
  const estimatedTotal = Math.round(items.reduce((s, i) => s + i.estimatedCost, 0) * 100) / 100;
  const actualSpent = Math.round(purchases.reduce((s, p) => s + p.pricePaid, 0) * 100) / 100;

  const byCategory: Record<string, number> = {};
  for (const i of items) byCategory[i.category] = Math.round(((byCategory[i.category] ?? 0) + i.estimatedCost) * 100) / 100;

  const byStore: Record<string, number> = {};
  for (const p of purchases) byStore[p.store] = Math.round(((byStore[p.store] ?? 0) + p.pricePaid) * 100) / 100;

  const basis = actualSpent > 0 ? actualSpent : estimatedTotal;
  return {
    estimatedTotal,
    actualSpent,
    byCategory,
    byStore,
    costPerMeal: mealCount > 0 ? Math.round((basis / mealCount) * 100) / 100 : null,
    costPerDay: days > 0 ? Math.round((basis / days) * 100) / 100 : null,
  };
}

/* ─── Dashboard summary (Apex Command stays simple) ── */
export type GrocerySummary = {
  itemsNeedingReUp: number;
  nextRestock: string;
  projectedSpend: number;
  actualSpend: number;
};

export function summarizeGrocery(inventory: InventoryItem[], budget: BudgetSummary): GrocerySummary {
  const needReUp = inventory.filter((i) => i.status === "re-up-needed" || i.status === "low-soon" || i.status === "not-purchased").length;
  const next = inventory.some((i) => i.status === "re-up-needed")
    ? "This week"
    : inventory.some((i) => i.status === "low-soon")
      ? "Before next prep"
      : "On track";
  return { itemsNeedingReUp: needReUp, nextRestock: next, projectedSpend: budget.estimatedTotal, actualSpend: budget.actualSpent };
}
