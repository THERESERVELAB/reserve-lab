/* ════════════════════════════════════════════════════════════════════════
   NOTHING IN THE LOG IS INVISIBLE.

   The owner, 2026-09-24: "a compound won't take the tap. It's not even
   saying I'm on it. It's not even mentioned anywhere."

   Today listed what was due today, and Plan listed the events on the board.
   An entry that produced neither — paused, ended, set to manual, or still
   waiting for a time — appeared in neither place. The member was on it, and
   Reserve never said so.

   This is the read for those entries: who they are and why they are off the
   plan, so every entry in the member's own log is named somewhere, always,
   with a way to open it.

   Pure: it never changes an entry, and it never guesses a schedule.
   ════════════════════════════════════════════════════════════════════════ */

export type OffPlanReason = "paused" | "ended" | "no-time" | "manual" | "another-day";

export type OffPlanEntry = {
  id: string;
  name: string;
  isActive?: boolean;
  pausedAt?: string;
  /** Set when the entry's own rule asks the member to finish setting it up. */
  scheduleReviewReason?: string;
  frequencyType?: string;
  scheduleRule?: { type?: string } | null;
};

export type OffPlanItem = { id: string; name: string; reason: OffPlanReason; note: string };

export const OFF_PLAN_NOTE: Record<OffPlanReason, string> = {
  paused: "Paused — still in your record",
  ended: "Ended — still in your record",
  "no-time": "Needs a time before it lands on a day",
  manual: "Logged by hand, never scheduled",
  "another-day": "Not on today's plan",
};

/** Why one entry is off today's plan. */
export function offPlanReason(entry: OffPlanEntry): OffPlanReason {
  if (entry.isActive === false) return "ended";
  if (entry.pausedAt) return "paused";
  if (entry.scheduleReviewReason) return "no-time";
  const rule = entry.scheduleRule?.type;
  if (rule === "manual_only" || entry.frequencyType === "custom") return "manual";
  return "another-day";
}

/**
 * Every entry in the log with nothing on today's plan, in the member's own
 * order of concern: what they paused or ended first (they know they are on
 * it), then what needs finishing, then the rest.
 */
export function offPlanToday(entries: readonly OffPlanEntry[], scheduledEntryIds: Iterable<string>): OffPlanItem[] {
  const onPlan = new Set(scheduledEntryIds);
  const rank: Record<OffPlanReason, number> = { paused: 0, ended: 1, "no-time": 2, manual: 3, "another-day": 4 };
  return entries
    .filter((entry) => !onPlan.has(entry.id))
    .map((entry): OffPlanItem => {
      const reason = offPlanReason(entry);
      return { id: entry.id, name: entry.name, reason, note: OFF_PLAN_NOTE[reason] };
    })
    .sort((a, b) => rank[a.reason] - rank[b.reason] || a.name.localeCompare(b.name));
}

/** The one line above the list: how many, and what they are. */
export function offPlanLine(items: readonly OffPlanItem[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<OffPlanReason, number>();
  for (const item of items) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  const said: string[] = [];
  for (const [reason, n] of counts) {
    said.push(
      reason === "paused" ? `${n} paused`
        : reason === "ended" ? `${n} ended`
          : reason === "no-time" ? `${n} waiting on a time`
            : reason === "manual" ? `${n} logged by hand`
              : `${n} on another day`,
    );
  }
  return `In your log, not on today: ${said.join(" · ")}`;
}
