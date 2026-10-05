/* ════════════════════════════════════════════════════════════════════════
   RESPONSE MODEL BUILD — deterministic, idempotent.

   Given the same evidence, athlete context, and model version, this produces
   the same insights, the same confidence, and the same recommendations —
   every time, in the same order.

   Idempotence is structural rather than incidental:
     • Insight ids derive from the pattern identity, so a rebuild updates an
       insight instead of creating a second one.
     • Processed evidence ids are recorded, so nothing is counted twice.
     • The evidence bundle stays authoritative; the model is a derived cache
       and never writes back to execution history.

   Athlete decisions are the one thing a rebuild must NOT discard. Declined
   and deferred recommendations are carried forward from the prior model.
   ════════════════════════════════════════════════════════════════════════ */

import { buildResponseEvidence, isFinalizedEvidenceRecord } from "@/lib/response-evidence/engine";
import type { ResponseEvidenceBundle, ResponseEvidenceInput } from "@/lib/response-evidence/types";
import type { SessionExecutionRecord } from "@/lib/training/session-execution";

import { overallConfidence } from "./confidence";
import { isActiveInsight, updateResponseInsight, type LifecycleTransition } from "./lifecycle";
import {
  detectAdherenceInsights,
  detectBodyCompositionInsights,
  detectConditioningInsights,
  detectExerciseInsights,
  detectFrequencyInsights,
  detectPainInsights,
  detectRecoveryInsights,
  detectVolumeInsights,
  type DomainContext,
  type InsightCandidate,
  type WeekSlice,
} from "./domains";
import { buildRecommendations } from "./recommendations";
import {
  RESPONSE_DOMAIN_NAMES,
  RESPONSE_MODEL_VERSION,
  type AthleteResponseModel,
  type ResponseConfidence,
  type ResponseDataQuality,
  type ResponseDomainModel,
  type ResponseDomainName,
  type ResponseEvent,
  type ResponseInsight,
} from "./types";

export type BuildResponseModelInput = {
  /** The same input shape the evidence engine consumes. */
  evidenceInput: ResponseEvidenceInput;
  /** The prior model, so athlete decisions and insight history survive. */
  previousModel?: AthleteResponseModel | null;
  context: {
    now: string;
    programId?: string;
    currentPhaseId?: string;
    currentNutritionPhase?: string;
    /** Total weeks marked complete in the program, for data quality. */
    completedWeeks?: number;
    /** Current week — recommendations target the week after this one. */
    currentWeek?: number;
    /** Weeks that are already started or completed and may not be revised. */
    protectedWeeks?: number[];
  };
};

export type BuildResponseModelResult = {
  model: AthleteResponseModel;
  bundle: ResponseEvidenceBundle;
  events: ResponseEvent[];
};

/* ─── Week slicing ────────────────────────────────────────────────────── */

function sliceWeeks(input: ResponseEvidenceInput): WeekSlice[] {
  const byWeek = new Map<number, SessionExecutionRecord[]>();
  for (const record of input.executionRecords) {
    if (record.weekNumber == null) continue;
    const list = byWeek.get(record.weekNumber) ?? [];
    list.push(record);
    byWeek.set(record.weekNumber, list);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, records]) => ({
      weekNumber,
      // Reuse the evidence engine per week rather than duplicating aggregation.
      bundle: buildResponseEvidence({ ...input, executionRecords: records }),
    }));
}

/* ─── Data quality ────────────────────────────────────────────────────── */

function assessDataQuality(
  bundle: ResponseEvidenceBundle,
  input: ResponseEvidenceInput,
  domains: Record<ResponseDomainName, ResponseDomainModel>,
  completedWeeks: number,
): ResponseDataQuality {
  // Use the evidence engine's own definition rather than a second opinion.
  // A "partial" session is still in progress and is NOT finalized — counting
  // it here would report evidence the engine deliberately excluded.
  const finalized = input.executionRecords.filter(isFinalizedEvidenceRecord).length;

  const missingDomains = RESPONSE_DOMAIN_NAMES.filter(
    (domain) => domains[domain].evidenceCount === 0,
  );

  return {
    finalizedSessions: finalized,
    completedWeeks,
    comparableExerciseObservations: bundle.performance.filter((o) => o.comparableToPrevious).length,
    activityObservations: bundle.conditioning.length,
    readinessObservations: bundle.recovery.filter((r) => r.readinessScore != null).length,
    sleepObservations: bundle.recovery.filter((r) => r.sleepHours != null).length,
    painObservations: bundle.performance.filter((o) => (o.painMax ?? 0) > 0).length,
    bodyWeightObservations: bundle.bodyComposition.filter((b) => b.weightKg != null).length,
    nutritionObservations: bundle.bodyComposition.filter((b) => b.adherence != null || b.calorieActual != null).length,
    overallConfidence: overallConfidence(
      RESPONSE_DOMAIN_NAMES.map((domain) => domains[domain].confidence).filter((c) => c !== "insufficient"),
    ),
    missingDomains,
  };
}

/* ─── Domain rollup ───────────────────────────────────────────────────── */

function rollUpDomain(
  domain: ResponseDomainName,
  insights: ResponseInsight[],
  bundle: ResponseEvidenceBundle,
  now: string,
): ResponseDomainModel {
  const own = insights.filter((insight) => insight.domain === domain);
  const active = own.filter(isActiveInsight);
  const archived = own.filter((insight) => !isActiveInsight(insight));
  const evidenceCount = bundle.evidence.filter((record) => record.domain === domain).length;

  const comparable = active.reduce((sum, insight) => sum + insight.sample.comparableObservations, 0);
  const contradicting = active.reduce((sum, insight) => sum + insight.sample.contradictingObservations, 0);

  const confidence: ResponseConfidence = active.length === 0
    ? "insufficient"
    : active.reduce<ResponseConfidence>((best, insight) => {
        const order: ResponseConfidence[] = ["insufficient", "emerging", "moderate", "established"];
        return order.indexOf(insight.confidence) > order.indexOf(best) ? insight.confidence : best;
      }, "insufficient");

  const status: ResponseDomainModel["status"] = active.some((i) => i.status === "conflicted")
    ? "conflicted"
    : active.some((i) => i.status === "established")
      ? "stable"
      : active.some((i) => i.status === "active" || i.status === "emerging")
        ? "pattern-detected"
        : evidenceCount > 0
          ? "learning"
          : "insufficient-data";

  return {
    status,
    activeInsightIds: active.map((i) => i.id).sort(),
    archivedInsightIds: archived.map((i) => i.id).sort(),
    evidenceCount,
    comparableEvidenceCount: comparable,
    contradictingEvidenceCount: contradicting,
    confidence,
    lastUpdatedAt: own.length ? now : undefined,
  };
}

/* ─── Build ───────────────────────────────────────────────────────────── */

export function buildResponseModel(input: BuildResponseModelInput): BuildResponseModelResult {
  const { evidenceInput, previousModel, context } = input;
  const bundle = buildResponseEvidence(evidenceInput);
  const weeks = sliceWeeks(evidenceInput);
  const athleteId = bundle.athleteId;

  // The execution records are the only reliable source of which week a session
  // belongs to — evidence records do not all carry one.
  const sessionWeeks = new Map<string, number>();
  for (const record of evidenceInput.executionRecords) {
    if (record.weekNumber != null) sessionWeeks.set(record.id, record.weekNumber);
  }

  const domainContext: DomainContext = {
    athleteId,
    now: context.now,
    programId: context.programId,
    currentPhaseId: context.currentPhaseId,
    currentNutritionPhase: context.currentNutritionPhase,
    sessionWeeks,
  };

  /* ── Candidates, in a fixed domain order so output is stable ── */
  const rawCandidates: InsightCandidate[] = [
    ...detectVolumeInsights(bundle, weeks, domainContext),
    ...detectFrequencyInsights(bundle, weeks, domainContext),
    ...detectExerciseInsights(bundle, domainContext),
    ...detectPainInsights(bundle, domainContext),
    ...detectRecoveryInsights(bundle, domainContext),
    ...detectConditioningInsights(bundle, domainContext),
    ...detectBodyCompositionInsights(bundle, domainContext),
    ...detectAdherenceInsights(bundle, domainContext),
  ];
  // Identity is the pattern key, so two detectors describing the same pattern
  // must collapse into one insight rather than producing a duplicate id.
  const candidates = [...new Map(rawCandidates.map((c) => [c.id, c])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));

  /* ── Merge against the previous model ── */
  const previousById = new Map<string, ResponseInsight>();
  for (const insight of [...(previousModel?.activeInsights ?? []), ...(previousModel?.archivedInsights ?? [])]) {
    previousById.set(insight.id, insight);
  }

  const events: ResponseEvent[] = [];
  const merged: ResponseInsight[] = [];
  const seenIds = new Set<string>();

  for (const candidate of candidates) {
    const existing = previousById.get(candidate.id) ?? null;
    const result = updateResponseInsight({
      existingInsight: existing,
      candidate,
      context: {
        now: context.now,
        supportingContext: {
          phaseId: existing?.context.phaseId ?? candidate.context.phaseId,
          nutritionPhase: existing?.context.nutritionPhase ?? candidate.context.nutritionPhase,
        },
        contradictingContext: {
          phaseId: candidate.context.phaseId,
          nutritionPhase: candidate.context.nutritionPhase,
        },
      },
    });
    merged.push(result.insight);
    seenIds.add(result.insight.id);

    const eventType = transitionToEvent(result.transition);
    if (eventType) {
      events.push({
        id: `event:${result.insight.id}:${result.transition}:${context.now}`,
        type: eventType,
        at: context.now,
        domain: result.insight.domain,
        targetLabel: result.insight.targetLabel,
        observation: result.insight.finding,
        decision: eventDecisionLabel(result.transition),
        reason: result.reason,
        confidence: result.insight.confidence,
        affectedWeeks: result.insight.sample.weeksRepresented,
      });
    }
  }

  /* ── Carry forward prior insights that produced no candidate this pass.
        They are not deleted; they age toward expiry with a recorded reason. ── */
  for (const [id, insight] of previousById) {
    if (seenIds.has(id)) continue;
    if (!isActiveInsight(insight)) {
      merged.push(insight);
      continue;
    }
    const staleDays = daysBetween(insight.sample.lastObservedAt, context.now);
    if (staleDays > 42) {
      merged.push({
        ...insight,
        status: "expired",
        updatedAt: context.now,
        expiresAt: context.now,
        archiveReason: `No comparable evidence for ${staleDays} days.`,
      });
      events.push({
        id: `event:${insight.id}:expired:${context.now}`,
        type: "insight-expired",
        at: context.now,
        domain: insight.domain,
        targetLabel: insight.targetLabel,
        observation: insight.finding,
        decision: "Archived",
        reason: `No comparable evidence for ${staleDays} days.`,
        confidence: insight.confidence,
        affectedWeeks: insight.sample.weeksRepresented,
      });
    } else {
      merged.push(insight);
    }
  }

  const sortedInsights = merged.sort((a, b) => a.id.localeCompare(b.id));
  const activeInsights = sortedInsights.filter(isActiveInsight);
  const archivedInsights = sortedInsights.filter((insight) => !isActiveInsight(insight));

  /* ── Domains ── */
  const domains = {} as Record<ResponseDomainName, ResponseDomainModel>;
  for (const domain of RESPONSE_DOMAIN_NAMES) {
    domains[domain] = rollUpDomain(domain, sortedInsights, bundle, context.now);
  }

  /* ── Recommendations ── */
  const recommendationResult = buildRecommendations({
    athleteId,
    programId: context.programId ?? bundle.athleteId,
    insights: activeInsights,
    previousRecommendations: [
      ...(previousModel?.pendingRecommendations ?? []),
      ...(previousModel?.resolvedRecommendations ?? []),
    ],
    now: context.now,
    currentWeek: context.currentWeek ?? 1,
    protectedWeeks: context.protectedWeeks ?? [],
  });
  events.push(...recommendationResult.events);

  const dataQuality = assessDataQuality(bundle, evidenceInput, domains, context.completedWeeks ?? 0);

  const assumptions = buildAssumptions(bundle, dataQuality);

  const model: AthleteResponseModel = {
    athleteId,
    modelVersion: RESPONSE_MODEL_VERSION,
    createdAt: previousModel?.createdAt ?? context.now,
    updatedAt: context.now,
    dataQuality,
    domains,
    activeInsights,
    archivedInsights,
    pendingRecommendations: recommendationResult.pending,
    resolvedRecommendations: recommendationResult.resolved,
    lastProcessedEvidenceAt: bundle.evidence.length
      ? bundle.evidence.map((record) => record.observedAt).sort().slice(-1)[0]
      : previousModel?.lastProcessedEvidenceAt,
    lastProcessedEvidenceIds: bundle.evidence.map((record) => record.id).sort(),
    assumptions,
  };

  // Events are deterministically identified; the model must never hand back
  // two with the same id, or every consumer has to defend against it.
  const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));

  return { model, bundle, events: uniqueEvents };
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

function transitionToEvent(transition: LifecycleTransition): ResponseEvent["type"] | null {
  switch (transition) {
    case "created": return "insight-emerged";
    case "strengthened": return "insight-strengthened";
    case "weakened": return "insight-weakened";
    case "conflicted": return "insight-conflicted";
    case "superseded": return "insight-superseded";
    case "expired": return "insight-expired";
    case "archived": return "insight-archived";
    default: return null; // "maintained" is not an event worth logging
  }
}

function eventDecisionLabel(transition: LifecycleTransition): string {
  switch (transition) {
    case "created": return "Started tracking";
    case "strengthened": return "Confidence raised";
    case "weakened": return "Confidence lowered";
    case "conflicted": return "Held — evidence conflicts";
    case "superseded": return "Replaced by a phase-specific pattern";
    case "expired": return "Archived";
    default: return "No change";
  }
}

function buildAssumptions(bundle: ResponseEvidenceBundle, quality: ResponseDataQuality): string[] {
  const out: string[] = [];
  if (quality.finalizedSessions === 0) {
    out.push("No finalized sessions yet — Reserve has nothing to learn from until sessions are completed and closed.");
  }
  if (quality.sleepObservations === 0) {
    out.push("No sleep has been recorded, so no sleep-related pattern can be formed.");
  }
  if (quality.readinessObservations === 0) {
    out.push("No readiness check-ins have been recorded, so readiness is not part of any pattern here.");
  }
  if (quality.bodyWeightObservations < 2) {
    out.push("Fewer than two weigh-ins, so no body-weight trend exists to interpret.");
  }
  if (quality.nutritionObservations === 0) {
    out.push("No nutrition data has been logged, so intake cannot be ruled in or out of any observation.");
  }
  if (bundle.provenance.excludedEvidence.length > 0) {
    out.push(`${bundle.provenance.excludedEvidence.length} record${bundle.provenance.excludedEvidence.length === 1 ? " was" : "s were"} excluded because the session is not finalized.`);
  }
  return out;
}

/** An empty model — the honest starting state. */
export function emptyResponseModel(athleteId: string, now: string): AthleteResponseModel {
  const domains = {} as Record<ResponseDomainName, ResponseDomainModel>;
  for (const domain of RESPONSE_DOMAIN_NAMES) {
    domains[domain] = {
      status: "insufficient-data",
      activeInsightIds: [],
      archivedInsightIds: [],
      evidenceCount: 0,
      comparableEvidenceCount: 0,
      contradictingEvidenceCount: 0,
      confidence: "insufficient",
    };
  }
  return {
    athleteId,
    modelVersion: RESPONSE_MODEL_VERSION,
    createdAt: now,
    updatedAt: now,
    dataQuality: {
      finalizedSessions: 0,
      completedWeeks: 0,
      comparableExerciseObservations: 0,
      activityObservations: 0,
      readinessObservations: 0,
      sleepObservations: 0,
      painObservations: 0,
      bodyWeightObservations: 0,
      nutritionObservations: 0,
      overallConfidence: "insufficient",
      missingDomains: [...RESPONSE_DOMAIN_NAMES],
    },
    domains,
    activeInsights: [],
    archivedInsights: [],
    pendingRecommendations: [],
    resolvedRecommendations: [],
    lastProcessedEvidenceIds: [],
    assumptions: ["Reserve has not observed any finalized training yet."],
  };
}
