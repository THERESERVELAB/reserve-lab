/* ════════════════════════════════════════════════════════════════════════
   PLATE ROTATION — a varied day of plates, built from the member's foods.

   Why this exists: the daily fuel plan used to pick one fixed library meal
   per slot by score, with nothing that changed from one day to the next, so
   a member saw the same plates every day. Their favourites rarely matched
   the library's spelling, and the ones that did ("chicken breast") won every
   lunch. This builds each plate from parts instead:

     protein  the member's own picks first (free text matched by
              food-matcher.ts), then their Peak Mode kitchen answers, then
              the diet style's safe foods only when too few are left
     carb     their carbs, the same way
     plate    a vegetable, a finish (the flavour) and a cooking method

   Rules, per date (deterministic: the same day always builds the same plate):
     · no main protein twice in a day, and a different protein family where
       the pool allows (unless the member has one allowed protein)
     · the same protein is cooked a different way on any two days within
       three of each other, so no identical dish lands within three days
     · the week walks the whole pool, so every favourite shows up
     · allergies and the avoid list are hard exclusions, by what a food is
     · batch prep: one batch-cooked protein carries lunch for three days,
       named as the batch, on a different plate each day
     · every plate is portioned to its window's share of today's targets

   Food only. No supplements, no medical claims, no promised results.
   ════════════════════════════════════════════════════════════════════════ */

import type { DetailedIngredient, FuelMacros, MealSlot } from "./fuel-plan";
import { allergyTags, avoidKeyTags, matchFood, matchFoods, type FoodQualifier } from "./food-matcher";
import {
  EGG_WHITES,
  FAT_CARRIERS,
  METHODS,
  PLATE_CARBS,
  PLATE_FINISHES,
  PLATE_PRODUCE,
  WHOLE_EGG,
  carbById,
  finishById,
  produceById,
  proteinById,
  type CarbFood,
  type Finish,
  type FoodTag,
  type Per100,
  type ProduceFood,
  type ProteinFood,
  type ProteinKind,
} from "./plate-catalogue";

/* ─── The member ─────────────────────────────────────────────────────────── */

export type RotationMember = {
  favoriteProteins?: readonly string[];
  favoriteCarbs?: readonly string[];
  /** Peak Mode kitchen answers — passed only while Peak Mode is on. */
  kitchen?: { proteins: readonly string[]; carbs: readonly string[]; avoid: readonly string[] } | null;
  allergies?: readonly string[];
  /** Foods the member never wants (hard). */
  excluded?: readonly string[];
  /** Foods the member would rather not have (dropped unless the pool runs short). */
  disliked?: readonly string[];
  dietStyle?: string;
  dairyAllowed?: boolean;
  prepPreference?: "batch" | "cook-fresh" | "low-prep";
};

/** Where a food in the pool came from — it decides the "your pick" tag and the why line. */
type Pick = "member" | "kitchen" | "added";
type PoolProtein = { food: ProteinFood; qualifiers: FoodQualifier[]; pick: Pick };
type PoolCarb = { food: CarbFood; pick: Pick };

export type Kitchen = {
  mains: PoolProtein[];
  /** Breakfast forms available, in the order the days cycle through them. */
  breakfastCycle: Array<"egg" | "meat" | "dairy">;
  egg: PoolProtein | null;
  dairy: PoolProtein | null;
  carbs: PoolCarb[];
  breakfastCarbs: PoolCarb[];
  sweetCarbs: PoolCarb[];
  batch: PoolProtein[];
  excluded: ReadonlySet<FoodTag>;
  /** Plain-language lines about how the pool was widened, if it was. */
  notes: string[];
};

/* Kitchen answer keys (peak-kitchen.ts) → catalogue ids. Read only: the keys are the peer's. */
const KITCHEN_PROTEIN: Record<string, string> = {
  chicken: "chicken-breast", "chicken-thigh": "chicken-thigh", turkey: "ground-turkey", "ground-beef": "ground-beef",
  "ground-bison": "ground-bison", sirloin: "sirloin", "lean-red-meat": "ground-bison", pork: "pork-tenderloin",
  salmon: "salmon", tuna: "tuna", "white-fish": "cod", tilapia: "tilapia", shrimp: "shrimp", tofu: "tofu", tempeh: "tempeh",
};
const KITCHEN_CARB: Record<string, string> = {
  rice: "jasmine-rice", "brown-rice": "brown-rice", "basmati-rice": "basmati-rice", "sweet-potato": "sweet-potato",
  "gold-potato": "gold-potato", "red-potato": "red-potato", "protein-pasta": "protein-pasta", pasta: "pasta",
  "whole-wheat-pasta": "pasta", quinoa: "quinoa", "rice-noodles": "rice-noodles", "corn-tortillas": "corn-tortillas",
};

/** Diet styles this builder serves, and what each rules out. Very-low-carb styles keep the library plates. */
const STYLE_EXCLUDES: Record<string, FoodTag[]> = {
  standard: [], "high-protein": [], mediterranean: [], "low-fat": [], custom: [], "animal-based": [],
  vegan: ["red-meat", "poultry", "fish", "shellfish", "egg", "dairy", "pork"],
  vegetarian: ["red-meat", "poultry", "fish", "shellfish", "pork"],
  pescatarian: ["red-meat", "poultry", "pork"],
  "dairy-free": ["dairy"],
  "gluten-free": ["gluten"],
  halal: ["pork"],
  kosher: ["pork", "shellfish"],
  paleo: ["gluten", "legume", "dairy"],
};

/** True when this builder serves the style. Carnivore and keto keep the library plates. */
export function rotationServesStyle(style: string | undefined): boolean {
  return !style || style in STYLE_EXCLUDES;
}

const MAIN_KINDS = new Set<ProteinKind>(["steak", "ground", "poultry", "fish", "plant"]);
const DEFAULT_MAINS = [
  "chicken-breast", "ground-beef", "salmon", "sirloin", "ground-turkey", "cod", "strip", "chicken-thigh",
  "tilapia", "tuna", "ground-chicken", "mahi", "turkey-breast", "shrimp", "flank", "ground-bison", "tofu", "tempeh",
];
const DEFAULT_CARBS = ["jasmine-rice", "gold-potato", "sweet-potato", "basmati-rice", "quinoa", "red-potato", "pasta", "brown-rice", "rice-noodles"];
const BREAKFAST_STAPLES = ["sourdough", "oats", "cream-of-rice"];
const SWEET_CARBS = ["oats", "banana", "cream-of-rice"];

const MIN_MAINS = 4;
const WIDEN_MAINS_TO = 5;
const MIN_CARBS = 3;
const WIDEN_CARBS_TO = 4;

const isMainCarb = (c: CarbFood) => !c.dry && !c.sweet && c.id !== "sourdough";
const listNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * The pool in rotation order: one from each protein family in turn, each
 * family keeping the member's own order. Consecutive meals then land on
 * different families, and no family crowds out the rest of the week.
 */
function interleaveByGroup(pool: PoolProtein[]): PoolProtein[] {
  const families: PoolProtein[][] = [];
  for (const p of pool) {
    const family = families.find((f) => f[0].food.group === p.food.group);
    if (family) family.push(p);
    else families.push([p]);
  }
  const out: PoolProtein[] = [];
  for (let i = 0; out.length < pool.length; i += 1) for (const f of families) if (f[i]) out.push(f[i]);
  return out;
}

/**
 * The member's pool of foods, filtered and (only when it runs short) widened.
 * Null when this builder does not serve the member (a very-low-carb style, or
 * nothing at all is left): the caller keeps the library plates.
 */
export function resolveKitchen(member: RotationMember): Kitchen | null {
  if (!rotationServesStyle(member.dietStyle)) return null;
  const style = member.dietStyle ?? "standard";

  const excluded = new Set<FoodTag>(STYLE_EXCLUDES[style] ?? []);
  for (const a of member.allergies ?? []) allergyTags(a).forEach((t) => excluded.add(t));
  for (const k of member.kitchen?.avoid ?? []) avoidKeyTags(k).forEach((t) => excluded.add(t));
  if (member.dairyAllowed === false) excluded.add("dairy");
  /* A named food (an allergy or exclusion that is one food, e.g. "salmon") rules out that food. */
  const excludedIds = new Set<string>();
  for (const text of [...(member.allergies ?? []), ...(member.excluded ?? [])]) {
    const hit = matchFood(text);
    if (hit && allergyTags(text).length === 0) excludedIds.add(hit.id);
    for (const t of allergyTags(text)) excluded.add(t);
  }
  const disliked = new Set((member.disliked ?? []).map((d) => matchFood(d)?.id).filter((x): x is string => Boolean(x)));
  const allowed = (tags: readonly FoodTag[], id: string) => !excludedIds.has(id) && !tags.some((t) => excluded.has(t));
  const plantOk = style === "vegan" || style === "vegetarian";

  /* ── Proteins ── */
  const picked: PoolProtein[] = [];
  const addPick = (id: string, qualifiers: FoodQualifier[], pick: Pick) => {
    const food = proteinById(id);
    if (!food || !allowed(food.tags, food.id)) return;
    const existing = picked.find((p) => p.food.id === id);
    if (existing) {
      qualifiers.forEach((q) => !existing.qualifiers.includes(q) && existing.qualifiers.push(q));
      return;
    }
    picked.push({ food, qualifiers: [...qualifiers], pick });
  };
  for (const m of matchFoods(member.favoriteProteins ?? [], "protein")) addPick(m.id, m.qualifiers, "member");
  for (const key of member.kitchen?.proteins ?? []) if (KITCHEN_PROTEIN[key]) addPick(KITCHEN_PROTEIN[key], [], "kitchen");
  const memberHadMains = picked.some((p) => MAIN_KINDS.has(p.food.kind));
  let mains = picked.filter((p) => MAIN_KINDS.has(p.food.kind) && !disliked.has(p.food.id));
  if (mains.length === 0) mains = picked.filter((p) => MAIN_KINDS.has(p.food.kind));

  const notes: string[] = [];
  const defaultMains = DEFAULT_MAINS.map((id) => proteinById(id)!)
    .filter((f) => allowed(f.tags, f.id) && (f.kind !== "plant" || plantOk) && !disliked.has(f.id) && !mains.some((m) => m.food.id === f.id));
  if (!memberHadMains) {
    mains = defaultMains.map((food) => ({ food, qualifiers: [], pick: "added" as const }));
  } else if (mains.length < MIN_MAINS) {
    const before = mains.length;
    const added = defaultMains.slice(0, WIDEN_MAINS_TO - before);
    mains = [...mains, ...added.map((food) => ({ food, qualifiers: [] as FoodQualifier[], pick: "added" as const }))];
    if (added.length) {
      notes.push(`Your picks leave ${before} ${before === 1 ? "protein" : "proteins"} after your allergies and avoid list, so Reserve added ${listNames(added.map((f) => f.label.toLowerCase()))} to keep the week varied.`);
    }
  }
  if (mains.length === 0) return null;
  mains = interleaveByGroup(mains);

  /* ── Breakfast ── */
  const eggFood = proteinById("eggs")!;
  const egg: PoolProtein | null = allowed(eggFood.tags, eggFood.id)
    ? (picked.find((p) => p.food.id === "eggs") ?? { food: eggFood, qualifiers: [], pick: "added" })
    : null;
  const dairyPick = picked.find((p) => p.food.kind === "dairy") ?? null;
  const yogurt = proteinById("greek-yogurt")!;
  const dairy: PoolProtein | null = dairyPick ?? (allowed(yogurt.tags, yogurt.id) && (!egg || !memberHadMains) ? { food: yogurt, qualifiers: [], pick: "added" } : null);
  const breakfastMeats = mains.some((m) => m.food.kind === "steak" || m.food.kind === "ground");
  const breakfastCycle: Kitchen["breakfastCycle"] = [];
  if (egg) breakfastCycle.push("egg");
  if (breakfastMeats) breakfastCycle.push("meat");
  if (egg) breakfastCycle.push("egg");
  if (dairy) breakfastCycle.push("dairy");
  if (breakfastCycle.length === 0) breakfastCycle.push("meat");

  /* ── Carbs ── */
  const carbPicks: PoolCarb[] = [];
  const addCarb = (id: string, pick: Pick) => {
    const food = carbById(id);
    if (!food || !allowed(food.tags, food.id) || carbPicks.some((c) => c.food.id === id)) return;
    carbPicks.push({ food, pick });
  };
  for (const m of matchFoods(member.favoriteCarbs ?? [], "carb")) addCarb(m.id, "member");
  for (const key of member.kitchen?.carbs ?? []) if (KITCHEN_CARB[key]) addCarb(KITCHEN_CARB[key], "kitchen");
  const memberHadCarbs = carbPicks.length > 0;
  let carbs = carbPicks.filter((c) => isMainCarb(c.food) && !disliked.has(c.food.id));
  const defaultCarbs = DEFAULT_CARBS.map((id) => carbById(id)!).filter((f) => allowed(f.tags, f.id) && !disliked.has(f.id) && !carbs.some((c) => c.food.id === f.id));
  if (!memberHadCarbs) {
    carbs = defaultCarbs.map((food) => ({ food, pick: "added" as const }));
  } else if (carbs.length < MIN_CARBS) {
    const before = carbs.length;
    const added = defaultCarbs.slice(0, WIDEN_CARBS_TO - before);
    carbs = [...carbs, ...added.map((food) => ({ food, pick: "added" as const }))];
    if (added.length) notes.push(`Your carb picks leave ${before} after your avoid list, so Reserve added ${listNames(added.map((f) => f.label))}.`);
  }
  if (carbs.length === 0) carbs = PLATE_CARBS.filter((c) => isMainCarb(c) && allowed(c.tags, c.id)).map((food) => ({ food, pick: "added" as const }));

  const breakfastCarbs = [
    ...carbPicks.filter((c) => c.food.breakfast && !c.food.sweet),
    ...carbs.filter((c) => c.food.breakfast && !carbPicks.some((p) => p.food.id === c.food.id)),
  ];
  for (const id of BREAKFAST_STAPLES) {
    if (breakfastCarbs.length >= 3) break;
    const food = carbById(id)!;
    if (allowed(food.tags, food.id) && !breakfastCarbs.some((c) => c.food.id === id)) breakfastCarbs.push({ food, pick: carbPicks.some((c) => c.food.id === id) ? "member" : "added" });
  }
  const sweetCarbs = SWEET_CARBS.map((id) => carbById(id)!).filter((f) => allowed(f.tags, f.id)).map((food) => ({ food, pick: carbPicks.some((c) => c.food.id === food.id) ? ("member" as const) : ("added" as const) }));

  const batch = member.prepPreference === "batch" ? mains.filter((m) => m.food.batch) : [];

  return {
    mains,
    breakfastCycle,
    egg,
    dairy,
    carbs,
    breakfastCarbs: breakfastCarbs.length ? breakfastCarbs : carbs,
    sweetCarbs,
    batch,
    excluded,
    notes,
  };
}

/* ─── Plate ids ──────────────────────────────────────────────────────────── */

export type PlateSpec = {
  protein: string;
  carb: string | null;
  produce: string;
  finish: string;
  /** 0–3: the cooking method. */
  method: number;
  /** A batch-cooked protein. */
  batch: boolean;
};

const ID_PREFIX = "plate.";

export function plateId(spec: PlateSpec): string {
  return `${ID_PREFIX}${spec.protein}.${spec.carb ?? "none"}.${spec.produce}.${spec.finish}.${spec.method}${spec.batch ? ".b" : ""}`;
}

/** The spec a plate id names, or null when it is not a plate id (or names foods no longer known). */
export function parsePlateId(id: string): PlateSpec | null {
  if (!id.startsWith(ID_PREFIX)) return null;
  const [protein, carb, produce, finish, method, batch] = id.slice(ID_PREFIX.length).split(".");
  const m = Number(method);
  if (!proteinById(protein) || !produceById(produce) || !finishById(finish) || !(m >= 0 && m <= 3)) return null;
  if (carb !== "none" && !carbById(carb)) return null;
  return { protein, carb: carb === "none" ? null : carb, produce, finish, method: m, batch: batch === "b" };
}

/* ─── The day ────────────────────────────────────────────────────────────── */

export type RotationSlot = {
  /** The meal window id. */
  key: string;
  slot: MealSlot;
  /** Within 2.5 h of the sleep target: no heavy plate. */
  nearSleep: boolean;
  /** This window's share of today's targets. */
  target: FuelMacros;
  /** A plate already logged in this window today: it stays exactly as logged. */
  pinned?: PlateSpec | null;
};

export type ComposedPlate = {
  id: string;
  spec: PlateSpec;
  name: string;
  ingredients: string[];
  ingredientsDetailed: DetailedIngredient[];
  macros: FuelMacros;
  prep: string[];
  covers: string[];
  smartRead: string;
  personalizationTags: string[];
  proteinId: string;
};

/** Days since 1970-01-01 for a "YYYY-MM-DD" key — the same date always gives the same day. */
export function dayIndexOfDate(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayOf = (dayIndex: number) => WEEKDAY[((dayIndex % 7) + 11) % 7]; // 1970-01-01 was a Thursday
const mod = (n: number, m: number) => ((n % m) + m) % m;
/** A batch covers three days of lunches. */
export const BATCH_DAYS = 3;

/** Whether a protein suits a slot: lean close to training, nothing heavy near sleep. */
function suits(p: ProteinFood, slot: MealSlot, nearSleep: boolean): boolean {
  if (nearSleep && p.heavy) return false;
  if (slot === "pre-workout") return p.per100.f <= 8 && !p.heavy;
  return true;
}

type DayState = { proteins: Set<string>; groups: Set<string>; carbs: Set<string>; finishes: Set<string>; produce: Set<string> };

/** Walk a list from `start` for the first item passing the strictest test that anything passes. */
function walk<T>(list: readonly T[], start: number, tests: Array<(item: T) => boolean>): T | null {
  if (!list.length) return null;
  for (const test of tests) {
    for (let i = 0; i < list.length; i += 1) {
      const item = list[mod(start + i, list.length)];
      if (test(item)) return item;
    }
  }
  return null;
}

function finishesFor(kind: ProteinKind, kitchen: Kitchen): Finish[] {
  return PLATE_FINISHES.filter((f) => f.kinds.includes(kind) && !f.tags.some((t) => kitchen.excluded.has(t)) && !FAT_CARRIERS[f.carrier].tags.some((t) => kitchen.excluded.has(t)));
}

function produceFor(slot: MealSlot, sweet: boolean): ProduceFood[] {
  if (sweet) return PLATE_PRODUCE.filter((p) => p.sweet);
  if (slot === "breakfast") return PLATE_PRODUCE.filter((p) => p.breakfast);
  return PLATE_PRODUCE.filter((p) => !p.sweet);
}

/**
 * Plates for one day. Slots are in time order; a null entry is a slot this
 * builder does not fill (a snack window), which the caller plates as before.
 */
export function planDayPlates(input: { dayIndex: number; kitchen: Kitchen; slots: RotationSlot[] }): Array<ComposedPlate | null> {
  /* The day as planned, ignoring what was logged. When every logged plate is the
     one planned (the normal case), that is the day: logging a meal never moves
     the plates still to come. Only a logged plate the plan no longer holds (the
     member's picks changed mid-day) re-plans the open slots around it. */
  const unpinned = planSpecs(input.dayIndex, input.kitchen, input.slots.map((s) => ({ ...s, pinned: null })));
  const drifted = input.slots.some((s, i) => s.pinned && plateId(s.pinned) !== (unpinned[i] ? plateId(unpinned[i]!) : null));
  const specs = drifted ? planSpecs(input.dayIndex, input.kitchen, input.slots) : unpinned;
  return input.slots.map((s, i) => {
    const spec = specs[i];
    return spec ? composePlate({ spec, slot: s.slot, target: s.target, kitchen: input.kitchen, dayIndex: input.dayIndex }) : null;
  });
}

function planSpecs(d: number, kitchen: Kitchen, slots: RotationSlot[]): Array<PlateSpec | null> {
  const state: DayState = { proteins: new Set(), groups: new Set(), carbs: new Set(), finishes: new Set(), produce: new Set() };
  const specs: Array<PlateSpec | null> = slots.map(() => null);
  const claim = (spec: PlateSpec) => {
    const food = proteinById(spec.protein)!;
    state.proteins.add(spec.protein);
    state.groups.add(food.group);
    if (spec.carb) state.carbs.add(spec.carb);
    state.finishes.add(spec.finish);
    state.produce.add(spec.produce);
  };

  /* 1. What the member already logged today stays as logged. */
  slots.forEach((s, i) => {
    if (s.slot !== "snack" && s.pinned) {
      specs[i] = s.pinned;
      claim(s.pinned);
    }
  });

  /* 2. Batch prep: one batch-cooked protein carries lunch for BATCH_DAYS days. */
  const block = Math.floor(d / BATCH_DAYS);
  const inBlock = mod(d, BATCH_DAYS);
  const lunchIndex = slots.findIndex((s, i) => s.slot === "lunch" && !specs[i]);
  if (kitchen.batch.length && lunchIndex >= 0) {
    const pool = kitchen.batch.filter((p) => !state.proteins.has(p.food.id));
    const batchProtein = pool.length ? pool[mod(block, pool.length)] : null;
    if (batchProtein) {
      const finishes = finishesFor(batchProtein.food.kind, kitchen);
      const finish = finishes[mod(block * BATCH_DAYS + inBlock, finishes.length)];
      const carb = walk(kitchen.carbs, block * BATCH_DAYS + inBlock + 1, [(c) => !state.carbs.has(c.food.id), () => true]);
      const produce = walk(produceFor("lunch", false), d + 1, [(p) => !state.produce.has(p.id), () => true]);
      if (finish && produce) {
        const spec: PlateSpec = { protein: batchProtein.food.id, carb: carb?.food.id ?? null, produce: produce.id, finish: finish.id, method: mod(block, 4), batch: true };
        specs[lunchIndex] = spec;
        claim(spec);
      }
    }
  }

  /* 3. Breakfast: the day's form (eggs, a steak or ground-meat plate with eggs, or a bowl). */
  slots.forEach((s, i) => {
    if (s.slot !== "breakfast" || specs[i]) return;
    const form = kitchen.breakfastCycle[mod(d, kitchen.breakfastCycle.length)];
    let protein: PoolProtein | null = null;
    if (form === "egg") protein = kitchen.egg;
    else if (form === "dairy") protein = kitchen.dairy;
    else {
      const meats = kitchen.mains.filter((m) => m.food.kind === "steak" || m.food.kind === "ground");
      protein = walk(meats, Math.floor(d / kitchen.breakfastCycle.length), [(m) => !state.proteins.has(m.food.id), () => true]);
    }
    protein ??= kitchen.egg ?? kitchen.dairy ?? walk(kitchen.mains, d, [(m) => !state.proteins.has(m.food.id), () => true]);
    if (!protein) return;
    const sweet = protein.food.kind === "dairy";
    const carbs = sweet ? kitchen.sweetCarbs : kitchen.breakfastCarbs;
    const carb = walk(carbs, d, [(c) => !state.carbs.has(c.food.id), () => true]);
    const finish = walk(finishesFor(protein.food.kind, kitchen), d * 3 + 1, [(f) => !state.finishes.has(f.id), () => true]);
    const produce = walk(produceFor("breakfast", sweet), d + 2, [(p) => !state.produce.has(p.id), () => true]);
    if (!finish || !produce) return;
    const spec: PlateSpec = { protein: protein.food.id, carb: carb?.food.id ?? null, produce: produce.id, finish: finish.id, method: mod(d, 4), batch: false };
    specs[i] = spec;
    claim(spec);
  });

  /* 4. Every other meal, in time order, walking the week's rotation. */
  const open = slots.map((s, i) => ({ s, i })).filter(({ s, i }) => !specs[i] && s.slot !== "snack" && s.slot !== "breakfast");
  /* Consecutive days start where the last one left off, so a week walks the whole pool. */
  const perDay = Math.max(1, open.length);
  open.forEach(({ s, i }, k) => {
    const start = d * perDay + k;
    const fits = (m: PoolProtein) => suits(m.food, s.slot, s.nearSleep);
    const protein = walk(kitchen.mains, start, [
      (m) => fits(m) && !state.proteins.has(m.food.id) && !state.groups.has(m.food.group),
      (m) => fits(m) && !state.proteins.has(m.food.id),
      (m) => !state.proteins.has(m.food.id) && !m.food.heavy,
      (m) => fits(m),
      () => true,
    ]);
    if (!protein) return;
    const carbPool = s.slot === "pre-workout" ? kitchen.carbs.filter((c) => c.food.fast) : kitchen.carbs;
    const carb = walk(carbPool.length ? carbPool : kitchen.carbs, d * 2 + k, [(c) => !state.carbs.has(c.food.id), () => true]);
    /* No butter finish right before training. */
    const finishes = finishesFor(protein.food.kind, kitchen).filter((f) => s.slot !== "pre-workout" || f.carrier !== "butter");
    const finish = walk(finishes, d * 3 + k * 2, [(f) => !state.finishes.has(f.id), () => true]);
    const produce = walk(produceFor(s.slot, false), d + k * 2, [(p) => !state.produce.has(p.id), () => true]);
    if (!finish || !produce) return;
    const spec: PlateSpec = { protein: protein.food.id, carb: carb?.food.id ?? null, produce: produce.id, finish: finish.id, method: mod(d, 4), batch: false };
    specs[i] = spec;
    claim(spec);
  });

  return specs;
}

/* ─── One plate ──────────────────────────────────────────────────────────── */

const round5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Part = { name: string; amount: string; group: DetailedIngredient["group"]; grams: number; per100: Per100; line: string };

function part(name: string, grams: number, per100: Per100, group: DetailedIngredient["group"], opts: { dry?: boolean; line?: string } = {}): Part {
  const amount = `${grams}g${opts.dry ? " (dry)" : ""}`;
  return { name, amount, group, grams, per100, line: opts.line ?? `${amount} ${name}` };
}

function sum(parts: Part[]): FuelMacros {
  const t = parts.reduce((acc, x) => ({ p: acc.p + (x.per100.p * x.grams) / 100, c: acc.c + (x.per100.c * x.grams) / 100, f: acc.f + (x.per100.f * x.grams) / 100 }), { p: 0, c: 0, f: 0 });
  return { proteinG: Math.round(t.p), carbsG: Math.round(t.c), fatG: Math.round(t.f), calories: Math.round(t.p * 4 + t.c * 4 + t.f * 9) };
}

const QUALIFIER_LABEL: Record<FoodQualifier, string> = { "grass-fed": "Grass-Fed", "pasture-raised": "Pasture-Raised", "wild-caught": "Wild" };

/** The qualifier that belongs to this food ("grass-fed" on beef, "pasture-raised" on eggs and poultry). */
function qualifierFor(food: ProteinFood, qualifiers: readonly FoodQualifier[]): FoodQualifier | null {
  if (food.group === "beef" && qualifiers.includes("grass-fed")) return "grass-fed";
  if ((food.group === "egg" || food.group === "poultry") && qualifiers.includes("pasture-raised")) return "pasture-raised";
  if (food.group === "fish" && qualifiers.includes("wild-caught")) return "wild-caught";
  return null;
}

function methodLabel(food: ProteinFood, method: number): string {
  return food.methods?.[method] ?? METHODS[food.kind][method].label;
}

const BREAKFAST_GROUND = ["Skillet", "Patties", "Crumble", "Sausage Patties"] as const;

/** The dish's name: "Cast-Iron Grass-Fed NY Strip with Chimichurri · Gold Potatoes". */
function dishName(food: ProteinFood, label: string, method: number, finish: Finish, carb: CarbFood | null, slot: MealSlot, batch: boolean): string {
  const m = methodLabel(food, method);
  let core: string;
  switch (food.kind) {
    case "ground":
      /* At breakfast a ground meat is a skillet, patties, a crumble or sausage patties beside eggs. */
      core = slot === "breakfast"
        ? `${label} ${BREAKFAST_GROUND[method]}`
        : m === "Meatballs" ? `Baked ${label} Meatballs` : `${label} ${m}`;
      break;
    case "egg": {
      const one = label.replace(/Eggs$/, "Egg");
      core = m === "Omelette" || m === "Frittata" ? `${one} ${m}` : `${m} ${label}`;
      break;
    }
    case "dairy":
      core = m === "Whipped" ? `Whipped ${label} Bowl` : `${label} ${m}`;
      break;
    default:
      core = `${m} ${label}`;
  }
  if (slot === "breakfast" && (food.kind === "steak" || food.kind === "ground")) core = `${core} & Eggs`;
  let flavoured = finish.pattern === "prefix" ? `${finish.label} ${core}` : `${core} with ${finish.label}`;
  if (batch) flavoured = `Batch ${flavoured}`;
  const carbName = carb ? (slot === "breakfast" ? (carb.breakfastShort ?? carb.short) : carb.short) : null;
  return carbName ? `${flavoured} · ${carbName}` : flavoured;
}

function composePlate(input: { spec: PlateSpec; slot: MealSlot; target: FuelMacros; kitchen: Kitchen; dayIndex: number }): ComposedPlate {
  const { spec, slot, target, kitchen } = input;
  const food = proteinById(spec.protein)!;
  const carb = spec.carb ? carbById(spec.carb)! : null;
  const produce = produceById(spec.produce)!;
  const finish = finishById(spec.finish)!;
  const carrier = FAT_CARRIERS[finish.carrier];
  const inPool = kitchen.mains.find((m) => m.food.id === food.id) ?? (kitchen.egg?.food.id === food.id ? kitchen.egg : null) ?? (kitchen.dairy?.food.id === food.id ? kitchen.dairy : null);
  const qualifier = qualifierFor(food, inPool?.qualifiers ?? []);
  const label = qualifier ? `${QUALIFIER_LABEL[qualifier]} ${food.label}` : food.label;
  const grocery = qualifier ? `${qualifier === "wild-caught" ? "wild" : qualifier} ${food.grocery}` : food.grocery;

  /* Portions: vegetables first, then protein to the protein share, carbs to
     the carb share, one cooking fat to the fat share, then carbs trimmed or
     topped up so calories land on the window's share. */
  const produceG = produce.sweet ? 80 : slot === "breakfast" ? 70 : 120;
  const veg = part(produce.label, produceG, produce.per100, "produce");
  const fixed: Part[] = [];
  if (slot === "breakfast" && (food.kind === "steak" || food.kind === "ground")) {
    fixed.push({ ...part("whole eggs", 2 * WHOLE_EGG.grams, { p: WHOLE_EGG.p * 2, c: WHOLE_EGG.c * 2, f: WHOLE_EGG.f * 2 }, "protein"), per100: { p: WHOLE_EGG.p * 2, c: WHOLE_EGG.c * 2, f: WHOLE_EGG.f * 2 }, grams: 100, amount: "2", line: "2 whole eggs" });
  }
  const carbEstimate = carb ? Math.max(0, (target.carbsG - (veg.per100.c * veg.grams) / 100) / (carb.per100.c / 100)) : 0;
  const carbProtein = carb ? (carb.per100.p * clamp(carbEstimate, 0, carb.max)) / 100 : 0;
  const needP = Math.max(10, target.proteinG - carbProtein - sum([veg, ...fixed]).proteinG);

  const proteinParts: Part[] = [];
  if (food.kind === "egg") {
    const count = target.fatG >= 16 ? 3 : 2;
    const eggs = { p: WHOLE_EGG.p * count, c: WHOLE_EGG.c * count, f: WHOLE_EGG.f * count };
    const wholeName = qualifier === "pasture-raised" ? "pasture-raised whole eggs" : "whole eggs";
    proteinParts.push({ name: wholeName, amount: String(count), group: "protein", grams: 100, per100: eggs, line: `${count} ${wholeName}` });
    const whites = round5(clamp((needP - eggs.p) / (EGG_WHITES.p / 100), 0, 400));
    if (whites > 0) proteinParts.push(part("egg whites", whites, EGG_WHITES, "protein"));
  } else if (food.kind === "dairy") {
    proteinParts.push(part(grocery, Math.round(clamp(needP / (food.per100.p / 100), 150, 450) / 10) * 10, food.per100, "protein"));
  } else {
    proteinParts.push(part(grocery, round5(clamp(needP / (food.per100.p / 100), 90, 300)), food.per100, "protein"));
  }

  const base = [veg, ...fixed, ...proteinParts];
  let carbG = 0;
  if (carb) {
    const needC = target.carbsG - sum(base).carbsG;
    carbG = round5(clamp(needC / (carb.per100.c / 100), 0, carb.max));
  }
  const carbPart = (g: number) => (carb ? [part(carb.label, g, carb.per100, "carb", { dry: carb.dry })] : []);
  const needF = target.fatG - sum([...base, ...carbPart(carbG)]).fatG;
  const fatG = Math.round(clamp(needF / (carrier.per100.f / 100), 0, carrier.max) / carrier.step) * carrier.step;
  const fatParts = fatG > 0 ? [part(carrier.label, fatG, carrier.per100, "fat")] : [];

  /* Calories onto the window's share: carbs flex, within reason. */
  if (carb && carbG > 0) {
    const kcal = sum([...base, ...carbPart(carbG), ...fatParts]).calories;
    const perGram = (carb.per100.c * 4) / 100;
    if (kcal > target.calories * 1.05) carbG = round5(Math.max(carbG * 0.45, carbG - (kcal - target.calories) / perGram));
    else if (kcal < target.calories * 0.95) carbG = round5(Math.min(carb.max, carbG + (target.calories - kcal) / perGram, carbG * 1.35));
  }

  const parts = [...proteinParts, ...fixed, ...carbPart(carbG).filter((p) => p.grams > 0), veg, ...fatParts];
  const macros = sum(parts);
  const finishPart: DetailedIngredient = { name: finish.finish, amount: "to taste", group: "finish" };
  const ingredientsDetailed: DetailedIngredient[] = [...parts.map((p) => ({ name: p.name, amount: p.amount, group: p.group })), finishPart];
  const ingredients = [...parts.map((p) => p.line), finish.finish];

  const method = METHODS[food.kind][spec.method];
  const prep = spec.batch ? ["batch-cooked", ...method.prep] : [...method.prep];
  const covers = Array.from(new Set([...food.covers, ...(carb?.covers ?? []), ...produce.covers, ...(carrier.id === "avocado" ? ["potassium"] : [])]));

  /* The why line: where the foods came from, how it was sized, and any widening. */
  const carbPick = carb ? kitchen.carbs.concat(kitchen.breakfastCarbs, kitchen.sweetCarbs).find((c) => c.food.id === carb.id)?.pick : undefined;
  const whyFood = inPool?.pick === "member" ? `${label} from your picks` : inPool?.pick === "kitchen" ? `${label} from your Peak Mode kitchen` : label;
  const whyCarb = carb ? `, with ${carb.label}${carbPick === "member" ? " from your carbs" : carbPick === "kitchen" ? " from your kitchen answers" : ""}` : "";
  const lines = [`${whyFood}${whyCarb}.`];
  if (spec.batch) lines.push(`Lunch from your ${weekdayOf(Math.floor(input.dayIndex / BATCH_DAYS) * BATCH_DAYS)} batch cook: the same ${food.label.toLowerCase()}, a different plate each day.`);
  lines.push(`Portioned to this meal's share of today's targets, about ${macros.proteinG} g protein.`);
  if (inPool?.pick === "added" && kitchen.notes.length) lines.push(kitchen.notes[0]);

  const personalizationTags: string[] = [];
  if (inPool?.pick === "member" || inPool?.pick === "kitchen") personalizationTags.push(`${label} · your pick`);
  if (carb && (carbPick === "member" || carbPick === "kitchen")) personalizationTags.push(`${carb.short} · your pick`);
  if (spec.batch) personalizationTags.push(`Batch · cooked ${weekdayOf(Math.floor(input.dayIndex / BATCH_DAYS) * BATCH_DAYS).slice(0, 3)}`);

  return {
    id: plateId(spec),
    spec,
    name: dishName(food, label, spec.method, finish, carb, slot, spec.batch),
    ingredients,
    ingredientsDetailed,
    macros,
    prep,
    covers,
    smartRead: lines.join(" "),
    personalizationTags,
    proteinId: food.id,
  };
}
