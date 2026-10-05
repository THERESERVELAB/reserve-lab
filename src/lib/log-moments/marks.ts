import { figure, joinDetail, type LogMilestone, type LogMomentContent } from "@/lib/ui/log-moment";

import { DAY_STREAK_MARKS, reachedMark } from "./streaks";

/* ════════════════════════════════════════════════════════════════════════
   EVERYDAY LOG MOMENTS — the day's check-in, a note, a done mark, a
   compound or supplement mark.

   Compound and supplement marks are the strictest: the words are "Logged"
   and nothing else. No name, no count, no streak, no milestone, never the
   full tier. Recording is not endorsing.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

/** A compound or supplement taken / skipped / site mark. Always the same neutral mark. */
export function compoundMarkMoment(): LogMomentContent {
  return { kind: "compound", tier: "mark", tone: "log", lead: "Logged", detail: [], milestone: null };
}

export type DailyCheckInState = { currentStreak: number; lastCheckInDate: string | null };

/** "Mark Today as Checked In" on Apex: the day's check-in and the run of days behind it. */
export function resolveDailyCheckInMoment(before: DailyCheckInState, after: DailyCheckInState, today: string): LogMomentContent {
  const already = before.lastCheckInDate === today;
  if (already) {
    return { kind: "check-in", tier: "mark", tone: "log", lead: "Already checked in today", detail: joinDetail(streakLine(after.currentStreak)), milestone: null };
  }
  const was = before.lastCheckInDate ? before.currentStreak : 0;
  const now = Math.max(1, after.currentStreak);
  const mark = reachedMark(was, now, DAY_STREAK_MARKS);
  const milestone: LogMilestone | null = mark ? { key: `streak-${mark}`, headline: `${mark} days in a row.`, intensity: mark >= 30 ? 1.7 : 1.4 } : null;
  return {
    kind: "check-in",
    tier: "full",
    tone: "log",
    lead: "Checked in",
    /* The day count ticks over from yesterday's. A milestone's headline already says it. */
    detail: milestone ? [] : now >= 2 ? ["Day ", figure(now, 0, now - 1), " in a row"] : ["Day 1"],
    milestone,
  };
}

const streakLine = (streak: number) => (streak >= 2 ? `Day ${streak} in a row` : null);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(key: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}

/** A note on the member's own timeline. Their record, never read by Reserve: no milestone. */
export function timelineNoteMoment(input: { date: string; total: number }): LogMomentContent {
  const when = shortDate(input.date);
  return {
    kind: "journal",
    tier: "full",
    tone: "log",
    lead: "Note saved",
    detail: joinDetail(when ? `Timeline · ${when}` : "Timeline", input.total > 1 ? `${input.total} notes` : null),
    milestone: null,
  };
}

/** An observation on the timeline: timing only. A quiet mark. */
export function observationMoment(): LogMomentContent {
  return { kind: "journal", tier: "mark", tone: "log", lead: "Observation saved", detail: ["Timing only"], milestone: null };
}

/** A planned item marked done (or back to not done) in Schedule, Recovery or Apex. */
export function doneMarkMoment(input: { label: string; done: boolean; detail?: string | null }): LogMomentContent {
  return {
    kind: "schedule",
    tier: "mark",
    tone: input.done ? "log" : "clear",
    lead: input.done ? `${input.label} done` : `${input.label} not done`,
    detail: joinDetail(input.detail ?? null),
    milestone: null,
  };
}

/** A lifestyle-week day recorded as done or skipped. Skipping is recorded, never judged. */
export function activityDayMoment(input: { label: string; status: "done" | "skipped" }): LogMomentContent {
  return {
    kind: "activity",
    tier: "mark",
    tone: input.status === "done" ? "log" : "clear",
    lead: input.status === "done" ? `${input.label} done` : `${input.label} skipped`,
    detail: [],
    milestone: null,
  };
}

/** Steps saved for the day: the count counts from what was there before. */
export function stepsMoment(input: { before: number; after: number }): LogMomentContent {
  return {
    kind: "activity",
    tier: "mark",
    tone: "log",
    lead: "Steps logged",
    detail: [figure(Math.max(0, Math.round(input.after)), 0, Math.max(0, Math.round(input.before))), " steps today"],
    milestone: null,
  };
}

/** A drink from the hydration bar. */
export function drinkMoment(input: { name: string }): LogMomentContent {
  return { kind: "water", tier: "mark", tone: "log", lead: "Drink logged", detail: joinDetail(input.name.trim() || null), milestone: null };
}

/** A custom plan's session marked complete. */
export function customSessionMoment(input: { dayName: string }): LogMomentContent {
  return { kind: "training", tier: "mark", tone: "log", lead: "Session marked complete", detail: joinDetail(input.dayName.trim() || null), milestone: null };
}
