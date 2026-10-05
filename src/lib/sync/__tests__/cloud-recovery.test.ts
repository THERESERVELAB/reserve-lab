import { describe, expect, it } from "vitest";

import { historyRowsToBackups } from "@/lib/sync/cloud-recovery";
import { findRecoverableRecords } from "@/lib/sync/device-recovery";
import { parseBackupSlices } from "@/lib/sync/local-backup";

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

/** The envelope the guard trigger keeps in member_state_history.state. */
const envelope = (slices: Record<string, unknown>) => ({ envelope: 2, slices });

const now = { trainingSession: { enhancementLog: [RETA] }, changeHistory: [] };

describe("recovering from cloud history", () => {
  it("maps history rows to the backup shape device-recovery reads", () => {
    const rows = [
      { id: 42, state: envelope({ trainingSession: { enhancementLog: [TEST_E] } }), replaced_at: "2026-09-22T10:00:00.000Z" },
      { id: 7, state: envelope({ trainingSession: { enhancementLog: [RETA] } }), replaced_at: "2026-09-18T10:00:00.000Z" },
    ];
    const backups = historyRowsToBackups(rows);
    expect(backups.map((b) => b.key)).toEqual(["cloud-history:42", "cloud-history:7"]);
    expect(backups[0].takenAt).toBe("2026-09-22T10:00:00.000Z");
    // The raw is the stored envelope, which parseBackupSlices unwraps to slices.
    expect(parseBackupSlices(backups[0].raw)).toEqual({ trainingSession: { enhancementLog: [TEST_E] } });
  });

  it("surfaces a compound that lives only in an older cloud version, with its taken marks", () => {
    const rows = [
      { id: 9, state: envelope({ trainingSession: { enhancementLog: [TEST_E, RETA], enhancementAdherence: [MARK] } }), replaced_at: "2026-09-22T10:00:00.000Z" },
    ];
    const found = findRecoverableRecords(historyRowsToBackups(rows), now);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ group: "compounds", name: "Testosterone Enanthate", id: TEST_E.id, copiedAt: "2026-09-22T10:00:00.000Z" });
    expect(found[0].children.map((c) => c.path)).toEqual(["trainingSession.enhancementAdherence"]);
  });

  it("the newest version of a record wins across history rows", () => {
    const rows = [
      { id: 9, state: envelope({ trainingSession: { enhancementLog: [TEST_E] } }), replaced_at: "2026-09-22T10:00:00.000Z" },
      { id: 3, state: envelope({ trainingSession: { enhancementLog: [{ ...TEST_E, startDate: "2026-09-01" }] } }), replaced_at: "2026-09-10T10:00:00.000Z" },
    ];
    const found = findRecoverableRecords(historyRowsToBackups(rows), now);
    expect(found).toHaveLength(1);
    expect(found[0].copiedAt).toBe("2026-09-22T10:00:00.000Z");
    expect(found[0].facts).toContain("Start date Sep 15, 2026");
  });

  it("finds nothing when every record in history is already in the account", () => {
    const rows = [{ id: 9, state: envelope({ trainingSession: { enhancementLog: [RETA] } }), replaced_at: "2026-09-22T10:00:00.000Z" }];
    expect(findRecoverableRecords(historyRowsToBackups(rows), now)).toEqual([]);
  });

  it("tolerates rows with no usable state without throwing", () => {
    const rows = [
      { id: 1, state: null, replaced_at: "2026-09-22T10:00:00.000Z" },
      { id: 2, state: "not-an-object", replaced_at: "x" },
    ];
    expect(findRecoverableRecords(historyRowsToBackups(rows), now)).toEqual([]);
  });
});
