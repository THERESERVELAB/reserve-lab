/**
 * Recover from this device — find records that live only in this device's
 * safety copies (local-backup.ts) and let the member bring back the ones
 * they choose.
 *
 * Nothing is restored automatically. A restore merges the chosen records in
 * by their own id, never replaces anything the member has now, records a
 * "restored" event in the timeline for compounds, support plan items and
 * cycles, and syncs to the member's other devices like any other edit.
 */

import { serializeMemberState, useAthleteDashboardStore } from "@/lib/athlete-store";
import { appendChangeEvents, compoundName, makeChangeEvent, supportItemName, type ChangeEvent, type ChangeSubjectKind } from "@/lib/history/change-events";
import type { SupportPlanItem } from "@/lib/cycle-review/types";
import { requestSyncFlush } from "@/lib/sync/flush-signal";
import { listBackups, parseBackupSlices, type BackupRecord } from "@/lib/sync/local-backup";
import { allTombstones, collectEntities, getPath, isPlainObject, LEDGER_SLICE_KEY, setPath } from "@/lib/sync/member-merge";
import { SYNC_COLLECTIONS, keyOfItem, sliceOf, type CollectionSpec } from "@/lib/sync/sync-collections";
import { entityKey, readLedger } from "@/lib/sync/sync-ledger";

export type RecoveryGroup =
  | "compounds"
  | "cycles"
  | "support-plan"
  | "bloodwork"
  | "physique"
  | "photos"
  | "meals"
  | "plans"
  | "notes";

type GroupDef = {
  group: RecoveryGroup;
  label: string;
  path: string;
  name: (value: Record<string, unknown>) => string;
  facts: (value: Record<string, unknown>) => string[];
  timeline?: ChangeSubjectKind;
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

export function formatDay(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const addedFact = (value: Record<string, unknown>): string[] => {
  const added = formatDay(value.createdAt ?? value.addedAt);
  return added ? [`Added ${added}`] : [];
};

/** The groups a member would look for, in the order they read them. */
export const RECOVERY_GROUPS: GroupDef[] = [
  {
    group: "compounds",
    label: "Compounds",
    path: "trainingSession.enhancementLog",
    name: (v) => compoundName(v as Parameters<typeof compoundName>[0]),
    facts: (v) => [...addedFact(v), ...(text(v.startDate) ? [`Start date ${formatDay(v.startDate)}`] : [])],
    timeline: "compound",
  },
  {
    group: "cycles",
    label: "Cycles",
    path: "cyclePeriods",
    name: (v) => text(v.name) || "Cycle",
    facts: (v) => [
      ...(text(v.startDate) ? [`Start date ${formatDay(v.startDate)}`] : []),
      ...(typeof v.plannedWeeks === "number" ? [`${v.plannedWeeks} planned weeks`] : []),
    ],
    timeline: "cycle",
  },
  {
    group: "support-plan",
    label: "Support plan",
    path: "supportPlan",
    name: (v) => supportItemName(v as unknown as SupportPlanItem),
    facts: addedFact,
    timeline: "support-plan",
  },
  {
    group: "bloodwork",
    label: "Bloodwork",
    path: "bloodworkLogs",
    name: (v) => text(v.labName) || "Lab report",
    facts: (v) => (text(v.testDate) ? [`Test date ${formatDay(v.testDate)}`] : []),
  },
  {
    group: "physique",
    label: "Physique entries",
    path: "physiqueCommand.entries",
    name: (v) => (text(v.date) ? `Entry for ${formatDay(v.date)}` : "Physique entry"),
    facts: () => [],
  },
  {
    group: "photos",
    label: "Photo check-ins",
    path: "physiqueCommand.photoCheckIns",
    name: (v) => (text(v.date) ? `Check-in for ${formatDay(v.date)}` : "Photo check-in"),
    facts: () => [],
  },
  { group: "meals", label: "Custom meals", path: "customMeals", name: (v) => text(v.name) || "Custom meal", facts: addedFact },
  { group: "meals", label: "Meal plans", path: "memberMealPlans", name: (v) => text(v.name) || "Meal plan", facts: addedFact },
  { group: "plans", label: "Custom plans", path: "customPlans", name: (v) => text(v.name) || "Custom plan", facts: addedFact },
  { group: "notes", label: "Timeline notes", path: "timelineNotes", name: (v) => text(v.text).slice(0, 60) || "Note", facts: (v) => (text(v.date) ? [formatDay(v.date)] : []) },
];

/** Records that belong to a compound and come back with it. */
const COMPOUND_CHILDREN: Array<{ path: string; belongs: (value: Record<string, unknown>, compoundId: string) => boolean }> = [
  { path: "trainingSession.enhancementAdherence", belongs: (v, id) => v.entryId === id },
  { path: "trainingSession.injectionLogs", belongs: (v, id) => v.entryId === id },
  { path: "trainingSession.compoundSupportLinks", belongs: (v, id) => v.parentEntryId === id || v.supportEntryId === id },
];

export type RecoverableChild = { key: string; path: string; value: Record<string, unknown> };

export type RecoverableRecord = {
  /** "path|id" — unique across groups. */
  key: string;
  path: string;
  id: string;
  group: RecoveryGroup;
  groupLabel: string;
  name: string;
  facts: string[];
  /** When the member deliberately removed it, if they did. */
  removedAt: string | null;
  /** Something with the same name is in the member's records now. */
  sameNameNow: boolean;
  /** When the safety copy holding this version was taken. */
  copiedAt: string;
  value: Record<string, unknown>;
  /** Taken marks, site logs and links of a compound, missing now, restored with it. */
  children: RecoverableChild[];
};

function specFor(path: string): CollectionSpec | undefined {
  return SYNC_COLLECTIONS.find((spec) => spec.path === path);
}

function listAt(slices: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const value = getPath(slices, path);
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

/**
 * Every record found in this device's safety copies that the member does not
 * have now. Newest copy of each record wins. Grouped in RECOVERY_GROUPS order.
 */
export function findRecoverableRecords(
  backups: BackupRecord[],
  currentSlices: Record<string, unknown>,
): RecoverableRecord[] {
  const current = collectEntities(currentSlices);
  const tombstones = allTombstones(readLedger(currentSlices[LEDGER_SLICE_KEY]), currentSlices.changeHistory);
  const found = new Map<string, RecoverableRecord>();
  const newestFirst = [...backups].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  for (const backup of newestFirst) {
    const slices = parseBackupSlices(backup.raw);
    if (!slices) continue;
    for (const def of RECOVERY_GROUPS) {
      const spec = specFor(def.path);
      if (!spec) continue;
      const currentNames = new Set(listAt(currentSlices, def.path).map((v) => def.name(v).toLowerCase()));
      for (const value of listAt(slices, def.path)) {
        const id = keyOfItem(spec, value);
        if (!id) continue;
        const key = entityKey(def.path, id);
        if (current.has(key) || found.has(key)) continue;
        const name = def.name(value);
        const children: RecoverableChild[] = [];
        if (def.group === "compounds") {
          for (const child of COMPOUND_CHILDREN) {
            const childSpec = specFor(child.path);
            if (!childSpec) continue;
            for (const item of listAt(slices, child.path)) {
              const childId = keyOfItem(childSpec, item);
              if (!childId || !child.belongs(item, id)) continue;
              const childKey = entityKey(child.path, childId);
              if (!current.has(childKey)) children.push({ key: childKey, path: child.path, value: item });
            }
          }
        }
        found.set(key, {
          key,
          path: def.path,
          id,
          group: def.group,
          groupLabel: def.label,
          name,
          facts: def.facts(value),
          removedAt: tombstones[key] ?? null,
          sameNameNow: currentNames.has(name.toLowerCase()),
          copiedAt: backup.takenAt,
          value,
          children,
        });
      }
    }
  }

  const order = new Map(RECOVERY_GROUPS.map((def, i) => [def.group, i]));
  return [...found.values()].sort((a, b) => {
    const g = (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0);
    if (g !== 0) return g;
    return a.name.localeCompare(b.name);
  });
}

/** Scan this device. Safe to call anywhere in the browser; returns [] elsewhere. */
export function scanThisDevice(): RecoverableRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return findRecoverableRecords(listBackups(), serializeMemberState());
  } catch {
    return [];
  }
}

/**
 * Pure: the member-state patch that restores the chosen records. Records the
 * member has now (same id) are skipped — nothing current is ever replaced.
 */
export function buildRestorePatch(
  state: Record<string, unknown>,
  records: RecoverableRecord[],
  now: Date = new Date(),
): { patch: Record<string, unknown>; restored: RecoverableRecord[] } {
  const at = now.toISOString();
  const patch: Record<string, unknown> = {};
  const touched = new Set<string>();
  const view = () => ({ ...state, ...patch });
  const ledger = readLedger(state[LEDGER_SLICE_KEY]);
  const nextLedger = { v: 1 as const, slices: { ...ledger.slices }, entities: { ...ledger.entities }, deletions: { ...ledger.deletions } };
  const restored: RecoverableRecord[] = [];
  const events: ChangeEvent[] = [];

  const insert = (path: string, value: Record<string, unknown>): boolean => {
    const spec = specFor(path);
    if (!spec) return false;
    const id = keyOfItem(spec, value);
    if (!id) return false;
    const slice = sliceOf(path);
    if (!touched.has(slice)) {
      const original = state[slice];
      patch[slice] = isPlainObject(original) ? { ...original } : original;
      touched.add(slice);
    }
    const existing = getPath(view(), path);
    const list = Array.isArray(existing) ? existing : [];
    if (list.some((item) => isPlainObject(item) && keyOfItem(spec, item) === id)) return false;
    // A restore is a change made now: it must outrank any older removal on
    // every device. `updatedAt` carries that through store normalization.
    const stamped = { ...value, restoredAt: at, ...(typeof value.updatedAt === "string" ? { updatedAt: at } : {}) };
    const nextList = [stamped, ...list];
    if (path === slice) patch[slice] = nextList;
    else if (!setPath(patch, path, nextList)) return false;
    const key = entityKey(path, id);
    nextLedger.entities[key] = at;
    delete nextLedger.deletions[key];
    return true;
  };

  for (const record of records) {
    if (!insert(record.path, record.value)) continue;
    for (const child of record.children) insert(child.path, child.value);
    restored.push(record);
    const def = RECOVERY_GROUPS.find((g) => g.group === record.group);
    if (def?.timeline) {
      events.push(makeChangeEvent({ at: now, subject: { kind: def.timeline, id: record.id, name: record.name }, action: "restored" }));
    }
  }

  if (events.length) {
    patch.changeHistory = appendChangeEvents(state.changeHistory as ChangeEvent[] | undefined, events);
  }
  if (restored.length) patch[LEDGER_SLICE_KEY] = nextLedger;
  return { patch, restored };
}

/** Restore the chosen records into the live store and sync them. Returns how many came back. */
export function restoreRecords(records: RecoverableRecord[], now: Date = new Date()): number {
  const state = useAthleteDashboardStore.getState() as unknown as Record<string, unknown>;
  const { patch, restored } = buildRestorePatch(state, records, now);
  if (restored.length === 0) return 0;
  useAthleteDashboardStore.setState(patch as never);
  requestSyncFlush("device-restore");
  return restored.length;
}

