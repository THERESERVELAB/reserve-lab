/* ════════════════════════════════════════════════════════════════════════
   THE NIGHT BEFORE — what a member has to do tonight so tomorrow's plates
   are actually cookable: meat out of the freezer, and the batch of rice,
   oats or potatoes that takes longer than a meal window allows.

   It reads tomorrow's plates as they are already scaled, so the weights are
   the real ones, and it says nothing about food safety: where a thaw happens
   is the member's call, and Reserve only says what tomorrow needs.
   ════════════════════════════════════════════════════════════════════════ */

import { AISLE, RAW_FACTOR } from "./peak-kitchen";
import { scaleOf, type PeakFood, type PeakSignature, type PlateScale } from "./peak-signatures";

export type PrepPlate = { portions: PeakSignature["portions"]; scale: number | PlateScale };

export type PrepItem = {
  food: PeakFood;
  name: string;
  /** Grams as bought: raw for meat and fish, dry for grains. */
  grams: number;
  label: string;
};

export type NightBefore = {
  /** Meat and fish tomorrow needs, in the weights they are bought at. */
  thaw: PrepItem[];
  /** Grains, beans and potatoes worth cooking in one batch tonight. */
  batch: PrepItem[];
  /** Nothing to do tonight — said plainly rather than shown as an empty card. */
  empty: boolean;
};

/** Foods worth cooking once for the next day rather than per meal. */
const BATCH: ReadonlySet<PeakFood> = new Set<PeakFood>([
  "jasmine rice", "basmati rice", "brown rice", "quinoa", "couscous", "pasta", "whole wheat pasta", "chickpea protein pasta (dry)", "rice noodles",
  "sweet potato", "gold potatoes", "red potatoes", "lentils", "black beans", "rolled oats (dry)",
]);

/** Meat and fish: bought raw, and frozen more often than not. */
function isThaw(food: PeakFood): boolean {
  return AISLE[food] === "Protein" && (RAW_FACTOR[food] ?? 1) > 1;
}

function asBought(food: PeakFood, cookedGrams: number): number {
  const factor = RAW_FACTOR[food] ?? 1;
  return Math.round((cookedGrams * factor) / 10) * 10;
}

function label(food: PeakFood, grams: number): string {
  const lb = grams / 453.6;
  const weight = grams >= 450 ? `${lb.toFixed(1)} lb (${grams.toLocaleString("en-US")} g)` : `${grams} g`;
  const factor = RAW_FACTOR[food] ?? 1;
  return factor > 1 ? `${weight} raw` : factor < 1 || food.includes("(dry)") ? `${weight} dry` : weight;
}

/** Everything tomorrow's plates need, by food, in cooked grams. */
function gramsByFood(plates: readonly PrepPlate[]): Map<PeakFood, number> {
  const grams = new Map<PeakFood, number>();
  for (const { portions, scale } of plates) {
    for (const p of portions) {
      if (!("food" in p)) continue;
      const g = p.fixed ? p.grams : Math.max(5, Math.round((p.grams * scaleOf(scale, p.food)) / 5) * 5);
      grams.set(p.food, (grams.get(p.food) ?? 0) + g);
    }
  }
  return grams;
}

/**
 * Tonight's list for tomorrow's plates: what to move out of the freezer, and
 * what to cook in one batch. Both are sorted heaviest first, because that is
 * the one that matters if only one thing gets done.
 */
export function nightBefore(plates: readonly PrepPlate[]): NightBefore {
  const grams = gramsByFood(plates);
  const thaw: PrepItem[] = [];
  const batch: PrepItem[] = [];
  for (const [food, cooked] of grams) {
    const bought = asBought(food, cooked);
    const item: PrepItem = { food, name: food.replace(" (dry)", ""), grams: bought, label: label(food, bought) };
    if (isThaw(food)) thaw.push(item);
    else if (BATCH.has(food)) batch.push(item);
  }
  const heaviest = (a: PrepItem, b: PrepItem) => b.grams - a.grams || a.name.localeCompare(b.name);
  thaw.sort(heaviest);
  batch.sort(heaviest);
  return { thaw, batch, empty: thaw.length === 0 && batch.length === 0 };
}

/** One line for the card’s headline — how much of tomorrow is already handled. */
export function nightBeforeLine(plan: NightBefore): string {
  if (plan.empty) return "Nothing to do tonight — tomorrow cooks fresh.";
  const parts: string[] = [];
  if (plan.thaw.length > 0) parts.push(`${plan.thaw.length} to move out of the freezer`);
  if (plan.batch.length > 0) parts.push(`${plan.batch.length} to batch`);
  return parts.join(" · ");
}

/* ─── The checklist ─────────────────────────────────────────────────────── */

/** Today's cooking and tonight's prep for tomorrow, as one list to work through. */
export type CookingPlan = { today: NightBefore; tonight: NightBefore };

/**
 * One tick's key. The day is part of it, so today's rice and tomorrow's rice
 * are two different jobs and yesterday's ticks never carry over.
 */
export function prepKey(day: string, kind: "cook" | "thaw" | "batch", food: PeakFood): string {
  return `${day}:${kind}:${food}`;
}

/** Every key in the plan, in the order the member reads them. */
export function prepKeys(plan: CookingPlan, todayKey: string, tomorrowKey: string): string[] {
  return [
    ...plan.today.batch.map((i) => prepKey(todayKey, "cook", i.food)),
    ...plan.tonight.thaw.map((i) => prepKey(tomorrowKey, "thaw", i.food)),
    ...plan.tonight.batch.map((i) => prepKey(tomorrowKey, "batch", i.food)),
  ];
}

/** How much of the list is done — for the line above it. */
export function prepProgress(keys: readonly string[], done: ReadonlySet<string>): { done: number; total: number } {
  return { done: keys.filter((k) => done.has(k)).length, total: keys.length };
}
