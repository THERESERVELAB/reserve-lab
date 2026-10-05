"use client";

/* ════════════════════════════════════════════════════════════════════════
   useResponseModel — the single source of the athlete's response model.

   Personal Command, the Response Profile, Training Command, Nutrition,
   Recovery, and the Decision Log all read this hook. No surface builds
   its own model and no surface invents an insight.

   Performance discipline: the model is rebuilt from the evidence ledger only
   when the ledger, the decision history, or the program actually change. The
   heavy evidence graph is never rebuilt on an unrelated render.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useProgramHorizon } from "@/lib/hooks/useProgramHorizon";
import { buildResponseModel } from "@/lib/response-model/build";
import {
  acceptRecommendation,
  declineRecommendation,
  deferRecommendation,
  type DecisionResult,
} from "@/lib/response-model/apply";
import type {
  AthleteResponseModel,
  ResponseEvent,
  ResponseInsight,
  ResponseRecommendation,
  WeeklyResponseReview,
} from "@/lib/response-model/types";
import { buildWeeklyResponseReview, upsertWeeklyResponseReview } from "@/lib/response-model/weekly-review";
import {
  bodyCompositionEvidenceFromStore,
  nutritionEvidenceFromStore,
  readinessEvidenceFromStore,
} from "@/lib/response-evidence/from-store";
import { resolveLiveResponseActivities } from "@/lib/response-evidence/live-activities";
import type { ResponseActivity, ResponseEvidenceBundle } from "@/lib/response-evidence/types";
import type { ResponseEvidenceInput } from "@/lib/response-evidence/types";
import { appendReserveDecision } from "@/lib/training/session-execution";

export type ResponseModelResult = {
  model: AthleteResponseModel;
  /** Insights the athlete can act on or read, strongest first. */
  activeInsights: ResponseInsight[];
  pendingRecommendations: ResponseRecommendation[];
  events: ResponseEvent[];
  evidence: ResponseEvidenceBundle;
  liveActivities: ResponseActivity[];
  weeklyReviews: WeeklyResponseReview[];
  /** True when there is not yet enough evidence to say anything. */
  stillLearning: boolean;
  accept: (recommendationId: string, note?: string) => DecisionResult;
  decline: (recommendationId: string, note?: string) => DecisionResult;
  defer: (recommendationId: string) => DecisionResult;
};

export function useResponseModel(now?: Date): ResponseModelResult {
  const executionHistory = useAthleteDashboardStore((s) => s.trainingSession.executionHistory);
  const weekSummaries = useAthleteDashboardStore((s) => s.trainingSession.weekExecutionSummaries);
  const decisions = useAthleteDashboardStore((s) => s.trainingSession.decisionHistory);
  const recurringActivities = useAthleteDashboardStore((s) => s.programHorizon.recurringActivities);
  const sleepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs);
  const engagementEvents = useAthleteDashboardStore((s) => s.engagement.events);
  const physiqueEntries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const stored = useAthleteDashboardStore((s) => s.responseModel);
  const setResponseModel = useAthleteDashboardStore((s) => s.setResponseModel);
  const appendResponseEvents = useAthleteDashboardStore((s) => s.appendResponseEvents);
  const setWeeklyResponseReview = useAthleteDashboardStore((s) => s.setWeeklyResponseReview);
  const setProgramHorizon = useAthleteDashboardStore((s) => s.setProgramHorizon);

  const { horizon, currentWeek, snapshot } = useProgramHorizon(now);

  const nowISO = useMemo(() => (now ?? new Date()).toISOString(), [now]);

  const liveActivityResolution = useMemo(
    () => resolveLiveResponseActivities({
      horizon,
      recurringActivities,
      decisions,
      executionRecords: executionHistory,
      now: nowISO,
    }),
    [horizon, recurringActivities, decisions, executionHistory, nowISO],
  );

  const readiness = useMemo(
    () => readinessEvidenceFromStore(engagementEvents, physiqueEntries),
    [engagementEvents, physiqueEntries],
  );
  const bodyComposition = useMemo(
    () => bodyCompositionEvidenceFromStore(physiqueEntries),
    [physiqueEntries],
  );
  const nutrition = useMemo(
    () => nutritionEvidenceFromStore(physiqueEntries, snapshot.nutrition.phase),
    [physiqueEntries, snapshot.nutrition.phase],
  );

  const evidenceInput = useMemo<ResponseEvidenceInput>(
    () => ({
      athleteId: snapshot.athleteId,
      executionRecords: executionHistory,
      weekSummaries,
      activities: liveActivityResolution.activities,
      sleepLogs,
      readiness,
      bodyComposition,
      nutrition,
    }),
    [snapshot.athleteId, executionHistory, weekSummaries, liveActivityResolution.activities, sleepLogs, readiness, bodyComposition, nutrition],
  );

  // Weeks that must never be revised: completed, active, or carrying a
  // started session in the ledger.
  const protectedWeeks = useMemo(() => {
    const weeks = new Set<number>();
    for (const record of executionHistory) {
      if (record.weekNumber == null) continue;
      if (record.status === "started" || record.status === "partial") weeks.add(record.weekNumber);
    }
    if (horizon) {
      for (const week of horizon.weeks) {
        if (week.status === "completed" || week.status === "active") weeks.add(week.weekNumber);
      }
    }
    return [...weeks].sort((a, b) => a - b);
  }, [executionHistory, horizon]);

  const built = useMemo(
    () =>
      buildResponseModel({
        evidenceInput,
        previousModel: stored.model,
        context: {
          now: nowISO,
          programId: horizon?.programId,
          currentPhaseId: horizon?.weeks.find((w) => w.weekNumber === currentWeek)?.phaseId,
          currentNutritionPhase: snapshot.nutrition.phase,
          completedWeeks: horizon?.weeks.filter((w) => w.status === "completed").length ?? 0,
          currentWeek,
          protectedWeeks,
        },
      }),
    // `stored.model` is intentionally part of this: the rebuild MERGES the
    // prior model so decisions survive. It is stable between decisions because
    // the build is deterministic.
    [evidenceInput, stored.model, nowISO, horizon, currentWeek, snapshot.nutrition.phase, protectedWeeks],
  );

  // Persist the rebuilt model and any new events, without looping: the write
  // only happens when the derived content actually differs from what is stored.
  const lastPersisted = useRef<string | null>(null);
  useEffect(() => {
    const signature = JSON.stringify({
      modelVersion: built.model.modelVersion,
      dataQuality: built.model.dataQuality,
      processed: built.model.lastProcessedEvidenceIds,
      insights: built.model.activeInsights.map((i) => [i.id, i.status, i.confidence]),
      pending: built.model.pendingRecommendations.map((r) => [r.id, r.decision]),
      resolved: built.model.resolvedRecommendations.map((r) => [r.id, r.decision]),
    });
    if (lastPersisted.current === signature) return;
    lastPersisted.current = signature;
    setResponseModel(built.model);
    if (built.events.length > 0) appendResponseEvents(built.events);
  }, [built, setResponseModel, appendResponseEvents]);

  const generatedWeeklyReviews = useMemo(() => {
    if (!horizon) return [];
    const keys = new Set<number>([
      currentWeek,
      ...weekSummaries
        .filter((summary) => summary.programId === horizon.programId)
        .map((summary) => summary.weekNumber),
    ]);
    return [...keys].sort((a, b) => a - b).map((weekNumber) =>
      buildWeeklyResponseReview({
        programId: horizon.programId,
        weekNumber,
        summary: weekSummaries.find((summary) =>
          summary.programId === horizon.programId && summary.weekNumber === weekNumber,
        ),
        executionRecords: executionHistory,
        evidence: built.bundle,
        model: built.model,
        decisions,
        revisions: horizon.revisions,
      }),
    );
  }, [horizon, currentWeek, weekSummaries, executionHistory, built.bundle, built.model, decisions]);

  useEffect(() => {
    for (const review of generatedWeeklyReviews) {
      const existing = stored.weeklyReviews.find((candidate) =>
        candidate.programId === review.programId && candidate.weekNumber === review.weekNumber,
      );
      if (existing?.completedAt || JSON.stringify(existing) === JSON.stringify(review)) continue;
      setWeeklyResponseReview(review);
    }
  }, [generatedWeeklyReviews, stored.weeklyReviews, setWeeklyResponseReview]);

  const weeklyReviews = useMemo(
    () => generatedWeeklyReviews.reduce(
      (reviews, review) => upsertWeeklyResponseReview(reviews, review),
      stored.weeklyReviews,
    ),
    [generatedWeeklyReviews, stored.weeklyReviews],
  );

  const applyDecision = useCallback(
    (result: DecisionResult) => {
      if (result.blocked) return result;
      setResponseModel(result.model);
      if (result.events.length > 0) appendResponseEvents(result.events);
      if (result.horizon && result.revision) setProgramHorizon(result.horizon);
      if (result.decisionRecord) {
        // The decision ledger is the existing one — this does not create a
        // parallel history.
        useAthleteDashboardStore.setState((state) => ({
          trainingSession: {
            ...state.trainingSession,
            decisionHistory: appendReserveDecision(state.trainingSession.decisionHistory, result.decisionRecord!),
          },
        }));
      }
      // Force the next rebuild to see the new decision state.
      lastPersisted.current = null;
      return result;
    },
    [setResponseModel, appendResponseEvents, setProgramHorizon],
  );

  const accept = useCallback(
    (recommendationId: string, note?: string) =>
      applyDecision(
        acceptRecommendation({
          model: built.model, horizon, recommendationId, now: nowISO, protectedWeeks, note,
        }),
      ),
    [applyDecision, built.model, horizon, nowISO, protectedWeeks],
  );

  const decline = useCallback(
    (recommendationId: string, note?: string) =>
      applyDecision(declineRecommendation({ model: built.model, horizon, recommendationId, now: nowISO, note })),
    [applyDecision, built.model, horizon, nowISO],
  );

  const defer = useCallback(
    (recommendationId: string) =>
      applyDecision(deferRecommendation({ model: built.model, horizon, recommendationId, now: nowISO })),
    [applyDecision, built.model, horizon, nowISO],
  );

  const activeInsights = useMemo(
    () => rankInsights(built.model.activeInsights),
    [built.model.activeInsights],
  );

  return {
    model: built.model,
    activeInsights,
    pendingRecommendations: built.model.pendingRecommendations,
    events: stored.events,
    evidence: built.bundle,
    liveActivities: liveActivityResolution.activities,
    weeklyReviews,
    stillLearning: built.model.dataQuality.overallConfidence === "insufficient",
    accept,
    decline,
    defer,
  };
}

/** Strongest and most actionable first — the order the UI presents. */
export function rankInsights(insights: ResponseInsight[]): ResponseInsight[] {
  const confidenceRank = { insufficient: 0, emerging: 1, moderate: 2, established: 3 } as const;
  return [...insights].sort((a, b) => {
    const byConfidence = confidenceRank[b.confidence] - confidenceRank[a.confidence];
    if (byConfidence !== 0) return byConfidence;
    const byComparable = b.sample.comparableObservations - a.sample.comparableObservations;
    if (byComparable !== 0) return byComparable;
    return a.id.localeCompare(b.id);
  });
}
