import { describe, expect, it } from "vitest";

import { findCatalogEntry } from "@/lib/enhancement/catalog";
import { isMarkerKey } from "@/lib/labs/markers";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildCompoundRiskBrief } from "../risk-profiles";
import {
  EVIDENCE_GRADE_DETAIL,
  EVIDENCE_GRADE_LABEL,
  SUPPORT_AREA_NOTES,
  SUPPORT_OPTIONS,
  SUPPORT_OPTIONS_VERSION,
  optionInLog,
  overlapsForOption,
  supportAreasForBrief,
  supportForArea,
} from "../support-options";

const option = (key: string) => {
  const found = SUPPORT_OPTIONS.find((o) => o.key === key);
  if (!found) throw new Error(`missing option ${key}`);
  return found;
};

describe("support option library integrity", () => {
  it("adds only catalog entries, with real markers, sources and pending clinician review", () => {
    const keys = new Set<string>();
    for (const o of SUPPORT_OPTIONS) {
      expect(keys.has(o.key), `duplicate ${o.key}`).toBe(false);
      keys.add(o.key);
      expect(findCatalogEntry(o.catalogName)?.officialName, o.key).toBe(o.catalogName);
      expect(o.findings.length, o.key).toBeGreaterThan(0);
      expect(o.sources.length, o.key).toBeGreaterThan(0);
      expect(o.review).toEqual({ status: "pending-clinician-review", version: SUPPORT_OPTIONS_VERSION });
      for (const f of o.findings) for (const m of f.markers) expect(isMarkerKey(m), `${o.key}: ${m}`).toBe(true);
    }
  });

  it("is alphabetical, so order never reads as a ranking", () => {
    const titles = SUPPORT_OPTIONS.map((o) => o.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    const liver = supportForArea("liver").options.map((o) => o.option.title);
    expect(liver).toEqual([...liver].sort((a, b) => a.localeCompare(b)));
  });
});

describe("compliance — options inform, never instruct", () => {
  it("no finding, note or grade text gives amounts, rankings or instructions", () => {
    const copy = [
      ...SUPPORT_OPTIONS.flatMap((o) => [o.title, ...o.findings.map((f) => f.finding)]),
      ...Object.values(SUPPORT_AREA_NOTES),
      ...Object.values(EVIDENCE_GRADE_LABEL),
      ...Object.values(EVIDENCE_GRADE_DETAIL),
    ];
    const violations = copy.flatMap((text) => bannedLanguageIn(`${text}`).map((p) => `${p} in "${text}"`));
    expect(violations).toEqual([]);
    for (const text of copy) expect(text, text).not.toMatch(/\bbest\b|\bprotects? against\b|\bprevents?\b(?! liver injury)/i);
  });

  it("says plainly where no supplement has evidence", () => {
    for (const area of ["hormonal", "fertility", "blood"] as const) {
      const support = supportForArea(area);
      expect(support.options, area).toEqual([]);
      expect(support.note, area).toMatch(/^No supplement/);
    }
  });
});

describe("supportAreasForBrief", () => {
  it("derives body areas from the member's compounds and adds general nutrition", () => {
    const areas = supportAreasForBrief(buildCompoundRiskBrief([{ name: "Oxandrolone" }]));
    const keys = areas.map((a) => a.area);
    expect(keys).toEqual(expect.arrayContaining(["liver", "lipids", "cardiovascular", "blood", "fertility", "general"]));
    expect(areas.find((a) => a.area === "liver")?.compoundNames).toEqual(["Oxandrolone"]);
  });

  it("skips product-handling areas and the member's own supplements", () => {
    const keys = supportAreasForBrief(buildCompoundRiskBrief([{ name: "BPC-157", compoundClass: "peptides_healing" }, { name: "Fish Oil" }])).map((a) => a.area);
    expect(keys).not.toContain("sourcing");
    expect(keys).not.toContain("injection");
    expect(keys).not.toContain("blood");
  });

  it("returns nothing when only supplements are logged", () => {
    expect(supportAreasForBrief(buildCompoundRiskBrief([{ name: "Fish Oil" }, { name: "Creatine" }]))).toEqual([]);
  });
});

describe("overlapsForOption", () => {
  it("shows where an option adds to an area the member's compounds already affect", () => {
    const brief = buildCompoundRiskBrief([{ name: "My insulin", compoundClass: "insulin" }]);
    const { overlaps } = overlapsForOption(option("berberine"), brief);
    expect(overlaps.map((o) => o.system)).toEqual(["metabolic"]);
    expect(overlaps[0].compoundNames).toEqual(["My insulin"]);
  });

  it("never pairs areas that share a label but not a mechanism", () => {
    const brief = buildCompoundRiskBrief([{ name: "Testosterone Cypionate" }]);
    expect(overlapsForOption(option("fish-oil"), brief).overlaps).toEqual([]);
    expect(overlapsForOption(option("coq10"), brief).overlaps).toEqual([]);
  });

  it("carries the option's own interactions", () => {
    const { interactions } = overlapsForOption(option("fish-oil"), buildCompoundRiskBrief([{ name: "Oxandrolone" }]));
    expect(interactions.join(" ")).toMatch(/warfarin/);
  });
});

describe("optionInLog", () => {
  it("matches by catalog identity, including aliases", () => {
    expect(optionInLog(option("n-acetyl-cysteine"), [{ name: "NAC" }])).toBe(true);
    expect(optionInLog(option("tudca"), [{ name: "Fish Oil" }])).toBe(false);
  });
});
