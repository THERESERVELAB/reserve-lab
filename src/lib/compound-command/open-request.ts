/* ════════════════════════════════════════════════════════════════════════
   OPEN REQUEST — another room asking Compound Command to open one entry.

   Apex's "Your compounds" tiles open an entry's Today sheet in place; its
   "Edit entry" and "All details" land in Compound Command with that entry's
   editor or sheet already open. The request is held here until Compound
   Command mounts and reads it, then cleared. In memory only: nothing is
   persisted or synced, and a reload simply opens Compound Command as usual.
   ════════════════════════════════════════════════════════════════════════ */

export type CompoundOpenRequest = { entryId: string; mode: "details" | "edit" };

let pending: CompoundOpenRequest | null = null;

export function requestCompoundEntry(request: CompoundOpenRequest): void {
  pending = request;
}

/** The pending request, without clearing it (safe to read from a state initializer). */
export function peekCompoundEntryRequest(): CompoundOpenRequest | null {
  return pending;
}

export function clearCompoundEntryRequest(): void {
  pending = null;
}
