import { describe, expect, it } from "vitest";

import {
  scheduleDayState,
  scheduleDayStatus,
  scheduleIsSet,
  scheduleStatement,
  scheduleTimesLine,
  scheduleTimesParts,
  shortDate,
} from "../schedule-room";

const SCHEDULE = { wakeTime: "06:30", sleepTarget: "22:30", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

describe("scheduleIsSet", () => {
  it("is set only once the member has set or confirmed the schedule step", () => {
    expect(scheduleIsSet(["profile", "schedule"])).toBe(true);
    expect(scheduleIsSet(["profile"])).toBe(false);
    expect(scheduleIsSet([])).toBe(false);
    expect(scheduleIsSet(undefined)).toBe(false);
  });
});

describe("scheduleDayStatus", () => {
  it("agrees with the training-day resolver: training day or recovery day, and how training moved", () => {
    const status = (trainingPlanned: boolean, direction: Parameters<typeof scheduleDayStatus>[0]["context"]["direction"], targetDate?: string) =>
      scheduleDayStatus({ trainingPlanned, context: { direction, targetDate }, sessionLabel: "Pull" });

    expect(status(true, "unchanged")).toBe("Training day · Pull");
    expect(status(true, "moved-here")).toBe("Training day · Pull · moved here");
    expect(status(true, "swapped")).toBe("Training day · Pull · swapped in");
    expect(status(false, "moved-away", "2026-09-17")).toBe("Recovery day · Pull moved to Thu, Sep 17");
    expect(status(false, "moved-away")).toBe("Recovery day · Pull moved off today");
    expect(status(false, "set-aside")).toBe("Recovery day · Pull set aside");
    expect(status(false, "unchanged")).toBe("Recovery day");
  });
});

describe("shortDate", () => {
  it("reads an ISO date and refuses anything else", () => {
    expect(shortDate("2026-09-15")).toBe("Tue, Sep 15");
    expect(shortDate("2026-02-30")).toBeNull();
    expect(shortDate("tomorrow")).toBeNull();
    expect(shortDate(undefined)).toBeNull();
  });
});

describe("scheduleTimesLine", () => {
  it("prints the member's own times, and the training window only on a day that trains", () => {
    expect(scheduleTimesLine({ schedule: SCHEDULE, trainingPlanned: true })).toBe("Wake 6:30 AM · Training 5:30 PM to 7:00 PM · Sleep lock 10:30 PM");
    expect(scheduleTimesLine({ schedule: SCHEDULE, trainingPlanned: false })).toBe("Wake 6:30 AM · Sleep lock 10:30 PM");
    expect(scheduleTimesParts({ schedule: SCHEDULE, trainingPlanned: true })).toEqual(["Wake 6:30 AM", "Training 5:30 PM to 7:00 PM", "Sleep lock 10:30 PM"]);
  });
});

describe("scheduleDayState + scheduleStatement", () => {
  const state = (over: Partial<Parameters<typeof scheduleDayState>[0]> = {}) =>
    scheduleDayState({ now: at("16:12"), schedule: SCHEDULE, scheduleSet: true, trainingPlanned: true, sessionMode: "idle", sleepConflict: "none", ...over });

  it("follows the day", () => {
    expect(state({ scheduleSet: false })).toBe("not-set");
    expect(state({ now: at("05:00") })).toBe("before-wake");
    expect(state({ now: at("23:00") })).toBe("after-sleep-lock");
    expect(state({ sessionMode: "live" })).toBe("live");
    expect(state()).toBe("open");
  });

  it("reads a sleep conflict only while the session can still move, and never on a recovery day", () => {
    const late = { ...SCHEDULE, preferredTrainingStart: "21:00", preferredTrainingEnd: "23:00" };
    expect(state({ schedule: late, sleepConflict: "conflict" })).toBe("conflict");
    expect(state({ schedule: late, sleepConflict: "conflict", now: at("21:05") })).toBe("open");
    expect(state({ schedule: late, sleepConflict: "conflict", trainingPlanned: false })).toBe("open");
  });

  it("has one statement per state", () => {
    expect(scheduleStatement({ state: "not-set", trainingPlanned: true })).toBe("Set Your Day.");
    expect(scheduleStatement({ state: "before-wake", trainingPlanned: true })).toBe("Day Staged.");
    expect(scheduleStatement({ state: "after-sleep-lock", trainingPlanned: true })).toBe("Day Closed.");
    expect(scheduleStatement({ state: "live", trainingPlanned: true })).toBe("Session Live.");
    expect(scheduleStatement({ state: "conflict", trainingPlanned: true })).toBe("Clear The Sleep Window.");
    expect(scheduleStatement({ state: "open", trainingPlanned: true })).toBe("Session Day Mapped.");
    expect(scheduleStatement({ state: "open", trainingPlanned: false })).toBe("Recovery Day Mapped.");
  });
});
