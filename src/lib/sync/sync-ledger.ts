/**
 * Sync ledger — the small record that makes a per-entity merge possible.
 *
 * Stored as the `syncLedger` member slice (so it persists locally and rides
 * in the cloud envelope with everything else). It holds three clocks:
 *
 *  - slices:    top-level member slice → when its content last changed here
 *  - entities:  "path|id" → when that entity was last added or changed
 *  - deletions: "path|id" → when that entity was deliberately removed
 *               (the tombstone: a missing entity only stays gone if one
 *               of these is newer than its last change)
 *
 * The ledger is written by `recordChanges` (a store subscription diffing
 * every member-state change) — never by hydration, cloud merges or resets.
 * Pure module: no store, no storage.
 */

export type SyncLedger = {
  v: 1;
  slices: Record<string, string>;
  entities: Record<string, string>;
  deletions: Record<string, string>;
};

export const EMPTY_SYNC_LEDGER: SyncLedger = { v: 1, slices: {}, entities: {}, deletions: {} };

/** Entity clocks only need to outlive the window in which two devices disagree. */
const ENTITY_CLOCK_LIMIT = 1_500;
const ENTITY_CLOCK_MAX_AGE_MS = 60 * 86_400_000;
/** Tombstones must outlive the stalest device that could resurrect the entity. */
const DELETION_LIMIT = 2_000;
const DELETION_MAX_AGE_MS = 400 * 86_400_000;

export function entityKey(path: string, id: string): string {
  return `${path}|${id}`;
}

export function splitEntityKey(key: string): { path: string; id: string } {
  const at = key.indexOf("|");
  return at < 0 ? { path: key, id: "" } : { path: key.slice(0, at), id: key.slice(at + 1) };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

/** Tolerant read: anything malformed becomes an empty ledger. */
export function readLedger(value: unknown): SyncLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_SYNC_LEDGER;
  const raw = value as Partial<SyncLedger>;
  return {
    v: 1,
    slices: isStringRecord(raw.slices) ? raw.slices : {},
    entities: isStringRecord(raw.entities) ? raw.entities : {},
    deletions: isStringRecord(raw.deletions) ? raw.deletions : {},
  };
}

export function isEmptyLedger(ledger: SyncLedger): boolean {
  return (
    Object.keys(ledger.slices).length === 0 &&
    Object.keys(ledger.entities).length === 0 &&
    Object.keys(ledger.deletions).length === 0
  );
}

export function toMillis(value: unknown): number {
  if (typeof value !== "string" || value.length < 10) return Number.NaN;
  // A bare YYYY-MM-DD is a calendar day, not a moment — never a change clock.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  return Date.parse(value);
}

function newerOf(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const ma = toMillis(a);
  const mb = toMillis(b);
  if (!Number.isFinite(mb)) return a;
  if (!Number.isFinite(ma)) return b;
  return mb > ma ? b : a;
}

function mergeClock(a: Record<string, string>, b: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const next = newerOf(out[key], value);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

function pruneClock(clock: Record<string, string>, limit: number, maxAgeMs: number, nowMs: number): Record<string, string> {
  const entries = Object.entries(clock).filter(([, at]) => {
    const ms = toMillis(at);
    return Number.isFinite(ms) && nowMs - ms <= maxAgeMs;
  });
  if (entries.length <= limit && entries.length === Object.keys(clock).length) return clock;
  entries.sort((x, y) => toMillis(y[1]) - toMillis(x[1]));
  return Object.fromEntries(entries.slice(0, limit));
}

/** Union of two ledgers, keeping the newest time for every key. */
export function mergeLedgers(a: SyncLedger, b: SyncLedger, now: Date = new Date()): SyncLedger {
  return pruneLedger(
    {
      v: 1,
      slices: mergeClock(a.slices, b.slices),
      entities: mergeClock(a.entities, b.entities),
      deletions: mergeClock(a.deletions, b.deletions),
    },
    now,
  );
}

export function pruneLedger(ledger: SyncLedger, now: Date = new Date()): SyncLedger {
  const nowMs = now.getTime();
  return {
    v: 1,
    slices: ledger.slices,
    entities: pruneClock(ledger.entities, ENTITY_CLOCK_LIMIT, ENTITY_CLOCK_MAX_AGE_MS, nowMs),
    deletions: pruneClock(ledger.deletions, DELETION_LIMIT, DELETION_MAX_AGE_MS, nowMs),
  };
}
