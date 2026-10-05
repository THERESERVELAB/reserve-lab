import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { supportAreasForBrief } from "@/lib/compound-intelligence/support-options";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildDailyFuelPlan, type MealSlot } from "../fuel-plan";
import { DRY_THE_RIGHT_WAY, PEAK_LOOKS, PEAK_LOOK_ORDER, dayIndexOf, fruitFor, isPeakLook, peakMeals, totalsOf } from "../peak-mode";
import { PEAK_FOODS, PEAK_SIGNATURES, SCALE_MAX, SCALE_MIN, pickSignature, scaleFor, signatureMacros } from "../peak-signatures";

const windows = [
  { id: "morning-anchor", label: "Breakfast", time: "07:30", enabled: true },
  { id: "midday", label: "Lunch", time: "12:30", enabled: true },
  { id: "pre-workout", label: "Pre-workout", time: "15:30", enabled: true },
  { id: "post-workout", label: "Post-workout", time: "18:30", enabled: true },
  { id: "night", label: "Dinner", time: "20:00", enabled: true },
];

const plan = (isTrainingDay: boolean, look: keyof typeof PEAK_LOOKS = "lean-hard") =>
  buildDailyFuelPlan({ goal: PEAK_LOOKS[look].goal, isTrainingDay, sessionName: "Push", mealWindows: windows, bodyweightLb: 200, sleepTarget: "23:00", wakeTime: "07:00" });

const CORE_SLOTS: MealSlot[] = ["breakfast", "lunch", "pre-workout", "post-workout", "dinner", "snack"];

describe("peak signature library", () => {
  it("every look has at least one plate for every slot, with unique ids and real foods", () => {
    const ids = PEAK_SIGNATURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const look of PEAK_LOOK_ORDER) {
      for (const slot of CORE_SLOTS) {
        expect(PEAK_SIGNATURES.some((s) => s.slot === slot && s.looks.includes(look)), `${look} ${slot}`).toBe(true);
      }
    }
    for (const sig of PEAK_SIGNATURES) {
      for (const p of sig.portions) if ("food" in p) expect(PEAK_FOODS[p.food], `${sig.id}: ${p.food}`).toBeDefined();
    }
  });

  it("macros are computed from the food table and agree with 4/4/9 within rounding", () => {
    for (const sig of PEAK_SIGNATURES) {
      const m = signatureMacros(sig);
      expect(m.calories, sig.id).toBeGreaterThan(150);
      expect(Math.abs(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9 - m.calories), sig.id).toBeLessThan(m.calories * 0.08);
    }
    const bowl = PEAK_SIGNATURES.find((s) => s.id === "peak-cream-of-rice-recovery-bowl")!;
    expect(signatureMacros(bowl).fatG).toBeLessThan(5);
  });

  it("portions scale toward a meal's target, inside the band", () => {
    const sig = PEAK_SIGNATURES[0];
    expect(scaleFor(sig, 99_999)).toBe(SCALE_MAX);
    expect(scaleFor(sig, 1)).toBe(SCALE_MIN);
    expect(scaleFor(sig, null)).toBe(1);
  });

  it("fit reasons stay food guidance: no compound names, amounts or protection claims", () => {
    const text = PEAK_SIGNATURES.flatMap((s) => [s.name, s.smartRead, ...Object.values(s.fits)]).join(" | ");
    expect(bannedLanguageIn(text)).toEqual([]);
    expect(text).not.toMatch(/\bprotects?\b|\bprevents?\b|\breverses?\b|\boffsets?\b|\bcounteracts?\b|testosterone|masteron|trenbolone|steroid/i);
  });
});

describe("peak mode day", () => {
  it("maps each look to a fuel goal", () => {
    expect(PEAK_LOOKS["lean-hard"].goal).toBe("shred");
    expect(PEAK_LOOKS["full-hard"].goal).toBe("lean-bulk");
    expect(isPeakLook("lean-hard")).toBe(true);
    expect(isPeakLook("mass-monster")).toBe(false);
  });

  it("a training day fills every slot with a plate for the look, in the plan's own times, never repeating a plate", () => {
    const day = plan(true);
    const meals = peakMeals(day, { look: "lean-hard", dayIndex: 0, snacks: [] });
    /* With no snacks chosen, the fuel engine's own gap snacks give way too. */
    const own = day.meals.filter((m) => !m.id.startsWith("fuel-smart-snack"));
    expect(meals).toHaveLength(own.length);
    meals.forEach((meal, i) => expect(meal.time).toBe(own[i].time));
    const signatures = meals.filter((m) => m.signature);
    expect(signatures.length).toBeGreaterThanOrEqual(4);
    expect(new Set(signatures.map((m) => m.plateId)).size).toBe(signatures.length);
    for (const m of signatures) {
      const sig = PEAK_SIGNATURES.find((s) => s.id === m.plateId)!;
      expect(sig.looks, m.name).toContain("lean-hard");
    }
    expect(totalsOf(meals).proteinG).toBeGreaterThan(0);
  });

  it("the full look gets full-look plates", () => {
    const meals = peakMeals(plan(true, "full-hard"), { look: "full-hard", dayIndex: 0 });
    for (const m of meals.filter((x) => x.signature)) expect(PEAK_SIGNATURES.find((s) => s.id === m.plateId)!.looks).toContain("full-hard");
  });

  it("rest days fill every window with a plate — training windows take snack and dinner plates", () => {
    const meals = peakMeals(plan(false), { look: "lean-hard" });
    expect(meals.every((m) => m.signature)).toBe(true);
    for (const m of meals.filter((x) => x.slot === "post-workout")) expect(PEAK_SIGNATURES.find((s) => s.id === m.plateId)!.slot).toBe("dinner");
    for (const m of meals.filter((x) => x.slot === "pre-workout")) expect(PEAK_SIGNATURES.find((s) => s.id === m.plateId)!.slot).toBe("snack");
  });

  it("compound areas, counted together, bring plates that fit their guidance first — and name why", () => {
    const areas = supportAreasForBrief(buildCompoundRiskBrief([{ name: "Masteron" }, { name: "Testosterone Enanthate" }])).map((a) => a.area);
    expect(areas).toEqual(expect.arrayContaining(["lipids", "cardiovascular"]));
    const lunch = pickSignature("lunch", "lean-hard", new Set(["lipids", "cardiovascular", "metabolic"]), 0);
    expect(Object.keys(lunch!.fits).length).toBe(3);
    const meals = peakMeals(plan(true), { look: "lean-hard", compoundAreas: areas, dayIndex: 3 });
    const fitted = meals.filter((m) => m.fits.length > 0);
    expect(fitted.length).toBeGreaterThan(0);
    for (const m of fitted) for (const f of m.fits) expect(f.sources.length).toBeGreaterThan(0);
    /* Without compound areas nothing is labeled. */
    expect(peakMeals(plan(true), { look: "lean-hard", dayIndex: 3 }).every((m) => m.fits.length === 0)).toBe(true);
  });

  it("plates rotate across days", () => {
    const names = (d: number) => peakMeals(plan(true), { look: "recomp", dayIndex: d }).map((m) => m.name).join("|");
    expect(new Set([0, 1, 2, 3].map(names)).size).toBeGreaterThan(1);
    expect(dayIndexOf("2026-01-01")).toBe(0);
    expect(dayIndexOf("2026-09-17")).toBe(259);
  });

  it("fast fruit around training, steady fruit elsewhere and on rest days", () => {
    expect(fruitFor("post-workout", true).kind).toBe("fast");
    expect(fruitFor("breakfast", true).kind).toBe("steady");
    expect(fruitFor("post-workout", false).kind).toBe("steady");
  });

  it("dry means body fat, never water or sodium cutting", () => {
    const text = DRY_THE_RIGHT_WAY.map((f) => `${f.title} ${f.text}`).join(" ");
    expect(text).toMatch(/No water or sodium cutting/);
    expect(bannedLanguageIn(text)).toEqual([]);
  });
});
