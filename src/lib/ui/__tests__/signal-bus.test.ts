import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hydrateMemberState,
  resetMemberStateToDefaults,
  serializeMemberState,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import {
  emitSignal,
  markLatestSignalAnnounced,
  msSinceLastSignal,
  resetSignalBusForTests,
  subscribeSignals,
  type Signal,
} from "@/lib/ui/signal-bus";

/**
 * Signal received fires once for each real log a member makes, and never for
 * state that arrives any other way (hydration, a cloud restore, setState).
 */

let received: Signal[] = [];
let unsubscribe: () => void = () => undefined;

beforeEach(() => {
  resetMemberStateToDefaults();
  resetSignalBusForTests();
  received = [];
  unsubscribe = subscribeSignals((signal) => received.push(signal));
});

afterEach(() => unsubscribe());

const today = "2026-09-15";

describe("signal bus", () => {
  it("fires once per water log, naming only what was logged", () => {
    useAthleteDashboardStore.getState().logHydration({ date: today, oz: 16 });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ kind: "water", label: "Water logged", room: "recovery", announced: false });

    useAthleteDashboardStore.getState().logHydration({ date: today, oz: 16 });
    expect(received.map((s) => s.kind)).toEqual(["water", "water"]);
    expect(received[1].id).toBeGreaterThan(received[0].id);
  });

  it("covers sleep, mobility, check-in, meals, bloodwork, measurements and photos", () => {
    const store = useAthleteDashboardStore.getState();
    store.logSleep({ date: today, hours: 7.5 });
    store.logMobility({ date: today, kind: "flow", minutes: 10, focus: "hips" } as never);
    store.logStressCheckIn({ date: today, stress: 2 } as never);
    store.confirmMealLog({ mealId: "breakfast" } as never);
    store.addBloodworkLog({ date: today } as never);
    store.addPhysiqueEntry({ date: today } as never);
    store.addPhotoCheckIn({ date: today } as never);
    expect(received.map((s) => s.kind)).toEqual(["sleep", "mobility", "check-in", "meal", "bloodwork", "measurement", "photo"]);
  });

  it("a meal toggle signals when marked logged, not when cleared", () => {
    const store = useAthleteDashboardStore.getState();
    store.toggleLoggedMeal("lunch");
    store.toggleLoggedMeal("lunch");
    expect(received.map((s) => s.kind)).toEqual(["meal"]);
  });

  it("closing a training session signals once", () => {
    useAthleteDashboardStore.getState().closeOutTrainingSession("quick-closeout");
    expect(received.map((s) => s.kind)).toEqual(["training"]);
  });

  it("never fires on hydration, a cloud restore or a direct state write", () => {
    const store = useAthleteDashboardStore.getState();
    const logged = {
      ...serializeMemberState(),
      recoveryCommand: {
        ...store.recoveryCommand,
        hydrationLogs: [{ date: today, oz: 64 }],
        sleepLogs: [{ date: today, hours: 8 }],
      },
    };
    hydrateMemberState(logged);
    useAthleteDashboardStore.setState({ recoveryCommand: { ...store.recoveryCommand, hydrationLogs: [{ date: today, oz: 96 }] } });
    resetMemberStateToDefaults();

    expect(useAthleteDashboardStore.getState().recoveryCommand.hydrationLogs).toEqual([]);
    expect(received).toEqual([]);
    expect(msSinceLastSignal()).toBe(Number.POSITIVE_INFINITY);
  });

  it("a surface that announces the log itself can mark it announced", () => {
    emitSignal("water");
    markLatestSignalAnnounced();
    expect(received[0].announced).toBe(true);
  });

  it("a throwing listener never breaks the log that raised it", () => {
    const off = subscribeSignals(() => {
      throw new Error("listener failure");
    });
    expect(() => useAthleteDashboardStore.getState().logHydration({ date: today, oz: 8 })).not.toThrow();
    expect(useAthleteDashboardStore.getState().recoveryCommand.hydrationLogs).toHaveLength(1);
    off();
  });
});
