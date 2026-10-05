/* ════════════════════════════════════════════════════════════════════════
   INSIGHT LIFECYCLE — deterministic state transitions.

   An insight is not a fact that is true forever. It can strengthen, weaken,
   conflict, be superseded by a phase-specific finding, or expire when the
   athlete stops producing comparable evidence.

   Two rules govern everything here:

     1. Identity is stable. The same persistent pattern keeps the same id
        across rebuilds, so the model never duplicates itself.
     2. Nothing is deleted. Insights that leave the active set are archived
        with a reason and keep their supporting evidence.
   ════════════════════════════════════════════════════════════════════════ */

import { calculateResponseConfidence, confidenceRank } from "./confidence";
import { assessContradiction, type ObservationContext } from "./contradiction";
import type {
  ResponseConfidenceInput,
  ResponseInsight,
  ResponseInsightStatus,
} from "./types";

/** How long an insight survives without new comparable evidence. */
export const INSIGHT_STALE_DAYS = 42;

export type LifecycleTransition =
  | "created"
  | "strengthened"
  | "maintained"
  | "weakened"
  | "conflicted"
  | "superseded"
  | "expired"
  | "archived";

export type LifecycleResult = {
  insight: ResponseInsight;
  transition: LifecycleTransition;
  /** Human-readable reason for the transition — surfaced in the log. */
  reason: string;
};

export type UpdateInsightInput = {
  existingInsight: ResponseInsight | null;
  /** The freshly derived insight for the same pattern key. */
  candidate: ResponseInsight;
  context: {
    now: string;
    supportingContext: ObservationContext;
    contradictingContext: ObservationContext;
    /** Set when this candidate replaces the prior one because the phase changed. */
    supersedes?: boolean;
  };
};

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

function statusFromConfidence(
  confidence: ResponseInsight["confidence"],
  contradictionEffect: ReturnType<typeof assessContradiction>["effect"],
): ResponseInsightStatus {
  if (contradictionEffect === "conflicts-insight") return "conflicted";
  if (contradictionEffect === "weakens-insight") return "weakening";
  switch (confidence) {
    case "established": return "established";
    case "moderate": return "active";
    case "emerging": return "emerging";
    default: return "insufficient";
  }
}

/**
 * Merge a freshly derived candidate into the existing insight for the same
 * pattern, producing the next state and an explainable transition.
 */
export function updateResponseInsight(input: UpdateInsightInput): LifecycleResult {
  const { existingInsight, candidate, context } = input;
  const contradiction = assessContradiction({
    supportingEvidenceIds: candidate.evidence.supportingEvidenceIds,
    contradictingEvidenceIds: candidate.evidence.contradictingEvidenceIds,
    supportingContext: context.supportingContext,
    contradictingContext: context.contradictingContext,
    currentConfidence: existingInsight?.confidence ?? candidate.confidence,
  });

  const status = statusFromConfidence(candidate.confidence, contradiction.effect);

  // ── New pattern ──────────────────────────────────────────────────────
  if (!existingInsight) {
    return {
      insight: {
        ...candidate,
        status,
        createdAt: context.now,
        updatedAt: context.now,
        limitations: [...candidate.limitations, ...(contradiction.effect !== "none" ? [contradiction.explanation] : [])],
      },
      transition: "created",
      reason: `Reserve began tracking this pattern from ${candidate.sample.comparableObservations} comparable observation${candidate.sample.comparableObservations === 1 ? "" : "s"}.`,
    };
  }

  // ── Supersession: the context changed materially ─────────────────────
  if (contradiction.effect === "supersedes-insight" || context.supersedes) {
    return {
      insight: {
        ...existingInsight,
        status: "superseded",
        updatedAt: context.now,
        supersededByInsightId: candidate.id === existingInsight.id ? undefined : candidate.id,
        archiveReason: contradiction.explanation,
        limitations: [...existingInsight.limitations, contradiction.explanation],
      },
      transition: "superseded",
      reason: contradiction.explanation,
    };
  }

  // ── Expiry: no comparable evidence for too long ──────────────────────
  const staleDays = daysBetween(candidate.sample.lastObservedAt, context.now);
  if (staleDays > INSIGHT_STALE_DAYS) {
    return {
      insight: {
        ...existingInsight,
        status: "expired",
        updatedAt: context.now,
        expiresAt: context.now,
        archiveReason: `No comparable evidence for ${staleDays} days, so this no longer describes how you are currently responding.`,
        limitations: [...existingInsight.limitations, "Expired — awaiting fresh comparable evidence."],
      },
      transition: "expired",
      reason: `No comparable evidence for ${staleDays} days.`,
    };
  }

  const previousRank = confidenceRank(existingInsight.confidence);
  const nextRank = confidenceRank(candidate.confidence);

  const merged: ResponseInsight = {
    ...candidate,
    id: existingInsight.id,
    createdAt: existingInsight.createdAt,
    updatedAt: context.now,
    status,
    limitations: [
      ...candidate.limitations,
      ...(contradiction.effect !== "none" && contradiction.effect !== "limits-confidence"
        ? [contradiction.explanation]
        : []),
    ],
  };

  // A transition describes a CHANGE. An insight that was already weakening and
  // is still weakening has not transitioned — reporting it as a fresh
  // weakening on every rebuild floods the log with events that never happened.
  if (existingInsight.status === status && previousRank === nextRank) {
    return {
      insight: merged,
      transition: "maintained",
      reason: "New evidence is consistent with what Reserve already observed.",
    };
  }

  if (contradiction.effect === "conflicts-insight") {
    return {
      insight: merged,
      transition: "conflicted",
      reason: contradiction.explanation,
    };
  }
  if (contradiction.effect === "weakens-insight" || nextRank < previousRank) {
    return {
      insight: merged,
      transition: "weakened",
      reason:
        contradiction.effect === "weakens-insight"
          ? contradiction.explanation
          : `Confidence fell from ${existingInsight.confidence} to ${candidate.confidence} as new evidence arrived.`,
    };
  }
  if (nextRank > previousRank) {
    return {
      insight: merged,
      transition: "strengthened",
      reason: `Confidence rose from ${existingInsight.confidence} to ${candidate.confidence} on ${candidate.sample.comparableObservations} comparable observations.`,
    };
  }
  return {
    insight: merged,
    transition: "maintained",
    reason: "New evidence is consistent with what Reserve already observed.",
  };
}

/** Recompute an insight's confidence from its own sample. Used by rebuilds so
    confidence never drifts from the evidence it claims to rest on. */
export function gradeInsight(
  insight: ResponseInsight,
  qualityInput: Pick<ResponseConfidenceInput, "evidenceQuality" | "missingCriticalContext" | "distinctDates">,
): ResponseInsight {
  const result = calculateResponseConfidence({
    comparableObservations: insight.sample.comparableObservations,
    supportingObservations: insight.sample.supportingObservations,
    contradictingObservations: insight.sample.contradictingObservations,
    weeksRepresented: insight.sample.weeksRepresented.length,
    phasesRepresented: insight.sample.phasesRepresented.length,
    evidenceQuality: qualityInput.evidenceQuality,
    missingCriticalContext: qualityInput.missingCriticalContext,
    distinctDates: qualityInput.distinctDates,
  });
  return {
    ...insight,
    confidence: result.confidence,
    limitations: [...new Set([...insight.limitations, ...result.limitingReasons])],
  };
}

/** Whether an insight currently sits in the active set. */
export function isActiveInsight(insight: ResponseInsight): boolean {
  return !["superseded", "expired", "archived"].includes(insight.status);
}
