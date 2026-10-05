"use client";

/* Development-only live-source tracer and synthetic integration simulations.
   This component is mounted only by /dev/training-architecture. */

import { useMemo, useState } from "react";

import { OptimizationEmptyState } from "@/components/response/OptimizationEmptyState";
import { fixtureSnapshot, FRIDAY_LOWER_CLASS } from "@/lib/athlete/fixtures";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { generateProgramHorizon } from "@/lib/horizon/generate";
import type { ProgramRevision } from "@/lib/horizon/types";
import { useResponseModel } from "@/lib/hooks/useResponseModel";
import { resolveLiveResponseActivities } from "@/lib/response-evidence/live-activities";
import { acceptRecommendation, declineRecommendation } from "@/lib/response-model/apply";
import { buildResponseModel } from "@/lib/response-model/build";
import { buildSimulationInput, runResponseSimulation, SIMULATION_NOW } from "@/lib/response-model/fixtures";
import { resolveOptimizationHistory } from "@/lib/response-model/optimization-history";
import { presentNutritionResponse, presentRecoveryResponse, resolveResponseSurface, selectTrainingSurfaceInsights } from "@/lib/response-model/surfaces";
import type { AthleteResponseModel } from "@/lib/response-model/types";
import { buildWeeklyResponseReview } from "@/lib/response-model/weekly-review";
import { createReserveDecision, type WeekExecutionSummary } from "@/lib/training/session-execution";

const INTEGRATION_SIMULATIONS = [
  "one-time-friday-class",
  "recurring-friday-class",
  "declined-class",
  "removed-recurring-class",
  "stable-weight-improving-performance",
  "rapid-decline-worsening-performance",
  "poor-nutrition-adherence",
  "recorded-poor-sleep",
  "missing-sleep",
  "applied-recommendation",
  "declined-recommendation",
  "completed-weekly-review",
  "incomplete-weekly-review",
  "empty-optimization-log",
  "productive-volume",
  "exercise-preference",
  "conditioning-proximity",
] as const;

type IntegrationSimulation = (typeof INTEGRATION_SIMULATIONS)[number];

const EMPTY_REVISIONS: ProgramRevision[] = [];

function syntheticHorizon() {
  const snapshot = fixtureSnapshot("grand-touring-with-friday-class")!;
  return generateProgramHorizon({
    protocolId: "reserve-grand-touring",
    snapshot,
    profile: deriveProgrammingProfile(snapshot),
    totalWeeks: 8,
    now: new Date("2026-08-17T08:00:00.000Z"),
    startDate: "2026-08-17",
  })!;
}

function activityDecision(status: "accepted" | "declined" | "cancelled", recurrence: "one-time" | "weekly", createdAt: string) {
  const activity = {
    ...FRIDAY_LOWER_CLASS,
    id: `synthetic-${recurrence}-friday-class`,
    recurrence,
    date: recurrence === "one-time" ? "2026-08-21" : undefined,
  };
  return createReserveDecision({
    id: `synthetic:${activity.id}:${status}:${createdAt}`,
    createdAt,
    category: "activity-reconciliation",
    source: "athlete",
    programId: syntheticHorizon().programId,
    observation: "Synthetic Friday class decision",
    decision: status,
    reason: "Development-only integration fixture",
    athleteDecision: status === "declined" ? "declined" : "accepted",
    activity: {
      activityId: activity.id,
      revisionId: "synthetic-revision-friday-class",
      status,
      effectiveWeek: 1,
      programStartDate: "2026-08-17",
      snapshot: activity,
    },
  });
}

function reviewSummary(completed: boolean): WeekExecutionSummary {
  return {
    id: "synthetic-response-program:W6:execution",
    programId: "synthetic-response-program",
    weekNumber: 6,
    createdAt: "2026-08-23T20:00:00.000Z",
    plannedSessionCount: 4,
    completedSessionCount: completed ? 4 : 2,
    partialSessionCount: completed ? 0 : 1,
    abandonedSessionCount: 0,
    skippedSessionCount: completed ? 0 : 1,
    replacedSessionCount: completed ? 1 : 0,
    unresolvedSessionCount: completed ? 0 : 1,
    addedActivityCount: completed ? 1 : 0,
    addedMovementCount: 0,
    completionPercent: completed ? 100 : 50,
    majorDeviations: completed ? ["One planned session was replaced by a synthetic class."] : ["The synthetic week is incomplete."],
    athleteNotes: [],
    recordIds: [],
    status: completed ? "completed-with-deviations" : "active",
  };
}

function runIntegrationSimulation(simulation: IntegrationSimulation): unknown {
  const horizon = syntheticHorizon();
  if (["one-time-friday-class", "recurring-friday-class", "declined-class", "removed-recurring-class"].includes(simulation)) {
    const recurrence = simulation === "one-time-friday-class" ? "one-time" : "weekly";
    const accepted = activityDecision("accepted", recurrence, "2026-08-17T08:00:00.000Z");
    const decisions = simulation === "declined-class"
      ? [activityDecision("declined", recurrence, "2026-08-17T08:00:00.000Z")]
      : simulation === "removed-recurring-class"
        ? [accepted, activityDecision("cancelled", recurrence, "2026-08-22T08:00:00.000Z")]
        : [accepted];
    return resolveLiveResponseActivities({ horizon, recurringActivities: [], decisions, executionRecords: [], now: "2026-08-28T12:00:00.000Z" });
  }
  if (simulation === "stable-weight-improving-performance") return runResponseSimulation("stable-weight-improving-performance");
  if (simulation === "rapid-decline-worsening-performance") return runResponseSimulation("rapid-fat-loss-declining-performance");
  if (simulation === "poor-nutrition-adherence") return runResponseSimulation("poor-adherence-stable-weight");
  if (simulation === "recorded-poor-sleep") return runResponseSimulation("recovery-limited-athlete");
  if (simulation === "missing-sleep") {
    return buildResponseModel({
      evidenceInput: {
        athleteId: "synthetic-athlete",
        executionRecords: [],
        sleepLogs: [],
        readiness: [],
        bodyComposition: [],
        nutrition: [],
      },
      context: { now: SIMULATION_NOW, programId: "synthetic-response-program", currentWeek: 1 },
    });
  }
  if (simulation === "empty-optimization-log") return resolveOptimizationHistory({ decisions: [], events: [], revisions: [] });
  if (simulation === "productive-volume") return runResponseSimulation("productive-back-volume-range");
  if (simulation === "exercise-preference") return runResponseSimulation("machine-press-outperforms-barbell");
  if (simulation === "conditioning-proximity") return runResponseSimulation("grand-touring-recurring-class");

  const base = runResponseSimulation("athlete-accepts-recommendation");
  const recommendation = base.model.pendingRecommendations.find((item) => item.category === "volume-adjustment")!;
  if (simulation === "applied-recommendation") {
    return acceptRecommendation({ model: base.model, horizon, recommendationId: recommendation.id, now: SIMULATION_NOW, protectedWeeks: [1] });
  }
  if (simulation === "declined-recommendation") {
    return declineRecommendation({ model: base.model, horizon, recommendationId: recommendation.id, now: SIMULATION_NOW });
  }
  const source = runResponseSimulation("six-comparable-successful-sessions");
  const summary = reviewSummary(simulation === "completed-weekly-review");
  return buildWeeklyResponseReview({
    programId: summary.programId,
    weekNumber: summary.weekNumber,
    summary,
    executionRecords: buildSimulationInput("six-comparable-successful-sessions").executionRecords,
    evidence: source.bundle,
    model: source.model,
    decisions: [],
    revisions: [],
  });
}

function modelFromSimulation(output: unknown): AthleteResponseModel | null {
  if (!output || typeof output !== "object" || !("model" in output)) return null;
  return (output as { model?: AthleteResponseModel }).model ?? null;
}

function Datum({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded border border-white/10 bg-black/30 p-2.5"><p className="text-[9px] uppercase tracking-[0.14em] text-white/30">{label}</p><p className="mt-1 break-all font-mono text-xs text-white/65">{String(value)}</p></div>;
}

export function ResponseIntegrationInspector() {
  const [simulation, setSimulation] = useState<IntegrationSimulation>("one-time-friday-class");
  const { model, liveActivities, weeklyReviews, events } = useResponseModel(new Date(SIMULATION_NOW));
  const decisions = useAthleteDashboardStore((state) => state.trainingSession.decisionHistory);
  const horizon = useAthleteDashboardStore((state) => state.programHorizon.horizon);
  const revisions = horizon?.revisions ?? EMPTY_REVISIONS;
  const training = resolveResponseSurface(model, { domains: ["volume", "exercise", "recovery", "conditioning", "pain"], recoveryContexts: ["session-spacing", "conditioning-proximity", "sleep", "pain"] });
  const nutrition = resolveResponseSurface(model, { domains: ["body-composition", "nutrition", "adherence", "conditioning", "recovery"], nutritionContexts: ["weight-performance", "intake-adherence", "training-demand"], recoveryContexts: ["conditioning-demand"] });
  const recovery = resolveResponseSurface(model, { domains: ["recovery", "conditioning", "volume", "pain"], recoveryContexts: ["session-spacing", "conditioning-proximity", "sleep", "local-fatigue", "pain"] });
  const optimization = resolveOptimizationHistory({ decisions, events, revisions });
  const output = useMemo(() => runIntegrationSimulation(simulation), [simulation]);
  const simulationModel = modelFromSimulation(output);
  const simulationTraining = simulationModel
    ? resolveResponseSurface(simulationModel, {
        domains: ["volume", "frequency", "exercise", "recovery", "conditioning", "pain"],
        recoveryContexts: ["session-spacing", "conditioning-proximity", "sleep", "local-fatigue", "pain"],
      })
    : null;
  const simulationTrainingInsights = simulationTraining ? selectTrainingSurfaceInsights(simulationTraining) : [];
  const simulationNutrition = simulationModel
    ? presentNutritionResponse(resolveResponseSurface(simulationModel, {
        domains: ["body-composition", "nutrition", "adherence", "conditioning", "recovery"],
        nutritionContexts: ["weight-performance", "intake-adherence", "training-demand"],
        recoveryContexts: ["conditioning-demand", "recovery-demand"],
      }))
    : null;
  const simulationRecovery = simulationModel
    ? presentRecoveryResponse(resolveResponseSurface(simulationModel, {
        domains: ["recovery", "conditioning", "volume", "pain"],
        recoveryContexts: ["session-spacing", "conditioning-proximity", "sleep", "local-fatigue", "pain"],
      }))
    : null;

  return (
    <section data-testid="response-integration-inspector" className="mt-4 rounded-lg border border-cyan-300/15 bg-[#071015] p-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/60">Live Response Integration</p>
      <h3 className="mt-1 text-lg font-semibold text-white">One model across every command surface</h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Datum label="Live activities supplied to model" value={liveActivities.length} />
        <Datum label="Activity source" value={liveActivities.map((item) => item.source).join(", ") || "none"} />
        <Datum label="Activity recurrence" value={liveActivities.map((item) => item.recurrence).join(", ") || "none"} />
        <Datum label="Activity revision" value={liveActivities.map((item) => item.revisionId).filter(Boolean).join(", ") || "none"} />
        <Datum label="Training Command response resolution" value={training.strongestCurrentInsight?.id ?? "insufficient"} />
        <Datum label="Nutrition response resolution" value={nutrition.strongestCurrentInsight?.id ?? "insufficient"} />
        <Datum label="Recovery response resolution" value={recovery.strongestCurrentInsight?.id ?? "insufficient"} />
        <Datum label="Weekly Response Review" value={weeklyReviews.length} />
        <Datum label="Decision Log records" value={optimization.counts.decisions + optimization.counts.events + optimization.counts.revisions} />
        <Datum label="Cross-module insight IDs" value={[training, nutrition, recovery].flatMap((item) => item.relevantInsights.map((insight) => insight.id)).join(", ") || "none"} />
        <Datum label="Cross-module model version" value={model.modelVersion} />
      </div>

      <label className="mt-5 block text-[9px] uppercase tracking-[0.16em] text-white/35">
        Integration simulation
        <select value={simulation} onChange={(event) => setSimulation(event.target.value as IntegrationSimulation)} className="mt-1 block w-full rounded border border-white/15 bg-black/50 px-2 py-2 text-sm text-white sm:max-w-md">
          {INTEGRATION_SIMULATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {simulationModel && (
        <div data-testid="response-surface-simulation" className="mt-3 grid gap-2 lg:grid-cols-3">
          <Datum
            label="Training Command simulation"
            value={simulationTrainingInsights.length > 0
              ? simulationTrainingInsights.map((insight) => `${insight.id} · ${insight.finding}`).join(" | ")
              : "No eligible active-day claim"}
          />
          <Datum
            label="Nutrition simulation"
            value={simulationNutrition
              ? `${simulationNutrition.insightId ?? "insufficient"} · ${simulationNutrition.posture}`
              : "No nutrition response"}
          />
          <Datum
            label="Recovery simulation"
            value={simulationRecovery
              ? `${simulationRecovery.insightId ?? "insufficient"} · ${simulationRecovery.observed}`
              : "No eligible recovery claim"}
          />
        </div>
      )}
      <pre className="mt-3 max-h-80 overflow-auto rounded border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-white/48">{JSON.stringify(output, null, 2)}</pre>
      {simulation === "empty-optimization-log" && (
        <div className="mt-3">
          <OptimizationEmptyState />
        </div>
      )}
    </section>
  );
}
