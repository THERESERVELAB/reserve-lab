/**
 * Safety copies on this device. Before the sync engine replaces or merges
 * local state with cloud state (or writes over a populated cloud row), the
 * side that could lose something is snapshotted into localStorage.
 *
 * Pruning keeps the newest MAX_BACKUPS, but a backup that still holds a
 * record the member no longer has — and never deliberately removed — is
 * protected: it is never pruned by count. Only when backups outgrow their
 * storage budget (so the member's live data can still be saved) do protected
 * copies go, oldest first, and never the newest one.
 *
 * Settings → "Recover from this device" reads these copies.
 */

import { serializeLocalLogs } from "@/lib/logging/store";
import { allTombstones, collectEntities, isPlainObject, LEDGER_SLICE_KEY } from "@/lib/sync/member-merge";
import { readLedger } from "@/lib/sync/sync-ledger";

export const BACKUP_PREFIX = "fba-backup:";
export const MAX_BACKUPS = 10;
/** Characters of localStorage all backups together may use (~4 MB of UTF-16). */
const BACKUP_BUDGET_CHARS = 2_000_000;

export const ATHLETE_STORE_STORAGE_KEY = "final-boss-athlete-settings";

export type BackupRecord = {
  key: string;
  /** The tag the engine wrote (pre-hydrate, pre-merge, cloud-pre-overwrite…). */
  tag: string;
  /** ISO time the copy was taken. */
  takenAt: string;
  raw: string;
};

/** Pull the member slices out of any backup shape this app has written. */
export function parseBackupSlices(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;
    // Local copy: { athleteStore: "<persist JSON>", logs }
    if (typeof parsed.athleteStore === "string") {
      const store = JSON.parse(parsed.athleteStore) as unknown;
      if (isPlainObject(store) && isPlainObject(store.state)) return store.state;
      return isPlainObject(store) ? store : null;
    }
    // Cloud envelope: { envelope, slices, logs }
    if (isPlainObject(parsed.slices)) return parsed.slices;
    // Bare slices.
    return parsed;
  } catch {
    return null;
  }
}

function backupKeyParts(key: string): { tag: string; takenAt: string } {
  const body = key.slice(BACKUP_PREFIX.length);
  // Keys are "<tag>:<ISO timestamp>"; the ISO part itself contains colons.
  const match = body.match(/^(.*?):(\d{4}-\d{2}-\d{2}T.*)$/);
  return match ? { tag: match[1], takenAt: match[2] } : { tag: body, takenAt: "" };
}

/** Every backup on this device, oldest first. */
export function listBackups(storage: Storage = localStorage): BackupRecord[] {
  const out: BackupRecord[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key?.startsWith(BACKUP_PREFIX)) continue;
      const raw = storage.getItem(key);
      if (raw === null) continue;
      out.push({ key, ...backupKeyParts(key), raw });
    }
  } catch {
    return out;
  }
  return out.sort((a, b) => (a.takenAt === b.takenAt ? a.key.localeCompare(b.key) : a.takenAt.localeCompare(b.takenAt)));
}

/** Current member slices as persisted on this device. */
export function readPersistedSlices(storage: Storage = localStorage): Record<string, unknown> {
  try {
    const raw = storage.getItem(ATHLETE_STORE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (isPlainObject(parsed) && isPlainObject(parsed.state)) return parsed.state;
    return {};
  } catch {
    return {};
  }
}

/**
 * Whether a backup holds a record the member doesn't have now and never
 * deliberately removed — i.e. the only copy of something they may want back.
 */
export function backupHoldsMissingRecords(
  backupSlices: Record<string, unknown>,
  currentSlices: Record<string, unknown>,
): boolean {
  const current = collectEntities(currentSlices);
  const tombstones = allTombstones(readLedger(currentSlices[LEDGER_SLICE_KEY]), currentSlices.changeHistory);
  for (const key of collectEntities(backupSlices).keys()) {
    if (!current.has(key) && !tombstones[key]) return true;
  }
  return false;
}

export function pruneBackups(storage: Storage = localStorage): void {
  try {
    const backups = listBackups(storage);
    if (backups.length === 0) return;
    const current = readPersistedSlices(storage);
    const newest = backups[backups.length - 1].key;
    const protectedKeys = new Set<string>();
    for (const backup of backups) {
      const slices = parseBackupSlices(backup.raw);
      if (slices && backupHoldsMissingRecords(slices, current)) protectedKeys.add(backup.key);
    }

    let remaining = backups.slice();
    // Count limit: oldest unprotected go first; protected ones are never pruned by count.
    let unprotected = remaining.filter((b) => !protectedKeys.has(b.key) && b.key !== newest);
    while (remaining.length > MAX_BACKUPS && unprotected.length > 0) {
      const oldest = unprotected.shift()!;
      storage.removeItem(oldest.key);
      remaining = remaining.filter((b) => b.key !== oldest.key);
    }

    // Storage budget: the member's live data must always have room to save.
    let size = remaining.reduce((sum, b) => sum + b.key.length + b.raw.length, 0);
    unprotected = remaining.filter((b) => !protectedKeys.has(b.key) && b.key !== newest);
    const protectedOldestFirst = remaining.filter((b) => protectedKeys.has(b.key) && b.key !== newest);
    const evictionOrder = [...unprotected, ...protectedOldestFirst];
    while (size > BACKUP_BUDGET_CHARS && evictionOrder.length > 0) {
      const victim = evictionOrder.shift()!;
      storage.removeItem(victim.key);
      size -= victim.key.length + victim.raw.length;
    }
  } catch {
    // Quota/security errors on prune are non-fatal.
  }
}

/** Snapshot the current persisted local store. Returns the backup key or null. */
export function backupLocalState(tag: string): string | null {
  try {
    const raw = localStorage.getItem(ATHLETE_STORE_STORAGE_KEY);
    if (!raw) return null;
    const key = `${BACKUP_PREFIX}${tag}:${new Date().toISOString()}`;
    localStorage.setItem(key, JSON.stringify({ athleteStore: raw, logs: serializeLocalLogs() }));
    pruneBackups();
    return key;
  } catch {
    return null;
  }
}

/** Snapshot a cloud envelope before local state overwrites or merges it. */
export function backupCloudEnvelope(envelope: unknown, tag: string): string | null {
  try {
    const key = `${BACKUP_PREFIX}cloud-${tag}:${new Date().toISOString()}`;
    localStorage.setItem(key, JSON.stringify(envelope));
    pruneBackups();
    return key;
  } catch {
    return null;
  }
}
