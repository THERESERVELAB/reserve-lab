/**
 * Cycle integrity — linked compounds whose log entry no longer exists.
 *
 * A cycle lists the ids of the EnhancementEntry records that belong to it.
 * If an entry went missing (a sync overwrite on another device, before the
 * merge fix), the cycle still points at it. Cycle views should show that
 * honestly ("entry missing — restore or remove") instead of silently
 * dropping it. This helper finds those links; it never changes anything.
 *
 * Pure. Takes plain member state so any view (or test) can call it.
 */

import { compoundName } from "@/lib/history/change-events";
import { isPlainObject } from "@/lib/sync/member-merge";
import type { RecoverableRecord } from "@/lib/sync/device-recovery";

export type MissingCycleCompound = {
  cycleId: string;
  cycleName: string;
  compoundId: string;
  /** The entry's name if a safety copy on this device still has it; else null. */
  recoverableName: string | null;
  /** True when this device can bring the entry back (Settings → Recover from this device). */
  recoverable: boolean;
};

export function missingCycleCompounds(
  state: { cyclePeriods?: unknown; trainingSession?: unknown },
  recoverable: RecoverableRecord[] = [],
): MissingCycleCompound[] {
  const cycles = Array.isArray(state.cyclePeriods) ? state.cyclePeriods.filter(isPlainObject) : [];
  const training = isPlainObject(state.trainingSession) ? state.trainingSession : {};
  const log = Array.isArray(training.enhancementLog) ? training.enhancementLog.filter(isPlainObject) : [];
  const present = new Set(log.map((entry) => entry.id).filter((id): id is string => typeof id === "string"));
  const fromBackups = new Map(
    recoverable
      .filter((record) => record.group === "compounds")
      .map((record) => [record.id, record]),
  );

  const out: MissingCycleCompound[] = [];
  for (const cycle of cycles) {
    const ids = Array.isArray(cycle.compoundIds) ? cycle.compoundIds : [];
    for (const compoundId of ids) {
      if (typeof compoundId !== "string" || present.has(compoundId)) continue;
      const backup = fromBackups.get(compoundId);
      out.push({
        cycleId: typeof cycle.id === "string" ? cycle.id : "",
        cycleName: typeof cycle.name === "string" && cycle.name.trim() ? cycle.name.trim() : "Cycle",
        compoundId,
        recoverableName: backup ? compoundName(backup.value as Parameters<typeof compoundName>[0]) : null,
        recoverable: Boolean(backup),
      });
    }
  }
  return out;
}
