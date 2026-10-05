import { describe, expect, it } from "vitest";

import { FUEL_MEALS, estimateDailyTargets, windowShares, type DailyFuelPlan } from "../fuel-plan";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { getMealSwaps } from "../meal-swap";
import { PEAK_LOOKS } from "../peak-mode";
import { parsePlateId, plateId, resolveKitchen } from "../plate-rotation";
import {
  OWNER_FAVOURITE_IDS,
  OWNER_PERSONALIZATION,
  OWNER_WEEK,
  countVariety,
  dateAfter,
  mainProtein,
  ownerDay,
  platedMeals,
} from "./owner-seed";

const fortnight = (opts: Parameters<typeof ownerDay>[1] = {}) => Array.from({ length: 14 }, (_, d) => ownerDay(d, opts));
const allLines = (plans: DailyFuelPlan[]) => plans.flatMap((p) => p.meals.flatMap((m) => [m.name, ...m.ingredients]));

describe("the owner's plan — why it repeated (library plates, no date)", () => {
  it("served the same plates every day before the rotation", () => {
    const before = countVariety(fortnight({ date: null }));
    /* Without a date the plan is the fixed library pick: one dish per slot, every day. */
    expect(before.maxSameDish).toBe(14);
    expect(before.distinctDishes).toBeLessThanOrEqual(6);
  });
});

describe("the owner's plan — 14 days with the rotation", () => {
  const plans = fortnight();
  const count = countVariety(plans);

  it("never puts the same main protein twice in a day", () => {
    expect(count.daysWithRepeatedProtein).toBe(0);
    for (const plan of plans) {
      const proteins = platedMeals(plan).map(mainProtein);
      expect(new Set(proteins).size, plan.meals.map((m) => m.name).join(" | ")).toBe(proteins.length);
    }
  });

  it("never repeats a dish within three days (in fact, not at all in two weeks)", () => {
    expect(count.dishRepeatsWithin3Days).toBe(0);
    expect(count.maxSameDish).toBe(1);
  });

  it("covers every favourite — beef cuts, fish, poultry, eggs — within each week", () => {
    for (const week of [plans.slice(0, 7), plans.slice(7, 14)]) {
      const seen = new Set(week.flatMap((p) => platedMeals(p).map(mainProtein)));
      const missing = OWNER_FAVOURITE_IDS.filter((id) => !seen.has(id));
      /* A week has 25 plates and 12 proteins to walk: at most one favourite waits for the next week. */
      expect(missing.length, `missing ${missing.join(", ")}`).toBeLessThanOrEqual(1);
    }
    const fortnightSeen = new Set(plans.flatMap((p) => platedMeals(p).map(mainProtein)));
    for (const id of OWNER_FAVOURITE_IDS) expect(fortnightSeen.has(id), id).toBe(true);
  });

  it("never serves shellfish, or anything on the Peak Mode avoid list", () => {
    const lines = allLines(plans).join(" \n ").toLowerCase();
    expect(lines).not.toMatch(/shrimp|scallop|prawn|lobster|crab/);
    expect(lines).not.toMatch(/\bpork|bacon|\bsoy|tamari|teriyaki|gochujang|tofu|almond|walnut|sourdough|sesame/);
    /* Wheat pasta is out under "gluten"; the member's chickpea protein pasta stays. */
    expect(allLines(plans).filter((l) => /\bpasta\b/i.test(l) && !/protein pasta/i.test(l))).toEqual([]);
    expect(plans.flatMap((p) => p.meals).some((m) => m.id.includes("shrimp"))).toBe(false);
  });

  it("is not every plate lemon-herb, nor salmon at every turn", () => {
    const plates = plans.flatMap(platedMeals);
    expect(plates.filter((m) => /lemon-herb/i.test(m.name)).length).toBeLessThanOrEqual(Math.ceil(plates.length / 10));
    expect(plates.filter((m) => /salmon/i.test(m.name)).length).toBeLessThanOrEqual(Math.ceil(plates.length / 8));
    const finishes = new Set(plates.map((m) => parsePlateId(m.id.replace(/^fuel-[a-z-]+?-(?=plate\.)/, ""))?.finish));
    expect(finishes.size, "many flavours across the fortnight").toBeGreaterThanOrEqual(12);
  });

  it("speaks about food only: no banned safety language, no health claims, no promises", () => {
    const copy = plans.flatMap((p) => [p.varietyNote ?? "", ...p.meals.flatMap((m) => [m.name, m.smartRead, ...(m.personalizationTags ?? []), ...m.ingredients])]);
    for (const line of copy) {
      expect(bannedLanguageIn(line), line).toEqual([]);
      expect(line).not.toMatch(/burn|detox|fat loss|guarantee|boost|cleanse|heal|cure|supplement/i);
    }
  });

  it("names favourites with the member's own quality words and tags them as their picks", () => {
    const plates = plans.flatMap(platedMeals);
    expect(plates.some((m) => /Grass-Fed (Ribeye|NY Strip|Ground Beef)/.test(m.name))).toBe(true);
    expect(plates.some((m) => /Pasture-Raised Egg/.test(m.name))).toBe(true);
    expect(plates.some((m) => m.personalizationTags?.some((t) => /· your pick$/.test(t)))).toBe(true);
    /* No typo ever reaches the screen. */
    expect(allLines(plans).join(" ")).not.toMatch(/gress|thilapia/i);
  });

  it("batch-cooks lunch: one protein for three days, named as the batch, a different plate each day", () => {
    const lunches = plans.map((p) => p.meals.find((m) => m.slot === "lunch")!);
    for (const lunch of lunches) {
      expect(lunch.name).toMatch(/^Batch /);
      expect(lunch.prep).toContain("batch-cooked");
      expect(lunch.personalizationTags?.some((t) => /^Batch · cooked [A-Z][a-z]{2}$/.test(t))).toBe(true);
    }
    const proteins = lunches.map(mainProtein);
    /* Runs of the same batch protein are at most three days long, and the plate changes inside a run. */
    let run = 1;
    for (let i = 1; i < lunches.length; i += 1) {
      run = proteins[i] === proteins[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
      if (proteins[i] === proteins[i - 1]) expect(lunches[i].name).not.toBe(lunches[i - 1].name);
    }
  });

  it("keeps every plate on its window's share of today's targets, so the day adds up", () => {
    for (const [d, plan] of plans.entries()) {
      const totals = plan.meals.filter((m) => !m.optional).reduce(
        (acc, m) => ({ p: acc.p + m.macros.proteinG, k: acc.k + m.macros.calories }),
        { p: 0, k: 0 },
      );
      expect(Math.abs(totals.p - plan.targets.proteinG) / plan.targets.proteinG, `day ${d} protein`).toBeLessThan(0.1);
      expect(Math.abs(totals.k - plan.targets.calories) / plan.targets.calories, `day ${d} calories`).toBeLessThan(0.1);
      for (const meal of platedMeals(plan)) {
        expect(meal.macros.proteinG, meal.name).toBeGreaterThanOrEqual(25);
        expect(meal.macros.proteinG, meal.name).toBeLessThanOrEqual(70);
        expect(meal.macros.calories, meal.name).toBeGreaterThan(300);
      }
    }
  });

  it("keeps the targets themselves unchanged, and adds carbs and fat that fill the calories", () => {
    for (const training of [true, false]) {
      const t = estimateDailyTargets(PEAK_LOOKS["lean-hard"].goal, 205, training);
      expect(t.proteinG).toBe(Math.round(205 * 0.95));
      expect(t.calories).toBe(Math.round(205 * 13 + (training ? 180 : 0)));
      expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.calories)).toBeLessThanOrEqual(4);
    }
  });

  it("keeps meal timing: the same windows, times and ids' windows as before", () => {
    for (let d = 0; d < 7; d += 1) {
      const withDate = ownerDay(d);
      const without = ownerDay(d, { date: null });
      expect(withDate.meals.map((m) => [m.slot, m.time, m.windowLabel])).toEqual(without.meals.map((m) => [m.slot, m.time, m.windowLabel]));
    }
  });
});

describe("deterministic per date", () => {
  it("builds the same plates for the same date, every time", () => {
    expect(ownerDay(3)).toEqual(ownerDay(3));
    expect(ownerDay(10).meals.map((m) => m.id)).toEqual(ownerDay(10).meals.map((m) => m.id));
  });

  it("builds a different day for a different date", () => {
    const a = platedMeals(ownerDay(0)).map((m) => m.name);
    const b = platedMeals(ownerDay(7)).map((m) => m.name); // the same weekday, a week later
    expect(a).not.toEqual(b);
  });

  it("never moves the plates still to come when meals are logged", () => {
    for (let d = 0; d < 14; d += 1) {
      const plan = ownerDay(d);
      const ids = plan.meals.map((m) => m.id);
      for (let n = 1; n < ids.length; n += 1) {
        expect(ownerDay(d, { loggedMealIds: ids.slice(0, n) }).meals.map((m) => m.id), `day ${d}, ${n} logged`).toEqual(ids);
      }
    }
  });

  it("keeps a logged plate exactly as logged, even when the member's picks change mid-day", () => {
    const plan = ownerDay(2);
    const lunch = plan.meals.find((m) => m.slot === "lunch")!;
    const changed = ownerDay(2, {
      personalization: { ...OWNER_PERSONALIZATION, favoriteProteinSources: ["salmon"], prepPreference: "cook-fresh" },
      loggedMealIds: [lunch.id],
    });
    const kept = changed.meals.find((m) => m.slot === "lunch")!;
    expect(kept.id).toBe(lunch.id);
    expect(kept.name).toBe(lunch.name);
    /* The rest of the day rotates around it: still no protein twice. */
    const proteins = platedMeals(changed).map(mainProtein);
    expect(new Set(proteins).size).toBe(proteins.length);
  });

  it("keeps a library meal logged before the rotation shipped in its window", () => {
    const window = ownerDay(1).meals.find((m) => m.slot === "lunch")!;
    const windowId = window.id.slice("fuel-".length, window.id.indexOf("-plate."));
    const legacy = `fuel-${windowId}-chicken-sourdough-plate`;
    const plan = ownerDay(1, { loggedMealIds: [legacy] });
    const lunch = plan.meals.find((m) => m.slot === "lunch")!;
    expect(lunch.id).toBe(legacy);
    expect(lunch.name).toBe(FUEL_MEALS.find((m) => m.id === "chicken-sourdough-plate")!.name);
  });

  it("round-trips a plate id", () => {
    const spec = { protein: "strip", carb: "gold-potato", produce: "asparagus", finish: "chimichurri", method: 2, batch: false };
    expect(parsePlateId(plateId(spec))).toEqual(spec);
    expect(parsePlateId("plate.unicorn.none.asparagus.chimichurri.0")).toBeNull();
    expect(parsePlateId("chicken-sourdough-plate")).toBeNull();
  });
});

describe("when filters leave too little", () => {
  it("widens within safe foods and says so, rather than repeating", () => {
    const personalization = { ...OWNER_PERSONALIZATION, kitchen: null, favoriteProteinSources: ["shrimp", "salmon"], allergies: ["shell fish"], prepPreference: "cook-fresh" as const };
    const plans = fortnight({ personalization });
    expect(plans[0].varietyNote).toMatch(/leave 1 protein .* so Reserve added .* to keep the week varied/);
    const count = countVariety(plans);
    expect(count.daysWithRepeatedProtein).toBe(0);
    expect(count.dishRepeatsWithin3Days).toBe(0);
    expect(allLines(plans).join(" ").toLowerCase()).not.toMatch(/shrimp|scallop/);
    /* The why line on an added protein says it was added. */
    expect(plans.flatMap(platedMeals).some((m) => /Reserve added/.test(m.smartRead))).toBe(true);
  });

  it("still varies the week for a member with no picks at all", () => {
    const personalization = { dietStyle: "standard", prepPreference: "cook-fresh" as const };
    const count = countVariety(fortnight({ personalization }));
    expect(count.daysWithRepeatedProtein).toBe(0);
    expect(count.dishRepeatsWithin3Days).toBe(0);
    expect(Object.keys(count.proteinCounts).length).toBeGreaterThanOrEqual(10);
  });

  it("honours a vegetarian style with plant and egg plates only", () => {
    const personalization = { dietStyle: "vegetarian", prepPreference: "cook-fresh" as const };
    const plans = fortnight({ personalization });
    const proteins = new Set(plans.flatMap(platedMeals).map(mainProtein));
    for (const p of proteins) expect(["tofu", "tempeh", "eggs", "greek-yogurt", "cottage-cheese"]).toContain(p);
  });

  it("keeps the library plates for very-low-carb styles it does not serve", () => {
    expect(resolveKitchen({ dietStyle: "carnivore" })).toBeNull();
    const plan = ownerDay(0, { personalization: { dietStyle: "keto" } });
    expect(plan.meals.some((m) => m.id.includes("plate."))).toBe(false);
  });

  it("drops the Peak Mode kitchen when Peak Mode is off", () => {
    const kitchen = resolveKitchen({ favoriteProteins: ["chicken breast"], kitchen: null });
    expect(kitchen?.mains.some((m) => m.pick === "kitchen")).toBe(false);
  });
});

describe("swaps respect the allergy and the avoid list", () => {
  it('never offers shrimp or scallops for "shell fish"', () => {
    for (const slot of ["lunch", "dinner", "post-workout"] as const) {
      const swaps = getMealSwaps({ currentName: "x", currentMacros: { calories: 500, proteinG: 45, carbsG: 50, fatG: 12 }, slot, goal: "shred", isTrainingDay: true, personalization: OWNER_PERSONALIZATION }, 20);
      for (const s of swaps) expect([s.name, ...s.ingredients].join(" ").toLowerCase()).not.toMatch(/shrimp|scallop/);
    }
  });
});

describe("window shares", () => {
  it("splits what the day has left after fixed plates, leaning carbs toward training", () => {
    const shares = windowShares(["breakfast", "lunch", "pre-workout", "post-workout"], { proteinG: 200, carbsG: 360, fatG: 60 }, { calories: 240, proteinG: 20, carbsG: 30, fatG: 4 });
    expect(shares.reduce((s, x) => s + x.proteinG, 0)).toBeCloseTo(180, -1);
    expect(shares.reduce((s, x) => s + x.carbsG, 0)).toBeCloseTo(330, -1);
    expect(shares[3].carbsG).toBeGreaterThan(shares[0].carbsG);
    expect(shares[2].fatG).toBeLessThan(shares[0].fatG);
  });
});

it("the owner's week covers five training days and two recovery days", () => {
  expect(OWNER_WEEK.filter(Boolean)).toHaveLength(5);
  expect(dateAfter("2026-09-14", 7)).toBe("2026-09-21");
});
