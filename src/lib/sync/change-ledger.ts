/**
 * Change ledger — keeps `syncLedger` current as the member uses the app.
 *
 * One store subscription diffs every member-state change (member-merge.ts
 * `recordChanges`): the slices that changed are stamped, records that were
 * added or edited get an entity clock, and records that were removed get a
 * tombstone. Because it watches the state rather than individual actions,
 * every remove path is covered — delete buttons, cascades (a compound's
 * schedule marks), re-logs that replace a record, and setters that replace a
 * list — without each action having to remember.
 *
 * Suppressed while hydration, a cloud merge or an account reset rewrites the
 * store: those changes are not the member's, and must not stamp or tombstone.
 *
 * No store import (the store installs this), so there is no import cycle.
 */

import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";
import { LEDGER_SLICE_KEY, recordChanges } from "@/lib/sync/member-merge";
import { readLedger } from "@/lib/sync/sync-ledger";

type LedgerStore = {
  getState: () => unknown;
  setState: (partial: Record<string, unknown>) => void;
  subscribe: (listener: (state: unknown, prev: unknown) => void) => () => void;
  persist?: { hasHydrated?: () => boolean };
};

let suppressed = 0;

/** Run a store rewrite that is not a member edit (hydration, merge, reset). */
export function withLedgerSuppressed<T>(run: () => T): T {
  suppressed += 1;
  try {
    return run();
  } finally {
    suppressed -= 1;
  }
}

export function isLedgerSuppressed(): boolean {
  return suppressed > 0;
}

let installed: (() => void) | null = null;

export function installChangeLedger(store: LedgerStore): () => void {
  if (installed) return installed;
  const unsubscribe = store.subscribe((state, prev) => {
    if (suppressed > 0) return;
    if (store.persist?.hasHydrated && !store.persist.hasHydrated()) return;
    const next = state as Record<string, unknown>;
    const before = prev as Record<string, unknown>;
    const ledger = recordChanges(before, next, MEMBER_STATE_KEYS, readLedger(next[LEDGER_SLICE_KEY]));
    if (!ledger) return;
    withLedgerSuppressed(() => store.setState({ [LEDGER_SLICE_KEY]: ledger }));
  });
  installed = () => {
    unsubscribe();
    installed = null;
  };
  return installed;
}
