import { loggedDays, rankFor, type RecoveryLogKind } from "@/lib/recovery/log-rank";
import type { RecoveryCommandState } from "@/lib/recovery/types";
import { figure, joinDetail, type LogMilestone, type LogMomentContent } from "@/lib/ui/log-moment";

import { DAY_STREAK_MARKS, dayStreak, inLastSevenDays, reachedMark } from "./streaks";

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY LOG MOMENTS — sleep, water, mobility and the recovery check-in.

   Every word is a fact from the member's own record: the value they logged,
   today's running total against the target they set, how many days in a row
   they have logged. Nothing here judges a night, a total or a trend.

   Milestones, strongest first (one per log):
     rank up        the log added a day that moved the recovery record's rank
     streak         a run of days logged reached 3, 7, 14, 30, 60 or 100
     target         the log carried today across the member's own target
                    (sleep hours, water ounces, weekly mobility sessions)

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type RecoveryLogState = Pick<
  RecoveryCommandState,
  "sleepLogs" | "hydrationLogs" | "mobilityLogs" | "stressCheckIns" | "sleepTargetHours" | "hydrationTargetOz" | "mobilityWeeklyTarget"
>;

const round1 = (n: number) => Math.round(n * 10) / 10;

function rankUp(before: RecoveryLogState, after: RecoveryLogState): LogMilestone | null {
  const was = rankFor(loggedDays(before).size);
  const now = rankFor(loggedDays(after).size);
  if (now.tier <= was.tier) return null;
  return { key: `rank-${now.name.toLowerCase()}`, headline: `${now.name} rank.`, intensity: 1.7 };
}

function streakMilestone(before: number, after: number, noun: string): LogMilestone | null {
  const mark = reachedMark(before, after, DAY_STREAK_MARKS);
  return mark ? { key: `streak-${mark}`, headline: `${mark} ${noun} in a row.`, intensity: 1.4 } : null;
}

const inARow = (streak: number, noun: string) => (streak >= 2 ? `${streak} ${noun} in a row` : null);

export function resolveSleepMoment(before: RecoveryLogState, after: RecoveryLogState, today: string): LogMomentContent | null {
  /* The night this save wrote: a new or replaced entry (the store replaces the object). */
  const entry = after.sleepLogs.find((log) => !before.sleepLogs.includes(log)) ?? after.sleepLogs.find((log) => log.date === today);
  if (!entry || !(entry.hours > 0)) return null;
  const previous = before.sleepLogs.find((log) => log.date === entry.date);
  /* Saving the same night again is a quiet mark, never a second milestone. */
  const updated = Boolean(previous);
  const end = entry.date > today ? entry.date : today;
  const streakBefore = dayStreak(before.sleepLogs.map((l) => l.date), end);
  const streak = dayStreak(after.sleepLogs.map((l) => l.date), end);
  const target = before.sleepTargetHours;
  const reachedTarget = target > 0 && entry.hours >= target && !(previous && previous.hours >= target);

  const milestone = updated
    ? null
    : rankUp(before, after) ??
      streakMilestone(streakBefore, streak, "nights") ??
      (reachedTarget ? { key: "sleep-target", headline: "Sleep target reached.", intensity: 1.4 } : null);

  return {
    kind: "sleep",
    tier: updated ? "mark" : "full",
    tone: "log",
    lead: updated ? "Sleep updated" : "Sleep logged",
    /* A streak milestone's headline already names the run. */
    detail: joinDetail([figure(round1(entry.hours), 1), " h"], milestone?.key.startsWith("streak-") ? null : inARow(streak, "nights")),
    milestone,
  };
}

export function resolveWaterMoment(before: RecoveryLogState, after: RecoveryLogState, today: string): LogMomentContent | null {
  if (after.hydrationLogs.length <= before.hydrationLogs.length) return null;
  const entry = after.hydrationLogs[after.hydrationLogs.length - 1];
  if (!entry || !(entry.oz > 0)) return null;
  const total = (state: RecoveryLogState) => Math.round(state.hydrationLogs.filter((l) => l.date === today).reduce((sum, l) => sum + l.oz, 0));
  const was = total(before);
  const now = total(after);
  const target = Math.round(after.hydrationTargetOz);
  const reachedTarget = target > 0 && was < target && now >= target;

  const milestone = rankUp(before, after) ?? (reachedTarget ? { key: "hydration-target", headline: "Hydration target reached.", intensity: 1.4 } : null);

  return {
    kind: "water",
    /* A single glass is a mark; the glass that reaches the day's target is the full moment. */
    tier: milestone ? "full" : "mark",
    tone: "log",
    lead: "Water logged",
    detail: joinDetail(`+${Math.round(entry.oz)} oz`, [figure(now, 0, was), target > 0 ? ` of ${target} oz today` : " oz today"]),
    milestone,
  };
}

export function resolveMobilityMoment(before: RecoveryLogState, after: RecoveryLogState, today: string): LogMomentContent | null {
  if (after.mobilityLogs.length <= before.mobilityLogs.length) return null;
  const entry = after.mobilityLogs[after.mobilityLogs.length - 1];
  if (!entry) return null;
  const week = (state: RecoveryLogState) => state.mobilityLogs.filter((l) => inLastSevenDays(l.date, today)).length;
  const was = week(before);
  const now = week(after);
  const target = Math.round(after.mobilityWeeklyTarget);
  const reachedTarget = target > 0 && was < target && now >= target;

  const milestone = rankUp(before, after) ?? (reachedTarget ? { key: "mobility-target", headline: "Weekly mobility target reached.", intensity: 1.4 } : null);

  return {
    kind: "mobility",
    tier: milestone ? "full" : "mark",
    tone: "log",
    lead: entry.kind === "walk" ? "Walk logged" : "Mobility logged",
    detail: joinDetail(entry.minutes > 0 ? `${Math.round(entry.minutes)} min` : null, [figure(now, 0, was), target > 0 ? ` of ${target} this week` : " this week"]),
    milestone,
  };
}

export function resolveCheckInMoment(before: RecoveryLogState, after: RecoveryLogState, today: string): LogMomentContent | null {
  const entry = after.stressCheckIns.find((c) => !before.stressCheckIns.includes(c)) ?? after.stressCheckIns.find((c) => c.date === today);
  if (!entry) return null;
  const updated = before.stressCheckIns.some((c) => c.date === entry.date);
  const streakBefore = dayStreak(before.stressCheckIns.map((c) => c.date), today);
  const streak = dayStreak(after.stressCheckIns.map((c) => c.date), today);
  const milestone = updated ? null : rankUp(before, after) ?? streakMilestone(streakBefore, streak, "days");
  return {
    kind: "check-in",
    tier: updated ? "mark" : "full",
    tone: "log",
    lead: updated ? "Check-in updated" : "Check-in logged",
    detail: joinDetail(milestone?.key.startsWith("streak-") ? null : inARow(streak, "days")),
    milestone,
  };
}

/** The moment for one recovery log, or null when the write changed nothing it can name. */
export function resolveRecoveryMoment(kind: RecoveryLogKind, before: RecoveryLogState, after: RecoveryLogState, today: string): LogMomentContent | null {
  switch (kind) {
    case "sleep":
      return resolveSleepMoment(before, after, today);
    case "water":
      return resolveWaterMoment(before, after, today);
    case "mobility":
      return resolveMobilityMoment(before, after, today);
    case "check-in":
      return resolveCheckInMoment(before, after, today);
  }
}
