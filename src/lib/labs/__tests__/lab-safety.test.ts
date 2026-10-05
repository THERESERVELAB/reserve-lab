import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildLabSafetyBrief, type LabRecordInput } from "../lab-safety";
import { matchMarker } from "../markers";
import { nearLimit, parseLabValue, parseReferenceRange, positionInRange } from "../reference-range";

describe("reference ranges", () => {
  it("parses the forms labs print", () => {
    expect(parseReferenceRange("38.5-50.0")).toMatchObject({ low: 38.5, high: 50 });
    expect(parseReferenceRange("250 - 1100")).toMatchObject({ low: 250, high: 1100 });
    expect(parseReferenceRange("<200")).toMatchObject({ high: 200, highInclusive: false });
    expect(parseReferenceRange("< OR = 99")).toMatchObject({ high: 99, highInclusive: true });
    expect(parseReferenceRange("> OR = 40")).toMatchObject({ low: 40, lowInclusive: true });
    expect(parseReferenceRange("≥ 60")).toMatchObject({ low: 60, lowInclusive: true });
    expect(parseReferenceRange("See note")).toBeNull();
    expect(parseReferenceRange("50-10")).toBeNull();
  });

  it("places values honestly, including comparator results", () => {
    const range = parseReferenceRange("38.5-50.0");
    expect(positionInRange(parseLabValue("52.1"), range)).toBe("above");
    expect(positionInRange(parseLabValue("37"), range)).toBe("below");
    expect(positionInRange(parseLabValue("50.0"), range)).toBe("within");
    expect(positionInRange(parseLabValue("<200"), parseReferenceRange("<200"))).toBe("within");
    expect(positionInRange(parseLabValue("<0.5"), parseReferenceRange("0.2-4.0"))).toBe("unknown");
    expect(positionInRange(parseLabValue("positive"), range)).toBe("unknown");
    expect(positionInRange(parseLabValue("5"), parseReferenceRange("<5"))).toBe("above");
  });

  it("notices a value near a limit", () => {
    const range = parseReferenceRange("38.5-50.0");
    expect(nearLimit(parseLabValue("49.2"), range)).toBe("high");
    expect(nearLimit(parseLabValue("39"), range)).toBe("low");
    expect(nearLimit(parseLabValue("44"), range)).toBeNull();
  });
});

describe("markers", () => {
  it("matches lab and member spellings to one key", () => {
    expect(matchMarker("TESTOSTERONE, TOTAL, MS")?.key).toBe("total-testosterone");
    expect(matchMarker("Testosterone")?.key).toBe("total-testosterone");
    expect(matchMarker("ALT (SGPT)")?.key).toBe("alt");
    expect(matchMarker("eGFR Non-Afr. American")?.key).toBe("egfr");
    expect(matchMarker("Hemoglobin A1c")?.key).toBe("hba1c");
    expect(matchMarker("Hemoglobin")?.key).toBe("hemoglobin");
  });

  it("never guesses", () => {
    expect(matchMarker("LDL Particle Number")).toBeNull();
    expect(matchMarker("")).toBeNull();
  });
});

const RECORDS: LabRecordInput[] = [
  {
    id: "older",
    testDate: "2026-03-01",
    markers: [{ name: "Hematocrit", value: "43.0", unit: "%", referenceRange: "38.5-50.0" }],
  },
  {
    id: "latest",
    testDate: "2026-09-01",
    labName: "Quest Diagnostics",
    markers: [
      { name: "HEMATOCRIT", value: "48.9", unit: "%", referenceRange: "38.5-50.0" },
      { name: "POTASSIUM", value: "6.9", unit: "mmol/L", referenceRange: "3.5-5.3", labFlag: "HH" },
      { name: "HDL CHOLESTEROL", value: "32", unit: "mg/dL", referenceRange: "≥ 40", labFlag: "L" },
      { name: "GLUCOSE", value: "88", unit: "mg/dL", referenceRange: "65-99" },
    ],
  },
];

const LINKS = {
  hematocrit: ["Testosterone Cypionate"],
  hdl: ["Oxandrolone"],
  alt: ["Oxandrolone"],
  psa: ["Testosterone Cypionate"],
};

describe("buildLabSafetyBrief", () => {
  const brief = buildLabSafetyBrief({ records: RECORDS, markerLinks: LINKS, now: new Date(2026, 8, 13, 12) });

  it("orders findings urgent → discuss → watch and counts the rest as clear", () => {
    expect(brief.findings.map((f) => [f.markerKey, f.tier])).toEqual([
      ["potassium", "urgent"],
      ["hdl", "discuss"],
      ["hematocrit", "watch"],
    ]);
    expect(brief.clearCount).toBe(1);
    expect(brief.latestLabDate).toBe("2026-09-01");
  });

  it("explains a critical result with the lab's own flag and range", () => {
    const potassium = brief.findings[0];
    expect(potassium.reasons[0]).toMatch(/marked this result critical high/i);
    expect(potassium.reasons[1]).toMatch(/Above the reference range on your Quest Diagnostics report \(3\.5-5\.3 mmol\/L\)/);
  });

  it("notices a within-range marker moving toward its limit, and links the compound", () => {
    const hematocrit = brief.findings[2];
    expect(Math.round(hematocrit.changePct!)).toBe(14);
    expect(hematocrit.previous?.date).toBe("2026-03-01");
    expect(hematocrit.reasons.join(" ")).toMatch(/Up 14% since Mar 1, 2026, now near the top/);
    expect(hematocrit.linkedCompounds).toEqual(["Testosterone Cypionate"]);
  });

  it("lists commonly watched markers missing from recent labs", () => {
    expect(brief.untested.map((u) => u.markerKey).sort()).toEqual(["alt", "psa"]);
  });

  it("never uses dosing or recommendation language", () => {
    for (const finding of brief.findings) {
      for (const reason of finding.reasons) {
        // The parenthetical is the range and unit quoted from the member's own
        // report ("≥ 40 mg/dL") — report data, not Reserve's copy.
        const authored = reason.replace(/\([^)]*\)/g, "");
        expect(bannedLanguageIn(authored), reason).toEqual([]);
      }
    }
  });

  it("does not compare readings across different units", () => {
    const mixed = buildLabSafetyBrief({
      records: [
        { id: "a", testDate: "2026-01-01", markers: [{ name: "Glucose", value: "5.0", unit: "mmol/L", referenceRange: "3.9-5.5" }] },
        { id: "b", testDate: "2026-06-01", markers: [{ name: "Glucose", value: "97", unit: "mg/dL", referenceRange: "65-99" }] },
      ],
      now: new Date(2026, 8, 13),
    });
    expect(mixed.findings).toEqual([]);
  });
});
