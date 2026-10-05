/* ════════════════════════════════════════════════════════════════════════
   LOG RANK — the member's standing for keeping their own record.

   Rank is earned by the days a member logged recovery: sleep, water,
   mobility or a check-in. It is never earned by what the numbers say, and
   never by anything to do with compounds — Reserve rewards keeping an honest
   record, not taking more of anything or scoring "better".

   There is no penalty state. A broken streak is simply not mentioned.
   ════════════════════════════════════════════════════════════════════════ */

import type { RecoveryCommandState } from "./types";

export type RecoveryLogKind = "sleep" | "water" | "mobility" | "check-in";

export const RECOVERY_LOG_LABEL: Record<RecoveryLogKind, string> = {
  sleep: "Night logged",
  water: "Water logged",
  mobility: "Mobility logged",
  "check-in": "Check-in logged",
};

export type LogRank = { name: string; minDays: number; tier: number };

/** Days logged needed for each rank. Tier drives the insignia. */
export const LOG_RANKS: readonly LogRank[] = [
  { name: "Initiate", minDays: 0, tier: 0 },
  { name: "Operator", minDays: 3, tier: 1 },
  { name: "Specialist", minDays: 7, tier: 2 },
  { name: "Vanguard", minDays: 14, tier: 3 },
  { name: "Sentinel", minDays: 30, tier: 4 },
  { name: "Commander", minDays: 60, tier: 5 },
  { name: "Legend", minDays: 100, tier: 6 },
];

type LogState = Pick<RecoveryCommandState, "sleepLogs" | "hydrationLogs" | "mobilityLogs" | "stressCheckIns">;

function datesFor(state: LogState, kind: RecoveryLogKind): string[] {
  switch (kind) {
    case "sleep":
      return state.sleepLogs.map((l) => l.date);
    case "water":
      return state.hydrationLogs.map((l) => l.date);
    case "mobility":
      return state.mobilityLogs.map((l) => l.date);
    case "check-in":
      return state.stressCheckIns.map((l) => l.date);
  }
}

/** Every distinct day with at least one recovery log. */
export function loggedDays(state: LogState): Set<string> {
  const kinds: RecoveryLogKind[] = ["sleep", "water", "mobility", "check-in"];
  return new Set(kinds.flatMap((kind) => datesFor(state, kind)));
}

export function rankFor(days: number): LogRank {
  return [...LOG_RANKS].reverse().find((rank) => days >= rank.minDays) ?? LOG_RANKS[0];
}

export function nextRank(days: number): LogRank | null {
  return LOG_RANKS.find((rank) => rank.minDays > days) ?? null;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Consecutive days ending today with at least one log. Zero when today has none. */
export function logStreak(state: LogState, today: string): number {
  const days = loggedDays(state);
  let streak = 0;
  for (let day = today; days.has(day); day = previousDay(day)) streak += 1;
  return streak;
}

export type LogMomentEvent = {
  kind: RecoveryLogKind;
  headline: string;
  rankedUp: boolean;
  rank: LogRank;
  previousRank: LogRank;
  days: number;
  previousDays: number;
  next: LogRank | null;
  /** 0–1 progress toward the next rank, before and after this log. */
  progressBefore: number;
  progressAfter: number;
  streak: number;
};

function progress(days: number): number {
  const current = rankFor(days);
  const next = nextRank(days);
  if (!next) return 1;
  return (days - current.minDays) / (next.minDays - current.minDays);
}

/**
 * The moment for a log, or null when it doesn't deserve one. It plays for the
 * first log of a kind on a day, or when the log adds a day to the record — so
 * tapping "+ water" five times is one moment, not five.
 */
export function momentFor(kind: RecoveryLogKind, before: LogState, after: LogState, today: string): LogMomentEvent | null {
  const firstOfKindToday = !datesFor(before, kind).includes(today) && datesFor(after, kind).includes(today);
  const previousDays = loggedDays(before).size;
  const days = loggedDays(after).size;
  if (!firstOfKindToday && days <= previousDays) return null;

  const rank = rankFor(days);
  const previousRank = rankFor(previousDays);
  const rankedUp = rank.tier > previousRank.tier;
  return {
    kind,
    headline: rankedUp ? "Rank up" : RECOVERY_LOG_LABEL[kind],
    rankedUp,
    rank,
    previousRank,
    days,
    previousDays,
    next: nextRank(days),
    /* A rank up starts the bar from empty at the new rank. */
    progressBefore: rankedUp ? 0 : progress(previousDays),
    progressAfter: progress(days),
    streak: logStreak(after, today),
  };
}
