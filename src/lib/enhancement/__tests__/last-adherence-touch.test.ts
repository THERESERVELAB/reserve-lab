import { describe, expect, it } from "vitest";

import type { EnhancementAdherenceRecord } from "@/lib/athlete-store";
import { getLastAdherenceTouch } from "@/lib/enhancement/status";

/** A dose is logged at some moment (createdAt) but FOR a given day (date).
 *  The readout must follow the dose's day, not the moment it was entered. */
function rec(partial: Partial<EnhancementAdherenceRecord>): EnhancementAdherenceRecord {
  return {
    id: Math.random().toString(36).slice(2),
    entryId: "enh-1",
    date: "2026-01-01",
    plannedTime: "08:00",
    takenStatus: "taken",
    actualTime: "08:00",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("getLastAdherenceTouch — dates by the dose's own day, not when it was entered", () => {
  it("a dose logged NOW but FOR yesterday reads 'Yesterday', not 'Today'", () => {
    // Entered this moment (createdAt now), but the dose is for yesterday.
    const touch = getLastAdherenceTouch("enh-1", [rec({ date: dayKey(-1), createdAt: new Date().toISOString() })]);
    expect(touch?.label.startsWith("Logged · Yesterday")).toBe(true);
    expect(touch?.label.includes("Today")).toBe(false);
  });

  it("a dose for today reads 'Today'", () => {
    const touch = getLastAdherenceTouch("enh-1", [rec({ date: dayKey(0) })]);
    expect(touch?.label.startsWith("Logged · Today")).toBe(true);
  });

  it("with a today dose and a backfilled older dose, the latest-dated one is 'last'", () => {
    const touch = getLastAdherenceTouch("enh-1", [
      rec({ date: dayKey(-3), createdAt: new Date().toISOString() }), // backfilled just now, but 3 days ago
      rec({ date: dayKey(0), createdAt: new Date(Date.now() - 60_000).toISOString() }),
    ]);
    expect(touch?.record.date).toBe(dayKey(0));
    expect(touch?.label.startsWith("Logged · Today")).toBe(true);
  });

  it("a skipped dose for yesterday reads 'Skipped · Yesterday'", () => {
    const touch = getLastAdherenceTouch("enh-1", [rec({ date: dayKey(-1), takenStatus: "skipped" })]);
    expect(touch?.label.startsWith("Skipped · Yesterday")).toBe(true);
  });
});
