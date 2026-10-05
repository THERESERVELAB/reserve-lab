/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE AUDIT ENGINE — Reserve reads the member's week and explains it.

   Deterministic analysis over the weekly exposure report: density, recovery
   spacing, sprint↔lower-body sequencing, overlap, rest coverage, duration
   realism, sleep compatibility, adherence risk. Every finding is plain
   language; every recommendation is ranked with reasons and tradeoffs and
   is ONLY a proposal — the member accepts, modifies, rejects, or keeps the
   original. The audit never mutates a schedule.

   Sequencing analysis is contextual, not dogmatic: Monday track + Tuesday
   legs is examined against sprint intensity, training age, and what the
   Tuesday session actually contains — not auto-rejected.
   ════════════════════════════════════════════════════════════════════════ */

import { rankCandidates, scoreCandidate, type ScoreFactor } from "./scoring";
import { rotationDayLabel, lifestyleId } from "./types";
import type {
  AuditFinding,
  CustomWorkoutTemplate,
  LifestyleSchedule,
  RankedRecommendation,
  ScheduleAudit,
  ScheduleProposal,
} from "./types";
import type { WeeklyExposureReport } from "./exposure-engine";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "./activity-load";

/** Light member context — derived by the caller from the member contract. */
export type AuditContext = {
  trainingAge: "beginner" | "intermediate" | "advanced";
  /** "HH:MM" sleep target from the schedule profile — null when unknown. */
  sleepTarget: string | null;
  /** Recent sleep logs exist (recovery data confidence). */
  hasRecoveryData: boolean;
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function dayLabel(schedule: LifestyleSchedule, dayIndex: number): string {
  return rotationDayLabel(schedule, dayIndex);
}

export function auditSchedule(
  schedule: LifestyleSchedule,
  exposure: WeeklyExposureReport,
  templates: CustomWorkoutTemplate[],
  ctx: AuditContext,
): ScheduleAudit {
  const findings: AuditFinding[] = [];
  const proposals: Array<{ candidate: ScheduleProposal; factors: ScoreFactor[] }> = [];
  const rotation = Math.max(1, schedule.rotationLengthDays);
  const label = (i: number) => dayLabel(schedule, i % rotation);
  const templateById = new Map(templates.map((t) => [t.id, t]));

  /* ── 1. Sprint → next-day lower-body sequencing ──────────────────────── */
  for (const sprintDay of exposure.sprintDays) {
    const nextIdx = (sprintDay + 1) % rotation;
    const nextDay = exposure.days[nextIdx];
    if (!nextDay) continue;

    const sprintLoad = exposure.days[sprintDay].sprintLoad;
    // What does the next day's lifting actually contain? Titles, focus tags,
    // and assigned-template movements all count — a "Full Body Strength" day
    // holds lower-body work even when no template is attached yet.
    const nextActivities = schedule.activities.filter(
      (a) => a.dayIndex === nextIdx && (a.type === "strength" || a.type === "hypertrophy"),
    );
    const nextHasHingeVolume = nextActivities.some((a) => {
      const t = a.workoutTemplateId ? templateById.get(a.workoutTemplateId) : undefined;
      const text = [
        a.title,
        ...(a.focus ?? []),
        ...(t?.movements.map((m) => m.customExerciseName ?? m.exerciseId ?? "") ?? []),
      ].join(" ");
      return /rdl|romanian|deadlift|hinge|hamstring|lower|leg|full.?body/i.test(text);
    });
    if (nextDay.lowerBodyLoad < 0.6 && !nextHasHingeVolume) continue;

    const highSprint = sprintLoad >= 1;
    const severity = highSprint && nextHasHingeVolume ? "conflict" : "attention";
    findings.push({
      id: lifestyleId("find"),
      severity,
      title: `${label(sprintDay)} sprint work feeds directly into ${label(nextIdx)} lower-body training`,
      detail:
        `${label(sprintDay)} carries ${highSprint ? "high" : "moderate"}-intensity sprint load (hamstrings, glutes, calves). ` +
        `${label(nextIdx)} then loads the lower body${nextHasHingeVolume ? " including hinge/hamstring work" : ""}. ` +
        `For a ${ctx.trainingAge} athlete this spacing is ${highSprint && nextHasHingeVolume ? "the most demanding sequence in the week" : "workable when the sprint day stays controlled"}.` +
        (ctx.hasRecoveryData ? "" : " Reserve has limited recovery data — log sleep to sharpen this read."),
      dayIndices: [sprintDay, nextIdx],
    });

    proposals.push(
      {
        candidate: {
          title: `Move heavy lower-body work one day later`,
          detail: `Keep ${label(sprintDay)} track as-is; shift the heavy lower session from ${label(nextIdx)} to ${label(nextIdx + 1)} and slot upper-body work in between.`,
          action: { kind: "swap-days", dayA: nextIdx, dayB: (nextIdx + 1) % rotation },
        },
        factors: [
          { label: "recovery spacing", weight: 3, score: 0.95, reason: "Restores a full recovery day between sprint tissue load and heavy lower lifting" },
          { label: "goal preservation", weight: 2, score: 0.85, reason: "No training volume is lost — the week is resequenced, not reduced" },
          { label: "schedule disruption", weight: 1, score: 0.5, tradeoff: "Two days of the week change identity" },
        ],
      },
      {
        candidate: {
          title: `Keep ${label(nextIdx)} legs but bias stable quad work`,
          detail: `Keep the day where it is; reduce hinge/RDL volume and lean on leg press, hack squat, and leg extension — patterns that spare sprint-fatigued hamstrings.`,
        },
        factors: [
          { label: "recovery spacing", weight: 3, score: 0.7, reason: "Hamstring-heavy patterns move away from the post-sprint window" },
          { label: "goal preservation", weight: 2, score: 0.7, reason: "Lower-body frequency is preserved on the member's chosen day" },
          { label: "hamstring volume", weight: 1.5, score: 0.35, tradeoff: "Direct hamstring volume drops this day and must live elsewhere in the week" },
        ],
      },
      {
        candidate: {
          title: `Keep the full sequence — only if sprint intensity stays low`,
          detail: `Run ${label(sprintDay)} as tempo/technique work below full velocity, and confirm readiness before the ${label(nextIdx)} session.`,
        },
        factors: [
          { label: "recovery spacing", weight: 3, score: highSprint ? 0.25 : 0.55, tradeoff: "Depends entirely on honest sprint-intensity control" },
          { label: "member preference", weight: 2, score: 0.9, reason: "Preserves the exact week the member designed" },
          { label: "training age", weight: 1.5, score: ctx.trainingAge === "advanced" ? 0.7 : 0.4, tradeoff: ctx.trainingAge === "advanced" ? undefined : "Less training history means less margin for stacked lower-body stress" },
        ],
      },
      {
        candidate: {
          title: `Max-velocity sprints into high-volume hinge work`,
          detail: `Full-speed sprinting on ${label(sprintDay)} followed by heavy RDL/squat volume on ${label(nextIdx)} stacks the highest tissue demands back-to-back.`,
        },
        factors: [
          { label: "recovery spacing", weight: 3, score: 0.1, tradeoff: "Hamstring tissue gets no meaningful recovery window", veto: highSprint && nextHasHingeVolume },
          { label: "member preference", weight: 1, score: 0.6 },
        ],
      },
    );
    break; // one sequencing block per audit keeps the report readable
  }

  /* ── 2. Density: consecutive high-fatigue days ───────────────────────── */
  if (exposure.longestHighFatigueStreak >= 3) {
    findings.push({
      id: lifestyleId("find"),
      severity: exposure.longestHighFatigueStreak >= 5 ? "conflict" : "attention",
      title: `${exposure.longestHighFatigueStreak} consecutive high-demand days`,
      detail: "Multiple high-fatigue days in a row compound systemic load. Output usually drops before motivation does — a lighter day or planned recovery inside the block protects the back half of the week.",
      dayIndices: [],
    });
  }

  /* ── 3. Rest coverage ────────────────────────────────────────────────── */
  if (exposure.restDays.length === 0) {
    findings.push({
      id: lifestyleId("find"),
      severity: "attention",
      title: "No full rest or recovery day in the rotation",
      detail: `All ${rotation} days carry meaningful load. Reserve will not remove anything, but at least one true recovery day is the cheapest performance upgrade available in this schedule.`,
      dayIndices: [],
    });
  }

  /* ── 4. Muscle overlap: back-to-back direct exposure ─────────────────── */
  for (const g of MUSCLE_GROUPS) {
    const m = exposure.perMuscle[g];
    if (m.backToBack && m.directSets >= 12) {
      findings.push({
        id: lifestyleId("find"),
        severity: "attention",
        title: `${MUSCLE_GROUP_LABELS[g]} trained on consecutive days`,
        detail: `${MUSCLE_GROUP_LABELS[g]} gets direct work on days ${m.daysTouched.map((d) => label(d)).join(", ")} with a minimum gap of ${m.minGapDays} day${m.minGapDays === 1 ? "" : "s"}. Consecutive exposure can work in a specialization phase — as a default it usually trades quality for volume.`,
        dayIndices: m.daysTouched,
      });
    }
  }

  /* ── 5. Underexposure / overexposure ─────────────────────────────────── */
  const untouched = MUSCLE_GROUPS.filter((g) => exposure.perMuscle[g].flag === "untouched" && g !== "adductors");
  if (untouched.length > 0 && exposure.estimatedWeeklyWorkingSets > 0) {
    findings.push({
      id: lifestyleId("find"),
      severity: "info",
      title: `No direct work found for: ${untouched.map((g) => MUSCLE_GROUP_LABELS[g]).join(", ")}`,
      detail: "These groups get no direct exposure in the current week. Intentional for a specialization block; worth one look if it isn't.",
      dayIndices: [],
    });
  }
  const high = MUSCLE_GROUPS.filter((g) => exposure.perMuscle[g].flag === "high");
  for (const g of high) {
    findings.push({
      id: lifestyleId("find"),
      severity: "attention",
      title: `${MUSCLE_GROUP_LABELS[g]} volume is running high`,
      detail: `~${Math.round(exposure.perMuscle[g].directSets)} estimated direct sets across the rotation${exposure.perMuscle[g].backToBack ? " with consecutive-day exposure" : ""}. Productive if recovery is strong; the first place to trim if it isn't.`,
      dayIndices: exposure.perMuscle[g].daysTouched,
    });
  }

  /* ── 6. Session duration realism ─────────────────────────────────────── */
  for (const a of schedule.activities) {
    if ((a.type === "strength" || a.type === "hypertrophy") && (a.durationMinutes ?? 0) > 150) {
      findings.push({
        id: lifestyleId("find"),
        severity: "info",
        title: `${label(a.dayIndex)} "${a.title}" is scheduled for ${a.durationMinutes} minutes`,
        detail: "Sessions past ~2.5 hours usually reflect optimistic rest math rather than real output. Worth confirming the block honestly fits.",
        dayIndices: [a.dayIndex],
      });
    }
  }

  /* ── 7. Sleep compatibility ──────────────────────────────────────────── */
  if (ctx.sleepTarget) {
    const sleepMin = toMinutes(ctx.sleepTarget);
    for (const a of schedule.activities) {
      if (!a.endTime || !(a.type === "strength" || a.type === "hypertrophy" || a.type === "hiit" || a.type === "conditioning")) continue;
      const endMin = toMinutes(a.endTime);
      const gap = sleepMin - endMin;
      if (gap > 0 && gap < 60) {
        findings.push({
          id: lifestyleId("find"),
          severity: "attention",
          title: `${label(a.dayIndex)} training ends ${gap} min before your sleep target`,
          detail: `"${a.title}" finishes at ${a.endTime} against a ${ctx.sleepTarget} sleep target. High-arousal training this close to bed commonly costs sleep quality — the recovery engine will show it if it does.`,
          dayIndices: [a.dayIndex],
        });
      }
    }
  }

  /* ── 8. Underused recovery ───────────────────────────────────────────── */
  const trainingDayCount = exposure.days.filter((d) => d.hasTraining).length;
  const hasRecoveryWork = schedule.activities.some((a) =>
    a.type === "recovery" || a.type === "mobility" || a.type === "sauna" || a.type === "massage" || a.type === "cold-exposure",
  );
  if (trainingDayCount >= 5 && !hasRecoveryWork) {
    findings.push({
      id: lifestyleId("find"),
      severity: "info",
      title: "No scheduled recovery work in a high-frequency week",
      detail: `${trainingDayCount} training days with zero scheduled mobility, sauna, or recovery blocks. Even one 20-minute mobility slot raises the week's ceiling.`,
      dayIndices: [],
    });
  }

  /* ── Positive signal when the structure reads clean ──────────────────── */
  if (findings.length === 0) {
    findings.push({
      id: lifestyleId("find"),
      severity: "info",
      title: "Structure reads clean",
      detail: "Density, spacing, and sequencing all check out against the current exposure model. Reserve will re-audit as the week evolves.",
      dayIndices: [],
    });
  }

  const recommendations: RankedRecommendation<ScheduleProposal>[] = rankCandidates(
    proposals.map((p) => ({ candidate: p.candidate, scored: scoreCandidate(p.factors) })),
  );

  return {
    scheduleId: schedule.id,
    generatedAt: new Date().toISOString(),
    findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    recommendations,
  };
}

function severityRank(s: AuditFinding["severity"]): number {
  return s === "conflict" ? 2 : s === "attention" ? 1 : 0;
}
