/* ════════════════════════════════════════════════════════════════════════
   MY MEAL PLAN → TODAY'S FUEL DAY
   ------------------------------------------------------------------------
   Turns the member's own plan (lib/nutrition/member-meal-plan) into the
   same DailyFuelPlan shape buildDailyFuelPlan returns, so every surface
   that already reads today's fuel — Nutrition, the Apex fuel lane, the
   Schedule hero, meal confirmation, prep — reads the member's plan with no
   changes of its own.

   Two rules make this honest:

   1. Times still come from the schedule engine. A plan meal whose slot has
      a scheduled window takes that window's time and label. A plan with
      more meals than the day has windows (two midday meals is common) has
      the rest spaced between the anchors — never invented past bedtime.

   2. The day's targets are the plan's own totals. Measuring a fixed plan
      against a generated bodyweight estimate would show the member missing
      a number their plan never aimed at.
   ════════════════════════════════════════════════════════════════════════ */

import {
  hhmToMins,
  minsToHHMM,
  type DailyFuelPlan,
  type FuelGoal,
  type FuelMacros,
  type FuelSnack,
  type FuelTargets,
  type MealSlot,
  type MealWindowInput,
  type PlannedFuelMeal,
} from "./fuel-plan";
import {
  estimatePlanMeal,
  planDayTotals,
  planMealsFor,
  WEIGH_IN_LABEL,
  type MemberMealPlan,
  type MemberPlanMeal,
} from "./member-meal-plan";

/** Spacing used only where the schedule has no window to anchor a meal to. */
const FILL_GAP_MIN = 150;
/** The smallest gap between two meals when spacing is tight. */
const MIN_GAP_MIN = 45;
/** Nothing generated lands inside this buffer before the sleep target. */
const SLEEP_BUFFER_MIN = 30;

/* ─── Food coverage ───────────────────────────────────────────────────────
   Which coverage categories the plan's own foods provide. Deterministic
   name matching over the member's items — a food-coverage read, never a
   nutrient claim about the member. */
/* Every term is word-anchored. Unanchored, short words hide inside longer
   ones and coverage lies: "Veggies" contains "egg", so a plate of vegetables
   claimed protein, iron, zinc and vitamin D. A food-coverage read that
   invents nutrients is worse than none, so terms match at a word boundary
   and only stems that are genuinely prefixes (berr-, strawberr-) stay open
   at the end. */
const COVERAGE_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: "protein", re: /\b(eggs?|egg whites?|beef|turkey|chicken|steak|fish|salmon|tuna|shrimp|whey|isolate|yogurt|cottage|tofu|eaas?|amino)\b/i },
  { key: "iron", re: /\b(beef|steak|turkey|eggs?|egg whites?|spinach|beans?|lentils?)\b/i },
  { key: "zinc", re: /\b(beef|steak|turkey|eggs?|egg whites?|pumpkin seeds?|chickpeas?)\b/i },
  { key: "vitamin-d", re: /\b(salmon|trout|eggs?|egg whites?|fortified)\b/i },
  { key: "omega-3", re: /\b(salmon|trout|sardines?|mackerel|chia|flax|fish oil)\b/i },
  { key: "potassium", re: /\b(potato(es)?|banana|avocado|beans?|yogurt)\b/i },
  { key: "magnesium", re: /\b(spinach|pumpkin seeds?|almonds?|nut butter|black beans?|dark chocolate)\b/i },
  { key: "calcium", re: /\b(yogurt|cottage|milk|cheese|fortified)\b/i },
  { key: "vitamin-c", re: /\b(orange|kiwi|strawberr|bell pepper|citrus|lemon|lime|broccoli)/i },
  { key: "fiber", re: /\b(beans?|berr|oats?|broccoli|whole grain|lentils?|veg|veggies|vegetables?)/i },
  { key: "folate", re: /\b(spinach|romaine|asparagus|broccoli|avocado|greens)\b/i },
  { key: "fruit-veg", re: /\b(veg|veggies|vegetables?|berr|banana|apple|broccoli|spinach|asparagus|green beans?|tomato|pepper|fruit)/i },
];

export function coverageKeysForItems(names: readonly string[]): string[] {
  const joined = names.join(" · ");
  return COVERAGE_PATTERNS.filter((p) => p.re.test(joined)).map((p) => p.key);
}

/* ─── Times ───────────────────────────────────────────────────────────────── */

type Anchor = { index: number; mins: number; label: string };

/**
 * Give every plan meal a time.
 *
 * Anchored meals take a scheduled window of the same slot, first come first
 * served in the member's own meal order. Everything else is spaced: evenly
 * between two anchors, or a fixed step outside them. The result is always
 * strictly increasing.
 */
export function assignPlanTimes(
  meals: readonly MemberPlanMeal[],
  windows: readonly MealWindowInput[],
  opts: { wakeTime?: string; sleepTarget?: string } = {},
): Array<{ mins: number; windowLabel: string }> {
  const usable = windows
    .filter((w) => w.enabled && hhmToMins(w.time) !== null)
    .map((w) => ({ ...w, mins: hhmToMins(w.time) as number }))
    .sort((a, b) => a.mins - b.mins);

  const claimed = new Set<string>();
  const anchors: Anchor[] = [];
  meals.forEach((meal, index) => {
    const hit = usable.find((w) => !claimed.has(w.id) && (w.slot ?? w.id) === meal.slot);
    if (hit) {
      claimed.add(hit.id);
      anchors.push({ index, mins: hit.mins, label: hit.label });
    }
  });
  /* A later window must not sit before an earlier one once slots are claimed
     out of order (a plan whose dinner precedes its post-workout, say). */
  anchors.sort((a, b) => a.index - b.index);

  const wake = hhmToMins(opts.wakeTime) ?? 7 * 60;
  const sleep = hhmToMins(opts.sleepTarget);
  const latest = sleep === null ? null : (sleep <= wake ? sleep + 1440 : sleep) - SLEEP_BUFFER_MIN;

  const out: Array<{ mins: number; windowLabel: string }> = meals.map(() => ({ mins: 0, windowLabel: "" }));
  for (const a of anchors) out[a.index] = { mins: a.mins, windowLabel: a.label };

  if (anchors.length === 0) {
    /* No windows at all: start an hour after waking and step through the plan. */
    meals.forEach((_, i) => { out[i] = { mins: wake + 60 + i * FILL_GAP_MIN, windowLabel: "" }; });
  } else {
    /* Before the first anchor: spread evenly between waking and it.
       Stepping back a fixed gap instead ran negative once three meals sat
       ahead of an early window, and minsToHHMM wraps a negative into the
       previous evening — the day's FIRST meal rendering at 10:45 PM. Flooring
       the subtraction at wake fixes that but lets a squeezed meal overrun the
       anchor and shove it off its schedule window. Dividing the span does
       neither: nothing lands before the member is up, and the anchor holds. */
    const firstAnchor = anchors[0];
    if (firstAnchor.index > 0) {
      const span = Math.max(0, firstAnchor.mins - wake);
      const step = span / (firstAnchor.index + 1);
      for (let i = 0; i < firstAnchor.index; i += 1) out[i] = { mins: Math.round(wake + step * (i + 1)), windowLabel: "" };
    }
    /* Between anchors. */
    for (let a = 0; a < anchors.length - 1; a += 1) {
      const from = anchors[a];
      const to = anchors[a + 1];
      const gapCount = to.index - from.index;
      if (gapCount <= 1) continue;
      const step = (to.mins - from.mins) / gapCount;
      for (let k = 1; k < gapCount; k += 1) out[from.index + k] = { mins: Math.round(from.mins + step * k), windowLabel: "" };
    }
    /* After the last anchor. */
    const last = anchors[anchors.length - 1];
    for (let i = last.index + 1; i < meals.length; i += 1) out[i] = { mins: out[i - 1].mins + FILL_GAP_MIN, windowLabel: "" };
  }

  /* Never past bedtime. The ceiling only steps down by a gap when a meal was
     actually pulled back — otherwise the pass imposed MIN_GAP spacing on the
     whole day, working backwards from the last meal, and dragged the morning
     before the member had woken up. A meal already clear of bedtime leaves
     the day below it alone. */
  if (latest !== null) {
    let ceiling = latest;
    for (let i = meals.length - 1; i >= 0; i -= 1) {
      if (out[i].mins > ceiling) {
        out[i] = { ...out[i], mins: Math.max(wake, ceiling) };
        ceiling = out[i].mins - MIN_GAP_MIN;
      } else {
        ceiling = out[i].mins;
      }
    }
  }
  /* Always moving forward. */
  for (let i = 1; i < meals.length; i += 1) {
    if (out[i].mins <= out[i - 1].mins) out[i] = { ...out[i], mins: out[i - 1].mins + MIN_GAP_MIN };
  }

  return out;
}

/* ─── The day ─────────────────────────────────────────────────────────────── */

export type MemberPlanDayInput = {
  plan: MemberMealPlan;
  goal: FuelGoal;
  isTrainingDay: boolean;
  sessionName: string;
  mealWindows: MealWindowInput[];
  wakeTime?: string;
  sleepTarget?: string;
};

/** A plan's day carries no generated snack. The member's plan is the day. */
const NO_SNACK: FuelSnack = {
  name: "Your plan sets the day",
  kind: "protein",
  ingredients: [],
  macros: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  smartRead: "Your own plan is running, so Reserve is not adding meals to it.",
};

export function planTargets(totals: FuelMacros, plan: MemberMealPlan): FuelTargets {
  return {
    proteinG: Math.round(totals.proteinG),
    calories: Math.round(totals.calories),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    estimated: true,
    basis: "member-plan",
    note: `Your plan's own totals — "${plan.name}", ${WEIGH_IN_LABEL[plan.weighIn].toLowerCase()}. Macros are estimated from the amounts you entered.`,
  };
}

export function planMealToFuelMeal(
  meal: MemberPlanMeal,
  time: { mins: number; windowLabel: string },
  planName: string,
): PlannedFuelMeal {
  const est = estimatePlanMeal(meal);
  const ingredients = meal.items.map((i) => (i.display ? `${i.display} ${i.name}` : i.name));
  const unpriced = [...est.unmatched, ...est.uncounted];
  const smartRead = [
    meal.note,
    `From your plan, ${planName}.`,
    unpriced.length > 0 ? `No macro estimate for ${unpriced.join(", ")} — the rest of the meal is counted.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `plan-${meal.id}`,
    slot: meal.slot,
    windowLabel: time.windowLabel || meal.name,
    time: minsToHHMM(time.mins),
    name: meal.name,
    ingredients,
    ingredientsDetailed: meal.items.map((i) => ({ name: i.name, amount: i.display, group: i.group })),
    macros: est.macros,
    prep: [],
    covers: coverageKeysForItems(meal.items.map((i) => i.name)),
    smartRead,
    /* mealWindowMissed() exempts only isSnack, so a meal the member marked
       optional carries it too — otherwise their intra-workout shake reads as
       a missed meal the moment the session passes, and counts against the
       day's meal total. buildDailyFuelPlan pairs the same two fields on its
       own optional shake slot for exactly this reason. */
    isSnack: Boolean(meal.optional),
    optional: meal.optional,
  };
}

export function buildMemberPlanDay(input: MemberPlanDayInput): DailyFuelPlan {
  const { plan, goal, isTrainingDay, sessionName, mealWindows } = input;
  const meals = planMealsFor(plan, isTrainingDay);
  const times = assignPlanTimes(meals, mealWindows, { wakeTime: input.wakeTime, sleepTarget: input.sleepTarget });
  const planned = meals.map((m, i) => planMealToFuelMeal(m, times[i], plan.name));
  const totals = planDayTotals(meals);

  const dayLabel = isTrainingDay ? "training day" : "rest day";
  return {
    goal,
    isTrainingDay,
    sessionName,
    targets: planTargets(totals, plan),
    meals: planned,
    snack: NO_SNACK,
    summary: `${plan.name} — your ${dayLabel} set, ${planned.length} ${planned.length === 1 ? "meal" : "meals"}.`,
  };
}

/** Every slot the plan uses on a day — what the schedule needs windows for. */
export function planSlotsUsed(plan: MemberMealPlan, isTrainingDay: boolean): MealSlot[] {
  return [...new Set(planMealsFor(plan, isTrainingDay).map((m) => m.slot))];
}
