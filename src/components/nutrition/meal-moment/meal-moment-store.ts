"use client";

import { cssAttr, stageLogMoment, type LogMomentTargets } from "@/components/ui/reserve/log-moment/log-moment-store";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { SLOT_LABEL, type MealSlot, type PlannedFuelMeal } from "@/lib/nutrition/fuel-plan";
import { mealLogMilestone, resolveMealMoment, type MealMoment, type MealMomentMeal } from "@/lib/nutrition/meal-moment";
import { figure } from "@/lib/ui/log-moment";

/* ════════════════════════════════════════════════════════════════════════
   MEAL MOMENT — a logged or cleared meal, staged on the shell's log moment.

   Every Nutrition control that logs or clears a meal goes through
   `recordMealChange`: the store write runs first and untouched, then the
   before/after of today's logged meals becomes a moment
   (src/lib/nutrition/meal-moment.ts), played by the one LogMomentHost the
   shell mounts (src/components/ui/reserve/log-moment).

   The moment waits while the meal confirmation still covers the room (it
   stays open on its Live Fuel Brief after Confirm), then lands on the row
   and the hero's protein dial, where the four macro dials count up.
   ════════════════════════════════════════════════════════════════════════ */

/** The meal named as its row names it: "Lunch", "Pre-Workout Meal". */
function momentLabel(slot: MealSlot): string {
  return slot === "pre-workout" || slot === "post-workout" ? `${SLOT_LABEL[slot]} Meal` : SLOT_LABEL[slot];
}

/** Today's planned meals in the shape the moment reads. */
export function momentMeals(meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "slot" | "macros">>): MealMomentMeal[] {
  return meals.map((meal) => ({ id: meal.id, label: momentLabel(meal.slot), proteinG: meal.macros.proteinG, calories: meal.macros.calories }));
}

/**
 * Run a member's meal log or clear, then stage its moment. The write always
 * happens exactly as before; the moment is only ever an acknowledgement of it.
 */
export function recordMealChange(input: {
  meals: MealMomentMeal[];
  proteinTargetG: number;
  write: () => void;
  /** Where the moment lands outside Nutrition (Apex lands it on its Fuel dial). */
  targets?: Partial<LogMomentTargets>;
}): void {
  const before = useAthleteDashboardStore.getState().nutritionPrefs.loggedMealIds;
  input.write();
  const after = useAthleteDashboardStore.getState().nutritionPrefs.loggedMealIds;
  let moment: MealMoment | null = null;
  try {
    moment = resolveMealMoment({ meals: input.meals, before, after, proteinTargetG: input.proteinTargetG });
  } catch {
    /* An acknowledgement must never break the log that raised it. */
    return;
  }
  if (!moment) return;
  stageMealMoment(moment, input.targets);
}

/** Where a meal moment presses, sweeps and lands. */
export const MEAL_MOMENT_TARGETS = (mealId: string) => ({
  source: `[data-meal-row="${cssAttr(mealId)}"]`,
  control: '[data-fuel="log-meal"]',
  fallbackSource: '[data-nutrition="primary-action"]',
  /* The protein dial's face: on screen even before the first log, when its numeral waits hidden. */
  readout: '[data-nutrition="protein"] [data-ring-face]',
  guard: '[data-fuel="log-meal"] button, [data-nutrition="primary-action"] button',
});

function stageMealMoment(moment: MealMoment, targets?: Partial<LogMomentTargets>): void {
  stageLogMoment({
    kind: "meal",
    tier: "full",
    tone: moment.tone,
    key: `meal:${moment.mealId}`,
    lead: moment.lead,
    detail: [`${moment.loggedCount} of ${moment.total} · est. `, figure(moment.proteinAfter, 0, moment.proteinBefore), " g protein today"],
    milestone: mealLogMilestone(moment.tone === "log" ? moment.milestone : null),
    targets: { ...MEAL_MOMENT_TARGETS(moment.mealId), ...targets },
    legacy: "meal",
  });
}
