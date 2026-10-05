/* ════════════════════════════════════════════════════════════════════════
   THE DAY'S LINE — one quiet sentence under the Apex instrument.

   Built from the member's own record first: a check-in run, sessions closed
   this week, nights logged in a row, their own sleep or water target met.
   Every figure is a count of their logs, never a judgement of a body or a
   health reading. When the record has nothing to say yet, one line from a
   small standing set in Reserve's voice.

   The line is chosen by the calendar day: the same inputs on the same day
   always give the same line, so it changes at most once a day, and only
   earlier when the member's own logs change what is true.

   Words it never uses: praise, direction of a body metric, health, safety,
   outcomes, exclamation (the log-moment banned list applies, and the test
   runs every line through it).

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type MotivationInput = {
  /** Today, "YYYY-MM-DD" in the member's time zone. */
  today: string;
  checkIn: { currentStreak: number; lastCheckInDate: string | null };
  /** Training days closed this week, and training days planned this week. */
  sessions: { done: number; planned: number };
  sleepLogs: ReadonlyArray<{ date: string; hours: number }>;
  sleepTargetHours: number;
  hydrationLogs: ReadonlyArray<{ date: string; oz: number }>;
  hydrationTargetOz: number;
};

export type MotivationLine = {
  id: string;
  text: string;
  /** "record": built from the member's logs. "standard": the standing set. */
  source: "record" | "standard";
};

/** The standing set: short, restrained, no promise, no claim. */
export const STANDARD_LINES: readonly string[] = [
  "The standard is set before the day begins.",
  "Quiet work, recorded honestly.",
  "Do the planned work. Log what happened.",
  "Precision today. Evidence tomorrow.",
  "Calm is a decision. Make it early.",
  "The record is built one entry at a time.",
];

/** Days since 1970-01-01 for a calendar date key. */
export function dayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(at.getUTCDate()).padStart(2, "0")}`;
}

/** Consecutive days with a log, counting back from today (or from yesterday when today has none yet). */
export function runOfDays(dates: ReadonlySet<string>, today: string): number {
  let start = dates.has(today) ? today : shiftKey(today, -1);
  let run = 0;
  while (dates.has(start) && run < 366) {
    run += 1;
    start = shiftKey(start, -1);
  }
  return run;
}

type Candidate = { id: string; text: string } | null;

function checkInLine(input: MotivationInput): Candidate {
  const { currentStreak, lastCheckInDate } = input.checkIn;
  /* A run is only current when the last check-in is today or yesterday. */
  const current = lastCheckInDate === input.today || lastCheckInDate === shiftKey(input.today, -1);
  if (!current || currentStreak < 3) return null;
  return { id: "check-in-run", text: `${currentStreak} days checked in, no gaps.` };
}

function sessionsLine(input: MotivationInput): Candidate {
  const { done, planned } = input.sessions;
  if (done < 1 || planned < 1) return null;
  return { id: "sessions-week", text: `${Math.min(done, planned)} of ${planned} sessions closed this week.` };
}

function sleepRunLine(input: MotivationInput): Candidate {
  const run = runOfDays(new Set(input.sleepLogs.filter((l) => l.hours > 0).map((l) => l.date)), input.today);
  if (run < 3) return null;
  return { id: "sleep-run", text: `${run} nights logged in a row.` };
}

/** Of the member's own last seven days, how many met their own target. */
function lastSeven<T extends { date: string }>(rows: ReadonlyArray<T>, today: string): T[] {
  const from = shiftKey(today, -6);
  return rows.filter((r) => r.date >= from && r.date <= today);
}

function sleepTargetLine(input: MotivationInput): Candidate {
  if (!(input.sleepTargetHours > 0)) return null;
  const nights = new Map<string, number>();
  for (const log of lastSeven(input.sleepLogs, input.today)) nights.set(log.date, log.hours);
  const met = [...nights.values()].filter((h) => h >= input.sleepTargetHours).length;
  if (nights.size < 5 || met < 3) return null;
  return { id: "sleep-target", text: `${input.sleepTargetHours} h sleep target met ${met} of ${nights.size} nights.` };
}

function waterTargetLine(input: MotivationInput): Candidate {
  if (!(input.hydrationTargetOz > 0)) return null;
  const days = new Map<string, number>();
  for (const log of lastSeven(input.hydrationLogs, input.today)) days.set(log.date, (days.get(log.date) ?? 0) + log.oz);
  const met = [...days.values()].filter((oz) => oz >= input.hydrationTargetOz).length;
  if (days.size < 5 || met < 3) return null;
  return { id: "water-target", text: `Water target met ${met} of ${days.size} days.` };
}

/** Fixed order; the day decides where in it the search starts. */
const RECORD_LINES = [checkInLine, sessionsLine, sleepRunLine, sleepTargetLine, waterTargetLine] as const;

export function pickMotivation(input: MotivationInput): MotivationLine {
  const day = dayIndex(input.today);
  const start = ((day % RECORD_LINES.length) + RECORD_LINES.length) % RECORD_LINES.length;
  for (let i = 0; i < RECORD_LINES.length; i += 1) {
    const line = RECORD_LINES[(start + i) % RECORD_LINES.length](input);
    if (line) return { ...line, source: "record" };
  }
  const index = ((day % STANDARD_LINES.length) + STANDARD_LINES.length) % STANDARD_LINES.length;
  return { id: `standard-${index}`, text: STANDARD_LINES[index], source: "standard" };
}
