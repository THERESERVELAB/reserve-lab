import { describe, expect, it } from "vitest";

import { resolveCycleState, type CyclePeriod } from "@/lib/cycle/cycle-period";
import { markerTrends, type LabRecord } from "@/lib/labs/record-summary";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { NO_CLINICIAN_LINE } from "@/lib/safety/care-options";

import {
  CLINICAL_COPY,
  WARNING_SIGN_COUNT,
  biomarkerStatement,
  clinicalPrimary,
  cycleRowLine,
  findingGroups,
  findingReasons,
  labSafetyHeading,
  monitorRows,
  needsEmergencyLine,
  noCycleLine,
  symptomRowLine,
  trendDates,
  trendFlag,
  trendRange,
  trendReading,
  trendRoute,
  watchedGroups,
  watchedMarkerStatus,
  watchedRowLine,
} from "../clinical-records";

const RECORDS: LabRecord[] = [
  {
    id: "a",
    testDate: "2026-06-26",
    labName: "Quest",
    markers: [
      { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
      { name: "Glucose", value: "88", unit: "mg/dL", referenceRange: "65-99" },
    ],
  },
  {
    id: "b",
    testDate: "2026-09-01",
    labName: "Quest",
    markers: [
      { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" },
      { name: "Glucose", value: "91", unit: "mg/dL", referenceRange: "65-99" },
    ],
  },
];

const CYCLE: CyclePeriod = {
  id: "c",
  name: "Autumn block",
  startDate: "2026-08-08",
  plannedWeeks: 12,
  compoundIds: ["t"],
  clinicianOversight: true,
  checkpoints: [{ id: "cp", date: "2026-09-25", label: "Mid-cycle panel", setBy: "clinician" }],
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

describe("clinical primary actions", () => {
  it("gives each screen exactly one gold action that lands on the real logger", () => {
    expect(clinicalPrimary("bloodwork")).toEqual({ label: "New Lab Record", kind: "open-intake" });
    expect(clinicalPrimary("biomarker-intelligence")).toEqual({ label: "Add Lab Record", kind: "view", view: "bloodwork" });
  });

  it("drops a row's own control only where it would repeat the gold action", () => {
    const rows = monitorRows(
      [
        { id: "compounds", action: "Open Compound Log", destination: "supplements" },
        { id: "cycles", action: "Open Compound Log", destination: "supplements" },
        { id: "labs", action: "Open Bloodwork Log", destination: "bloodwork" },
      ],
      { label: "Open Compound Log", destination: "supplements" },
    );
    expect(rows.map((row) => row.showAction)).toEqual([false, false, true]);
    // A different primary keeps the compound rows' controls.
    expect(monitorRows(rows, { label: "Add Lab Record", destination: "bloodwork" }).every((row) => row.showAction)).toBe(true);
  });
});

describe("biomarker statement", () => {
  it("counts records, span and results outside the report's own range", () => {
    const trends = markerTrends(RECORDS);
    expect(biomarkerStatement({ recordCount: 2, spanDays: 67, trends })).toBe("2 lab records over 67 days · 1 outside your lab's range");
  });

  it("says nothing is logged rather than printing zeros", () => {
    expect(biomarkerStatement({ recordCount: 0, spanDays: null, trends: [] })).toBe("No lab records yet");
  });

  it("counts a lab flag inside the printed range apart, never as outside it", () => {
    const trends = markerTrends([{ id: "x", testDate: "2026-09-01", markers: [{ name: "Glucose", value: "91", referenceRange: "65-99", labFlag: "A" }] }]);
    expect(biomarkerStatement({ recordCount: 1, spanDays: null, trends })).toBe("1 lab record · 0 outside your lab's range · 1 flagged by your lab");
  });
});

describe("marker rows", () => {
  const trends = markerTrends(RECORDS);
  const hematocrit = trends.find((trend) => trend.label === "Hematocrit")!;
  const glucose = trends.find((trend) => trend.label === "Glucose")!;

  it("shows previous → latest, the report's range and the lab's own flag", () => {
    expect(trendReading(hematocrit)).toBe("45 → 52.1 %");
    expect(trendDates(hematocrit)).toBe("Jun 26 → Sep 1");
    expect(trendRange(hematocrit)).toBe("Range on your report 38.5-50.0");
    expect(trendFlag(hematocrit)).toBe("Your lab flagged this High");
    expect(trendRoute(hematocrit)).toBe("Get this reviewed");
  });

  it("raises nothing Reserve's own judgement would add", () => {
    expect(trendFlag(glucose)).toBeNull();
    expect(trendRoute(glucose)).toBeNull();
  });

  it("names units on both sides when the draws used different units", () => {
    const [trend] = markerTrends([
      { id: "1", testDate: "2026-01-01", markers: [{ name: "Glucose", value: "5", unit: "mmol/L" }] },
      { id: "2", testDate: "2026-02-01", markers: [{ name: "Glucose", value: "90", unit: "mg/dL" }] },
    ]);
    expect(trendReading(trend)).toBe("5 mmol/L → 90 mg/dL");
  });

  it("says a range was not printed rather than supplying one", () => {
    const [trend] = markerTrends([{ id: "1", testDate: "2026-01-01", markers: [{ name: "Glucose", value: "90" }] }]);
    expect(trendRange(trend)).toBe("No range printed on your report");
  });

  it("routes a critical flag to a same-day review", () => {
    const [trend] = markerTrends([{ id: "1", testDate: "2026-01-01", markers: [{ name: "Potassium", value: "6.8", labFlag: "HH" }] }]);
    expect(trendRoute(trend)).toBe("Get a medical review today");
  });
});

describe("compact rows", () => {
  it("reads the cycle from the member's own dates", () => {
    const state = resolveCycleState(CYCLE, { now: new Date(2026, 8, 15, 16, 12), compounds: [] });
    expect(cycleRowLine(state)).toBe("Autumn block · week 6 of 12 · checkpoint Sep 25");
    expect(noCycleLine(1)).toBe("1 compound marked active · no cycle dates recorded");
    expect(noCycleLine(0)).toBe("No cycle dates recorded");
  });

  it("names the compound once as a heading, not on every marker", () => {
    const groups = watchedGroups([
      { markerKey: "lh", label: "LH", compounds: ["Testosterone Cypionate"] },
      { markerKey: "fsh", label: "FSH", compounds: ["Testosterone Cypionate"], lastTestedOn: "2025-01-02" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe("Commonly watched for Testosterone Cypionate");
    expect(groups[0].markers.map((m) => m.label)).toEqual(["LH", "FSH"]);
    expect(watchedMarkerStatus(groups[0].markers[1])).toBe("last tested Jan 2");
    expect(watchedRowLine(9)).toBe("9 markers not in your recent labs");
  });

  it("counts every warning sign the check lists", () => {
    expect(WARNING_SIGN_COUNT).toBe(17);
    expect(symptomRowLine(0)).toBe("17 warning signs");
    expect(symptomRowLine(5)).toBe("17 warning signs · 5 linked to what you logged");
  });

  it("groups lab findings under the compounds they are watched for, unlinked last", () => {
    const groups = findingGroups([
      { id: "g", linkedCompounds: [] },
      { id: "h", linkedCompounds: ["Testosterone Cypionate"] },
    ]);
    expect(groups.map((g) => g.heading)).toEqual(["Commonly watched for Testosterone Cypionate", "Other results"]);
    expect(
      findingReasons([
        "The lab marked this result critical high.",
        "Above the reference range on your Quest report (38.5-50.0 %).",
        "Commonly watched for Testosterone Cypionate, which you logged.",
      ]),
    ).toEqual(["The lab marked this result critical high."]);
    expect(labSafetyHeading(1)).toBe("1 result to have reviewed");
  });

  it("keeps 911 / 988 on screen for any warning sign or critical lab", () => {
    expect(needsEmergencyLine({ criticalLabCount: 0, recentRedFlagCount: 0 })).toBe(false);
    expect(needsEmergencyLine({ criticalLabCount: 1, recentRedFlagCount: 0 })).toBe(true);
    expect(needsEmergencyLine({ criticalLabCount: 0, recentRedFlagCount: 2 })).toBe(true);
  });
});

describe("compliance", () => {
  it("fixed copy passes the banned-language suite and stays under 240 characters", () => {
    const trends = markerTrends(RECORDS);
    const strings = [
      ...Object.values(CLINICAL_COPY),
      biomarkerStatement({ recordCount: 2, spanDays: 67, trends }),
      /* Not trendReading: it prints the member's own lab value and unit ("91 mg/dL"),
         which the amount pattern would match. Reserve adds no words to it. */
      ...trends.flatMap((t) => [trendRange(t), trendFlag(t) ?? "", trendRoute(t) ?? ""]),
      symptomRowLine(3),
      watchedRowLine(2),
      noCycleLine(2),
      NO_CLINICIAN_LINE,
    ];
    for (const text of strings) {
      expect(bannedLanguageIn(text), text).toEqual([]);
      expect(text.length, text).toBeLessThanOrEqual(240);
    }
  });

  it("never names a cause, a clearance or a protective claim", () => {
    const all = Object.values(CLINICAL_COPY).join(" ");
    expect(all).not.toMatch(/\b(caused by|because of your|safe|protect|diagnos(?!is\b)|treat|cure|deficien|optimal)/i);
    // Routes never assume a clinician is the only human available.
    expect(all).not.toMatch(/review with your clinician/i);
  });
});
