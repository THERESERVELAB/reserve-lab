import { describe, expect, it } from "vitest";

import { buildDailyFuelPlan, estimateDailyTargets, fuelTargetsFromMacros } from "../fuel-plan";
import type { MacroTargets } from "../types";

const windows = [
  { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
  { id: "midday", label: "Lunch", time: "12:30", enabled: true },
  { id: "night", label: "Dinner", time: "20:00", enabled: true },
];

const resolved: MacroTargets = {
  calories: 2650,
  proteinG: 210,
  carbsG: 300,
  fatG: 70,
  fiberG: 38,
  hydrationMl: 3500,
  basis: "Estimated macro structure for the selected protocol.",
};

describe("fuelTargetsFromMacros", () => {
  it("maps the engine's resolved day macros into the plan's target shape", () => {
    const t = fuelTargetsFromMacros(resolved, 200);
    expect(t).toMatchObject({ calories: 2650, proteinG: 210, carbsG: 300, fatG: 70, estimated: true, basis: "member-weight" });
  });

  it("marks the basis reference-weight when no bodyweight is on file", () => {
    expect(fuelTargetsFromMacros(resolved, null)?.basis).toBe("reference-weight");
  });

  it("returns null when there are no usable numbers, so the caller keeps the estimate", () => {
    expect(fuelTargetsFromMacros(null, 200)).toBeNull();
    expect(fuelTargetsFromMacros({ ...resolved, calories: 0 }, 200)).toBeNull();
    expect(fuelTargetsFromMacros({ ...resolved, proteinG: 0 }, 200)).toBeNull();
  });
});

describe("buildDailyFuelPlan honouring the resolved macros", () => {
  it("builds the day to the protocol-aligned macros when given, not the goal estimate", () => {
    const estimate = estimateDailyTargets("recomp", 200, true);
    const plan = buildDailyFuelPlan({
      goal: "recomp",
      isTrainingDay: true,
      sessionName: "Push",
      mealWindows: windows,
      bodyweightLb: 200,
      sleepTarget: "23:00",
      wakeTime: "07:00",
      macroTarget: resolved,
    });
    expect(plan.targets).toMatchObject({ calories: 2650, proteinG: 210, carbsG: 300, fatG: 70 });
    // The override really moved the day off the goal-only estimate.
    expect(plan.targets.calories).not.toBe(estimate.calories);
  });

  it("falls back to the goal + bodyweight estimate when no macros are supplied", () => {
    const estimate = estimateDailyTargets("recomp", 200, true);
    const plan = buildDailyFuelPlan({
      goal: "recomp",
      isTrainingDay: true,
      sessionName: "Push",
      mealWindows: windows,
      bodyweightLb: 200,
      sleepTarget: "23:00",
      wakeTime: "07:00",
    });
    expect(plan.targets.calories).toBe(estimate.calories);
    expect(plan.targets.proteinG).toBe(estimate.proteinG);
  });
});
