/* ════════════════════════════════════════════════════════════════════════
   RECOVERY PRIMARY ACTION — the one gold action on the Recovery screen.

   The recovery engine names the biggest bottleneck (`snapshot.nextAction`).
   This decides what the gold button actually does about it, and holds a rule
   the engine's labels did not: the button records only what the member did.
   It never logs a check-in score the member did not choose, every amount it
   records is printed in its label ("Log 16 oz Water"), and a session it logs
   as finished says so ("Log 8-Min Reset (done)") — it never logs one on "start".

   With no logs there is no bottleneck to name: the dial says "Evidence
   needed" and this leads with the first log.
   ════════════════════════════════════════════════════════════════════════ */

import type { RecoverySnapshot } from "./engine";
import type { RecoverySuiteTool } from "./types";

export const RECOVERY_WATER_OZ = 16;
export const RECOVERY_RESET_MIN = 8;
/** The reset is logged as finished, so the label says it was done. */
export const RECOVERY_RESET_DONE_LABEL = `Log ${RECOVERY_RESET_MIN}-Min Reset (done)`;

export type RecoveryPrimaryAction =
  /** Brings the Sleep Log on this screen into view and focuses it. */
  | { kind: "open-sleep-log"; label: string }
  | { kind: "log-hydration"; label: string; oz: number }
  | { kind: "log-mobility"; label: string; minutes: number; toolId: string }
  /** Marks a Recovery Suite tool done for today. Never un-marks one. */
  | { kind: "complete-suite-tool"; label: string; toolId: string };

export type RecoveryPrimaryPlan = {
  title: string;
  reason: string;
  primary: RecoveryPrimaryAction;
  /** A second, quieter log. Only offered when there is no evidence yet. */
  secondary: RecoveryPrimaryAction | null;
};

export function resolveRecoveryPrimaryAction(input: {
  snapshot: Pick<RecoverySnapshot, "hasLogs" | "nextAction">;
  suite: ReadonlyArray<Pick<RecoverySuiteTool, "id" | "completed">>;
  sleepLoggedToday: boolean;
}): RecoveryPrimaryPlan {
  const { snapshot, suite, sleepLoggedToday } = input;

  const openSleepLog: RecoveryPrimaryAction = { kind: "open-sleep-log", label: "Log Last Night's Sleep" };
  const logWater: RecoveryPrimaryAction = {
    kind: "log-hydration",
    label: `Log ${RECOVERY_WATER_OZ} oz Water`,
    oz: RECOVERY_WATER_OZ,
  };
  const done = (toolId: string) => suite.some((tool) => tool.id === toolId && tool.completed);
  const fromEngine = { title: snapshot.nextAction.label, reason: snapshot.nextAction.reason };
  /* Once the engine's move is already logged today, the next record worth making. */
  const keepCurrent = (reason: string): RecoveryPrimaryPlan => ({
    title: "Keep Today's Log Current",
    reason,
    primary: sleepLoggedToday ? logWater : openSleepLog,
    secondary: null,
  });

  if (!snapshot.hasLogs) {
    return {
      /* The dial beside this already says "Evidence needed"; one fact, one home. */
      title: "Start With Last Night's Sleep",
      reason: "Recovery Reserve reads only what you log. Water and mobility logs build it from there.",
      primary: openSleepLog,
      secondary: logWater,
    };
  }

  switch (snapshot.nextAction.id) {
    case "finish-hydration":
      return { ...fromEngine, primary: logWater, secondary: null };
    case "mobility-reset":
      return done("mobility-reset")
        ? keepCurrent("Today's mobility reset is logged.")
        : {
            ...fromEngine,
            primary: {
              kind: "log-mobility",
              label: RECOVERY_RESET_DONE_LABEL,
              minutes: RECOVERY_RESET_MIN,
              toolId: "mobility-reset",
            },
            secondary: null,
          };
    case "downshift":
      return done("walking")
        ? keepCurrent("Today's walk is logged.")
        : { ...fromEngine, primary: { kind: "complete-suite-tool", label: "Log Walk", toolId: "walking" }, secondary: null };
    case "protect-sleep":
      return done("sleep-protection")
        ? keepCurrent("Sleep protection is logged for today.")
        : {
            ...fromEngine,
            primary: { kind: "complete-suite-tool", label: "Log Sleep Protection", toolId: "sleep-protection" },
            secondary: null,
          };
    default:
      return keepCurrent(snapshot.nextAction.reason);
  }
}
