/* ════════════════════════════════════════════════════════════════════════
   LOOP NETWORK — may a phone spend data on a room loop?

   A 9:16 loop is 3–5MB of pure atmosphere. On a phone the member's data and
   battery outrank it: the still plate is the room, the loop is a courtesy.

   No loop when the browser reports Save-Data, or a connection slower than 4G
   (effectiveType slow-2g, 2g or 3g). A browser that reports nothing (Safari,
   Firefox) is not assumed to be slow; the rest of the loop's gates still
   apply there, and autoplay refusal (low-power mode) leaves the still.
   ════════════════════════════════════════════════════════════════════════ */

/** The Network Information API fields this reads. Every one may be absent. */
export type LoopConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

export function phoneLoopDataAllowed(connection: LoopConnection | null | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData === true) return false;
  return !(typeof connection.effectiveType === "string" && SLOW_CONNECTIONS.has(connection.effectiveType));
}

/** How long a loop waits for an idle moment before attaching anyway. */
export const LOOP_IDLE_TIMEOUT_MS = 2000;
