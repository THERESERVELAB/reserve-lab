import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fixtureSnapshot, FRIDAY_LOWER_CLASS } from "@/lib/athlete/fixtures";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { generateProgramHorizon } from "@/lib/horizon/generate";
import { applyActivityToHorizon } from "@/lib/horizon/revise";
import { buildResponseEvidence } from "@/lib/response-evidence/engine";
import { buildEvidenceScenarioInput } from "@/lib/response-evidence/fixtures";
import {
  OPTIMIZATION_EMPTY_BODY,
  OPTIMIZATION_EMPTY_TITLE,
  resolveOptimizationHistory,
} from "@/lib/response-model/optimization-history";
import {
  presentNutritionResponse,
  presentRecoveryResponse,
  resolveResponseSurface,
  selectTrainingSurfaceInsights,
} from "@/lib/response-model/surfaces";
import {
  buildWeeklyResponseReview,
  upsertWeeklyResponseReview,
} from "@/lib/response-model/weekly-review";
import {
  appendReserveDecision,
  createReserveDecision,
  type WeekExecutionSummary,
} from "@/lib/training/session-execution";

import { acceptRecommendation, declineRecommendation } from "../apply";
import { buildResponseModel, emptyResponseModel } from "../build";
import { runResponseSimulation, SIMULATION_NOW } from "../fixtures";
import type { BuildResponseModelResult } from "../build";

const PROGRAM_ID = "synthetic-program";

function responseHorizon() {
  const snapshot = fixtureSnapshot("advanced-physique")!;
  return generateProgramHorizon({
    protocolId: "classic-physique-build",
    snapshot,
    profile: deriveProgrammingProfile(snapshot),
    totalWeeks: 12,
    now: new Date(SIMULATION_NOW),
    startDate: SIMULATION_NOW.slice(0, 10),
  })!;
}

function appliedResponse() {
  const base = runResponseSimulation("athlete-accepts-recommendation");
  const recommendation = base.model.pendingRecommendations.find((item) => item.category === "volume-adjustment");
  if (!recommendation) throw new Error("The accepted-recommendation simulation did not create a volume adjustment.");
  const result = acceptRecommendation({
    model: base.model,
    horizon: responseHorizon(),
    recommendationId: recommendation.id,
    now: SIMULATION_NOW,
    protectedWeeks: [1],
  });
  return { base, recommendation, result };
}

function summary(overrides: Partial<WeekExecutionSummary> = {}): WeekExecutionSummary {
  return {
    id: `${PROGRAM_ID}:W1:execution`,
    programId: PROGRAM_ID,
    weekNumber: 1,
    createdAt: "2026-08-30T20:00:00.000Z",
    plannedSessionCount: 4,
    completedSessionCount: 4,
    partialSessionCount: 0,
    abandonedSessionCount: 0,
    skippedSessionCount: 0,
    replacedSessionCount: 0,
    unresolvedSessionCount: 0,
    addedActivityCount: 0,
    addedMovementCount: 0,
    completionPercent: 100,
    majorDeviations: [],
    athleteNotes: [],
    recordIds: [],
    status: "completed",
    ...overrides,
  };
}

function reviewFor(result: BuildResponseModelResult, weekSummary = summary()) {
  return buildWeeklyResponseReview({
    programId: weekSummary.programId,
    weekNumber: weekSummary.weekNumber,
    summary: weekSummary,
    executionRecords: [],
    evidence: result.bundle,
    model: result.model,
    decisions: [],
    revisions: [],
  });
}

function severePainModel() {
  const evidenceInput = buildEvidenceScenarioInput("one-painful-exposure");
  const executionRecords = JSON.parse(JSON.stringify(evidenceInput.executionRecords)) as typeof evidenceInput.executionRecords;
  for (const record of executionRecords) {
    for (const movement of [...record.movements, ...record.addedMovements]) {
      if (movement.athleteFeedback) movement.athleteFeedback.pain = 8;
      for (const set of movement.completedSets) set.pain = 8;
    }
    record.sessionMetrics.painDuringSession = [{ region: "knee", severity: 8, note: "Synthetic severe report" }];
  }
  return buildResponseModel({
    evidenceInput: { ...evidenceInput, executionRecords },
    context: { now: SIMULATION_NOW, programId: PROGRAM_ID, currentWeek: 1, completedWeeks: 1, protectedWeeks: [1] },
  });
}

describe("Training Command response integration", () => {
  it("11. Relevant active insight can appear", () => {
    const model = runResponseSimulation("productive-back-volume-range").model;
    const resolution = resolveResponseSurface(model, { domains: ["volume"], muscles: ["back"] });
    expect(resolution.strongestCurrentInsight?.domain).toBe("volume");
    const exerciseModel = runResponseSimulation("machine-press-outperforms-barbell").model;
    const training = resolveResponseSurface(exerciseModel, {
      domains: ["volume", "frequency", "exercise", "recovery", "pain"],
      muscles: ["chest"],
      exercises: ["incline machine press", "incline barbell press"],
      recoveryContexts: ["pain"],
    });
    expect(selectTrainingSurfaceInsights(training).some((insight) => insight.domain === "exercise")).toBe(true);
  });

  it("12. Unrelated insight does not appear", () => {
    const model = runResponseSimulation("machine-press-outperforms-barbell").model;
    const resolution = resolveResponseSurface(model, { domains: ["exercise"], exercises: ["hack squat"] });
    expect(resolution.relevantInsights).toEqual([]);
  });

  it("13. Insufficient insight does not create confident copy", () => {
    const resolution = resolveResponseSurface(runResponseSimulation("insufficient-evidence").model, { domains: ["volume"] });
    expect(resolution.strongestCurrentInsight).toBeUndefined();
    expect(resolution.confidence).toBe("insufficient");
  });

  it("14. Applied response revision is identified", () => {
    const { result } = appliedResponse();
    const resolution = resolveResponseSurface(result.model);
    expect(resolution.currentRevisionIds).toContain(result.revision?.id);
    expect(resolution.latestAppliedRecommendation?.appliedRevisionId).toBe(result.revision?.id);
  });

  it("15. Frozen session remains unchanged", () => {
    const { result } = appliedResponse();
    expect(result.revision?.effectiveWeek).toBeGreaterThan(1);
    expect(result.revision?.affectedWeeks).not.toContain(1);
  });

  it("16. Future session may reflect an accepted revision", () => {
    const { result } = appliedResponse();
    expect(result.revision?.affectedWeeks.length).toBeGreaterThan(0);
    expect(result.horizon?.revisions.some((revision) => revision.id === result.revision?.id)).toBe(true);
  });

  it("17. Declined recommendation does not alter Training Command", () => {
    const base = runResponseSimulation("excessive-lower-volume");
    const recommendation = base.model.pendingRecommendations[0]!;
    const horizon = responseHorizon();
    const result = declineRecommendation({ model: base.model, horizon, recommendationId: recommendation.id, now: SIMULATION_NOW });
    expect(result.revision).toBeNull();
    expect(result.horizon).toEqual(horizon);
  });

  it("18. Pain-related professional-review language does not diagnose", () => {
    const built = severePainModel();
    const view = presentRecoveryResponse(resolveResponseSurface(built.model, { domains: ["pain"], recoveryContexts: ["pain"] }));
    expect(view?.label).toBe("Professional review");
    expect(view?.meaning).toContain("does not diagnose");
    expect(view?.meaning.toLowerCase()).not.toContain("you have an injury");
  });
});

describe("Nutrition response integration", () => {
  it("19. Stable weight alone does not trigger a change", () => {
    const input = buildEvidenceScenarioInput("stable-weight-improving-performance-facts");
    const built = buildResponseModel({ evidenceInput: { ...input, executionRecords: [] }, context: { now: SIMULATION_NOW, programId: PROGRAM_ID, currentWeek: 1, completedWeeks: 0, protectedWeeks: [] } });
    expect(built.model.pendingRecommendations.filter((item) => item.category !== "maintain")).toEqual([]);
  });

  it("20. Stable weight plus improving performance may support maintaining", () => {
    const model = runResponseSimulation("stable-weight-improving-performance").model;
    expect(model.pendingRecommendations.some((item) => item.category === "maintain")).toBe(true);
    expect(presentNutritionResponse(resolveResponseSurface(model, { domains: ["body-composition"], nutritionContexts: ["weight-performance"] })).posture).toContain("remain");
  });

  it("21. Rapid weight decline plus worsening performance triggers review", () => {
    const model = runResponseSimulation("rapid-fat-loss-declining-performance").model;
    const view = presentNutritionResponse(resolveResponseSurface(model, { domains: ["body-composition"], nutritionContexts: ["weight-performance"] }));
    expect(model.pendingRecommendations.some((item) => item.category === "nutrition-review")).toBe(true);
    expect(view.review).toContain("formal review");
  });

  it("22. Poor adherence prevents automatic calorie reduction", () => {
    const model = runResponseSimulation("poor-adherence-stable-weight").model;
    const view = presentNutritionResponse(resolveResponseSurface(model, { domains: ["adherence"], nutritionContexts: ["intake-adherence"] }));
    expect(view.posture).toContain("current calorie");
    expect(view.information).toContain("before changing calories or cardio");
  });

  it("23. Missing calorie data remains missing", () => {
    const bundle = buildResponseEvidence({
      athleteId: "athlete",
      executionRecords: [],
      bodyComposition: [{ id: "weight", observedAt: SIMULATION_NOW, bodyWeightLb: 180, source: "test" }],
      nutrition: [{ id: "nutrition", observedAt: SIMULATION_NOW, adherence: 0.8, source: "test" }],
    });
    expect(bundle.bodyComposition.every((entry) => entry.calorieActual == null)).toBe(true);
  });

  it("24. Missing protein data remains missing", () => {
    const bundle = buildResponseEvidence({
      athleteId: "athlete",
      executionRecords: [],
      bodyComposition: [{ id: "weight", observedAt: SIMULATION_NOW, bodyWeightLb: 180, source: "test" }],
      nutrition: [{ id: "nutrition", observedAt: SIMULATION_NOW, adherence: 0.8, source: "test" }],
    });
    expect(bundle.bodyComposition.every((entry) => entry.proteinActual == null)).toBe(true);
  });

  it("25. Conditioning-demand increase is visible through the existing nutrition-demand system", () => {
    const horizon = responseHorizon();
    const applied = applyActivityToHorizon({ horizon, activity: { ...FRIDAY_LOWER_CLASS, recurrence: "one-time", date: SIMULATION_NOW.slice(0, 10) }, athleteConfirmed: true, now: new Date(SIMULATION_NOW) });
    expect(applied.proposal.nutritionChanges.length).toBeGreaterThan(0);
    expect(applied.revision?.after[0]?.nutritionDemand).toContain(applied.proposal.nutritionChanges[0]);
  });

  it("26. Nutrition uses the same insight IDs as Response Profile", () => {
    const model = runResponseSimulation("stable-weight-improving-performance").model;
    const profile = resolveResponseSurface(model);
    const nutrition = resolveResponseSurface(model, { domains: ["body-composition"], nutritionContexts: ["weight-performance"] });
    expect(profile.relevantInsights.map((item) => item.id)).toContain(nutrition.strongestCurrentInsight?.id);
  });

  it("27. Material nutrition decision creates one decision record", () => {
    const base = runResponseSimulation("rapid-fat-loss-declining-performance");
    const recommendation = base.model.pendingRecommendations.find((item) => item.category === "nutrition-review")!;
    const result = acceptRecommendation({ model: base.model, horizon: responseHorizon(), recommendationId: recommendation.id, now: SIMULATION_NOW });
    expect(result.decisionRecord).not.toBeNull();
    expect(result.events.filter((event) => event.type === "recommendation-accepted")).toHaveLength(1);
  });

  it("28. Rebuild does not duplicate a decision", () => {
    const record = createReserveDecision({ category: "athlete-decision", source: "athlete", observation: "Review", decision: "Keep", reason: "Test", athleteDecision: "accepted", createdAt: SIMULATION_NOW });
    expect(appendReserveDecision(appendReserveDecision([], record), record)).toHaveLength(1);
  });
});

describe("Recovery response integration", () => {
  it("29. Recorded sleep may contribute", () => {
    const bundle = runResponseSimulation("recovery-limited-athlete").bundle;
    expect(bundle.recovery.some((entry) => entry.sleepHours != null)).toBe(true);
  });

  it("30. Missing sleep remains missing", () => {
    const input = buildEvidenceScenarioInput("two-comparable-completed-sessions");
    const bundle = buildResponseEvidence({ ...input, sleepLogs: [] });
    expect(bundle.recovery.every((entry) => entry.sleepHours == null && entry.missingFields.includes("sleepHours"))).toBe(true);
  });

  it("31. Recorded readiness may contribute", () => {
    const bundle = buildResponseEvidence(buildEvidenceScenarioInput("two-comparable-completed-sessions"));
    expect(bundle.recovery.some((entry) => entry.readinessScore != null)).toBe(true);
  });

  it("32. Missing readiness remains missing", () => {
    const input = buildEvidenceScenarioInput("two-comparable-completed-sessions");
    const bundle = buildResponseEvidence({ ...input, readiness: [] });
    expect(bundle.recovery.every((entry) => entry.readinessScore == null && entry.missingFields.includes("readinessScore"))).toBe(true);
  });

  it("33. Conditioning proximity appears", () => {
    const bundle = buildResponseEvidence(buildEvidenceScenarioInput("conditioning-within-24-hours"));
    expect(bundle.conditioning[0]?.proximityToPreviousLowerTrainingHours ?? bundle.conditioning[0]?.proximityToNextLowerTrainingHours).toBeTypeOf("number");
  });

  it("34. Timing alone does not prove interference", () => {
    const input = buildEvidenceScenarioInput("conditioning-within-24-hours");
    const built = buildResponseModel({ evidenceInput: input, context: { now: SIMULATION_NOW, programId: PROGRAM_ID, currentWeek: 1, completedWeeks: 0, protectedWeeks: [] } });
    const conditioning = built.model.activeInsights.find((insight) => insight.domain === "conditioning");
    expect(conditioning?.recommendationEligibility.eligible ?? false).toBe(false);
  });

  it("35. Repeated performance relationship may create an insight", () => {
    const model = runResponseSimulation("grand-touring-recurring-class").model;
    expect(model.activeInsights.some((insight) => insight.domain === "conditioning" && insight.confidence !== "insufficient")).toBe(true);
    const localFatigue = resolveResponseSurface(runResponseSimulation("excessive-lower-volume").model, {
      domains: ["recovery", "conditioning", "volume", "pain"],
      recoveryContexts: ["local-fatigue"],
    });
    expect(presentRecoveryResponse(localFatigue)?.label).toBe("Local fatigue pattern");
  });

  it("36. Pain before and during remain distinct", () => {
    const input = buildEvidenceScenarioInput("one-painful-exposure");
    const executionRecords = JSON.parse(JSON.stringify(input.executionRecords)) as typeof input.executionRecords;
    executionRecords[0]!.sessionMetrics.painDuringSession = [{ region: "knee", severity: 4 }];
    const bundle = buildResponseEvidence({
      ...input,
      executionRecords,
      readiness: [{ id: "before", date: executionRecords[0]!.calendarDate, painBefore: [{ region: "hip", severity: 2 }] }],
    });
    expect(bundle.recovery[0]?.painBefore?.[0]?.region).toBe("hip");
    expect(bundle.recovery[0]?.painDuring?.[0]?.region).toBe("knee");
  });

  it("37. Recovery uses the same active insight", () => {
    const model = runResponseSimulation("recovery-limited-athlete").model;
    const profile = resolveResponseSurface(model);
    const recovery = resolveResponseSurface(model, { domains: ["recovery"], recoveryContexts: ["sleep"] });
    expect(profile.relevantInsights.map((item) => item.id)).toContain(recovery.strongestCurrentInsight?.id);
  });

  it("38. Severe pain produces professional-review language without diagnosis", () => {
    const model = severePainModel().model;
    const resolution = resolveResponseSurface(model, { domains: ["pain"], recoveryContexts: ["pain"] });
    expect(resolution.pendingRecommendation?.category).toBe("professional-review");
    expect(presentRecoveryResponse(resolution)?.meaning).toContain("qualified professional");
  });
});

describe("Weekly Response Review", () => {
  it("39. Completed week can produce a review", () => {
    expect(reviewFor(runResponseSimulation("six-comparable-successful-sessions")).completedAt).toBe(summary().createdAt);
  });

  it("40. Active incomplete week remains provisional", () => {
    const active = summary({ status: "active", completedSessionCount: 2, unresolvedSessionCount: 2, completionPercent: 50 });
    expect(reviewFor(runResponseSimulation("two-comparable-successful-sessions"), active).completedAt).toBeUndefined();
  });

  it("41. Partial sessions remain visible", () => {
    const review = reviewFor(runResponseSimulation("two-comparable-successful-sessions"), summary({ status: "completed-with-deviations", partialSessionCount: 1, completedSessionCount: 3 }));
    expect(review.evidenceSummary.partialSessions).toBe(1);
  });

  it("42. Skipped sessions remain visible", () => {
    const review = reviewFor(runResponseSimulation("two-comparable-successful-sessions"), summary({ status: "completed-with-deviations", skippedSessionCount: 1, completedSessionCount: 3 }));
    expect(review.evidenceSummary.skippedSessions).toBe(1);
  });

  it("43. Replacement activity remains distinct", () => {
    const review = reviewFor(runResponseSimulation("grand-touring-recurring-class"), summary({ status: "completed-with-deviations", replacedSessionCount: 1, completedSessionCount: 3 }));
    expect(review.evidenceSummary.replacementActivities).toBe(1);
  });

  it("44. Stable insight appears under stable patterns", () => {
    expect(reviewFor(runResponseSimulation("six-comparable-successful-sessions")).stablePatterns.length).toBeGreaterThan(0);
  });

  it("45. Emerging insight appears under emerging patterns", () => {
    expect(reviewFor(runResponseSimulation("two-comparable-successful-sessions")).emergingPatterns.length).toBeGreaterThan(0);
  });

  it("46. Conflicted insight appears under contradicted patterns", () => {
    expect(reviewFor(runResponseSimulation("genuinely-conflicting-evidence")).contradictedPatterns.length).toBeGreaterThan(0);
  });

  it("47. Maintain recommendation is valid", () => {
    expect(reviewFor(runResponseSimulation("productive-back-volume-range")).maintainDecisions.length).toBeGreaterThan(0);
  });

  it("48. Missing data is explicit", () => {
    expect(reviewFor(runResponseSimulation("insufficient-evidence"), summary({ status: "active", unresolvedSessionCount: 4, completedSessionCount: 0 })).missingData.length).toBeGreaterThan(0);
  });

  it("49. Review is deterministic", () => {
    const result = runResponseSimulation("two-comparable-successful-sessions");
    expect(reviewFor(result)).toEqual(reviewFor(result));
  });

  it("50. Review survives refresh", () => {
    const review = reviewFor(runResponseSimulation("two-comparable-successful-sessions"));
    expect(JSON.parse(JSON.stringify(upsertWeeklyResponseReview([], review)))).toEqual([review]);
  });

  it("51. Completed review does not mutate", () => {
    const completed = reviewFor(runResponseSimulation("six-comparable-successful-sessions"));
    const changed = { ...completed, recommendations: ["Future change"] };
    expect(upsertWeeklyResponseReview([completed], changed)).toEqual([completed]);
  });

  it("52. Future revision does not rewrite a completed review", () => {
    const completed = reviewFor(runResponseSimulation("six-comparable-successful-sessions"));
    const future = { ...completed, missingData: [], recommendations: ["Revision from a future week"] };
    expect(upsertWeeklyResponseReview([completed], future)[0]).toEqual(completed);
  });
});

describe("Optimization Log", () => {
  it("53. No fabricated default events exist", () => {
    const model = emptyResponseModel("athlete", SIMULATION_NOW);
    expect(model.activeInsights).toEqual([]);
    expect(resolveOptimizationHistory({ decisions: [], events: [], revisions: [] }).hasHistory).toBe(false);
  });

  it("54. No hardcoded member-facing counts remain", () => {
    const one = createReserveDecision({ category: "athlete-decision", source: "athlete", observation: "Observed", decision: "Kept", reason: "Test", createdAt: SIMULATION_NOW });
    const history = resolveOptimizationHistory({ decisions: [one], events: [], revisions: [] });
    expect(history.counts).toEqual({ decisions: 1, events: 0, revisions: 0 });
  });

  it("55. Real response insight event appears", () => {
    const event = runResponseSimulation("two-comparable-successful-sessions").events.find((item) => item.type === "insight-emerged")!;
    expect(resolveOptimizationHistory({ decisions: [], events: [event], revisions: [] }).events).toContainEqual(event);
  });

  it("56. Real accepted recommendation appears", () => {
    const { result } = appliedResponse();
    expect(result.events.some((event) => event.type === "recommendation-accepted")).toBe(true);
  });

  it("57. Real declined recommendation appears", () => {
    const base = runResponseSimulation("excessive-lower-volume");
    const result = declineRecommendation({ model: base.model, horizon: responseHorizon(), recommendationId: base.model.pendingRecommendations[0]!.id, now: SIMULATION_NOW });
    expect(result.events.some((event) => event.type === "recommendation-declined")).toBe(true);
  });

  it("58. Real activity reconciliation appears", () => {
    const record = createReserveDecision({
      category: "activity-reconciliation", source: "athlete", observation: "Friday class", decision: "Reconciled", reason: "Accepted",
      createdAt: SIMULATION_NOW,
      activity: { activityId: FRIDAY_LOWER_CLASS.id, status: "accepted", snapshot: FRIDAY_LOWER_CLASS },
    });
    expect(resolveOptimizationHistory({ decisions: [record], events: [], revisions: [] }).decisions[0]?.activity?.activityId).toBe(FRIDAY_LOWER_CLASS.id);
  });

  it("59. Empty history shows an honest state", () => {
    expect(OPTIMIZATION_EMPTY_TITLE).toBe("NO DECISIONS RECORDED YET");
    expect(OPTIMIZATION_EMPTY_BODY).toBe("Reserve decisions and athlete-approved changes will appear here.");
  });

  it("60. Development fixtures remain development-only", () => {
    const memberView = readFileSync(join(process.cwd(), "src/components/views/PerformanceIntelligenceView.tsx"), "utf8");
    expect(memberView).not.toMatch(/response-model\/fixtures|elite-data|COMPOUND_LOG|OBSERVATION_NOTES/);
  });
});

describe("Cross-module Response consistency", () => {
  it("61. Response Profile and Training Command use the same insight", () => {
    const model = runResponseSimulation("productive-back-volume-range").model;
    const profile = resolveResponseSurface(model);
    const training = resolveResponseSurface(model, { domains: ["volume"], muscles: ["back"] });
    expect(profile.relevantInsights.map((item) => item.id)).toContain(training.strongestCurrentInsight?.id);
  });

  it("62. Nutrition uses the same model version", () => {
    const model = runResponseSimulation("stable-weight-improving-performance").model;
    expect(resolveResponseSurface(model, { domains: ["body-composition"], nutritionContexts: ["weight-performance"] }).modelVersion).toBe(model.modelVersion);
  });

  it("63. Recovery uses the same model version", () => {
    const model = runResponseSimulation("recovery-limited-athlete").model;
    expect(resolveResponseSurface(model, { domains: ["recovery"], recoveryContexts: ["sleep"] }).modelVersion).toBe(model.modelVersion);
  });

  it("64. Weekly Review uses the same recommendation", () => {
    const { result, recommendation } = appliedResponse();
    const review = buildWeeklyResponseReview({ programId: PROGRAM_ID, weekNumber: 1, summary: summary(), executionRecords: [], evidence: runResponseSimulation("excessive-lower-volume").bundle, model: result.model, decisions: result.decisionRecord ? [result.decisionRecord] : [], revisions: result.horizon?.revisions ?? [] });
    expect([...review.maintainDecisions, ...review.recommendations]).toContain(recommendation.summary);
  });

  it("65. Program Horizon uses the same revision", () => {
    const { result } = appliedResponse();
    const resolution = resolveResponseSurface(result.model);
    expect(result.horizon?.revisions.map((revision) => revision.id)).toContain(resolution.currentRevisionIds[0]);
  });

  it("66. Optimization Log uses the same decision record", () => {
    const { result } = appliedResponse();
    const history = resolveOptimizationHistory({ decisions: result.decisionRecord ? [result.decisionRecord] : [], events: result.events, revisions: result.horizon?.revisions ?? [] });
    expect(history.decisions[0]?.id).toBe(result.decisionRecord?.id);
  });

  it("67. No module creates a second Response Model", () => {
    const files = [
      "src/components/views/TrainingView.tsx",
      "src/components/views/NutritionView.tsx",
      "src/components/views/RecoveryView.tsx",
      "src/components/views/ResponseProfileView.tsx",
      "src/components/views/ProgramHorizonView.tsx",
      "src/components/views/PerformanceIntelligenceView.tsx",
    ];
    for (const file of files) expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain("buildResponseModel(");
  });

  it("68. No module independently invents a confidence level", () => {
    const model = runResponseSimulation("productive-back-volume-range").model;
    const resolution = resolveResponseSurface(model, { domains: ["volume"], muscles: ["back"] });
    expect(resolution.confidence).toBe(resolution.strongestCurrentInsight?.confidence);
  });
});
