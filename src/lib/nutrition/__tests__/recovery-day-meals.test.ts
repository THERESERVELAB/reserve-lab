import { describe, expect, it } from "vitest";

import { buildMealPlan } from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";
import { isTrainingPlannedToday } from "@/lib/training/training-planned";

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY-DAY MEAL WINDOWS — a day that does not train gets no meal that
   fuels a session.

   The bug this guards: `useTodayFuelPlan` passed the raw schedule context
   to `buildMealPlan`. On a plain recovery day nothing has been moved, so
   that context's own `trainingPlanned` is still true, and Nutrition and
   Schedule laid out a pre-workout meal for a session that does not exist.

   The resolved day is `isTrainingPlannedToday(context, today.recovery)` —
   the one rule every surface reads. These tests pin both halves: the
   resolver says a non-moved recovery day does not train, and the meal plan
   built from that answer carries no pre- or post-workout meal.
   ════════════════════════════════════════════════════════════════════════ */

const PROFILE: MemberScheduleProfile = {
  wakeTime: "06:30",
  sleepTarget: "22:30",
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
  trainingWindow: "evening",
  trainingDaysPerWeek: 5,
  mealWindows: [
    { id: "morning-anchor", label: "Morning Anchor", time: "07:00", enabled: true },
    { id: "midday", label: "Midday", time: "12:30", enabled: true },
    { id: "pre-workout", label: "Pre-Workout", time: "16:00", enabled: true },
    { id: "post-workout", label: "Post-Workout", time: "19:30", enabled: true },
  ],
} as MemberScheduleProfile;

describe("a recovery day's meal windows", () => {
  it("the resolver does not plan training on a non-moved recovery day", () => {
    expect(isTrainingPlannedToday({ trainingPlanned: true, direction: "unchanged" }, true)).toBe(false);
  });

  it("still plans training when a session was moved onto a recovery day", () => {
    expect(isTrainingPlannedToday({ trainingPlanned: true, direction: "moved-here" }, true)).toBe(true);
  });

  it("drops the pre-workout meal when today does not train", () => {
    const plan = buildMealPlan(PROFILE, { trainingPlanned: false, direction: "unchanged" });
    expect(plan.some((meal) => meal.id === "pre-workout")).toBe(false);
  });

  it("re-labels the post-workout window as a recovery meal when today does not train", () => {
    const plan = buildMealPlan(PROFILE, { trainingPlanned: false, direction: "unchanged" });
    const post = plan.find((meal) => meal.id === "post-workout");
    expect(post).toBeDefined();
    expect(post!.label).toBe("Recovery Meal");
    /* No workout window is staged, so nothing is timed off one. */
    expect(post!.label).not.toMatch(/post-?workout/i);
  });

  it("keeps the pre-workout meal on a day that does train", () => {
    const plan = buildMealPlan(PROFILE, { trainingPlanned: true, direction: "unchanged" });
    expect(plan.some((meal) => meal.id === "pre-workout")).toBe(true);
  });

  it("is the same plan a recovery day reaches through the resolver", () => {
    /* What useTodayFuelPlan now does: resolve the day, then build from the answer. */
    const trainingPlanned = isTrainingPlannedToday({ trainingPlanned: true, direction: "unchanged" }, true);
    const plan = buildMealPlan(PROFILE, { trainingPlanned, direction: "unchanged" });
    expect(plan.some((meal) => meal.id === "pre-workout")).toBe(false);
  });
});
