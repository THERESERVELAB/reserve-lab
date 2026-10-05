import { describe, expect, it } from "vitest";

import { emptyTodayRead } from "../today-empty";

/* ════════════════════════════════════════════════════════════════════════
   A TODAY WITH NOTHING ON IT still says why. The owner's report was that
   compounds "stopped showing": the section rendered nothing at all.
   ════════════════════════════════════════════════════════════════════════ */

describe("why today is empty", () => {
  it("asks for a first compound when the log is empty", () => {
    const read = emptyTodayRead([]);
    expect(read.none).toBe(true);
    expect(read.action).toBe("add");
    expect(read.line).toMatch(/No compounds in your log yet/);
  });

  it("says out loud when every compound is paused, and keeps the way back", () => {
    const read = emptyTodayRead([{ isActive: true, pausedAt: "2026-09-01" }, { isActive: true, pausedAt: "2026-09-02" }]);
    expect(read.paused).toBe(2);
    expect(read.line).toMatch(/2 compounds paused/);
    expect(read.line).toMatch(/stay in your record/);
    expect(read.action).toBe("open-plan");
  });

  it("counts ended and paused apart, in the member's own words", () => {
    const read = emptyTodayRead([{ isActive: false }, { isActive: true, pausedAt: "2026-09-02" }]);
    expect(read.line).toMatch(/1 compound paused and 1 compound ended/);
  });

  it("explains a day where everything is active but nothing lands", () => {
    const read = emptyTodayRead([{ isActive: true }, { isActive: true }]);
    expect(read.none).toBe(false);
    expect(read.paused).toBe(0);
    expect(read.ended).toBe(0);
    expect(read.line).toMatch(/Nothing is due today on the times you set/);
    expect(read.action).toBe("open-plan");
  });

  it("never says nothing is due while an add-on is on the day", () => {
    /* A supplement the member added and gave a time to lands on today like anything else. */
    const read = emptyTodayRead([{ isActive: true }, { isActive: true }], 1);
    expect(read.line).toMatch(/No compounds due today. 1 add-on is on today, below./);
    expect(read.line).not.toMatch(/Nothing is due today/);
    /* Nothing to open: they are right under the line. */
    expect(read.action).toBeNull();
    expect(emptyTodayRead([{ isActive: true }], 2).line).toMatch(/2 add-ons are on today, below./);
  });

  it("still names paused and ended compounds when an add-on is on the day", () => {
    const read = emptyTodayRead([{ isActive: true }, { isActive: true, pausedAt: "2026-09-02" }], 1);
    expect(read.line).toMatch(/No compounds due today: 1 compound paused. 1 add-on is on today, below./);
    expect(read.action).toBe("open-plan");
  });
  it("never blames the member and never says a compound was removed", () => {
    for (const read of [emptyTodayRead([]), emptyTodayRead([{ isActive: false }]), emptyTodayRead([{ isActive: true }])]) {
      expect(read.line).not.toMatch(/deleted|removed|lost|error/i);
    }
  });
});
