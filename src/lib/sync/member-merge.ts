/**
 * Per-entity merge of two copies of the member state.
 *
 * Replaces whole-state last-write-wins. Two devices that each hold part of
 * the member's record both keep their part:
 *
 *  - Every registered collection (SYNC_COLLECTIONS) is merged by id. When
 *    both sides hold an entity, the one changed more recently wins (ledger
 *    clock, else updatedAt, else createdAt…). When only one side holds it,
 *    it is KEPT — unless a tombstone (deliberate removal) is at least as new
 *    as the entity's last change.
 *  - Everything else (scalars, settings, derived state) is decided per
 *    top-level slice: the side whose slice changed more recently wins; with
 *    no clock on either side, the envelope-level preference decides.
 *  - The ledgers themselves are unioned (newest time per key).
 *
 * Pure: no store, no storage, no network. Inputs are never mutated.
 */

import type { LocalLogSnapshot } from "@/lib/logging/store";
import { computeNutritionTotals, type NutritionDayLog } from "@/lib/logging/schemas";
import { SYNC_COLLECTIONS, collectionsForSlice, keyOfItem, type CollectionSpec } from "@/lib/sync/sync-collections";
import {
  EMPTY_SYNC_LEDGER,
  entityKey,
  isEmptyLedger,
  mergeLedgers,
  pruneLedger,
  readLedger,
  toMillis,
  type SyncLedger,
} from "@/lib/sync/sync-ledger";

export const LEDGER_SLICE_KEY = "syncLedger";

export type Side = "local" | "cloud";

export type MergeSideInput = {
  slices: Record<string, unknown>;
  /** Envelope-level "last changed" for this side (local change mark / cloud updated_at). */
  changedAt: string | null;
};

export type MergeReport = {
  /** Entity keys ("path|id") only this device had, kept. */
  keptFromLocal: string[];
  /** Entity keys only the cloud had, kept. */
  keptFromCloud: string[];
  /** Entity keys dropped because a tombstone is newer than their last change. */
  removedByTombstone: string[];
  /** Tombstones older than the record's latest change — dropped from the merged ledger. */
  supersededTombstones: string[];
  /** Top-level slices whose non-collection content came from each side. */
  sliceWinners: Record<string, Side>;
};

export type MergeResult = { slices: Record<string, unknown>; report: MergeReport };

/* ─── Small structural helpers ─────────────────────────────────────────── */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getPath(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const segment of path.split(".")) {
    if (!isPlainObject(node)) return undefined;
    node = node[segment];
  }
  return node;
}

/** Copy-on-write set. Returns false (and changes nothing) when a parent is not an object. */
export function setPath(root: Record<string, unknown>, path: string, value: unknown): boolean {
  const segments = path.split(".");
  let node: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const child = node[segments[i]];
    if (!isPlainObject(child)) return false;
    const copy = { ...child };
    node[segments[i]] = copy;
    node = copy;
  }
  node[segments[segments.length - 1]] = value;
  return true;
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Fields that say when an entity last changed, most specific first. */
const CHANGE_FIELDS = [
  /* A record restored from a device backup counts as changed at that moment. */
  "restoredAt",
  "updatedAt",
  "editedAt",
  "modifiedAt",
  "createdAt",
  "addedAt",
  "loggedAt",
  "recordedAt",
  "savedAt",
  "completedAt",
  "submittedAt",
  "startedAt",
  "at",
  "timestamp",
] as const;

/** When this copy of an entity last changed: max(ledger clock, its own change fields). */
export function entityStamp(value: unknown, ledgerClock: string | undefined): number {
  let best = toMillis(ledgerClock);
  if (isPlainObject(value)) {
    for (const field of CHANGE_FIELDS) {
      const ms = toMillis(value[field]);
      if (Number.isFinite(ms) && (!Number.isFinite(best) || ms > best)) best = ms;
      // updatedAt is authoritative when present — older fields can't be newer.
      if (field === "updatedAt" && Number.isFinite(ms)) break;
    }
  }
  return best;
}

type IdList = { ids: string[]; byId: Map<string, unknown> } | null;

/** An array qualifies as an entity list when every element is an object with a unique key. */
function indexList(value: unknown, spec: CollectionSpec): IdList {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  const byId = new Map<string, unknown>();
  for (const item of value) {
    // A single malformed element or a duplicate id must NOT discard the whole
    // list — that fell back to replacing one side wholesale, dropping the other
    // side's records. Skip the bad element (first copy of a duplicate id wins)
    // and keep merging per entity so nothing is lost.
    if (!isPlainObject(item)) continue;
    const id = keyOfItem(spec, item);
    if (id === null || byId.has(id)) continue;
    ids.push(id);
    byId.set(id, item);
  }
  return { ids, byId };
}

function indexMap(value: unknown): IdList {
  if (!isPlainObject(value)) return null;
  const ids = Object.keys(value);
  return { ids, byId: new Map(ids.map((id) => [id, value[id]])) };
}

/** Sort direction the list already follows by stamp, if any. */
function listOrder(items: unknown[], stampOf: (item: unknown) => number): "asc" | "desc" | null {
  const stamps = items.map(stampOf);
  if (stamps.length < 2 || stamps.some((s) => !Number.isFinite(s))) return null;
  let asc = true;
  let desc = true;
  for (let i = 1; i < stamps.length; i += 1) {
    if (stamps[i] < stamps[i - 1]) asc = false;
    if (stamps[i] > stamps[i - 1]) desc = false;
  }
  if (asc && desc) return null;
  return desc ? "desc" : asc ? "asc" : null;
}

/* ─── Tombstones ───────────────────────────────────────────────────────── */

const CHANGE_KIND_TO_PATH: Record<string, string> = {
  compound: "trainingSession.enhancementLog",
  "support-plan": "supportPlan",
  cycle: "cyclePeriods",
};

/**
 * Existing data predates the ledger. A "removed" change-history event is the
 * member's own removal on record, so it counts as a tombstone — unless a later
 * "added" or "restored" event for the same record brought it back.
 */
export function tombstonesFromChangeHistory(history: unknown): Record<string, string> {
  const removed: Record<string, string> = {};
  const returned: Record<string, number> = {};
  if (!Array.isArray(history)) return removed;
  for (const event of history) {
    if (!isPlainObject(event) || typeof event.at !== "string") continue;
    const subject = event.subject;
    if (!isPlainObject(subject) || typeof subject.id !== "string" || typeof subject.kind !== "string") continue;
    const path = CHANGE_KIND_TO_PATH[subject.kind];
    if (!path) continue;
    const key = entityKey(path, subject.id);
    const at = toMillis(event.at);
    if (event.action === "removed") {
      if (!removed[key] || at > toMillis(removed[key])) removed[key] = event.at;
    } else if (event.action === "added" || event.action === "restored") {
      if (!(returned[key] >= at)) returned[key] = at;
    }
  }
  for (const key of Object.keys(removed)) {
    if (returned[key] !== undefined && returned[key] >= toMillis(removed[key])) delete removed[key];
  }
  return removed;
}

/**
 * Change-history events that re-add an entity after its removal ("added",
 * "restored") are newer than the removal, so the entity's own stamp already
 * outranks the tombstone. Nothing further to do here.
 */
export function allTombstones(
  ledger: SyncLedger,
  ...histories: unknown[]
): Record<string, string> {
  const out: Record<string, string> = { ...ledger.deletions };
  for (const history of histories) {
    for (const [key, at] of Object.entries(tombstonesFromChangeHistory(history))) {
      if (!out[key] || toMillis(at) > toMillis(out[key])) out[key] = at;
    }
  }
  return out;
}

/* ─── Collection merge ─────────────────────────────────────────────────── */

type CollectionMergeContext = {
  spec: CollectionSpec;
  pref: Side;
  localLedger: SyncLedger;
  cloudLedger: SyncLedger;
  tombstones: Record<string, string>;
  report: MergeReport;
};

function mergeCollection(localValue: unknown, cloudValue: unknown, ctx: CollectionMergeContext): unknown {
  const { spec, pref, localLedger, cloudLedger, tombstones, report } = ctx;
  const index = spec.kind === "map" ? indexMap : (v: unknown) => indexList(v, spec);
  const localIdx = localValue === undefined || localValue === null ? { ids: [], byId: new Map() } : index(localValue);
  const cloudIdx = cloudValue === undefined || cloudValue === null ? { ids: [], byId: new Map() } : index(cloudValue);
  // Not an entity collection on one side (malformed / duplicate ids) → fall back to the slice winner.
  if (!localIdx || !cloudIdx) return pref === "local" ? localValue : cloudValue;

  const stampLocal = (id: string, value: unknown) => entityStamp(value, localLedger.entities[entityKey(spec.path, id)]);
  const stampCloud = (id: string, value: unknown) => entityStamp(value, cloudLedger.entities[entityKey(spec.path, id)]);

  const first = pref === "local" ? localIdx : cloudIdx;
  const second = pref === "local" ? cloudIdx : localIdx;
  const order = [...first.ids, ...second.ids.filter((id) => !first.byId.has(id))];

  const kept: Array<[string, unknown]> = [];
  for (const id of order) {
    const key = entityKey(spec.path, id);
    const inLocal = localIdx.byId.has(id);
    const inCloud = cloudIdx.byId.has(id);
    const l = localIdx.byId.get(id);
    const c = cloudIdx.byId.get(id);
    const sl = inLocal ? stampLocal(id, l) : Number.NaN;
    const sc = inCloud ? stampCloud(id, c) : Number.NaN;

    let value: unknown;
    let stamp: number;
    if (inLocal && inCloud) {
      if (stableEqual(l, c)) {
        value = pref === "local" ? l : c;
      } else if (Number.isFinite(sl) && Number.isFinite(sc) && sl !== sc) {
        value = sl > sc ? l : c;
      } else if (Number.isFinite(sl) !== Number.isFinite(sc)) {
        value = Number.isFinite(sl) ? l : c;
      } else {
        value = pref === "local" ? l : c;
      }
      stamp = Math.max(Number.isFinite(sl) ? sl : -Infinity, Number.isFinite(sc) ? sc : -Infinity);
    } else {
      value = inLocal ? l : c;
      stamp = inLocal ? sl : sc;
    }

    const tomb = toMillis(tombstones[key]);
    if (Number.isFinite(tomb) && (!Number.isFinite(stamp) || tomb >= stamp)) {
      report.removedByTombstone.push(key);
      continue;
    }
    // The record changed after it was removed (restored or re-added): that
    // removal is superseded and must not outlive the record's own clock.
    if (Number.isFinite(tomb)) report.supersededTombstones.push(key);
    if (inLocal && !inCloud) report.keptFromLocal.push(key);
    if (inCloud && !inLocal) report.keptFromCloud.push(key);
    kept.push([id, value]);
  }

  if (spec.kind === "map") return Object.fromEntries(kept);

  // Keep the order the winning side already follows (newest first / oldest first).
  const prefItems = (pref === "local" ? localValue : cloudValue) as unknown[] | undefined;
  const stampAny = (item: unknown) => {
    const id = isPlainObject(item) ? (keyOfItem(spec, item) ?? "") : "";
    return entityStamp(item, (localLedger.entities[entityKey(spec.path, id)] ?? cloudLedger.entities[entityKey(spec.path, id)]));
  };
  const direction = Array.isArray(prefItems) && prefItems.length >= 2 ? listOrder(prefItems, stampAny) : null;
  const values = kept.map(([, value]) => value);
  if (direction) {
    const withIndex = values.map((value, i) => ({ value, i, s: stampAny(value) }));
    withIndex.sort((a, b) => {
      const sa = Number.isFinite(a.s) ? a.s : -Infinity;
      const sb = Number.isFinite(b.s) ? b.s : -Infinity;
      if (sa === sb) return a.i - b.i;
      return direction === "desc" ? sb - sa : sa - sb;
    });
    return withIndex.map((entry) => entry.value);
  }
  return values;
}

/* ─── Slice-level preference ───────────────────────────────────────────── */

function slicePreference(
  key: string,
  local: { ledger: SyncLedger; changedAt: string | null },
  cloud: { ledger: SyncLedger; changedAt: string | null },
  envelopePref: Side,
): Side {
  const compare = (l: number, c: number): Side => {
    if (Number.isFinite(l) && Number.isFinite(c) && l !== c) return l > c ? "local" : "cloud";
    if (Number.isFinite(l) && !Number.isFinite(c)) return "local";
    if (Number.isFinite(c) && !Number.isFinite(l)) return "cloud";
    return envelopePref;
  };
  const legacy = (ledger: SyncLedger) => Object.keys(ledger.slices).length === 0;
  const lClock = local.ledger.slices[key];
  const cClock = cloud.ledger.slices[key];
  if (lClock !== undefined && cClock !== undefined) return compare(toMillis(lClock), toMillis(cClock));
  // One side changed this slice since it started keeping clocks. Against a side
  // that keeps clocks but never changed the slice, it wins; against a legacy
  // side (no clocks at all), compare with that side's envelope time.
  if (lClock !== undefined) return legacy(cloud.ledger) ? compare(toMillis(lClock), toMillis(cloud.changedAt)) : "local";
  if (cClock !== undefined) return legacy(local.ledger) ? compare(toMillis(local.changedAt), toMillis(cClock)) : "cloud";
  // No clock either side: the envelope-level decision (which already allows for clock skew).
  return envelopePref;
}

/* ─── Public: merge two member states ──────────────────────────────────── */

export function mergeMemberSlices(input: {
  local: MergeSideInput;
  cloud: MergeSideInput;
  /** Tie-breaker when neither side has a clock for a slice or an entity. */
  envelopePref: Side;
  now?: Date;
  collections?: CollectionSpec[];
}): MergeResult {
  const { local, cloud, envelopePref } = input;
  const now = input.now ?? new Date();
  const collections = input.collections ?? SYNC_COLLECTIONS;
  const localLedger = readLedger(local.slices[LEDGER_SLICE_KEY]);
  const cloudLedger = readLedger(cloud.slices[LEDGER_SLICE_KEY]);
  const ledger = mergeLedgers(localLedger, cloudLedger, now);
  const tombstones = allTombstones(ledger, local.slices.changeHistory, cloud.slices.changeHistory);

  const report: MergeReport = { keptFromLocal: [], keptFromCloud: [], removedByTombstone: [], supersededTombstones: [], sliceWinners: {} };
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(cloud.slices), ...Object.keys(local.slices)]);
  keys.delete(LEDGER_SLICE_KEY);

  for (const key of keys) {
    const inLocal = key in local.slices;
    const inCloud = key in cloud.slices;
    const pref: Side = !inCloud
      ? "local"
      : !inLocal
        ? "cloud"
        : slicePreference(key, { ledger: localLedger, changedAt: local.changedAt }, { ledger: cloudLedger, changedAt: cloud.changedAt }, envelopePref);
    report.sliceWinners[key] = pref;
    const winner = pref === "local" ? local.slices[key] : cloud.slices[key];
    out[key] = isPlainObject(winner) ? { ...winner } : winner;

    for (const spec of collectionsForSlice(key, collections)) {
      const lv = getPath(local.slices, spec.path);
      const cv = getPath(cloud.slices, spec.path);
      if (lv === undefined && cv === undefined) continue;
      const merged = mergeCollection(lv, cv, { spec, pref, localLedger, cloudLedger, tombstones, report });
      if (spec.path === key) out[key] = merged;
      else setPath(out, spec.path, merged);
    }
  }

  if (report.supersededTombstones.length) {
    const deletions = { ...ledger.deletions };
    for (const key of report.supersededTombstones) delete deletions[key];
    ledger.deletions = deletions;
  }
  const ledgerChanged = !isEmptyLedger(ledger) || LEDGER_SLICE_KEY in local.slices || LEDGER_SLICE_KEY in cloud.slices;
  if (ledgerChanged) out[LEDGER_SLICE_KEY] = pruneLedger(ledger, now);
  return { slices: out, report };
}

/* ─── Standalone offline logs (date-keyed maps) ────────────────────────── */

function logStamp(value: unknown): number {
  return entityStamp(value, undefined);
}

function mergeNutritionDay(winner: NutritionDayLog, other: NutritionDayLog): NutritionDayLog {
  const meals = [...(winner.meals ?? [])];
  const seen = new Set(meals.map((m) => m.id).filter(Boolean));
  let added = false;
  for (const meal of other.meals ?? []) {
    if (meal.id && !seen.has(meal.id)) {
      meals.push(meal);
      seen.add(meal.id);
      added = true;
    }
  }
  return added ? { ...winner, meals, ...computeNutritionTotals(meals) } : winner;
}

function mergeDateMap<T>(
  local: Record<string, T> | undefined,
  cloud: Record<string, T> | undefined,
  pref: Side,
  combine?: (winner: T, other: T) => T,
): Record<string, T> {
  const l = local ?? {};
  const c = cloud ?? {};
  const out: Record<string, T> = {};
  for (const date of new Set([...Object.keys(l), ...Object.keys(c)])) {
    const hasL = date in l;
    const hasC = date in c;
    if (!hasL || !hasC) {
      out[date] = hasL ? l[date] : c[date];
      continue;
    }
    if (stableEqual(l[date], c[date])) {
      out[date] = l[date];
      continue;
    }
    const sl = logStamp(l[date]);
    const sc = logStamp(c[date]);
    const localWins = Number.isFinite(sl) && Number.isFinite(sc) && sl !== sc ? sl > sc : pref === "local";
    const winner = localWins ? l[date] : c[date];
    const other = localWins ? c[date] : l[date];
    out[date] = combine ? combine(winner, other) : winner;
  }
  return out;
}

/** Append-only day logs: union by date; a day both sides logged keeps the newer copy (meals are unioned by id). */
export function mergeLocalLogs(
  local: LocalLogSnapshot | null | undefined,
  cloud: LocalLogSnapshot | null | undefined,
  pref: Side,
): LocalLogSnapshot {
  const pending = new Map<string, LocalLogSnapshot["pendingSync"][number]>();
  for (const item of [...(local?.pendingSync ?? []), ...(cloud?.pendingSync ?? [])]) {
    const key = `${item.type}|${item.date}`;
    if (!pending.has(key)) pending.set(key, item);
  }
  return {
    training: mergeDateMap(local?.training, cloud?.training, pref),
    nutrition: mergeDateMap(local?.nutrition, cloud?.nutrition, pref, mergeNutritionDay),
    recovery: mergeDateMap(local?.recovery, cloud?.recovery, pref),
    pendingSync: [...pending.values()],
  };
}

/* ─── Change recording (the store subscription's pure core) ────────────── */

/**
 * Diff one member-state change into the ledger: stamp changed slices, stamp
 * added/edited entities, tombstone removed ones. Returns null when nothing
 * member-visible changed.
 */
export function recordChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keys: readonly string[],
  ledgerIn: SyncLedger,
  now: Date = new Date(),
  collections: CollectionSpec[] = SYNC_COLLECTIONS,
): SyncLedger | null {
  const at = now.toISOString();
  let ledger: SyncLedger | null = null;
  const edit = (): SyncLedger => {
    ledger ??= {
      v: 1,
      slices: { ...ledgerIn.slices },
      entities: { ...ledgerIn.entities },
      deletions: { ...ledgerIn.deletions },
    };
    return ledger;
  };

  for (const key of keys) {
    if (key === LEDGER_SLICE_KEY) continue;
    const before = prev[key];
    const after = next[key];
    if (before === after || stableEqual(before, after)) continue;
    edit().slices[key] = at;

    for (const spec of collectionsForSlice(key, collections)) {
      const b = getPath(prev, spec.path);
      const a = getPath(next, spec.path);
      if (b === a) continue;
      const bi = spec.kind === "map" ? indexMap(b ?? {}) : indexList(b ?? [], spec);
      const ai = spec.kind === "map" ? indexMap(a ?? {}) : indexList(a ?? [], spec);
      if (!bi && !ai) continue;
      const beforeIds = bi?.byId ?? new Map<string, unknown>();
      const afterIds = ai?.byId ?? new Map<string, unknown>();
      for (const [id, value] of afterIds) {
        const k = entityKey(spec.path, id);
        if (!beforeIds.has(id)) {
          edit().entities[k] = at;
          delete edit().deletions[k];
        } else if (beforeIds.get(id) !== value && !stableEqual(beforeIds.get(id), value)) {
          edit().entities[k] = at;
        }
      }
      // A side that stopped being a valid list (null / malformed) is not a removal of its entities.
      if (!ai) continue;
      // A member removes records one at a time through the UI, so one state
      // transition drops at most one entity from a collection. A single
      // transition that drops TWO OR MORE at once is never a member deletion —
      // it is a system artifact (a reset-to-empty, a list rebuilt without its
      // contents, a merge/hydration that slipped past suppression). Tombstoning
      // those would delete the member's records on every device and keep
      // deleting them after each restore. So a bulk disappearance stamps no
      // tombstone: the entities stay live and survive the next merge.
      const removedIds = [...beforeIds.keys()].filter((id) => !afterIds.has(id));
      if (removedIds.length >= 2) continue;
      for (const id of removedIds) {
        const k = entityKey(spec.path, id);
        edit().deletions[k] = at;
        delete edit().entities[k];
      }
    }
  }
  return ledger ? pruneLedger(ledger, now) : null;
}

/* ─── Entity inventory (backups, recovery) ─────────────────────────────── */

/** Every registered entity in a member state, keyed "path|id". */
export function collectEntities(
  slices: Record<string, unknown>,
  collections: CollectionSpec[] = SYNC_COLLECTIONS,
): Map<string, { spec: CollectionSpec; id: string; value: unknown }> {
  const out = new Map<string, { spec: CollectionSpec; id: string; value: unknown }>();
  for (const spec of collections) {
    const value = getPath(slices, spec.path);
    if (spec.kind === "map") {
      if (!isPlainObject(value)) continue;
      for (const [id, entity] of Object.entries(value)) out.set(entityKey(spec.path, id), { spec, id, value: entity });
    } else if (Array.isArray(value)) {
      for (const entity of value) {
        if (!isPlainObject(entity)) continue;
        const id = keyOfItem(spec, entity);
        if (id !== null) out.set(entityKey(spec.path, id), { spec, id, value: entity });
      }
    }
  }
  return out;
}

export { EMPTY_SYNC_LEDGER };
