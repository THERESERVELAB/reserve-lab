import { describe, expect, it } from "vitest";

import { buildStrategistEvidence, type StrategistEvidenceInput } from "../evidence";

function input(over: Partial<StrategistEvidenceInput> = {}): StrategistEvidenceInput {
  return {
    sleepDates: ["2026-09-10", "2026-09-11", "2026-09-12"],
    hydrationDates: ["2026-09-12"],
    checkInDates: ["2026-09-09"],
    physiqueDates: ["2026-09-01"],
    ...over,
  };
}

const empty: StrategistEvidenceInput = {
  sleepDates: [],
  hydrationDates: [],
  checkInDates: [],
  physiqueDates: [],
};

describe("buildStrategistEvidence", () => {
  it("counts every logged entry across all sources", () => {
    expect(buildStrategistEvidence(input()).entries).toBe(6);
  });

  it("reports the real span, first to last, inclusive", () => {
    const evidence = buildStrategistEvidence(input());
    expect(evidence.firstDate).toBe("2026-09-01");
    expect(evidence.lastDate).toBe("2026-09-12");
    expect(evidence.spanDays).toBe(12);
    expect(evidence.line).toBe("Built from 6 logged entries over 12 days · 2026-09-01 to 2026-09-12.");
  });

  it("says evidence is needed rather than showing a zero score", () => {
    const evidence = buildStrategistEvidence(empty);
    expect(evidence.entries).toBe(0);
    expect(evidence.spanDays).toBe(0);
    expect(evidence.firstDate).toBeNull();
    expect(evidence.line).toBe("Evidence needed · nothing has been logged yet.");
    expect(evidence.line).not.toMatch(/%/);
  });

  it("never renders a percentage or a score", () => {
    for (const state of [input(), empty, input({ sleepDates: ["2026-09-12"] })]) {
      expect(buildStrategistEvidence(state).line).not.toMatch(/%|\bscore\b|\/100/i);
    }
  });

  it("reads a single day as one day, not a span", () => {
    const evidence = buildStrategistEvidence({ ...empty, sleepDates: ["2026-09-12"] });
    expect(evidence.spanDays).toBe(1);
    expect(evidence.line).toBe("Built from 1 logged entry on 2026-09-12.");
  });

  it("counts two entries on the same day as one day of span", () => {
    const evidence = buildStrategistEvidence({
      ...empty,
      sleepDates: ["2026-09-12"],
      hydrationDates: ["2026-09-12"],
    });
    expect(evidence.entries).toBe(2);
    expect(evidence.spanDays).toBe(1);
    expect(evidence.line).toBe("Built from 2 logged entries on 2026-09-12.");
  });

  it("accepts a full ISO timestamp by reading its date", () => {
    const evidence = buildStrategistEvidence({ ...empty, sleepDates: ["2026-09-12T23:30:00.000Z"] });
    expect(evidence.firstDate).toBe("2026-09-12");
    expect(evidence.entries).toBe(1);
  });

  it("drops unparseable entries instead of counting them as evidence", () => {
    const evidence = buildStrategistEvidence({
      ...empty,
      sleepDates: ["", "not-a-date", "2026-09-12"],
    });
    expect(evidence.entries).toBe(1);
  });

  it("is order-independent", () => {
    const forward = buildStrategistEvidence({ ...empty, sleepDates: ["2026-09-01", "2026-09-12"] });
    const reverse = buildStrategistEvidence({ ...empty, sleepDates: ["2026-09-12", "2026-09-01"] });
    expect(reverse).toEqual(forward);
  });
});
