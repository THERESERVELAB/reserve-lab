import { describe, expect, it } from "vitest";

import { backdateChoices, missedDay, missedDayLine } from "../missed-day";

/* ════════════════════════════════════════════════════════════════════════
   A DAY THAT GOT AWAY — rebuilt from that day's own plan, ticked by the
   member, never decided for them.
   ════════════════════════════════════════════════════════════════════════ */

const NOW = new Date(2026, 8, 24, 10, 0, 0);

const slot = (id: string, name: string, time: string) => ({
  id,
  entryId: id,
  plannedTime: time,
  plannedTimeLabel: time,
  entry: { name },
});

describe("logging a missed day", () => {
  it("offers yesterday back through the week, and never today", () => {
    const choices = backdateChoices(NOW);
    expect(choices).toHaveLength(7);
    expect(choices[0]).toEqual({ date: "2026-09-23", label: "Yesterday" });
    expect(choices.map((c) => c.date)).not.toContain("2026-09-24");
    expect(choices.at(-1)!.date).toBe("2026-09-17");
  });

  it("rebuilds the day from what was scheduled then", () => {
    const day = missedDay("2026-09-23", [slot("a", "Testosterone", "08:00"), slot("b", "Masteron", "20:30")], []);
    expect(day.doses.map((d) => d.name)).toEqual(["Testosterone", "Masteron"]);
    expect(day.open).toHaveLength(2);
    expect(day.none).toBe(false);
  });

  it("carries through what the member already recorded, and never offers it again", () => {
    const day = missedDay(
      "2026-09-23",
      [slot("a", "Testosterone", "08:00"), slot("b", "Masteron", "20:30")],
      [{ entryId: "a", date: "2026-09-23", plannedTime: "08:00", takenStatus: "taken" }],
    );
    expect(day.doses.find((d) => d.entryId === "a")!.status).toBe("taken");
    expect(day.open.map((d) => d.entryId)).toEqual(["b"]);
    expect(missedDayLine(day)).toBe("1 still open · 1 already recorded.");
  });

  it("does not confuse another day's record with this one", () => {
    const day = missedDay(
      "2026-09-23",
      [slot("a", "Testosterone", "08:00")],
      [{ entryId: "a", date: "2026-09-22", plannedTime: "08:00", takenStatus: "taken" }],
    );
    expect(day.open).toHaveLength(1);
  });

  it("says plainly when the day held nothing, or was already put right", () => {
    expect(missedDayLine(missedDay("2026-09-23", [], []))).toBe("Nothing was on your plan that day.");
    const done = missedDay("2026-09-23", [slot("a", "A", "08:00")], [{ entryId: "a", date: "2026-09-23", plannedTime: "08:00", takenStatus: "taken" }]);
    expect(missedDayLine(done)).toBe("All 1 of that day's doses are already recorded.");
    expect(missedDayLine(missedDay("2026-09-23", [slot("a", "A", "08:00")], []))).toBe("1 dose was on your plan that day.");
  });

  it("counts more than one dose in plain English", () => {
    expect(missedDayLine(missedDay("2026-09-23", [slot("a", "A", "08:00"), slot("b", "B", "20:00")], []))).toBe("2 doses were on your plan that day.");
  });

  it("a skipped dose stays skipped, and is not offered for logging", () => {
    const day = missedDay("2026-09-23", [slot("a", "A", "08:00")], [{ entryId: "a", date: "2026-09-23", plannedTime: "08:00", takenStatus: "skipped" }]);
    expect(day.doses[0].status).toBe("skipped");
    expect(day.open).toEqual([]);
  });
});
