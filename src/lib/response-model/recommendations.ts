/* ════════════════════════════════════════════════════════════════════════
   RECOMMENDATION ENGINE

   Translates sufficiently supported insights into proposed coaching changes.

   The governing idea of this whole phase lives here: Reserve should not
   change the program to demonstrate intelligence. "Maintain current plan" is
   a real recommendation, and when the evidence does not justify intervention
   it is the correct one.

   Approval policy is centralized. No detector decides for itself whether a
   change is material.
   ════════════════════════════════════════════════════════════════════════ */

import { CONCERNING_PAIN_LEVEL } from "./domains";
import { blocksMaterialAction } from "./contradiction";
import type {
  RecommendationCategory,
  RecommendationMateriality,
  ResponseAdjustment,
  ResponseConfidence,
  ResponseEvent,
  ResponseInsight,
  ResponseRecommendation,
} from "./types";

/* ─── Centralized approval policy ─────────────────────────────────────── */

/** Categories that always require the athlete to approve before anything moves. */
export const APPROVAL_REQUIRED_CATEGORIES: RecommendationCategory[] = [
  "volume-adjustment",
  "frequency-adjustment",
  "exercise-promotion",
  "exercise-substitution",
  "exercise-regression",
  "conditioning-adjustment",
  "schedule-adjustment",
  "deload",
];

/** Categories Reserve may act on under the low-risk policy, and which still
    create a decision record because they change output. */
export const LOW_RISK_CATEGORIES: RecommendationCategory[] = ["recovery-adjustment"];

/** Categories that never change the program at all. */
export const INFORMATIONAL_CATEGORIES: RecommendationCategory[] = [
  "maintain",
  "nutrition-review",
  "adherence-review",
  "professional-review",
];

export function materialityFor(category: RecommendationCategory, confidence: ResponseConfidence): RecommendationMateriality {
  if (INFORMATIONAL_CATEGORIES.includes(category)) return "informational";
  if (category === "frequency-adjustment" || category === "deload" || category === "schedule-adjustment") return "high";
  if (category === "volume-adjustment" || category === "exercise-substitution" || category === "conditioning-adjustment") {
    return confidence === "established" ? "high" : "moderate";
  }
  if (LOW_RISK_CATEGORIES.includes(category)) return "low";
  return "moderate";
}

export function approvalFor(
  category: RecommendationCategory,
  materiality: RecommendationMateriality,
): { required: boolean; reason: string } {
  if (INFORMATIONAL_CATEGORIES.includes(category)) {
    return { required: false, reason: "Nothing in your program changes, so there is nothing to approve." };
  }
  if (APPROVAL_REQUIRED_CATEGORIES.includes(category)) {
    return {
      required: true,
      reason: "This changes the structure of your future weeks, so it is your decision to make.",
    };
  }
  if (materiality === "low") {
    return {
      required: false,
      reason: "A low-risk adjustment Reserve can apply directly. It is still recorded so you can see and reverse it.",
    };
  }
  return { required: true, reason: "This materially changes your plan." };
}

/** After a decline, the same recommendation stays suppressed this long. */
export const DECLINE_SUPPRESSION_DAYS = 28;
/** A pending recommendation expires if never decided. */
export const RECOMMENDATION_TTL_DAYS = 42;

function addDays(iso: string, days: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * 86_400_000).toISOString();
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

/* ─── Building ────────────────────────────────────────────────────────── */

export type BuildRecommendationsInput = {
  athleteId: string;
  programId: string;
  insights: ResponseInsight[];
  previousRecommendations: ResponseRecommendation[];
  now: string;
  currentWeek: number;
  protectedWeeks: number[];
};

export type BuildRecommendationsResult = {
  pending: ResponseRecommendation[];
  resolved: ResponseRecommendation[];
  events: ResponseEvent[];
};

type Seed = {
  key: string;
  category: RecommendationCategory;
  scope: ResponseRecommendation["scope"];
  summary: string;
  reason: string;
  expectedEffect: string[];
  tradeoffs: string[];
  whatChanges: string[];
  whatRemainsUnchanged: string[];
  insight: ResponseInsight;
  adjustment?: ResponseAdjustment;
};

function seedFor(insight: ResponseInsight): Seed | null {
  // Concerning pain routes to professional review regardless of confidence.
  if (insight.domain === "pain") {
    const level = Number(/level (\d+)/.exec(insight.magnitude?.description ?? "")?.[1] ?? 0);
    if (level >= CONCERNING_PAIN_LEVEL) {
      return {
        key: `professional-review:${insight.patternKey}`,
        category: "professional-review",
        scope: "next-session",
        summary: `Have the discomfort you reported during ${insight.targetLabel} looked at before continuing it.`,
        reason: `${insight.finding} Reserve records what you report and is not able to assess it.`,
        expectedEffect: ["You get a qualified opinion before this becomes a longer problem."],
        tradeoffs: ["You may need to pause or modify this movement in the meantime."],
        whatChanges: ["Nothing in your program changes automatically."],
        whatRemainsUnchanged: ["Your protocol, your week, and every other movement."],
        insight,
      };
    }
    if (!insight.recommendationEligibility.eligible) return null;
    if (insight.sample.comparableObservations < 2) return null;
    return {
      key: `exercise-substitution:${insight.patternKey}`,
      category: "exercise-substitution",
      scope: "future-weeks",
      summary: `Swap ${insight.targetLabel} for a variation you have tolerated better.`,
      reason: insight.finding,
      expectedEffect: ["The pattern keeps its weekly exposure without the movement you have repeatedly found uncomfortable."],
      tradeoffs: ["A different variation may load the target slightly differently."],
      whatChanges: [`${insight.targetLabel} is replaced in future unstarted weeks.`],
      whatRemainsUnchanged: ["Your weekly structure, training frequency, and every other movement."],
      insight,
      adjustment: { kind: "exercise-preference", deprioritisedExerciseId: insight.targetId },
    };
  }

  if (!insight.recommendationEligibility.eligible) return null;
  if (blocksMaterialAction(insight)) return null;

  switch (insight.domain) {
    case "volume": {
      // Only act when the evidence actually shows a ceiling. A clean productive
      // range with no decline above it is a reason to leave things alone.
      // "mixed" is set by the detector precisely when a decline ceiling exists.
      if (insight.magnitude?.direction !== "mixed") {
        return {
          key: `maintain:${insight.patternKey}`,
          category: "maintain",
          scope: "future-weeks",
          summary: `Keep ${insight.targetLabel} volume where it is.`,
          reason: `${insight.finding} There is no evidence that changing it would help.`,
          expectedEffect: ["The structure that has been working continues."],
          tradeoffs: ["If you want a faster rate of change, that is a conversation to have deliberately rather than by drift."],
          whatChanges: ["Nothing."],
          whatRemainsUnchanged: [`${insight.targetLabel} volume, frequency, and movement selection.`],
          insight,
          adjustment: { kind: "none" },
        };
      }
      return {
        key: `volume-adjustment:${insight.patternKey}`,
        category: "volume-adjustment",
        scope: "future-weeks",
        summary: `Return ${insight.targetLabel} volume to the range that has been working.`,
        reason: insight.finding,
        expectedEffect: ["Weekly work returns to the band your own sessions have progressed in."],
        tradeoffs: ["Total weekly volume falls, which some athletes read as doing less."],
        whatChanges: [`Future unstarted weeks reduce ${insight.targetLabel} set targets toward the observed productive range.`],
        whatRemainsUnchanged: [`${insight.targetLabel} frequency, your movement selection, and the current phase.`],
        insight,
        adjustment: { kind: "weekly-volume", targetId: insight.targetId, volumeMultiplier: 0.88 },
      };
    }

    case "frequency": {
      return {
        key: `maintain:${insight.patternKey}`,
        category: "maintain",
        scope: "future-weeks",
        summary: `Keep ${insight.targetLabel} at its current weekly exposure.`,
        reason: `${insight.finding} Reserve prefers to leave a productive structure alone.`,
        expectedEffect: ["The exposure pattern your sessions have progressed on continues."],
        tradeoffs: ["An untested exposure count stays untested for now."],
        whatChanges: ["Nothing."],
        whatRemainsUnchanged: [`${insight.targetLabel} exposure count and spacing.`],
        insight,
        adjustment: { kind: "none" },
      };
    }

    case "exercise": {
      if (insight.magnitude?.direction === "positive") {
        return {
          key: `exercise-promotion:${insight.patternKey}`,
          category: "exercise-promotion",
          scope: "next-phase",
          summary: `Make ${insight.targetLabel} the anchor for this pattern.`,
          reason: insight.finding,
          expectedEffect: ["The movement you have progressed on most reliably leads the pattern."],
          tradeoffs: ["Less variation in this slot, which some athletes find monotonous."],
          whatChanges: [`${insight.targetLabel} is preferred in the next phase's future weeks.`],
          whatRemainsUnchanged: ["Your weekly structure, volume, and frequency."],
          insight,
          adjustment: { kind: "exercise-preference", preferredExerciseId: insight.targetId },
        };
      }
      if (insight.magnitude?.direction === "negative") {
        return {
          key: `exercise-regression:${insight.patternKey}`,
          category: "exercise-regression",
          scope: "future-weeks",
          summary: `Reset the load on ${insight.targetLabel} and rebuild.`,
          reason: insight.finding,
          expectedEffect: ["A repeatable starting point instead of repeatedly missing the same target."],
          tradeoffs: ["Working loads step back before they step forward."],
          whatChanges: [`${insight.targetLabel} starts future weeks from a lower, repeatable load.`],
          whatRemainsUnchanged: ["The movement stays in the plan, and everything else is untouched."],
          insight,
          adjustment: { kind: "exercise-preference", deprioritisedExerciseId: insight.targetId },
        };
      }
      return null;
    }

    case "conditioning": {
      return {
        key: `conditioning-adjustment:${insight.patternKey}`,
        category: "conditioning-adjustment",
        scope: "future-weeks",
        summary: `Give ${insight.targetLabel} more separation from lower-body training.`,
        reason: insight.finding,
        expectedEffect: ["The conditioning stays in your week; the lower-body session stops inheriting its fatigue."],
        tradeoffs: ["Your week becomes slightly less flexible about which day the conditioning lands on."],
        whatChanges: ["Future unstarted weeks separate the two by at least another day."],
        whatRemainsUnchanged: [
          "The conditioning itself, its duration, and your protocol's hybrid identity.",
        ],
        insight,
        adjustment: { kind: "conditioning-separation", targetId: insight.targetId, minimumSeparationHours: 48 },
      };
    }

    case "recovery": {
      return {
        key: `recovery-adjustment:${insight.patternKey}`,
        category: "recovery-adjustment",
        scope: "next-session",
        summary: "Reserve will flag the sessions this pattern affects.",
        reason: insight.finding,
        expectedEffect: ["You see the relevant recovery context before the session rather than after it."],
        tradeoffs: ["None — nothing about the plan changes."],
        whatChanges: ["A recovery note appears on the affected sessions."],
        whatRemainsUnchanged: ["Your program, volume, frequency, and movement selection."],
        insight,
        adjustment: { kind: "none" },
      };
    }

    case "body-composition": {
      if (insight.magnitude?.direction === "negative") {
        return {
          key: `nutrition-review:${insight.patternKey}`,
          category: "nutrition-review",
          scope: "current-week",
          summary: "Review total demand and intake before adding anything.",
          reason: insight.finding,
          expectedEffect: ["The cause is identified before more work is added on top of it."],
          tradeoffs: ["Progress on the composition goal may pause while this is sorted out."],
          whatChanges: ["Nothing automatically. Reserve is not changing your intake targets on this evidence."],
          whatRemainsUnchanged: ["Your primary resistance work, which is what protects the muscle you have."],
          insight,
        };
      }
      return {
        key: `maintain:${insight.patternKey}`,
        category: "maintain",
        scope: "future-weeks",
        summary: "Keep going as you are.",
        reason: `${insight.finding} ${insight.interpretation}`,
        expectedEffect: ["The current direction continues."],
        tradeoffs: ["None."],
        whatChanges: ["Nothing."],
        whatRemainsUnchanged: ["Your training and your nutrition phase."],
        insight,
        adjustment: { kind: "none" },
      };
    }

    case "adherence": {
      return {
        key: `adherence-review:${insight.patternKey}`,
        category: "adherence-review",
        scope: "current-week",
        summary: "Log intake consistently before changing any target.",
        reason: insight.finding,
        expectedEffect: ["The next decision rests on what you actually ate rather than on a guess."],
        tradeoffs: ["It asks for more logging effort for a couple of weeks."],
        whatChanges: ["Nothing. Reserve will not reduce calories or add cardio on incomplete adherence data."],
        whatRemainsUnchanged: ["Your training, your calorie target, and your conditioning."],
        insight,
      };
    }

    default:
      return null;
  }
}

export function buildRecommendations(input: BuildRecommendationsInput): BuildRecommendationsResult {
  const { athleteId, programId, insights, previousRecommendations, now, currentWeek, protectedWeeks } = input;

  const previousByKey = new Map<string, ResponseRecommendation>();
  for (const recommendation of previousRecommendations) {
    previousByKey.set(recommendationKey(recommendation), recommendation);
  }

  const events: ResponseEvent[] = [];
  const pending: ResponseRecommendation[] = [];
  const resolved: ResponseRecommendation[] = [];
  const producedKeys = new Set<string>();

  // The first week Reserve may touch: never a started or completed week.
  const effectiveWeek = nextRevisableWeek(currentWeek, protectedWeeks);

  // "Maintain" is a real recommendation, but one per muscle is noise rather
  // than coaching. Only the best-evidenced maintain per domain is surfaced.
  const orderedInsights = prioritiseInsights(insights);

  for (const insight of orderedInsights) {
    const seed = seedFor(insight);
    if (!seed) continue;
    if (seed.category === "maintain") {
      // At most one maintain per domain, and only from the strongest insight
      // in it — the list is ordered by confidence so the first wins.
      const domainKey = `maintain-domain:${insight.domain}`;
      if (producedKeys.has(domainKey)) continue;
      producedKeys.add(domainKey);
    }
    const key = `${athleteId}:${seed.key}`;
    if (producedKeys.has(key)) continue;
    producedKeys.add(key);

    const previous = previousByKey.get(key);

    // A decided recommendation keeps its decision through every rebuild.
    if (previous && previous.decision !== "pending") {
      // A declined recommendation stays suppressed rather than nagging.
      if (previous.decision === "declined" && previous.suppressedUntil && previous.suppressedUntil > now) {
        resolved.push(previous);
        continue;
      }
      if (previous.decision === "declined" && (!previous.suppressedUntil || previous.suppressedUntil <= now)) {
        // The suppression window has passed. Only resurface when the evidence
        // has genuinely moved on — a stronger insight than when it was declined.
        const strengthened = insight.confidence === "established" && previous.confidence !== "established";
        if (!strengthened) {
          resolved.push(previous);
          continue;
        }
      } else {
        resolved.push(previous);
        continue;
      }
    }

    // A deferred recommendation stays pending and is not rebuilt from scratch.
    if (previous && previous.decision === "pending" && previous.decisionNote === "deferred") {
      pending.push(previous);
      continue;
    }

    const materiality = materialityFor(seed.category, insight.confidence);
    const approval = approvalFor(seed.category, materiality);

    const recommendation: ResponseRecommendation = {
      id: previous?.id ?? `recommendation:${key}`,
      athleteId,
      programId,
      insightIds: [insight.id],
      evidenceIds: insight.evidence.supportingEvidenceIds,
      category: seed.category,
      scope: seed.scope,
      summary: seed.summary,
      reason: seed.reason,
      expectedEffect: seed.expectedEffect,
      tradeoffs: seed.tradeoffs,
      whatChanges: seed.whatChanges,
      whatRemainsUnchanged: seed.whatRemainsUnchanged,
      confidence: insight.confidence,
      materiality,
      approval,
      decision: "pending",
      adjustment: seed.adjustment,
      createdAt: previous?.createdAt ?? now,
      effectiveWeek: seed.category === "maintain" || INFORMATIONAL_CATEGORIES.includes(seed.category)
        ? undefined
        : effectiveWeek,
      expiresAt: addDays(now, RECOMMENDATION_TTL_DAYS),
    };

    // Expire a stale pending recommendation rather than leaving it forever.
    if (previous && previous.decision === "pending" && daysBetween(previous.createdAt, now) > RECOMMENDATION_TTL_DAYS) {
      resolved.push({ ...previous, decision: "expired", decidedAt: now });
      continue;
    }

    pending.push(recommendation);
    if (!previous) {
      events.push({
        id: `event:${recommendation.id}:created:${now}`,
        type: "recommendation-created",
        at: now,
        domain: insight.domain,
        targetLabel: insight.targetLabel,
        observation: insight.finding,
        decision: recommendation.summary,
        reason: recommendation.reason,
        confidence: recommendation.confidence,
        affectedWeeks: recommendation.effectiveWeek != null ? [recommendation.effectiveWeek] : [],
      });
    }
  }

  // Carry forward decided recommendations whose insight no longer produces a
  // seed — the decision history must not vanish because evidence moved on.
  for (const [key, recommendation] of previousByKey) {
    if (producedKeys.has(key)) continue;
    if (recommendation.decision === "pending") {
      resolved.push({ ...recommendation, decision: "expired", decidedAt: now });
      continue;
    }
    if (!resolved.some((existing) => existing.id === recommendation.id)) resolved.push(recommendation);
  }

  return {
    pending: pending.sort((a, b) => a.id.localeCompare(b.id)),
    resolved: resolved.sort((a, b) => a.id.localeCompare(b.id)),
    events,
  };
}

/**
 * Actionable findings first, then by confidence, then by id for determinism.
 * This ordering is what makes "one maintain per domain" pick the best-evidenced
 * one rather than whichever happened to sort first alphabetically.
 */
function prioritiseInsights(insights: ResponseInsight[]): ResponseInsight[] {
  const confidenceRank: Record<ResponseConfidence, number> = {
    insufficient: 0, emerging: 1, moderate: 2, established: 3,
  };
  return [...insights].sort((a, b) => {
    const aActionable = a.magnitude?.direction === "negative" || a.sample.contradictingObservations > 0;
    const bActionable = b.magnitude?.direction === "negative" || b.sample.contradictingObservations > 0;
    if (aActionable !== bActionable) return aActionable ? -1 : 1;
    const byConfidence = confidenceRank[b.confidence] - confidenceRank[a.confidence];
    if (byConfidence !== 0) return byConfidence;
    const byComparable = b.sample.comparableObservations - a.sample.comparableObservations;
    if (byComparable !== 0) return byComparable;
    return a.id.localeCompare(b.id);
  });
}

export function recommendationKey(recommendation: ResponseRecommendation): string {
  return recommendation.id.replace(/^recommendation:/, "");
}

/** The first week Reserve is allowed to revise. */
export function nextRevisableWeek(currentWeek: number, protectedWeeks: number[]): number {
  const blocked = new Set(protectedWeeks);
  let week = currentWeek + 1;
  let guard = 0;
  while (blocked.has(week) && guard < 60) {
    week += 1;
    guard += 1;
  }
  return week;
}
