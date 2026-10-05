/**
 * Member state sync engine.
 *
 * Local-first: the Zustand/localStorage store stays immediately responsive
 * and remains the offline cache. This engine mirrors the cloud-safe member
 * slices (see state-contract.ts) into public.member_state.
 *
 * Two devices never overwrite each other's work:
 *
 *  - MERGE, NOT OVERWRITE. Whenever local and cloud both hold member data,
 *    they are merged per entity (member-merge.ts): records are unioned by id,
 *    the more recently changed copy of a record wins, and a record missing
 *    on one side is kept unless it was deliberately removed (tombstone).
 *  - NEVER PUSH OVER AN ADVANCED CLOUD. A write is a conditional update on
 *    the cloud row's updated_at as of this device's last sync. If another
 *    device wrote in between, nothing is written: the engine pulls the row,
 *    merges, applies the merge locally, and writes the merged result.
 *  - LIVE ACROSS DEVICES. The engine pulls-and-merges when the tab becomes
 *    visible or regains focus, and polls while visible (60s, backing off to
 *    5 min when nothing changes; paused offline, hidden or on Save-Data).
 *
 * Kept from before: debounced writes, immediate flushes on member-critical
 * actions (flush-signal.ts), conservative retries, offline tolerance, a
 * generation token that discards stale work after logout, backups of any
 * side that could lose something, and "Saved" only after the cloud confirms.
 */

import {
  ATHLETE_STORE_PERSIST_VERSION,
  hydrateMemberState,
  resetMemberStateToDefaults,
  serializeMemberState,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import type { Json } from "@/lib/database/types";
import {
  clearLocalLogs,
  hasMeaningfulLocalLogs,
  hydrateLocalLogs,
  LOCAL_LOGS_CHANGED_EVENT,
  serializeLocalLogs,
  type LocalLogSnapshot,
} from "@/lib/logging/store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { onSyncFlushRequest } from "@/lib/sync/flush-signal";
import { backupCloudEnvelope, backupLocalState } from "@/lib/sync/local-backup";
import { collectEntities, mergeLocalLogs, mergeMemberSlices, type Side } from "@/lib/sync/member-merge";
import {
  CLOUD_SCHEMA_VERSION,
  hasMeaningfulProgress,
  type CloudMemberStateEnvelope,
} from "@/lib/sync/state-contract";
import { useSyncStatusStore } from "@/lib/sync/sync-status";

const SYNC_META_KEY = "fba-sync-meta";
const DEBOUNCE_MS = 2_500;
const RETRY_STEPS_MS = [5_000, 15_000, 45_000, 90_000];
/** Clock-skew tolerance when comparing cloud updated_at to local sync marks. */
export const SKEW_MS = 2_000;
/** Live pulls while the tab is visible. */
const POLL_BASE_MS = 60_000;
const POLL_MAX_MS = 300_000;
/** Focus + visibilitychange fire together; one pull covers both. */
const FOCUS_PULL_THROTTLE_MS = 5_000;
/** Conditional writes that lose a race re-merge and retry this many times. */
const MAX_WRITE_ATTEMPTS = 3;

type SyncMeta = {
  userId: string;
  /** Cloud updated_at at the moment of the last confirmed sync (write or merge). */
  lastSyncedAt: string | null;
  /** Timestamp of the newest local member-state change we know about. */
  lastLocalChangeAt: string | null;
};

function readMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncMeta;
    return typeof parsed?.userId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // localStorage quota — non-fatal, merge policy degrades to safe defaults.
  }
}

function buildEnvelope(): CloudMemberStateEnvelope {
  return {
    envelope: CLOUD_SCHEMA_VERSION,
    storeVersion: ATHLETE_STORE_PERSIST_VERSION,
    serializedAt: new Date().toISOString(),
    slices: serializeMemberState(),
    logs: serializeLocalLogs(),
  };
}

/** Stable comparison payload — envelope minus its own timestamp. */
function hashOf(envelope: Pick<CloudMemberStateEnvelope, "slices" | "logs">): string {
  return JSON.stringify({ slices: envelope.slices, logs: envelope.logs });
}

type EngineState = {
  userId: string;
  generation: number;
  unsubscribeStore: () => void;
  unsubscribeFlush: () => void;
  removeWindowListeners: () => void;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  pollDelayMs: number;
  lastPullAt: number;
  retryStep: number;
  lastPushedHash: string | null;
  /** Guard: hydration/merge-induced setState must not schedule an echo push. */
  applyingCloud: boolean;
  /** Every cloud read/write runs one at a time, in order. */
  lock: Promise<unknown>;
};

let engine: EngineState | null = null;
let generationCounter = 0;

const status = () => useSyncStatusStore.getState();

function isLive(e: EngineState, generation: number): boolean {
  return engine === e && e.generation === generation;
}

function exclusive<T>(e: EngineState, task: () => Promise<T>): Promise<T> {
  const run = e.lock.then(task, task);
  e.lock = run.catch(() => undefined);
  return run;
}

function clearTimers(e: EngineState): void {
  if (e.debounceTimer) clearTimeout(e.debounceTimer);
  if (e.retryTimer) clearTimeout(e.retryTimer);
  if (e.pollTimer) clearTimeout(e.pollTimer);
  e.debounceTimer = null;
  e.retryTimer = null;
  e.pollTimer = null;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function prefersSavingData(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as { connection?: { saveData?: boolean } }).connection?.saveData);
}

function touchLocalChange(e: EngineState): void {
  const meta = readMeta();
  writeMeta({
    userId: e.userId,
    lastSyncedAt: meta?.userId === e.userId ? (meta?.lastSyncedAt ?? null) : null,
    lastLocalChangeAt: new Date().toISOString(),
  });
}

function schedulePush(e: EngineState): void {
  if (e.applyingCloud) return;
  touchLocalChange(e);
  // The member is active — keep live pulls at their fastest.
  e.pollDelayMs = POLL_BASE_MS;
  if (status().status !== "offline") status().setStatus("pending");
  if (e.debounceTimer) clearTimeout(e.debounceTimer);
  e.debounceTimer = setTimeout(() => {
    e.debounceTimer = null;
    void flushNow(e);
  }, DEBOUNCE_MS);
}

function scheduleRetry(e: EngineState): void {
  const delay = RETRY_STEPS_MS[Math.min(e.retryStep, RETRY_STEPS_MS.length - 1)];
  e.retryStep += 1;
  if (e.retryTimer) clearTimeout(e.retryTimer);
  e.retryTimer = setTimeout(() => {
    e.retryTimer = null;
    void flushNow(e);
  }, delay);
}

type CloudRow = {
  state: CloudMemberStateEnvelope | Record<string, unknown> | null;
  schema_version: number;
  updated_at: string;
};

function envelopeSlices(row: CloudRow): Record<string, unknown> {
  const state = row.state as CloudMemberStateEnvelope | null;
  if (state && typeof state === "object" && "slices" in state && state.slices) {
    return state.slices as Record<string, unknown>;
  }
  // Tolerate a bare-slices row (schema_version 0 escape hatch).
  return (row.state ?? {}) as Record<string, unknown>;
}

function envelopeLogs(row: CloudRow): LocalLogSnapshot | null {
  const state = row.state as CloudMemberStateEnvelope | null;
  return state && typeof state === "object" && "logs" in state && state.logs
    ? state.logs
    : null;
}

/** Which side wins ties when neither side has a per-slice clock. */
function newerSide(localChangeAt: string | null | undefined, cloudAt: string): Side {
  const l = localChangeAt ? Date.parse(localChangeAt) : Number.NaN;
  const c = Date.parse(cloudAt);
  return Number.isFinite(l) && l >= c ? "local" : "cloud";
}

/**
 * Merge a cloud row into this device and apply the result locally.
 * Returns whether local state changed and whether the merged state already
 * equals the cloud row (in which case nothing needs to be written).
 */
function mergeRowIntoLocal(
  e: EngineState,
  row: CloudRow,
  pref: { slices: Side; logs: Side },
): { changedLocal: boolean; matchesCloud: boolean } {
  const meta = readMeta();
  const localSlices = serializeMemberState();
  const localLogs = serializeLocalLogs();
  const cloudSlices = envelopeSlices(row);
  const cloudLogs = envelopeLogs(row);

  const merged = mergeMemberSlices({
    local: { slices: localSlices, changedAt: meta?.userId === e.userId ? meta.lastLocalChangeAt : null },
    cloud: { slices: cloudSlices, changedAt: row.updated_at },
    envelopePref: pref.slices,
  });
  const mergedLogs = mergeLocalLogs(localLogs, cloudLogs, pref.logs);

  const beforeHash = hashOf({ slices: localSlices, logs: localLogs });
  const mergedHash = hashOf({ slices: merged.slices, logs: mergedLogs });
  let changedLocal = false;
  if (mergedHash !== beforeHash) {
    // Anything this device held that the merge drops (a tombstoned record)
    // is snapshotted first, so a removal can always be undone from Settings.
    const mergedKeys = collectEntities(merged.slices);
    const losesLocal = [...collectEntities(localSlices).keys()].some((key) => !mergedKeys.has(key));
    if (losesLocal) backupLocalState("pre-merge");

    e.applyingCloud = true;
    try {
      hydrateMemberState(merged.slices);
      if (JSON.stringify(mergedLogs) !== JSON.stringify(localLogs)) hydrateLocalLogs(mergedLogs);
    } finally {
      e.applyingCloud = false;
    }
    changedLocal = true;
  }

  const after = buildEnvelope();
  const afterHash = hashOf(after);
  // The merge added nothing the cloud lacks. Hydration may still normalize a
  // few derived fields locally; that alone is never worth a write (and two app
  // versions normalizing differently must not ping-pong writes).
  const emptyLogs: LocalLogSnapshot = { training: {}, nutrition: {}, recovery: {}, pendingSync: [] };
  const mergeAddsNothing =
    JSON.stringify(merged.slices) === JSON.stringify(cloudSlices) &&
    JSON.stringify(mergedLogs) === JSON.stringify(mergeLocalLogs(cloudLogs ?? emptyLogs, emptyLogs, "local"));
  const matchesCloud = mergeAddsNothing || afterHash === hashOf({ slices: cloudSlices, logs: cloudLogs ?? undefined });
  if (matchesCloud) e.lastPushedHash = afterHash;
  return { changedLocal, matchesCloud };
}

type ReconcileMode = "push" | "pull";

function reportWriteFailure(e: EngineState, message: string): void {
  if (isOffline()) {
    status().setStatus("offline");
  } else {
    status().setStatus("error", message);
    scheduleRetry(e);
  }
}

/**
 * One sync pass. "push" writes local changes (merging first if the cloud
 * moved); "pull" checks whether the cloud moved and merges it in (writing
 * back only if this device holds something the cloud lacks).
 * Returns true when local or cloud state changed.
 */
async function reconcile(e: EngineState, initialMode: ReconcileMode): Promise<boolean> {
  if (engine !== e) return false;
  if (isOffline()) {
    if (initialMode === "push") status().setStatus("offline");
    return false;
  }
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    status().setStatus("local-only");
    return false;
  }

  const generation = e.generation;
  let mode = initialMode;
  let changed = false;

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS + 1; attempt += 1) {
    if (!isLive(e, generation)) return changed;
    const meta = readMeta();
    const known = meta?.userId === e.userId ? meta.lastSyncedAt : null;

    /* 1 — Fast path: write only if the cloud is exactly where we left it. */
    if (mode === "push" && known) {
      const envelope = buildEnvelope();
      const hash = hashOf(envelope);
      if (hash === e.lastPushedHash) {
        if (status().status === "pending" || status().status === "saving") status().markSaved(new Date().toISOString());
        return changed;
      }
      status().setStatus("saving");
      const { data, error } = await supabase
        .from("member_state")
        .update({ state: envelope as unknown as Json, schema_version: CLOUD_SCHEMA_VERSION })
        .eq("user_id", e.userId)
        .eq("updated_at", known)
        .select("updated_at")
        .maybeSingle();
      if (!isLive(e, generation)) return changed;
      if (error) {
        reportWriteFailure(e, error.message);
        return changed;
      }
      if (data) {
        e.lastPushedHash = hash;
        e.retryStep = 0;
        const latest = readMeta();
        writeMeta({ userId: e.userId, lastSyncedAt: data.updated_at, lastLocalChangeAt: latest?.lastLocalChangeAt ?? null });
        status().markSaved(new Date().toISOString());
        return true;
      }
      // Zero rows: another device wrote since our last sync (or the row is gone). Merge first.
    }

    /* 2 — Cheap check for pulls: has the cloud moved at all? */
    if (mode === "pull" && known) {
      const { data: head, error } = await supabase
        .from("member_state")
        .select("updated_at")
        .eq("user_id", e.userId)
        .maybeSingle();
      if (!isLive(e, generation) || error) return changed;
      if (head && head.updated_at === known) return changed;
    }

    /* 3 — Read the row and merge it into this device. */
    const { data: rowData, error: readError } = await supabase
      .from("member_state")
      .select("state, schema_version, updated_at")
      .eq("user_id", e.userId)
      .maybeSingle();
    if (!isLive(e, generation)) return changed;
    if (readError) {
      if (mode === "push") reportWriteFailure(e, readError.message);
      return changed;
    }
    const row = (rowData as CloudRow | null) ?? null;

    if (!row) {
      // No cloud row yet: create it. A concurrent insert from another device
      // surfaces as a unique violation — loop round and merge with it.
      const envelope = buildEnvelope();
      const hash = hashOf(envelope);
      status().setStatus("saving");
      const { data, error } = await supabase
        .from("member_state")
        .insert({ user_id: e.userId, state: envelope as unknown as Json, schema_version: CLOUD_SCHEMA_VERSION })
        .select("updated_at")
        .single();
      if (!isLive(e, generation)) return changed;
      if (error) {
        if ((error as { code?: string }).code === "23505") continue;
        reportWriteFailure(e, error.message);
        return changed;
      }
      e.lastPushedHash = hash;
      e.retryStep = 0;
      writeMeta({ userId: e.userId, lastSyncedAt: data?.updated_at ?? null, lastLocalChangeAt: readMeta()?.lastLocalChangeAt ?? null });
      status().markSaved(new Date().toISOString());
      return true;
    }

    // Once this device has synced, every member edit since is clocked in the
    // sync ledger, so a slice with no local clock was not changed here: the
    // advanced cloud copy wins it. A device that never synced (first upload of
    // real local progress) keeps its own copy on ties. Day logs carry no
    // clocks; there the newer side breaks ties.
    const { changedLocal, matchesCloud } = mergeRowIntoLocal(e, row, {
      slices: known ? "cloud" : "local",
      logs: newerSide(meta?.userId === e.userId ? meta.lastLocalChangeAt : null, row.updated_at),
    });
    changed = changed || changedLocal;
    const latest = readMeta();
    writeMeta({
      userId: e.userId,
      // This device now holds everything the row at this updated_at held.
      lastSyncedAt: row.updated_at,
      lastLocalChangeAt: latest?.userId === e.userId ? latest.lastLocalChangeAt : null,
    });
    if (matchesCloud) {
      e.retryStep = 0;
      if (mode === "push" || status().status === "pending" || status().status === "saving") {
        status().markSaved(new Date().toISOString());
      }
      return changed;
    }
    // This device holds something the cloud lacks → write the merged state,
    // conditional on the row we just merged.
    mode = "push";
  }

  status().setStatus("error", "Another device is saving at the same time. Trying again shortly.");
  scheduleRetry(e);
  return changed;
}

function flushNow(e: EngineState): Promise<void> {
  if (e.debounceTimer) {
    clearTimeout(e.debounceTimer);
    e.debounceTimer = null;
  }
  return exclusive(e, () => reconcile(e, "push")).then(() => undefined);
}

function pullNow(e: EngineState): Promise<boolean> {
  e.lastPullAt = Date.now();
  return exclusive(e, () => reconcile(e, "pull"));
}

function schedulePoll(e: EngineState): void {
  if (e.pollTimer) clearTimeout(e.pollTimer);
  e.pollTimer = null;
  if (engine !== e) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  if (prefersSavingData()) return;
  e.pollTimer = setTimeout(() => {
    e.pollTimer = null;
    if (engine !== e || isOffline()) {
      schedulePoll(e);
      return;
    }
    void pullNow(e).then((changed) => {
      e.pollDelayMs = changed ? POLL_BASE_MS : Math.min(e.pollDelayMs * 2, POLL_MAX_MS);
      schedulePoll(e);
    });
  }, e.pollDelayMs);
}

function pullOnReturn(e: EngineState): void {
  if (engine !== e || isOffline()) return;
  e.pollDelayMs = POLL_BASE_MS;
  if (Date.now() - e.lastPullAt >= FOCUS_PULL_THROTTLE_MS) {
    void pullNow(e).then(() => schedulePoll(e));
  } else {
    schedulePoll(e);
  }
}

/**
 * First-login hydration. Runs exactly once per startMemberSync call, before
 * any push subscription is attached.
 */
async function hydrateOnce(e: EngineState): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;

  status().setStatus("restoring");

  const { data, error } = await supabase
    .from("member_state")
    .select("state, schema_version, updated_at")
    .eq("user_id", e.userId)
    .maybeSingle();

  if (engine !== e) return;

  if (error) {
    // Surface the failure without touching anything local.
    status().setStatus("error", `Restore failed — your local copy is untouched. (${error.message})`);
    scheduleRetryHydrate(e);
    return;
  }

  const meta = readMeta();
  let localSlices = serializeMemberState();
  let localLogs = serializeLocalLogs();
  let localProgress = hasMeaningfulProgress(localSlices) || hasMeaningfulLocalLogs(localLogs);

  // Cross-user guard: local progress that belongs to a DIFFERENT member must
  // never merge into this member's cloud row. Back it up, reset, continue.
  if (localProgress && meta && meta.userId !== e.userId) {
    backupLocalState(`user-switch-${meta.userId.slice(0, 8)}`);
    e.applyingCloud = true;
    try {
      resetMemberStateToDefaults();
      clearLocalLogs();
    } finally {
      e.applyingCloud = false;
    }
    localSlices = serializeMemberState();
    localLogs = serializeLocalLogs();
    localProgress = false;
  }

  const row = (data as CloudRow | null) ?? null;
  const cloudSlices = row ? envelopeSlices(row) : null;
  const cloudLogs = row ? envelopeLogs(row) : null;
  const cloudProgress = cloudSlices
    ? hasMeaningfulProgress(cloudSlices) || Boolean(cloudLogs && hasMeaningfulLocalLogs(cloudLogs))
    : false;

  const applyCloud = () => {
    backupLocalState("pre-hydrate");
    e.applyingCloud = true;
    try {
      hydrateMemberState(cloudSlices!);
      hydrateLocalLogs(cloudLogs);
    } finally {
      e.applyingCloud = false;
    }
    e.lastPushedHash = hashOf({ slices: serializeMemberState(), logs: serializeLocalLogs() });
    writeMeta({ userId: e.userId, lastSyncedAt: row!.updated_at, lastLocalChangeAt: null });
    status().markSaved(new Date().toISOString());
  };

  try {
    if (cloudProgress && !localProgress) {
      // Cloud has the member's life, this device is fresh → hydrate.
      applyCloud();
      return;
    }

    if (!cloudProgress) {
      // Cloud empty (or no row): upload this device — merged with whatever
      // the row holds, never blindly over it.
      writeMeta({
        userId: e.userId,
        lastSyncedAt: null,
        lastLocalChangeAt: localProgress ? new Date().toISOString() : (meta?.userId === e.userId ? meta.lastLocalChangeAt : null),
      });
      await exclusive(e, () => reconcile(e, "push"));
      return;
    }

    // Both populated → merge. The newer side only breaks ties the per-slice
    // and per-record clocks cannot settle. Both sides are backed up first.
    const sameLineage = meta?.userId === e.userId && meta?.lastSyncedAt;
    const cloudAt = Date.parse(row!.updated_at);
    const localAt = meta?.userId === e.userId && meta?.lastLocalChangeAt ? Date.parse(meta.lastLocalChangeAt) : Number.NaN;
    let pref: Side;
    if (sameLineage) {
      const lastSync = Date.parse(meta!.lastSyncedAt!);
      const cloudAdvanced = cloudAt > lastSync + SKEW_MS;
      const localAdvanced = Number.isFinite(localAt) && localAt > lastSync + SKEW_MS;
      if (cloudAdvanced && !localAdvanced) pref = "cloud";
      else if (!cloudAdvanced) pref = "local";
      else pref = Number.isFinite(localAt) && localAt >= cloudAt ? "local" : "cloud";
    } else {
      pref = !Number.isFinite(localAt) || localAt >= cloudAt ? "local" : "cloud";
    }

    backupLocalState("pre-hydrate");
    if (row?.state) backupCloudEnvelope(row.state, "pre-merge");
    const { matchesCloud } = mergeRowIntoLocal(e, row!, { slices: pref, logs: pref });
    writeMeta({
      userId: e.userId,
      lastSyncedAt: row!.updated_at,
      lastLocalChangeAt: matchesCloud ? null : new Date().toISOString(),
    });
    if (matchesCloud) {
      status().markSaved(new Date().toISOString());
    } else {
      await exclusive(e, () => reconcile(e, "push"));
    }
  } catch (err) {
    status().setStatus(
      "error",
      `Restore failed — your local copy is untouched. (${err instanceof Error ? err.message : "unknown"})`,
    );
  }
}

function scheduleRetryHydrate(e: EngineState): void {
  const delay = RETRY_STEPS_MS[Math.min(e.retryStep, RETRY_STEPS_MS.length - 1)];
  e.retryStep += 1;
  e.retryTimer = setTimeout(() => {
    e.retryTimer = null;
    void hydrateOnce(e).then(() => {
      if (engine === e) e.retryStep = 0;
    });
  }, delay);
}

/** Start syncing for an authenticated member. Idempotent per user id. */
export async function startMemberSync(userId: string): Promise<void> {
  if (engine?.userId === userId) return;
  if (engine) await stopMemberSync({ flush: false });

  generationCounter += 1;
  const e: EngineState = {
    userId,
    generation: generationCounter,
    unsubscribeStore: () => {},
    unsubscribeFlush: () => {},
    removeWindowListeners: () => {},
    debounceTimer: null,
    retryTimer: null,
    pollTimer: null,
    pollDelayMs: POLL_BASE_MS,
    lastPullAt: 0,
    retryStep: 0,
    lastPushedHash: null,
    applyingCloud: false,
    lock: Promise.resolve(),
  };
  engine = e;

  await hydrateOnce(e);
  if (engine !== e) return;
  e.retryStep = 0;
  e.lastPullAt = Date.now();

  e.unsubscribeStore = useAthleteDashboardStore.subscribe(() => schedulePush(e));
  e.unsubscribeFlush = onSyncFlushRequest(() => void flushNow(e));

  const onOnline = () => {
    void flushNow(e);
    pullOnReturn(e);
  };
  const onOffline = () => status().setStatus("offline");
  const onLocalLogsChanged = () => schedulePush(e);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      void flushNow(e);
      if (e.pollTimer) clearTimeout(e.pollTimer);
      e.pollTimer = null;
    } else {
      pullOnReturn(e);
    }
  };
  const onFocus = () => pullOnReturn(e);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("focus", onFocus);
  window.addEventListener(LOCAL_LOGS_CHANGED_EVENT, onLocalLogsChanged);
  document.addEventListener("visibilitychange", onVisibility);
  e.removeWindowListeners = () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener(LOCAL_LOGS_CHANGED_EVENT, onLocalLogsChanged);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  schedulePoll(e);
}

/** Pull and merge now (e.g. after a restore on another device). No-op when not syncing. */
export function requestMemberPull(): Promise<boolean> {
  return engine ? pullNow(engine) : Promise.resolve(false);
}

/** Stop syncing. With flush=true, gives the final write ~2.5s to land. */
export async function stopMemberSync(opts: { flush?: boolean } = {}): Promise<void> {
  const e = engine;
  if (!e) return;

  if (opts.flush) {
    try {
      await Promise.race([
        flushNow(e),
        new Promise((resolve) => setTimeout(resolve, 2_500)),
      ]);
    } catch {
      // Best effort — local copy remains the source of truth.
    }
  }

  e.generation = -1; // invalidate in-flight completions
  clearTimers(e);
  e.unsubscribeStore();
  e.unsubscribeFlush();
  e.removeWindowListeners();
  if (engine === e) engine = null;
  status().setStatus("local-only");
}
