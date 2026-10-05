import { describe, expect, it } from "vitest";

import { LOG_RANKS, logStreak, loggedDays, momentFor, nextRank, rankFor } from "../log-rank";
import type { RecoveryCommandState } from "../types";

type LogState = Pick<RecoveryCommandState, "sleepLogs" | "hydrationLogs" | "mobilityLogs" | "stressCheckIns">;

const empty = (): LogState => ({ sleepLogs: [], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] });
const withWater = (state: LogState, ...dates: string[]): LogState => ({ ...state, hydrationLogs: [...state.hydrationLogs, ...dates.map((date) => ({ date, oz: 20 }))] });
const withSleep = (state: LogState, date: string): LogState => ({ ...state, sleepLogs: [...state.sleepLogs, { date, hours: 7.5 }] });

describe("log rank", () => {
  it("ranks by days logged, with no rank named like a starter tier", () => {
    expect(rankFor(0).name).toBe("Initiate");
    expect(rankFor(3).name).toBe("Operator");
    expect(rankFor(6).name).toBe("Operator");
    expect(rankFor(7).name).toBe("Specialist");
    expect(rankFor(250).name).toBe("Legend");
    expect(nextRank(250)).toBeNull();
    for (const rank of LOG_RANKS) expect(rank.name).not.toMatch(/\b(core|basic|starter|entry|lite|standard|beginner)\b/i);
  });

  it("counts a day once however many kinds were logged on it", () => {
    const state = withSleep(withWater(empty(), "2026-09-14", "2026-09-15", "2026-09-15"), "2026-09-15");
    expect(loggedDays(state).size).toBe(2);
  });

  it("counts a streak back from today and simply stops at a gap", () => {
    const state = withWater(empty(), "2026-09-12", "2026-09-14", "2026-09-15", "2026-09-16");
    expect(logStreak(state, "2026-09-16")).toBe(3);
    expect(logStreak(state, "2026-09-17")).toBe(0);
  });

  it("plays once for the first log of a kind today, not on every repeat", () => {
    const before = withWater(empty(), "2026-09-15");
    const first = withWater(before, "2026-09-16");
    expect(momentFor("water", before, first, "2026-09-16")?.headline).toBe("Water logged");
    const again = withWater(first, "2026-09-16");
    expect(momentFor("water", first, again, "2026-09-16")).toBeNull();
    /* A different kind the same day is its own first. */
    expect(momentFor("sleep", again, withSleep(again, "2026-09-16"), "2026-09-16")?.headline).toBe("Night logged");
  });

  it("marks the rank up and starts the bar fresh at the new rank", () => {
    const before = withWater(empty(), "2026-09-14", "2026-09-15");
    const after = withWater(before, "2026-09-16");
    const moment = momentFor("water", before, after, "2026-09-16")!;
    expect(moment.rankedUp).toBe(true);
    expect(moment.headline).toBe("Rank up");
    expect(moment.previousRank.name).toBe("Initiate");
    expect(moment.rank.name).toBe("Operator");
    expect(moment.progressBefore).toBe(0);
    expect(moment.next?.name).toBe("Specialist");
    expect(moment.streak).toBe(3);
  });
});
