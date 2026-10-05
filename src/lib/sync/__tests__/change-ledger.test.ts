import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hydrateMemberState, resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";
import { installChangeLedger } from "@/lib/sync/change-ledger";
import { readLedger } from "@/lib/sync/sync-ledger";

/* The ledger watches the real store: every remove path tombstones, every add
   or edit clocks the record, and hydration / resets never count as edits. */

const uninstall = installChangeLedger({
  getState: useAthleteDashboardStore.getState,
  setState: (partial) => useAthleteDashboardStore.setState(partial as never),
  subscribe: (listener) => useAthleteDashboardStore.subscribe(listener),
});
afterAll(() => uninstall());

const ledger = () => readLedger(useAthleteDashboardStore.getState().syncLedger);
const store = () => useAthleteDashboardStore.getState();

beforeEach(() => resetMemberStateToDefaults());

describe("change ledger on the live store", () => {
  it("a reset clears the ledger and records nothing", () => {
    expect(ledger()).toEqual({ v: 1, slices: {}, entities: {}, deletions: {} });
  });

  it("adding a compound clocks the record and its slice", () => {
    store().addEnhancementEntry({ name: "Testosterone Enanthate", category: "hormone", isActive: true } as never);
    const id = store().trainingSession.enhancementLog![0].id;
    expect(ledger().entities[`trainingSession.enhancementLog|${id}`]).toBeDefined();
    expect(ledger().slices.trainingSession).toBeDefined();
    expect(ledger().slices.changeHistory).toBeDefined();
  });

  it("removing a compound tombstones it and the taken marks that cascade with it", () => {
    store().addEnhancementEntry({ name: "Collagen Peptides", category: "supplement", isActive: true } as never);
    const id = store().trainingSession.enhancementLog![0].id;
    store().logEnhancementAdherence({ entryId: id, date: "2026-09-17", plannedTime: "08:00", takenStatus: "taken" } as never);
    store().removeEnhancementEntry(id);
    const deletions = ledger().deletions;
    expect(deletions[`trainingSession.enhancementLog|${id}`]).toBeDefined();
    expect(deletions[`trainingSession.enhancementAdherence|${id}|2026-09-17|08:00`]).toBeDefined();
  });

  it("hydration does not stamp or tombstone anything", () => {
    store().addEnhancementEntry({ name: "Creatine", category: "supplement", isActive: true } as never);
    const before = ledger();
    hydrateMemberState({ trainingSession: { enhancementLog: [] } });
    expect(ledger()).toEqual(before);
  });
});
