import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildEvidenceMap } from "../evidence-map";

/**
 * One screen: every area a member's compounds affect, what the library shows
 * for it, and where nothing has been shown to help.
 */
describe("evidence map", () => {
  const map = buildEvidenceMap(buildCompoundRiskBrief([{ name: "Masteron" }]))!;
  const area = (key: string) => map.areas.find((a) => a.area === key);

  it("covers the areas a steroid affects plus everyday areas, with the compound named", () => {
    expect(map.areas.map((a) => a.area)).toEqual(expect.arrayContaining(["lipids", "cardiovascular", "liver", "prostate", "skin", "sleep", "general", "hydration"]));
    expect(area("lipids")!.compoundNames).toContain("Masteron");
    expect(area("sleep")!.compoundNames).toEqual([]);
  });

  it("lists options alphabetically with their graded evidence, never ranked", () => {
    for (const a of map.areas) expect(a.options.map((o) => o.title)).toEqual([...a.options.map((o) => o.title)].sort((x, y) => x.localeCompare(y)));
    expect(area("lipids")!.options.find((o) => o.title === "Psyllium husk")?.gradeLabel).toBe("Established");
    expect(area("liver")!.options.find((o) => o.title === "Milk thistle")?.gradeLabel).toBe("Not shown in trials");
    expect(area("cardiovascular")!.options.find((o) => o.key === "potassium")?.caution).toMatch(/blood pressure medicines/);
  });

  it("says plainly where nothing has been shown to help, and keeps the liver note", () => {
    expect(map.nothingShown.map((a) => a.area)).toEqual(expect.arrayContaining(["blood", "fertility", "mood"]));
    expect(area("liver")!.note).toMatch(/No supplement has been shown to prevent liver injury/);
  });

  it("is empty without compounds, and says nothing the compliance rules forbid", () => {
    expect(buildEvidenceMap(buildCompoundRiskBrief([]))).toBeNull();
    const text = [
      ...map.areas.flatMap((a) => [a.label, a.note ?? "", ...a.options.map((o) => o.caution ?? "")]),
      ...map.hazards.flatMap((h) => [h.title, h.text]),
      ...map.habits,
    ];
    for (const t of text) {
      expect(bannedLanguageIn(t), t).toEqual([]);
      expect(t, t).not.toMatch(/\b(?:best|top pick|you should|protects? against|reverses?)\b/i);
    }
  });
});
