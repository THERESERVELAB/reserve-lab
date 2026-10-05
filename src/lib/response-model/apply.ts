/* ════════════════════════════════════════════════════════════════════════
   ATHLETE DECISIONS → PROGRAM REVISION

   The closing edge of the loop. An accepted recommendation becomes exactly
   ONE revision through the existing revision engine — this module never
   builds a revision record of its own.

   The immutability guarantees are enforced here as well as in the revision
   engine, because the safest place to protect history is every place that
   could touch it:

     • Completed weeks are never targeted.
     • Started and frozen weeks are never targeted.
     • The original projection is preserved by the revision engine.
     • Declining records the decision and suppresses the nag.
   ════════════════════════════════════════════════════════════════════════ */

import { currentWeekNumber } from "@/lib/horizon/generate";
import { reviseHorizon } from "@/lib/horizon/revise";
import type { ProgramHorizon, ProgramRevision, ProjectedProgramWeek } from "@/lib/horizon/types";
import { createReserveDecision, type ReserveDecisionRecord } from "@/lib/training/session-execution";

import { DECLINE_SUPPRESSION_DAYS, nextRevisableWeek } from "./recommendations";
import {
  RESPONSE_MODEL_VERSION,
  type AthleteResponseModel,
  type ResponseEvent,
  type ResponseRecommendation,
} from "./types";

function addDays(iso: string, days: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * 86_400_000).toISOString();
}

export type DecisionInput = {
  model: AthleteResponseModel;
  horizon: ProgramHorizon | null;
  recommendationId: string;
  now: string;
  /** Weeks that must not be revised — started, frozen, or completed. */
  protectedWeeks?: number[];
  note?: string;
};

export type DecisionResult = {
  model: AthleteResponseModel;
  horizon: ProgramHorizon | null;
  revision: ProgramRevision | null;
  decisionRecord: ReserveDecisionRecord | null;
  events: ResponseEvent[];
  blocked: boolean;
  blockedReason?: string;
};

function moveRecommendation(
  model: AthleteResponseModel,
  updated: ResponseRecommendation,
): AthleteResponseModel {
  return {
    ...model,
    updatedAt: updated.decidedAt ?? model.updatedAt,
    pendingRecommendations: model.pendingRecommendations.filter((item) => item.id !== updated.id),
    resolvedRecommendations: [
      ...model.resolvedRecommendations.filter((item) => item.id !== updated.id),
      updated,
    ].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/* ─── Accept ──────────────────────────────────────────────────────────── */

export function acceptRecommendation(input: DecisionInput): DecisionResult {
  const { model, horizon, recommendationId, now } = input;
  const recommendation = model.pendingRecommendations.find((item) => item.id === recommendationId);

  if (!recommendation) {
    return { model, horizon, revision: null, decisionRecord: null, events: [], blocked: true, blockedReason: "That recommendation is no longer pending." };
  }

  // Informational categories change nothing. Accepting one is acknowledgement,
  // not a program change, and it must not manufacture a revision.
  const adjustment = recommendation.adjustment;
  const changesProgram = Boolean(adjustment && adjustment.kind !== "none") && Boolean(horizon);

  let nextHorizon = horizon;
  let revision: ProgramRevision | null = null;

  if (changesProgram && horizon && adjustment) {
    const current = currentWeekNumber(horizon, new Date(now));
    // Weeks that already exist as history or are in flight are untouchable.
    const protectedWeeks = new Set([
      ...(input.protectedWeeks ?? []),
      ...horizon.weeks.filter((week) => week.status === "completed" || week.status === "active").map((week) => week.weekNumber),
    ]);
    const effectiveWeek = Math.max(
      recommendation.effectiveWeek ?? current + 1,
      nextRevisableWeek(current, [...protectedWeeks]),
    );

    const revisable = horizon.weeks.filter(
      (week) => week.weekNumber >= effectiveWeek && !protectedWeeks.has(week.weekNumber),
    );
    if (revisable.length === 0) {
      return {
        model, horizon, revision: null, decisionRecord: null, events: [], blocked: true,
        blockedReason: "There are no future unstarted weeks left in this block to change.",
      };
    }

    const result = reviseHorizon({
      horizon,
      reason: recommendation.summary,
      fromWeek: effectiveWeek,
      volumeMultiplier: adjustment.volumeMultiplier,
      conditioningMultiplier: adjustment.conditioningMultiplier,
      targetRegions: adjustment.kind === "weekly-volume" && adjustment.targetId ? [adjustment.targetId] : undefined,
      transformWeek: adjustment.kind === "conditioning-separation"
        ? separateConditioningFromLower
        : undefined,
      contextChange: [recommendation.reason],
      athleteConfirmed: true,
      now: new Date(now),
      responseMetadata: {
        recommendationId: recommendation.id,
        insightIds: recommendation.insightIds,
        evidenceIds: recommendation.evidenceIds,
        responseModelVersion: RESPONSE_MODEL_VERSION,
        approvedBy: recommendation.approval.required ? "athlete" : "reserve-low-risk-policy",
        approvedAt: now,
      },
    });
    nextHorizon = result.horizon;
    revision = result.revision;
  }

  const updated: ResponseRecommendation = {
    ...recommendation,
    decision: revision ? "applied" : "accepted",
    decidedAt: now,
    decisionNote: input.note,
    appliedRevisionId: revision?.id,
  };

  const decisionRecord = createReserveDecision({
    programId: recommendation.programId,
    category: revision ? "week-revision" : "athlete-decision",
    source: "athlete",
    observation: recommendation.reason,
    decision: recommendation.summary,
    reason: revision
      ? `Applied from week ${revision.effectiveWeek}. Completed and in-progress weeks were not touched.`
      : "Acknowledged. Nothing in the program changed.",
    affectedWeekNumbers: revision?.affectedWeeks ?? [],
    confidence: recommendation.confidence === "established" ? "high" : recommendation.confidence === "moderate" ? "moderate" : "low",
    athleteDecision: "accepted",
    createdAt: now,
    athleteId: recommendation.athleteId,
  });

  const events: ResponseEvent[] = [
    {
      id: `event:${recommendation.id}:accepted:${now}`,
      type: "recommendation-accepted",
      at: now,
      targetLabel: recommendation.summary,
      observation: recommendation.reason,
      decision: recommendation.summary,
      reason: recommendation.approval.reason,
      confidence: recommendation.confidence,
      affectedWeeks: revision?.affectedWeeks ?? [],
      athleteDecision: "accepted",
    },
  ];
  if (revision) {
    events.push({
      id: `event:${revision.id}:revised:${now}`,
      type: "program-revised",
      at: now,
      targetLabel: recommendation.summary,
      observation: recommendation.reason,
      decision: `Future weeks revised from week ${revision.effectiveWeek}.`,
      reason: recommendation.summary,
      confidence: recommendation.confidence,
      affectedWeeks: revision.affectedWeeks,
      athleteDecision: "accepted",
    });
  }

  return {
    model: moveRecommendation(model, updated),
    horizon: nextHorizon,
    revision,
    decisionRecord,
    events,
    blocked: false,
  };
}

/* ─── Decline ─────────────────────────────────────────────────────────── */

export function declineRecommendation(input: DecisionInput): DecisionResult {
  const { model, horizon, recommendationId, now } = input;
  const recommendation = model.pendingRecommendations.find((item) => item.id === recommendationId);
  if (!recommendation) {
    return { model, horizon, revision: null, decisionRecord: null, events: [], blocked: true, blockedReason: "That recommendation is no longer pending." };
  }

  const updated: ResponseRecommendation = {
    ...recommendation,
    decision: "declined",
    decidedAt: now,
    decisionNote: input.note,
    // The decline is respected. Reserve does not re-ask until the evidence
    // has genuinely moved on, and never sooner than this.
    suppressedUntil: addDays(now, DECLINE_SUPPRESSION_DAYS),
  };

  const decisionRecord = createReserveDecision({
    programId: recommendation.programId,
    category: "athlete-decision",
    source: "athlete",
    observation: recommendation.reason,
    decision: `Declined: ${recommendation.summary}`,
    reason: input.note?.trim() || "The athlete chose to keep the current plan.",
    affectedWeekNumbers: [],
    confidence: recommendation.confidence === "established" ? "high" : recommendation.confidence === "moderate" ? "moderate" : "low",
    athleteDecision: "declined",
    createdAt: now,
    athleteId: recommendation.athleteId,
  });

  return {
    model: moveRecommendation(model, updated),
    horizon,
    revision: null,
    decisionRecord,
    events: [
      {
        id: `event:${recommendation.id}:declined:${now}`,
        type: "recommendation-declined",
        at: now,
        targetLabel: recommendation.summary,
        observation: recommendation.reason,
        decision: "Kept the current plan",
        reason: input.note?.trim() || "The athlete declined the change.",
        confidence: recommendation.confidence,
        affectedWeeks: [],
        athleteDecision: "declined",
      },
    ],
    blocked: false,
  };
}

/* ─── Defer ───────────────────────────────────────────────────────────── */

export const DEFER_REVIEW_DAYS = 14;

export function deferRecommendation(input: DecisionInput): DecisionResult {
  const { model, horizon, recommendationId, now } = input;
  const recommendation = model.pendingRecommendations.find((item) => item.id === recommendationId);
  if (!recommendation) {
    return { model, horizon, revision: null, decisionRecord: null, events: [], blocked: true, blockedReason: "That recommendation is no longer pending." };
  }

  // A deferred recommendation stays PENDING — it has not been resolved — but
  // it is marked so rebuilds leave it alone and the athlete is not re-asked.
  const updated: ResponseRecommendation = {
    ...recommendation,
    decision: "pending",
    decisionNote: "deferred",
    suppressedUntil: addDays(now, DEFER_REVIEW_DAYS),
  };

  const decisionRecord = createReserveDecision({
    programId: recommendation.programId,
    category: "athlete-decision",
    source: "athlete",
    observation: recommendation.reason,
    decision: `Deferred: ${recommendation.summary}`,
    reason: `The athlete asked to decide later. Reserve will raise it again after ${DEFER_REVIEW_DAYS} days.`,
    affectedWeekNumbers: [],
    athleteDecision: "deferred",
    createdAt: now,
    athleteId: recommendation.athleteId,
  });

  return {
    model: {
      ...model,
      updatedAt: now,
      pendingRecommendations: model.pendingRecommendations
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => a.id.localeCompare(b.id)),
    },
    horizon,
    revision: null,
    decisionRecord,
    events: [
      {
        id: `event:${recommendation.id}:deferred:${now}`,
        type: "recommendation-deferred",
        at: now,
        targetLabel: recommendation.summary,
        observation: recommendation.reason,
        decision: "Decide later",
        reason: `Reserve will raise this again after ${DEFER_REVIEW_DAYS} days.`,
        confidence: recommendation.confidence,
        affectedWeeks: [],
        athleteDecision: "deferred",
      },
    ],
    blocked: false,
  };
}

/* ─── Structural transforms ───────────────────────────────────────────── */

const LOWER_TOKENS = /quad|hamstring|glute|calf|calve|leg|lower|posterior|hip/i;
const CONDITIONING_ARCHETYPES = new Set([
  "conditioning", "sport-conditioning", "zone2", "outdoor-distance", "sprint-power", "explosive",
]);

/**
 * Move conditioning that sits immediately before or after a lower-body day so
 * the two stop sharing a recovery window. The conditioning is KEPT — the
 * protocol's identity does not change, only the placement.
 */
export function separateConditioningFromLower(week: ProjectedProgramWeek): ProjectedProgramWeek {
  const days = week.weeklyStructure.map((day) => ({ ...day, emphasis: [...day.emphasis] }));
  const isLower = (i: number) =>
    days[i] && !days[i].recovery && LOWER_TOKENS.test(`${days[i].title} ${days[i].emphasis.join(" ")}`);
  const isConditioning = (i: number) => days[i] && !days[i].recovery && CONDITIONING_ARCHETYPES.has(days[i].archetype);

  for (let i = 0; i < days.length; i += 1) {
    if (!isConditioning(i)) continue;
    const adjacentLower = isLower(i - 1) || isLower(i + 1);
    if (!adjacentLower) continue;

    // Find a recovery slot at least two days away from any lower-body day.
    const target = days.findIndex((day, index) => {
      if (index === i || !day.recovery) return false;
      return !isLower(index - 1) && !isLower(index + 1);
    });
    if (target < 0) continue;

    const conditioning = days[i];
    days[i] = { ...days[target] };
    days[target] = conditioning;
    break;
  }

  return { ...week, weeklyStructure: days };
}
