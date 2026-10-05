/* ════════════════════════════════════════════════════════════════════════
   UNIT CONVERSION
   ------------------------------------------------------------------------
   Mass, volume, and count conversions for the grocery / inventory engine.
   Returns null when a conversion crosses dimensions (e.g. grams → bottles)
   so callers can surface "Unit conversion needs review" instead of guessing.
   ════════════════════════════════════════════════════════════════════════ */

export type UnitDimension = "mass" | "volume" | "count";

export type CanonicalUnit =
  | "g" | "oz" | "lb" | "kg"
  | "ml" | "l" | "floz" | "cup" | "tbsp" | "tsp"
  | "count";

const ALIASES: Record<string, CanonicalUnit> = {
  g: "g", gram: "g", grams: "g",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", liter: "l", liters: "l", litre: "l",
  floz: "floz", "fl oz": "floz", "fluid ounce": "floz", "fluid ounces": "floz",
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  // count-like
  count: "count", piece: "count", pieces: "count", unit: "count", units: "count",
  serving: "count", servings: "count", container: "count", containers: "count",
  each: "count", apple: "count", apples: "count", bottle: "count", bottles: "count",
  scoop: "count", scoops: "count", can: "count", cans: "count",
};

export function canonicalUnit(unit: string): CanonicalUnit | null {
  return ALIASES[unit.toLowerCase().trim()] ?? null;
}

export function unitDimension(unit: string): UnitDimension | null {
  const c = canonicalUnit(unit);
  if (!c) return null;
  if (c === "g" || c === "oz" || c === "lb" || c === "kg") return "mass";
  if (c === "ml" || c === "l" || c === "floz" || c === "cup" || c === "tbsp" || c === "tsp") return "volume";
  return "count";
}

// To base unit (mass → g, volume → ml).
const TO_BASE: Record<CanonicalUnit, number> = {
  g: 1, oz: 28.3495, lb: 453.592, kg: 1000,
  ml: 1, l: 1000, floz: 29.5735, cup: 236.588, tbsp: 14.7868, tsp: 4.92892,
  count: 1,
};

/**
 * Convert qty from one unit to another. Returns null when dimensions differ
 * (e.g. mass → count) — the caller should flag "Unit conversion needs review".
 */
export function convert(qty: number, from: string, to: string): number | null {
  const cf = canonicalUnit(from);
  const ct = canonicalUnit(to);
  if (!cf || !ct) return null;
  const df = unitDimension(from);
  const dt = unitDimension(to);
  if (df === null || dt === null || df !== dt) return null;
  if (df === "count") return qty; // counts only convert 1:1 (same item)
  return (qty * TO_BASE[cf]) / TO_BASE[ct];
}

export function canConvert(from: string, to: string): boolean {
  return convert(1, from, to) !== null;
}
