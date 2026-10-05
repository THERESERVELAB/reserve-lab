import { describe, expect, it } from "vitest";

import { nightBefore, nightBeforeLine, prepKey, prepKeys, prepProgress } from "../peak-prep";
import { PEAK_SIGNATURES } from "../peak-signatures";

/* ════════════════════════════════════════════════════════════════════════
   TONIGHT, FOR TOMORROW — meat out of the freezer and the batch worth
   cooking once, read from tomorrow's own plates at their own weights.
   ════════════════════════════════════════════════════════════════════════ */

const plate = (id: string) => {
  const sig = PEAK_SIGNATURES.find((s) => s.id === id);
  if (!sig) throw new Error(`no plate ${id}`);
  return { portions: sig.portions, scale: 1 };
};

/** A plate with chicken and rice on it, whichever one the library calls it today. */
const chickenRice = PEAK_SIGNATURES.find(
  (s) => s.portions.some((p) => "food" in p && p.food === "chicken breast") && s.portions.some((p) => "food" in p && p.food === "jasmine rice"),
);

describe("the night before", () => {
  it("names the meat to move out of the freezer, in the weight it was bought at", () => {
    const plan = nightBefore([{ portions: [{ food: "chicken breast", grams: 200, group: "protein" }], scale: 1 }]);
    expect(plan.thaw).toHaveLength(1);
    /* 200 g cooked is about 270 g raw — the weight on the packet. */
    expect(plan.thaw[0]).toMatchObject({ food: "chicken breast", grams: 270 });
    expect(plan.thaw[0].label).toBe("270 g raw");
    expect(plan.batch).toEqual([]);
  });

  it("puts grains, beans and potatoes in the batch, in dry weight where that is how they are cooked", () => {
    const plan = nightBefore([
      { portions: [{ food: "jasmine rice", grams: 300, group: "carb" }, { food: "sweet potato", grams: 200, group: "carb" }], scale: 1 },
    ]);
    expect(plan.batch.map((b) => b.food)).toEqual(["sweet potato", "jasmine rice"]); // heaviest as bought leads
    expect(plan.batch.find((b) => b.food === "jasmine rice")!.label).toBe("100 g dry");
    expect(plan.batch.find((b) => b.food === "sweet potato")!.label).toBe("200 g");
    expect(plan.thaw).toEqual([]);
  });

  it("adds the same food across tomorrow's plates, and leads with the heaviest", () => {
    const plan = nightBefore([
      { portions: [{ food: "chicken breast", grams: 150, group: "protein" }], scale: 1 },
      { portions: [{ food: "chicken breast", grams: 150, group: "protein" }, { food: "cod", grams: 100, group: "protein" }], scale: 1 },
    ]);
    expect(plan.thaw.map((t) => t.food)).toEqual(["chicken breast", "cod"]);
    expect(plan.thaw[0].grams).toBe(400); // 300 g cooked, bought raw
  });

  it("leaves out what needs no prep, and says so when there is nothing to do", () => {
    const plan = nightBefore([
      { portions: [{ food: "nonfat Greek yogurt", grams: 200, group: "protein" }, { food: "blueberries", grams: 80, group: "produce" }], scale: 1 },
    ]);
    expect(plan.empty).toBe(true);
    expect(nightBeforeLine(plan)).toBe("Nothing to do tonight — tomorrow cooks fresh.");
  });

  it("reads a real plate from the library, scaled the way the day scales it", () => {
    if (!chickenRice) return;
    const plan = nightBefore([{ ...plate(chickenRice.id), scale: 1.5 }]);
    expect(plan.thaw.length + plan.batch.length).toBeGreaterThan(0);
    expect(nightBeforeLine(plan)).toMatch(/freezer|batch/);
  });
});

describe("the cooking checklist", () => {
  const plan = {
    today: nightBefore([{ portions: [{ food: "jasmine rice", grams: 300, group: "carb" }], scale: 1 }]),
    tonight: nightBefore([
      { portions: [{ food: "chicken breast", grams: 200, group: "protein" }, { food: "sweet potato", grams: 200, group: "carb" }], scale: 1 },
    ]),
  };

  it("gives every job its own tick, with the day it belongs to", () => {
    const keys = prepKeys(plan, "2026-09-22", "2026-09-23");
    expect(keys).toEqual([
      "2026-09-22:cook:jasmine rice",
      "2026-09-23:thaw:chicken breast",
      "2026-09-23:batch:sweet potato",
    ]);
  });

  it("keeps today's rice and tomorrow's rice apart, so one tick never crosses days", () => {
    expect(prepKey("2026-09-22", "cook", "jasmine rice")).not.toBe(prepKey("2026-09-23", "batch", "jasmine rice"));
  });

  it("counts what is done out of what is on the list", () => {
    const keys = prepKeys(plan, "2026-09-22", "2026-09-23");
    expect(prepProgress(keys, new Set())).toEqual({ done: 0, total: 3 });
    expect(prepProgress(keys, new Set([keys[0], keys[2]]))).toEqual({ done: 2, total: 3 });
    /* A tick from another day counts for nothing. */
    expect(prepProgress(keys, new Set(["2026-09-21:cook:jasmine rice"]))).toEqual({ done: 0, total: 3 });
  });
});
