/* ════════════════════════════════════════════════════════════════════════
   HORIZON REVISION

   Future weeks may be revised. Completed weeks may not. The original
   projection is always preserved, every revision carries an explicit reason,
   and athlete-initiated changes require confirmation.

   This is where the activity-reconciliation engine meets the program: a
   one-time activity adjusts only the current week, a recurring activity
   re-plans the future weeks and leaves history alone.
   ════════════════════════════════════════════════════════════════════════ */

import {
  reconcileActivity,
  type AthleteActivity,
  type PlannedDay,
  type ScheduleAdjustmentProposal,
} from "@/lib/schedule/activity-reconciliation";
import { cloneWeek, currentWeekNumber } from "./generate";
import type {
  ProgramHorizon,
  ProgramRevision,
  ProgramRevisionSource,
  ProjectedProgramWeek,
} from "./types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The planned-week snapshot the reconciliation engine reads. */
export function plannedDaysFor(week: ProjectedProgramWeek): PlannedDay[] {
  return week.weeklyStructure.map((d, i) => ({
    dayIndex: i,
    dayName: DAY_NAMES[i],
    title: d.title,
    focusAreas: d.recovery ? [] : [...d.emphasis],
    recovery: Boolean(d.recovery),
    intent: d.intent,
  }));
}

export type ActivityApplication = {
  proposal: ScheduleAdjustmentProposal;
  /** The horizon after the athlete's decision is applied. */
  horizon: ProgramHorizon;
  revision: ProgramRevision | null;
  /** True when nothing could be changed (e.g. the week is already completed). */
  blocked: boolean;
  blockedReason?: string;
};

/**
 * Evaluate an activity against the horizon WITHOUT changing anything.
 * The athlete sees this before deciding.
 */
export function previewActivity(
  horizon: ProgramHorizon,
  activity: AthleteActivity,
  now: Date = new Date(),
): { proposal: ScheduleAdjustmentProposal; affectedWeeks: number[]; currentWeek: number } {
  const current = currentWeekNumber(horizon, now);
  const week = horizon.weeks.find((w) => w.weekNumber === current) ?? horizon.weeks[0];
  const proposal = reconcileActivity({ activity, week: plannedDaysFor(week) });

  const affectedWeeks =
    activity.recurrence === "one-time"
      ? [current]
      : horizon.weeks.filter((w) => w.weekNumber >= current).map((w) => w.weekNumber);

  return { proposal, affectedWeeks, currentWeek: current };
}

/* ─── Applying a decision ─────────────────────────────────────────────── */

export type ApplyActivityInput = {
  horizon: ProgramHorizon;
  activity: AthleteActivity;
  /** Athlete confirmation. Meaningful changes and all recurring changes need it. */
  athleteConfirmed: boolean;
  source?: ProgramRevisionSource;
  now?: Date;
};

/**
 * Apply an activity decision to the horizon.
 *
 *   one-time  → adjusts the CURRENT week only. Future weeks keep the
 *               protocol's DNA untouched.
 *   recurring → revises the current week AND every future week, and records
 *               the effective week. Completed weeks are never touched.
 */
export function applyActivityToHorizon(input: ApplyActivityInput): ActivityApplication {
  const { horizon, activity, athleteConfirmed } = input;
  const now = input.now ?? new Date();
  const current = currentWeekNumber(horizon, now);
  const { proposal } = previewActivity(horizon, activity, now);

  if (proposal.requiresAthleteConfirmation && !athleteConfirmed) {
    return {
      proposal,
      horizon,
      revision: null,
      blocked: true,
      blockedReason: "This change needs your confirmation before Reserve applies it.",
    };
  }

  const recurring = activity.recurrence !== "one-time";
  const targetWeeks = recurring
    ? horizon.weeks.filter((w) => w.weekNumber >= current && w.status !== "completed")
    : horizon.weeks.filter((w) => w.weekNumber === current && w.status !== "completed");

  if (targetWeeks.length === 0) {
    return {
      proposal,
      horizon,
      revision: null,
      blocked: true,
      blockedReason: "There are no future weeks left in this block to adjust.",
    };
  }

  const before = targetWeeks.map(cloneWeek);
  const dayIndex = activity.dayOfWeek ?? 0;

  const after = targetWeeks.map((w) => applyProposalToWeek(w, activity, proposal, dayIndex, recurring, current));

  const reason = recurring
    ? `${activity.title} added as a recurring commitment (${DAY_NAMES[dayIndex]}${activity.startTime ? `, ${activity.startTime}` : ""}). ${proposal.recommendation}`
    : `${activity.title} added as a one-time change on ${DAY_NAMES[dayIndex]}. ${proposal.recommendation}`;

  const revision: ProgramRevision = {
    id: `rev-${Date.parse(now.toISOString())}-${activity.id}`,
    createdAt: now.toISOString(),
    effectiveWeek: current,
    source: input.source ?? "athlete",
    reason,
    affectedWeeks: after.map((w) => w.weekNumber),
    athleteContextChange: recurring
      ? [`Recurring activity added: ${activity.title} (${activity.durationMinutes} min, ${activity.intensity} intensity).`]
      : undefined,
    before,
    after: after.map(cloneWeek),
    athleteConfirmed,
    activity: JSON.parse(JSON.stringify(activity)) as AthleteActivity,
  };

  const byNumber = new Map(after.map((w) => [w.weekNumber, w]));
  return {
    proposal,
    horizon: {
      ...horizon,
      // Completed weeks are untouchable: only weeks at or after the current
      // week are ever replaced.
      weeks: horizon.weeks.map((w) => (w.weekNumber >= current ? byNumber.get(w.weekNumber) ?? w : w)),
      revisions: [...horizon.revisions, revision],
    },
    revision,
    blocked: false,
  };
}

function applyProposalToWeek(
  week: ProjectedProgramWeek,
  activity: AthleteActivity,
  proposal: ScheduleAdjustmentProposal,
  dayIndex: number,
  recurring: boolean,
  effectiveWeek: number,
): ProjectedProgramWeek {
  const next = cloneWeek(week);
  const structure = next.weeklyStructure;
  const day = structure[dayIndex];
  if (!day) return next;

  if (proposal.resolvedRelationship === "replace") {
    structure[dayIndex] = {
      title: activity.title,
      archetype: activityArchetype(activity),
      emphasis: [...activity.focusAreas],
      intent: activityIntent(activity),
      priority: day.priority,
    };
  } else if (proposal.resolvedRelationship === "supplement") {
    structure[dayIndex] = {
      ...day,
      title: day.recovery ? activity.title : `${day.title} + ${activity.title}`,
      emphasis: [...new Set([...day.emphasis, ...activity.focusAreas])],
      recovery: false,
    };
  } else {
    // Reschedule — move the planned session to the nearest recovery day.
    const openIdx = structure.findIndex((d, i) => i !== dayIndex && d.recovery);
    if (openIdx >= 0) {
      structure[openIdx] = { ...day, recovery: false };
    }
    structure[dayIndex] = {
      title: activity.title,
      archetype: activityArchetype(activity),
      emphasis: [...activity.focusAreas],
      intent: activityIntent(activity),
      priority: day.priority,
    };
  }

  // Surrounding-day reductions the proposal asked for.
  for (const line of proposal.reduce) {
    const name = line.split(" · ")[0]?.trim();
    const idx = DAY_NAMES.indexOf(name as (typeof DAY_NAMES)[number]);
    if (idx >= 0 && structure[idx] && !structure[idx].recovery) {
      structure[idx] = {
        ...structure[idx],
        emphasis: [...new Set([...structure[idx].emphasis, "reduced-volume"])],
      };
    }
  }

  next.status = "revised";
  next.revisionReason = recurring
    ? `Revised from week ${effectiveWeek} onward for the recurring ${activity.title}.`
    : `Adjusted for a one-time ${activity.title}.`;
  next.originalWeekNumber = week.weekNumber;

  next.recoveryTarget = [...next.recoveryTarget, ...proposal.recoveryChanges];
  next.nutritionDemand = `${next.nutritionDemand} ${proposal.nutritionChanges.join(" ")}`.trim();
  next.athleteRationale = {
    ...next.athleteRationale,
    whyThisWeekFitsNow: [...next.athleteRationale.whyThisWeekFitsNow, ...proposal.rationale],
    watchItems: [...next.athleteRationale.watchItems, ...proposal.recoveryChanges],
  };

  return next;
}

function activityArchetype(a: AthleteActivity): ProjectedProgramWeek["weeklyStructure"][number]["archetype"] {
  switch (a.activityType) {
    case "running": return "outdoor-distance";
    case "conditioning": return "conditioning";
    case "sport": return "sport-conditioning";
    case "mobility": return "mobility";
    case "recovery": return "recovery";
    case "group-fitness":
      return /lower|leg|glute|quad|hamstring/i.test(a.focusAreas.join(" ")) ? "lower-strength" : "full-body-athletic";
    case "lifting":
      return /lower|leg/i.test(a.focusAreas.join(" ")) ? "lower-strength" : "upper-strength";
    default: return "conditioning";
  }
}

function activityIntent(a: AthleteActivity): ProjectedProgramWeek["weeklyStructure"][number]["intent"] {
  switch (a.activityType) {
    case "running":
    case "conditioning": return "conditioning";
    case "sport": return "sport";
    case "mobility": return "mobility";
    case "recovery": return "recovery";
    case "lifting": return "strength";
    default: return "conditioning";
  }
}

/* ─── Reserve-initiated revisions ─────────────────────────────────────── */

export type ReserveRevisionInput = {
  horizon: ProgramHorizon;
  reason: string;
  /** Applied from this week forward. Defaults to the current week. */
  fromWeek?: number;
  /** Multiplier applied to every future week's set targets. */
  volumeMultiplier?: number;
  /** Multiplier applied to every future week's conditioning duration. */
  conditioningMultiplier?: number;
  contextChange?: string[];
  athleteConfirmed?: boolean;
  now?: Date;
  /** Restrict a volume change to named set-target regions. Without this the
      multiplier applies to every region, which is rarely what the evidence
      actually supports — a back-volume finding should not move leg volume. */
  targetRegions?: string[];
  /** Structural change expressed as a pure week transform. This keeps ONE
      revision engine: callers describe the change, they do not build their
      own revision record. */
  transformWeek?: (week: ProjectedProgramWeek) => ProjectedProgramWeek;
  /** Set when the revision originated from the Response Model. */
  responseMetadata?: ProgramRevision["responseMetadata"];
};

/**
 * Reserve-driven revision — e.g. rapid weight loss with declining performance
 * reducing demand. Never touches completed weeks.
 */
export function reviseHorizon(input: ReserveRevisionInput): { horizon: ProgramHorizon; revision: ProgramRevision | null } {
  const { horizon, reason } = input;
  const now = input.now ?? new Date();
  const from = input.fromWeek ?? currentWeekNumber(horizon, now);
  const targets = horizon.weeks.filter((w) => w.weekNumber >= from && w.status !== "completed");
  if (targets.length === 0) return { horizon, revision: null };

  const volume = input.volumeMultiplier ?? 1;
  const conditioning = input.conditioningMultiplier ?? 1;
  if (volume === 1 && conditioning === 1 && !input.transformWeek) return { horizon, revision: null };

  // Region scoping is case-insensitive because set-target keys and insight
  // targets come from different vocabularies ("Back" vs "back").
  const scopedRegions = input.targetRegions?.length
    ? new Set(input.targetRegions.map((region) => region.trim().toLowerCase()))
    : null;

  const before = targets.map(cloneWeek);
  const after = targets.map((w) => {
    let next = cloneWeek(w);
    if (volume !== 1) {
      const setTargets: Record<string, number> = {};
      let touched = 0;
      for (const [k, v] of Object.entries(next.volumeTarget.setTargets)) {
        const inScope = !scopedRegions || scopedRegions.has(k.trim().toLowerCase());
        setTargets[k] = inScope ? Math.max(1, Math.round(v * volume)) : v;
        if (inScope) touched += 1;
      }
      next.volumeTarget = {
        relativeLoad: touched
          ? `${next.volumeTarget.relativeLoad} · revised to ${Math.round(volume * 100)}%${scopedRegions ? ` for ${input.targetRegions!.join(", ")}` : ""}`
          : next.volumeTarget.relativeLoad,
        setTargets,
      };
    }
    if (conditioning !== 1 && next.conditioningTarget) {
      next.conditioningTarget = {
        ...next.conditioningTarget,
        duration: next.conditioningTarget.duration != null
          ? Math.max(10, Math.round(next.conditioningTarget.duration * conditioning))
          : undefined,
        distance: next.conditioningTarget.distance != null
          ? Math.round(next.conditioningTarget.distance * conditioning * 10) / 10
          : undefined,
      };
    }
    if (input.transformWeek) next = input.transformWeek(next);
    next.status = "revised";
    next.revisionReason = reason;
    next.originalWeekNumber = w.weekNumber;
    next.athleteRationale = {
      ...next.athleteRationale,
      whyThisWeekFitsNow: [...next.athleteRationale.whyThisWeekFitsNow, `Revised: ${reason}`],
    };
    return next;
  });

  const revision: ProgramRevision = {
    id: `rev-${Date.parse(now.toISOString())}-reserve`,
    createdAt: now.toISOString(),
    effectiveWeek: from,
    source: "reserve",
    reason,
    affectedWeeks: after.map((w) => w.weekNumber),
    athleteContextChange: input.contextChange,
    before,
    after: after.map(cloneWeek),
    athleteConfirmed: input.athleteConfirmed ?? false,
    responseMetadata: input.responseMetadata,
  };

  const byNumber = new Map(after.map((w) => [w.weekNumber, w]));
  return {
    horizon: {
      ...horizon,
      weeks: horizon.weeks.map((w) => (w.weekNumber >= from ? byNumber.get(w.weekNumber) ?? w : w)),
      revisions: [...horizon.revisions, revision],
    },
    revision,
  };
}

/* ─── Evidence-driven revision recommendations ────────────────────────── */

export type RevisionRecommendation = {
  id: string;
  headline: string;
  reason: string;
  volumeMultiplier?: number;
  conditioningMultiplier?: number;
  requiresConfirmation: boolean;
};

export type EvidenceInput = {
  /** kg/week, signed. Negative = losing. */
  weightTrendKgPerWeek?: number;
  bodyWeightKg?: number;
  /** True when logged strength has declined across multiple movements. */
  strengthDeclining?: boolean;
  /** True when measurements or photographs are improving. */
  compositionImproving?: boolean;
  averageSleepHours?: number;
  readinessScore?: number;
  /** 0–1. */
  adherence?: number;
};

/**
 * Deterministic revision recommendations from real evidence. Reserve proposes;
 * the athlete confirms. Nothing here is applied automatically.
 */
export function recommendRevisions(
  horizon: ProgramHorizon,
  evidence: EvidenceInput,
): RevisionRecommendation[] {
  const out: RevisionRecommendation[] = [];
  const weightKg = evidence.bodyWeightKg ?? horizon.athleteSnapshot.profile.weightKg;
  const trend = evidence.weightTrendKgPerWeek;

  // Rapid loss + declining performance → reduce demand. Never add conditioning.
  const rapidLoss = trend != null && weightKg != null && trend <= -(weightKg * 0.01);
  if (rapidLoss && evidence.strengthDeclining) {
    out.push({
      id: "reduce-demand-rapid-loss",
      headline: "Reduce training demand while weight is falling this fast",
      reason:
        "Your weight is falling faster than roughly 1% of body weight per week and logged strength is declining. Reserve is reducing conditioning demand and non-essential volume, and protecting the primary resistance work. It is not adding conditioning — that would make the same problem worse. Reviewing energy intake is the other half of this.",
      volumeMultiplier: 0.85,
      conditioningMultiplier: 0.75,
      requiresConfirmation: true,
    });
  }

  // Poor sleep + declining performance → deload recommendation.
  const poorSleep = evidence.averageSleepHours != null && evidence.averageSleepHours < 6;
  const lowReadiness = evidence.readinessScore != null && evidence.readinessScore < 50;
  if ((poorSleep || lowReadiness) && evidence.strengthDeclining) {
    out.push({
      id: "deload-recommendation",
      headline: "Bring the deload forward",
      reason:
        `Logged performance is declining alongside ${poorSleep ? `about ${evidence.averageSleepHours} hours of sleep` : "low readiness"}. Reserve recommends moving the deload forward rather than pushing through — the block's remaining weeks are worth more with fatigue cleared.`,
      volumeMultiplier: 0.6,
      conditioningMultiplier: 0.6,
      requiresConfirmation: true,
    });
  }

  // Stable weight + improving composition → explicitly NOT a failure.
  if (trend != null && Math.abs(trend) < 0.15 && evidence.compositionImproving) {
    out.push({
      id: "recomposition-holding",
      headline: "No change — the scale is stable because composition is changing",
      reason:
        "Your body weight is stable while measurements or strength are improving. That is recomposition, not a stall, and Reserve is not changing the plan on the basis of the scale alone.",
      requiresConfirmation: false,
    });
  }

  // Genuinely stable with high adherence → one small progression lever.
  if (
    trend != null && Math.abs(trend) < 0.15 && !evidence.compositionImproving &&
    (evidence.adherence ?? 0) >= 0.85 && !evidence.strengthDeclining &&
    !(poorSleep || lowReadiness)
  ) {
    out.push({
      id: "single-lever-progression",
      headline: "Advance one lever",
      reason:
        "Weight is stable, adherence is high, recovery is holding, and performance is maintained. Reserve recommends one adjustment — a modest conditioning progression or a step-target change — rather than several at once, so the next reading is interpretable.",
      conditioningMultiplier: 1.12,
      requiresConfirmation: true,
    });
  }

  // Low adherence → shrink the plan rather than restate it.
  if ((evidence.adherence ?? 1) < 0.6) {
    out.push({
      id: "adherence-reduction",
      headline: "Reduce the plan to what is actually being completed",
      reason:
        "Adherence is below 60%. Reserve is reducing planned volume so the plan matches what is really happening — a plan completed 55% of the time is not the plan you are on.",
      volumeMultiplier: 0.8,
      requiresConfirmation: true,
    });
  }

  return out;
}
