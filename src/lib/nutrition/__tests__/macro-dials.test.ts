import { describe, expect, it } from "vitest";

import { summarizeLoggedMacros, summarizeLoggedProtein, type PlannedFuelMeal } from "../fuel-plan";
import { macroDials } from "../nutrition-room";

const meal = (id: string, proteinG: number, carbsG: number, fatG: number): Pick<PlannedFuelMeal, "id" | "macros"> => ({
  id,
  macros: { proteinG, carbsG, fatG, calories: proteinG * 4 + carbsG * 4 + fatG * 9 },
});
const MEALS = [meal("a", 40, 60, 20), meal("b", 50, 80, 10), meal("c", 45, 90, 12), meal("d", 20, 25, 4)];
const TARGETS = { proteinG: 160, carbsG: 260, fatG: 50, calories: 2150 };

describe("summarizeLoggedMacros", () => {
  it("sums protein, carbs, fat and calories for logged meals only, with overrides", () => {
    expect(summarizeLoggedMacros(MEALS, ["a", "c"])).toEqual({ proteinG: 85, carbsG: 150, fatG: 32, calories: 85 * 4 + 150 * 4 + 32 * 9, mealsLogged: 2 });
    expect(summarizeLoggedMacros(MEALS, [])).toEqual({ proteinG: 0, carbsG: 0, fatG: 0, calories: 0, mealsLogged: 0 });
    const swapped = summarizeLoggedMacros(MEALS, ["a"], { a: { macros: { proteinG: 55, carbsG: 10, fatG: 5, calories: 305 } } });
    expect(swapped).toMatchObject({ proteinG: 55, carbsG: 10, fatG: 5, calories: 305 });
  });

  it("agrees with the protein sum every surface already shows", () => {
    expect(summarizeLoggedMacros(MEALS, ["b", "d"]).proteinG).toBe(summarizeLoggedProtein(MEALS, ["b", "d"]));
  });
});

describe("macroDials", () => {
  it("shows targets on empty dials when nothing is logged — never zeros as progress", () => {
    const model = macroDials({ meals: MEALS, loggedMealIds: [], targets: TARGETS })!;
    expect(model.empty).toBe(true);
    expect(model.dials.map((d) => d.state)).toEqual(["empty", "empty", "empty", "empty"]);
    expect(model.dials.map((d) => d.target)).toEqual([160, 260, 50, 2150]);
    expect(model.dials.every((d) => d.fraction === 0)).toBe(true);
    expect(model.dials[0].ariaLabel).toMatch(/nothing logged today, target 160 grams, estimated/);
  });

  it("says what is left plainly: to go, on target, over", () => {
    const model = macroDials({ meals: MEALS, loggedMealIds: ["a", "b"], targets: TARGETS })!;
    const [protein, carbs, fat, kcal] = model.dials;
    expect(protein).toMatchObject({ logged: 90, target: 160, state: "under", remaining: "70 g to go" });
    expect(carbs).toMatchObject({ logged: 140, remaining: "120 g to go" });
    expect(fat).toMatchObject({ logged: 30, remaining: "20 g to go" });
    expect(kcal).toMatchObject({ logged: 90 * 4 + 140 * 4 + 30 * 9, unit: "kcal", remaining: "960 to go" });
    expect(model.mealsLogged).toBe(2);
    expect(protein.ariaLabel).toBe("Protein, estimated: 90 of 160 grams. 70 g to go.");

    const onTarget = macroDials({ meals: MEALS, loggedMealIds: ["a", "b", "c"], targets: { ...TARGETS, proteinG: 138 } })!;
    expect(onTarget.dials[0]).toMatchObject({ logged: 135, state: "on-target", remaining: "On target", fraction: 135 / 138 });

    const over = macroDials({ meals: MEALS, loggedMealIds: ["a", "b", "c", "d"], targets: { ...TARGETS, fatG: 34 } })!;
    expect(over.dials[2]).toMatchObject({ logged: 46, state: "over", remaining: "12 g over", fraction: 1 });
  });

  it("is null without meal windows: there is nothing to log against", () => {
    expect(macroDials({ meals: [], loggedMealIds: [], targets: TARGETS })).toBeNull();
  });
});
