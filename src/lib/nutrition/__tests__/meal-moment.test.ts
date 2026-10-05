import { describe, expect, it } from "vitest";

import { MILESTONE_HEADLINE, planMealMoment, resolveMealMoment, springSamples, type MealMomentMeal } from "@/lib/nutrition/meal-moment";

const MEALS: MealMomentMeal[] = [
  { id: "breakfast", label: "Breakfast", proteinG: 42, calories: 610 },
  { id: "lunch", label: "Lunch", proteinG: 48, calories: 720 },
  { id: "pre", label: "Pre-Workout Meal", proteinG: 38, calories: 520 },
  { id: "post", label: "Post-Workout Meal", proteinG: 50, calories: 680 },
  { id: "dinner", label: "Dinner", proteinG: 44, calories: 700 },
];
const TARGET = 200;

const moment = (before: string[], after: string[], target = TARGET) =>
  resolveMealMoment({ meals: MEALS, before, after, proteinTargetG: target });

describe("resolveMealMoment", () => {
  it("names the meal, the count and today's estimated protein", () => {
    const m = moment(["breakfast", "lunch"], ["breakfast", "lunch", "pre"])!;
    expect(m.tone).toBe("log");
    expect(m.mealId).toBe("pre");
    expect(m.lead).toBe("Pre-Workout Meal logged");
    expect(m.detail).toBe("3 of 5 · est. 128 g protein today");
    expect(m.proteinBefore).toBe(90);
    expect(m.proteinAfter).toBe(128);
    expect(m.caloriesAfter).toBe(1850);
    expect(m.milestone).toBeNull();
    expect(m.headline).toBeNull();
  });

  it("the first meal of the day is a milestone", () => {
    const m = moment([], ["lunch"])!;
    expect(m.milestone).toBe("first-meal");
    expect(m.headline).toBe(MILESTONE_HEADLINE["first-meal"]);
    expect(m.detail).toBe("1 of 5 · est. 48 g protein today");
  });

  it("crossing the protein target is a milestone, once", () => {
    expect(moment(["breakfast", "lunch", "pre"], ["breakfast", "lunch", "pre", "post"], 170)!.milestone).toBe("protein-target");
    /* Already over the target: not again. */
    expect(moment(["breakfast", "lunch", "pre", "post"], ["breakfast", "lunch", "pre", "post"].concat([]), 170)).toBeNull();
    expect(moment(["breakfast", "lunch", "pre"], ["breakfast", "lunch", "pre", "post"], 100)!.milestone).toBeNull();
    /* Landing exactly on it counts. */
    expect(moment(["breakfast"], ["breakfast", "lunch"], 90)!.milestone).toBe("protein-target");
  });

  it("logging the last meal is the day fueled, and outranks the protein target", () => {
    const m = moment(["breakfast", "lunch", "pre", "post"], ["breakfast", "lunch", "pre", "post", "dinner"], 210)!;
    expect(m.milestone).toBe("day-fueled");
    expect(m.headline).toBe("Day fueled.");
    expect(m.detail).toBe("5 of 5 · est. 222 g protein today");
  });

  it("a single-meal day that gets logged is the day fueled, not merely the first meal", () => {
    const one = resolveMealMoment({ meals: [MEALS[0]], before: [], after: ["breakfast"], proteinTargetG: 180 })!;
    expect(one.milestone).toBe("day-fueled");
  });

  it("a clear is never a milestone and says so plainly", () => {
    const m = moment(["breakfast", "lunch", "pre", "post", "dinner"], ["breakfast", "lunch", "pre", "post"])!;
    expect(m.tone).toBe("clear");
    expect(m.mealId).toBe("dinner");
    expect(m.lead).toBe("Dinner cleared");
    expect(m.detail).toBe("4 of 5 · est. 178 g protein today");
    expect(m.milestone).toBeNull();
    expect(moment(["lunch"], [])!.milestone).toBeNull();
  });

  it("returns null when nothing in today's plan changed", () => {
    expect(moment(["lunch"], ["lunch"])).toBeNull();
    expect(moment(["lunch"], ["lunch", "not-in-plan"])).toBeNull();
    expect(resolveMealMoment({ meals: [], before: [], after: ["x"], proteinTargetG: 100 })).toBeNull();
  });

  it("ignores logged ids from outside today's plan in every count", () => {
    const m = moment(["stale-id"], ["stale-id", "lunch"])!;
    expect(m.loggedCount).toBe(1);
    expect(m.milestone).toBe("first-meal");
  });

  it("without a target, no protein milestone is invented", () => {
    expect(moment(["breakfast"], ["breakfast", "lunch"], 0)!.milestone).toBeNull();
  });

  it("copy stays a record: no health claims, no safety verdicts, no guarantees", () => {
    const lines = [
      ...Object.values(MILESTONE_HEADLINE),
      moment([], ["lunch"])!.lead,
      moment([], ["lunch"])!.detail,
      moment(["lunch"], [])!.lead,
    ].join(" ");
    expect(lines).not.toMatch(/safe|healthy|health|guarantee|optimal|perfect|great job|awesome|amazing|!|dose|compound|cycle/i);
  });
});

describe("planMealMoment", () => {
  const log = { tone: "log" as const, milestone: null };
  const milestone = { tone: "log" as const, milestone: "day-fueled" as const };
  const clear = { tone: "clear" as const, milestone: null };

  it("full motion runs the whole sequence for a log", () => {
    const plan = planMealMoment(log, "full");
    expect(plan).toMatchObject({ visible: true, impact: true, flow: true, boom: true, countUp: true, animateWords: true });
    expect(plan.haptics?.impact.length).toBeGreaterThan(0);
    expect(plan.arrivalMs).toBeGreaterThan(400);
    expect(plan.arrivalMs).toBeLessThan(1000);
  });

  it("a milestone lands harder and holds longer", () => {
    const a = planMealMoment(log, "full");
    const b = planMealMoment(milestone, "full");
    expect(b.intensity).toBeGreaterThan(a.intensity);
    expect(b.holdMs).toBeGreaterThan(a.holdMs);
    expect(b.haptics!.arrival.length).toBeGreaterThan(a.haptics!.arrival.length);
  });

  it("a clear is the smaller moment: no flow and no boom", () => {
    const plan = planMealMoment(clear, "full");
    expect(plan.impact).toBe(true);
    expect(plan.flow).toBe(false);
    expect(plan.boom).toBe(false);
  });

  it("reduced motion keeps the words and nothing that moves", () => {
    const plan = planMealMoment(milestone, "reduced");
    expect(plan).toMatchObject({ visible: true, impact: false, flow: false, boom: false, countUp: false, animateWords: false, haptics: null });
  });

  it("static shows the same still words: nothing animated, drawn or vibrated", () => {
    const plan = planMealMoment(milestone, "static");
    expect(plan).toMatchObject({ visible: true, impact: false, flow: false, boom: false, countUp: false, animateWords: false, haptics: null, intensity: 0 });
    expect(plan).toEqual(planMealMoment(milestone, "reduced"));
    expect(plan.holdMs).toBe(planMealMoment(milestone, "full").holdMs);
  });
});

describe("springSamples", () => {
  it("starts at the origin, overshoots and settles exactly on the target", () => {
    const s = springSamples({ from: 6, to: 0, stiffness: 260, damping: 14 });
    expect(s[0]).toBe(6);
    expect(s[s.length - 1]).toBe(0);
    expect(Math.min(...s)).toBeLessThan(0);
    expect(s.length).toBeLessThanOrEqual(73);
  });

  it("a critically damped spring does not overshoot", () => {
    const s = springSamples({ from: 1, to: 0, stiffness: 100, damping: 20 });
    expect(Math.min(...s)).toBeGreaterThanOrEqual(-0.001);
  });
});
