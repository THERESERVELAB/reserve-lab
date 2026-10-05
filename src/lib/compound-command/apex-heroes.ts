/* ════════════════════════════════════════════════════════════════════════
   APEX HEROES — the member's main compounds and their cycle week, on Apex.

   The owner, 2026-09-18: "Make the hero compounds also show on my Apex
   dashboard as well. That is the root to all roads — the hero compounds. The
   system should know I'm on week 1 and when week 1 started as well."

   Apex reads the SAME hero list Compound Command's Today builds
   (`useCompoundToday` → `heroItems`): one source of slots and tiers. This
   file only reduces that list to compact tiles and states the cycle week by
   the member's own dates.

   THE HARD WALL (CLAUDE.md · constitution clinical-data.md): the member's own
   entries, their own times and their own dates. No amounts, no suggestions,
   no importance — heroes are ordered by today's planned time, then name. A
   mark is a neutral "Logged". The cycle week counts from the start date the
   member set, and only the member changes it.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import {
  daysBetween,
  isDateKey,
  plannedEndDate,
  resolveCycleState,
  selectCurrentCycle,
  type CyclePeriod,
} from "@/lib/cycle/cycle-period";

import { byTime, TIER_COPY, type MarkState, type TodayTier } from "./today-tiers";

/* ─── Dates ───────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function partsOf(key: string): { y: number; m: number; d: number; dow: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Sep 16" for a YYYY-MM-DD key. */
export function shortDate(key: string): string {
  const { m, d } = partsOf(key);
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * The next scheduled day for an entry that is not on today, relative to
 * `today`: "Tomorrow", a weekday within the week ("Fri"), else a date
 * ("Sep 30"). `long` is the spoken form for an accessible name.
 */
export function nextDayLabel(date: string, today: string): { short: string; long: string } | null {
  if (!isDateKey(date) || !isDateKey(today)) return null;
  const ahead = daysBetween(today, date);
  if (ahead < 0) return null;
  if (ahead === 0) return { short: "Today", long: "today" };
  if (ahead === 1) return { short: "Tomorrow", long: "tomorrow" };
  const { dow } = partsOf(date);
  if (ahead <= 6) return { short: WEEKDAYS_SHORT[dow], long: WEEKDAYS_LONG[dow] };
  return { short: shortDate(date), long: `${WEEKDAYS_LONG[dow]}, ${shortDate(date)}` };
}

/* ─── Tiles ───────────────────────────────────────────────────────────── */

/** One of the member's entries as Compound Command's Today already reads it. */
export type ApexHeroSource =
  | {
      kind: "today";
      slotId: string;
      entryId: string;
      name: string;
      tier: TodayTier;
      /** "HH:MM", or "—" when the member set no time. */
      plannedTime: string;
      plannedTimeLabel: string;
      state: MarkState;
      /** The entry Compound Command's one gold action logs. */
      upNext: boolean;
      siteNeeded: boolean;
    }
  | {
      kind: "off-day";
      entryId: string;
      name: string;
      tier: TodayTier;
      /** YYYY-MM-DD of the next scheduled day, or null when none is set. */
      nextDate: string | null;
    };

export type ApexHeroTile = {
  key: string;
  kind: "today" | "off-day";
  entryId: string;
  slotId: string | null;
  name: string;
  state: MarkState | "not-today";
  /** Compound Command's own state word ("Due", "Logged", "Next"). */
  word: string;
  /** The member's own time today, or the next scheduled day. */
  when: string | null;
  upNext: boolean;
  siteNeeded: boolean;
  /** The tile's accessible name. */
  label: string;
};

/** Compound Command's status words (TodayDay's MARK_WORDS), repeated here so the lib stays free of React. */
export const APEX_MARK_WORDS: Record<MarkState, string> = {
  logged: "Logged",
  skipped: "Skipped",
  due: "Due",
  missed: "Missed",
  upcoming: "Ready",
  review: "Review",
  paused: "Paused",
};

/** States whose time is worth printing on the tile. Logged, skipped and paused read from the word alone. */
const TIMED: ReadonlySet<MarkState> = new Set(["due", "missed", "upcoming", "review"]);

export const APEX_HERO_COPY = {
  heading: "Your compounds",
  next: "Next",
  notToday: TIER_COPY.notToday,
  siteNeeded: TIER_COPY.siteNeeded,
} as const;

/**
 * The main compounds as Apex tiles. Add-ons never appear. Today's entries
 * first, by the member's planned time then name; entries with nothing today
 * after them, each with its next scheduled day, by name. Never by importance.
 */
export function apexHeroTiles(items: readonly ApexHeroSource[], today: string): ApexHeroTile[] {
  const heroes = items.filter((item) => item.tier === "hero");
  const onToday = heroes.filter((item): item is Extract<ApexHeroSource, { kind: "today" }> => item.kind === "today").sort(byTime);
  const offDay = heroes
    .filter((item): item is Extract<ApexHeroSource, { kind: "off-day" }> => item.kind === "off-day")
    .sort((a, b) => a.name.localeCompare(b.name));

  /* A tile is ~100px wide on a phone, so it carries the state word and the
     member's time ("Due · 4:00 PM"). The entry Compound Command's gold logs
     keeps its "Up next" in the gold outline and in the tile's name. */
  const todayTiles = onToday.map((item): ApexHeroTile => {
    const word = APEX_MARK_WORDS[item.state];
    const when = TIMED.has(item.state) && item.plannedTime !== "—" ? item.plannedTimeLabel : null;
    return {
      key: item.slotId,
      kind: "today",
      entryId: item.entryId,
      slotId: item.slotId,
      name: item.name,
      state: item.state,
      word,
      when,
      upNext: item.upNext,
      siteNeeded: item.siteNeeded,
      label: [item.name, item.upNext ? TIER_COPY.upNext : null, word, when, item.siteNeeded ? TIER_COPY.siteNeeded : null].filter(Boolean).join(" · "),
    };
  });

  const offDayTiles = offDay.map((item): ApexHeroTile => {
    const next = item.nextDate ? nextDayLabel(item.nextDate, today) : null;
    return {
      key: `off-${item.entryId}`,
      kind: "off-day",
      entryId: item.entryId,
      slotId: null,
      name: item.name,
      state: "not-today",
      word: next ? APEX_HERO_COPY.next : APEX_HERO_COPY.notToday,
      when: next?.short ?? null,
      upNext: false,
      siteNeeded: false,
      label: [item.name, APEX_HERO_COPY.notToday, next ? `next ${next.long}` : null].filter(Boolean).join(" · "),
    };
  });

  return [...todayTiles, ...offDayTiles];
}

/* ─── The cycle, by the member's own dates ────────────────────────────── */

/*
   Owner, 2026-09-18: "CLIENT CHOOSES WHEN IT STARTS!" The week number comes
   from the start date the member set on the cycle and nothing else — never
   inferred from a compound's start date or from logs. The member changes it
   themselves ("Edit start"), through the cycle's own edit action.
*/

export type ApexCycleLine = {
  kind: "week" | "upcoming" | "past-end";
  cycleId: string;
  /** The member's own start date (YYYY-MM-DD), for the "Edit start" field. */
  startDate: string;
  line: string;
};

/**
 * One line for the member's current cycle, or null with no open cycle.
 *
 *   on cycle     "Week 1 of 12 · started Sep 16"
 *   not started  "Starts Sep 22 · in 4 days"
 *   past end     "Past planned end Aug 23 · started Jun 1"
 */
export function apexCycleLine(input: { cycles: readonly CyclePeriod[]; now: Date }): ApexCycleLine | null {
  const cycle = selectCurrentCycle([...input.cycles], input.now);
  if (!cycle || !isDateKey(cycle.startDate)) return null;
  const state = resolveCycleState(cycle, { now: input.now, compounds: [] });
  const started = shortDate(cycle.startDate);
  const base = { cycleId: cycle.id, startDate: cycle.startDate };

  if (state.phase === "on-cycle") {
    return { ...base, kind: "week", line: `Week ${state.weekNumber} of ${state.totalWeeks} · started ${started}` };
  }
  if (state.phase === "upcoming") {
    const days = state.daysUntilStart;
    return { ...base, kind: "upcoming", line: `Starts ${started} · in ${days} ${days === 1 ? "day" : "days"}` };
  }
  if (state.phase === "past-planned-end") {
    return { ...base, kind: "past-end", line: `Past planned end ${shortDate(plannedEndDate(cycle))} · started ${started}` };
  }
  return null;
}

export const CYCLE_START_COPY = {
  edit: "Edit start",
  sheetTitle: "Cycle start",
  field: "Start date",
  explainer: "The date you choose is the only thing Reserve counts your cycle weeks from.",
  save: "Save start date",
  invalid: "Choose a start date.",
} as const;
