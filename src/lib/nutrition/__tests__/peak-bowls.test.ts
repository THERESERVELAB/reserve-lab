import { describe, expect, it } from "vitest";

import { buildDailyFuelPlan } from "../fuel-plan";
import { BOWL_MAX_INGREDIENTS, BOWL_STARTERS, bowlProblem, bowlToSignature, bowlsForSlot, groupFor, isBowlPlateId, newBowlId, type CustomBowl } from "../peak-bowls";
import { PEAK_LOOKS, peakMeals, swapKey, swapOptions } from "../peak-mode";
import { platesFor } from "../peak-kitchen";

/* ════════════════════════════════════════════════════════════════════════
   THE MEMBER'S OWN BOWL — built once, then treated like any other plate.
   ════════════════════════════════════════════════════════════════════════ */

const bowl: CustomBowl = {
  id: "b1",
  name: "Cream of Rice Protein Bowl",
  slot: "breakfast",
  ingredients: [
    { food: "cream of rice (dry)", grams: 55 },
    { food: "whey isolate", grams: 35 },
    { food: "banana", grams: 100 },
    { food: "blueberries", grams: 80 },
    { food: "honey", grams: 10 },
  ],
  createdAt: "2026-09-22T06:00:00.000Z",
};

const windows = [
  { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
  { id: "midday", label: "Lunch", time: "12:30", enabled: true },
  { id: "night", label: "Dinner", time: "18:30", enabled: true },
];
const plan = () =>
  buildDailyFuelPlan({ goal: PEAK_LOOKS["lean-hard"].goal, isTrainingDay: false, sessionName: "Recovery Day", mealWindows: windows, bodyweightLb: 200, sleepTarget: "22:30", wakeTime: "06:30" });

describe("your own bowls", () => {
  it("becomes a plate for its own meal, marked as the member's", () => {
    const sig = bowlToSignature(bowl);
    expect(isBowlPlateId(sig.id)).toBe(true);
    expect(sig.slot).toBe("breakfast");
    expect(sig.looks).toHaveLength(3);
    expect(sig.portions.map((p) => ("food" in p ? p.food : ""))).toEqual([
      "cream of rice (dry)", "whey isolate", "banana", "blueberries", "honey",
    ]);
  });

  it("works out which dial each ingredient rides, so the member only enters a weight", () => {
    expect(groupFor("whey isolate")).toBe("protein");
    expect(groupFor("cream of rice (dry)")).toBe("carb");
    expect(groupFor("honey")).toBe("carb");
    expect(groupFor("blueberries")).toBe("produce");
    expect(groupFor("almonds")).toBe("fat");
  });

  it("is offered first for its meal, ahead of Reserve's own plates", () => {
    const plates = platesFor("breakfast", "lean-hard", null, new Set(), 0, undefined, bowlsForSlot([bowl], "breakfast"));
    expect(plates[0].sig.name).toBe("Cream of Rice Protein Bowl");
    expect(plates.length).toBeGreaterThan(1);
  });

  it("can be hidden like any plate, and only shows for its own slot", () => {
    const hidden = new Set([bowlToSignature(bowl).id]);
    expect(platesFor("breakfast", "lean-hard", null, hidden, 0, undefined, bowlsForSlot([bowl], "breakfast")).some((p) => isBowlPlateId(p.sig.id))).toBe(false);
    expect(bowlsForSlot([bowl], "dinner")).toEqual([]);
  });

  it("scales to the meal's targets and can be swapped in on any day", () => {
    const day = plan();
    const bowls = bowlsForSlot([bowl], "breakfast");
    const meals = peakMeals(day, { look: "lean-hard", bowls, snacks: [] });
    const breakfast = meals.find((m) => m.slot === "breakfast")!;
    const options = swapOptions(breakfast, "lean-hard", null, [], [], false, undefined, bowls);
    const mine = options.find((o) => isBowlPlateId(o.id));
    expect(mine, "the bowl is a swap option").toBeTruthy();
    const swapped = peakMeals(day, { look: "lean-hard", bowls, snacks: [], swaps: { [swapKey(breakfast)]: mine!.id } });
    const served = swapped.find((m) => m.slot === "breakfast")!;
    expect(served.plateId).toBe(mine!.id);
    expect(served.name).toBe("Cream of Rice Protein Bowl");
    /* Scaled toward the meal's own target rather than served at the entered weights. */
    expect(served.macros.calories).toBeGreaterThan(0);
    expect(Math.abs(served.macros.calories - served.target.calories)).toBeLessThan(served.target.calories * 0.35);
  });

  it("is served exactly as the member built it — nothing is added to it", () => {
    /* A lean bowl would otherwise pick up an oil or nuts to reach the fat target. */
    const lean: CustomBowl = { ...bowl, id: "b2", ingredients: [{ food: "cream of rice (dry)", grams: 60 }, { food: "whey isolate", grams: 40 }] };
    const bowls = bowlsForSlot([lean], "breakfast");
    const meals = peakMeals(plan(), { look: "lean-hard", bowls, snacks: [], swaps: {} });
    const served = meals.find((m) => m.plateId === bowlToSignature(lean).id);
    if (!served) return;
    expect(served.plate!.portions.map((x) => ("food" in x ? x.food : ""))).toEqual(["cream of rice (dry)", "whey isolate"]);
  });

  it("says what is wrong before it saves, and nothing when the bowl is fine", () => {
    expect(bowlProblem(bowl)).toBeNull();
    expect(bowlProblem({ name: " ", ingredients: bowl.ingredients })).toBe("no-name");
    expect(bowlProblem({ name: "x", ingredients: [] })).toBe("no-ingredients");
    expect(bowlProblem({ name: "x", ingredients: [{ food: "banana", grams: 0 }] })).toBe("bad-weight");
    expect(bowlProblem({ name: "x", ingredients: [{ food: "banana", grams: 5_000 }] })).toBe("bad-weight");
    expect(bowlProblem({ name: "x", ingredients: [{ food: "banana", grams: 50 }, { food: "banana", grams: 60 }] })).toBe("duplicate");
    expect(bowlProblem({ name: "x", ingredients: Array.from({ length: BOWL_MAX_INGREDIENTS + 1 }, () => ({ food: "banana" as const, grams: 50 })) })).toBe("too-many");
  });

  it("gives every bowl its own id", () => {
    expect(newBowlId()).not.toBe(newBowlId());
  });
});

describe("a lunch you build yourself", () => {
  const lunch: CustomBowl = {
    id: "b9",
    name: "Chicken, rice and broccoli",
    slot: "lunch",
    ingredients: [
      { food: "chicken breast", grams: 200 },
      { food: "jasmine rice", grams: 250 },
      { food: "broccoli", grams: 150 },
    ],
    createdAt: "2026-09-22T12:00:00.000Z",
  };

  it("opens from a starting point that suits the meal", () => {
    expect(BOWL_STARTERS.lunch.map((i) => i.food)).toEqual(["chicken breast", "jasmine rice", "broccoli"]);
    expect(BOWL_STARTERS.breakfast.some((i) => i.food === "cream of rice (dry)")).toBe(true);
    for (const slot of Object.keys(BOWL_STARTERS) as Array<keyof typeof BOWL_STARTERS>) {
      expect(bowlProblem({ name: "x", ingredients: BOWL_STARTERS[slot] }), slot).toBeNull();
    }
  });

  it("comes with its own steps and a line on why each item is there", () => {
    const day = buildDailyFuelPlan({
      goal: PEAK_LOOKS["lean-hard"].goal, isTrainingDay: false, sessionName: "Recovery Day", mealWindows: windows, bodyweightLb: 200, sleepTarget: "22:30", wakeTime: "06:30",
    });
    const bowls = bowlsForSlot([lunch], "lunch");
    const meals = peakMeals(day, { look: "lean-hard", bowls, snacks: [] });
    const served = meals.find((m) => m.plateId === bowlToSignature(lunch).id);
    expect(served, "the member's lunch is served").toBeTruthy();
    expect(served!.recipe.length).toBeGreaterThan(0);
    expect(served!.purposes.map((x) => x.item)).toContain("chicken breast");
    /* Its own ingredients, scaled — never rewritten. */
    expect(served!.plate!.portions.map((x) => ("food" in x ? x.food : ""))).toEqual(["chicken breast", "jasmine rice", "broccoli"]);
  });
});
