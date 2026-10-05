/* ════════════════════════════════════════════════════════════════════════
   ADHERENCE ENGINE — planned week vs the week that actually happened.

   Compares the scheduled rotation against actual activity records (explicit
   member check-offs plus auto-reconciled completed training sessions),
   then looks across recent weeks for REPEATED divergence. Inconsistencies
   are surfaced constructively — the point is a schedule the member actually
   runs, not a compliance score. Recommendations are ranked proposals only.
   ════════════════════════════════════════════════════════════════════════ */

import { rankCandidates, scoreCandidate, type ScoreFactor } from "./scoring";
import {
  TRAINING_ACTIVITY_TYPES,
  rotationDayLabel,
  type ActualWeekRecord,
  type LifestyleSchedule,
  type RankedRecommendation,
  type ScheduleProposal,
  type MovementSelectionRecord,
} from "./types";
import type { ProgramDefinition, ProgramDayDefinition } from "@/lib/program/types";

export type DayComparison = {
  dayIndex: number;
  label: string;
  plannedTitles: string[];
  completedTitles: string[];
  skippedTitles: string[];
  unplannedTitles: string[];
  state: "matched" | "partial" | "missed" | "off-plan" | "quiet";
};

export type WeekComparison = {
  weekKey: string;
  days: DayComparison[];
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  unplannedCount: number;
  /** 0..1 share of planned training items completed — displayed as fraction, not fake %. */
  adherence: number | null;
};

/** Map an actual-record ISO date to a rotation day index for 7-day plans. */
export function rotationIndexForDate(schedule: LifestyleSchedule, isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00`);
  const weekday = (d.getDay() + 6) % 7; // Mon=0
  if (schedule.rotationLengthDays === 7) {
    return (weekday - schedule.weekAnchor + 7) % 7;
  }
  // Non-7 rotations have no stable calendar mapping — bucket by weekday order.
  return weekday % schedule.rotationLengthDays;
}

export function compareWeek(
  schedule: LifestyleSchedule,
  actual: ActualWeekRecord,
): WeekComparison {
  const rotation = Math.max(1, schedule.rotationLengthDays);
  const days: DayComparison[] = Array.from({ length: rotation }, (_, i) => ({
    dayIndex: i,
    label: rotationDayLabel(schedule, i),
    plannedTitles: [],
    completedTitles: [],
    skippedTitles: [],
    unplannedTitles: [],
    state: "quiet",
  }));

  for (const a of schedule.activities) {
    if (!TRAINING_ACTIVITY_TYPES.has(a.type)) continue;
    days[a.dayIndex % rotation]?.plannedTitles.push(a.title);
  }

  const plannedIds = new Set(schedule.activities.map((a) => a.id));
  for (const r of actual.records) {
    const idx = rotationIndexForDate(schedule, r.date);
    const day = days[idx];
    if (!day) continue;
    if (r.status === "completed" || r.status === "partial") {
      if (r.plannedActivityId && plannedIds.has(r.plannedActivityId)) day.completedTitles.push(r.title);
      else day.unplannedTitles.push(r.title);
    } else if (r.status === "skipped") {
      day.skippedTitles.push(r.title);
    }
  }

  let planned = 0, completed = 0, skipped = 0, unplanned = 0;
  for (const day of days) {
    planned += day.plannedTitles.length;
    completed += day.completedTitles.length;
    skipped += day.skippedTitles.length;
    unplanned += day.unplannedTitles.length;
    day.state =
      day.plannedTitles.length === 0 && day.unplannedTitles.length === 0 ? "quiet"
      : day.plannedTitles.length === 0 ? "off-plan"
      : day.completedTitles.length >= day.plannedTitles.length ? "matched"
      : day.completedTitles.length > 0 ? "partial"
      : day.skippedTitles.length > 0 ? "missed"
      : "quiet";
  }

  return {
    weekKey: actual.weekKey,
    days,
    plannedCount: planned,
    completedCount: completed,
    skippedCount: skipped,
    unplannedCount: unplanned,
    adherence: planned > 0 ? Math.min(1, completed / planned) : null,
  };
}

/* ─── Repeated-pattern detection across weeks ────────────────────────────── */

export type AdherencePattern = {
  id: string;
  title: string;
  detail: string;
  weeksObserved: number;
};

export function detectAdherencePatterns(
  schedule: LifestyleSchedule,
  history: ActualWeekRecord[],
): { patterns: AdherencePattern[]; recommendations: RankedRecommendation<ScheduleProposal>[] } {
  const relevant = history.filter((w) => w.scheduleId === schedule.id && w.records.length > 0);
  if (relevant.length < 2) return { patterns: [], recommendations: [] };

  const comparisons = relevant.map((w) => compareWeek(schedule, w));
  const rotation = Math.max(1, schedule.rotationLengthDays);
  const patterns: AdherencePattern[] = [];
  const proposals: Array<{ candidate: ScheduleProposal; factors: ScoreFactor[] }> = [];

  for (let day = 0; day < rotation; day++) {
    const withPlan = comparisons.filter((c) => (c.days[day]?.plannedTitles.length ?? 0) > 0);
    if (withPlan.length < 2) continue;
    const missed = withPlan.filter((c) => c.days[day].state === "missed");
    if (missed.length >= 2 && missed.length / withPlan.length >= 0.5) {
      const label = rotationDayLabel(schedule, day);
      const planned = withPlan[0].days[day].plannedTitles.join(", ");
      patterns.push({
        id: `pattern-miss-${day}`,
        title: `${label} keeps getting missed`,
        detail: `"${planned}" was scheduled on ${label} but missed in ${missed.length} of the last ${withPlan.length} tracked weeks. That's a structure signal, not a discipline verdict — the day may be fighting your real life.`,
        weeksObserved: withPlan.length,
      });
      proposals.push(
        {
          candidate: {
            title: `Move the ${label} session to a day you already show up`,
            detail: `Swap "${planned}" onto one of the days you complete consistently and let ${label} carry something lighter (mobility, zone 2, or rest).`,
          },
          factors: [
            { label: "adherence fit", weight: 3, score: 0.9, reason: `Matches the schedule to ${missed.length}-of-${withPlan.length} observed reality instead of fighting it` },
            { label: "training continuity", weight: 2, score: 0.8, reason: "The session still happens — only its day changes" },
            { label: "week identity", weight: 1, score: 0.45, tradeoff: "The written week changes shape" },
          ],
        },
        {
          candidate: {
            title: `Shrink the ${label} session instead of moving it`,
            detail: `Keep the day but cut it to a 30–40 minute core version — a shorter bar is easier to clear on the day that keeps slipping.`,
          },
          factors: [
            { label: "adherence fit", weight: 3, score: 0.7, reason: "A smaller session lowers the cost of showing up" },
            { label: "training volume", weight: 2, score: 0.4, tradeoff: "That day's volume drops until consistency returns" },
          ],
        },
        {
          candidate: {
            title: "Keep the week exactly as written",
            detail: `Preserve the original design and treat the recent ${label} misses as circumstantial.`,
          },
          factors: [
            { label: "member preference", weight: 2, score: 0.9, reason: "Your original design stays untouched" },
            { label: "adherence fit", weight: 3, score: 0.3, tradeoff: `The pattern (${missed.length} of ${withPlan.length} weeks) suggests the misses aren't random` },
          ],
        },
      );
    }
  }

  return {
    patterns,
    recommendations: rankCandidates(
      proposals.map((p) => ({ candidate: p.candidate, scored: scoreCandidate(p.factors) })),
    ),
  };
}

export type ProgramInconsistencyObservation = {
  id: string;
  title: string;
  detail: string;
  evidence: string[];
  alternatives: Array<{
    rank: number;
    label: "Best Option" | "Strong Alternative" | "Keep Current Structure";
    title: string;
    tradeoff: string;
  }>;
};

/** Constructive multi-week observations. This function never writes to the
 * program; every alternative is an explicit member decision. */
export function detectProgramInconsistencies(input: {
  program: ProgramDefinition;
  actualWeeks: ActualWeekRecord[];
  dayVersions: ProgramDayDefinition[];
  movementSelections: MovementSelectionRecord[];
}): ProgramInconsistencyObservation[] {
  const weeks = input.actualWeeks.filter((week) => week.records.length > 0).slice(-8);
  if (weeks.length < 2) return [];
  const records = weeks.flatMap((week) => week.records);
  const observations: ProgramInconsistencyObservation[] = [];
  const dayForDate = (isoDate: string, offset = 0) => {
    const date = new Date(`${isoDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const weekday = (date.getDay() + 6) % 7;
    const index = input.program.rotationLengthDays === 7
      ? (weekday - input.program.weekAnchor + 7) % 7
      : weekday % Math.max(1, input.program.rotationLengthDays);
    return input.program.days.find((day) => day.dayIndex === index);
  };
  const lowerBodyDay = (day: ProgramDayDefinition | undefined) => Boolean(
    day && /leg|lower|quad|hamstring|glute|adductor|calf|squat|hinge/i.test(
      `${day.title} ${day.sessionObjective} ${day.primaryTargets.join(" ")}`,
    ),
  );

  const moved = records.filter((record) => record.status === "moved");
  if (moved.length >= 2) {
    observations.push({
      id: "program-pattern-moved",
      title: "One or more sessions keep moving",
      detail: `${moved.length} planned sessions moved across ${weeks.length} tracked weeks. The pattern suggests the written placement may not match the real week.`,
      evidence: moved.slice(-4).map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Move the recurring day to the destination that already works", tradeoff: "The written sequence changes while the day definition stays intact." },
        { rank: 2, label: "Strong Alternative", title: "Keep the day and create a compact version", tradeoff: "Planned volume may be lower on constrained weeks." },
        { rank: 3, label: "Keep Current Structure", title: "Continue monitoring without a change", tradeoff: "The same placement may keep producing swaps." },
      ],
    });
  }

  const missedByDay = new Map<string, typeof records>();
  for (const record of records.filter((entry) =>
    entry.status === "skipped" && ["skipped", "not-ready", "accidental-start"].includes(entry.flexOutcome ?? "skipped"),
  )) {
    const key = record.programDayId ?? record.plannedActivityId ?? record.title;
    missedByDay.set(key, [...(missedByDay.get(key) ?? []), record]);
  }
  for (const misses of missedByDay.values()) {
    if (misses.length < 2) continue;
    observations.push({
      id: `program-pattern-missed-${misses[0].programDayId ?? misses[0].title}`,
      title: `${misses[0].title} is frequently missed`,
      detail: `${misses.length} calendar occurrences were set aside across ${weeks.length} tracked weeks. This is a schedule-fit signal, not a discipline verdict.`,
      evidence: misses.slice(-4).map((record) => `${record.date} · ${record.flexOutcome ?? "missed"}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Move the recurring day to a window that already works", tradeoff: "The written placement changes while day content stays exact." },
        { rank: 2, label: "Strong Alternative", title: "Create a compact occurrence for constrained weeks", tradeoff: "Planned direct volume may be lower on that variant." },
        { rank: 3, label: "Keep Current Structure", title: "Preserve the week and continue observation", tradeoff: "The same placement may keep creating missed exposure." },
      ],
    });
  }

  const pickleballBeforeLower = records.filter((record) =>
    /pickleball|padel|tennis/i.test(record.title) && lowerBodyDay(dayForDate(record.date, 1)),
  );
  if (pickleballBeforeLower.length > 0) {
    observations.push({
      id: "program-pattern-pickleball-before-lower",
      title: "Court work is landing before lower-body training",
      detail: `${pickleballBeforeLower.length} observed court session${pickleballBeforeLower.length === 1 ? "" : "s"} landed before a lower-body day. Calf, adductor, quad, glute, knee, ankle, rotation, and conditioning demand remain indirect exposure—not hypertrophy sets.`,
      evidence: pickleballBeforeLower.slice(-4).map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Expose court work on the weekly canvas", tradeoff: "The program gains a visible side-activity load source." },
        { rank: 2, label: "Strong Alternative", title: "Use a week variant with more lower-body spacing", tradeoff: "Some weeks will carry a different day order." },
        { rank: 3, label: "Keep Current Structure", title: "Keep the placement and monitor completed output", tradeoff: "Reserve will continue flagging the overlap." },
      ],
    });
  }

  const trackBeforeLower = records.filter((record) =>
    /track|sprint|acceleration/i.test(record.title) && lowerBodyDay(dayForDate(record.date, 1)),
  );
  if (trackBeforeLower.length > 0) {
    observations.push({
      id: "program-pattern-track-before-lower",
      title: "Track demand is landing before lower-body training",
      detail: `${trackBeforeLower.length} observed track session${trackBeforeLower.length === 1 ? "" : "s"} preceded a lower-body day. Hamstring, glute, calf, hip-flexor, neural, and recovery demand should stay visible in spacing decisions.`,
      evidence: trackBeforeLower.slice(-4).map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Separate track and the highest-demand lower day", tradeoff: "The weekly order changes." },
        { rank: 2, label: "Strong Alternative", title: "Create a track-week lower-body variant", tradeoff: "The day library carries another deliberate version." },
        { rank: 3, label: "Keep Current Structure", title: "Keep placement and compare actual output", tradeoff: "The overlap remains visible until logs support it." },
      ],
    });
  }

  const recoveryReplacements = records.filter((record) => {
    const planned = dayForDate(record.date);
    return planned?.sessionType === "rest" && record.status === "unplanned" && /pickleball|track|sprint|sport|conditioning|gym|strength/i.test(`${record.title} ${record.type}`);
  });
  if (recoveryReplacements.length >= 2) {
    observations.push({
      id: "program-pattern-recovery-replaced",
      title: "Side activity keeps replacing planned recovery",
      detail: `${recoveryReplacements.length} unplanned activity sessions landed on written rest days. Reserve can reflect the real week while keeping recovery explicit.`,
      evidence: recoveryReplacements.slice(-4).map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Move full recovery to a day the member actually protects", tradeoff: "The written recovery day changes." },
        { rank: 2, label: "Strong Alternative", title: "Create a side-activity week variant", tradeoff: "Weekly selection becomes more deliberate." },
        { rank: 3, label: "Keep Current Structure", title: "Preserve the current rest day", tradeoff: "Planned and actual recovery will keep diverging." },
      ],
    });
  }

  for (const day of input.program.days) {
    if (!day.expectedDurationMinutes) continue;
    const overruns = records.filter((record) =>
      record.programDayId === day.lineageId &&
      typeof record.durationMinutes === "number" &&
      record.durationMinutes > day.expectedDurationMinutes! * 1.15,
    );
    if (overruns.length < 2) continue;
    observations.push({
      id: `program-pattern-duration-${day.lineageId}`,
      title: `${day.title} keeps exceeding its planned window`,
      detail: `${overruns.length} completed sessions exceeded the ${day.expectedDurationMinutes}-minute plan by more than 15%. Duration is compared from real closeout timestamps.`,
      evidence: overruns.slice(-4).map((record) => `${record.date} · ${record.durationMinutes} min`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Save the real duration as this version's expectation", tradeoff: "The written time commitment increases." },
        { rank: 2, label: "Strong Alternative", title: "Create a compact day version", tradeoff: "The compact version carries less planned work." },
        { rank: 3, label: "Keep Current Structure", title: "Keep the current duration target", tradeoff: "Reserve will continue showing the overrun pattern." },
      ],
    });
  }

  const unplannedPickleball = records.filter((record) =>
    record.status === "unplanned" && /pickleball|padel|tennis/i.test(record.title),
  );
  if (unplannedPickleball.length >= 2) {
    observations.push({
      id: "program-pattern-pickleball",
      title: "Unplanned court work is becoming part of the true week",
      detail: `${unplannedPickleball.length} court sessions appeared outside the plan. Calf, adductor, knee, ankle, rotation, and conditioning load should be visible beside lower-body work.`,
      evidence: unplannedPickleball.map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Add court work to the planned week", tradeoff: "The weekly canvas gains another real load source." },
        { rank: 2, label: "Strong Alternative", title: "Keep it flexible and protect adjacent lower-body spacing", tradeoff: "Week assignments need occasional temporary overrides." },
        { rank: 3, label: "Keep Current Structure", title: "Leave it unplanned and continue observation", tradeoff: "Exposure reads remain less complete." },
      ],
    });
  }

  const sundayGym = records.filter((record) => {
    const date = new Date(`${record.date}T12:00:00`);
    return date.getDay() === 0 && record.status === "unplanned" && ["strength", "hypertrophy"].includes(record.type);
  });
  const sundayDay = input.program.days.find((day) => day.dayIndex === 6);
  if (sundayGym.length >= 2 && sundayDay?.sessionType === "rest") {
    observations.push({
      id: "program-pattern-sunday-gym",
      title: "Sunday training keeps replacing planned rest",
      detail: `${sundayGym.length} unplanned Sunday gym sessions replaced the written rest day. Reserve can reflect that behavior without judging it.`,
      evidence: sundayGym.map((record) => `${record.date} · ${record.title}`),
      alternatives: [
        { rank: 1, label: "Best Option", title: "Make Sunday an intentional low-demand day", tradeoff: "A different day must carry full recovery." },
        { rank: 2, label: "Strong Alternative", title: "Create a one-off Sunday training week", tradeoff: "Weekly selection becomes more deliberate." },
        { rank: 3, label: "Keep Current Structure", title: "Keep Sunday as written", tradeoff: "Reserve will continue distinguishing planned rest from actual training." },
      ],
    });
  }

  for (const day of input.program.days) {
    const versions = input.dayVersions.filter((version) => version.lineageId === day.lineageId);
    if (versions.length >= 4) {
      observations.push({
        id: `program-pattern-rewrite-${day.lineageId}`,
        title: `${day.title} is repeatedly rewritten`,
        detail: `${versions.length} saved versions exist for this one day. A stable phase-specific version may fit better than rebuilding it week to week.`,
        evidence: versions.slice(-4).map((version) => `v${version.version} · ${version.title}`),
        alternatives: [
          { rank: 1, label: "Best Option", title: "Activate the version you repeat most often", tradeoff: "The current experimental version moves into history." },
          { rank: 2, label: "Strong Alternative", title: "Create named travel and full-gym versions", tradeoff: "The library carries more deliberate variants." },
          { rank: 3, label: "Keep Current Structure", title: "Keep editing the active day", tradeoff: "Version history will continue to grow within its safety bound." },
        ],
      });
    }
  }

  const rejectedCounts = new Map<string, number>();
  for (const selection of input.movementSelections) {
    for (const id of selection.rejectedExerciseIds) rejectedCounts.set(id, (rejectedCounts.get(id) ?? 0) + 1);
  }
  const repeatedReject = [...rejectedCounts.entries()].find(([, count]) => count >= 3);
  if (repeatedReject) {
    observations.push({
      id: `program-pattern-rejection-${repeatedReject[0]}`,
      title: "One Reserve movement keeps getting rejected",
      detail: `The same option was rejected ${repeatedReject[1]} times. Reserve should rank it lower for this member without changing existing days automatically.`,
      evidence: [`Movement id ${repeatedReject[0]} · ${repeatedReject[1]} rejections`],
      alternatives: [
        { rank: 1, label: "Best Option", title: "Preserve the preferred substitute", tradeoff: "Future rankings become more member-specific." },
        { rank: 2, label: "Strong Alternative", title: "Keep the movement as a secondary option", tradeoff: "It remains visible but not first-ranked." },
        { rank: 3, label: "Keep Current Structure", title: "Do not change ranking behavior", tradeoff: "The option may keep appearing." },
      ],
    });
  }

  return observations;
}
