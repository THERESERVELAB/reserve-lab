import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { monitorSummary, type MonitorInput } from "../monitor-summary";

const empty: MonitorInput = {
  compoundEntryCount: 0,
  cycles: [],
  labRecords: [],
  measurementEntries: [],
  photoCheckIns: [],
};

const logged: MonitorInput = {
  compoundEntryCount: 3,
  cycles: [{ startDate: "2026-07-08" }, { startDate: "2026-02-01", endedOn: "2026-04-01" }],
  labRecords: [{ testDate: "2026-06-26" }, { testDate: "2026-09-01" }],
  measurementEntries: [{ date: "2026-09-11" }],
  photoCheckIns: [],
};

describe("monitorSummary", () => {
  it("says nothing is logged rather than showing capabilities that do nothing", () => {
    const summary = monitorSummary(empty);
    expect(summary.totalRecords).toBe(0);
    expect(summary.statement).toBe("No observational records yet");
    expect(summary.lines).toHaveLength(5);
    expect(summary.lines.every((line) => line.count === 0)).toBe(true);
    expect(summary.lines.every((line) => line.detail.startsWith("Nothing logged yet"))).toBe(true);
  });

  it("counts the member's own records and names the newest", () => {
    const summary = monitorSummary(logged);
    expect(summary.totalRecords).toBe(8);
    expect(summary.statement).toBe("8 records on file · last logged Sep 11");
    expect(summary.lines.find((line) => line.id === "cycles")?.detail).toBe("2 recorded · 1 still open");
    expect(summary.lines.find((line) => line.id === "labs")?.detail).toBe("2 on file · Last logged Sep 1");
    expect(summary.lines.find((line) => line.id === "photos")?.detail).toContain("Nothing logged yet");
  });

  it("gives every line a real destination — no line is decoration", () => {
    for (const line of monitorSummary(logged).lines) {
      expect(line.destination).toBeTruthy();
      expect(line.action.length).toBeGreaterThan(0);
    }
  });

  it("points the one primary action at the log that is actually empty", () => {
    expect(monitorSummary(empty).primary).toEqual({ label: "Open Compound Log", destination: "supplements" });
    expect(monitorSummary({ ...logged, labRecords: [] }).primary).toEqual({ label: "Add Lab Record", destination: "bloodwork" });
    expect(monitorSummary(logged).primary.destination).toBe("supplements");
  });

  it("never produces banned safety language", () => {
    for (const summary of [monitorSummary(empty), monitorSummary(logged)]) {
      const strings = [summary.statement, summary.primary.label, ...summary.lines.flatMap((line) => [line.label, line.detail, line.action])];
      for (const text of strings) {
        expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
      }
    }
  });
});
