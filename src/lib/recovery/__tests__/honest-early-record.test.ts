import { describe, expect, it } from "vitest";

import { buildRecoverySnapshot, hydrationPace, RESERVE_CALIBRATION_DAYS } from "../engine";
import { DEFAULT_RECOVERY_COMMAND, localDateKey, type RecoveryCommandState } from "../types";

/** Thursday 17 September 2026, 2:00 PM. */
const NOW = new Date(2026, 8, 17, 14, 0, 0, 0);

function dayKey(offset: number): string {
  return localDateKey(new Date(2026, 8, 17 - offset));
}

const EMPTY: RecoveryCommandState = {
  ...DEFAULT_RECOVERY_COMMAND,
  sleepTargetHours: 8,
  hydrationTargetOz: 100,
  mobilityWeeklyTarget: 4,
  sleepLogs: [],
  hydrationLogs: [],
  mobilityLogs: [],
  stressCheckIns: [],
  suiteCompletedToday: [],
  suiteDate: null,
};

describe("an early record is read fairly, never red by default", () => {
  it("sums water per day — three glasses are one day, not three missed days", () => {
    const snap = buildRecoverySnapshot(
      {
        ...EMPTY,
        sleepLogs: [{ date: dayKey(1), hours: 8 }],
        hydrationLogs: [
          { date: dayKey(1), oz: 40 },
          { date: dayKey(1), oz: 40 },
          { date: dayKey(1), oz: 20 },
        ],
      },
      NOW,
    );
    expect(snap.hydrationAdherence).toBe(100);
    expect(snap.debt.hydrationMissed).toBe(0);
    expect(snap.hurting.map((h) => h.id)).not.toContain("x-hyd");
  });

  it("reads today's water against how much of the day has gone", () => {
    const pace = hydrationPace(NOW); // 2 PM: half the drinking day
    expect(pace).toBeCloseTo(0.5, 2);
    const snap = buildRecoverySnapshot({ ...EMPTY, sleepLogs: [{ date: dayKey(0), hours: 8 }], hydrationLogs: [{ date: dayKey(0), oz: 50 }] }, NOW);
    expect(snap.hydrationStatus).toBe("on-target");
    expect(snap.hydrationAdherence).toBe(100);
    expect(snap.debt.hydrationMissed).toBe(0);
  });

  it("does not judge day one of logging as a whole week of mobility missed", () => {
    const snap = buildRecoverySnapshot(
      { ...EMPTY, sleepLogs: [{ date: dayKey(0), hours: 8 }], mobilityLogs: [{ date: dayKey(0), kind: "standalone", minutes: 10 }] },
      NOW,
    );
    expect(snap.debt.mobilityMissed).toBe(0);
    expect(snap.reserve).toBe(100);
  });

  it("three logs on one day make an early read: the number stands, the verdict colour waits", () => {
    const snap = buildRecoverySnapshot(
      {
        ...EMPTY,
        sleepLogs: [{ date: dayKey(0), hours: 5 }],
        hydrationLogs: [{ date: dayKey(0), oz: 10 }],
        stressCheckIns: [{ date: dayKey(0), stress: 4, energy: 2, mood: 3 }],
      },
      NOW,
    );
    expect(snap.hasData).toBe(true);
    expect(snap.daysLogged).toBe(1);
    expect(snap.calibrating).toBe(true);
    expect(snap.reserveLabel).toBe("Early Read");
    expect(snap.reserveLabel).not.toBe("Recovery Limited");
    expect(snap.reserveColor).not.toBe("#ef7d55");
    expect(snap.debt.trainingFatigue).toBe("unknown");
  });

  it("gives the real verdict once the record covers enough days", () => {
    const days = Array.from({ length: RESERVE_CALIBRATION_DAYS }, (_, i) => dayKey(i + 1));
    const snap = buildRecoverySnapshot(
      {
        ...EMPTY,
        sleepLogs: days.map((date) => ({ date, hours: 8 })),
        hydrationLogs: days.map((date) => ({ date, oz: 100 })),
      },
      NOW,
    );
    expect(snap.calibrating).toBe(false);
    expect(snap.reserveLabel).toBe("Optimal");
  });
});
