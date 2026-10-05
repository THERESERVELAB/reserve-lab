import { describe, expect, it } from "vitest";

import { buildArchitectureResolvedWeek, toApexWeekDays } from "../daily-context";
import { getArchitectureForSystem } from "../split-architectures";
import {
  applySplitCustomization,
  formatSplitDistance,
  isValidSplitDayEdit,
  isValidSplitDistance,
  movableSessionKey,
  nextDay,
  parseSplitDistance,
  planMoveToTomorrow,
  recordSplitDayEdit,
  sameSplitDayEdit,
  weekDateKeys,
  type SplitCustomization,
} from "../split-customization";

/* Wednesday 16 September 2026, noon — week runs Mon 14 … Sun 20. */
const WED = new Date(2026, 8, 16, 12);

function pplulaWeek() {
  const arch = getArchitectureForSystem("pplula");
  if (!arch) throw new Error("pplula architecture missing");
  return buildArchitectureResolvedWeek(arch, { active: false, upperChest: false });
}

/* ─── Distance goal ───────────────────────────────────────────────────── */

describe("distance goal on an activity day", () => {
  it("accepts 0.1–100 in mi or km and nothing else", () => {
    expect(isValidSplitDistance({ value: 3, unit: "mi" })).toBe(true);
    expect(isValidSplitDistance({ value: 0.1, unit: "km" })).toBe(true);
    expect(isValidSplitDistance({ value: 100, unit: "km" })).toBe(true);
    expect(isValidSplitDistance({ value: 0.05, unit: "mi" })).toBe(false);
    expect(isValidSplitDistance({ value: 101, unit: "mi" })).toBe(false);
    expect(isValidSplitDistance({ value: Number.NaN, unit: "mi" })).toBe(false);
    expect(isValidSplitDistance({ value: Number.POSITIVE_INFINITY, unit: "mi" })).toBe(false);
    expect(isValidSplitDistance({ value: 3, unit: "yd" })).toBe(false);
    expect(isValidSplitDistance({ value: "3", unit: "mi" })).toBe(false);
  });

  it("formats as the member typed it", () => {
    expect(formatSplitDistance({ value: 3, unit: "mi" })).toBe("3 mi");
    expect(formatSplitDistance({ value: 5, unit: "km" })).toBe("5 km");
    expect(formatSplitDistance({ value: 3.1, unit: "mi" })).toBe("3.1 mi");
    expect(formatSplitDistance(undefined)).toBeNull();
  });

  it("parses typed input: empty is no goal, out of range is rejected", () => {
    expect(parseSplitDistance("", "mi")).toBeUndefined();
    expect(parseSplitDistance("3", "mi")).toEqual({ value: 3, unit: "mi" });
    expect(parseSplitDistance("2,5", "km")).toEqual({ value: 2.5, unit: "km" });
    expect(parseSplitDistance("0", "mi")).toBeNull();
    expect(parseSplitDistance("500", "mi")).toBeNull();
    expect(parseSplitDistance("abc", "mi")).toBeNull();
  });

  it("keeps old edits without a distance valid, and rejects a malformed one", () => {
    expect(isValidSplitDayEdit({ kind: "activity", activity: "track" })).toBe(true);
    expect(isValidSplitDayEdit({ kind: "activity", activity: "track", distance: { value: 3, unit: "mi" } })).toBe(true);
    expect(isValidSplitDayEdit({ kind: "activity", activity: "track", distance: { value: -1, unit: "mi" } })).toBe(false);
    expect(isValidSplitDayEdit({ kind: "activity", activity: "track", distance: { value: 3, unit: "ft" } })).toBe(false);
  });

  it("treats the same activity with a different distance as the same choice", () => {
    expect(
      sameSplitDayEdit(
        { kind: "activity", activity: "track", distance: { value: 3, unit: "mi" } },
        { kind: "activity", activity: "track" },
      ),
    ).toBe(true);
  });

  it("threads the goal onto the resolved day and the rail day", () => {
    const dates = weekDateKeys(WED);
    const custom = recordSplitDayEdit(
      null,
      {
        dayIndex: 2,
        dateKey: dates[2],
        scope: "once",
        edit: { kind: "activity", activity: "track", distance: { value: 3, unit: "mi" } },
      },
      WED,
    );
    const week = applySplitCustomization(pplulaWeek(), custom, dates);
    expect(week[2].activity).toMatchObject({ key: "track", distance: { value: 3, unit: "mi" } });
    const rail = toApexWeekDays(week, WED);
    expect(rail[2].activity?.distance).toEqual({ value: 3, unit: "mi" });
  });
});

/* ─── Move today's session to tomorrow ────────────────────────────────── */

describe("move today's session to tomorrow", () => {
  const push = { recovery: false, splitKey: "push", title: "Push" };

  it("moves Wednesday's session to Thursday and sets Wednesday to Track", () => {
    const plan = planMoveToTomorrow({
      day: push,
      todayKey: "2026-09-16",
      replacement: { kind: "activity", activity: "track", distance: { value: 3, unit: "mi" } },
    });
    expect(plan).toEqual({
      session: "push",
      today: {
        dayIndex: 2,
        dateKey: "2026-09-16",
        scope: "once",
        edit: { kind: "activity", activity: "track", distance: { value: 3, unit: "mi" } },
      },
      tomorrow: { dayIndex: 3, dateKey: "2026-09-17", scope: "once", edit: { kind: "session", session: "push" } },
    });
  });

  it("crosses the week boundary: Sunday moves to next Monday", () => {
    const plan = planMoveToTomorrow({ day: push, todayKey: "2026-09-20", replacement: { kind: "rest" } });
    expect(plan?.today).toMatchObject({ dayIndex: 6, dateKey: "2026-09-20" });
    expect(plan?.tomorrow).toMatchObject({ dayIndex: 0, dateKey: "2026-09-21" });
  });

  it("crosses month and year boundaries", () => {
    expect(nextDay("2026-09-30")).toEqual({ dateKey: "2026-10-01", dayIndex: 3 });
    expect(nextDay("2026-12-31")).toEqual({ dateKey: "2027-01-01", dayIndex: 4 });
    expect(nextDay("not-a-date")).toBeNull();
  });

  it("returns null when today is not a lifting day", () => {
    expect(
      planMoveToTomorrow({
        day: { recovery: true, splitKey: "recovery", title: "Recovery" },
        todayKey: "2026-09-16",
        replacement: { kind: "rest" },
      }),
    ).toBeNull();
    expect(
      planMoveToTomorrow({
        day: { recovery: false, splitKey: null, title: "Track Session", activity: { key: "track" } },
        todayKey: "2026-09-16",
        replacement: { kind: "rest" },
      }),
    ).toBeNull();
  });

  it("refuses a session as today's replacement or an invalid pick", () => {
    expect(
      planMoveToTomorrow({ day: push, todayKey: "2026-09-16", replacement: { kind: "session", session: "legs" } }),
    ).toBeNull();
    expect(
      planMoveToTomorrow({
        day: push,
        todayKey: "2026-09-16",
        replacement: { kind: "activity", activity: "track", distance: { value: 0, unit: "mi" } },
      }),
    ).toBeNull();
  });

  it("falls back to the title when the engine key is not member-selectable", () => {
    expect(movableSessionKey({ recovery: false, splitKey: "not-a-key", title: "Pull" })).toBe("pull");
    expect(movableSessionKey({ recovery: false, splitKey: null, title: "Mystery" })).toBeNull();
  });

  it("applied to the week: today becomes Track, tomorrow becomes the moved session, both in history", () => {
    const dates = weekDateKeys(WED);
    const week = pplulaWeek();
    const today = week[2];
    const plan = planMoveToTomorrow({
      day: today,
      todayKey: dates[2],
      replacement: { kind: "activity", activity: "track" },
    });
    expect(plan).not.toBeNull();
    let custom: SplitCustomization | null = null;
    for (const input of [plan!.today, plan!.tomorrow]) custom = recordSplitDayEdit(custom, input, WED);

    const edited = applySplitCustomization(week, custom, dates);
    expect(edited[2].activity?.key).toBe("track");
    expect(edited[3].splitKey).toBe(today.splitKey);
    expect(edited[3].memberEdit).toEqual({ scope: "once", kind: "session" });
    expect(custom!.history).toHaveLength(2);

    // "Back to plan" on tomorrow clears only tomorrow.
    custom = recordSplitDayEdit(custom, { dayIndex: 3, dateKey: dates[3], scope: "once", edit: null }, WED);
    const cleared = applySplitCustomization(week, custom, dates);
    expect(cleared[2].activity?.key).toBe("track");
    expect(cleared[3].memberEdit).toBeUndefined();
  });
});
