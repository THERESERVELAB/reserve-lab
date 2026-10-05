import { describe, expect, it } from "vitest";

import {
  NUTRITION_WATER_OZ,
  hydrationBehindPace,
  resolveNutritionPrimaryAction,
  type NutritionPrimaryAction,
  type NutritionPrimaryInput,
} from "../primary-action";

const SCHEDULE = { wakeTime: "06:30", sleepTarget: "22:30" };

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

const MEALS: NutritionPrimaryInput["meals"] = [
  { id: "breakfast", windowLabel: "Morning Protein Anchor", name: "Eggs + oats", time: "07:00" },
  { id: "lunch", windowLabel: "Midday Meal", name: "Chicken rice bowl", time: "12:30" },
  { id: "pre", windowLabel: "Pre-Workout Meal", name: "Rice + turkey", time: "16:00" },
  { id: "post", windowLabel: "Post-Workout Meal", name: "Salmon + potatoes", time: "19:15" },
];

function input(over: Partial<NutritionPrimaryInput> = {}): NutritionPrimaryInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    meals: MEALS,
    loggedMealIds: ["breakfast", "lunch"],
    hydration: { todayOz: 64, targetOz: 120 },
    ...over,
  };
}

/** Every amount an action records must be printed in its label. */
function expectHonestLabel(action: NutritionPrimaryAction) {
  expect(action.label.trim()).not.toBe("");
  if (action.kind === "log-water") expect(action.label).toContain(`${action.oz} oz`);
}

describe("resolveNutritionPrimaryAction", () => {
  it("opens the meal confirmation for the window open now, and never logs it", () => {
    const plan = resolveNutritionPrimaryAction(input());
    expect(plan.primary).toEqual({ kind: "open-meal-log", label: "Log Pre-Workout Meal", mealId: "pre" });
    expect(plan.title).toBe("Pre-Workout Meal is due · 4:00 PM");
    expect(plan.reason).toContain("Nothing counts until you confirm it.");
    expect(plan.secondary).toBeNull();
  });

  it("leads with the first real log, and water as a second, when nothing is logged today", () => {
    const plan = resolveNutritionPrimaryAction(input({ loggedMealIds: [], hydration: { todayOz: 0, targetOz: 120 } }));
    expect(plan.primary).toMatchObject({ kind: "open-meal-log", mealId: "pre" });
    expect(plan.secondary).toEqual({ kind: "log-water", label: `Log ${NUTRITION_WATER_OZ} oz Water`, oz: NUTRITION_WATER_OZ });
    expect(plan.reason).toContain("Nothing is logged today yet.");
  });

  it("logs water when it is behind the day's pace and no window is open", () => {
    const plan = resolveNutritionPrimaryAction(input({ now: at("17:30"), loggedMealIds: ["breakfast", "lunch", "pre"], hydration: { todayOz: 16, targetOz: 120 } }));
    expect(plan.primary).toEqual({ kind: "log-water", label: "Log 16 oz Water", oz: 16 });
    expect(plan.reason).toBe("16 of 120 oz logged today.");
  });

  it("points at the next window when water is on pace", () => {
    const plan = resolveNutritionPrimaryAction(input({ now: at("17:30"), loggedMealIds: ["breakfast", "lunch", "pre"], hydration: { todayOz: 100, targetOz: 120 } }));
    expect(plan.primary).toEqual({ kind: "open-meal-log", label: "Log Post-Workout Meal", mealId: "post" });
    expect(plan.title).toBe("Next · Post-Workout Meal at 7:15 PM");
  });

  it("asks for a passed meal only if it was eaten", () => {
    const plan = resolveNutritionPrimaryAction(input({ now: at("21:45"), loggedMealIds: ["breakfast", "lunch", "pre"], hydration: { todayOz: 110, targetOz: 120 } }));
    expect(plan.primary).toEqual({ kind: "open-meal-log", label: "Log Post-Workout Meal If Eaten", mealId: "post" });
  });

  it("offers water, then a review, once every meal is logged", () => {
    const all = ["breakfast", "lunch", "pre", "post"];
    expect(resolveNutritionPrimaryAction(input({ now: at("20:00"), loggedMealIds: all, hydration: { todayOz: 100, targetOz: 120 } })).primary.kind).toBe("log-water");
    expect(resolveNutritionPrimaryAction(input({ now: at("20:00"), loggedMealIds: all, hydration: { todayOz: 120, targetOz: 120 } })).primary).toEqual({
      kind: "review-fuel-log",
      label: "Review Today's Fuel Log",
    });
  });

  it("closes the log honestly after sleep lock", () => {
    const open = resolveNutritionPrimaryAction(input({ now: at("23:05") }));
    expect(open.title).toBe("Close today's fuel log");
    expect(open.primary).toMatchObject({ label: "Log Post-Workout Meal If Eaten" });

    const done = resolveNutritionPrimaryAction(input({ now: at("23:05"), loggedMealIds: ["breakfast", "lunch", "pre", "post"] }));
    expect(done.primary.kind).toBe("review-fuel-log");
  });

  it("with no meal windows, logs water and routes to the schedule for the windows", () => {
    const plan = resolveNutritionPrimaryAction(input({ meals: [] }));
    expect(plan.primary).toMatchObject({ kind: "log-water", oz: NUTRITION_WATER_OZ });
    expect(plan.secondary).toEqual({ kind: "open-schedule", label: "Set Meal Windows" });
  });

  it("prints every amount it records, at every hour, logged or not", () => {
    const hours = ["05:00", "07:05", "10:00", "12:40", "15:50", "18:00", "21:00", "22:40"];
    const logs = [[], ["breakfast"], ["breakfast", "lunch", "pre", "post"]];
    const water = [0, 40, 120];
    for (const h of hours) {
      for (const loggedMealIds of logs) {
        for (const todayOz of water) {
          const plan = resolveNutritionPrimaryAction(input({ now: at(h), loggedMealIds, hydration: { todayOz, targetOz: 120 } }));
          for (const action of [plan.primary, plan.secondary].filter((a): a is NutritionPrimaryAction => a !== null)) {
            expectHonestLabel(action);
          }
          expect(plan.title.trim()).not.toBe("");
        }
      }
    }
  });
});

describe("hydrationBehindPace", () => {
  it("compares logged water with the share of the waking day gone", () => {
    const day = { wakeMin: 390, sleepMin: 1350 };
    expect(hydrationBehindPace({ ...day, todayOz: 0, targetOz: 120, nowMin: 390 })).toBe(false);
    expect(hydrationBehindPace({ ...day, todayOz: 20, targetOz: 120, nowMin: 870 })).toBe(true);
    expect(hydrationBehindPace({ ...day, todayOz: 60, targetOz: 120, nowMin: 870 })).toBe(false);
    expect(hydrationBehindPace({ ...day, todayOz: 130, targetOz: 120, nowMin: 1300 })).toBe(false);
    expect(hydrationBehindPace({ ...day, todayOz: 0, targetOz: 0, nowMin: 1300 })).toBe(false);
  });
});
