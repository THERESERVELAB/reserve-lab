import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildDailyFuelPlan } from "../fuel-plan";
import { PEAK_LOOKS, PEAK_LOOK_ORDER, defaultDayTargets, peakMeals, swapKey, withSnacks } from "../peak-mode";
import { PEAK_SIGNATURES } from "../peak-signatures";

/* ════════════════════════════════════════════════════════════════════════
   SNACKS BETWEEN MEALS — the member picks mid-morning, afternoon and evening;
   each lands in real room between meals, takes a share of the day, and gets
   a snack plate for the look (cream of rice and oat bowls, yogurt, rice
   cakes) that the member can swap on its own.
   ════════════════════════════════════════════════════════════════════════ */

/* Three meals a long way apart: breakfast 7:30, lunch 12:30, dinner 18:30, lights out 22:30. */
const windows = [
  { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
  { id: "midday", label: "Lunch", time: "12:30", enabled: true },
  { id: "night", label: "Dinner", time: "18:30", enabled: true },
];
const plan = (look: keyof typeof PEAK_LOOKS = "lean-hard") =>
  buildDailyFuelPlan({ goal: PEAK_LOOKS[look].goal, isTrainingDay: false, sessionName: "Recovery Day", mealWindows: windows, bodyweightLb: 200, sleepTarget: "22:30", wakeTime: "06:30" });

const snacksOf = <T extends { id: string }>(meals: T[]): T[] => meals.filter((m) => m.id.startsWith("peak-snack-"));

describe("snacks between meals", () => {
  it("by default: one mid-morning and one afternoon, between the meals, not on top of them", () => {
    const meals = peakMeals(plan(), { look: "lean-hard", dayIndex: 0 });
    const snacks = snacksOf(meals);
    expect(snacks.map((s) => s.id)).toEqual(["peak-snack-mid-morning", "peak-snack-afternoon"]);
    expect(meals.find((m) => m.id === "peak-snack-mid-morning")!.time).toBe("10:00");
    expect(meals.find((m) => m.id === "peak-snack-afternoon")!.time).toBe("15:30");
    /* In order through the day. */
    const times = meals.map((m) => m.time);
    expect(times).toEqual([...times].sort());
  });

  it("every snack gets a snack plate for the look, and no plate repeats in a day", () => {
    for (const look of PEAK_LOOK_ORDER) {
      const meals = peakMeals(plan(look), { look, dayIndex: 2, snacks: ["mid-morning", "afternoon", "evening"] });
      const snacks = snacksOf(meals);
      expect(snacks, look).toHaveLength(3);
      for (const s of snacks) {
        const sig = PEAK_SIGNATURES.find((x) => x.id === s.plateId);
        expect(sig?.slot, `${look} ${s.id}`).toBe("snack");
        expect(sig?.looks).toContain(look);
      }
      const ids = meals.filter((m) => m.plateId).map((m) => m.plateId);
      expect(new Set(ids).size, look).toBe(ids.length);
    }
  });

  it("an evening snack stays at least an hour before lights out", () => {
    const meals = peakMeals(plan(), { look: "lean-hard", snacks: ["evening"], sleepTime: "22:30" });
    const evening = meals.find((m) => m.id === "peak-snack-evening")!;
    expect((evening.time ?? "") <= "21:30").toBe(true);
    expect((evening.time ?? "") >= "19:45").toBe(true);
    const tooLate = peakMeals(plan(), { look: "lean-hard", snacks: ["evening"], sleepTime: "19:30" });
    expect(snacksOf(tooLate)).toHaveLength(0);
  });

  it("snacks are optional: none chosen means none served, and the fuel engine's gap snacks give way", () => {
    const meals = peakMeals(plan(), { look: "lean-hard", snacks: [] });
    expect(snacksOf(meals)).toHaveLength(0);
    expect(meals.some((m) => m.id.startsWith("fuel-smart-snack"))).toBe(false);
  });

  it("the day still adds up: snacks take a share and the meals shrink to make room", () => {
    const p = plan();
    const day = defaultDayTargets(p);
    const meals = peakMeals(p, { look: "lean-hard", snacks: ["mid-morning", "afternoon"] });
    const planned = meals.reduce((s, m) => s + m.target.calories, 0);
    expect(Math.abs(planned - day.calories)).toBeLessThan(day.calories * 0.03);
    const snackCalories = snacksOf(meals).reduce((s, m) => s + m.target.calories, 0);
    expect(snackCalories).toBeGreaterThan(0);
    expect(planned - snackCalories).toBeLessThan(day.calories);
  });

  it("each snack is swapped on its own", () => {
    const meals = peakMeals(plan(), { look: "lean-hard", dayIndex: 0 });
    const [first, second] = snacksOf(meals);
    expect(swapKey(first)).not.toBe(swapKey(second));
    const swapped = peakMeals(plan(), { look: "lean-hard", dayIndex: 0, swaps: { [swapKey(second)]: "peak-choc-cream-rice-bowl" } });
    expect(swapped.find((m) => m.id === second.id)!.plateId).toBe("peak-choc-cream-rice-bowl");
    expect(swapped.find((m) => m.id === first.id)!.plateId).not.toBe("peak-choc-cream-rice-bowl");
  });

  it("no room, no snack: meals two hours apart leave nothing to squeeze in", () => {
    const tight = buildDailyFuelPlan({
      goal: "shred", isTrainingDay: false, sessionName: "Recovery Day", bodyweightLb: 200, sleepTarget: "22:30", wakeTime: "06:30",
      mealWindows: [
        { id: "morning-anchor", label: "Breakfast", time: "08:00", enabled: true },
        { id: "midday", label: "Lunch", time: "10:00", enabled: true },
        { id: "night", label: "Dinner", time: "12:00", enabled: true },
      ],
    });
    expect(withSnacks(tight.meals, ["mid-morning"]).some((m) => m.id === "peak-snack-mid-morning")).toBe(false);
  });

  it("the new bowls are real food and speak plainly", () => {
    for (const id of ["peak-choc-cream-rice-bowl", "peak-apple-cinnamon-cream-rice", "peak-blueberry-protein-oats", "peak-pb-banana-oats", "peak-choc-yogurt-pudding", "peak-berry-yogurt-parfait", "peak-rice-cake-pb-honey"]) {
      const sig = PEAK_SIGNATURES.find((s) => s.id === id)!;
      expect(sig, id).toBeTruthy();
      expect(sig.slot).toBe("snack");
      expect(bannedLanguageIn([sig.name, sig.smartRead, ...Object.values(sig.fits)].join(" "))).toEqual([]);
    }
  });
});
