import { beforeEach, describe, expect, it } from "vitest";

import { hydrateMemberState, resetMemberStateToDefaults, serializeMemberState, useAthleteDashboardStore } from "@/lib/athlete-store";
import { changeEventTitle } from "@/lib/history/summaries";
import { missingCycleCompounds } from "@/lib/sync/cycle-integrity";
import { buildRestorePatch, findRecoverableRecords, restoreRecords } from "@/lib/sync/device-recovery";
import {
  ATHLETE_STORE_STORAGE_KEY,
  BACKUP_PREFIX,
  MAX_BACKUPS,
  backupHoldsMissingRecords,
  listBackups,
  parseBackupSlices,
  pruneBackups,
  type BackupRecord,
} from "@/lib/sync/local-backup";
import { mergeMemberSlices } from "@/lib/sync/member-merge";
import { readLedger } from "@/lib/sync/sync-ledger";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  keys() {
    return [...this.map.keys()];
  }
}

const TEST_E = {
  id: "enh-1789510439098-vnduu",
  name: "Testosterone Enanthate",
  category: "hormone",
  isActive: true,
  startDate: "2026-09-15",
  createdAt: "2026-09-15T22:13:00.000Z",
  updatedAt: "2026-09-15T22:13:00.000Z",
};
const RETA = { id: "enh-reta", name: "Retatrutide", category: "peptide", isActive: true, createdAt: "2026-09-10T12:00:00.000Z", updatedAt: "2026-09-10T12:00:00.000Z" };
const MARK = { id: "adh-1", entryId: TEST_E.id, date: "2026-09-16", plannedTime: "08:00", takenStatus: "taken", createdAt: "2026-09-16T08:02:00.000Z" };
const CYCLE = {
  id: "cycle-1",
  name: "Fall cycle",
  startDate: "2026-09-15",
  plannedWeeks: 16,
  compoundIds: [TEST_E.id, "enh-1789514525470-33xxb"],
  clinicianOversight: false,
  checkpoints: [],
  createdAt: "2026-09-15T23:30:00.000Z",
  updatedAt: "2026-09-15T23:30:00.000Z",
};

/** The shape backupLocalState writes: the persisted store JSON as a string. */
function localBackup(takenAt: string, slices: Record<string, unknown>): BackupRecord {
  const raw = JSON.stringify({ athleteStore: JSON.stringify({ state: slices, version: 19 }), logs: {} });
  return { key: `${BACKUP_PREFIX}pre-hydrate:${takenAt}`, tag: "pre-hydrate", takenAt, raw };
}

const now = { trainingSession: { enhancementLog: [RETA] }, cyclePeriods: [CYCLE], changeHistory: [] };
const backup = localBackup("2026-09-18T19:41:04.581Z", {
  trainingSession: { enhancementLog: [TEST_E, RETA], enhancementAdherence: [MARK] },
  cyclePeriods: [CYCLE],
});

describe("finding records this device can bring back", () => {
  it("lists a compound in a safety copy that is missing now, with its taken marks", () => {
    const found = findRecoverableRecords([backup], now);
    expect(found).toHaveLength(1);
    const [record] = found;
    expect(record).toMatchObject({ group: "compounds", groupLabel: "Compounds", name: "Testosterone Enanthate", id: TEST_E.id, removedAt: null, sameNameNow: false, copiedAt: "2026-09-18T19:41:04.581Z" });
    expect(record.facts).toEqual(["Added Sep 15, 2026", "Start date Sep 15, 2026"]);
    expect(record.children.map((c) => c.path)).toEqual(["trainingSession.enhancementAdherence"]);
  });

  it("reads cloud-envelope backups too, and the newest copy of a record wins", () => {
    const older = localBackup("2026-09-17T00:00:00.000Z", { trainingSession: { enhancementLog: [{ ...TEST_E, startDate: "2026-09-01" }] } });
    const cloud: BackupRecord = {
      key: `${BACKUP_PREFIX}cloud-pre-merge:2026-09-18T20:00:00.000Z`,
      tag: "cloud-pre-merge",
      takenAt: "2026-09-18T20:00:00.000Z",
      raw: JSON.stringify({ envelope: 2, slices: { trainingSession: { enhancementLog: [TEST_E] } } }),
    };
    const found = findRecoverableRecords([older, cloud], now);
    expect(found).toHaveLength(1);
    expect(found[0].copiedAt).toBe("2026-09-18T20:00:00.000Z");
  });

  it("says so when the member removed it themselves, and when the same name is in the log now", () => {
    const current = {
      ...now,
      trainingSession: { enhancementLog: [RETA, { ...TEST_E, id: "enh-new" }] },
      changeHistory: [{ id: "c1", at: "2026-09-17T09:00:00.000Z", date: "2026-09-17", subject: { kind: "compound", id: TEST_E.id, name: TEST_E.name }, action: "removed", changes: [] }],
    };
    const [record] = findRecoverableRecords([backup], current);
    expect(record.removedAt).toBe("2026-09-17T09:00:00.000Z");
    expect(record.sameNameNow).toBe(true);
  });

  it("finds nothing when every record is already here", () => {
    expect(findRecoverableRecords([backup], { trainingSession: { enhancementLog: [TEST_E, RETA] }, cyclePeriods: [CYCLE] })).toEqual([]);
  });
});

describe("restoring", () => {
  it("merges the chosen record in by id, with its children, a timeline event and a ledger clock", () => {
    const [record] = findRecoverableRecords([backup], now);
    const { patch, restored } = buildRestorePatch(now, [record], new Date("2026-09-18T21:00:00.000Z"));
    expect(restored).toHaveLength(1);
    const ts = patch.trainingSession as { enhancementLog: Array<{ id: string; restoredAt?: string }>; enhancementAdherence: Array<{ id: string }> };
    expect(ts.enhancementLog.map((e) => e.id)).toEqual([TEST_E.id, RETA.id]);
    expect(ts.enhancementLog[0].restoredAt).toBe("2026-09-18T21:00:00.000Z");
    expect(ts.enhancementAdherence.map((m) => m.id)).toEqual(["adh-1"]);
    const events = patch.changeHistory as Array<{ action: string; subject: { id: string } }>;
    expect(events[0]).toMatchObject({ action: "restored", subject: { id: TEST_E.id } });
    expect(changeEventTitle(events[0] as never)).toBe("Restored Testosterone Enanthate from a device copy");
    expect(readLedger(patch.syncLedger).entities[`trainingSession.enhancementLog|${TEST_E.id}`]).toBe("2026-09-18T21:00:00.000Z");
  });

  it("never replaces a record the member has now", () => {
    const [record] = findRecoverableRecords([backup], now);
    const current = { ...now, trainingSession: { enhancementLog: [{ ...TEST_E, name: "Edited" }, RETA] } };
    const { restored } = buildRestorePatch(current, [record]);
    expect(restored).toEqual([]);
  });

  it("a restored record survives the next merge against a device that recorded its removal", () => {
    const removedEvent = { id: "c1", at: "2026-09-17T09:00:00.000Z", date: "2026-09-17", subject: { kind: "compound", id: TEST_E.id, name: TEST_E.name }, action: "removed", changes: [] };
    const current = { ...now, changeHistory: [removedEvent] };
    const [record] = findRecoverableRecords([backup], current);
    const { patch } = buildRestorePatch(current, [record], new Date("2026-09-18T21:00:00.000Z"));
    const restoredState = { ...current, ...patch };
    const otherDevice = { ...current, syncLedger: { v: 1, slices: {}, entities: {}, deletions: { [`trainingSession.enhancementLog|${TEST_E.id}`]: "2026-09-17T09:00:00.000Z" } } };
    const { slices } = mergeMemberSlices({ local: { slices: otherDevice, changedAt: null }, cloud: { slices: restoredState, changedAt: null }, envelopePref: "local" });
    const ids = (slices.trainingSession as { enhancementLog: Array<{ id: string }> }).enhancementLog.map((e) => e.id);
    expect(ids).toContain(TEST_E.id);
    // The superseded removal is dropped, so it can't outlive the record's clock later.
    expect(readLedger(slices.syncLedger).deletions[`trainingSession.enhancementLog|${TEST_E.id}`]).toBeUndefined();
  });

  describe("into the live store", () => {
    beforeEach(() => resetMemberStateToDefaults());

    it("adds the compound back and records it in the timeline", () => {
      hydrateMemberState({ trainingSession: { enhancementLog: [RETA] } });
      const [record] = findRecoverableRecords([backup], serializeMemberState());
      expect(restoreRecords([record])).toBe(1);
      const state = useAthleteDashboardStore.getState();
      expect(state.trainingSession.enhancementLog?.map((e) => e.id)).toEqual([TEST_E.id, RETA.id]);
      expect(state.changeHistory[0]).toMatchObject({ action: "restored", subject: { kind: "compound", id: TEST_E.id } });
      // The restore time survives a reload / cloud round trip, so it keeps outranking the old removal.
      hydrateMemberState(serializeMemberState());
      const restored = useAthleteDashboardStore.getState().trainingSession.enhancementLog?.[0];
      expect(Date.parse(restored?.updatedAt ?? "")).toBeGreaterThan(Date.parse(TEST_E.updatedAt));
      // Restoring twice does nothing more.
      expect(restoreRecords([record])).toBe(0);
    });
  });
});

describe("the cycle integrity helper", () => {
  it("reports each linked compound whose entry is missing, and whether this device can restore it", () => {
    const recoverable = findRecoverableRecords([backup], now);
    expect(missingCycleCompounds(now, recoverable)).toEqual([
      { cycleId: "cycle-1", cycleName: "Fall cycle", compoundId: TEST_E.id, recoverableName: "Testosterone Enanthate", recoverable: true },
      { cycleId: "cycle-1", cycleName: "Fall cycle", compoundId: "enh-1789514525470-33xxb", recoverableName: null, recoverable: false },
    ]);
  });

  it("is empty when every link resolves", () => {
    expect(missingCycleCompounds({ cyclePeriods: [{ ...CYCLE, compoundIds: [RETA.id] }], trainingSession: { enhancementLog: [RETA] } })).toEqual([]);
  });
});

describe("safety copies that can't be pruned away when they matter", () => {
  const storage = new MemoryStorage();
  const put = (key: string, slices: Record<string, unknown>) =>
    storage.setItem(key, JSON.stringify({ athleteStore: JSON.stringify({ state: slices, version: 19 }), logs: {} }));

  beforeEach(() => {
    storage.clear();
    storage.setItem(ATHLETE_STORE_STORAGE_KEY, JSON.stringify({ state: now, version: 19 }));
  });

  it(`keeps at most ${MAX_BACKUPS} ordinary copies, oldest pruned first`, () => {
    for (let i = 0; i < MAX_BACKUPS + 4; i += 1) put(`${BACKUP_PREFIX}pre-hydrate:2026-09-18T10:${String(i).padStart(2, "0")}:00.000Z`, now);
    pruneBackups(storage as unknown as Storage);
    const left = listBackups(storage as unknown as Storage);
    expect(left).toHaveLength(MAX_BACKUPS);
    expect(left[0].takenAt).toBe("2026-09-18T10:04:00.000Z");
  });

  it("never prunes the oldest copy while it holds a record the member no longer has", () => {
    put(`${BACKUP_PREFIX}pre-hydrate:2026-09-01T00:00:00.000Z`, { trainingSession: { enhancementLog: [TEST_E, RETA] } });
    for (let i = 0; i < MAX_BACKUPS + 4; i += 1) put(`${BACKUP_PREFIX}pre-hydrate:2026-09-18T10:${String(i).padStart(2, "0")}:00.000Z`, now);
    pruneBackups(storage as unknown as Storage);
    const left = listBackups(storage as unknown as Storage);
    expect(left.some((b) => b.takenAt === "2026-09-01T00:00:00.000Z")).toBe(true);
    expect(left).toHaveLength(MAX_BACKUPS);
  });

  it("a copy whose only extra record the member deliberately removed is not protected", () => {
    const current = { ...now, syncLedger: { v: 1, slices: {}, entities: {}, deletions: { [`trainingSession.enhancementLog|${TEST_E.id}`]: "2026-09-17T00:00:00.000Z" } } };
    const onlyCompound = { trainingSession: { enhancementLog: [TEST_E, RETA] }, cyclePeriods: [CYCLE] };
    expect(backupHoldsMissingRecords(onlyCompound, current)).toBe(false);
    expect(backupHoldsMissingRecords(onlyCompound, now)).toBe(true);
    // The taken mark in the full copy was never removed on purpose, so that copy stays protected.
    expect(backupHoldsMissingRecords(parseBackupSlices(backup.raw)!, current)).toBe(true);
  });
});
