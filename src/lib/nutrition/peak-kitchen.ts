/* ════════════════════════════════════════════════════════════════════════
   PEAK KITCHEN — Peak Mode made personal.

   · A few questions: the carbs and proteins the member likes, and what they
     don't eat. Plates swap their main carb or protein to the member's picks,
     matched gram-for-gram on carbs or protein, and plates with foods they
     avoid never show.
   · Swaps: the member can swap any plate for another plate for that meal and
     look, or hide a plate for good.
   · Target match: how closely a plate's calories and protein land on the
     plan's own target for that meal — plain arithmetic, never a claim about
     results.
   · Recipes: steps for every plate, written around what is on the plate.
   · The week and its shopping list, from the member's own training week.
   ════════════════════════════════════════════════════════════════════════ */

import { buildMealPlan } from "@/lib/schedule/engine";
import { fuelWindowsFromPlan } from "./scheduled-fuel-windows";
import type { MemberScheduleProfile } from "@/lib/schedule/types";

import { buildDailyFuelPlan, type DailyFuelPlan, type FuelGoal, type FuelMacros, type MealPersonalization, type MealSlot, type PlanFavoriteInput } from "./fuel-plan";
import type { PeakLook } from "./peak-mode";
import { familyOf, resolveRatio, type GroundFamily, type RatioContext, type RatioPick } from "./peak-ratios";
import { PEAK_FOODS, PEAK_SIGNATURES, scaleOf, type FitArea, type PeakFood, type PeakSignature, type PlateScale } from "./peak-signatures";

/* ─── The questions ─────────────────────────────────────────────────────── */

export type PeakCarbKey =
  | "rice" | "brown-rice" | "basmati-rice" | "sweet-potato" | "gold-potato" | "red-potato"
  | "protein-pasta" | "pasta" | "whole-wheat-pasta" | "quinoa" | "couscous" | "rice-noodles" | "corn-tortillas";
export type PeakProteinKey =
  | "chicken" | "chicken-thigh" | "turkey" | "ground-beef" | "ground-bison" | "sirloin" | "lean-red-meat" | "pork"
  | "salmon" | "tuna" | "white-fish" | "tilapia" | "shrimp" | "tofu" | "tempeh";
export type PeakAvoidKey = "dairy" | "eggs" | "fish" | "shellfish" | "red-meat" | "pork" | "soy" | "nuts" | "gluten";

export type PeakKitchenPrefs = {
  carbs: PeakCarbKey[];
  proteins: PeakProteinKey[];
  avoid: PeakAvoidKey[];
  answeredAt: string;
  /**
   * What the member actually has — bought, in the fridge or in the freezer.
   * Plates cook what is on hand before they cook a preference, so a plan never
   * asks for a protein that is still at the store.
   */
  onHand?: PeakFood[];
};

export const CARB_CHOICES: Array<{ key: PeakCarbKey; label: string; food: PeakFood }> = [
  { key: "rice", label: "White or jasmine rice", food: "jasmine rice" },
  { key: "brown-rice", label: "Brown rice", food: "brown rice" },
  { key: "basmati-rice", label: "Basmati rice", food: "basmati rice" },
  { key: "sweet-potato", label: "Sweet potatoes", food: "sweet potato" },
  { key: "gold-potato", label: "Gold potatoes", food: "gold potatoes" },
  { key: "red-potato", label: "Red potatoes", food: "red potatoes" },
  { key: "protein-pasta", label: "Protein pasta", food: "chickpea protein pasta (dry)" },
  { key: "pasta", label: "Pasta", food: "pasta" },
  { key: "whole-wheat-pasta", label: "Whole wheat pasta", food: "whole wheat pasta" },
  { key: "quinoa", label: "Quinoa", food: "quinoa" },
  { key: "couscous", label: "Couscous", food: "couscous" },
  { key: "rice-noodles", label: "Rice noodles", food: "rice noodles" },
  { key: "corn-tortillas", label: "Corn tortillas", food: "corn tortillas" },
];

/** `pins` means the choice names one cut, so Reserve keeps that cut instead of picking one. */
export const PROTEIN_CHOICES: Array<{ key: PeakProteinKey; label: string; food: PeakFood; pins?: true }> = [
  { key: "chicken", label: "Chicken breast", food: "chicken breast", pins: true },
  { key: "chicken-thigh", label: "Chicken thighs", food: "chicken thighs, skinless", pins: true },
  /* Ground meats: the lean-to-fat ratio is picked per member (peak-ratios.ts). */
  { key: "turkey", label: "Ground turkey", food: "99% lean ground turkey" },
  { key: "ground-beef", label: "Ground beef", food: "93% lean ground beef" },
  { key: "ground-bison", label: "Ground bison", food: "90/10 ground bison" },
  /* Steak and salmon: the cut is picked per member (peak-ratios.ts). */
  { key: "sirloin", label: "Steak", food: "top sirloin, trimmed" },
  /* Key kept from the first version of the questions, so saved answers still read. */
  { key: "lean-red-meat", label: "Bison steak", food: "bison" },
  { key: "pork", label: "Pork tenderloin", food: "pork tenderloin", pins: true },
  { key: "salmon", label: "Salmon", food: "wild salmon" },
  { key: "tuna", label: "Ahi tuna", food: "ahi tuna" },
  { key: "white-fish", label: "Cod", food: "cod" },
  { key: "tilapia", label: "Tilapia", food: "tilapia" },
  { key: "shrimp", label: "Shrimp", food: "shrimp" },
  { key: "tofu", label: "Tofu", food: "extra-firm tofu" },
  { key: "tempeh", label: "Tempeh", food: "tempeh" },
];

export const AVOID_CHOICES: Array<{ key: PeakAvoidKey; label: string }> = [
  { key: "dairy", label: "Dairy" },
  { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" },
  { key: "shellfish", label: "Shellfish" },
  { key: "red-meat", label: "Red meat" },
  { key: "pork", label: "Pork" },
  { key: "soy", label: "Soy" },
  { key: "nuts", label: "Nuts" },
  { key: "gluten", label: "Gluten" },
];

const AVOIDS: Record<PeakAvoidKey, ReadonlySet<PeakFood>> = {
  dairy: new Set<PeakFood>(["nonfat Greek yogurt", "1% cottage cheese", "whey isolate"]),
  eggs: new Set<PeakFood>(["egg whites", "whole eggs"]),
  pork: new Set<PeakFood>(["pork tenderloin", "pork loin chop", "ground pork"]),
  fish: new Set<PeakFood>(["wild pink salmon", "wild salmon", "farmed Atlantic salmon", "cod", "tilapia", "ahi tuna"]),
  shellfish: new Set<PeakFood>(["shrimp"]),
  "red-meat": new Set<PeakFood>(["bison", "eye of round steak", "top round steak", "top sirloin, trimmed", "flank steak", "tenderloin filet", "strip steak", "ribeye steak", "96/4 ground beef", "93% lean ground beef", "90/10 ground beef", "85/15 ground beef", "80/20 ground beef", "90/10 ground bison", "85/15 ground bison"]),
  soy: new Set<PeakFood>(["extra-firm tofu", "tempeh"]),
  nuts: new Set<PeakFood>(["almonds", "walnuts"]),
  gluten: new Set<PeakFood>(["sourdough", "pasta", "whole wheat pasta", "couscous"]),
};

/** Main proteins and carbs that can stand in for one another on a plate. */
const MAIN_PROTEINS: ReadonlySet<PeakFood> = new Set(PROTEIN_CHOICES.map((c) => c.food));
const MAIN_CARBS: ReadonlySet<PeakFood> = new Set(CARB_CHOICES.map((c) => c.food));

/** Words a plate's fit reason uses for a food — dropped when that food is swapped out. */
const FOOD_WORDS: Partial<Record<PeakFood, RegExp>> = {
  "chicken breast": /poultry|chicken/i,
  "99% lean ground turkey": /turkey/i,
  bison: /bison|red meat/i,
  "top sirloin, trimmed": /sirloin|red meat/i,
  "wild salmon": /salmon|fish/i,
  cod: /fish|cod/i,
  tilapia: /fish|tilapia/i,
  shrimp: /shrimp|seafood/i,
  "sweet potato": /sweet potato|potassium/i,
  "gold potatoes": /potato|potassium/i,
  quinoa: /quinoa|whole grain|grain/i,
  "jasmine rice": /grain|rice/i,
};

/* ─── Personal plates ───────────────────────────────────────────────────── */

export type PersonalPlate = {
  sig: PeakSignature;
  /** The plate with the member's swaps applied — same shape, so macros and scaling read it directly. */
  plate: PeakSignature;
  swapped: Array<{ from: PeakFood; to: PeakFood; onHand?: true }>;
  /** Lean-to-fat ratios picked for the ground meats on the plate. */
  ratios: RatioPick[];
};

/**
 * One line per food. A swap can land the same food twice — a plate with egg whites
 * whose whole eggs became whites — so the weights add up into a single portion.
 */
function mergeSameFood(portions: PeakSignature["portions"]): PeakSignature["portions"] {
  const out: PeakSignature["portions"] = [];
  for (const p of portions) {
    const at = "food" in p ? out.findIndex((x) => "food" in x && x.food === p.food) : -1;
    if (at < 0 || !("food" in p)) {
      out.push(p);
      continue;
    }
    const first = out[at] as Extract<PeakSignature["portions"][number], { food: PeakFood }>;
    /* A counted portion (2 eggs) merged with a weighed one becomes a weighed one. */
    out[at] = { ...first, grams: first.grams + p.grams, fixed: undefined, note: undefined };
  }
  return out;
}

/** One ratio card per meat, even when a plate holds two portions of it. */
function dedupeByFamily(picks: RatioPick[]): RatioPick[] {
  return picks.filter((pick, i) => picks.findIndex((x) => x.family === pick.family) === i);
}

/** Cuts the member named in their answers, kept as their own pick. */
function pinnedSteps(prefs: PeakKitchenPrefs | null): Partial<Record<GroundFamily, PeakFood>> {
  const pins: Partial<Record<GroundFamily, PeakFood>> = {};
  for (const key of prefs?.proteins ?? []) {
    const choice = PROTEIN_CHOICES.find((c) => c.key === key);
    const family = choice?.pins ? familyOf(choice.food) : null;
    if (choice && family) pins[family] = choice.food;
  }
  return pins;
}

/**
 * A cut the member says is in the freezer pins its family: if they bought 93%
 * ground beef, Reserve cooks that, rather than asking for a leaner cut they
 * do not have. An explicit ratio pick still wins over it.
 */
function onHandSteps(prefs: PeakKitchenPrefs | null): Partial<Record<GroundFamily, PeakFood>> {
  const pins: Partial<Record<GroundFamily, PeakFood>> = {};
  for (const food of prefs?.onHand ?? []) {
    const family = familyOf(food);
    if (family && !pins[family]) pins[family] = food;
  }
  return pins;
}

function avoidedFoods(prefs: PeakKitchenPrefs | null): Set<PeakFood> {
  const out = new Set<PeakFood>();
  for (const key of prefs?.avoid ?? []) AVOIDS[key].forEach((f) => out.add(f));
  return out;
}

/**
 * A plate made the member's: its main protein and carb follow their picks
 * (rotating through them by `turn`), matched on protein or carb grams. Null
 * when a food they avoid is still on the plate.
 */
export function personalize(sig: PeakSignature, prefs: PeakKitchenPrefs | null, turn = 0, ratioContext?: RatioContext): PersonalPlate | null {
  const avoided = avoidedFoods(prefs);
  /* The member's own answers travel with the ratio context: foods they don't eat never appear,
     and a choice that names one cut (chicken thighs) pins that cut unless they picked another. */
  const context: RatioContext | undefined = ratioContext
    ? { ...ratioContext, avoid: avoided, overrides: { ...onHandSteps(prefs), ...pinnedSteps(prefs), ...ratioContext.overrides } }
    : undefined;
  const likedProteins = (prefs?.proteins ?? []).map((k) => PROTEIN_CHOICES.find((c) => c.key === k)!.food).filter((f) => !avoided.has(f));
  const likedCarbs = (prefs?.carbs ?? []).map((k) => CARB_CHOICES.find((c) => c.key === k)!.food);
  const onHand = (prefs?.onHand ?? []).filter((f) => !avoided.has(f));
  const swapped: PersonalPlate["swapped"] = [];

  const portions = sig.portions.map((p) => {
    if (!("food" in p)) return p;
    const role = MAIN_PROTEINS.has(p.food) ? MAIN_PROTEINS : MAIN_CARBS.has(p.food) ? MAIN_CARBS : null;
    if (!role) return p;
    /* What the member has beats what they like: cook the freezer, not the wish list. */
    const stocked = onHand.filter((f) => role.has(f));
    const pickFrom = stocked.length > 0 ? stocked : role === MAIN_PROTEINS ? likedProteins : likedCarbs;
    if (pickFrom.length === 0 || (pickFrom.includes(p.food) && !avoided.has(p.food))) return p;
    const to = pickFrom[((turn % pickFrom.length) + pickFrom.length) % pickFrom.length];
    if (to === p.food) return p;
    const key = role === MAIN_PROTEINS ? "p" : "c";
    const grams = Math.max(5, Math.round(((p.grams * PEAK_FOODS[p.food][key]) / PEAK_FOODS[to][key]) / 5) * 5);
    swapped.push(stocked.length > 0 ? { from: p.food, to, onHand: true } : { from: p.food, to });
    return { ...p, food: to, grams, note: undefined };
  });

  if (portions.some((p) => "food" in p && avoided.has(p.food))) return null;


  /* Ground meats take the member's lean-to-fat ratio; the portion weight stays the same. */
  const ratios: RatioPick[] = [];
  const cutChanges: Array<{ from: PeakFood; to: PeakFood }> = [];
  const withRatios = context
    ? portions.map((p) => {
        if (!("food" in p)) return p;
        const pick = resolveRatio(p.food, p.grams, context!);
        if (!pick) return p;
        ratios.push(pick);
        if (pick.food === p.food) return p;
        cutChanges.push({ from: p.food, to: pick.food });
        return { ...p, food: pick.food };
      })
    : portions;

  const fits = Object.fromEntries(
    Object.entries(sig.fits).filter(([, reason]) => !swapped.some((s) => FOOD_WORDS[s.from]?.test(reason ?? ""))),
  ) as PeakSignature["fits"];
  const name = [...swapped, ...cutChanges].reduce((n, s) => renamed(n, s.from, s.to), sig.name);
  return { sig, plate: { ...sig, name, portions: mergeSameFood(withRatios), fits }, swapped, ratios: dedupeByFamily(ratios) };
}

const SHORT: Partial<Record<PeakFood, string>> = {
  "chicken breast": "Chicken",
  "99% lean ground turkey": "Turkey",
  bison: "Bison",
  "top sirloin, trimmed": "Sirloin",
  "eye of round steak": "Eye of Round",
  "top round steak": "Top Round",
  "flank steak": "Flank Steak",
  "tenderloin filet": "Filet",
  "strip steak": "Strip Steak",
  "ribeye steak": "Ribeye",
  "wild salmon": "Salmon",
  "wild pink salmon": "Salmon",
  "farmed Atlantic salmon": "Salmon",
  cod: "Cod",
  tilapia: "Tilapia",
  shrimp: "Shrimp",
  "jasmine rice": "Jasmine Rice",
  "sweet potato": "Sweet Potato",
  "gold potatoes": "Gold Potatoes",
  "chickpea protein pasta (dry)": "Protein Pasta",
  quinoa: "Quinoa",
  "brown rice": "Brown Rice",
  "basmati rice": "Basmati Rice",
  pasta: "Pasta",
  "whole wheat pasta": "Whole Wheat Pasta",
  couscous: "Couscous",
  "rice noodles": "Rice Noodles",
  "corn tortillas": "Corn Tortillas",
  "red potatoes": "Red Potatoes",
  "93% lean ground beef": "Ground Beef",
  "96/4 ground beef": "Ground Beef",
  "90/10 ground beef": "Ground Beef",
  "85/15 ground beef": "Ground Beef",
  "80/20 ground beef": "Ground Beef",
  "90/10 ground bison": "Ground Bison",
  "85/15 ground bison": "Ground Bison",
  "93/7 ground turkey": "Turkey",
  "chicken thighs, skinless": "Chicken Thighs",
  "chicken drumsticks, skinless": "Chicken Drumsticks",
  "chicken thighs, skin on": "Chicken Thighs",
  "pork loin chop": "Pork Chop",
  "ground pork": "Ground Pork",
  "pork tenderloin": "Pork Tenderloin",
  "ahi tuna": "Ahi Tuna",
  "extra-firm tofu": "Tofu",
  tempeh: "Tempeh",
};

function shortName(food: PeakFood): string {
  return SHORT[food] ?? food;
}

/** Other ways a plate's name may say a food, longest first. */
const NAME_FORMS: Partial<Record<PeakFood, string[]>> = {
  "jasmine rice": ["Jasmine Rice", "Jasmine", "Rice"],
  "gold potatoes": ["Gold Potatoes", "Potatoes"],
  "top sirloin, trimmed": ["Sirloin", "Steak"],
  "99% lean ground turkey": ["Turkey"],
  "wild salmon": ["Salmon"],
};

/** The plate's name with one food's word swapped for another's. Unchanged when the name never says the food. */
function renamed(name: string, from: PeakFood, to: PeakFood): string {
  for (const form of NAME_FORMS[from] ?? [shortName(from)]) {
    if (name.toLowerCase().includes(form.toLowerCase())) return name.replace(new RegExp(form, "i"), shortName(to));
  }
  return name;
}

/** Plates available for a slot and look, made the member's, minus hidden ones. */
export function platesFor(
  slot: MealSlot,
  look: PeakLook,
  prefs: PeakKitchenPrefs | null,
  hidden: ReadonlySet<string>,
  turn = 0,
  ratioContext?: RatioContext,
  /** The member's own bowls for this slot. They lead: Reserve did not choose them, the member did. */
  bowls: readonly PeakSignature[] = [],
): PersonalPlate[] {
  return [...bowls.filter((b) => b.slot === slot && !hidden.has(b.id)), ...PEAK_SIGNATURES.filter((s) => s.slot === slot && s.looks.includes(look) && !hidden.has(s.id))]
    .map((s) => personalize(s, prefs, turn, ratioContext))
    .filter((p): p is PersonalPlate => p !== null);
}

/**
 * Which plate takes a meal. Guidance for the member's compound areas comes
 * first, then how well the plate's macro shape suits the meal's targets, and
 * the day rotates between the two best so a week is not the same plate twice.
 */
export function choosePlate(
  plates: PersonalPlate[],
  areas: ReadonlySet<FitArea>,
  dayIndex: number,
  used: ReadonlySet<string>,
  matchOf?: (plate: PersonalPlate) => number,
): PersonalPlate | null {
  /* Unused plates first; when a look has run out for this slot, a plate may repeat rather than fall back to a generic meal. */
  const fresh = plates.filter((p) => !used.has(p.sig.id));
  const pool = fresh.length > 0 ? fresh : plates;
  if (pool.length === 0) return null;
  const areaScore = (p: PersonalPlate) => (Object.keys(p.plate.fits) as FitArea[]).filter((a) => areas.has(a)).length;
  const best = Math.max(...pool.map(areaScore));
  const top = pool.filter((p) => areaScore(p) === best);
  if (!matchOf || top.length < 2) return top[((dayIndex % top.length) + top.length) % top.length];
  const ranked = [...top].sort((a, b) => matchOf(b) - matchOf(a) || a.sig.id.localeCompare(b.sig.id));
  const contenders = ranked.slice(0, 2);
  return contenders[((dayIndex % contenders.length) + contenders.length) % contenders.length];
}

/* ─── Target match ──────────────────────────────────────────────────────── */

/**
 * How closely a plate's calories and protein land on the meal's target, 0–100.
 * Calories and protein weigh equally. Arithmetic only — not a prediction of
 * results.
 */
export function targetMatch(plate: FuelMacros, target: { calories: number; proteinG: number; carbsG?: number; fatG?: number }): number {
  const err = (served: number, want: number | undefined) => (want && want > 0 ? Math.abs(served - want) / want : null);
  const errors = [err(plate.calories, target.calories), err(plate.proteinG, target.proteinG), err(plate.carbsG, target.carbsG), err(plate.fatG, target.fatG)].filter(
    (e): e is number => e !== null,
  );
  if (errors.length === 0) return 100;
  return Math.round(100 * (1 - Math.min(1, errors.reduce((a, b) => a + b, 0) / errors.length)));
}

/* ─── Recipes ───────────────────────────────────────────────────────────── */

const COOK: Partial<Record<PeakFood, string>> = {
  "chicken breast": "Season the chicken and grill or pan-sear 6–7 minutes a side, until the thickest part reads 165°F (74°C). Rest 5 minutes, then slice.",
  "99% lean ground turkey": "Brown the turkey in a hot non-stick pan, breaking it up, until no pink remains and it reads 165°F (74°C).",
  bison: "Sear the bison steak in a hot pan to 145°F (63°C), rest 3 minutes and slice against the grain.",
  "96/4 ground beef": "Brown the ground beef in a hot pan, breaking it up, until it reads 160°F (71°C) with no pink left. At 96/4 there is almost no fat to drain.",
  "90/10 ground beef": "Brown the ground beef in a hot pan, breaking it up, until it reads 160°F (71°C). Drain the fat.",
  "85/15 ground beef": "Brown the ground beef in a hot pan, breaking it up, until it reads 160°F (71°C). Drain the fat well.",
  "80/20 ground beef": "Brown the ground beef in a hot pan, breaking it up, until it reads 160°F (71°C). Drain the fat well.",
  "90/10 ground bison": "Brown the ground bison over medium heat — it is leaner than beef and dries out fast — until it reads 160°F (71°C).",
  "85/15 ground bison": "Brown the ground bison over medium heat, breaking it up, until it reads 160°F (71°C). Drain the fat.",
  "93/7 ground turkey": "Brown the ground turkey, breaking it up, until no pink remains and it reads 165°F (74°C). Drain the fat.",
  "eye of round steak": "Eye of round is very lean and tightens if overcooked: sear 2–3 minutes a side to 145°F (63°C), rest 5 minutes and slice thin against the grain.",
  "top round steak": "Sear the top round 3–4 minutes a side to 145°F (63°C), rest 5 minutes and slice thin against the grain.",
  "flank steak": "Grill or sear the flank steak 4–5 minutes a side to 145°F (63°C), rest 5 minutes and slice thin against the grain.",
  "tenderloin filet": "Sear the filet 4–5 minutes a side, then rest 5 minutes; 145°F (63°C) with a 3-minute rest is the food-safety guidance.",
  "strip steak": "Sear the strip steak 4–5 minutes a side to 145°F (63°C), rest 5 minutes, and trim the outer fat band before eating.",
  "ribeye steak": "Sear the ribeye 4–6 minutes a side to 145°F (63°C) and rest 5 minutes. It carries the most fat of any cut here.",
  "wild pink salmon": "Roast the salmon at 400°F (205°C) for 8–10 minutes — wild pink is lean and cooks fast — until it flakes and reads 145°F (63°C).",
  "farmed Atlantic salmon": "Roast the salmon at 400°F (205°C) for 12–15 minutes, until it flakes and reads 145°F (63°C).",
  "top sirloin, trimmed": "Pat the sirloin dry, season, and sear 3–4 minutes a side to 145°F (63°C). Rest 5 minutes and slice against the grain.",
  "wild salmon": "Roast the salmon at 400°F (205°C) for 10–12 minutes, until it flakes and reads 145°F (63°C).",
  cod: "Bake the cod at 400°F (205°C) for 10–12 minutes, until opaque and flaking, 145°F (63°C).",
  tilapia: "Pan-sear the tilapia 3–4 minutes a side, until opaque and flaking, 145°F (63°C).",
  shrimp: "Sauté the shrimp 2–3 minutes a side, just until pink and opaque.",
  "jasmine rice": "Rinse the rice and simmer covered, about 1 part rice to 1.25 parts water, 12 minutes; rest 5 minutes and fluff.",
  "sweet potato": "Cube the sweet potato and roast at 425°F (220°C) for 25–30 minutes, turning once.",
  "gold potatoes": "Halve the gold potatoes and roast at 425°F (220°C) for 25–30 minutes, until crisp outside and tender inside.",
  "chickpea protein pasta (dry)": "Boil the protein pasta in well-salted water for the time on the box, usually 7–9 minutes; drain and toss so it doesn't clump.",
  quinoa: "Rinse the quinoa and simmer covered, 1 part to 2 parts water, for 15 minutes; rest 5 minutes and fluff.",
  "cream of rice (dry)": "Whisk the cream of rice into boiling water, about 1 part to 4 parts, and stir 1–2 minutes until thick.",
  "rolled oats (dry)": "Simmer the oats in water, 1 part to 2 parts, for 4–5 minutes, stirring.",
  "egg whites": "Cook the eggs over medium-low heat, folding slowly, until just set.",
  lentils: "Simmer rinsed lentils in water for 18–20 minutes until tender, then drain.",
  broccoli: "Steam the broccoli 4–5 minutes, until bright green and just tender.",
  asparagus: "Roast the asparagus alongside for the last 8–10 minutes.",
  zucchini: "Slice the zucchini and sauté 4–5 minutes, until golden at the edges.",
  spinach: "Wilt the spinach into the pan for the last minute.",
  "brown rice": "Rinse the brown rice and simmer covered, 1 part rice to 2 parts water, for 40–45 minutes; rest 10 minutes and fluff.",
  "basmati rice": "Rinse the basmati until the water runs clear and simmer covered, 1 part rice to 1.5 parts water, 15 minutes; rest 5 minutes.",
  pasta: "Boil the pasta in well-salted water 9–11 minutes, until just tender, and drain.",
  "whole wheat pasta": "Boil the whole wheat pasta in well-salted water 10–12 minutes, until just tender, and drain.",
  couscous: "Pour boiling water over the couscous, 1 part to 1 part, cover for 5 minutes and fluff with a fork.",
  "rice noodles": "Cook the rice noodles in boiling water 3–4 minutes, then rinse in cold water so they don't stick.",
  "corn tortillas": "Warm the tortillas in a dry skillet about 30 seconds a side.",
  "red potatoes": "Halve the red potatoes and roast at 425°F (220°C) for 25–30 minutes, until tender.",
  "93% lean ground beef": "Brown the ground beef in a hot pan, breaking it up, until it reads 160°F (71°C) with no pink left.",
  "chicken drumsticks, skinless": "Roast the drumsticks at 425°F (220°C) for 30–35 minutes, to at least 165°F (74°C).",
  "chicken thighs, skin on": "Roast the thighs skin-side up at 425°F (220°C) for 30–35 minutes, to at least 165°F (74°C); the skin carries most of the fat.",
  "pork loin chop": "Sear the chop 3–4 minutes a side, then rest 3 minutes; 145°F (63°C) with a 3-minute rest is the food-safety guidance.",
  "ground pork": "Brown the ground pork, breaking it up, until it reads 160°F (71°C) with no pink left. Drain the fat.",
  "chicken thighs, skinless": "Season the thighs and grill or roast at 425°F (220°C) for 20–25 minutes, to at least 165°F (74°C).",
  "pork tenderloin": "Sear the tenderloin on all sides, then roast at 400°F (205°C) for 15–20 minutes to 145°F (63°C). Rest 3 minutes and slice.",
  "ahi tuna": "Sear the tuna in a very hot pan. Food-safety guidance for fish is 145°F (63°C); a rare center is a raw-fish choice.",
  "extra-firm tofu": "Press the tofu for 15 minutes, cube it, and bake at 400°F (205°C) for 25–30 minutes, turning once, until golden.",
  tempeh: "Steam the tempeh for 10 minutes to soften its bitterness, then slice and pan-sear until golden on both sides.",
};

/** Steps for a plate, from what is actually on it. */
export function recipeFor(plate: PeakSignature): string[] {
  const foods = plate.portions.filter((p): p is Extract<typeof p, { food: PeakFood }> => "food" in p).map((p) => p.food);
  const steps = [...new Set(foods.map((f) => COOK[f]).filter((s): s is string => Boolean(s)))];
  const raw = foods.filter((f) => !COOK[f]);
  const finish = plate.portions.filter((p) => !("food" in p)).map((p) => ("name" in p ? p.name : ""));
  if (raw.length) steps.push(`Plate it up with the ${raw.join(", ")}${finish.length ? `, and finish with ${finish.join(" and ")}` : ""}.`);
  else if (finish.length) steps.push(`Finish with ${finish.join(" and ")}.`);
  steps.push("Weigh portions cooked unless marked dry, so the plate matches its macros.");
  return steps;
}


/* ─── Closing a fat gap ─────────────────────────────────────────────────── */

/** Fats added to close a gap, in the order they are tried. All unsaturated. */
const FAT_FILLERS: Array<{ food: PeakFood; maxGrams: number }> = [
  { food: "extra virgin olive oil", maxGrams: 25 },
  { food: "almonds", maxGrams: 40 },
  { food: "avocado", maxGrams: 80 },
];

/** A fat gap smaller than this is left alone — a plate is not a spreadsheet. */
const FAT_GAP_G = 6;

/**
 * Lean plates can run short of a fat target however far their own fats scale,
 * because there is little fat on them to scale. When that happens a single
 * unsaturated fat is added, sized to the gap and never past a sensible amount,
 * and the plate says it was added.
 */
export function withFatFiller(
  plate: PeakSignature,
  served: { fatG: number },
  target: { fatG?: number },
  avoid?: ReadonlySet<PeakFood>,
): { plate: PeakSignature; added: { food: PeakFood; grams: number } | null } {
  const gap = (target.fatG ?? 0) - served.fatG;
  if (!target.fatG || gap < FAT_GAP_G) return { plate, added: null };
  const filler = FAT_FILLERS.find((f) => !avoid?.has(f.food));
  if (!filler) return { plate, added: null };
  const perGram = PEAK_FOODS[filler.food].f / 100;
  const grams = Math.min(filler.maxGrams, Math.max(5, Math.round(gap / perGram / 5) * 5));
  const existing = plate.portions.find((p) => "food" in p && p.food === filler.food) as { grams: number } | undefined;
  const portions = existing
    ? plate.portions.map((p) => ("food" in p && p.food === filler.food ? { ...p, grams: p.grams + grams, fixed: undefined } : p))
    : [...plate.portions, { food: filler.food, grams, group: "fat" as const, fixed: true as const }];
  return { plate: { ...plate, portions }, added: { food: filler.food, grams } };
}

/* ─── Why each item is on the plate ─────────────────────────────────────── */

/** What each food is doing there. Plain food facts — never a claim about a result. */
export const FOOD_PURPOSE: Partial<Record<PeakFood, string>> = {
  "cream of rice (dry)": "fast, low-fiber carb that digests quickly around a session",
  "rice cakes": "fast carb with almost no fiber or fat, so it sits light before training",
  "medjool dates": "concentrated fast carbs",
  honey: "fast sugar to top off the carbs in the meal",
  banana: "quick carbs plus potassium",
  mango: "quick carbs and vitamin C",
  pineapple: "quick carbs and vitamin C",
  blueberries: "fiber and vitamin C; frozen keeps them on hand year round",
  strawberries: "vitamin C for few calories",
  raspberries: "more fiber than most fruit for few calories",
  apple: "fiber and a slower sugar than most fruit",
  "unsweetened cocoa powder": "chocolate flavour for very few calories and no added sugar",
  "peanut butter": "flavour and fat; measured by the spoon, because it is dense",
  kiwi: "fiber and vitamin C",
  "jasmine rice": "easy-digesting carb that suits training days",
  "basmati rice": "easy-digesting carb with a lower glycemic index than most white rice",
  "brown rice": "slower carb with the bran left on, so more fiber",
  quinoa: "whole grain with fiber and a little more protein than rice",
  "rolled oats (dry)": "soluble fiber, which lowers LDL cholesterol",
  sourdough: "fermented bread, a carb with some structure to it",
  "corn tortillas": "gluten-free carb that carries a savory breakfast",
  pasta: "carb that cooks fast and holds a sauce",
  "whole wheat pasta": "whole-grain pasta, so more fiber than white",
  "chickpea protein pasta (dry)": "pasta with the protein and fiber of chickpeas",
  couscous: "quick-cooking wheat carb",
  "rice noodles": "gluten-free carb that cooks in minutes",
  "sweet potato": "potassium-rich carb with fiber",
  "gold potatoes": "potassium-rich carb",
  "red potatoes": "potassium-rich carb that holds its shape roasted",
  "black beans": "fiber and plant protein in one",
  lentils: "soluble fiber plus plant protein",
  "whey isolate": "fast protein, low in fat and lactose",
  "nonfat Greek yogurt": "slower dairy protein with almost no fat",
  "1% cottage cheese": "slow casein protein for the gap between meals",
  "egg whites": "protein with no fat, so the plate stays light",
  "whole eggs": "protein with the yolk's vitamins, and the plate's fat",
  "chicken breast": "very lean protein",
  "chicken thighs, skinless": "protein with more fat than breast, and more flavor",
  "chicken drumsticks, skinless": "lean protein off the bone",
  "chicken thighs, skin on": "protein where the skin carries most of the fat",
  "99% lean ground turkey": "very lean protein that takes any seasoning",
  "wild salmon": "protein with omega-3 fats",
  "wild pink salmon": "the leanest salmon, still with omega-3 fats",
  "farmed Atlantic salmon": "the fattiest salmon, so the most omega-3 per serving",
  cod: "very lean white fish",
  tilapia: "lean white fish that cooks in minutes",
  shrimp: "protein with almost no fat",
  "ahi tuna": "very lean protein",
  "top sirloin, trimmed": "lean red meat for iron and zinc",
  bison: "leaner red meat than most beef",
  "pork tenderloin": "the leanest common cut of pork",
  "extra-firm tofu": "plant protein that takes on the seasoning around it",
  tempeh: "fermented soy with more protein and fiber than tofu",
  avocado: "unsaturated fat and potassium",
  "extra virgin olive oil": "unsaturated fat and the flavor base",
  almonds: "unsaturated fat with vitamin E",
  walnuts: "plant omega-3 fats",
  "chia seeds": "fiber and plant omega-3 fats",
  spinach: "volume and micronutrients for almost no calories",
  broccoli: "fiber and vitamin C",
  asparagus: "fiber for few calories",
  zucchini: "volume for almost no calories",
  "bell peppers": "vitamin C and color",
  "mixed greens": "volume and micronutrients for almost no calories",
  salsa: "flavor from vegetables instead of oil",
  "coconut aminos": "seasoning with less sodium than soy sauce",
};

/** Why a filler is on the plate at all. */
export const FAT_FILLER_WHY = "added to reach the fat in today's targets — the plate's own fats could not get there";

/** To-taste items earn their place too. Matched on the words in the item. */
const SEASONING_PURPOSE: Array<[RegExp, string]> = [
  [/salt/i, "sodium, which heavy sweat takes out; the day's total still counts"],
  [/cinnamon/i, "sweetness without sugar"],
  [/lemon|lime|citrus/i, "acid that lifts the plate without fat or sugar"],
  [/herb|dill|pepper|vanilla/i, "flavor with nothing added to the macros"],
];

/** Every item on a plate and what it is doing there. */
export function purposesFor(plate: PeakSignature): Array<{ item: string; why: string }> {
  return plate.portions.flatMap((p) => {
    if ("food" in p) {
      const why = FOOD_PURPOSE[p.food];
      return why ? [{ item: p.food.replace(" (dry)", ""), why }] : [];
    }
    const match = SEASONING_PURPOSE.find(([re]) => re.test(p.name));
    return match ? [{ item: p.name, why: match[1] }] : [];
  });
}

/** Where the meal's carbs sit in the day, and why. */
export function carbNote(slot: MealSlot, isTrainingDay: boolean): string {
  if (!isTrainingDay) return "No session today, so carbs stay steady across meals instead of crowding one hour of the day.";
  if (slot === "pre-workout") return "Carbs here are fast and low in fiber and fat, so they are available by the time you train.";
  if (slot === "post-workout") return "Carbs here are fast again, with protein, while the session's glycogen is being replaced.";
  return "Carbs here are slower and higher in fiber, which holds you between sessions.";
}

/* ─── The week ──────────────────────────────────────────────────────────── */

export type DayPlanInputs = {
  goal: FuelGoal;
  scheduleProfile: MemberScheduleProfile;
  bodyweightLb: number | null;
  favorites: PlanFavoriteInput[];
  personalization: MealPersonalization;
};

/** The fuel plan for a training or rest day, built the way today's is. */
export function dayPlanFor(isTrainingDay: boolean, sessionName: string, inputs: DayPlanInputs): DailyFuelPlan {
  const scheduled = buildMealPlan(inputs.scheduleProfile, { trainingPlanned: isTrainingDay, direction: "unchanged" });
  return buildDailyFuelPlan({
    goal: inputs.goal,
    isTrainingDay,
    sessionName: isTrainingDay ? sessionName : "Recovery Day",
    /* The schedule engine's meals as they are — times, labels, the slot each one moved to,
       and the optional shake — the same source Nutrition, Schedule and Apex read. */
    mealWindows: fuelWindowsFromPlan(scheduled),
    bodyweightLb: inputs.bodyweightLb,
    favorites: inputs.favorites,
    personalization: inputs.personalization,
    sleepTarget: inputs.scheduleProfile.sleepTarget,
    wakeTime: inputs.scheduleProfile.wakeTime,
  });
}

/** Seven dates from `start`, with the training day for each from the member's week (Monday first). */
export function weekDates(start: Date, week: Array<{ sessionName: string; recovery: boolean }>): Array<{ date: string; weekday: string; training: boolean; sessionName: string }> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const mondayIndex = (d.getDay() + 6) % 7;
    const plan = week[mondayIndex];
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      training: plan ? !plan.recovery : false,
      sessionName: plan?.sessionName ?? "",
    };
  });
}

/* ─── Shopping list ─────────────────────────────────────────────────────── */

export type Aisle = "Protein" | "Dairy & eggs" | "Produce" | "Grains & starches" | "Pantry";

export const AISLE: Record<PeakFood, Aisle> = {
  "wild pink salmon": "Protein", "farmed Atlantic salmon": "Protein",
  "eye of round steak": "Protein", "top round steak": "Protein", "flank steak": "Protein", "tenderloin filet": "Protein", "strip steak": "Protein", "ribeye steak": "Protein",
  "chicken breast": "Protein", "99% lean ground turkey": "Protein", "wild salmon": "Protein", cod: "Protein", shrimp: "Protein", tilapia: "Protein", "top sirloin, trimmed": "Protein", bison: "Protein",
  "egg whites": "Dairy & eggs", "whole eggs": "Dairy & eggs", "nonfat Greek yogurt": "Dairy & eggs", "1% cottage cheese": "Dairy & eggs",
  "whey isolate": "Pantry", "cream of rice (dry)": "Grains & starches", "rolled oats (dry)": "Grains & starches", "jasmine rice": "Grains & starches", quinoa: "Grains & starches",
  "sweet potato": "Produce", "gold potatoes": "Produce", sourdough: "Grains & starches", "rice cakes": "Grains & starches", "black beans": "Pantry", lentils: "Pantry",
  "chickpea protein pasta (dry)": "Grains & starches",
  "brown rice": "Grains & starches", "basmati rice": "Grains & starches", pasta: "Grains & starches", "whole wheat pasta": "Grains & starches", couscous: "Grains & starches", "rice noodles": "Grains & starches", "corn tortillas": "Grains & starches",
  "red potatoes": "Produce",
  "93% lean ground beef": "Protein", "96/4 ground beef": "Protein", "90/10 ground beef": "Protein", "85/15 ground beef": "Protein", "80/20 ground beef": "Protein",
  "90/10 ground bison": "Protein", "85/15 ground bison": "Protein", "93/7 ground turkey": "Protein",
  "chicken thighs, skinless": "Protein", "chicken drumsticks, skinless": "Protein", "chicken thighs, skin on": "Protein", "pork loin chop": "Protein", "ground pork": "Protein", "pork tenderloin": "Protein", "ahi tuna": "Protein", "extra-firm tofu": "Protein", tempeh: "Protein",
  banana: "Produce", blueberries: "Produce", strawberries: "Produce", raspberries: "Produce", apple: "Produce",
  "unsweetened cocoa powder": "Pantry", "peanut butter": "Pantry", pineapple: "Produce", mango: "Produce", kiwi: "Produce", "medjool dates": "Produce",
  spinach: "Produce", broccoli: "Produce", asparagus: "Produce", "bell peppers": "Produce", "mixed greens": "Produce", zucchini: "Produce", avocado: "Produce",
  "extra virgin olive oil": "Pantry", almonds: "Pantry", walnuts: "Pantry", "chia seeds": "Pantry", honey: "Pantry", "coconut aminos": "Pantry", salsa: "Pantry",
};

/** Cooked-weight foods bought raw: rough raw-to-cooked ratios so the list is what you buy. */
export const RAW_FACTOR: Partial<Record<PeakFood, number>> = {
  "wild pink salmon": 1.25, "farmed Atlantic salmon": 1.25,
  "eye of round steak": 1.33, "top round steak": 1.33, "flank steak": 1.33, "tenderloin filet": 1.33, "strip steak": 1.33, "ribeye steak": 1.35,
  "chicken breast": 1.33, "99% lean ground turkey": 1.3, "wild salmon": 1.25, cod: 1.25, tilapia: 1.25, shrimp: 1.25, "top sirloin, trimmed": 1.33, bison: 1.3,
  "93% lean ground beef": 1.3, "96/4 ground beef": 1.3, "90/10 ground beef": 1.3, "85/15 ground beef": 1.35, "80/20 ground beef": 1.35,
  "90/10 ground bison": 1.3, "85/15 ground bison": 1.33, "93/7 ground turkey": 1.3,
  "chicken thighs, skinless": 1.33, "chicken drumsticks, skinless": 1.4, "chicken thighs, skin on": 1.33, "pork loin chop": 1.33, "ground pork": 1.3, "pork tenderloin": 1.33, "ahi tuna": 1.2,
  "jasmine rice": 1 / 3, quinoa: 1 / 2.75, lentils: 1 / 2.5, "black beans": 1 / 2.5,
  "brown rice": 1 / 2.6, "basmati rice": 1 / 3, pasta: 1 / 2.25, "whole wheat pasta": 1 / 2.25, couscous: 1 / 2.5, "rice noodles": 1 / 2.5,
};

export const AISLE_ORDER: Aisle[] = ["Protein", "Dairy & eggs", "Produce", "Grains & starches", "Pantry"];

export type ShoppingItem = { key: string; name: string; grams: number; label: string; aisle: Aisle; boughtAs: "raw" | "dry" | "as eaten"; onHand?: true };

/** One food in the optional pre-session shake, as the shake lists it. Food only, by rule. */
export type ShakeIngredient = { name: string; amount: string; group?: string };

export function shoppingList(
  plates: Array<{ portions: PeakSignature["portions"]; scale: number | PlateScale }>,
  shakes: ShakeIngredient[][] = [],
  onHand: readonly PeakFood[] = [],
): { aisles: Array<{ aisle: Aisle; items: ShoppingItem[] }>; toTaste: string[] } {
  const grams = new Map<PeakFood, number>();
  const toTaste = new Set<string>();
  /* The shake's foods, counted by how many shakes the week holds. Tap water is not shopping; salt is to taste. */
  const shakeCounts = new Map<string, { amount: string; count: number; group?: ShakeIngredient["group"] }>();
  for (const shake of shakes) {
    for (const x of shake) {
      if (/^(cold )?water$/i.test(x.name)) continue;
      if (/salt/i.test(x.name)) {
        toTaste.add("sea salt");
        continue;
      }
      const prev = shakeCounts.get(x.name);
      shakeCounts.set(x.name, { amount: x.amount, count: (prev?.count ?? 0) + 1, group: x.group });
    }
  }
  for (const { portions, scale } of plates) {
    for (const p of portions) {
      if (!("food" in p)) {
        toTaste.add(p.name);
        continue;
      }
      const g = p.fixed ? p.grams : Math.max(5, Math.round((p.grams * scaleOf(scale, p.food)) / 5) * 5);
      grams.set(p.food, (grams.get(p.food) ?? 0) + g);
    }
  }
  const items: ShoppingItem[] = [...grams.entries()].map(([food, g]) => {
    const factor = RAW_FACTOR[food] ?? 1;
    const buy = Math.round((g * factor) / 10) * 10;
    const boughtAs = factor > 1 ? "raw" : factor < 1 || food.includes("(dry)") ? "dry" : "as eaten";
    const lb = buy / 453.6;
    const label = buy >= 450 ? `${lb.toFixed(1)} lb (${buy.toLocaleString("en-US")} g)` : `${buy} g`;
    const item: ShoppingItem = { key: food, name: food.replace(" (dry)", ""), grams: buy, label: `${label}${boughtAs === "raw" ? " raw" : boughtAs === "dry" ? " dry" : ""}`, aisle: AISLE[food], boughtAs };
    return onHand.includes(food) ? { ...item, onHand: true } : item;
  });
  for (const [name, x] of shakeCounts) {
    items.push({
      key: `shake:${name}`,
      name,
      grams: 0,
      label: `${x.amount}${x.count > 1 ? ` × ${x.count}` : ""} · shake`,
      aisle: x.group === "produce" ? "Produce" : "Pantry",
      boughtAs: "as eaten",
    });
  }
  return {
    aisles: AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => i.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name)) })).filter((a) => a.items.length > 0),
    toTaste: [...toTaste].sort(),
  };
}
