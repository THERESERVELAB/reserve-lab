import { describe, expect, it } from "vitest";

import type { ProgramRevision } from "@/lib/horizon/types";
import type { ReserveDecisionRecord } from "@/lib/training/session-execution";

import { optimizationEvidenceLine, resolveOptimizationHistory } from "../optimization-history";
import type { ResponseEvent } from "../types";

function decision(id: string, createdAt: string): ReserveDecisionRecord {
  return {
    id,
    createdAt,
    category: "session-adjustment",
    source: "athlete",
    programId: "program-1",
    observation: "A session was moved.",
    decision: "Moved Pull to Thursday.",
    reason: "Travel.",
  } as ReserveDecisionRecord;
}

function event(id: string, at: string): ResponseEvent {
  return {
    id,
    at,
    type: "insight-emerged",
    confidence: "emerging",
    observation: "Pressing volume repeated across two weeks.",
    decision: "Recorded the pattern.",
    reason: "Two comparable observations.",
    affectedWeeks: [],
  } as unknown as ResponseEvent;
}

function revision(id: string, createdAt: string): ProgramRevision {
  return {
    id,
    createdAt,
    reason: "Activity reconciled.",
    effectiveWeek: 4,
    affectedWeeks: [4, 5],
    source: "athlete",
    athleteConfirmed: true,
  } as unknown as ProgramRevision;
}

const line = (input: Parameters<typeof resolveOptimizationHistory>[0]) =>
  optimizationEvidenceLine(resolveOptimizationHistory(input));

describe("optimizationEvidenceLine", () => {
  it("says evidence is needed when nothing has been recorded", () => {
    const result = line({ decisions: [], events: [], revisions: [] });
    expect(result).toBe("Evidence needed · no decision has been recorded yet.");
    expect(result).not.toMatch(/\b0\b/);
  });

  it("counts every kind of record and reports the real span", () => {
    const result = line({
      decisions: [decision("d1", "2026-06-01T10:00:00.000Z"), decision("d2", "2026-07-02T10:00:00.000Z")],
      events: [event("e1", "2026-08-03T10:00:00.000Z")],
      revisions: [revision("r1", "2026-09-15T10:00:00.000Z")],
    });
    expect(result).toBe(
      "2 decision records, 1 response event and 1 program revision · 2026-06-01 to 2026-09-15.",
    );
  });

  it("omits the kinds that have no records rather than listing zeroes", () => {
    const result = line({ decisions: [decision("d1", "2026-06-01T10:00:00.000Z")], events: [], revisions: [] });
    expect(result).toBe("1 decision record · 2026-06-01.");
    expect(result).not.toContain("response event");
    expect(result).not.toContain("program revision");
  });

  it("prints one date when everything landed on the same day", () => {
    const result = line({
      decisions: [decision("d1", "2026-06-01T09:00:00.000Z")],
      events: [event("e1", "2026-06-01T18:00:00.000Z")],
      revisions: [],
    });
    expect(result).toBe("1 decision record and 1 response event · 2026-06-01.");
  });

  it("dates a record by the member's local day, not the UTC day", () => {
    /* 11:30 PM local is already tomorrow in UTC for every US time zone. */
    const late = new Date(2026, 8, 15, 23, 30).toISOString();
    const result = line({ decisions: [decision("d1", late)], events: [], revisions: [] });
    expect(result).toBe("1 decision record · 2026-09-15.");
  });

  it("never claims a projection or a forecast", () => {
    const result = line({
      decisions: [decision("d1", "2026-06-01T10:00:00.000Z")],
      events: [event("e1", "2026-08-03T10:00:00.000Z")],
      revisions: [revision("r1", "2026-09-15T10:00:00.000Z")],
    });
    expect(result).not.toMatch(/project|forecast|predict|expected|on track/i);
  });
});
