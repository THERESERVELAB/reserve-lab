import { describe, expect, it } from "vitest";

import type { PhysiqueCommandState, PhysiqueEntry } from "../types";
import {
  agoLabel,
  conditionsMatched,
  daysApart,
  directionOf,
  evidenceLine,
  loggedWeightSeries,
  measurementRecord,
  photoRecord,
  physiqueEvidence,
  signed,
} from "../record-summary";

function entry(date: string, bodyWeightLb: number, measurements: PhysiqueEntry["measurements"] = {}): PhysiqueEntry {
  return { id: `e-${date}`, date, bodyWeightLb, measurements };
}

const state = (entries: PhysiqueEntry[]): Pick<PhysiqueCommandState, "entries"> => ({ entries });

describe("dates", () => {
  it("counts calendar days without drifting across time zones", () => {
    // `new Date("2026-09-12")` is UTC midnight, which is Sep 11 west of Greenwich.
    expect(daysApart("2026-09-01", "2026-09-12")).toBe(11);
    expect(daysApart("2026-09-12", "2026-09-12")).toBe(0);
  });

  it("says nothing about how long ago something was until the clock has mounted", () => {
    expect(agoLabel("2026-09-12", null)).toBeNull();
    expect(agoLabel("2026-09-12", new Date(2026, 8, 12))).toBe("today");
    expect(agoLabel("2026-09-11", new Date(2026, 8, 12))).toBe("yesterday");
    expect(agoLabel("2026-09-08", new Date(2026, 8, 12))).toBe("4 days ago");
  });
});

describe("measurementRecord", () => {
  it("says what is missing when nothing is logged", () => {
    const record = measurementRecord(state([]));
    expect(record.statement).toBe("No measurements logged yet");
    expect(record.entryCount).toBe(0);
    expect(record.sites).toEqual([]);
    expect(record.weightDeltaLb).toBeNull();
  });

  it("reports the newest entry first and the change against the previous one", () => {
    const record = measurementRecord(
      state([entry("2026-08-01", 190, { waist: 34 }), entry("2026-09-12", 187.5, { waist: 33.1 })]),
    );
    expect(record.newest?.date).toBe("2026-09-12");
    expect(record.history[0].date).toBe("2026-09-12");
    expect(record.weightDeltaLb).toBe(-2.5);
    expect(record.spanDays).toBe(42);
    expect(record.sites).toHaveLength(1);
    expect(record.sites[0]).toMatchObject({ site: "waist", previousIn: 34, deltaIn: -0.9 });
  });

  it("compares a site with the last check-in that actually measured it, not merely the one before", () => {
    const record = measurementRecord(
      state([
        entry("2026-07-01", 192, { arms: 16 }),
        entry("2026-08-01", 190, {}), // weight only — arms skipped
        entry("2026-09-12", 188, { arms: 16.4 }),
      ]),
    );
    expect(record.sites[0]).toMatchObject({ site: "arms", previousDate: "2026-07-01", deltaIn: 0.4 });
  });

  it("leaves a single entry without a change to report", () => {
    const record = measurementRecord(state([entry("2026-09-12", 188, { waist: 33 })]));
    expect(record.weightDeltaLb).toBeNull();
    expect(record.spanDays).toBeNull();
    expect(record.sites[0].deltaIn).toBeNull();
  });
});

describe("photoRecord", () => {
  it("counts the member's dated sets and never scores them", () => {
    const record = photoRecord({
      photoCheckIns: [
        { id: "p1", date: "2026-08-02", poses: ["front-relaxed"], consistencyScore: 66 },
        { id: "p2", date: "2026-09-10", poses: ["front-relaxed", "side-relaxed"], consistencyScore: 100 },
      ],
    });
    expect(record.checkInCount).toBe(2);
    expect(record.history[0].id).toBe("p2");
    expect(record.statement).toContain("Last check-in");
    expect(record.spanDays).toBe(39);
  });

  it("states what is missing with no sets on file", () => {
    expect(photoRecord({ photoCheckIns: [] }).statement).toBe("No photo check-ins yet");
  });

  it("turns a stored consistency percentage back into the count the member ticked", () => {
    expect(conditionsMatched(100, 3)).toEqual({ matched: 3, total: 3 });
    expect(conditionsMatched(67, 3)).toEqual({ matched: 2, total: 3 });
    expect(conditionsMatched(0, 3)).toEqual({ matched: 0, total: 3 });
  });
});

describe("evidence", () => {
  it("refuses a trend until there are two entries to compare", () => {
    expect(evidenceLine({ count: 0, firstDate: null, lastDate: null, noun: "check-in" })).toMatchObject({
      enough: false,
      line: "Evidence needed · no check-ins logged yet",
    });
    const one = evidenceLine({ count: 1, firstDate: "2026-09-12", lastDate: "2026-09-12", noun: "check-in" });
    expect(one.enough).toBe(false);
    expect(one.line).toContain("Evidence needed");
    expect(one.line).toContain("2 needed for a trend");
  });

  it("names the count and the span once there is enough", () => {
    const evidence = physiqueEvidence(state([entry("2026-07-11", 192), entry("2026-08-20", 190), entry("2026-09-12", 188)]));
    expect(evidence.enough).toBe(true);
    expect(evidence.entryCount).toBe(3);
    expect(evidence.spanDays).toBe(63);
    expect(evidence.line).toContain("3 check-ins over 63 days");
  });
});

describe("series", () => {
  it("returns only the points the member logged — never a projected one", () => {
    const series = loggedWeightSeries(state([entry("2026-09-12", 188, { waist: 33 }), entry("2026-08-01", 190)]));
    expect(series.map((point) => point.date)).toEqual(["2026-08-01", "2026-09-12"]);
    expect(series[0].waistIn).toBeNull();
    expect(series[1].waistIn).toBe(33);
    expect(series.every((point) => Number.isFinite(point.bodyWeightLb))).toBe(true);
  });
});

describe("direction and sign", () => {
  it("describes which way the number moved and nothing about whether that is good", () => {
    expect(directionOf(1.2)).toBe("rising");
    expect(directionOf(-1.2)).toBe("falling");
    expect(directionOf(0.1)).toBe("steady");
  });

  it("prints a real minus sign rather than a hyphen", () => {
    expect(signed(1.24, "in")).toBe("+1.2 in");
    expect(signed(-0.9, "lb")).toBe("−0.9 lb");
    expect(signed(0, "in")).toBe("0 in");
  });
});
