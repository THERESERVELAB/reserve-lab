import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildDailyFuelPlan } from "../fuel-plan";
import { AVOID_CHOICES, PROTEIN_CHOICES, personalize, recipeFor, shoppingList, type PeakKitchenPrefs } from "../peak-kitchen";
import { PEAK_LOOKS, peakMeals } from "../peak-mode";
import { RATIO_LADDER, allowedSteps, familyOf, reserveRatio, resolveRatio, satFatG, type RatioContext } from "../peak-ratios";
import { PEAK_FOODS, PEAK_SIGNATURES } from "../peak-signatures";

const ctx = (c: Partial<RatioContext> = {}): RatioContext => ({ look: "lean-hard", compoundLipids: false, labLipidsAbove: [], ...c });
const prefs = (p: Partial<PeakKitchenPrefs>): PeakKitchenPrefs => ({ carbs: [], proteins: [], avoid: [], answeredAt: "2026-09-17T00:00:00Z", ...p });

describe("ground meats — separate meats, separate ratios", () => {
  it("beef, bison and turkey are different families with their own ratios, leanest first", () => {
    expect(familyOf("93% lean ground beef")).toBe("beef");
    expect(familyOf("90/10 ground bison")).toBe("bison");
    expect(familyOf("99% lean ground turkey")).toBe("turkey");
    expect(familyOf("bison")).toBeNull(); // bison steak is not ground
    for (const ladder of Object.values(RATIO_LADDER)) {
      const fat = ladder.map((r) => PEAK_FOODS[r.food].f);
      expect(fat).toEqual([...fat].sort((a, b) => a - b));
      for (const r of ladder) {
        const f = PEAK_FOODS[r.food];
        expect(Math.abs(f.p * 4 + f.c * 4 + f.f * 9 - f.kcal), r.food).toBeLessThan(f.kcal * 0.12);
      }
    }
    /* Same ratio, different meat: 90/10 bison and 90/10 beef are not the same food. */
    expect(PEAK_FOODS["90/10 ground bison"]).not.toEqual(PEAK_FOODS["90/10 ground beef"]);
    expect(PROTEIN_CHOICES.map((c) => c.label)).toEqual(expect.arrayContaining(["Ground beef", "Ground bison", "Ground turkey", "Bison steak"]));
  });

  it("the look sets the starting ratio", () => {
    expect(reserveRatio("beef", ctx({ look: "lean-hard" })).ratio).toBe("96/4");
    expect(reserveRatio("beef", ctx({ look: "recomp" })).ratio).toBe("93/7");
    expect(reserveRatio("beef", ctx({ look: "full-hard" })).ratio).toBe("90/10");
    expect(reserveRatio("bison", ctx({ look: "full-hard" })).ratio).toBe("85/15");
    expect(reserveRatio("turkey", ctx({ look: "full-hard" })).ratio).toBe("93/7");
  });

  it("compounds that affect cholesterol, or a lipid result above the report's range, move to the leanest ratio and say why", () => {
    const compound = reserveRatio("beef", ctx({ look: "full-hard", compoundLipids: true }));
    expect(compound.ratio).toBe("96/4");
    expect(compound.reasons.join(" ")).toMatch(/compounds affect cholesterol/);
    expect(compound.reasons[0]).toBe("Full · hard alone would start at 90/10.");
    const labs = reserveRatio("bison", ctx({ look: "full-hard", labLipidsAbove: ["LDL cholesterol", "ApoB"] }));
    expect(labs.ratio).toBe("90/10");
    expect(labs.reasons.join(" ")).toMatch(/LDL cholesterol and ApoB are above the range on your report.*clinician/);
    const all = [compound, labs, reserveRatio("turkey", ctx({ look: "recomp" }))].flatMap((r) => r.reasons).join(" ");
    expect(bannedLanguageIn(all)).toEqual([]);
    expect(all).not.toMatch(/\blowers?\b|\bprotects?\b|\bprevents?\b|\bimproves?\b|\breverses?\b/i);
  });

  it("the member's own pick wins, and the plate says how it compares with Reserve's", () => {
    const pick = resolveRatio("93% lean ground beef", 200, ctx({ compoundLipids: true, overrides: { beef: "85/15 ground beef" } }))!;
    expect(pick).toMatchObject({ ratio: "85/15", reserveRatio: "96/4", chosen: true });
    expect(pick.reasons.join(" ")).toMatch(/You picked 85\/15; Reserve's pick is 96\/4, which is leaner/);
  });

  it("saturated fat per portion comes from the ratio's fat", () => {
    expect(satFatG("96/4 ground beef", 200)).toBe(4.4);
    expect(satFatG("80/20 ground beef", 200)).toBe(14.3);
    const pick = resolveRatio("93% lean ground beef", 200, ctx())!;
    expect(pick).toMatchObject({ satFatG: 4.4, fattiestSatFatG: 14.3, fattiestRatio: "80/20" });
  });

  it("plates swap to the member's ground meat at the picked ratio, and recipes, shopping and avoids know each ratio", () => {
    const turkeyBowl = PEAK_SIGNATURES.find((s) => s.id === "peak-turkey-sweet-potato")!;
    const beef = personalize(turkeyBowl, prefs({ proteins: ["ground-beef"] }), 0, ctx({ labLipidsAbove: ["LDL cholesterol"] }))!;
    expect(beef.plate.portions.some((p) => "food" in p && p.food === "96/4 ground beef")).toBe(true);
    expect(beef.ratios).toHaveLength(1);
    expect(beef.plate.name).toMatch(/Ground Beef/);
    expect(recipeFor(beef.plate).join(" ")).toMatch(/160°F/);
    expect(shoppingList([{ portions: beef.plate.portions, scale: 1 }]).aisles[0].items[0].name).toBe("96/4 ground beef");
    const bison = personalize(turkeyBowl, prefs({ proteins: ["ground-bison"] }), 0, ctx({ look: "full-hard" }))!;
    expect(bison.plate.portions.some((p) => "food" in p && p.food === "85/15 ground bison")).toBe(true);
    /* Avoiding red meat never serves bison, even when it was ticked: the turkey stays. */
    const noRed = personalize(turkeyBowl, prefs({ proteins: ["ground-bison"], avoid: ["red-meat"] }), 0, ctx())!;
    expect(noRed.plate.portions.some((p) => "food" in p && familyOf(p.food) === "bison")).toBe(false);
    expect(noRed.ratios[0].family).toBe("turkey");
    expect(AVOID_CHOICES.map((a) => a.key)).toContain("red-meat");
  });

  it("the day carries ratio picks, and an override changes the plate's food", () => {
    const windows = [
      { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
      { id: "midday", label: "Lunch", time: "12:30", enabled: true },
      { id: "night", label: "Dinner", time: "20:00", enabled: true },
    ];
    const plan = buildDailyFuelPlan({ goal: PEAK_LOOKS.recomp.goal, isTrainingDay: false, sessionName: "", mealWindows: windows, bodyweightLb: 200, sleepTarget: "23:00", wakeTime: "07:00" });
    const base = { look: "recomp" as const, prefs: prefs({ proteins: ["ground-beef"] }), swaps: { lunch: "peak-turkey-sweet-potato" } };
    const lunch = (o: object) => peakMeals(plan, { ...base, ...o }).find((m) => m.slot === "lunch")!;
    expect(lunch({}).ratios[0]).toMatchObject({ family: "beef", ratio: "93/7" });
    expect(lunch({ ratios: { compoundLipids: false, labLipidsAbove: [], overrides: { beef: "90/10 ground beef" } } }).plate!.portions.some((p) => "food" in p && p.food === "90/10 ground beef")).toBe(true);
  });

  it("steak cuts run leanest to fattiest; the look picks the cut and cholesterol flags move it to the leanest", () => {
    expect(RATIO_LADDER.steak.map((r) => r.ratio)).toEqual(["Eye of round", "Top round", "Top sirloin", "Flank", "Filet", "NY strip", "Ribeye"]);
    expect(reserveRatio("steak", ctx({ look: "lean-hard" })).ratio).toBe("Eye of round");
    expect(reserveRatio("steak", ctx({ look: "recomp" })).ratio).toBe("Top sirloin");
    expect(reserveRatio("steak", ctx({ look: "full-hard" })).ratio).toBe("Filet");
    const flagged = reserveRatio("steak", ctx({ look: "full-hard", labLipidsAbove: ["LDL cholesterol"] }));
    expect(flagged.ratio).toBe("Eye of round");
    expect(flagged.reasons.join(" ")).toMatch(/leanest cut comes first/);
    expect(satFatG("ribeye steak", 200)).toBeGreaterThan(satFatG("eye of round steak", 200) * 4);
  });

  it("salmon cuts follow the look only — cholesterol flags don't move fatty fish, and the plate says why", () => {
    expect(RATIO_LADDER.salmon.map((r) => r.ratio)).toEqual(["Wild pink", "Wild coho", "Farmed Atlantic"]);
    expect(reserveRatio("salmon", ctx({ look: "lean-hard" })).ratio).toBe("Wild pink");
    const full = reserveRatio("salmon", ctx({ look: "full-hard", compoundLipids: true, labLipidsAbove: ["LDL cholesterol"] }));
    expect(full.ratio).toBe("Farmed Atlantic");
    expect(full.reasons.join(" ")).toMatch(/mostly unsaturated.*the look does/);
    expect(bannedLanguageIn(full.reasons.join(" "))).toEqual([]);
  });

  it("a cut change renames the plate and its recipe, and avoids cover every cut", () => {
    const sirloinPlate = PEAK_SIGNATURES.find((s) => s.id === "peak-sirloin-potato-mango")!;
    const filet = personalize(sirloinPlate, null, 0, ctx({ look: "full-hard" }))!;
    expect(filet.plate.name).toBe("Filet, Gold Potatoes & Mango");
    expect(recipeFor(filet.plate).join(" ")).toMatch(/filet/i);
    const lean = personalize(sirloinPlate, null, 0, ctx({ look: "full-hard", compoundLipids: true }))!;
    expect(lean.plate.name).toBe("Eye of Round, Gold Potatoes & Mango");
    const salmonPlate = PEAK_SIGNATURES.find((s) => s.id === "peak-salmon-jasmine-asparagus")!;
    expect(personalize(salmonPlate, prefs({ avoid: ["fish"] }), 0, ctx({ look: "full-hard" }))).toBeNull();
    expect(personalize(sirloinPlate, prefs({ avoid: ["red-meat"] }), 0, ctx({ look: "full-hard" }))).toBeNull();
    const farmed = personalize(salmonPlate, null, 0, ctx({ look: "full-hard" }))!;
    expect(farmed.ratios[0]).toMatchObject({ family: "salmon", kind: "cut", ratio: "Farmed Atlantic" });
    expect(farmed.ratios[0].fatG).toBeGreaterThan(farmed.ratios[0].satFatG);
  });

  it("chicken and pork cuts follow the look, and cholesterol flags take the leanest", () => {
    expect(RATIO_LADDER.chicken.map((r) => r.ratio)).toEqual(["Breast", "Drumstick", "Thigh, skinless", "Thigh, skin on"]);
    expect(reserveRatio("chicken", ctx({ look: "lean-hard" })).ratio).toBe("Breast");
    expect(reserveRatio("chicken", ctx({ look: "full-hard" })).ratio).toBe("Thigh, skinless");
    expect(reserveRatio("chicken", ctx({ look: "full-hard", compoundLipids: true })).ratio).toBe("Breast");
    expect(RATIO_LADDER.pork.map((r) => r.ratio)).toEqual(["Tenderloin", "Loin chop", "Ground"]);
    expect(reserveRatio("pork", ctx({ look: "full-hard" })).ratio).toBe("Loin chop");
    expect(reserveRatio("pork", ctx({ look: "full-hard", labLipidsAbove: ["ApoB"] })).ratio).toBe("Tenderloin");
  });

  it("egg whites are never traded for yolks; whole eggs become whites only when cholesterol is flagged", () => {
    expect(resolveRatio("egg whites", 200, ctx({ look: "full-hard" }))).toBeNull();
    expect(resolveRatio("whole eggs", 100, ctx({ look: "lean-hard" }))!.ratio).toBe("Whole eggs");
    const flagged = resolveRatio("whole eggs", 100, ctx({ look: "lean-hard", labLipidsAbove: ["LDL cholesterol"] }))!;
    expect(flagged.ratio).toBe("Whites");
    expect(flagged.reasons.join(" ")).toMatch(/Whites carry the protein without the yolk/);
    expect(bannedLanguageIn(flagged.reasons.join(" "))).toEqual([]);
  });

  it("a cut the member named stays their cut, and a food they do not eat is never picked — not even by Reserve", () => {
    /* Picking chicken thighs pins thighs, even on the lean look. */
    const scramble = PEAK_SIGNATURES.find((s) => s.id === "peak-pineapple-chicken-jasmine")!;
    const thighs = personalize(scramble, prefs({ proteins: ["chicken-thigh"] }), 0, ctx({ look: "lean-hard" }))!;
    expect(thighs.plate.portions.some((x) => "food" in x && x.food === "chicken thighs, skinless")).toBe(true);
    expect(thighs.ratios[0]).toMatchObject({ family: "chicken", chosen: true });
    /* Skin-on thighs are off the ladder for someone who never eats them. */
    expect(allowedSteps("chicken", new Set(["chicken thighs, skin on"])).map((r) => r.ratio)).toEqual(["Breast", "Drumstick", "Thigh, skinless"]);
    expect(reserveRatio("chicken", ctx({ look: "full-hard", avoid: new Set(["chicken thighs, skin on", "chicken thighs, skinless"]) })).ratio).toBe("Drumstick");
    /* Pork and soy answers keep pork and tofu off every plate and every ladder. */
    const noPork = ctx({ look: "full-hard", avoid: new Set(["pork loin chop", "ground pork"]) });
    expect(reserveRatio("pork", noPork).ratio).toBe("Tenderloin");
    const stillNo = personalize(scramble, prefs({ proteins: ["pork", "tofu"], avoid: ["pork", "soy"] }), 0, ctx())!;
    expect(stillNo.plate.portions.every((x) => !("food" in x) || !["pork tenderloin", "pork loin chop", "ground pork", "extra-firm tofu", "tempeh"].includes(x.food))).toBe(true);
  });

  it("says plainly when cholesterol changed the pick, from what, to what, and how much saturated fat it took off", () => {
    const changed = resolveRatio("93% lean ground beef", 200, ctx({ look: "full-hard", compoundLipids: true }))!;
    expect(changed.changedForCholesterol).toMatchObject({ fromRatio: "90/10", toRatio: "96/4", because: { compounds: true, labs: [] } });
    expect(changed.changedForCholesterol!.satFatSavedG).toBeCloseTo(5, 1);
    const labs = resolveRatio("top sirloin, trimmed", 200, ctx({ look: "full-hard", labLipidsAbove: ["LDL cholesterol"] }))!;
    expect(labs.changedForCholesterol).toMatchObject({ fromRatio: "Filet", toRatio: "Eye of round", because: { compounds: false, labs: ["LDL cholesterol"] } });
    const eggs = resolveRatio("whole eggs", 100, ctx({ labLipidsAbove: ["ApoB"] }))!;
    expect(eggs.changedForCholesterol).toMatchObject({ fromRatio: "Whole eggs", toRatio: "Whites" });

    /* Nothing changed: no note. */
    expect(resolveRatio("93% lean ground beef", 200, ctx({ look: "lean-hard", compoundLipids: true }))!.changedForCholesterol).toBeNull();
    expect(resolveRatio("93% lean ground beef", 200, ctx({ look: "full-hard" }))!.changedForCholesterol).toBeNull();
    /* Salmon is never moved by cholesterol, so it never carries the note. */
    expect(resolveRatio("wild salmon", 170, ctx({ look: "full-hard", compoundLipids: true, labLipidsAbove: ["LDL cholesterol"] }))!.changedForCholesterol).toBeNull();
  });

  it("a plate that already has egg whites keeps one line when its whole eggs become whites", () => {
    const toast = PEAK_SIGNATURES.find((s) => s.id === "peak-protein-french-toast")!;
    const flagged = personalize(toast, null, 0, ctx({ look: "full-hard", compoundLipids: true }))!;
    const whites = flagged.plate.portions.filter((x) => "food" in x && x.food === "egg whites");
    expect(whites).toHaveLength(1);
    expect((whites[0] as { grams: number }).grams).toBe(200); // 150 g whites + the 50 g egg
    expect(flagged.plate.portions.some((x) => "food" in x && x.food === "whole eggs")).toBe(false);
    expect(flagged.ratios.filter((r) => r.family === "egg")).toHaveLength(1);
  });
});
