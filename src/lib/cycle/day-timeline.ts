/* ════════════════════════════════════════════════════════════════════════
   DAY TIMELINE — the member's day as one track, not a list.

   Everything that has a time on it — the compounds due today, meals, the
   session, the wind-down and lights out — placed on a single line from the
   start of the day to the end of it, with the current moment marked.

   Pure placement: it reads the same schedule the hero and Today read, and
   never invents a time, a compound or a status. A slot with no planned time
   is carried as "unplaced" rather than guessed at.
   ════════════════════════════════════════════════════════════════════════ */

export type TimelineKind = "compound" | "meal" | "training" | "wake" | "wind-down" | "sleep";

/** Where a mark sits against now: done and logged, due, missed, or still ahead. */
export type TimelineState = "done" | "due" | "missed" | "ahead" | "passed";

export type TimelineMark = {
  id: string;
  kind: TimelineKind;
  label: string;
  /** Minutes from midnight. */
  atMin: number;
  /** "HH:MM", the same string the schedule uses. */
  at: string;
  state: TimelineState;
  /** 0–1 across the day's window, for placing it on the track. */
  pct: number;
  /** Compounds only: the slot this mark came from, so a tap can log it. */
  slotId?: string;
  detail?: string;
};

export type DayTimeline = {
  /** The window the track spans, in minutes from midnight. */
  startMin: number;
  endMin: number;
  marks: TimelineMark[];
  /** Compounds due today with no planned time — shown beside the track, never guessed onto it. */
  unplaced: Array<{ id: string; label: string; slotId: string }>;
  now: { atMin: number; pct: number; label: string };
  /** The next thing due, and how far off it is. */
  next: { mark: TimelineMark; inMinutes: number } | null;
  /** How the day is going: compounds logged out of compounds due. */
  logged: { done: number; total: number };
};

export type TimelineInput = {
  /** Minutes from midnight, the screen's own clock. */
  nowMin: number;
  /** Compounds due today, from the one schedule every surface reads. */
  compounds: Array<{ id: string; slotId: string; label: string; at: string | null; state: TimelineState; detail?: string }>;
  meals: Array<{ id: string; label: string; at: string | null }>;
  training: { label: string; at: string | null } | null;
  wakeTime?: string;
  windDownTime?: string;
  sleepTime?: string;
};

export function minutesOf(time: string | null | undefined): number | null {
  const m = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < 1440 ? mins : null;
}

export function hhmm(min: number): string {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** A meal or anchor that has already happened reads as passed, not missed: only a compound can be missed. */
function anchorState(atMin: number, nowMin: number): TimelineState {
  return atMin <= nowMin ? "passed" : "ahead";
}

export function buildDayTimeline(input: TimelineInput): DayTimeline {
  const marks: TimelineMark[] = [];
  const unplaced: DayTimeline["unplaced"] = [];

  for (const c of input.compounds) {
    const atMin = minutesOf(c.at);
    if (atMin === null) {
      unplaced.push({ id: c.id, label: c.label, slotId: c.slotId });
      continue;
    }
    marks.push({ id: c.id, kind: "compound", label: c.label, atMin, at: hhmm(atMin), state: c.state, pct: 0, slotId: c.slotId, detail: c.detail });
  }
  for (const meal of input.meals) {
    const atMin = minutesOf(meal.at);
    if (atMin !== null) marks.push({ id: meal.id, kind: "meal", label: meal.label, atMin, at: hhmm(atMin), state: anchorState(atMin, input.nowMin), pct: 0 });
  }
  const trainingAt = minutesOf(input.training?.at ?? null);
  if (input.training && trainingAt !== null) {
    marks.push({ id: "training", kind: "training", label: input.training.label, atMin: trainingAt, at: hhmm(trainingAt), state: anchorState(trainingAt, input.nowMin), pct: 0 });
  }
  const wake = minutesOf(input.wakeTime);
  if (wake !== null) marks.push({ id: "wake", kind: "wake", label: "Wake", atMin: wake, at: hhmm(wake), state: anchorState(wake, input.nowMin), pct: 0 });
  const windDown = minutesOf(input.windDownTime);
  if (windDown !== null) marks.push({ id: "wind-down", kind: "wind-down", label: "Wind down", atMin: windDown, at: hhmm(windDown), state: anchorState(windDown, input.nowMin), pct: 0 });
  const sleep = minutesOf(input.sleepTime);
  if (sleep !== null) marks.push({ id: "sleep", kind: "sleep", label: "Lights out", atMin: sleep, at: hhmm(sleep), state: anchorState(sleep, input.nowMin), pct: 0 });

  marks.sort((a, b) => a.atMin - b.atMin || a.label.localeCompare(b.label));

  /* The window holds the whole day plus the moment itself, with a little air at each end. */
  const times = [...marks.map((m) => m.atMin), input.nowMin];
  const startMin = Math.max(0, Math.min(...times) - 30);
  const endMin = Math.min(1439, Math.max(...times) + 30);
  const span = Math.max(1, endMin - startMin);
  const place = (min: number) => Math.min(1, Math.max(0, (min - startMin) / span));
  for (const mark of marks) mark.pct = place(mark.atMin);

  const upcoming = marks.filter((m) => m.atMin > input.nowMin && m.state !== "done");
  const dueNow = marks.find((m) => m.kind === "compound" && m.state === "due");
  const nextMark = dueNow ?? upcoming[0] ?? null;
  const compounds = marks.filter((m) => m.kind === "compound");

  return {
    startMin,
    endMin,
    marks,
    unplaced,
    now: { atMin: input.nowMin, pct: place(input.nowMin), label: hhmm(input.nowMin) },
    next: nextMark ? { mark: nextMark, inMinutes: Math.max(0, nextMark.atMin - input.nowMin) } : null,
    logged: { done: compounds.filter((m) => m.state === "done").length, total: compounds.length + unplaced.length },
  };
}

/** "in 40 min", "in 2 h 10", "now". */
export function inWords(minutes: number): string {
  if (minutes <= 5) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m}`;
}
