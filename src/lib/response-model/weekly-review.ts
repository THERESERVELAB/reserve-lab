/* ════════════════════════════════════════════════════════════════════════
   WEEKLY RESPONSE REVIEW

   A deterministic projection of the existing week-execution summary,
   Response Evidence, active model, recommendations, athlete decisions, and
   Program Horizon revisions. Completed snapshots are made immutable by the
   upsert helper below.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProgramRevision } from "@/lib/horizon/types";
import type { ResponseEvidenceBundle } from "@/lib/response-evidence/types";
import type {
  ReserveDecisionRecord,
  SessionExecutionRecord,
  WeekExecutionSummary,
} from "@/lib/training/session-execution";

import type {
  AthleteResponseModel,
  ResponseInsight,
  ResponseRecommendation,
  WeeklyResponseReview,
} from "./types";

export type BuildWeeklyResponseReviewInput = {
  programId: string;
  weekNumber: number;
  summary?: WeekExecutionSummary;
  executionRecords: SessionExecutionRecord[];
  evidence: ResponseEvidenceBundle;
  model: AthleteResponseModel;
  decisions: ReserveDecisionRecord[];
  revisions: ProgramRevision[];
};

const ACTIVE_STATUSES = new Set(["emerging", "active", "established", "conflicted", "weakening"]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function insightApplies(insight: ResponseInsight, weekNumber: number): boolean {
  return insight.sample.weeksRepresented.length === 0 || insight.sample.weeksRepresented.includes(weekNumber);
}

function recommendationApplies(
  recommendation: ResponseRecommendation,
  insightIds: Set<string>,
  weekNumber: number,
): boolean {
  if (!recommendation.insightIds.some((id) => insightIds.has(id))) return false;
  return recommendation.effectiveWeek == null || recommendation.effectiveWeek >= weekNumber;
}

export function buildWeeklyResponseReview(
  input: BuildWeeklyResponseReviewInput,
): WeeklyResponseReview {
  const summary = input.summary;
  const weekRecords = input.executionRecords.filter(
    (record) => record.programId === input.programId && record.weekNumber === input.weekNumber,
  );
  const completed = Boolean(
    summary &&
    summary.unresolvedSessionCount === 0 &&
    (summary.status === "completed" || summary.status === "completed-with-deviations"),
  );
  const insights = input.model.activeInsights.filter(
    (insight) => ACTIVE_STATUSES.has(insight.status) && insightApplies(insight, input.weekNumber),
  );
  const insightIds = new Set(insights.map((insight) => insight.id));
  const recommendations = [
    ...input.model.pendingRecommendations,
    ...input.model.resolvedRecommendations.filter((item) => item.decision === "accepted" || item.decision === "applied"),
  ].filter((item) => recommendationApplies(item, insightIds, input.weekNumber));

  const comparableObservations = input.evidence.performance.filter((observation) =>
    observation.comparableToPrevious &&
    weekRecords.some((record) => record.id === observation.executionRecordId),
  ).length;

  const maintainInsightIds = new Set(
    recommendations
      .filter((recommendation) => recommendation.category === "maintain")
      .flatMap((recommendation) => recommendation.insightIds),
  );
  const stablePatterns = insights.filter(
    (insight) => insight.status === "established" || insight.confidence === "established" || maintainInsightIds.has(insight.id),
  ).map((insight) => insight.finding);
  const emergingPatterns = insights.filter(
    (insight) => insight.status === "emerging" || insight.confidence === "emerging",
  ).map((insight) => insight.finding);
  const contradictedPatterns = insights.filter(
    (insight) => insight.status === "conflicted",
  ).map((insight) => insight.finding);

  const maintainDecisions = recommendations
    .filter((recommendation) => recommendation.category === "maintain")
    .map((recommendation) => recommendation.summary);
  const actionableRecommendations = recommendations
    .filter((recommendation) => recommendation.category !== "maintain")
    .map((recommendation) => recommendation.summary);

  const matchingDecisions = input.decisions.filter(
    (decision) => decision.programId === input.programId &&
      (decision.affectedWeekNumbers?.includes(input.weekNumber) ?? false) &&
      decision.athleteDecision !== "declined" &&
      decision.athleteDecision !== "deferred",
  );
  const matchingRevisions = input.revisions.filter((revision) => revision.affectedWeeks.includes(input.weekNumber));

  const missingData: string[] = [];
  if (!summary) missingData.push("No Week Execution Summary is available yet.");
  if ((summary?.unresolvedSessionCount ?? 0) > 0) {
    missingData.push(`${summary!.unresolvedSessionCount} scheduled session${summary!.unresolvedSessionCount === 1 ? " remains" : "s remain"} unresolved.`);
  }
  if ((summary?.partialSessionCount ?? 0) > 0) missingData.push("Partial sessions remain visible and limit the week conclusion.");
  if (input.evidence.recovery.every((entry) => entry.sleepHours == null)) missingData.push("Recorded sleep is unavailable for this review.");
  if (input.evidence.recovery.every((entry) => entry.readinessScore == null)) missingData.push("Recorded readiness is unavailable for this review.");
  if (input.evidence.bodyComposition.every((entry) => entry.calorieActual == null)) missingData.push("Calorie intake is not logged.");
  if (input.evidence.bodyComposition.every((entry) => entry.proteinActual == null)) missingData.push("Protein intake is not logged.");
  for (const domain of input.model.dataQuality.missingDomains) {
    missingData.push(`Response evidence is still missing for ${domain}.`);
  }

  return {
    programId: input.programId,
    weekNumber: input.weekNumber,
    completedAt: completed ? summary?.createdAt : undefined,
    evidenceSummary: {
      completedSessions: summary?.completedSessionCount ?? 0,
      partialSessions: summary?.partialSessionCount ?? 0,
      skippedSessions: summary?.skippedSessionCount ?? 0,
      replacementActivities: summary?.replacedSessionCount ?? 0,
      comparableObservations,
    },
    stablePatterns: unique(stablePatterns),
    emergingPatterns: unique(emergingPatterns),
    contradictedPatterns: unique(contradictedPatterns),
    maintainDecisions: unique([
      ...maintainDecisions,
      ...matchingDecisions
        .filter((decision) => /maintain|keep|unchanged/i.test(decision.decision))
        .map((decision) => decision.decision),
    ]),
    recommendations: unique([
      ...actionableRecommendations,
      ...matchingRevisions
        .filter((revision) => revision.responseMetadata)
        .map((revision) => revision.reason),
    ]),
    missingData: unique(missingData),
    // Confidence is copied from the active model. The weekly surface never
    // computes a competing confidence level.
    confidence: input.model.dataQuality.overallConfidence,
  };
}

export function upsertWeeklyResponseReview(
  reviews: WeeklyResponseReview[],
  review: WeeklyResponseReview,
  limit = 104,
): WeeklyResponseReview[] {
  const existing = reviews.find(
    (candidate) => candidate.programId === review.programId && candidate.weekNumber === review.weekNumber,
  );
  if (existing?.completedAt) return reviews;
  return [
    ...reviews.filter((candidate) =>
      candidate.programId !== review.programId || candidate.weekNumber !== review.weekNumber,
    ),
    JSON.parse(JSON.stringify(review)) as WeeklyResponseReview,
  ]
    .sort((a, b) => `${a.programId}:${a.weekNumber}`.localeCompare(`${b.programId}:${b.weekNumber}`))
    .slice(-limit);
}
