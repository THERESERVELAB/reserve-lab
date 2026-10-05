import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import {
  flagReason,
  isFlaggedRow,
  isOutsideOwnRange,
  labEvidence,
  labSummary,
  markerTrends,
  trendSentence,
  trendsByPanel,
  type LabRecord,
} from "../record-summary";

const june: LabRecord = {
  id: "r1",
  testDate: "2026-06-26",
  labName: "Quest",
  markers: [
    { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
    { name: "Glucose", value: "88", unit: "mg/dL", referenceRange: "65-99" },
  ],
};

const september: LabRecord = {
  id: "r2",
  testDate: "2026-09-01",
  labName: "Quest",
  markers: [
    { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" },
    { name: "Glucose", value: "91", unit: "mg/dL", referenceRange: "65-99" },
    { name: "Nonsense Assay", value: "REACTIVE" },
  ],
};

describe("flagging", () => {
  it("raises a row only because of the member's own report", () => {
    expect(isOutsideOwnRange({ name: "Hematocrit", value: "52.1", referenceRange: "38.5-50.0" })).toBe(true);
    expect(isOutsideOwnRange({ name: "Glucose", value: "88", referenceRange: "65-99" })).toBe(false);
    // No printed range means Reserve has nothing to compare against — and never supplies one.
    expect(isOutsideOwnRange({ name: "Glucose", value: "88" })).toBe(false);
  });

  it("carries the lab's own flag even when the range is missing", () => {
    expect(isFlaggedRow({ name: "Estradiol", value: "62", labFlag: "H" })).toBe(true);
    expect(flagReason({ name: "Estradiol", value: "62", labFlag: "H" })).toBe("Your lab flagged this High");
    expect(flagReason({ name: "Hematocrit", value: "52.1", referenceRange: "38.5-50.0" })).toBe(
      "Outside the range printed on your report (38.5-50.0)",
    );
    expect(flagReason({ name: "Glucose", value: "88", referenceRange: "65-99" })).toBeNull();
  });
});

describe("labSummary", () => {
  it("says what is missing with no records", () => {
    const summary = labSummary([]);
    expect(summary.statement).toBe("No lab records yet");
    expect(summary.recordCount).toBe(0);
    expect(summary.newestFlaggedCount).toBe(0);
  });

  it("counts the newest record's results and how many its own lab raised", () => {
    const summary = labSummary([june, september]);
    expect(summary.newest?.id).toBe("r2");
    expect(summary.history[0].id).toBe("r2");
    expect(summary.newestResultCount).toBe(3);
    expect(summary.newestFlaggedCount).toBe(1);
    expect(summary.totalResultCount).toBe(5);
    expect(summary.spanDays).toBe(67);
    expect(summary.statement).toBe("Last lab record Sep 1 · Quest");
  });

  it("needs two records before it will call anything a trend", () => {
    expect(labEvidence([september]).enough).toBe(false);
    expect(labEvidence([june, september]).enough).toBe(true);
    expect(labEvidence([june, september]).line).toContain("2 lab records over 67 days");
  });
});

describe("markerTrends", () => {
  const trends = markerTrends([june, september]);

  it("puts the results the member's lab raised first", () => {
    expect(trends[0].label).toBe("Hematocrit");
    expect(trends[0].flagged).toBe(true);
    expect(trends[0].reason).toBe("Your lab flagged this High");
  });

  it("reports the change between the member's own draws", () => {
    const hematocrit = trends.find((trend) => trend.label === "Hematocrit")!;
    expect(hematocrit.previous).toMatchObject({ value: "45", date: "2026-06-26" });
    expect(hematocrit.delta).toBe(7.1);
    expect(hematocrit.direction).toBe("rising");
    expect(hematocrit.daysBetween).toBe(67);
    expect(trendSentence(hematocrit)).toBe("Up 7.1 from 45 on Jun 26");
  });

  it("keeps an unrecognized test rather than dropping it, and never invents a range for it", () => {
    const nonsense = trends.find((trend) => trend.label === "Nonsense Assay")!;
    expect(nonsense.key).toBeNull();
    expect(nonsense.panel).toBe("Not recognized");
    expect(nonsense.latest.referenceRange).toBeUndefined();
    // A non-numeric result has no delta and therefore no direction.
    expect(nonsense.delta).toBeNull();
    expect(trendSentence(nonsense)).toBeNull();
  });

  it("gives a single draw a value but no trend", () => {
    const single = markerTrends([september]);
    expect(single.every((trend) => trend.previous === null)).toBe(true);
    expect(single.every((trend) => trendSentence(trend) === null)).toBe(true);
  });

  it("groups trends under the panel a marker belongs to", () => {
    const panels = trendsByPanel(trends);
    expect(panels.map((group) => group.panel)).toContain("Not recognized");
    // "Not recognized" is always last.
    expect(panels[panels.length - 1].panel).toBe("Not recognized");
  });
});

describe("clinical language", () => {
  it("never produces banned safety language", () => {
    const strings = [
      labSummary([june, september]).statement,
      labSummary([]).statement,
      labEvidence([june, september]).line,
      labEvidence([]).line,
      ...markerTrends([june, september]).flatMap((trend) => [trend.reason, trendSentence(trend)]),
    ].filter((text): text is string => Boolean(text));

    for (const text of strings) {
      expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
    }
  });

  it("never renders a verdict about a value", () => {
    const text = [
      ...markerTrends([june, september]).flatMap((trend) => [trend.reason ?? "", trendSentence(trend) ?? ""]),
      labSummary([june, september]).statement,
    ].join(" ");
    // Reserve carries the lab's printed flag; it never calls a value elevated,
    // low, optimal or deficient in its own voice, and never names a condition.
    for (const forbidden of [/\bdiagnos/i, /\bdeficien/i, /\boptimal range\b/i, /\bnormal\b/i, /\bhealthy\b/i, /\bconcerning\b/i]) {
      expect(forbidden.test(text), `"${forbidden}" appeared in "${text}"`).toBe(false);
    }
  });
});
