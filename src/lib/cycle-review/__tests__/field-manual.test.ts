import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { SUPPORT_OPTIONS } from "@/lib/compound-intelligence/support-options";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { FIELD_MANUAL_ITEMS, buildFieldManual } from "../field-manual";

/**
 * The everyday side of a cycle — eating, habits and kit — from public
 * guidelines, lit up by the member's own compounds. Never what compound or
 * supplement to take, how much or when.
 */
describe("field manual", () => {
  it("covers eating, habits and kit, each item cited with a unique key", () => {
    const keys = FIELD_MANUAL_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of FIELD_MANUAL_ITEMS) expect(item.sources.length, item.key).toBeGreaterThan(0);
    expect(keys).toEqual(expect.arrayContaining(["protein", "carbs", "fats", "added-sugar", "sweeteners", "sodium", "milk", "plant-milk", "alcohol", "cardio", "sauna", "bp-cuff", "bp-how"]));
  });

  it("never gives compound amounts, rankings, clearance or protection claims", () => {
    const violations = FIELD_MANUAL_ITEMS.flatMap((item) => bannedLanguageIn(`${item.title} ${item.text}`).map((p) => `${item.key}: ${p}`));
    expect(violations).toEqual([]);
    for (const item of FIELD_MANUAL_ITEMS) {
      expect(item.text, item.key).not.toMatch(/\bbest\b|\bprotects?\b|\bprevents?\b|\breverses?\b|\boffsets?\b|\bdetox/i);
    }
  });

  it("lights up the items a member's compounds touch, with those compounds named", () => {
    const manual = buildFieldManual(buildCompoundRiskBrief([{ name: "Masteron" }, { name: "Testosterone Enanthate" }]));
    const eat = manual.sections.find((s) => s.key === "eat")!;
    const satFat = eat.items.find((i) => i.key === "saturated-fat")!;
    expect(satFat.forYou?.areaLabels).toEqual(expect.arrayContaining(["Cholesterol"]));
    expect(satFat.forYou?.compoundNames).toEqual(expect.arrayContaining(["Masteron"]));
    expect(manual.forYouCount).toBeGreaterThan(5);
    /* Order stays fixed: personal relevance never re-ranks the list. */
    expect(eat.items.map((i) => i.key)).toEqual(FIELD_MANUAL_ITEMS.filter((i) => i.section === "eat").map((i) => i.key));
  });

  it("still reads for a member with nothing logged, without personal tags", () => {
    const manual = buildFieldManual(null);
    expect(manual.forYouCount).toBe(0);
    expect(manual.sections.every((s) => s.items.length > 0)).toBe(true);
  });

  it("the supplement library carries creatine, electrolytes and red yeast rice", () => {
    const keys = SUPPORT_OPTIONS.map((o) => o.key);
    expect(keys).toEqual(expect.arrayContaining(["creatine", "electrolytes", "red-yeast-rice", "whey-protein"]));
    const ryr = SUPPORT_OPTIONS.find((o) => o.key === "red-yeast-rice")!;
    expect(ryr.doesNotAddress).toMatch(/HDL/);
    expect(ryr.findings.find((f) => f.area === "liver")?.finding).toMatch(/statin/);
  });
});
