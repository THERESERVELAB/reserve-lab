import { describe, expect, it } from "vitest";

import { buildDailyFuelPlan } from "@/lib/nutrition/fuel-plan";
import { OWN_LOG_LINE, PRE_WORKOUT_SHAKES, buildPreWorkoutShake } from "@/lib/nutrition/pre-workout-shake";
import { resolveNutritionPrimaryAction } from "@/lib/nutrition/primary-action";
import { fuelWindowsFromPlan } from "@/lib/nutrition/scheduled-fuel-windows";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { buildMealPlan } from "@/lib/schedule/engine";
import { resolveSchedulePrimaryAction } from "@/lib/schedule/primary-action";
import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";

/* ════════════════════════════════════════════════════════════════════════
   THE PRE-WORKOUT SHAKE SLOT IS FOOD ONLY

   CLAUDE.md forbids supplement recommendations and any amount or timing for
   a supplement. The slot is kitchen food; the only word about supplements is
   the neutral line that what the member already logs is their own call.
   ════════════════════════════════════════════════════════════════════════ */

const SUPPLEMENT_WORDS = /creatine|citrulline|arginine|nitrate|beta-?alanine|caffeine|powder|scoop|capsule|pill|tablet|pre-?workout (?:mix|formula|blend)|electrolyte|bcaa|eaa|supplement(?!\s+logbook)/i;

function shakeText(style: "fasted" | "light") {
  const shake = buildPreWorkoutShake(style);
  return [shake.name, shake.smartRead, ...shake.ingredients, ...shake.ingredientsDetailed.map((i) => `${i.amount} ${i.name} ${i.note ?? ""}`)].join(" \n ");
}

describe("the pre-workout shake slot", () => {
  it("names no supplement, powder or product — every ingredient is food", () => {
    for (const shake of PRE_WORKOUT_SHAKES) {
      const text = [shake.name, ...shake.ingredients, ...shake.ingredientsDetailed.map((i) => `${i.name} ${i.note ?? ""}`)].join(" ");
      expect(text, shake.id).not.toMatch(SUPPLEMENT_WORDS);
    }
  });

  it("passes the banned-language suite", () => {
    for (const style of ["fasted", "light"] as const) expect(bannedLanguageIn(shakeText(style))).toEqual([]);
    expect(bannedLanguageIn(OWN_LOG_LINE)).toEqual([]);
  });

  it("mentions the member's own log only neutrally: no suggestion, amount or timing", () => {
    expect(OWN_LOG_LINE).toMatch(/your own call/i);
    expect(OWN_LOG_LINE).not.toMatch(/\d|before|after|minutes?|hours?|try|consider|add (?:a|some)/i);
  });

  it("keeps a fasted slot free of sugar or fruit; honey or fruit only when the member chose light", () => {
    expect(shakeText("fasted")).not.toMatch(/honey|banana|fruit juice|coconut|beet/i);
    expect(buildPreWorkoutShake("fasted").macros.calories).toBeLessThanOrEqual(10);
    expect(shakeText("light")).toMatch(/honey|banana/i);
  });

  it("honours foods the member avoids", () => {
    expect(buildPreWorkoutShake("light", { allergies: ["coconut"] }).ingredients.join(" ")).not.toMatch(/coconut/i);
    expect(buildPreWorkoutShake("light", { dislikedFoods: ["beet"] }).id).toBe("salted-citrus-water");
  });
});

const EARLY: MemberScheduleProfile = {
  ...DEFAULT_SCHEDULE_PROFILE,
  wakeTime: "04:45",
  sleepTarget: "21:30",
  trainingWindow: "morning",
  preferredTrainingStart: "05:15",
  preferredTrainingEnd: "08:15",
};

function planFor(p: MemberScheduleProfile) {
  return buildDailyFuelPlan({
    goal: "maintenance",
    isTrainingDay: true,
    sessionName: "Push",
    mealWindows: fuelWindowsFromPlan(buildMealPlan(p, { trainingPlanned: true, direction: "unchanged" })),
    bodyweightLb: 190,
    sleepTarget: p.sleepTarget,
    wakeTime: p.wakeTime,
  });
}

describe("the shake inside today's fuel plan", () => {
  const plan = planFor(EARLY);
  const shake = plan.meals.find((m) => m.time === "05:00")!;

  it("is the food-only shake, optional, never a plate or a favorite", () => {
    expect(shake.name).toBe("Salted Citrus Water");
    expect(shake.windowLabel).toBe("Optional Pre-Workout Shake");
    expect(shake.optional).toBe(true);
    expect(shake.isSnack).toBe(true);
    expect(shake.fromFavorite).toBeUndefined();
  });

  it("the member's favorite breakfast lands at meal #1, not before training", () => {
    const withFavorite = buildDailyFuelPlan({
      goal: "maintenance",
      isTrainingDay: true,
      sessionName: "Push",
      mealWindows: fuelWindowsFromPlan(buildMealPlan(EARLY, { trainingPlanned: true, direction: "unchanged" })),
      bodyweightLb: 190,
      favorites: [{ id: "sig", name: "Sniper Breakfast Build", slot: "breakfast", macros: { calories: 700, proteinG: 50, carbsG: 70, fatG: 20 } }],
      sleepTarget: EARLY.sleepTarget,
      wakeTime: EARLY.wakeTime,
    });
    expect(withFavorite.meals.find((m) => m.name === "Sniper Breakfast Build")?.time).toBe("09:00");
  });

  it("is never the gold action: before the session the next meal is the post-workout breakfast", () => {
    const now = new Date(2026, 8, 15, 4, 58);
    const nutrition = resolveNutritionPrimaryAction({ now, schedule: EARLY, meals: plan.meals, loggedMealIds: [], hydration: { todayOz: 0, targetOz: 100 } });
    expect(nutrition.title).toBe("Next · Meal 1 · Post-Workout Breakfast at 9:00 AM");
  });

  it("Nutrition and Schedule name the same meal when meal #1 is due at home", () => {
    const now = new Date(2026, 8, 15, 8, 50);
    const nutrition = resolveNutritionPrimaryAction({ now, schedule: EARLY, meals: plan.meals, loggedMealIds: [], hydration: { todayOz: 0, targetOz: 100 } });
    const schedule = resolveSchedulePrimaryAction({
      now,
      schedule: EARLY,
      scheduleSet: true,
      trainingPlanned: true,
      direction: "unchanged",
      sessionLabel: "Push",
      sessionMode: "complete",
      meals: plan.meals,
      loggedMealIds: [],
      sleepLoggedToday: true,
      sleepConflict: "none",
      hydration: { todayOz: 0, targetOz: 100 },
    });
    expect(nutrition.title).toBe("Meal 1 · Post-Workout Breakfast is due · 9:00 AM");
    expect(schedule.title).toBe(nutrition.title);
  });

  it("keeps meals running until the evening: the last one is dinner at 7:30 PM", () => {
    const last = plan.meals.at(-1)!;
    expect(last.time).toBe("19:30");
    expect(last.slot).toBe("dinner");
  });
});
