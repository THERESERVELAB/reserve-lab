import { describe, expect, it } from "vitest";

import type { PlannedFuelMeal } from "../fuel-plan";
import { fuelPlanForConfirmation, fuelSourceLine, mealWindowMissed, nutritionStatement, proteinRead, waterRead } from "../nutrition-room";

const meal = (id: string, slot: PlannedFuelMeal["slot"], time: string | null, proteinG: number): PlannedFuelMeal => ({
  id,
  slot,
  windowLabel: `${id} window`,
  time,
  name: `${id} plate`,
  ingredients: ["Chicken breast", "Jasmine rice"],
  macros: { calories: 500, proteinG, carbsG: 50, fatG: 12 },
  prep: [],
  covers: ["protein"],
  smartRead: "Planned for the window.",
  isSnack: false,
});

const MEALS = [meal("breakfast", "breakfast", "07:00", 40), meal("pre", "pre-workout", "16:00", 35), meal("post", "post-workout", "19:15", 45)];
const PLAN = {
  meals: MEALS,
  targets: { proteinG: 176, calories: 2955, carbsG: 330, fatG: 60, estimated: true as const, basis: "member-weight" as const, note: "Planning estimate." },
  isTrainingDay: true,
  sessionName: "Pull",
};

describe("proteinRead", () => {
  it("sums the fuel plan's estimate for logged meals only, labelled est.", () => {
    expect(proteinRead({ meals: MEALS, loggedMealIds: ["breakfast", "pre"], targetG: 176 })).toEqual({
      label: "Protein",
      value: "75",
      unit: "/ 176 g",
      detail: "2 of 3 meals logged",
      provenance: "est.",
    });
    expect(proteinRead({ meals: MEALS, loggedMealIds: ["someone-else"], targetG: 176 })?.value).toBe("0");
  });

  it("is null without meal windows or a target — nothing to log against", () => {
    expect(proteinRead({ meals: [], loggedMealIds: [], targetG: 176 })).toBeNull();
    expect(proteinRead({ meals: MEALS, loggedMealIds: [], targetG: 0 })).toBeNull();
  });
});

describe("waterRead", () => {
  it("prints the member's own log against the target", () => {
    expect(waterRead({ todayOz: 64, targetOz: 120 })).toMatchObject({ value: "64", unit: "/ 120 oz", detail: "Logged today", provenance: "logged" });
    expect(waterRead({ todayOz: 0, targetOz: 120 })?.detail).toBe("Nothing logged today");
    expect(waterRead({ todayOz: 10, targetOz: 0 })).toBeNull();
  });
});

describe("nutritionStatement", () => {
  it("follows the fuel day", () => {
    expect(nutritionStatement({ state: "open", trainingPlanned: true })).toBe("Fuel The Session.");
    expect(nutritionStatement({ state: "open", trainingPlanned: false })).toBe("Fuel Recovery.");
    expect(nutritionStatement({ state: "logged", trainingPlanned: true })).toBe("Fuel Handled.");
    expect(nutritionStatement({ state: "after-sleep-lock", trainingPlanned: true })).toBe("Fuel Day Closed.");
    expect(nutritionStatement({ state: "no-windows", trainingPlanned: false })).toBe("Map The Fuel Day.");
  });
});

describe("fuelPlanForConfirmation", () => {
  it("keeps the fuel plan's meal ids, so the confirmation logs what Apex and the fuel log read", () => {
    const plan = fuelPlanForConfirmation({ plan: PLAN, loggedMealIds: ["breakfast"], dietStyle: "standard", date: "2026-09-15" });
    expect(plan.meals.map((m) => m.id)).toEqual(["breakfast", "pre", "post"]);
    expect(plan.meals.map((m) => m.purpose)).toEqual(["morning-anchor", "pre-workout", "post-workout"]);
    expect(plan.meals[1]).toMatchObject({ name: "pre window", dishName: "pre plate", timeWindow: "4:00 PM", timeMinutes: 960, status: "planned" });
    expect(plan.nextMeal?.id).toBe("pre");
  });

  it("uses the plan's own targets for all four macros, the ones the hero's dials read", () => {
    const plan = fuelPlanForConfirmation({ plan: PLAN, loggedMealIds: ["breakfast"], dietStyle: "standard", date: "2026-09-15" });
    expect(plan.totalMacros).toMatchObject({ proteinG: 176, calories: 2955, carbsG: 330, fatG: 60 });
    expect(plan.remainingMacros).toEqual({ calories: 2455, proteinG: 136, carbsG: 280, fatG: 48 });
    expect(plan.completedMeals).toBe(1);
  });
});

describe("fuelSourceLine", () => {
  it("names the Program Horizon day when one is active", () => {
    expect(fuelSourceLine({ horizon: { weekNumber: 3, phaseName: "Accumulation", demandClass: "very-high" }, protocolName: "Summer Shred" })).toEqual({
      source: "horizon",
      text: "Program Horizon · Week 3 · Accumulation · very high fuel demand",
    });
  });

  it("never says nothing is planned: a protocol without a horizon still built the targets", () => {
    const line = fuelSourceLine({ horizon: null, protocolName: "Summer Shred" });
    expect(line.source).toBe("protocol");
    expect(line.text).toBe("Built from Summer Shred · no Program Horizon set");
    expect(line.text).not.toMatch(/no active program horizon is available/i);
  });

  it("falls back to the member's goal and bodyweight", () => {
    expect(fuelSourceLine({ horizon: null, protocolName: null }).text).toBe("Built from your goal and bodyweight · no Program Horizon set");
  });
});

describe("mealWindowMissed", () => {
  const base = { logged: false, isSnack: false, closeoutActive: true, mealTime: "19:15", nowMin: 22 * 60 };

  it("marks a passed, unlogged window during the night closeout", () => {
    expect(mealWindowMissed(base)).toBe(true);
  });

  it("never marks a logged meal, a snack, or a window outside the closeout", () => {
    expect(mealWindowMissed({ ...base, logged: true })).toBe(false);
    expect(mealWindowMissed({ ...base, isSnack: true })).toBe(false);
    expect(mealWindowMissed({ ...base, closeoutActive: false })).toBe(false);
    expect(mealWindowMissed({ ...base, nowMin: null })).toBe(false);
  });

  it("keeps a window after midnight later than one before it", () => {
    expect(mealWindowMissed({ ...base, mealTime: "00:30", nowMin: 23 * 60 })).toBe(false);
    expect(mealWindowMissed({ ...base, mealTime: "22:00", nowMin: 30 })).toBe(true);
  });
});
