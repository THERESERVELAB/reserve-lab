import { describe, expect, it } from "vitest";

import { buildRecoverySnapshot, buildRecoverySuite } from "../engine";
import { RECOVERY_RESET_DONE_LABEL, RECOVERY_RESET_MIN, RECOVERY_WATER_OZ, resolveRecoveryPrimaryAction, type RecoveryPrimaryAction } from "../primary-action";
import { DEFAULT_RECOVERY_COMMAND, type RecoveryCommandState } from "../types";

const NOW = new Date(2026, 8, 15, 16, 12, 0, 0);

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const engineAction = (id: string) => ({
  hasLogs: true,
  nextAction: { id, label: `Engine ${id}`, reason: `Because ${id}.`, tone: "primary" as const },
});

/** Every amount an action records must be printed in its label. */
function expectHonestLabel(action: RecoveryPrimaryAction) {
  if (action.kind === "log-hydration") expect(action.label).toContain(`${action.oz} oz`);
  if (action.kind === "log-mobility") {
    expect(action.label).toContain(`${action.minutes}-Min`);
    /* A finished session is logged only by a label that says it is done. */
    expect(action.label).toMatch(/(done)/);
  }
}

describe("resolveRecoveryPrimaryAction", () => {
  it("leads with the first log when there is no evidence", () => {
    const state: RecoveryCommandState = { ...DEFAULT_RECOVERY_COMMAND, sleepLogs: [], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] };
    const snapshot = buildRecoverySnapshot(state, NOW);
    const plan = resolveRecoveryPrimaryAction({ snapshot, suite: [], sleepLoggedToday: false });

    expect(plan.title).toBe("Start With Last Night's Sleep");
    expect(plan.primary).toEqual({ kind: "open-sleep-log", label: "Log Last Night's Sleep" });
    expect(plan.secondary).toEqual({ kind: "log-hydration", label: `Log ${RECOVERY_WATER_OZ} oz Water`, oz: RECOVERY_WATER_OZ });
  });

  it("turns a sleep debt into logging sleep protection, using the engine's own words", () => {
    const state: RecoveryCommandState = {
      ...DEFAULT_RECOVERY_COMMAND,
      sleepLogs: [6, 6.2, 5.8, 6.1, 6, 6.4, 5.9].map((hours, i) => ({ date: isoDaysAgo(7 - i), hours })),
      hydrationLogs: [],
      mobilityLogs: [],
      stressCheckIns: [],
    };
    const snapshot = buildRecoverySnapshot(state, NOW);
    const suite = buildRecoverySuite(snapshot, state, NOW);
    const plan = resolveRecoveryPrimaryAction({ snapshot, suite, sleepLoggedToday: false });

    expect(snapshot.nextAction.id).toBe("protect-sleep");
    expect(plan.title).toBe(snapshot.nextAction.label);
    expect(plan.reason).toBe(snapshot.nextAction.reason);
    expect(plan.primary).toEqual({ kind: "complete-suite-tool", label: "Log Sleep Protection", toolId: "sleep-protection" });
    expect(plan.secondary).toBeNull();
  });

  it("moves on to the next useful log once the engine's move is already done today", () => {
    const suite = [{ id: "sleep-protection", completed: true }];
    const snapshot = engineAction("protect-sleep");

    expect(resolveRecoveryPrimaryAction({ snapshot, suite, sleepLoggedToday: false }).primary.kind).toBe("open-sleep-log");
    const logged = resolveRecoveryPrimaryAction({ snapshot, suite, sleepLoggedToday: true });
    expect(logged.title).toBe("Keep Today's Log Current");
    expect(logged.primary.kind).toBe("log-hydration");
  });

  it("logs water for a hydration gap, and a mobility reset for a mobility gap", () => {
    const water = resolveRecoveryPrimaryAction({ snapshot: engineAction("finish-hydration"), suite: [], sleepLoggedToday: true });
    expect(water.primary).toMatchObject({ kind: "log-hydration", oz: RECOVERY_WATER_OZ });

    const reset = resolveRecoveryPrimaryAction({ snapshot: engineAction("mobility-reset"), suite: [], sleepLoggedToday: true });
    expect(reset.primary).toEqual({
      kind: "log-mobility",
      /* Was "Log 8-Min Mobility Reset": it logged a finished session without saying so. */
      label: RECOVERY_RESET_DONE_LABEL,
      minutes: RECOVERY_RESET_MIN,
      toolId: "mobility-reset",
    });
  });

  it("never records a check-in score, and prints every amount it records", () => {
    const ids = ["hold", "first-checkin", "finish-hydration", "mobility-reset", "downshift", "protect-sleep", "unknown"];
    const kinds = new Set(["open-sleep-log", "log-hydration", "log-mobility", "complete-suite-tool"]);
    for (const id of ids) {
      for (const sleepLoggedToday of [false, true]) {
        for (const suite of [[], [{ id: "walking", completed: true }, { id: "mobility-reset", completed: true }]]) {
          const plan = resolveRecoveryPrimaryAction({ snapshot: engineAction(id), suite, sleepLoggedToday });
          for (const action of [plan.primary, plan.secondary].filter((a): a is RecoveryPrimaryAction => a !== null)) {
            expect(kinds.has(action.kind), `${id}: ${action.kind}`).toBe(true);
            expectHonestLabel(action);
          }
        }
      }
    }
  });
});
