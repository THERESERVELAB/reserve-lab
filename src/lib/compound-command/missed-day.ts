/* ════════════════════════════════════════════════════════════════════════
   A DAY THAT GOT AWAY — the owner, 2026-09-24: "now let me back-date a whole
   missed day for compounds."

   A member who took their doses but never opened the app has a day that reads
   as missed. This is that day, rebuilt from the same schedule Today reads:
   every dose that WAS scheduled then, what is already recorded against it,
   and what is still open.

   Reserve never decides that a dose was taken. It shows the day, the member
   ticks what they actually took, and only then is anything written.

   Pure: no React, no store, no clock of its own.
   ════════════════════════════════════════════════════════════════════════ */

/** One dose that was on the plan for the chosen day. */
export type MissedDayDose = {
  /** The slot's own id, unique per entry and planned time. */
  id: string;
  entryId: string;
  name: string;
  /** "HH:MM" the dose was planned for, or null when the entry has no time. */
  plannedTime: string;
  timeLabel: string;
  /** Already recorded for that day: shown, never re-logged, never ticked. */
  status: "taken" | "skipped" | "open";
};

export type MissedDay = {
  date: string;
  doses: MissedDayDose[];
  open: MissedDayDose[];
  /** Nothing was on the plan that day — said plainly rather than shown empty. */
  none: boolean;
};

export type DayChoice = { date: string; label: string };

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * The days a member can put right: yesterday back through `days`. Today is not
 * offered — today is logged from Today, where the markers are.
 */
export function backdateChoices(now: Date, days = 7): DayChoice[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1));
    return {
      date: keyOf(date),
      label: i === 0 ? "Yesterday" : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  });
}

type SlotLike = {
  id: string;
  entryId: string;
  plannedTime: string;
  plannedTimeLabel: string;
  entry: { name: string; displayName?: string };
};

type AdherenceLike = { entryId: string; date: string; plannedTime: string; takenStatus?: string };

/**
 * The chosen day as it stood: every dose that was scheduled, with anything the
 * member already recorded against it carried through.
 */
export function missedDay(date: string, slots: readonly SlotLike[], adherence: readonly AdherenceLike[]): MissedDay {
  const doses = slots.map((slot): MissedDayDose => {
    const record = adherence.find((r) => r.entryId === slot.entryId && r.date === date && r.plannedTime === slot.plannedTime);
    const status: MissedDayDose["status"] = record?.takenStatus === "taken" ? "taken" : record?.takenStatus === "skipped" ? "skipped" : "open";
    return {
      id: slot.id,
      entryId: slot.entryId,
      name: slot.entry.displayName?.trim() || slot.entry.name,
      plannedTime: slot.plannedTime,
      timeLabel: slot.plannedTimeLabel,
      status,
    };
  });
  return { date, doses, open: doses.filter((d) => d.status === "open"), none: doses.length === 0 };
}

/** The line above the list: what the day holds. */
export function missedDayLine(day: MissedDay): string {
  if (day.none) return "Nothing was on your plan that day.";
  const recorded = day.doses.length - day.open.length;
  if (day.open.length === 0) return `All ${day.doses.length} of that day's doses are already recorded.`;
  return recorded === 0
    ? `${day.open.length} ${day.open.length === 1 ? "dose was" : "doses were"} on your plan that day.`
    : `${day.open.length} still open · ${recorded} already recorded.`;
}
