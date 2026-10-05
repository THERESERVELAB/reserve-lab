import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";

import { buildRecoverySnapshot, buildRecoverySuite } from "../engine";
import { localDateKey } from "../types";

/**
 * A member checked off Recovery Suite tools at 10pm and saw them still done
 * the next morning. The suite was keyed to the UTC day, which in every US time
 * zone rolls over in the evening. Recovery days are the member's own days.
 */

const store = () => useAthleteDashboardStore.getState();
const tenPm = new Date(2026, 8, 15, 22, 0);
const nextMorning = new Date(2026, 8, 16, 7, 30);

beforeEach(() => {
  resetMemberStateToDefaults();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recovery uses the member's own calendar day", () => {
  it("keys a late-evening moment to that evening, not the UTC tomorrow", () => {
    expect(localDateKey(tenPm)).toBe("2026-09-15");
    expect(localDateKey(new Date(2026, 8, 15, 23, 59))).toBe("2026-09-15");
    expect(localDateKey(new Date(2026, 8, 16, 0, 1))).toBe("2026-09-16");
  });

  it("does not carry last night's Recovery Suite checks into the next morning", () => {
    vi.setSystemTime(tenPm);
    const toolId = buildRecoverySuite(buildRecoverySnapshot(store().recoveryCommand, tenPm), store().recoveryCommand, tenPm)[0].id;
    store().toggleRecoverySuiteTool(toolId);
    expect(store().recoveryCommand.suiteDate).toBe("2026-09-15");

    const lastNight = store().recoveryCommand;
    expect(buildRecoverySuite(buildRecoverySnapshot(lastNight, tenPm), lastNight, tenPm).find((t) => t.id === toolId)?.completed).toBe(true);

    vi.setSystemTime(nextMorning);
    const morning = store().recoveryCommand;
    expect(buildRecoverySuite(buildRecoverySnapshot(morning, nextMorning), morning, nextMorning).find((t) => t.id === toolId)?.completed).toBe(false);

    /* A check the next morning starts a fresh day rather than extending last night's list. */
    store().toggleRecoverySuiteTool(toolId);
    expect(store().recoveryCommand.suiteDate).toBe("2026-09-16");
    expect(store().recoveryCommand.suiteCompletedToday).toEqual([toolId]);
  });

  it("counts water logged at 10pm toward that evening, not the next day", () => {
    vi.setSystemTime(tenPm);
    store().logHydration({ date: localDateKey(), oz: 24 });
    expect(buildRecoverySnapshot(store().recoveryCommand, tenPm).hydrationTodayOz).toBeGreaterThanOrEqual(24);

    const morningOz = buildRecoverySnapshot(store().recoveryCommand, nextMorning).hydrationTodayOz;
    const lastNightLogs = store().recoveryCommand.hydrationLogs.filter((h) => h.date === "2026-09-15");
    expect(lastNightLogs.length).toBeGreaterThan(0);
    expect(store().recoveryCommand.hydrationLogs.filter((h) => h.date === "2026-09-16")).toEqual([]);
    expect(morningOz).toBe(0);
  });
});
