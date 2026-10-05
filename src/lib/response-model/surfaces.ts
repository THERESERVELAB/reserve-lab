/* ════════════════════════════════════════════════════════════════════════
   RESPONSE PRESENTATION CONTRACT

   Every athlete-facing consumer resolves from the same active model. This
   module filters and presents model facts; it never derives a new insight or
   a competing confidence score.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  AthleteResponseModel,
  ResponseConfidence,
  ResponseDomainName,
  ResponseInsight,
  ResponseRecommendation,
} from "./types";

export type ResponseSurfaceResolution = {
  athleteId: string;
  modelVersion: string;
  strongestCurrentInsight?: ResponseInsight;
  relevantInsights: ResponseInsight[];
  pendingRecommendation?: ResponseRecommendation;
  latestAppliedRecommendation?: ResponseRecommendation;
  currentRevisionIds: string[];
  confidence: ResponseConfidence;
  missingData: string[];
};

export type ResponseSurfaceFilter = {
  currentDate?: string;
  currentWeek?: number;
  muscles?: string[];
  movementPatterns?: string[];
  exercises?: string[];
  domains?: ResponseDomainName[];
  nutritionContexts?: string[];
  recoveryContexts?: string[];
};

const CONFIDENCE_ORDER: Record<ResponseConfidence, number> = {
  insufficient: 0,
  emerging: 1,
  moderate: 2,
  established: 3,
};

function normalized(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
}

function relevant(insight: ResponseInsight, filter: ResponseSurfaceFilter): boolean {
  if (filter.domains?.length && !filter.domains.includes(insight.domain)) return false;

  const muscles = normalized(filter.muscles);
  const movements = normalized(filter.movementPatterns);
  const exercises = normalized(filter.exercises);
  const target = `${insight.targetId} ${insight.targetLabel}`.toLowerCase();

  if (insight.targetType === "exercise" && exercises.length > 0) return includesAny(target, exercises);
  if (insight.targetType === "muscle" && muscles.length > 0) return includesAny(target, muscles);
  if (insight.targetType === "movement-pattern" && movements.length > 0) return includesAny(target, movements);
  if (insight.targetType === "week" && filter.currentWeek != null) {
    return target.includes(String(filter.currentWeek));
  }

  if (insight.domain === "volume" || insight.domain === "frequency" || insight.domain === "exercise") {
    const scoped = [...muscles, ...movements, ...exercises];
    if (scoped.length > 0) return includesAny(target, scoped);
    if (insight.domain === "volume" && filter.recoveryContexts?.includes("local-fatigue")) {
      return insight.magnitude?.direction === "negative" || insight.magnitude?.direction === "mixed";
    }
    return (filter.recoveryContexts?.length ?? 0) === 0;
  }
  if (insight.domain === "pain") {
    const scoped = [...muscles, ...movements, ...exercises];
    return scoped.length > 0
      ? includesAny(target, scoped)
      : filter.recoveryContexts?.includes("pain") ?? false;
  }
  if (insight.domain === "conditioning" || insight.domain === "recovery") {
    return (filter.recoveryContexts?.length ?? 0) > 0 || !filter.domains?.length;
  }
  if (insight.domain === "body-composition" || insight.domain === "nutrition" || insight.domain === "adherence") {
    return (filter.nutritionContexts?.length ?? 0) > 0 || !filter.domains?.length;
  }
  return true;
}

export function rankSurfaceInsights(insights: ResponseInsight[]): ResponseInsight[] {
  return [...insights].sort((a, b) => {
    const byConfidence = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
    if (byConfidence !== 0) return byConfidence;
    const byComparable = b.sample.comparableObservations - a.sample.comparableObservations;
    if (byComparable !== 0) return byComparable;
    return a.id.localeCompare(b.id);
  });
}

export function resolveResponseSurface(
  model: AthleteResponseModel,
  filter: ResponseSurfaceFilter = {},
): ResponseSurfaceResolution {
  const professionalReviewInsightIds = new Set(
    model.pendingRecommendations
      .filter((recommendation) => recommendation.category === "professional-review")
      .flatMap((recommendation) => recommendation.insightIds),
  );
  const relevantInsights = rankSurfaceInsights(
    model.activeInsights.filter((insight) =>
      (professionalReviewInsightIds.has(insight.id) || (insight.confidence !== "insufficient" && insight.status !== "insufficient")) &&
      relevant(insight, filter),
    ),
  );
  const insightIds = new Set(relevantInsights.map((insight) => insight.id));
  const pending = model.pendingRecommendations
    .filter((recommendation) => recommendation.insightIds.some((id) => insightIds.has(id)))
    .sort((a, b) => `${a.createdAt}:${a.id}`.localeCompare(`${b.createdAt}:${b.id}`));
  const applied = model.resolvedRecommendations
    .filter((recommendation) =>
      recommendation.decision === "applied" &&
      recommendation.insightIds.some((id) => insightIds.has(id)),
    )
    .sort((a, b) => `${a.decidedAt ?? a.createdAt}:${a.id}`.localeCompare(`${b.decidedAt ?? b.createdAt}:${b.id}`));

  const strongest = relevantInsights[0];
  const selectedDomains = filter.domains ?? [...new Set(relevantInsights.map((insight) => insight.domain))];
  const missingDomains = selectedDomains.filter((domain) => model.dataQuality.missingDomains.includes(domain));
  return {
    athleteId: model.athleteId,
    modelVersion: model.modelVersion,
    strongestCurrentInsight: strongest,
    relevantInsights,
    pendingRecommendation: pending.at(-1),
    latestAppliedRecommendation: applied.at(-1),
    currentRevisionIds: [...new Set(applied.map((recommendation) => recommendation.appliedRevisionId).filter((id): id is string => Boolean(id)))].sort(),
    confidence: strongest?.confidence ?? "insufficient",
    missingData: [...new Set([
      ...model.assumptions,
      ...missingDomains.map((domain) => `No active ${domain} evidence is available.`),
    ])],
  };
}

/** Training Command stays restrained while protecting the categories that
    matter most in the current session. This orders existing model insights;
    it never creates a finding or changes its confidence. */
export function selectTrainingSurfaceInsights(
  resolution: ResponseSurfaceResolution,
  limit = 2,
): ResponseInsight[] {
  const domainPriority: Partial<Record<ResponseDomainName, number>> = {
    pain: 0,
    conditioning: 1,
    recovery: 2,
    exercise: 3,
    volume: 4,
    frequency: 5,
  };
  const appliedInsightIds = new Set(resolution.latestAppliedRecommendation?.insightIds ?? []);
  const ordered = [...resolution.relevantInsights]
    .sort((a, b) => {
      const applied = Number(appliedInsightIds.has(b.id)) - Number(appliedInsightIds.has(a.id));
      if (applied !== 0) return applied;
      return (domainPriority[a.domain] ?? 99) - (domainPriority[b.domain] ?? 99);
    });
  const selected: ResponseInsight[] = [];
  const groups = new Set<string>();
  for (const insight of ordered) {
    const group = insight.domain === "conditioning" || insight.domain === "recovery"
      ? "recovery-demand"
      : insight.domain === "volume" || insight.domain === "frequency"
        ? "programming-posture"
        : insight.domain;
    if (groups.has(group)) continue;
    selected.push(insight);
    groups.add(group);
    if (selected.length === limit) break;
  }
  return selected;
}

export type NutritionResponsePresentation = {
  observed: string;
  meaning: string;
  posture: string;
  information: string;
  review: string;
  insightId?: string;
  recommendationId?: string;
};

export function presentNutritionResponse(
  resolution: ResponseSurfaceResolution,
): NutritionResponsePresentation {
  const insight = resolution.strongestCurrentInsight;
  const recommendation = resolution.pendingRecommendation ?? resolution.latestAppliedRecommendation;
  if (!insight) {
    return {
      observed: "Reserve does not yet have enough comparable weight, performance, and intake evidence to make a nutrition-response claim.",
      meaning: "Missing intake or adherence data remains missing; scale weight alone is not interpreted as fat loss, muscle gain, or failed recomposition.",
      posture: "Keep the current nutrition posture until a supported pattern exists.",
      information: resolution.missingData[0] ?? "More comparable observations are needed.",
      review: "No formal adjustment is generated from insufficient evidence.",
    };
  }

  const adherence = insight.domain === "adherence" || recommendation?.category === "adherence-review";
  const formalReview = recommendation?.category === "nutrition-review" || recommendation?.category === "professional-review";
  const maintain = recommendation?.category === "maintain";
  return {
    observed: insight.finding,
    meaning: insight.interpretation,
    posture: adherence
      ? "Keep the current calorie and conditioning posture while intake consistency is clarified."
      : formalReview
        ? "Do not change intake automatically; hold the current posture pending review."
        : maintain
          ? "The current nutrition posture should remain in place."
          : "Monitor the pattern; no nutrition target changes automatically.",
    information: adherence
      ? "More consistent intake and adherence records are needed before changing calories or cardio."
      : insight.limitations[0] ?? "Continue collecting comparable intake and performance observations.",
    review: formalReview
      ? "A formal review of total demand and logged intake is recommended before adjusting targets."
      : "No formal review is required by the active recommendation.",
    insightId: insight.id,
    recommendationId: recommendation?.id,
  };
}

export type RecoveryResponsePresentation = {
  label: "Observed pattern" | "Local fatigue pattern" | "Professional review";
  observed: string;
  meaning: string;
  confidence: ResponseConfidence;
  insightId?: string;
  recommendationId?: string;
};

export function presentRecoveryResponse(
  resolution: ResponseSurfaceResolution,
): RecoveryResponsePresentation | null {
  const insight = resolution.strongestCurrentInsight;
  if (!insight) return null;
  const recommendation = resolution.pendingRecommendation ?? resolution.latestAppliedRecommendation;
  const professionalReview = insight.domain === "pain" && recommendation?.category === "professional-review";
  return {
    label: professionalReview
      ? "Professional review"
      : insight.domain === "volume"
        ? "Local fatigue pattern"
        : "Observed pattern",
    observed: insight.finding,
    meaning: professionalReview
      ? `${insight.interpretation} Reserve does not diagnose the cause; review the repeated or severe concern with a qualified professional.`
      : insight.interpretation,
    confidence: insight.confidence,
    insightId: insight.id,
    recommendationId: recommendation?.id,
  };
}
