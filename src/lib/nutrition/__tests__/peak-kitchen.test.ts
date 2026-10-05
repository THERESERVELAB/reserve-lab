import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildDailyFuelPlan } from "../fuel-plan";
import { BIG_MEAL_CALORIES, PEAK_LOOKS, defaultDayTargets, peakMeals, swapOptions, withExtraMeal } from "../peak-mode";
import { AVOID_CHOICES, CARB_CHOICES, FOOD_PURPOSE, PROTEIN_CHOICES, carbNote, personalize, platesFor, purposesFor, recipeFor, shoppingList, targetMatch, weekDates, withFatFiller, type PeakKitchenPrefs } from "../peak-kitchen";
import { PEAK_FOODS, PEAK_SIGNATURES, scalesFor, signatureIngredients, signatureMacros, type PlateScale } from "../peak-signatures";

const sig = (id: string) => PEAK_SIGNATURES.find((s) => s.id === id)!;
const prefs = (p: Partial<PeakKitchenPrefs>): PeakKitchenPrefs => ({ carbs: [], proteins: [], avoid: [], answeredAt: "2026-09-17T00:00:00Z", ...p });

const windows = [
  { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
  { id: "midday", label: "Lunch", time: "12:30", enabled: true },
  { id: "pre-workout", label: "Pre-workout", time: "15:30", enabled: true },
  { id: "post-workout", label: "Post-workout", time: "18:30", enabled: true },
  { id: "night", label: "Dinner", time: "20:00", enabled: true },
];
const plan = buildDailyFuelPlan({ goal: PEAK_LOOKS["lean-hard"].goal, isTrainingDay: true, sessionName: "Push", mealWindows: windows, bodyweightLb: 200, sleepTarget: "23:00", wakeTime: "07:00" });

describe("peak kitchen — personal plates", () => {
  it("swaps the main carb to the member's pick, matched on carb grams, and renames the plate", () => {
    const shrimp = sig("peak-pineapple-shrimp");
    const mine = personalize(shrimp, prefs({ carbs: ["sweet-potato"] }))!;
    expect(mine.swapped).toEqual([{ from: "jasmine rice", to: "sweet potato" }]);
    const rice = shrimp.portions.find((p) => "food" in p && p.food === "jasmine rice") as { grams: number };
    const potato = mine.plate.portions.find((p) => "food" in p && p.food === "sweet potato") as { grams: number };
    const carbs = (food: keyof typeof PEAK_FOODS, g: number) => (PEAK_FOODS[food].c * g) / 100;
    expect(Math.abs(carbs("sweet potato", potato.grams) - carbs("jasmine rice", rice.grams))).toBeLessThan(2);
    expect(mine.plate.name).toBe("Pineapple Shrimp & Sweet Potato Bowl");
  });

  it("swaps the main protein to the member's pick, matched on protein grams, and drops a fit reason about the old protein", () => {
    const shrimp = sig("peak-pineapple-shrimp");
    const mine = personalize(shrimp, prefs({ proteins: ["chicken"] }))!;
    expect(mine.swapped[0]).toEqual({ from: "shrimp", to: "chicken breast" });
    expect(mine.plate.fits.lipids).toBeUndefined();
    expect(mine.plate.fits.cardiovascular).toBeDefined();
    expect(Math.abs(signatureMacros(mine.plate).proteinG - signatureMacros(shrimp).proteinG)).toBeLessThan(4);
  });

  it("keeps a plate whose foods the member already picked, and hides plates with foods they avoid", () => {
    expect(personalize(sig("peak-pineapple-chicken-jasmine"), prefs({ carbs: ["rice"], proteins: ["chicken"] }))!.swapped).toEqual([]);
    expect(personalize(sig("peak-yogurt-walnut-kiwi"), prefs({ avoid: ["dairy"] }))).toBeNull();
    expect(personalize(sig("peak-cod-sweet-potato"), prefs({ avoid: ["fish"] }))).toBeNull();
    /* An avoided main protein is replaced when the member likes another. */
    const cod = personalize(sig("peak-cod-sweet-potato"), prefs({ avoid: ["fish"], proteins: ["turkey"] }))!;
    expect(cod.plate.portions.some((p) => "food" in p && p.food === "99% lean ground turkey")).toBe(true);
  });

  it("with no answers, plates stay as Reserve built them", () => {
    for (const s of PEAK_SIGNATURES) expect(personalize(s, null)!.swapped).toEqual([]);
  });

  it("an egg-free, dairy-free member still has a plate for every meal of the lean look except where none exists", () => {
    const answers = prefs({ avoid: ["eggs", "dairy"], proteins: ["chicken", "salmon"], carbs: ["rice", "gold-potato"] });
    expect(platesFor("lunch", "lean-hard", answers, new Set()).length).toBeGreaterThan(0);
    expect(platesFor("dinner", "lean-hard", answers, new Set()).length).toBeGreaterThan(0);
    expect(platesFor("breakfast", "lean-hard", answers, new Set()).every((p) => p.plate.portions.every((x) => !("food" in x) || !["egg whites", "whole eggs", "nonfat Greek yogurt", "whey isolate"].includes(x.food)))).toBe(true);
  });
});

describe("peak kitchen — target match, swaps and recipes", () => {
  it("target match is arithmetic on calories and protein", () => {
    expect(targetMatch({ calories: 500, proteinG: 40, carbsG: 0, fatG: 0 }, { calories: 500, proteinG: 40 })).toBe(100);
    expect(targetMatch({ calories: 550, proteinG: 36, carbsG: 0, fatG: 0 }, { calories: 500, proteinG: 40 })).toBe(90);
    expect(targetMatch({ calories: 5000, proteinG: 0, carbsG: 0, fatG: 0 }, { calories: 500, proteinG: 40 })).toBe(0);
  });

  it("a swapped plate replaces the rotation for that slot, and hidden plates never show", () => {
    const first = peakMeals(plan, { look: "lean-hard", dayIndex: 0 });
    const lunch = first.find((m) => m.slot === "lunch")!;
    const other = swapOptions(lunch, "lean-hard", null, [], []).find((o) => !o.current)!;
    const swapped = peakMeals(plan, { look: "lean-hard", dayIndex: 0, swaps: { lunch: other.id } });
    expect(swapped.find((m) => m.slot === "lunch")!.plateId).toBe(other.id);
    const hidden = peakMeals(plan, { look: "lean-hard", dayIndex: 0, hidden: [lunch.plateId!] });
    expect(hidden.find((m) => m.slot === "lunch")!.plateId).not.toBe(lunch.plateId);
    for (const m of first.filter((x) => x.signature)) {
      expect(m.match).toBeGreaterThanOrEqual(0);
      expect(m.match).toBeLessThanOrEqual(100);
      expect(m.recipe.length).toBeGreaterThan(1);
    }
  });

  it("recipes cook what is on the plate, with safe temperatures for meat and fish, and no compound language", () => {
    const steps = recipeFor(personalize(sig("peak-pineapple-shrimp"), prefs({ proteins: ["chicken"], carbs: ["protein-pasta"] }))!.plate);
    expect(steps.join(" ")).toMatch(/chicken.*165°F/);
    expect(steps.join(" ")).toMatch(/protein pasta/);
    expect(steps.join(" ")).not.toMatch(/shrimp|jasmine/i);
    const all = PEAK_SIGNATURES.flatMap((s) => recipeFor(s)).join(" ");
    expect(bannedLanguageIn(all)).toEqual([]);
  });
});

describe("peak kitchen — week and shopping list", () => {
  it("maps seven dates onto the member's Monday-first training week", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ sessionName: `Day ${i}`, recovery: i === 6 }));
    const days = weekDates(new Date(2026, 8, 17), week); // a Thursday
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: "2026-09-17", sessionName: "Day 3", training: true });
    expect(days[3]).toMatchObject({ date: "2026-09-20", training: false });
  });

  it("adds up the week by food, lists meat raw and rice dry, and collects to-taste items", () => {
    const shrimp = sig("peak-pineapple-shrimp");
    const list = shoppingList([
      { portions: shrimp.portions, scale: 1 },
      { portions: shrimp.portions, scale: 1 },
    ]);
    const all = list.aisles.flatMap((a) => a.items);
    const raw = all.find((i) => i.key === "shrimp")!;
    expect(raw.boughtAs).toBe("raw");
    expect(raw.grams).toBe(500); // 2 × 200 g cooked × 1.25
    const rice = all.find((i) => i.key === "jasmine rice")!;
    expect(rice.boughtAs).toBe("dry");
    expect(rice.grams).toBe(130); // 400 g cooked ÷ 3
    expect(list.aisles.map((a) => a.aisle)).toEqual(["Protein", "Produce", "Grains & starches", "Pantry"]);
    const recovery = sig("peak-cream-of-rice-recovery-bowl");
    expect(shoppingList([{ portions: recovery.portions, scale: 1 }]).toTaste).toEqual(["cinnamon"]);
  });
});

describe("peak kitchen — the full food list", () => {
  it("offers a wide range of carbs and proteins, each a real food with sane macros, a recipe step and an aisle", () => {
    expect(CARB_CHOICES.length).toBeGreaterThanOrEqual(12);
    expect(PROTEIN_CHOICES.length).toBeGreaterThanOrEqual(12);
    expect(AVOID_CHOICES.map((a) => a.key)).toEqual(expect.arrayContaining(["pork", "soy"]));
    const keys = [...CARB_CHOICES, ...PROTEIN_CHOICES].map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const choice of [...CARB_CHOICES, ...PROTEIN_CHOICES]) {
      const f = PEAK_FOODS[choice.food];
      expect(f, choice.key).toBeDefined();
      expect(Math.abs(f.p * 4 + f.c * 4 + f.f * 9 - f.kcal), choice.key).toBeLessThan(f.kcal * 0.12);
      const plate = { ...sig("peak-pineapple-chicken-jasmine"), portions: [{ food: choice.food, grams: 150, group: "protein" as const }] };
      expect(recipeFor(plate)[0], choice.key).not.toMatch(/^Plate it up/);
      expect(shoppingList([{ portions: plate.portions, scale: 1 }]).aisles.length, choice.key).toBe(1);
    }
  });

  it("swaps to tofu matched on protein, and to pasta matched on carbs", () => {
    const chicken = sig("peak-pineapple-chicken-jasmine");
    const mine = personalize(chicken, prefs({ proteins: ["tofu"], carbs: ["pasta"] }))!;
    expect(mine.swapped.map((s) => s.to)).toEqual(["extra-firm tofu", "pasta"]);
    expect(mine.plate.name).toBe("Pineapple Tofu & Pasta");
    /* Protein is matched on the main protein; pasta brings a few grams more protein than rice. */
    expect(Math.abs(signatureMacros(mine.plate).proteinG - signatureMacros(chicken).proteinG)).toBeLessThanOrEqual(8);
  });

  it("gluten-free and soy-free answers keep those foods off every plate", () => {
    const answers = prefs({ carbs: ["pasta", "couscous", "rice"], proteins: ["tofu", "chicken"], avoid: ["gluten", "soy"] });
    for (const slot of ["breakfast", "lunch", "dinner", "post-workout", "snack"] as const) {
      for (let turn = 0; turn < 3; turn += 1) {
        for (const p of platesFor(slot, "recomp", answers, new Set(), turn)) {
          for (const x of p.plate.portions) if ("food" in x) expect(["pasta", "couscous", "sourdough", "whole wheat pasta", "extra-firm tofu", "tempeh"], p.plate.name).not.toContain(x.food);
        }
      }
    }
  });
});

describe("peak kitchen — every item counts", () => {
  it("every food on every plate says what it is doing there", () => {
    for (const sig of PEAK_SIGNATURES) {
      for (const portion of sig.portions) {
        if ("food" in portion) expect(FOOD_PURPOSE[portion.food], `${sig.id}: ${portion.food}`).toBeTruthy();
      }
      expect(purposesFor(sig).length, sig.id).toBeGreaterThan(2);
    }
  });

  it("the training bowl's own items each earn their place, seasoning included", () => {
    const bowl = purposesFor(sig("peak-cream-of-rice-recovery-bowl"));
    const why = (item: string) => bowl.find((x) => x.item === item)?.why ?? "";
    expect(why("cream of rice")).toMatch(/fast, low-fiber carb/);
    expect(why("banana")).toMatch(/quick carbs plus potassium/);
    expect(why("honey")).toMatch(/fast sugar/);
    expect(why("blueberries")).toMatch(/fiber and vitamin C/);
    expect(why("whey isolate")).toMatch(/fast protein/);
    expect(why("cinnamon")).toMatch(/sweetness without sugar/);
    const salted = purposesFor({ ...sig("peak-cream-of-rice-recovery-bowl"), portions: [{ name: "sea salt", amount: "pinch", group: "finish" }] });
    expect(salted[0].why).toMatch(/sodium, which heavy sweat takes out/);
  });

  it("carbs are placed by the clock, and none of it reads as a promise", () => {
    expect(carbNote("pre-workout", true)).toMatch(/fast and low in fiber and fat/);
    expect(carbNote("post-workout", true)).toMatch(/glycogen is being replaced/);
    expect(carbNote("dinner", true)).toMatch(/slower and higher in fiber/);
    expect(carbNote("post-workout", false)).toMatch(/No session today/);
    const copy = [...Object.values(FOOD_PURPOSE), carbNote("pre-workout", true), carbNote("dinner", false)].join(" | ");
    expect(bannedLanguageIn(copy)).toEqual([]);
    expect(copy).not.toMatch(/\bburns?\b|\bboosts?\b|\bmaximis|\bmaximiz|\bguarantee/i);
  });
});

describe("peak kitchen — the day adds up to the targets", () => {
  it("scales the protein, carb and fat parts of a plate to hit all four targets", () => {
    const plate = sig("peak-turkey-sweet-potato");
    const base = signatureMacros(plate);
    const target = {
      calories: Math.round(base.calories * 1.3),
      proteinG: Math.round(base.proteinG * 0.8),
      carbsG: Math.round(base.carbsG * 1.9),
      fatG: Math.round(base.fatG * 1.2),
    };
    const scale = scalesFor(plate, target);
    expect(scale.protein).toBeLessThan(1);
    expect(scale.carb).toBeGreaterThan(1);
    const served = signatureMacros(plate, scale);
    for (const macro of ["calories", "proteinG", "carbsG", "fatG"] as const) {
      expect(Math.abs(served[macro] - target[macro]), macro).toBeLessThan(target[macro] * 0.15);
    }
    const grams = (food: string, s: PlateScale | number) => {
      const row = signatureIngredients(plate, s).find((i) => i.name === food)!;
      return Number.parseInt(row.amount, 10);
    };
    expect(grams("99% lean ground turkey", scale)).toBeLessThan(grams("99% lean ground turkey", 1));
    expect(grams("sweet potato", scale)).toBeGreaterThan(grams("sweet potato", 1));
  });

  it("a whole day of plates lands near the day's calorie, protein, carb and fat targets", () => {
    const day = defaultDayTargets(plan);
    const meals = peakMeals(plan, { look: "lean-hard", dayIndex: 2, dayTargets: day });
    const served = meals.reduce(
      (sum, m) => ({ calories: sum.calories + m.macros.calories, proteinG: sum.proteinG + m.macros.proteinG, carbsG: sum.carbsG + m.macros.carbsG, fatG: sum.fatG + m.macros.fatG }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
    for (const macro of ["calories", "proteinG", "carbsG", "fatG"] as const) {
      expect(Math.abs(served[macro] - day[macro]), `${macro}: ${served[macro]} vs ${day[macro]}`).toBeLessThan(day[macro] * 0.25);
    }
    /* Every meal is measured against its share of the day, for all four macros. */
    for (const m of meals) {
      expect(m.target.calories).toBeGreaterThan(0);
      expect(m.target.carbsG + m.target.fatG).toBeGreaterThan(0);
    }
  });
});

describe("peak kitchen — closing a fat gap", () => {
  it("adds one unsaturated fat, sized to the gap, only when the plate cannot get there itself", () => {
    const lean = sig("peak-pineapple-chicken-jasmine");
    const none = withFatFiller(lean, { fatG: 30 }, { fatG: 32 });
    expect(none.added).toBeNull();
    const filled = withFatFiller(lean, { fatG: 8 }, { fatG: 25 });
    expect(filled.added).toMatchObject({ food: "extra virgin olive oil" });
    expect(filled.added!.grams).toBeLessThanOrEqual(25);
    const oil = filled.plate.portions.find((x) => "food" in x && x.food === "extra virgin olive oil") as { grams: number };
    expect(Math.abs((oil.grams * PEAK_FOODS["extra virgin olive oil"].f) / 100 - 17)).toBeLessThan(6);
  });

  it("never fills with a food the member does not eat", () => {
    const lean = sig("peak-pineapple-chicken-jasmine");
    const noOil = withFatFiller(lean, { fatG: 5 }, { fatG: 30 }, new Set(["extra virgin olive oil"]));
    expect(noOil.added?.food).toBe("almonds");
    const noneLeft = withFatFiller(lean, { fatG: 5 }, { fatG: 30 }, new Set(["extra virgin olive oil", "almonds", "avocado"]));
    expect(noneLeft.added).toBeNull();
    expect(noneLeft.plate).toBe(lean);
  });

  it("the day says so on the plate: a filler explains itself", () => {
    const meals = peakMeals(plan, { look: "lean-hard", dayIndex: 4, dayTargets: defaultDayTargets(plan) });
    const withFiller = meals.filter((m) => m.purposes.some((x) => x.why.includes("added to reach the fat")));
    for (const m of withFiller) {
      expect(m.ingredientsDetailed?.some((i) => ["extra virgin olive oil", "almonds", "avocado"].includes(i.name))).toBe(true);
    }
  });
});

describe("peak kitchen — a sixth meal on big days", () => {
  /* Three windows, so the engine has not already filled the day to six. */
  const threeWindows = windows.filter((w) => ["morning-anchor", "midday", "night"].includes(w.id));
  const dayOf = (isTrainingDay: boolean, look: keyof typeof PEAK_LOOKS) =>
    buildDailyFuelPlan({ goal: PEAK_LOOKS[look].goal, isTrainingDay, sessionName: "Push", mealWindows: threeWindows, bodyweightLb: 230, sleepTarget: "23:00", wakeTime: "07:00" });

  it("adds one meal when the day asks more of each plate than a plate should carry", () => {
    const small = dayOf(true, "lean-hard");
    expect(withExtraMeal(small.meals, small.meals.length * (BIG_MEAL_CALORIES - 50))).toHaveLength(small.meals.length);
    const big = withExtraMeal(small.meals, small.meals.length * (BIG_MEAL_CALORIES + 100));
    expect(big).toHaveLength(small.meals.length + 1);
    const extra = big.find((m) => m.id === "peak-extra-meal")!;
    expect(extra.windowLabel).toBe("Extra Meal");
    expect(extra.slot).toBe("snack");
    /* Never a seventh. */
    expect(withExtraMeal(big, 99_999)).toHaveLength(big.length);
  });

  it("drops it into the longest gap, with a time between the meals either side", () => {
    const meals = dayOf(true, "lean-hard").meals;
    const big = withExtraMeal(meals, meals.length * (BIG_MEAL_CALORIES + 100));
    const at = big.findIndex((m) => m.id === "peak-extra-meal");
    const minutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
    const before = minutes(big[at - 1].time);
    const after = minutes(big[at + 1]?.time ?? null);
    const extra = minutes(big[at].time);
    expect(extra).not.toBeNull();
    if (before !== null && extra !== null) expect(extra).toBeGreaterThan(before);
    if (after !== null && extra !== null) expect(extra).toBeLessThan(after);
  });

  it("a big day serves six plates, and lands closer than five could", () => {
    const plan = dayOf(true, "full-hard");
    const day = defaultDayTargets(plan);
    const meals = peakMeals(plan, { look: "full-hard", dayIndex: 1, dayTargets: day });
    expect(meals.length).toBe(plan.meals.length + 1);
    expect(meals.filter((m) => m.windowLabel === "Extra Meal")).toHaveLength(1);
    const served = meals.reduce((sum, m) => sum + m.macros.calories, 0);
    expect(served).toBeGreaterThan(day.calories * 0.85);
    /* The extra meal is a real plate: food, a recipe and a target of its own. */
    const extra = meals.find((m) => m.windowLabel === "Extra Meal")!;
    expect(extra.signature).toBe(true);
    expect(extra.recipe.length).toBeGreaterThan(1);
    expect(extra.target.calories).toBeGreaterThan(0);
  });
});
