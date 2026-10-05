import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import {
  SUPPORT_AREA_LABEL,
  SUPPORT_AREA_NOTES,
  SUPPORT_OPTIONS,
  type SupportArea,
} from "@/lib/compound-intelligence/support-options";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildMemberSupportReview, type MemberSupportInput } from "../member-support";

/**
 * The Support Stack has to help a member who logs labs and no compounds:
 * a flagged result still explains the options that watch it, still says what
 * no supplement addresses, and never needs a cycle to do either.
 */

const now = new Date(2026, 8, 15, 9);

const labBrief = buildLabSafetyBrief({
  records: [
    {
      id: "older",
      testDate: "2026-06-01",
      markers: [
        { name: "ALT", value: "30", unit: "U/L", referenceRange: "9-46" },
        { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
        { name: "Magnesium", value: "2.0", unit: "mg/dL", referenceRange: "1.7-2.2" },
      ],
    },
    {
      id: "latest",
      testDate: "2026-09-01",
      markers: [
        { name: "ALT", value: "88", unit: "U/L", referenceRange: "9-46", labFlag: "H" },
        { name: "Hematocrit", value: "53.4", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" },
        { name: "Magnesium", value: "1.4", unit: "mg/dL", referenceRange: "1.7-2.2", labFlag: "L" },
        { name: "TSH", value: "6.8", unit: "uIU/mL", referenceRange: "0.45-4.5", labFlag: "H" },
      ],
    },
  ],
  markerLinks: buildCompoundRiskBrief([]).markerLinks,
  now,
});

function input(overrides: Partial<MemberSupportInput> = {}): MemberSupportInput {
  return {
    today: "2026-09-15",
    compounds: [],
    labBrief,
    checkIns: [],
    sleepLogDates: [],
    medicationsText: "",
    healthContext: [],
    allergies: [],
    needsCare: false,
    plan: [],
    ...overrides,
  };
}

describe("support stack with labs and no compounds", () => {
  it("explains the options that watch a flagged result", () => {
    const review = buildMemberSupportReview(input());
    const personalized = review.library.flatMap((group) => group.options.filter((option) => option.personalized));
    expect(personalized.length).toBeGreaterThan(0);
    expect(personalized.flatMap((option) => option.reasons).join(" ")).toMatch(/ALT/);
  });

  it("says what no supplement addresses, from the labs alone", () => {
    const review = buildMemberSupportReview(input());
    const gaps = review.notAddressed.join(" ");
    expect(gaps).toMatch(/Hematocrit/);
    expect(gaps).toMatch(/ALT/);
  });

  it("follows a marker outside the cycle review's fixed list", () => {
    const review = buildMemberSupportReview(input());
    const magnesium = review.library
      .flatMap((group) => group.options)
      .find((option) => option.option.key === "magnesium");
    expect(magnesium?.allReasons.join(" "), "magnesium result should explain the magnesium option").toMatch(/Magnesium/);
  });

  it("marks the body system a flagged result belongs to, with no compounds logged", () => {
    const review = buildMemberSupportReview(input());
    const blood = review.coverage.find((row) => row.key === "blood");
    expect(blood?.detail, "a flagged hematocrit should reach the Blood row").toMatch(/Hematocrit/);
    const liver = review.coverage.find((row) => row.key === "liver");
    expect(liver?.detail, "a flagged ALT should reach the Liver row").toMatch(/ALT/);
  });

  it("has an answer for a flagged marker no option names", () => {
    const review = buildMemberSupportReview(input());
    expect(review.notAddressed.join(" "), "a flagged TSH should not be silent").toMatch(/TSH/);
  });
});

describe("every body area Reserve can raise has an answer", () => {
  it("offers an option or says plainly that the library has none", () => {
    const optionAreas = new Set(SUPPORT_OPTIONS.flatMap((option) => option.findings.map((finding) => finding.area)));
    /* Sourcing and injection describe handling, not a body area. */
    const bodyAreas = (Object.keys(SUPPORT_AREA_LABEL) as SupportArea[]).filter((area) => area !== "sourcing" && area !== "injection");
    const silent = bodyAreas.filter((area) => !optionAreas.has(area) && !SUPPORT_AREA_NOTES[area]);
    expect(silent).toEqual([]);
  });

  it("keeps those notes free of banned and directive wording", () => {
    for (const note of Object.values(SUPPORT_AREA_NOTES)) {
      expect(bannedLanguageIn(note), note).toEqual([]);
      expect(note, note).not.toMatch(/\b(best|should|must|recommend\w*)\b/i);
    }
  });
});

describe("every support option says where it shows up", () => {
  it("names a lab marker, or says where else you would see it", () => {
    const silent = SUPPORT_OPTIONS.filter(
      (option) => option.findings.every((finding) => finding.markers.length === 0) && !option.whereYouSeeIt,
    );
    expect(silent.map((option) => option.key)).toEqual([]);
  });

  it("keeps those notes free of banned and directive wording", () => {
    const notes = SUPPORT_OPTIONS.map((option) => option.whereYouSeeIt).filter((note): note is string => Boolean(note));
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(bannedLanguageIn(note), note).toEqual([]);
      expect(note, note).not.toMatch(/\b(best|should|must|recommend\w*|protects?|prevents?)\b/i);
    }
  });
});
