import { describe, expect, it } from "vitest";

import { offPlanLine, offPlanReason, offPlanToday } from "../off-plan";

/* ════════════════════════════════════════════════════════════════════════
   NOTHING IN THE LOG IS INVISIBLE — the owner's report: "it's not even
   saying I'm on it. It's not even mentioned anywhere."
   ════════════════════════════════════════════════════════════════════════ */

const entry = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, isActive: true, ...over });

describe("in your log, not on today", () => {
  it("names every entry with nothing on today's plan", () => {
    const items = offPlanToday(
      [entry("a", "Testosterone"), entry("b", "Masteron"), entry("c", "Creatine")],
      ["a"],
    );
    /* Same reason, so alphabetical by name: Creatine before Masteron. */
    expect(items.map((i) => i.id)).toEqual(["c", "b"]);
  });

  it("says why, in the member's own terms", () => {
    expect(offPlanReason(entry("x", "X", { pausedAt: "2026-09-01" }))).toBe("paused");
    expect(offPlanReason(entry("x", "X", { isActive: false }))).toBe("ended");
    expect(offPlanReason(entry("x", "X", { scheduleReviewReason: "Needs a start date" }))).toBe("no-time");
    expect(offPlanReason(entry("x", "X", { scheduleRule: { type: "manual_only" } }))).toBe("manual");
    expect(offPlanReason(entry("x", "X", { frequencyType: "custom" }))).toBe("manual");
    expect(offPlanReason(entry("x", "X"))).toBe("another-day");
  });

  it("leads with what the member knows they are on", () => {
    const items = offPlanToday(
      [entry("a", "Another day"), entry("b", "Ended", { isActive: false }), entry("c", "Paused", { pausedAt: "2026-09-01" })],
      [],
    );
    expect(items.map((i) => i.reason)).toEqual(["paused", "ended", "another-day"]);
  });

  it("counts them in one line, and says nothing when everything is on today", () => {
    const items = offPlanToday([entry("a", "A", { pausedAt: "2026-09-01" }), entry("b", "B", { isActive: false }), entry("c", "C")], []);
    expect(offPlanLine(items)).toBe("In your log, not on today: 1 paused · 1 ended · 1 on another day");
    expect(offPlanLine([])).toBeNull();
  });

  it("never says a compound was removed, and never blames the member", () => {
    const items = offPlanToday([entry("a", "A", { pausedAt: "x" }), entry("b", "B", { isActive: false })], []);
    for (const item of items) expect(item.note).toMatch(/still in your record/);
  });
});
