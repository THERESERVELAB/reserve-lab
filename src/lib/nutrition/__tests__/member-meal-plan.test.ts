import { describe, expect, it } from "vitest";

import { buildDailyFuelPlan } from "../fuel-plan";
import { mealPlanFromPreset, mealPlanPresetByKey, MEAL_PLAN_PRESETS } from "../meal-plan-presets";
import { estimatePlanMeal, planCoversDay, planDayTotals, planMealsFor, planUnknownItems } from "../member-meal-plan";
import { assignPlanTimes, buildMemberPlanDay, coverageKeysForItems } from "../member-plan-fuel";
import { mealWindowMissed } from "../nutrition-room";
import { fuelWindowsFromPlan } from "../scheduled-fuel-windows";
import { buildMealPlan } from "@/lib/schedule/engine";

import { OWNER_SCHEDULE } from "./owner-seed";

const preset = mealPlanPresetByKey("five-meal-standard")!;
const plan = mealPlanFromPreset(preset, new Date("2026-09-29T12:00:00Z"));

const windowsFor = (training: boolean) =>
  fuelWindowsFromPlan(buildMealPlan(OWNER_SCHEDULE, { trainingPlanned: training, direction: "unchanged" }));

const day = (training: boolean) =>
  buildMemberPlanDay({
    plan,
    goal: "recomp",
    isTrainingDay: training,
    sessionName: training ? "Push" : "Recovery Day",
    mealWindows: windowsFor(training),
    wakeTime: OWNER_SCHEDULE.wakeTime,
    sleepTarget: OWNER_SCHEDULE.sleepTarget,
  });

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

describe("the preset carries the plan as written", () => {
  it("keeps the training day and the rest day apart", () => {
    expect(planMealsFor(plan, true).map((m) => m.name)).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Intra-Workout", "Meal 5"]);
    expect(planMealsFor(plan, false).map((m) => m.name)).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5"]);
    expect(planCoversDay(plan, true)).toBe(true);
    expect(planCoversDay(plan, false)).toBe(true);
  });

  it("drops the rice from Meal 2 on a rest day and moves volume into Meal 5", () => {
    const restMeal2 = planMealsFor(plan, false)[1];
    expect(restMeal2.items.map((i) => i.name)).not.toContain("White Rice");

    const trainMeal5 = planMealsFor(plan, true)[5];
    const restMeal5 = planMealsFor(plan, false)[4];
    expect(trainMeal5.items.find((i) => i.name === "93/7 Ground Beef")?.grams).toBe(150);
    expect(restMeal5.items.find((i) => i.name === "93/7 Ground Beef")?.grams).toBe(175);
    expect(trainMeal5.items.find((i) => i.name === "Potatoes")?.grams).toBe(120);
    expect(restMeal5.items.find((i) => i.name === "Potatoes")?.grams).toBe(75);
  });

  it("prices every item it was given — nothing silently counted as zero", () => {
    expect(planUnknownItems(plan)).toEqual([]);
  });

  it("carries no supplement, compound or dosage content", () => {
    const text = JSON.stringify(MEAL_PLAN_PRESETS).toLowerCase();
    for (const banned of ["citrulline", "electrolyte", "mg", "dose", "3,000", "3000"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("copies into a plan the member owns — editing it never reaches the preset", () => {
    const a = mealPlanFromPreset(preset);
    const b = mealPlanFromPreset(preset);
    expect(a.id).not.toBe(b.id);
    expect(a.trainingDay[0].id).not.toBe(b.trainingDay[0].id);
    a.trainingDay[0].items[0].grams = 1;
    expect(preset.trainingDay[0].items[0][2]).toBe(230);
    expect(b.trainingDay[0].items[0].grams).toBe(230);
  });
});

describe("macro estimates", () => {
  it("estimates Meal 1 from its own amounts", () => {
    const m1 = planMealsFor(plan, true)[0];
    const est = estimatePlanMeal(m1);
    // 230g egg white + 100g whole egg + 7g avocado oil + 50g veg.
    expect(est.macros.proteinG).toBeGreaterThan(35);
    expect(est.macros.proteinG).toBeLessThan(48);
    expect(est.macros.fatG).toBeGreaterThan(15);
    expect(est.unmatched).toEqual([]);
  });

  it("reads 93/7 ground beef as lean, not as 80/20", () => {
    const beef = planMealsFor(plan, true)[5].items.find((i) => i.name === "93/7 Ground Beef")!;
    const est = estimatePlanMeal({ id: "t", name: "t", slot: "dinner", order: 0, items: [beef] });
    // 150g of 93/7 is well under the 24g of fat the 80/20 table row would give.
    expect(est.macros.fatG).toBeLessThan(18);
    expect(est.macros.proteinG).toBeGreaterThan(30);
  });

  it("reads cream of rice as cream of rice, not as oats", () => {
    const cor = planMealsFor(plan, true)[3].items.find((i) => i.name === "Cream of Rice")!;
    const est = estimatePlanMeal({ id: "t", name: "t", slot: "pre-workout", order: 0, items: [cor] });
    expect(est.macros.fatG).toBeLessThanOrEqual(1);
    expect(est.macros.carbsG).toBeGreaterThan(28);
  });

  it("gives the training day more than the rest day", () => {
    const training = planDayTotals(planMealsFor(plan, true));
    const rest = planDayTotals(planMealsFor(plan, false));
    expect(training.carbsG).toBeGreaterThan(rest.carbsG);
    expect(training.calories).toBeGreaterThan(rest.calories);
  });

  it("counts an item with no amount as uncounted rather than as zero-calorie food", () => {
    const est = estimatePlanMeal({
      id: "t",
      name: "t",
      slot: "lunch",
      order: 0,
      items: [{ id: "i", name: "Chicken Breast", display: "some", grams: null, group: "protein" }],
    });
    expect(est.uncounted).toEqual(["Chicken Breast"]);
    expect(est.macros.calories).toBe(0);
  });
});

describe("the day the member sees", () => {
  it("returns the plan's meals, in the plan's order", () => {
    expect(day(true).meals.map((m) => m.name)).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Intra-Workout", "Meal 5"]);
  });

  it("takes its targets from the plan's own totals, not a bodyweight estimate", () => {
    const d = day(true);
    const totals = planDayTotals(planMealsFor(plan, true));
    expect(d.targets.basis).toBe("member-plan");
    expect(d.targets.proteinG).toBe(Math.round(totals.proteinG));
    expect(d.targets.calories).toBe(Math.round(totals.calories));

    const generated = buildDailyFuelPlan({
      goal: "recomp",
      isTrainingDay: true,
      sessionName: "Push",
      mealWindows: windowsFor(true),
      bodyweightLb: 205,
    });
    expect(d.targets.proteinG).not.toBe(generated.targets.proteinG);
  });

  it("anchors the pre-workout meal to the scheduled pre-workout window", () => {
    const scheduled = buildMealPlan(OWNER_SCHEDULE, { trainingPlanned: true, direction: "unchanged" });
    const pre = scheduled.find((m) => m.slot === "pre-workout");
    const meal4 = day(true).meals.find((m) => m.name === "Meal 4")!;
    if (pre) expect(meal4.time).toBe(pre.time);
    expect(meal4.smartRead).toContain("An hour before training");
  });

  it("gives the second midday meal its own time rather than stacking it on the first", () => {
    const meals = day(true).meals;
    const two = meals.find((m) => m.name === "Meal 2")!;
    const three = meals.find((m) => m.name === "Meal 3")!;
    expect(two.time).not.toBe(three.time);
    expect(mins(three.time!)).toBeGreaterThan(mins(two.time!));
  });

  it("never runs a meal past the sleep target", () => {
    for (const training of [true, false]) {
      const sleep = mins(OWNER_SCHEDULE.sleepTarget);
      for (const meal of day(training).meals) {
        expect(mins(meal.time!)).toBeLessThan(sleep);
      }
    }
  });

  it("keeps meal times strictly increasing on both day types", () => {
    for (const training of [true, false]) {
      const times = day(training).meals.map((m) => mins(m.time!));
      for (let i = 1; i < times.length; i += 1) expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it("carries the amounts onto the card", () => {
    const meal1 = day(true).meals[0];
    expect(meal1.ingredients).toContain("230g Egg Whites");
    expect(meal1.ingredientsDetailed?.[0]).toMatchObject({ name: "Egg Whites", amount: "230g", group: "protein" });
  });

  it("marks the intra-workout slot optional, exempt from missed, and adds nothing of its own", () => {
    const d = day(true);
    const intra = d.meals.find((m) => m.name === "Intra-Workout")!;
    expect(intra.optional).toBe(true);
    /* mealWindowMissed() exempts only isSnack, so an optional meal must carry
       it or it reads as missed once the session passes. */
    expect(intra.isSnack).toBe(true);
    expect(d.meals.filter((m) => !m.optional).every((m) => !m.isSnack)).toBe(true);
    expect(d.snack.macros.calories).toBe(0);
  });

  it("never reads an optional meal as missed, the way a required one does", () => {
    const d = day(true);
    const intra = d.meals.find((m) => m.name === "Intra-Workout")!;
    const required = d.meals.find((m) => m.name === "Meal 1")!;
    const args = { logged: false, closeoutActive: true, nowMin: 23 * 60 };
    expect(mealWindowMissed({ ...args, isSnack: intra.isSnack, mealTime: intra.time })).toBe(false);
    expect(mealWindowMissed({ ...args, isSnack: required.isSnack, mealTime: required.time })).toBe(true);
  });

  it("does not read a nutrient out of a word that merely contains its name", () => {
    /* "Veggies" contains "egg". Unanchored, a plate of vegetables claimed
       protein, iron, zinc and vitamin D. */
    const veg = coverageKeysForItems(["Veggies"]);
    expect(veg).not.toContain("protein");
    expect(veg).not.toContain("iron");
    expect(veg).not.toContain("zinc");
    expect(veg).not.toContain("vitamin-d");
    expect(veg).toContain("fruit-veg");
    /* Real eggs still count. */
    expect(coverageKeysForItems(["Egg Whites", "Whole Eggs"])).toEqual(
      expect.arrayContaining(["protein", "iron", "zinc", "vitamin-d"]),
    );
  });

  it("reads food coverage off the plan's own foods, gaps included", () => {
    const covered = new Set(day(true).meals.flatMap((m) => m.covers));
    expect(covered).toContain("protein");
    expect(covered).toContain("potassium");
    expect(covered).toContain("iron");
    // The plan has no fatty fish and no citrus — coverage must not pretend it does.
    expect(covered).not.toContain("omega-3");
    expect(covered).not.toContain("vitamin-c");
  });
});

describe("times when the schedule gives little to anchor to", () => {
  it("spaces every meal when there are no windows at all", () => {
    const meals = planMealsFor(plan, true);
    const times = assignPlanTimes(meals, [], { wakeTime: "05:30", sleepTarget: "22:00" });
    expect(times).toHaveLength(meals.length);
    for (let i = 1; i < times.length; i += 1) expect(times[i].mins).toBeGreaterThan(times[i - 1].mins);
  });

  it("never puts a pre-anchor meal before waking, or wraps it into last night", () => {
    /* Three meals whose slots have no window, ahead of an early breakfast. */
    const meals = [
      { id: "a", name: "A", slot: "snack" as const, order: 0, items: [] },
      { id: "b", name: "B", slot: "snack" as const, order: 1, items: [] },
      { id: "c", name: "C", slot: "snack" as const, order: 2, items: [] },
      { id: "d", name: "D", slot: "breakfast" as const, order: 3, items: [] },
    ];
    const windows = [{ id: "morning-anchor", label: "Breakfast", time: "06:15", enabled: true, slot: "breakfast" as const }];
    const times = assignPlanTimes(meals, windows, { wakeTime: "05:30", sleepTarget: "22:00" });
    const wake = 5 * 60 + 30;
    for (const t of times) expect(t.mins).toBeGreaterThanOrEqual(wake);
    /* The anchored meal keeps its schedule window. */
    expect(times[3].mins).toBe(6 * 60 + 15);
    for (let i = 1; i < times.length; i += 1) expect(times[i].mins).toBeGreaterThan(times[i - 1].mins);
  });

  it("holds the order even when the plan has more meals than the day has windows", () => {
    const meals = planMealsFor(plan, false);
    const times = assignPlanTimes(meals, windowsFor(false), { wakeTime: "05:30", sleepTarget: "22:00" });
    expect(new Set(times.map((t) => t.mins)).size).toBe(meals.length);
  });
});

describe("coverage matching", () => {
  it("does not read omega-3 into food that has none", () => {
    expect(coverageKeysForItems(["93/7 Ground Beef", "Potatoes"])).not.toContain("omega-3");
    expect(coverageKeysForItems(["Salmon"])).toContain("omega-3");
  });
});

describe("persistence", () => {
  it("travels with the member's state and merges record by record", async () => {
    const { MEMBER_STATE_KEYS } = await import("@/lib/sync/state-contract");
    const { SYNC_COLLECTIONS } = await import("@/lib/sync/sync-collections");
    expect(MEMBER_STATE_KEYS).toContain("memberMealPlans");
    expect(MEMBER_STATE_KEYS).toContain("activeMemberMealPlanId");
    expect(SYNC_COLLECTIONS.some((c) => c.path === "memberMealPlans")).toBe(true);
  });
});

describe("the target's stated source", () => {
  it("credits the member's own plan ahead of goal, protocol and Horizon", async () => {
    const { fuelSourceLine } = await import("../nutrition-room");
    expect(fuelSourceLine({ horizon: null, protocolName: null, memberPlanName: null }).text)
      .toBe("Built from your goal and bodyweight · no Program Horizon set");
    const own = fuelSourceLine({
      horizon: { weekNumber: 3, phaseName: "Build", demandClass: "high-demand" },
      protocolName: "Lean Hard",
      memberPlanName: "Five Meal Standard",
    });
    expect(own.source).toBe("member-plan");
    expect(own.text).toBe("Your own plan · Five Meal Standard");
  });
});
