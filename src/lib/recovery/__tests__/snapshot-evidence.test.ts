import { describe, expect, it } from "vitest";

import { buildRecoverySnapshot, buildRecoverySuite, RESERVE_MIN_INPUTS } from "../engine";
import { DEFAULT_RECOVERY_COMMAND, type RecoveryCommandState } from "../types";

/** Tuesday 15 September 2026, 4:12 PM. */
const NOW = new Date(2026, 8, 15, 16, 12, 0, 0);

function dayKey(offset: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

const EMPTY: RecoveryCommandState = {
  ...DEFAULT_RECOVERY_COMMAND,
  sleepLogs: [],
  hydrationLogs: [],
  mobilityLogs: [],
  stressCheckIns: [],
  suiteCompletedToday: [],
  suiteDate: null,
};

describe("buildRecoverySnapshot — missing inputs are left out, never scored as zero", () => {
  it("reads no reserve and asks for a first log when nothing is logged", () => {
    const snap = buildRecoverySnapshot(EMPTY, NOW);
    expect(snap.evidence).toBe("none");
    expect(snap.hasLogs).toBe(false);
    expect(snap.hasData).toBe(false);
    expect(snap.reserveLabel).toBe("Data Limited");
    expect(snap.nextAction.id).toBe("first-checkin");
  });

  it("does not turn a single stress answer into a 'Recovery Limited' reserve", () => {
    /* The audit case: one high-stress check-in used to read "16 · Recovery Limited",
       because missing sleep, water and mobility each counted as 0%. */
    const snap = buildRecoverySnapshot({ ...EMPTY, stressCheckIns: [{ date: dayKey(0), stress: 5, energy: 2, mood: 2 }] }, NOW);
    expect(snap.evidence).toBe("limited");
    expect(snap.hasLogs).toBe(true);
    expect(snap.hasData).toBe(false);
    expect(snap.reserveClass).toBe("data-limited");
    expect(snap.reserveLabel).not.toBe("Recovery Limited");
    expect(snap.inputsLogged).toEqual(["check-in"]);
    /* The logged answer still earns a behavioral move of its own — just no reserve number. */
    expect(snap.nextAction.id).toBe("downshift");
  });

  it("asks for one more kind of log when a single input names no move", () => {
    const snap = buildRecoverySnapshot({ ...EMPTY, stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }] }, NOW);
    expect(snap.hasData).toBe(false);
    expect(snap.nextAction.label).toBe("Add One More Kind of Log");
    expect(snap.nextAction.reason).toContain(`${RESERVE_MIN_INPUTS}`);
  });

  it("carries no debt or fatigue verdict for inputs that were never logged", () => {
    const snap = buildRecoverySnapshot({ ...EMPTY, stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }] }, NOW);
    expect(snap.debt.sleepDebtHours).toBeNull();
    expect(snap.debt.mobilityMissed).toBeNull();
    expect(snap.debt.trainingFatigue).toBe("unknown");
    expect(snap.hurting.map((h) => h.id)).not.toContain("x-mob");
    expect(snap.stressIncreasing).not.toContain("Missed mobility");
    expect(snap.stressIncreasing).not.toContain("Training load elevated");
  });

  it("reads a reserve from two kinds of log, weighted only over what was logged", () => {
    /* Sleep exactly on target (100%) and water exactly on target today (100%):
       with the other inputs excluded, the reserve is 100 — not diluted by zeros. */
    const snap = buildRecoverySnapshot(
      {
        ...EMPTY,
        sleepLogs: [{ date: dayKey(1), hours: EMPTY.sleepTargetHours }],
        hydrationLogs: [{ date: dayKey(0), oz: EMPTY.hydrationTargetOz }],
      },
      NOW,
    );
    expect(snap.evidence).toBe("sufficient");
    expect(snap.hasData).toBe(true);
    expect(snap.reserve).toBe(100);
    expect(snap.inputsMissing).toEqual(["mobility", "check-in"]);
  });

  it("does not stand a neutral 60 in for a missing stress check-in", () => {
    const sleepOnly = { sleepLogs: [{ date: dayKey(1), hours: 4 }], hydrationLogs: [{ date: dayKey(0), oz: 30 }] };
    const snap = buildRecoverySnapshot({ ...EMPTY, ...sleepOnly }, NOW);
    /* 50% sleep (0.34), and today’s 30 oz read against the pace at 4:12 PM
       (30 / (120 × 0.66) ≈ 38%, 0.22), re-weighted: (17 + 8.4) / 0.56 ≈ 45. */
    expect(snap.reserve).toBe(45);
  });

  it("keeps a low reserve out of the suite's reasoning until a reserve can be read", () => {
    const limited = buildRecoverySnapshot({ ...EMPTY, stressCheckIns: [{ date: dayKey(0), stress: 5, energy: 2, mood: 2 }] }, NOW);
    const evening = new Date(2026, 8, 15, 20, 0, 0, 0);
    const breathwork = buildRecoverySuite(limited, EMPTY, evening).find((tool) => tool.id === "breathwork");
    expect(breathwork?.recommendation).toBe("optional");
  });
});
