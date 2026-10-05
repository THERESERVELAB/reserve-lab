/* ════════════════════════════════════════════════════════════════════════
   NUTRITION PRIMARY ACTION — the one gold action on the Nutrition screen.

   Picks the one next thing, from the fuel plan's timed meals, what the member
   has logged, and the clock:

     1. a meal whose window is open now → log it
     2. water behind the day's pace     → log water
     3. the next meal window            → log it
     4. a meal whose window passed      → log it, only if eaten
     5. everything logged               → water, or review the log

   The rules the button keeps:
     - A meal is never logged by the button. It opens the meal confirmation,
       where nothing counts until the member confirms.
     - Every amount the button records is printed in its label ("Log 16 oz
       Water"). The label says exactly what the button does.
     - With nothing logged today it leads with the first real log, and offers
       water as a quieter second.

   Food and water logging only. No supplement, dosage or clinical language.
   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { MemberScheduleProfile } from "@/lib/schedule/types";

import { formatTime12, minutesToTime } from "@/lib/schedule/engine";
import type { PlannedFuelMeal } from "./fuel-plan";
import { fuelDayClock, timedFuelMeals } from "./fuel-horizon";

/** The amount a water log records. It is printed in the action's label. */
export const NUTRITION_WATER_OZ = 16;

/** A meal counts as "open now" from 20 minutes before its time until 2 hours after it. */
export const MEAL_WINDOW = { opensBeforeMin: 20, staysOpenMin: 120 } as const;

export type NutritionPrimaryAction =
  /** Opens the meal confirmation for this meal. Never logs on its own. */
  | { kind: "open-meal-log"; label: string; mealId: string }
  | { kind: "log-water"; label: string; oz: number }
  /** Brings today's fuel log on this screen into view. */
  | { kind: "review-fuel-log"; label: string }
  | { kind: "open-schedule"; label: string };

export type NutritionPrimaryPlan = {
  /** One line naming the move, e.g. "Pre-Workout Meal is due · 4:00 PM". */
  title: string;
  /** Why now, from the member's own plan and logs. */
  reason: string;
  primary: NutritionPrimaryAction;
  /** A second, quieter action. Only offered with nothing logged today, or with no meal windows. */
  secondary: NutritionPrimaryAction | null;
};

export type NutritionPrimaryInput = {
  now: Date;
  schedule: Pick<MemberScheduleProfile, "wakeTime" | "sleepTarget">;
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "windowLabel" | "name" | "time" | "optional">>;
  loggedMealIds: readonly string[];
  /** Water logged today and the day's target, from the member's hydration log. */
  hydration: { todayOz: number; targetOz: number };
};

const logWater: NutritionPrimaryAction = {
  kind: "log-water",
  label: `Log ${NUTRITION_WATER_OZ} oz Water`,
  oz: NUTRITION_WATER_OZ,
};
const reviewLog: NutritionPrimaryAction = { kind: "review-fuel-log", label: "Review Today's Fuel Log" };

/** Water is behind the day's pace: the share of waking hours gone, against the target. */
export function hydrationBehindPace(input: { todayOz: number; targetOz: number; nowMin: number; wakeMin: number; sleepMin: number }): boolean {
  const { todayOz, targetOz, nowMin, wakeMin, sleepMin } = input;
  if (!(targetOz > 0) || todayOz >= targetOz) return false;
  const awake = sleepMin - wakeMin;
  if (awake <= 0) return false;
  const elapsed = Math.min(1, Math.max(0, (nowMin - wakeMin) / awake));
  return todayOz < targetOz * elapsed * 0.85;
}

export function resolveNutritionPrimaryAction(input: NutritionPrimaryInput): NutritionPrimaryPlan {
  const { wakeMin, sleepMin, dayMin, nowMin } = fuelDayClock(input.now, input.schedule);
  /* The optional pre-workout shake is on the day, but never the gold action or a counted meal. */
  const meals = timedFuelMeals(input.meals, input.loggedMealIds, dayMin).filter((meal) => !meal.optional);
  const { todayOz, targetOz } = input.hydration;
  const loggedCount = meals.filter((meal) => meal.logged).length;
  const nothingLogged = loggedCount === 0 && todayOz <= 0;
  const fmt = (min: number) => formatTime12(minutesToTime(min));

  /* ── No meal windows today: water is the first real log; the schedule sets the windows. ── */
  if (meals.length === 0) {
    return {
      title: "No meal windows set for today",
      reason: "Meal windows come from your schedule. Water logs count in the meantime.",
      primary: logWater,
      secondary: { kind: "open-schedule", label: "Set Meal Windows" },
    };
  }

  const openMeal = (meal: (typeof meals)[number], ifEaten = false): NutritionPrimaryAction => ({
    kind: "open-meal-log",
    label: ifEaten ? `Log ${meal.label} If Eaten` : `Log ${meal.label}`,
    mealId: meal.id,
  });
  /* With nothing logged, the plan leads with the first log and offers water as a second. */
  const withStart = (plan: NutritionPrimaryPlan): NutritionPrimaryPlan =>
    nothingLogged && plan.primary.kind === "open-meal-log"
      ? { ...plan, reason: `${plan.reason} Nothing is logged today yet.`, secondary: logWater }
      : plan;

  const pending = meals.filter((meal) => !meal.logged);
  const confirmFirst = "Nothing counts until you confirm it.";

  /* ── Before wake: the day's first window is next. ── */
  if (nowMin < wakeMin) {
    const first = pending[0];
    if (first) {
      return withStart({
        title: `${first.label} · ${first.timeLabel}`,
        reason: `No fuel window opens before your ${fmt(wakeMin)} wake. ${confirmFirst}`,
        primary: openMeal(first),
        secondary: null,
      });
    }
    return { title: "Today's fuel log is complete", reason: "Every planned meal is logged.", primary: reviewLog, secondary: null };
  }

  /* ── After sleep lock: close the log honestly, never chase the day. ── */
  if (nowMin >= sleepMin) {
    const last = pending[pending.length - 1];
    if (last) {
      return withStart({
        title: "Close today's fuel log",
        reason: `Sleep lock was ${fmt(sleepMin)}. Log ${last.label} only if you ate it. ${confirmFirst}`,
        primary: openMeal(last, true),
        secondary: null,
      });
    }
    return {
      title: "Today's fuel log is complete",
      reason: `Every planned meal is logged. Sleep lock was ${fmt(sleepMin)}.`,
      primary: reviewLog,
      secondary: null,
    };
  }

  /* 1 ── A window open now: the most recent one that has opened and not yet gone stale. */
  const open = [...pending]
    .reverse()
    .find((meal) => meal.startMin <= nowMin + MEAL_WINDOW.opensBeforeMin && nowMin - meal.startMin <= MEAL_WINDOW.staysOpenMin);
  if (open) {
    return withStart({
      title: `${open.label} is due · ${open.timeLabel}`,
      reason: `${open.name} is planned for ${open.timeLabel}. ${confirmFirst}`,
      primary: openMeal(open),
      secondary: null,
    });
  }

  /* 2 ── Water behind the day's pace. Only once something is logged, so the figure is real. */
  if (!nothingLogged && hydrationBehindPace({ todayOz, targetOz, nowMin, wakeMin, sleepMin })) {
    return {
      title: "Water is behind today's pace",
      reason: `${todayOz} of ${targetOz} oz logged today.`,
      primary: logWater,
      secondary: null,
    };
  }

  /* 3 ── The next window ahead. */
  const next = pending.find((meal) => meal.startMin > nowMin);
  if (next) {
    return withStart({
      title: `Next · ${next.label} at ${next.timeLabel}`,
      reason: `${loggedCount} of ${meals.length} planned meals logged today. ${confirmFirst}`,
      primary: openMeal(next),
      secondary: null,
    });
  }

  /* 4 ── Only passed windows remain: log one only if it was eaten. */
  const missed = pending[pending.length - 1];
  if (missed) {
    return withStart({
      title: `${missed.label} was planned for ${missed.timeLabel}`,
      reason: `Log it only if you ate it. ${confirmFirst}`,
      primary: openMeal(missed, true),
      secondary: null,
    });
  }

  /* 5 ── Everything logged. */
  if (targetOz > 0 && todayOz < targetOz) {
    return {
      title: "Every planned meal is logged",
      reason: `${todayOz} of ${targetOz} oz of water logged today.`,
      primary: logWater,
      secondary: null,
    };
  }
  return { title: "Today's fuel log is complete", reason: "Every planned meal and the day's water are logged.", primary: reviewLog, secondary: null };
}
