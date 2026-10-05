/* ════════════════════════════════════════════════════════════════════════
   PEAK MODE — one tap, the whole day for the look the member picks.

   The member chooses a look (lean, dry and hard; full and hard; recomp). The
   look sets the fuel goal the Nutrition plan is built from, and Peak Mode lays
   the day out on one screen: meals with foods, weights and times around
   training, which fruit fits which meal, the training and cardio day, sleep,
   and the supplements the member chose themselves.

   The look sets the diet. The member's compounds, all counted together,
   only decide which of the look's plates come first: plates that fit public
   guidance for a body area those compounds affect (see peak-signatures.ts).
   Reserve never builds a diet around a compound, never claims food offsets
   one, never picks supplements or amounts, and never uses water or sodium
   cutting for a "dry" look — on a cycle that adds blood pressure and kidney
   strain on top of what is already watched.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";

import type { DailyFuelPlan, FuelGoal, MealSlot, PlannedFuelMeal } from "./fuel-plan";
import type { GoalKey } from "./types";
import { isBowlPlateId } from "./peak-bowls";
import { carbNote, choosePlate, FAT_FILLER_WHY, platesFor, purposesFor, recipeFor, targetMatch, withFatFiller, type PeakKitchenPrefs } from "./peak-kitchen";
import { resolveRatio, type RatioContext, type RatioPick } from "./peak-ratios";
import { fitsFor, isFitArea, scaleOf, scalesFor, signatureIngredients, signatureMacros, type FitArea, type PeakSignature, type PlateScale } from "./peak-signatures";

export const PEAK_MODE_VERSION = "2026.09.16";

export type PeakLook = "lean-hard" | "full-hard" | "recomp";

export const PEAK_LOOKS: Record<PeakLook, { label: string; goal: FuelGoal; line: string }> = {
  "lean-hard": {
    label: "Lean · dry · hard",
    goal: "shred",
    line: "A steady calorie deficit with protein high, carbs placed around training and fats kept lean. Dry and hard comes from lower body fat, not from cutting water.",
  },
  "full-hard": {
    label: "Full · hard",
    goal: "lean-bulk",
    line: "A small surplus with carbs carrying the training day. Full comes from glycogen and muscle, kept tight with lean proteins and controlled fats.",
  },
  recomp: {
    label: "Recomp",
    goal: "recomp",
    line: "Calories near maintenance, protein high, carbs heavier on training days and lighter on rest days.",
  },
};

export const PEAK_LOOK_ORDER: PeakLook[] = ["lean-hard", "full-hard", "recomp"];

/** The look in the macro engine's own goal vocabulary, so carbs and fat come from one place. */
export const LOOK_GOAL_KEY: Record<PeakLook, GoalKey> = { "lean-hard": "cut", "full-hard": "lean-bulk", recomp: "recomp" };

export function isPeakLook(value: unknown): value is PeakLook {
  return typeof value === "string" && value in PEAK_LOOKS;
}

const SRC = {
  issnTiming: { label: "Kerksick CM, et al. International Society of Sports Nutrition position stand: nutrient timing, 2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5596471/" },
  issnProtein: { label: "Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise, 2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" },
  dga: { label: "U.S. Departments of Agriculture and Health and Human Services: Dietary Guidelines for Americans, 2020–2025", url: "https://www.dietaryguidelines.gov" },
  peakWeek: { label: "Escalante G, et al. Peak week recommendations for bodybuilders: an evidence based approach. BMC Sports Science, Medicine and Rehabilitation, 2021", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7968598/" },
  endocrine: { label: "Pope HG Jr, et al. Adverse health consequences of performance-enhancing drugs: an Endocrine Society scientific statement. Endocrine Reviews, 2014." },
  acsmFluid: { label: "American College of Sports Medicine position stand: Exercise and fluid replacement, 2007" },
} satisfies Record<string, ProfileSource>;

/* ─── Fruit by meal ─────────────────────────────────────────────────────── */

export type FruitFit = { kind: "fast" | "steady"; fruits: string; why: string };

const AROUND_TRAINING: ReadonlySet<MealSlot> = new Set(["pre-workout", "post-workout"]);

/** Which fruit fits which meal: quicker carbs around training, higher-fiber fruit elsewhere. */
export function fruitFor(slot: MealSlot, isTrainingDay: boolean): FruitFit {
  if (isTrainingDay && AROUND_TRAINING.has(slot)) {
    return {
      kind: "fast",
      fruits: "Banana, pineapple, mango, grapes or dates",
      why: "Quick carbs with little fiber or fat digest fast around a session and refill glycogen after it.",
    };
  }
  return {
    kind: "steady",
    fruits: "Berries, apple, orange, kiwi or pear",
    why: "More fiber and vitamin C, slower to digest and more filling between sessions.",
  };
}

/* ─── The day ───────────────────────────────────────────────────────────── */

export type PeakMealFit = { area: FitArea; reason: string; sources: ProfileSource[] };

export type PeakMeal = PlannedFuelMeal & {
  fruit: FruitFit;
  signature: boolean;
  fits: PeakMealFit[];
  /** The plate chosen for this slot, when a signature plate is used. */
  plateId: string | null;
  /** The plate as served — member swaps applied — and its portion scale, for the shopping list. */
  plate: PeakSignature | null;
  scale: PlateScale;
  swapped: Array<{ from: string; to: string }>;
  /** Lean-to-fat ratios picked for ground meats on this plate. */
  ratios: RatioPick[];
  /** 0–100: how closely calories and protein land on this meal's target. */
  match: number | null;
  recipe: string[];
  /** Every item on the plate and what it is doing there. */
  purposes: Array<{ item: string; why: string }>;
  /** Where this meal's carbs sit in the day. */
  carbNote: string;
  /** The meal's own share of the day's targets. */
  target: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

export type PeakDayOptions = {
  look: PeakLook;
  /** Body areas the member's compounds affect, all compounds together. Empty when safety content is closed. */
  compoundAreas?: Iterable<string>;
  /** Day number used to rotate plates across the week. */
  dayIndex?: number;
  prefs?: PeakKitchenPrefs | null;
  /** Plates the member picked for this day, by swapKey (the slot, or "snack:<id>" for a snack). */
  swaps?: Record<string, string>;
  /** Snacks the member wants between meals. Omitted: mid-morning and afternoon. Empty: none. */
  snacks?: readonly PeakSnackPeriod[];
  /** Lights out, "HH:MM", so an evening snack never lands on bedtime. */
  sleepTime?: string;
  /** The member's own bowls, as plates. */
  bowls?: readonly PeakSignature[];
  /** Plates the member hid for good. */
  hidden?: Iterable<string>;
  /** Lipid context and the member's own ratio picks for ground meats. Look comes from `look`. */
  ratios?: Omit<RatioContext, "look">;
  /** The day's macro targets. Without them, carbs and fat fall back to the national ranges. */
  dayTargets?: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

/* ─── Snacks between meals ─────────────────────────────────────────────── */

export type PeakSnackPeriod = "mid-morning" | "afternoon" | "evening";

export const PEAK_SNACK_PERIODS: ReadonlyArray<{ key: PeakSnackPeriod; label: string }> = [
  { key: "mid-morning", label: "Mid-morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

/** Until the member chooses, a snack mid-morning and one in the afternoon. */
export const DEFAULT_PEAK_SNACKS: readonly PeakSnackPeriod[] = ["mid-morning", "afternoon"];

/** A snack needs this much room between two meals: about 75 minutes clear of each. */
const SNACK_MIN_GAP = 150;
/** A snack's weight against the day, before the day is shared out: meals shrink to make room. */
const SNACK_SHARE = { calories: 0.1, proteinG: 0.1, carbsG: 0.15, fatG: 0.05 };

const SNACK_LABEL: Record<PeakSnackPeriod, string> = {
  "mid-morning": "Mid-Morning Snack",
  afternoon: "Afternoon Snack",
  evening: "Evening Snack",
};

function clockMin(time: string | null | undefined): number | null {
  const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clockOf(min: number): string {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** The swap key for a meal: its slot, or the snack's own id so two snacks never share a pick. */
export function swapKey(meal: Pick<PlannedFuelMeal, "slot" | "id">): string {
  return meal.slot === "snack" ? `snack:${meal.id}` : meal.slot;
}

/**
 * The member's snacks, placed between their meals: mid-morning and afternoon
 * in the widest gap of that part of the day with room for one, the evening
 * one after the last meal and at least an hour before lights out. The fuel
 * engine's own gap snacks give way to the member's choice. A period with no
 * room today is simply left out.
 */
export function withSnacks(meals: PlannedFuelMeal[], periods: readonly PeakSnackPeriod[], sleepTime?: string): PlannedFuelMeal[] {
  const base = meals.filter((m) => !m.id.startsWith("fuel-smart-snack"));
  const real = base.filter((m) => !m.optional);
  const timed = real.map((m) => ({ meal: m, at: clockMin(m.time) })).filter((x): x is { meal: PlannedFuelMeal; at: number } => x.at !== null);
  if (timed.length === 0 || periods.length === 0) return base;

  /* Minutes on the member's day, from the first meal, so a day past midnight stays in order. */
  const anchor = timed[0].at;
  const rel = (clock: number) => (((clock - anchor) % 1440) + 1440) % 1440;
  const periodOf = (clock: number): PeakSnackPeriod => {
    const c = ((clock % 1440) + 1440) % 1440;
    return c < 12 * 60 ? "mid-morning" : c < 17 * 60 + 30 ? "afternoon" : "evening";
  };

  const sums = real.reduce(
    (s, m) => ({ calories: s.calories + m.macros.calories, proteinG: s.proteinG + m.macros.proteinG, carbsG: s.carbsG + m.macros.carbsG, fatG: s.fatG + m.macros.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const weight = {
    calories: Math.round(sums.calories * SNACK_SHARE.calories),
    proteinG: Math.round(sums.proteinG * SNACK_SHARE.proteinG),
    carbsG: Math.round(sums.carbsG * SNACK_SHARE.carbsG),
    fatG: Math.round(sums.fatG * SNACK_SHARE.fatG),
  };
  const snackAt = (period: PeakSnackPeriod, clock: number, after: PlannedFuelMeal): PlannedFuelMeal => ({
    ...after,
    id: `peak-snack-${period}`,
    slot: "snack",
    windowLabel: SNACK_LABEL[period],
    time: clockOf(clock),
    name: "Snack",
    ingredients: [],
    ingredientsDetailed: undefined,
    macros: { ...weight },
    prep: [],
    covers: ["protein"],
    smartRead: "",
    isSnack: true,
    optional: false,
    fromFavorite: false,
    favoriteId: undefined,
    personalizationTags: undefined,
  });

  /* The widest gap in each part of the day that has room. */
  const after = new Map<string, PlannedFuelMeal[]>();
  const placed = new Set<PeakSnackPeriod>();
  const gaps = timed.slice(0, -1).map((x, i) => {
    const a = rel(x.at);
    const b = rel(timed[i + 1].at);
    const mid = anchor + a + (b - a) / 2;
    return { meal: x.meal, width: b - a, mid, period: periodOf(mid) };
  });
  for (const period of ["mid-morning", "afternoon"] as const) {
    if (!periods.includes(period)) continue;
    const best = gaps.filter((g) => g.period === period && g.width >= SNACK_MIN_GAP).sort((x, y) => y.width - x.width)[0];
    if (!best) continue;
    after.set(best.meal.id, [...(after.get(best.meal.id) ?? []), snackAt(period, Math.round(best.mid / 5) * 5, best.meal)]);
    placed.add(period);
  }
  /* A wide evening gap between two dinners counts as the evening snack's room too. */
  if (periods.includes("evening")) {
    const eveningGap = gaps.filter((g) => g.period === "evening" && g.width >= SNACK_MIN_GAP).sort((x, y) => y.width - x.width)[0];
    const last = timed[timed.length - 1];
    const sleep = clockMin(sleepTime);
    if (eveningGap) {
      after.set(eveningGap.meal.id, [...(after.get(eveningGap.meal.id) ?? []), snackAt("evening", Math.round(eveningGap.mid / 5) * 5, eveningGap.meal)]);
    } else {
      const lastRel = rel(last.at);
      const limit = sleep !== null ? rel(sleep) - 60 : rel(22 * 60);
      const at = Math.min(lastRel + 120, limit);
      if (at >= lastRel + 75) after.set(last.meal.id, [...(after.get(last.meal.id) ?? []), snackAt("evening", anchor + Math.round(at / 5) * 5, last.meal)]);
    }
  }

  return base.flatMap((m) => [m, ...(after.get(m.id) ?? [])]);
}

/**
 * A day whose target divided by its meals is bigger than this asks too much of
 * each plate — portions stop being food and start being a challenge.
 */
export const BIG_MEAL_CALORIES = 620;

/**
 * A sixth meal for a big day: dropped into the longest gap between meals, with
 * the average meal's shape so it takes a fair share of the day. Returns the
 * plan's own meals unchanged when the day is not that big.
 */
export function withExtraMeal(meals: PlannedFuelMeal[], dayCalories: number): PlannedFuelMeal[] {
  if (meals.length === 0 || meals.length >= 6) return meals;
  if (dayCalories / meals.length <= BIG_MEAL_CALORIES) return meals;

  const minutes = (time: string | null) => {
    const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const timed = meals.map((m, i) => ({ i, at: minutes(m.time) })).filter((x): x is { i: number; at: number } => x.at !== null);
  let after = timed.length > 0 ? timed[timed.length - 1].i : meals.length - 1;
  let widest = 0;
  for (let k = 1; k < timed.length; k += 1) {
    const gap = timed[k].at - timed[k - 1].at;
    if (gap > widest) {
      widest = gap;
      after = timed[k - 1].i;
    }
  }
  const before = meals[after];
  const nextAt = timed.find((x) => x.i > after)?.at ?? null;
  const beforeAt = minutes(before.time);
  const at = beforeAt !== null && nextAt !== null ? Math.round((beforeAt + nextAt) / 2) : beforeAt !== null ? beforeAt + 150 : null;
  const average = meals.reduce(
    (sum, m) => ({ calories: sum.calories + m.macros.calories / meals.length, proteinG: sum.proteinG + m.macros.proteinG / meals.length, carbsG: sum.carbsG + m.macros.carbsG / meals.length, fatG: sum.fatG + m.macros.fatG / meals.length }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const extra: PlannedFuelMeal = {
    ...before,
    id: "peak-extra-meal",
    slot: "snack",
    windowLabel: "Extra Meal",
    time: at !== null ? `${String(Math.floor((at % 1440) / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}` : before.time,
    macros: { calories: Math.round(average.calories), proteinG: Math.round(average.proteinG), carbsG: Math.round(average.carbsG), fatG: Math.round(average.fatG) },
    fromFavorite: false,
  };
  return [...meals.slice(0, after + 1), extra, ...meals.slice(after + 1)];
}

/**
 * Carbs and fat for a day when the caller has no macro targets of its own:
 * fat at 27% of calories, the middle of the national range, and the carbs
 * that are left once protein and fat are counted.
 */
export function defaultDayTargets(plan: DailyFuelPlan): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  const fatG = Math.round((plan.targets.calories * 0.27) / 9);
  const carbsG = Math.max(0, Math.round((plan.targets.calories - plan.targets.proteinG * 4 - fatG * 9) / 4));
  return { calories: plan.targets.calories, proteinG: plan.targets.proteinG, carbsG, fatG };
}

/** An unscaled plate: the engine's own meal, kept as it is. */
const NO_SCALE: PlateScale = { protein: 1, carb: 1, fat: 1 };

/** Day of the year for a YYYY-MM-DD key, for plate rotation. */
export function dayIndexOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor((Date.UTC(y, (m ?? 1) - 1, d ?? 1) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/**
 * Today's meals for the look: every slot the plan holds gets a signature plate
 * for that look when one exists, in the plan's own times, with portions scaled
 * toward the plan's own calories for that meal. On a rest day the plan's
 * pre- and post-workout windows take snack and dinner plates, since there is
 * no session to fuel. The member's favorites are never replaced;
 * a plate the member swapped in wins over the rotation.
 */
export function peakMeals(plan: DailyFuelPlan, options: PeakDayOptions): PeakMeal[] {
  const areas = new Set([...(options.compoundAreas ?? [])].filter(isFitArea));
  const hidden = new Set(options.hidden ?? []);
  const used = new Set<string>();
  const dayIndex = options.dayIndex ?? 0;
  const ratioContext: RatioContext = { compoundLipids: false, labLipidsAbove: [], ...options.ratios, look: options.look };
  /* Each meal gets its share of the DAY's targets, so the plates add up to the day rather than to
     whatever the engine's stock meals happened to weigh. Shares follow the engine's own split. */
  const day = options.dayTargets ?? defaultDayTargets(plan);
  /* The optional pre-session shake is food only and skippable: never a plate, never part of
     the day's shares, and never counted when deciding whether the day needs a sixth meal. */
  const dayMeals = withSnacks(plan.meals, options.snacks ?? DEFAULT_PEAK_SNACKS, options.sleepTime);
  const realMeals = dayMeals.filter((m) => !m.optional);
  /* A big day gets a sixth meal rather than five plates the size of a wheelbarrow. */
  const planMeals = withExtraMeal(realMeals, day.calories);
  const engine = planMeals.reduce(
    (sum, m) => ({ calories: sum.calories + m.macros.calories, proteinG: sum.proteinG + m.macros.proteinG, carbsG: sum.carbsG + m.macros.carbsG, fatG: sum.fatG + m.macros.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const share = (dayTotal: number, mealPart: number, enginePart: number, fallback: number) => (enginePart > 0 ? Math.round((dayTotal * mealPart) / enginePart) : fallback);
  const plated = planMeals.map((meal, i): PeakMeal => {
    const target = {
      calories: share(day.calories, meal.macros.calories, engine.calories, meal.macros.calories),
      proteinG: share(day.proteinG, meal.macros.proteinG, engine.proteinG, meal.macros.proteinG),
      carbsG: share(day.carbsG, meal.macros.carbsG, engine.carbsG, meal.macros.carbsG),
      fatG: share(day.fatG, meal.macros.fatG, engine.fatG, meal.macros.fatG),
    };
    const base = { fruit: fruitFor(meal.slot, plan.isTrainingDay), target, carbNote: carbNote(meal.slot, plan.isTrainingDay) };
    if (meal.fromFavorite) {
      return { ...meal, ...base, signature: false, fits: [], plateId: null, plate: null, scale: NO_SCALE, swapped: [], ratios: [], match: null, recipe: [], purposes: [] };
    }
    const turn = dayIndex + i;
    const plates = platesFor(plateSlotFor(meal.slot, plan.isTrainingDay), options.look, options.prefs ?? null, hidden, turn, ratioContext, options.bowls);
    const chosenId = options.swaps?.[swapKey(meal)];
    /* A meal the member built for this slot is the one they actually eat, so it leads.
       Reserve's own plates fill the slots the member has not built for. */
    const mine = plates.filter((x) => isBowlPlateId(x.sig.id) && !used.has(x.sig.id));
    const pool = mine.length > 0 ? mine : plates;
    const picked =
      (chosenId && plates.find((p) => p.sig.id === chosenId)) ||
      choosePlate(pool, areas, turn, used, (p) => targetMatch(signatureMacros(p.plate, scalesFor(p.plate, target)), target));
    if (!picked) {
      return { ...meal, ...base, signature: false, fits: [], plateId: null, plate: null, scale: NO_SCALE, swapped: [], ratios: [], match: null, recipe: [], purposes: [] };
    }
    used.add(picked.sig.id);
    const firstScale = scalesFor(picked.plate, target);
    /* A lean plate can run short of the fat target whatever its own fats do; one unsaturated fat closes the gap.
       A bowl the member built is left exactly as they built it — Reserve scales it, never adds to it. */
    const filled = isBowlPlateId(picked.sig.id)
      ? { plate: picked.plate, added: null }
      : withFatFiller(picked.plate, signatureMacros(picked.plate, firstScale), target, ratioContext.avoid);
    const served = filled.added ? filled.plate : picked.plate;
    const scale = filled.added ? scalesFor(served, target) : firstScale;
    const macros = signatureMacros(served, scale);
    const ingredientsDetailed = signatureIngredients(served, scale);
    return {
      ...meal,
      ...base,
      name: picked.plate.name,
      ingredients: ingredientsDetailed.map((x) => x.name),
      ingredientsDetailed,
      macros,
      smartRead: picked.sig.smartRead,
      config: "Peak Mode",
      personalizationTags: [],
      signature: true,
      fits: fitsFor(served, areas),
      plateId: picked.sig.id,
      plate: served,
      scale,
      swapped: picked.swapped,
      ratios: ratiosAtScale(served, scale, ratioContext),
      match: targetMatch(macros, target),
      recipe: recipeFor(served),
      purposes: filled.added
        ? [...purposesFor(served).filter((x) => x.item !== filled.added!.food), { item: filled.added.food, why: FAT_FILLER_WHY }]
        : purposesFor(served),
    };
  });
  return withShakesInPlace(dayMeals, plated, plan.isTrainingDay);
}

/**
 * Puts each optional shake back where the schedule placed it, unchanged: its
 * own food-only ingredients and macros, no plate, no swap.
 */
function withShakesInPlace(original: PlannedFuelMeal[], plated: PeakMeal[], isTrainingDay: boolean): PeakMeal[] {
  if (!original.some((m) => m.optional)) return plated;
  const out: PeakMeal[] = [];
  let k = 0;
  for (const meal of original) {
    if (meal.optional) {
      out.push({
        ...meal,
        fruit: fruitFor(meal.slot, isTrainingDay),
        target: { ...meal.macros },
        carbNote: "",
        signature: false,
        fits: [],
        plateId: null,
        plate: null,
        scale: NO_SCALE,
        swapped: [],
        ratios: [],
        match: null,
        recipe: [],
        purposes: [],
      });
      continue;
    }
    /* Everything up to and including this meal (the extra meal rides along where it was placed). */
    while (k < plated.length) {
      const next = plated[k];
      out.push(next);
      k += 1;
      if (next.id === meal.id) break;
    }
  }
  while (k < plated.length) out.push(plated[k++]);
  return out;
}

/** The kind of plate a meal window takes: training windows on a rest day take snack and dinner plates. */
export function plateSlotFor(slot: MealSlot, isTrainingDay: boolean): MealSlot {
  if (isTrainingDay) return slot;
  return slot === "pre-workout" ? "snack" : slot === "post-workout" ? "dinner" : slot;
}

/** Every plate that could take a meal's place, made the member's, with its target match. */
/** Ratio picks re-read at the plate's served portion, so saturated fat matches what is on the plate. */
function ratiosAtScale(plate: PeakSignature, scale: PlateScale, ctx: RatioContext): RatioPick[] {
  return plate.portions.flatMap((p) => {
    if (!("food" in p)) return [];
    const grams = p.fixed ? p.grams : Math.max(5, Math.round((p.grams * scaleOf(scale, p.food)) / 5) * 5);
    const pick = resolveRatio(p.food, grams, ctx);
    return pick ? [pick] : [];
  });
}

export function swapOptions(
  meal: PeakMeal,
  look: PeakLook,
  prefs: PeakKitchenPrefs | null,
  hidden: Iterable<string>,
  compoundAreas: Iterable<string>,
  isTrainingDay = true,
  ratios?: Omit<RatioContext, "look">,
  bowls: readonly PeakSignature[] = [],
) {
  const areas = new Set([...compoundAreas].filter(isFitArea));
  return platesFor(plateSlotFor(meal.slot, isTrainingDay), look, prefs, new Set(hidden), 0, { compoundLipids: false, labLipidsAbove: [], ...ratios, look }, bowls)
    .map((p) => {
      const scale = scalesFor(p.plate, meal.target);
      const macros = signatureMacros(p.plate, scale);
      return { id: p.sig.id, name: p.plate.name, macros, match: targetMatch(macros, meal.target), fits: fitsFor(p.plate, areas), current: p.sig.id === meal.plateId };
    })
    .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name));
}

export function totalsOf(meals: PeakMeal[]) {
  return meals.reduce(
    (sum, m) => ({ calories: sum.calories + m.macros.calories, proteinG: sum.proteinG + m.macros.proteinG, carbsG: sum.carbsG + m.macros.carbsG, fatG: sum.fatG + m.macros.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/* ─── Dry, the right way ────────────────────────────────────────────────── */

export type PeakFact = { title: string; text: string; sources: ProfileSource[] };

export const DRY_THE_RIGHT_WAY: PeakFact[] = [
  {
    title: "Dry is body fat, not water",
    text: "Separation and a hard look come from lower body fat and full muscles. Fluids and sodium held steady day to day keep the look consistent and your readings honest.",
    sources: [SRC.peakWeek],
  },
  {
    title: "No water or sodium cutting",
    text: "Cutting water or sodium, or using diuretics, brings cramps, dizziness, blood pressure swings, kidney strain and dangerous heart rhythm changes. On a cycle, blood pressure and hematocrit are already under watch.",
    sources: [SRC.peakWeek, SRC.endocrine, SRC.acsmFluid],
  },
  {
    title: "The daily total matters most",
    text: "Meal timing helps around hard sessions, but total protein and calories for the day decide most of the result. A missed window is not a lost day.",
    sources: [SRC.issnTiming, SRC.issnProtein],
  },
  {
    title: "Added sugar still counts",
    text: "Honey in a post-workout bowl is a training carb. Across the rest of the day the Dietary Guidelines keep added sugar under 10% of calories, and brown sugar or agave count the same.",
    sources: [SRC.dga],
  },
];

export const PEAK_SOURCES: ProfileSource[] = [SRC.issnTiming, SRC.issnProtein, SRC.dga, SRC.peakWeek];
