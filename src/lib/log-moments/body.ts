import type { PhotoCheckIn, PhysiqueEntry } from "@/lib/physique/types";
import { figure, joinDetail, type LogMilestone, type LogMomentContent, type LogMomentDetailPart } from "@/lib/ui/log-moment";

import { WEEK_STREAK_MARKS, reachedMark, weekStreak } from "./streaks";

/* ════════════════════════════════════════════════════════════════════════
   BODY LOG MOMENTS — a weigh-in, measurements, a progress photo check-in.

   Body measurements are the member's own entries and Reserve never reads a
   direction into them. The words state the value logged and nothing about
   the last one: no "down", no "up", no change, no praise. The weight does not
   count from the previous weigh-in either, because a number rolling down or
   up would say what the words refuse to.

   Milestones come from keeping the record, never from the numbers:
     first      the first check-in on the record
     weeks      weekly check-ins in a row reached 4, 8, 12, 26 or 52

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type BodyLogState = { entries: readonly PhysiqueEntry[]; photoCheckIns: readonly PhotoCheckIn[] };

const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function checkInDates(state: BodyLogState): string[] {
  return [...state.entries.map((e) => e.date), ...state.photoCheckIns.map((p) => p.date)];
}

export function resolveBodyMoment(before: BodyLogState, after: BodyLogState, today: string): LogMomentContent | null {
  const beforeEntries = new Set(before.entries.map((e) => e.id));
  const beforePhotos = new Set(before.photoCheckIns.map((p) => p.id));
  const entry = after.entries.find((e) => !beforeEntries.has(e.id)) ?? null;
  const photo = after.photoCheckIns.find((p) => !beforePhotos.has(p.id)) ?? null;
  if (!entry && !photo) return null;

  const weight = entry?.bodyWeightLb ?? photo?.bodyWeightLb;
  const weightPart: LogMomentDetailPart[] | null = weight && weight > 0 ? [figure(round1(weight), 1), " lb"] : null;
  const sites = entry ? Object.values(entry.measurements ?? {}).filter((v) => typeof v === "number" && v > 0).length : 0;
  const poses = photo ? photo.poses.length : 0;

  const streakBefore = weekStreak(checkInDates(before), today);
  const streak = weekStreak(checkInDates(after), today);
  const first = before.entries.length === 0 && before.photoCheckIns.length === 0;
  const mark = reachedMark(streakBefore, streak, WEEK_STREAK_MARKS);
  const milestone: LogMilestone | null = first
    ? { key: "first-check-in", headline: "First check-in.", intensity: 1.4 }
    : mark
      ? { key: `weeks-${mark}`, headline: `${mark} weeks of check-ins.`, intensity: 1.4 }
      : null;

  const lead = entry && photo ? "Check-in saved" : entry ? (weightPart ? "Weight logged" : "Measurements logged") : "Photo check-in saved";

  return {
    kind: entry ? (weightPart ? "weight" : "measurement") : "photo",
    tier: "full",
    tone: "log",
    lead,
    detail: joinDetail(
      weightPart,
      sites > 0 ? plural(sites, "site", "sites") : null,
      photo ? plural(Math.max(1, poses), "pose", "poses") : null,
      streak >= 2 ? `${streak} weeks in a row` : null,
    ),
    milestone,
  };
}
