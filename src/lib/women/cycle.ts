/* ────────────────────────────────────────────────────────────────────────────
   RESERVE WOMEN — CYCLE ENGINE

   Estimate-only. Every output is a calendar estimate built from dates the
   member entered or logged. It is NOT a medical prediction, a fertility
   window, conception timing or contraceptive guidance, and copy that shows
   these values must say "estimate".

   Honesty rules this file keeps (DESIGN_BIBLE §12):
   · No phase is estimated without a period start the member entered.
   · The 28/5-day figures are an ASSUMPTION until the member enters her own,
     and `cycleBasis` says which one is in use so the screen can say so.
   · No phase is projected past the days-between-periods basis. A date beyond
     it is "beyond the estimate", never a guessed day in a guessed next cycle.
   · Phase descriptions are definitions of the calendar model, not claims
     about how a body feels. What a phase looks like for THIS member comes
     from her own logs, grouped by `groupByEstimatedPhase`.
   · No fertile window. It was removed: a date range labelled "fertile" is
     conception timing or contraception by another name.

   Pure: no React, no store.
   ──────────────────────────────────────────────────────────────────────── */

import { localDateKey, localDateKeyOffset } from "@/lib/dates/local-day";

import type { CycleLogEntry, CyclePhase, CycleProfile, EnergyLevel, StressLevel, TrainingPerformanceTrend } from "./types";

/** Used only until the member enters her own. Screens must name it as assumed. */
export const ASSUMED_DAYS_BETWEEN_STARTS = 28;
export const ASSUMED_PERIOD_DAYS = 5;

/** Bounds the entry form accepts. Outside them the form asks again rather than guessing. */
export const DAYS_BETWEEN_STARTS_RANGE = { min: 21, max: 45 } as const;
export const PERIOD_DAYS_RANGE = { min: 2, max: 10 } as const;

/** A period day this long after the current start is treated as a new start. */
const NEW_START_GAP_DAYS = PERIOD_DAYS_RANGE.max + 1;

export type CyclePhaseMeta = {
  key: CyclePhase;
  label: string;
  /** Closed-palette tone. Never red: red is alerts only (Bible §09). */
  color: string;
  /** What the calendar model counts as this phase. A definition, not a claim. */
  definition: string;
};

export const CYCLE_PHASE_META: Record<CyclePhase, CyclePhaseMeta> = {
  menstrual: {
    key: "menstrual",
    label: "Menstrual",
    color: "#a78bfa",
    definition: "From your period start through the period days entered.",
  },
  follicular: {
    key: "follicular",
    label: "Follicular",
    color: "#5fb7d5",
    definition: "From the end of your period to the mid-cycle estimate.",
  },
  ovulation: {
    key: "ovulation",
    label: "Ovulation",
    color: "#e8c87a",
    definition: "Three days around the mid-cycle estimate, counted back from your next start.",
  },
  luteal: {
    key: "luteal",
    label: "Luteal",
    color: "#8ea0b8",
    definition: "From the mid-cycle estimate to your next estimated start.",
  },
};

export const CYCLE_PHASE_ORDER: CyclePhase[] = ["menstrual", "follicular", "ovulation", "luteal"];

/* ─── Dates ─────────────────────────────────────────────────────────────── */

/** The member's local day, YYYY-MM-DD — the shared helper, never `toISOString` (UTC). */
export function localISODate(d: Date): string {
  return localDateKey(d);
}

/** Kept for existing callers. Local, not UTC. */
export const toISODate = localISODate;

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Whole calendar days from `fromISO` to `toISO` (negative when `toISO` is earlier). DST-safe by rounding. */
export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}

export function addDaysISO(iso: string, days: number): string {
  return localDateKeyOffset(parseISO(iso), days);
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Basis ─────────────────────────────────────────────────────────────── */

export type CycleBasis = {
  daysBetweenStarts: number;
  periodDays: number;
  /** True only when the member entered both figures herself. */
  entered: boolean;
};

export function cycleBasis(cycle: CycleProfile): CycleBasis {
  if (!cycle.lengthsEnteredAt) {
    return { daysBetweenStarts: ASSUMED_DAYS_BETWEEN_STARTS, periodDays: ASSUMED_PERIOD_DAYS, entered: false };
  }
  const clamp = (n: number, lo: number, hi: number, fallback: number) => (Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback);
  return {
    daysBetweenStarts: clamp(cycle.averageCycleLengthDays, DAYS_BETWEEN_STARTS_RANGE.min, DAYS_BETWEEN_STARTS_RANGE.max, ASSUMED_DAYS_BETWEEN_STARTS),
    periodDays: clamp(cycle.averagePeriodLengthDays, PERIOD_DAYS_RANGE.min, PERIOD_DAYS_RANGE.max, ASSUMED_PERIOD_DAYS),
    entered: true,
  };
}

export type PhaseSpan = { phase: CyclePhase; firstDay: number; lastDay: number };

/** The calendar model's day ranges for one cycle on this basis. Every day 1..N belongs to exactly one span. */
export function phaseSpans(basis: CycleBasis): PhaseSpan[] {
  const n = basis.daysBetweenStarts;
  const midCycle = n - 14;
  const menstrualEnd = Math.min(basis.periodDays, midCycle - 2);
  return [
    { phase: "menstrual", firstDay: 1, lastDay: menstrualEnd },
    { phase: "follicular", firstDay: menstrualEnd + 1, lastDay: midCycle - 2 },
    { phase: "ovulation", firstDay: midCycle - 1, lastDay: midCycle + 1 },
    { phase: "luteal", firstDay: midCycle + 2, lastDay: n },
  ].filter((span) => span.lastDay >= span.firstDay) as PhaseSpan[];
}

export function phaseForCycleDay(day: number, basis: CycleBasis): CyclePhase | null {
  if (day < 1 || day > basis.daysBetweenStarts) return null;
  return phaseSpans(basis).find((span) => day >= span.firstDay && day <= span.lastDay)?.phase ?? null;
}

/* ─── Period starts ─────────────────────────────────────────────────────── */

/**
 * Every period start the member gave Reserve, oldest first: the date she
 * entered, plus each logged period day whose previous logged period day is
 * more than a period away. Nothing is inferred between them.
 */
export function periodStarts(cycle: CycleProfile, logs: readonly CycleLogEntry[]): string[] {
  const periodDays = [...new Set(logs.filter((l) => l.isPeriodDay && isISODate(l.date)).map((l) => l.date))].sort();
  const starts = new Set<string>();
  let previous: string | null = null;
  for (const day of periodDays) {
    if (previous === null || daysBetweenISO(previous, day) >= NEW_START_GAP_DAYS) starts.add(day);
    previous = day;
  }
  if (isISODate(cycle.lastPeriodStart)) {
    const entered = cycle.lastPeriodStart;
    /* A logged period day a few days either side of the entered start is the
       same period, not a second start. The date she entered wins. */
    for (const s of [...starts]) {
      const gap = Math.abs(daysBetweenISO(entered, s));
      if (gap > 0 && gap < NEW_START_GAP_DAYS) starts.delete(s);
    }
    starts.add(entered);
  }
  return [...starts].sort();
}

/** Days between consecutive starts the member gave. Observed, not averaged into anything. */
export function observedIntervals(starts: readonly string[]): { from: string; to: string; days: number }[] {
  const out: { from: string; to: string; days: number }[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    out.push({ from: starts[i - 1], to: starts[i], days: daysBetweenISO(starts[i - 1], starts[i]) });
  }
  return out;
}

/* ─── Estimates ─────────────────────────────────────────────────────────── */

export type CyclePhaseEstimate = {
  phase: CyclePhase | null;
  /** Day 1 is the period start. Null without a start on or before the date. */
  dayOfCycle: number | null;
  /** True when a phase was estimated from a real start. */
  estimated: boolean;
  /** The date is past the basis: no phase is guessed. */
  beyondEstimate: boolean;
  /** The start this estimate counts from. */
  start: string | null;
  basis: CycleBasis;
};

/**
 * Whether the cycle-phase lens may be shown at all.
 *
 * It replaced four women's rooms, so it now appears inside commands every
 * member opens. Two conditions, both required: she is on the women's path, and
 * a period start exists. Without a start there is no phase to estimate, and
 * rows reading "evidence needed" inside a command opened for something else are
 * noise rather than help.
 *
 * Pure so it can be tested without a React harness — this repo unit-tests lib
 * logic and covers rendering with Playwright.
 */
export function phaseLensVisible(input: {
  genderIdentity?: string | null;
  womensEnabled?: boolean;
  starts: readonly string[];
}): boolean {
  const womensPath = input.genderIdentity === "female" || input.womensEnabled === true;
  return womensPath && input.starts.length > 0;
}

export function estimatePhaseOn(dateISO: string, cycle: CycleProfile, starts: readonly string[]): CyclePhaseEstimate {
  const basis = cycleBasis(cycle);
  const start = [...starts].reverse().find((s) => daysBetweenISO(s, dateISO) >= 0) ?? null;
  if (!start) return { phase: null, dayOfCycle: null, estimated: false, beyondEstimate: false, start: null, basis };
  const day = daysBetweenISO(start, dateISO) + 1;
  const phase = phaseForCycleDay(day, basis);
  return { phase, dayOfCycle: day, estimated: phase !== null, beyondEstimate: phase === null, start, basis };
}

export function estimateCurrentPhase(
  cycle: CycleProfile,
  today: Date = new Date(),
  logs: readonly CycleLogEntry[] = [],
): CyclePhaseEstimate {
  return estimatePhaseOn(localISODate(today), cycle, periodStarts(cycle, logs));
}

export type CyclePrediction = {
  /** The start after the current one, on the basis in use. Null past the basis or without a start. */
  nextPeriodDate: string | null;
  daysUntilNextPeriod: number | null;
  estimated: boolean;
};

/** Calendar estimate of the next start only. Never a window, never more than one cycle ahead. */
export function predictCycle(cycle: CycleProfile, today: Date = new Date(), logs: readonly CycleLogEntry[] = []): CyclePrediction {
  const estimate = estimateCurrentPhase(cycle, today, logs);
  if (!estimate.start || !estimate.estimated) return { nextPeriodDate: null, daysUntilNextPeriod: null, estimated: false };
  const next = addDaysISO(estimate.start, estimate.basis.daysBetweenStarts);
  return { nextPeriodDate: next, daysUntilNextPeriod: daysBetweenISO(localISODate(today), next), estimated: true };
}

/* ─── The member's own logs, by estimated phase ─────────────────────────── */

export type PhaseGroup<T> = { phase: CyclePhase; items: T[] };

/** Sorts dated items into the phase estimated for each date. Dates with no estimate are left out. */
export function groupByEstimatedPhase<T extends { date: string }>(
  items: readonly T[],
  cycle: CycleProfile,
  starts: readonly string[],
): PhaseGroup<T>[] {
  const groups = new Map<CyclePhase, T[]>(CYCLE_PHASE_ORDER.map((p) => [p, []]));
  for (const item of items) {
    if (!isISODate(item.date)) continue;
    const phase = estimatePhaseOn(item.date, cycle, starts).phase;
    if (phase) groups.get(phase)!.push(item);
  }
  return CYCLE_PHASE_ORDER.map((phase) => ({ phase, items: groups.get(phase)! }));
}

/** The answer given most often, or null when nothing was logged. Ties go to the first in `order`. */
export function mostLogged<T extends string>(values: readonly (T | undefined)[], order: readonly T[]): { value: T; count: number; of: number } | null {
  const present = values.filter((v): v is T => v !== undefined);
  if (present.length === 0) return null;
  let best: T = order[0];
  let bestCount = -1;
  for (const option of order) {
    const count = present.filter((v) => v === option).length;
    if (count > bestCount) {
      best = option;
      bestCount = count;
    }
  }
  return { value: best, count: bestCount, of: present.length };
}

export const ENERGY_ORDER: EnergyLevel[] = ["low", "moderate", "high"];
export const STRESS_ORDER: StressLevel[] = ["low", "moderate", "high"];
export const TRAINING_FELT_ORDER: TrainingPerformanceTrend[] = ["down", "steady", "up"];

export const TRAINING_FELT_LABEL: Record<TrainingPerformanceTrend, string> = {
  down: "Harder than usual",
  steady: "About usual",
  up: "Better than usual",
};

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

/* ─── Logging a day ─────────────────────────────────────────────────────── */

/**
 * What a day log changes. The entry replaces any earlier entry for the same
 * date (one entry per day), and a period day far enough from the current
 * start becomes the new period start. Nothing else is inferred.
 */
export function planDayLog(
  entry: Omit<CycleLogEntry, "id">,
  cycle: CycleProfile,
  logs: readonly CycleLogEntry[],
): { replaceIds: string[]; newPeriodStart: string | null } {
  const replaceIds = logs.filter((l) => l.date === entry.date).map((l) => l.id);
  if (!entry.isPeriodDay) return { replaceIds, newPeriodStart: null };
  const current = cycle.lastPeriodStart;
  if (!isISODate(current)) return { replaceIds, newPeriodStart: entry.date };
  const gap = daysBetweenISO(current, entry.date);
  return { replaceIds, newPeriodStart: gap >= NEW_START_GAP_DAYS ? entry.date : null };
}
