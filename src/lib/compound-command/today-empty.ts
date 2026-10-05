/* ════════════════════════════════════════════════════════════════════════
   WHY TODAY IS EMPTY — a compound section that shows nothing has to say why.

   The owner, 2026-09-22: "the system stopped showing today's compounds."
   Today's list held only what was due or waiting for its next day. A log
   where every entry was paused, ended or never added rendered nothing at
   all — no heading, no line, nothing to tap — which reads as a broken app
   rather than an empty one.

   Pure: counts what is in the member's own log and hands back the honest
   line for the state it is in. It never invents an entry and never hides
   one; paused and ended compounds are the member's own records and are said
   out loud, with the way back to them.
   ════════════════════════════════════════════════════════════════════════ */

export type EmptyTodayEntry = {
  isActive?: boolean;
  pausedAt?: string;
};

export type EmptyTodayRead = {
  /** Nothing in the log at all. */
  none: boolean;
  paused: number;
  ended: number;
  /** The line a member reads where the list would be. */
  line: string;
  /** What the one control does, or null when there is nothing to open. */
  action: "add" | "open-plan" | null;
};

const ADD_FIRST = "No compounds in your log yet. Add one and today's plan builds itself around it.";

function countWord(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The honest read for a Today with no compounds on it. `entries` counts every
 * entry in the member's log, whatever its state; `addOnsToday` is how many
 * add-ons land on today, listed below this line. An add-on with a time is on
 * the day like anything else, so a Today holding one can never say nothing is
 * due.
 */
export function emptyTodayRead(entries: readonly EmptyTodayEntry[], addOnsToday = 0): EmptyTodayRead {
  const paused = entries.filter((e) => e.pausedAt && e.isActive !== false).length;
  const ended = entries.filter((e) => e.isActive === false).length;
  if (entries.length === 0) return { none: true, paused: 0, ended: 0, line: ADD_FIRST, action: "add" };

  const parts: string[] = [];
  if (paused > 0) parts.push(`${countWord(paused, "compound")} paused`);
  if (ended > 0) parts.push(`${countWord(ended, "compound")} ended`);
  if (addOnsToday > 0) {
    /* The hero row is empty, but the day is not: the add-ons sit right under this line. */
    const below = `${countWord(addOnsToday, "add-on")} ${addOnsToday === 1 ? "is" : "are"} on today, below.`;
    return {
      none: false,
      paused,
      ended,
      line: parts.length > 0 ? `No compounds due today: ${parts.join(" and ")}. ${below}` : `No compounds due today. ${below}`,
      action: parts.length > 0 ? "open-plan" : null,
    };
  }

  if (parts.length === 0) {
    /* Everything in the log is active, and none of it lands today. */
    return {
      none: false,
      paused,
      ended,
      line: "Nothing is due today on the times you set. Your compounds are in Plan, with the next day each one is due.",
      action: "open-plan",
    };
  }
  return {
    none: false,
    paused,
    ended,
    line: `Nothing due today: ${parts.join(" and ")}. They stay in your record until you bring them back.`,
    action: "open-plan",
  };
}
