import { describe, expect, it } from "vitest";

import { collectJournalEntries, countBySource, journalStatement } from "../entries";

const input = {
  sessionReviews: [
    {
      id: "s1",
      loggedAt: "2026-09-12T19:40:00.000Z",
      sessionName: "Upper Push",
      weekLabel: "Week 6",
      completionLabel: "Completed",
      bestOutput: "Incline press 185 × 8",
      limiter: "Front delt fatigue",
      notes: "Shoulders moved well once warm.",
    },
    // No note written — a generated review is not a journal entry.
    { id: "s2", loggedAt: "2026-09-10T19:40:00.000Z", sessionName: "Pull", bestOutput: "Row 225 × 6", notes: "   " },
  ],
  measurementEntries: [
    { id: "m1", date: "2026-09-11", bodyWeightLb: 187.5, notes: "Measured fasted." },
    { id: "m2", date: "2026-09-04", bodyWeightLb: 188.2 },
  ],
  photoCheckIns: [{ id: "p1", date: "2026-09-08", poses: ["front-relaxed", "side-relaxed"], notes: "Flat lighting." }],
  labRecords: [{ id: "l1", testDate: "2026-09-01", labName: "Quest", notes: "Fasted draw." }],
};

describe("collectJournalEntries", () => {
  const entries = collectJournalEntries(input);

  it("collects only the notes the member actually wrote", () => {
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.id)).not.toContain("session-s2");
    expect(entries.every((entry) => entry.body.trim().length > 0)).toBe(true);
  });

  it("orders them newest first", () => {
    expect(entries.map((entry) => entry.date)).toEqual(["2026-09-12", "2026-09-11", "2026-09-08", "2026-09-01"]);
  });

  it("names where each note was written, so the member knows where to write another", () => {
    expect(countBySource(entries)).toEqual({ session: 1, measurements: 1, photos: 1, labs: 1 });
    expect(entries[0]).toMatchObject({ source: "session", title: "Upper Push · Week 6", body: "Shoulders moved well once warm." });
  });

  it("carries the facts the member logged beside the note, never in place of it", () => {
    expect(entries[0].facts).toEqual(["Completed", "Best output · Incline press 185 × 8", "Limiter · Front delt fatigue"]);
    expect(entries[1].facts).toEqual(["187.5 lb"]);
    expect(entries[2].facts).toEqual(["2 poses"]);
  });

  it("returns nothing at all rather than a sample entry", () => {
    expect(collectJournalEntries({})).toEqual([]);
    expect(collectJournalEntries({ sessionReviews: [], labRecords: [] })).toEqual([]);
  });
});

describe("journalStatement", () => {
  it("says what is missing with nothing written", () => {
    expect(journalStatement([])).toBe("No entries written yet");
  });

  it("names the newest entry and the count", () => {
    expect(journalStatement(collectJournalEntries(input))).toBe("Last entry Sep 12 · 4 entries");
  });

  it("uses the singular for one entry", () => {
    const one = collectJournalEntries({ labRecords: [{ id: "l1", testDate: "2026-09-01", notes: "Fasted draw." }] });
    expect(journalStatement(one)).toBe("Last entry Sep 1 · 1 entry");
  });
});
