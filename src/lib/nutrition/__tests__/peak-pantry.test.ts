import { describe, expect, it } from "vitest";

import { CARB_CHOICES, PROTEIN_CHOICES, personalize, platesFor, shoppingList, type PeakKitchenPrefs } from "../peak-kitchen";
import { PEAK_SIGNATURES } from "../peak-signatures";

/* ════════════════════════════════════════════════════════════════════════
   COOK WHAT YOU BOUGHT — what the member has beats what they picked, so a
   plan never asks for a protein that is still at the store.
   ════════════════════════════════════════════════════════════════════════ */

const prefs = (over: Partial<PeakKitchenPrefs>): PeakKitchenPrefs => ({ carbs: [], proteins: [], avoid: [], answeredAt: "2026-09-22T12:00:00.000Z", ...over });

/** A plate built on a main protein and a main carb, so both swap paths are live. */
const chickenPlate = PEAK_SIGNATURES.find(
  (s) => s.portions.some((p) => "food" in p && p.food === "chicken breast") && s.portions.some((p) => "food" in p && p.food === "jasmine rice"),
)!;

const foodsOf = (sig: { portions: readonly unknown[] }) =>
  (sig.portions as Array<{ food?: string }>).flatMap((p) => (p.food ? [p.food] : []));

describe("what the member actually has", () => {
  it("cooks the protein in the freezer instead of the one they said they like", () => {
    const liked = PROTEIN_CHOICES.find((c) => c.food === "chicken breast")!.key;
    const plate = personalize(chickenPlate, prefs({ proteins: [liked], onHand: ["93% lean ground beef"] }));
    expect(foodsOf(plate!.plate)).toContain("93% lean ground beef");
    expect(foodsOf(plate!.plate)).not.toContain("chicken breast");
    expect(plate!.swapped.find((s) => s.to === "93% lean ground beef")?.onHand).toBe(true);
  });

  it("leaves the plate alone when what it already calls for is on hand", () => {
    const plate = personalize(chickenPlate, prefs({ onHand: ["chicken breast", "jasmine rice"] }));
    expect(foodsOf(plate!.plate)).toContain("chicken breast");
    expect(plate!.swapped).toEqual([]);
  });

  it("falls back to what they like when the kitchen is empty", () => {
    const turkey = PROTEIN_CHOICES.find((c) => c.food === "99% lean ground turkey")!.key;
    const plate = personalize(chickenPlate, prefs({ proteins: [turkey] }));
    expect(foodsOf(plate!.plate)).toContain("99% lean ground turkey");
    expect(plate!.swapped[0].onHand).toBeUndefined();
  });

  it("never serves a food the member avoids, even when they ticked it as on hand", () => {
    const pork = PROTEIN_CHOICES.find((c) => c.food.includes("pork"));
    if (!pork) return;
    const plates = platesFor("dinner", "lean-hard", prefs({ avoid: ["pork"], onHand: [pork.food] }), new Set(), 0, {
      compoundLipids: false, labLipidsAbove: [], look: "lean-hard",
    });
    for (const p of plates) expect(foodsOf(p.plate)).not.toContain(pork.food);
  });

  it("marks the shopping list with what is already in the kitchen", () => {
    const carb = CARB_CHOICES.find((c) => c.food === "jasmine rice")!.food;
    const list = shoppingList([{ portions: chickenPlate.portions, scale: 1 }], [], [carb]);
    const items = list.aisles.flatMap((a) => a.items);
    const rice = items.find((i) => i.key === carb);
    expect(rice?.onHand, "rice is ticked as on hand").toBe(true);
    expect(items.filter((i) => i.onHand).length).toBe(1);
  });
});

describe("a cut you already own", () => {
  it("cooks the exact cut in the freezer instead of moving up the lean ladder", () => {
    const beefPlate = PEAK_SIGNATURES.find((s) => s.portions.some((p) => "food" in p && p.food === "93% lean ground beef"));
    if (!beefPlate) return;
    const plate = personalize(beefPlate, prefs({ onHand: ["85/15 ground beef"] }), 0, {
      /* Compound lipids on, which is exactly when Reserve would otherwise pick a leaner cut. */
      compoundLipids: true, labLipidsAbove: [], look: "lean-hard",
    });
    expect(foodsOf(plate!.plate)).toContain("85/15 ground beef");
  });
});
