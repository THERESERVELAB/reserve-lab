/* ════════════════════════════════════════════════════════════════════════
   GIVE IT A TIME — an add-on the member chose is not in their day until it
   has one.

   Adding creatine (or anything else) from the supplement library puts it in
   the log as an untimed entry: it is in the record, but it never lands on a
   day, never reaches Today, and cannot be ticked with the rest. This turns
   the member's answer to "when do you take it?" into the schedule that the
   whole app already reads.

   Reserve never picks the time. It offers the member's own anchors — the
   ones their schedule already holds — and a clock, and writes down what they
   say.

   Pure: it builds the patch, it does not apply it.
   ════════════════════════════════════════════════════════════════════════ */

/** The schedule engine's own vocabulary — nothing here invents a time it cannot resolve. */
export type TimeChoiceKey = "morning" | "pre_training" | "post_training" | "evening" | "bedtime" | "custom";

export type TimeChoice = { key: TimeChoiceKey; label: string };

/** The anchors a member can pick from, in the order of a day. */
export const TIME_CHOICES: readonly TimeChoice[] = [
  { key: "morning", label: "Morning" },
  { key: "pre_training", label: "Before training" },
  { key: "post_training", label: "After training" },
  { key: "evening", label: "Evening" },
  { key: "bedtime", label: "Before bed" },
  { key: "custom", label: "A set time" },
];

/** What the entry carries once the member has answered. */
export type TimePatch = {
  timeOfDayPreference: TimeChoiceKey;
  customTime?: string;
  scheduleRule: { type: "daily" };
  /** Cleared: the entry no longer needs setting up. */
  scheduleReviewReason: undefined;
};

/** "HH:MM" or null. */
export function validTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * The entry patch for one answer. A clock time is kept as the member typed it;
 * an anchor is stored as the preference the schedule engine already resolves
 * against their own wake, training and sleep times.
 */
export function timePatch(choice: TimeChoiceKey, clock = ""): TimePatch | null {
  if (choice === "custom") {
    const time = validTime(clock);
    return time ? { timeOfDayPreference: "custom", customTime: time, scheduleRule: { type: "daily" }, scheduleReviewReason: undefined } : null;
  }
  return { timeOfDayPreference: choice, scheduleRule: { type: "daily" }, scheduleReviewReason: undefined };
}

/** True when an entry is in the log but has no time to land on. */
export function needsATime(entry: { timeOfDayPreference?: string; customTime?: string; scheduleReviewReason?: string; scheduleRule?: { type?: string } | null }): boolean {
  if (entry.scheduleReviewReason) return true;
  const pref = entry.timeOfDayPreference ?? "unspecified";
  if (pref === "unspecified") return true;
  return pref === "custom" && !entry.customTime;
}

/** "16:00" → "4:00 PM". */
function clock12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * The member's answer said back to them, for the line that confirms it.
 * Their words, not a judgement: "morning", "before training", "4:00 PM".
 */
export function choiceLabel(choice: TimeChoiceKey, clock = ""): string {
  if (choice === "custom") {
    const time = validTime(clock);
    return time ? clock12(time) : "a set time";
  }
  return (TIME_CHOICES.find((option) => option.key === choice)?.label ?? "").toLowerCase();
}
