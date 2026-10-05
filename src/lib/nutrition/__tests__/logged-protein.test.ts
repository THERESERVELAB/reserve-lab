import { describe, expect, it } from "vitest";

import { summarizeLoggedProtein } from "../fuel-plan";

const macros = (proteinG: number) => ({ calories: 500, proteinG, carbsG: 50, fatG: 10 });

describe("summarizeLoggedProtein", () => {
  const meals = [
    { id: "a", macros: macros(40) },
    { id: "b", macros: macros(30) },
    { id: "c", macros: macros(25) },
  ];

  it("sums protein from logged meals only", () => {
    expect(summarizeLoggedProtein(meals, ["a", "c"])).toBe(65);
    expect(summarizeLoggedProtein(meals, [])).toBe(0);
  });

  it("uses an override's macros in place of the planned meal", () => {
    expect(summarizeLoggedProtein(meals, ["a"], { a: { macros: macros(55) } })).toBe(55);
  });
});
