/* The owner's saved nutrition profile, as a test seed — typos and all — plus a
   14-day variety count shared by the rotation tests. Not a test file itself. */

import { buildDailyFuelPlan, type DailyFuelPlan, type MealPersonalization } from "../fuel-plan";
import { matchFood } from "../food-matcher";
import { PEAK_LOOKS } from "../peak-mode";
import { fuelWindowsFromPlan } from "../scheduled-fuel-windows";
import { deriveMealWindows } from "@/lib/schedule/derive";
import { buildMealPlan } from "@/lib/schedule/engine";
import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";

export const OWNER_PERSONALIZATION: MealPersonalization = {
  dietStyle: "high-protein",
  prepPreference: "batch",
  dairyAllowed: true,
  allergies: ["shell fish"],
  dislikedFoods: [],
  favoriteProteinSources: [
    "gress fed ribeye",
    "ground beef (grass-fed)",
    "thilapia",
    "tuna",
    "chicken breast",
    "NY steak (grass-fed)",
    "pasture-raised eggs",
    "lean ground chicken",
  ],
  favoriteCarbSources: ["jasmine rice", "gold russet potatoes"],
  cookingEquipment: ["stovetop", "oven", "microwave"],
  /* Peak Mode is on (look "lean-hard"), so its kitchen answers apply. */
  kitchen: {
    proteins: ["chicken", "turkey", "ground-beef", "sirloin", "tilapia", "white-fish", "salmon"],
    carbs: ["basmati-rice", "gold-potato", "protein-pasta", "rice", "sweet-potato"],
    avoid: ["shellfish", "pork", "soy", "nuts", "gluten"],
  },
};

export const OWNER_FAVOURITE_IDS = ["ribeye", "ground-beef", "tilapia", "tuna", "chicken-breast", "strip", "eggs", "ground-chicken"];

const BASE = { wakeTime: "05:30", sleepTarget: "22:00", trainingWindow: "evening" as const, preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
export const OWNER_SCHEDULE: MemberScheduleProfile = { ...DEFAULT_SCHEDULE_PROFILE, ...BASE, mealWindows: deriveMealWindows(BASE) };

/** Mon–Sun, starting on a Monday: five training days, Thursday and Sunday off. */
export const OWNER_WEEK = [true, true, true, false, true, true, false];
export const START = "2026-09-14"; // a Monday

export function dateAfter(start: string, days: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function ownerDay(
  day: number,
  opts: { date?: string | null; personalization?: MealPersonalization; schedule?: MemberScheduleProfile; loggedMealIds?: string[] } = {},
): DailyFuelPlan {
  const training = OWNER_WEEK[day % 7];
  const schedule = opts.schedule ?? OWNER_SCHEDULE;
  return buildDailyFuelPlan({
    goal: PEAK_LOOKS["lean-hard"].goal,
    isTrainingDay: training,
    sessionName: training ? "Push" : "Recovery Day",
    mealWindows: fuelWindowsFromPlan(buildMealPlan(schedule, { trainingPlanned: training, direction: "unchanged" })),
    bodyweightLb: 205,
    personalization: opts.personalization ?? OWNER_PERSONALIZATION,
    sleepTarget: schedule.sleepTarget,
    wakeTime: schedule.wakeTime,
    date: opts.date === null ? undefined : (opts.date ?? dateAfter(START, day)),
    loggedMealIds: opts.loggedMealIds,
  });
}

/** Plated meals only: no smart snack, no optional shake, no favourite. */
export const platedMeals = (plan: DailyFuelPlan) => plan.meals.filter((m) => !m.isSnack && !m.fromFavorite);

/** The main protein of a meal: the plate id's protein, else the first ingredient matched. */
export function mainProtein(meal: DailyFuelPlan["meals"][number]): string {
  const plate = /plate\.([a-z-]+)\./.exec(meal.id);
  if (plate) return plate[1];
  return matchFood(meal.ingredients[0] ?? "", "protein")?.id ?? meal.name;
}

export type VarietyCount = {
  days: number;
  meals: number;
  distinctDishes: number;
  /** Most times one dish appears in the span. */
  maxSameDish: number;
  /** Days on which a main protein appears twice. */
  daysWithRepeatedProtein: number;
  /** Times a dish reappears within three days of an earlier appearance. */
  dishRepeatsWithin3Days: number;
  proteinCounts: Record<string, number>;
  dishCounts: Record<string, number>;
};

export function countVariety(plans: DailyFuelPlan[]): VarietyCount {
  const dishCounts: Record<string, number> = {};
  const proteinCounts: Record<string, number> = {};
  let daysWithRepeatedProtein = 0;
  let dishRepeatsWithin3Days = 0;
  const lastSeen = new Map<string, number>();
  let meals = 0;
  plans.forEach((plan, day) => {
    const plated = platedMeals(plan);
    meals += plated.length;
    const proteins = plated.map(mainProtein);
    if (new Set(proteins).size < proteins.length) daysWithRepeatedProtein += 1;
    for (const p of proteins) proteinCounts[p] = (proteinCounts[p] ?? 0) + 1;
    for (const m of plated) {
      dishCounts[m.name] = (dishCounts[m.name] ?? 0) + 1;
      const seen = lastSeen.get(m.name);
      if (seen !== undefined && day - seen <= 3 && day !== seen) dishRepeatsWithin3Days += 1;
      lastSeen.set(m.name, day);
    }
  });
  return {
    days: plans.length,
    meals,
    distinctDishes: Object.keys(dishCounts).length,
    maxSameDish: Math.max(0, ...Object.values(dishCounts)),
    daysWithRepeatedProtein,
    dishRepeatsWithin3Days,
    proteinCounts,
    dishCounts,
  };
}
