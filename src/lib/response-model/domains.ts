/* ════════════════════════════════════════════════════════════════════════
   RESPONSE DOMAINS — evidence becomes candidate insights.

   Each detector reads the deterministic evidence bundle and produces
   CANDIDATE insights. It never grades its own confidence (that is the
   confidence module) and never proposes a change (that is the recommendation
   engine).

   Every candidate must be explainable from its evidence references. A
   detector that cannot name the supporting evidence does not emit an insight.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  ConditioningEvidence,
  ExercisePerformanceObservation,
  ResponseEvidenceBundle,
  ResponseEvidenceRecord,
} from "@/lib/response-evidence/types";
import { compareResponseEvidence } from "@/lib/response-evidence/engine";
import { calculateResponseConfidence } from "./confidence";
import type {
  ResponseDomainName,
  ResponseInsight,
  ResponseInsightDirection,
  ResponseTargetType,
} from "./types";

/* ─── Shared helpers ──────────────────────────────────────────────────── */

export type WeekSlice = {
  weekNumber: number;
  bundle: ResponseEvidenceBundle;
};

export type DomainContext = {
  athleteId: string;
  now: string;
  programId?: string;
  currentPhaseId?: string;
  currentNutritionPhase?: string;
  /** executionRecordId → week number. Built from the execution records, which
      is the only reliable source — not every evidence record carries a week. */
  sessionWeeks: Map<string, number>;
};

/** Weeks an observation set spans, resolved through the session index. */
function weeksForSessions(context: DomainContext, sessionIds: string[]): number[] {
  return uniq(
    sessionIds
      .map((id) => context.sessionWeeks.get(id))
      .filter((week): week is number => week != null),
  );
}

/** ISO-week keys for date-only evidence (body composition, nutrition). */
function isoWeeksForDates(dates: string[]): number[] {
  return uniq(
    dates
      .map((date) => {
        const parsed = Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`);
        if (Number.isNaN(parsed)) return null;
        return Math.floor(parsed / (7 * 86_400_000));
      })
      .filter((week): week is number => week != null),
  );
}

/** A candidate carries everything the lifecycle needs to grade and merge it. */
export type InsightCandidate = ResponseInsight;

/** Deterministic id from the pattern identity — stable across rebuilds. */
export function patternKeyFor(
  domain: ResponseDomainName,
  targetType: ResponseTargetType,
  targetId: string,
  variant = "default",
): string {
  return `${domain}:${targetType}:${targetId}:${variant}`.toLowerCase().replace(/\s+/g, "-");
}

export function insightIdFor(athleteId: string, patternKey: string): string {
  return `insight:${athleteId}:${patternKey}`;
}

function isoDate(value: string): string {
  return value.slice(0, 10);
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** Whether the later observation performed better, worse, or held. */
export type PerformanceDelta = "improved" | "declined" | "held" | "unknown";

export function performanceDelta(
  previous: ExercisePerformanceObservation,
  next: ExercisePerformanceObservation,
): PerformanceDelta {
  const prevLoad = previous.bestCompletedLoad;
  const nextLoad = next.bestCompletedLoad;
  // Load is the primary lever, but only when both sides recorded one — a
  // missing load can never manufacture progression.
  if (prevLoad != null && nextLoad != null && prevLoad > 0 && nextLoad > 0) {
    if (nextLoad > prevLoad) return "improved";
    if (nextLoad < prevLoad) return "declined";
    const prevReps = previous.totalCompletedReps ?? 0;
    const nextReps = next.totalCompletedReps ?? 0;
    if (nextReps > prevReps) return "improved";
    if (nextReps < prevReps) return "declined";
    return "held";
  }
  const prevReps = previous.totalCompletedReps;
  const nextReps = next.totalCompletedReps;
  if (prevReps != null && nextReps != null) {
    if (nextReps > prevReps) return "improved";
    if (nextReps < prevReps) return "declined";
    return "held";
  }
  return "unknown";
}

/** Evidence records that reference a given execution record. */
function evidenceIdsForSessions(bundle: ResponseEvidenceBundle, sessionIds: string[]): string[] {
  const wanted = new Set(sessionIds);
  return bundle.evidence
    .filter((record) => record.provenance.executionRecordId && wanted.has(record.provenance.executionRecordId))
    .map((record) => record.id);
}

function qualitiesFor(bundle: ResponseEvidenceBundle, evidenceIds: string[]): ResponseEvidenceRecord["quality"][] {
  const wanted = new Set(evidenceIds);
  return bundle.evidence.filter((record) => wanted.has(record.id)).map((record) => record.quality);
}

type CandidateSeed = {
  domain: ResponseDomainName;
  targetType: ResponseTargetType;
  targetId: string;
  targetLabel: string;
  variant?: string;
  finding: string;
  interpretation: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  excluded?: Array<{ id: string; reason: string }>;
  observationDates: string[];
  weeks: number[];
  phases: string[];
  totalObservations: number;
  comparableObservations: number;
  supportingObservations: number;
  contradictingObservations: number;
  direction: ResponseInsightDirection;
  magnitudeDescription: string;
  limitations: string[];
  missingCriticalContext: string[];
  eligibilityOverride?: { eligible: boolean; reason: string };
};

function buildCandidate(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
  seed: CandidateSeed,
): InsightCandidate {
  const patternKey = patternKeyFor(seed.domain, seed.targetType, seed.targetId, seed.variant);
  const dates = uniq(seed.observationDates).sort();
  const quality = qualitiesFor(bundle, seed.supportingEvidenceIds);

  const grade = calculateResponseConfidence({
    comparableObservations: seed.comparableObservations,
    supportingObservations: seed.supportingObservations,
    contradictingObservations: seed.contradictingObservations,
    weeksRepresented: uniq(seed.weeks).length,
    phasesRepresented: uniq(seed.phases).length,
    evidenceQuality: quality,
    missingCriticalContext: seed.missingCriticalContext,
    distinctDates: dates.length,
  });

  const eligible =
    seed.eligibilityOverride ??
    (grade.confidence === "insufficient"
      ? { eligible: false, reason: "Not enough comparable evidence to act on." }
      : grade.confidence === "emerging"
        ? { eligible: false, reason: "Emerging patterns are monitored, not acted on." }
        : { eligible: true, reason: `Supported by ${seed.comparableObservations} comparable observations across ${uniq(seed.weeks).length} weeks.` });

  const exclusionReasons: Record<string, string> = {};
  for (const item of seed.excluded ?? []) exclusionReasons[item.id] = item.reason;

  return {
    id: insightIdFor(context.athleteId, patternKey),
    athleteId: context.athleteId,
    domain: seed.domain,
    targetType: seed.targetType,
    targetId: seed.targetId,
    targetLabel: seed.targetLabel,
    patternKey,
    finding: seed.finding,
    interpretation: seed.interpretation,
    status: "emerging",
    confidence: grade.confidence,
    sample: {
      totalObservations: seed.totalObservations,
      comparableObservations: seed.comparableObservations,
      supportingObservations: seed.supportingObservations,
      contradictingObservations: seed.contradictingObservations,
      firstObservedAt: dates[0] ?? context.now,
      lastObservedAt: dates[dates.length - 1] ?? context.now,
      phasesRepresented: uniq(seed.phases),
      weeksRepresented: uniq(seed.weeks).sort((a, b) => a - b),
    },
    evidence: {
      supportingEvidenceIds: uniq(seed.supportingEvidenceIds),
      contradictingEvidenceIds: uniq(seed.contradictingEvidenceIds),
      excludedEvidenceIds: (seed.excluded ?? []).map((item) => item.id),
      exclusionReasons,
    },
    magnitude: { direction: seed.direction, description: seed.magnitudeDescription },
    recommendationEligibility: eligible,
    limitations: uniq([...seed.limitations, ...grade.limitingReasons]),
    createdAt: context.now,
    updatedAt: context.now,
    context: {
      phaseId: context.currentPhaseId,
      nutritionPhase: context.currentNutritionPhase,
      programId: context.programId,
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════
   VOLUME
   ════════════════════════════════════════════════════════════════════════ */

/** Weekly performance quality for a muscle — did the week's comparable work
    move forward, hold, or fall back? */
function weeklyPerformanceDirection(slice: WeekSlice, muscle: string): PerformanceDelta {
  const relevant = slice.bundle.performance.filter((observation) =>
    slice.bundle.muscleExposure.some(
      (summary) => summary.muscle === muscle && summary.completedExposureDates.includes(isoDate(observation.performedAt)),
    ),
  );
  if (relevant.length === 0) return "unknown";
  const improved = relevant.filter((o) => o.comparableToPrevious && (o.bestCompletedLoad ?? 0) > 0).length;
  const failed = relevant.reduce((sum, o) => sum + o.failedSets, 0);
  if (failed > improved) return "declined";
  const quality = relevant.map((o) => o.sessionQuality).filter((q): q is number => q != null);
  if (quality.length > 0) {
    const mean = quality.reduce((a, b) => a + b, 0) / quality.length;
    if (mean >= 7) return "improved";
    if (mean <= 4) return "declined";
    return "held";
  }
  return improved > 0 ? "improved" : "held";
}

export function detectVolumeInsights(
  bundle: ResponseEvidenceBundle,
  weeks: WeekSlice[],
  context: DomainContext,
): InsightCandidate[] {
  if (weeks.length < 2) return [];
  const out: InsightCandidate[] = [];
  // Only muscles that received real DIRECT work. Incidental secondary exposure
  // (biceps from rows, front delts from pressing) is genuine evidence but it is
  // not something the athlete trains a volume decision around, and emitting an
  // insight per incidental muscle buries the findings that matter.
  const muscles = uniq(
    bundle.muscleExposure
      .filter((summary) => summary.completedDirectSetEquivalents >= 2)
      .map((summary) => summary.muscle),
  );

  for (const muscle of muscles) {
    // Per-week completed DIRECT set-equivalents. Planned-but-skipped work is
    // already absent from the evidence engine's completed figures.
    const points = weeks
      .map((slice) => {
        const summary = slice.bundle.muscleExposure.find((entry) => entry.muscle === muscle);
        if (!summary || summary.completedDirectSetEquivalents <= 0) return null;
        return {
          weekNumber: slice.weekNumber,
          sets: Math.round(summary.completedDirectSetEquivalents * 10) / 10,
          indirect: Math.round(summary.completedIndirectSetEquivalents * 10) / 10,
          direction: weeklyPerformanceDirection(slice, muscle),
          dates: summary.completedExposureDates,
          sessionIds: slice.bundle.provenance.contributingSessions,
          limitations: summary.limitations,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point != null);

    if (points.length < 2) continue;

    const productive = points.filter((p) => p.direction === "improved" || p.direction === "held");
    const unproductive = points.filter((p) => p.direction === "declined");

    if (productive.length === 0) continue;

    const productiveSets = productive.map((p) => p.sets).sort((a, b) => a - b);
    const low = productiveSets[0];
    const high = productiveSets[productiveSets.length - 1];
    const rangeLabel = low === high ? `${low}` : `${low}–${high}`;

    const declineAbove = unproductive.length > 0 ? Math.min(...unproductive.map((p) => p.sets)) : null;

    // A week that declined ABOVE the productive range is not contradicting the
    // finding — it is what establishes the ceiling. Genuine contradiction is a
    // week that behaved the opposite way to what the range predicts: a decline
    // INSIDE the range, or progress above the ceiling.
    const contradicting = points.filter((p) => {
      if (declineAbove == null) return false;
      const insideRange = p.sets >= low && p.sets <= high;
      if (insideRange && p.direction === "declined") return true;
      if (p.sets >= declineAbove && (p.direction === "improved" || p.direction === "held")) return true;
      return false;
    });
    const contradictingSessionIds = uniq(contradicting.flatMap((p) => p.sessionIds));
    const rangeEvidenceSessions = uniq(points.flatMap((p) => p.sessionIds)).filter(
      (id) => !contradictingSessionIds.includes(id),
    );

    const supportingEvidenceIds = evidenceIdsForSessions(bundle, rangeEvidenceSessions);
    const contradictingEvidenceIds = evidenceIdsForSessions(bundle, contradictingSessionIds)
      .filter((id) => !supportingEvidenceIds.includes(id));

    // An insight with no supporting evidence is not an insight. This happens
    // when every week falls on the contradicting side, which means the range
    // Reserve inferred does not actually describe the athlete.
    if (supportingEvidenceIds.length === 0) continue;
    const finding =
      declineAbove != null
        ? `Weeks with ${rangeLabel} completed direct set-equivalents for ${muscle} have held or progressed. Weeks at or above ${declineAbove} have not.`
        : `Weeks with ${rangeLabel} completed direct set-equivalents for ${muscle} have held or progressed.`;

    const interpretation =
      declineAbove != null
        ? `The evidence so far is compatible with a productive working range near ${rangeLabel} set-equivalents for ${muscle}, with diminishing return above it. Reserve has not established an exact optimum and is not claiming one.`
        : `The evidence so far is compatible with ${rangeLabel} set-equivalents being a productive range for ${muscle}. More weeks at different volumes would sharpen this.`;

    out.push(
      buildCandidate(bundle, context, {
        domain: "volume",
        targetType: "muscle",
        targetId: muscle,
        targetLabel: muscle,
        finding,
        interpretation,
        supportingEvidenceIds,
        contradictingEvidenceIds,
        observationDates: uniq(points.flatMap((p) => p.dates)),
        weeks: points.map((p) => p.weekNumber),
        phases: uniq(bundle.performance.map((o) => o.comparisonContext.phaseId ?? "").filter(Boolean)),
        totalObservations: points.length,
        comparableObservations: points.length,
        supportingObservations: points.length - contradicting.length,
        contradictingObservations: contradicting.length,
        direction: declineAbove != null ? "mixed" : "positive",
        magnitudeDescription: `${productive.length} productive week${productive.length === 1 ? "" : "s"} at ${rangeLabel} set-equivalents${declineAbove != null ? `, ${unproductive.length} unproductive at or above ${declineAbove}` : ""}.`,
        limitations: uniq(points.flatMap((p) => p.limitations)),
        missingCriticalContext: points.some((p) => p.direction === "unknown")
          ? ["performance direction could not be read for at least one week"]
          : [],
      }),
    );
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   FREQUENCY
   ════════════════════════════════════════════════════════════════════════ */

export function detectFrequencyInsights(
  bundle: ResponseEvidenceBundle,
  weeks: WeekSlice[],
  context: DomainContext,
): InsightCandidate[] {
  if (weeks.length < 2) return [];
  const out: InsightCandidate[] = [];

  // Same discipline as volume: frequency is only meaningful for targets the
  // athlete actually trains directly.
  const directMuscles = new Set(
    bundle.muscleExposure
      .filter((summary) => summary.completedDirectSetEquivalents >= 2)
      .map((summary) => summary.muscle),
  );
  const targets = uniq(
    bundle.frequency
      .filter((entry) => entry.category !== "primary-lift")
      .filter((entry) => entry.category !== "muscle" || directMuscles.has(entry.target))
      .map((entry) => entry.target),
  );

  for (const target of targets) {
    const category = bundle.frequency.find((entry) => entry.target === target)?.category ?? "muscle";
    const points = weeks
      .map((slice) => {
        const entry = slice.bundle.frequency.find((item) => item.target === target);
        if (!entry || entry.completedWeeklyFrequency <= 0) return null;
        const direction =
          category === "muscle" ? weeklyPerformanceDirection(slice, target) : ("unknown" as PerformanceDelta);
        return {
          weekNumber: slice.weekNumber,
          exposures: entry.completedWeeklyFrequency,
          dates: entry.exposureDates,
          spacing: entry.spacingHours,
          direction,
          sessionIds: slice.bundle.provenance.contributingSessions,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point != null);

    if (points.length < 2) continue;

    // Group weeks by the exposure count actually completed.
    const byExposure = new Map<number, typeof points>();
    for (const point of points) {
      const list = byExposure.get(point.exposures) ?? [];
      list.push(point);
      byExposure.set(point.exposures, list);
    }

    const evaluated = [...byExposure.entries()]
      .map(([exposures, group]) => ({
        exposures,
        weeks: group.length,
        productive: group.filter((p) => p.direction === "improved" || p.direction === "held").length,
        unproductive: group.filter((p) => p.direction === "declined").length,
        group,
      }))
      .sort((a, b) => a.exposures - b.exposures);

    const best = evaluated.filter((entry) => entry.productive > 0).sort((a, b) => b.productive - a.productive)[0];
    if (!best) continue;

    const untested = evaluated.filter((entry) => entry.exposures !== best.exposures && entry.weeks < 2);
    const supportingEvidenceIds = evidenceIdsForSessions(bundle, uniq(best.group.flatMap((p) => p.sessionIds)));
    const contradicting = evaluated.filter((entry) => entry.exposures === best.exposures ? false : entry.unproductive > 0);
    const contradictingEvidenceIds = evidenceIdsForSessions(
      bundle,
      uniq(contradicting.flatMap((entry) => entry.group.flatMap((p) => p.sessionIds))),
    ).filter((id) => !supportingEvidenceIds.includes(id));

    const untestedNote = untested.length
      ? ` ${untested.map((entry) => `${entry.exposures} weekly exposure${entry.exposures === 1 ? "" : "s"}`).join(" and ")} ${untested.length === 1 ? "has" : "have"} not yet produced enough comparable evidence to compare against.`
      : "";

    out.push(
      buildCandidate(bundle, context, {
        domain: "frequency",
        targetType: category === "movement-pattern" ? "movement-pattern" : "muscle",
        targetId: target,
        targetLabel: target,
        finding: `${target} has held or progressed across ${best.weeks} week${best.weeks === 1 ? "" : "s"} at ${best.exposures} weekly exposure${best.exposures === 1 ? "" : "s"}.${untestedNote}`,
        interpretation: `The current evidence is compatible with ${best.exposures} weekly exposure${best.exposures === 1 ? "" : "s"} being productive for ${target}. This is specific to ${target} and does not imply a single ideal frequency for the whole body.`,
        supportingEvidenceIds,
        contradictingEvidenceIds,
        observationDates: uniq(points.flatMap((p) => p.dates)),
        weeks: points.map((p) => p.weekNumber),
        phases: uniq(bundle.performance.map((o) => o.comparisonContext.phaseId ?? "").filter(Boolean)),
        totalObservations: points.length,
        comparableObservations: best.weeks + contradicting.reduce((sum, entry) => sum + entry.weeks, 0),
        supportingObservations: best.productive,
        contradictingObservations: contradicting.reduce((sum, entry) => sum + entry.unproductive, 0),
        direction: contradicting.length ? "mixed" : "positive",
        magnitudeDescription: `${best.exposures} weekly exposure${best.exposures === 1 ? "" : "s"} across ${best.weeks} week${best.weeks === 1 ? "" : "s"}.`,
        limitations: untested.length ? ["Alternative exposure counts have not been tested enough to compare."] : [],
        missingCriticalContext: points.some((p) => p.direction === "unknown")
          ? ["performance direction could not be read for at least one week"]
          : [],
      }),
    );
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   EXERCISE
   ════════════════════════════════════════════════════════════════════════ */

export function detectExerciseInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  const out: InsightCandidate[] = [];
  const byKey = new Map<string, ExercisePerformanceObservation[]>();
  for (const observation of bundle.performance) {
    const list = byKey.get(observation.comparisonKey) ?? [];
    list.push(observation);
    byKey.set(observation.comparisonKey, list);
  }

  for (const [comparisonKey, rawGroup] of byKey) {
    const group = [...rawGroup].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
    if (group.length < 2) continue;

    // Only genuinely comparable consecutive pairs count. Unlike variations are
    // excluded with a recorded reason rather than silently merged.
    const comparablePairs: Array<{ previous: ExercisePerformanceObservation; next: ExercisePerformanceObservation; delta: PerformanceDelta }> = [];
    const excluded: Array<{ id: string; reason: string }> = [];

    for (let i = 1; i < group.length; i += 1) {
      const previous = group[i - 1];
      const next = group[i];
      const comparison = compareResponseEvidence(previous, next);
      if (!comparison.comparable) {
        excluded.push({
          id: next.id,
          reason: comparison.blockingDifferences[0] ?? comparison.meaningfulDifferences[0] ?? "Not comparable to the previous exposure.",
        });
        continue;
      }
      comparablePairs.push({ previous, next, delta: performanceDelta(previous, next) });
    }

    if (comparablePairs.length === 0) continue;

    const improved = comparablePairs.filter((pair) => pair.delta === "improved");
    const declined = comparablePairs.filter((pair) => pair.delta === "declined");
    const unknown = comparablePairs.filter((pair) => pair.delta === "unknown");
    const label = group[group.length - 1].performedName;
    const painful = group.filter((observation) => (observation.painMax ?? 0) >= 3);

    if (improved.length === 0 && declined.length === 0) continue;

    const progressedCount = improved.length;
    const totalComparable = comparablePairs.length;
    const direction: ResponseInsightDirection =
      progressedCount > declined.length ? "positive" : declined.length > progressedCount ? "negative" : "mixed";

    // Which side SUPPORTS the finding depends on what the finding says. For
    // "this movement is not progressing", the declining exposures are the
    // evidence for it — filing them as contradiction left the insight with no
    // supporting evidence at all and read as a total conflict.
    const supportingPairs = direction === "negative" ? declined : improved;
    const opposingPairs = direction === "negative" ? improved : declined;

    const supportingObservationIds = supportingPairs.map((pair) => pair.next.id);
    const decliningObservationIds = opposingPairs.map((pair) => pair.next.id);

    const supportingEvidenceIds = evidenceIdsForSessions(
      bundle,
      uniq(supportingPairs.map((pair) => pair.next.executionRecordId)),
    );
    const contradictingEvidenceIds = evidenceIdsForSessions(
      bundle,
      uniq(opposingPairs.map((pair) => pair.next.executionRecordId)),
    ).filter((id) => !supportingEvidenceIds.includes(id));

    if (supportingEvidenceIds.length === 0) continue;

    const painClause = painful.length
      ? ` Discomfort was reported in ${painful.length} of ${group.length} exposures.`
      : " No discomfort has been reported in these exposures.";

    out.push(
      buildCandidate(bundle, context, {
        domain: "exercise",
        targetType: "exercise",
        targetId: comparisonKey,
        targetLabel: label,
        finding: `${label} progressed in ${progressedCount} of ${totalComparable} comparable exposures.${painClause}`,
        interpretation:
          direction === "positive"
            ? `${label} has been a reliable progression driver for you so far. Reserve may prefer it as an anchor for this pattern while that continues.`
            : direction === "negative"
              ? `${label} has not been progressing in comparable conditions. That may reflect the movement, the position it sits in, or the fatigue it inherits.`
              : `${label} has produced mixed results in comparable conditions, so Reserve is still watching it.`,
        supportingEvidenceIds,
        contradictingEvidenceIds,
        excluded,
        observationDates: group.map((observation) => isoDate(observation.performedAt)),
        weeks: weeksForSessions(context, group.map((observation) => observation.executionRecordId)),
        phases: uniq(group.map((observation) => observation.comparisonContext.phaseId ?? "").filter(Boolean)),
        totalObservations: group.length,
        comparableObservations: totalComparable,
        supportingObservations: supportingObservationIds.length,
        contradictingObservations: decliningObservationIds.length,
        direction,
        magnitudeDescription: `${progressedCount} of ${totalComparable} comparable exposures progressed.`,
        limitations: uniq([
          ...group.flatMap((observation) => observation.comparabilityLimitations),
          ...(unknown.length ? ["Some exposures had no recorded load or reps, so progression could not be read."] : []),
          ...(excluded.length ? [`${excluded.length} exposure${excluded.length === 1 ? "" : "s"} excluded as not comparable.`] : []),
        ]),
        missingCriticalContext: group.every((observation) => observation.bestCompletedLoad == null)
          ? ["no recorded load for this movement"]
          : [],
      }),
    );
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   PAIN — conservative by construction
   ════════════════════════════════════════════════════════════════════════ */

export const CONCERNING_PAIN_LEVEL = 7;

export function detectPainInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  const out: InsightCandidate[] = [];
  const byExercise = new Map<string, ExercisePerformanceObservation[]>();
  for (const observation of bundle.performance) {
    if ((observation.painMax ?? 0) <= 0) continue;
    const list = byExercise.get(observation.comparisonKey) ?? [];
    list.push(observation);
    byExercise.set(observation.comparisonKey, list);
  }

  for (const [comparisonKey, rawGroup] of byExercise) {
    const group = [...rawGroup].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
    const label = group[group.length - 1].performedName;
    const maxPain = Math.max(...group.map((observation) => observation.painMax ?? 0));
    const concerning = maxPain >= CONCERNING_PAIN_LEVEL;

    const supportingEvidenceIds = evidenceIdsForSessions(bundle, uniq(group.map((o) => o.executionRecordId)));
    const totalExposures = bundle.performance.filter((o) => o.comparisonKey === comparisonKey).length;

    // A single painful exposure is recorded and monitored. It never bans an
    // exercise and it never becomes actionable on its own.
    const single = group.length === 1;

    out.push(
      buildCandidate(bundle, context, {
        domain: "pain",
        targetType: "exercise",
        targetId: comparisonKey,
        targetLabel: label,
        variant: "pain-association",
        finding: single
          ? `Discomfort was reported once during ${label} (reported level ${maxPain}).`
          : `Discomfort was reported in ${group.length} of ${totalExposures} exposures to ${label} (highest reported level ${maxPain}).`,
        interpretation: concerning
          ? `You have reported a high discomfort level during ${label}. Reserve records what you report and does not assess it. Persistent, severe, sharp, or escalating discomfort is a conversation for a qualified clinician before continuing this movement.`
          : single
            ? `One uncomfortable exposure is not a pattern. Reserve has recorded it and will watch whether it repeats in comparable conditions before changing anything.`
            : `Repeated discomfort in comparable exposures to ${label} may indicate this movement or its current setup does not suit you at the moment. Reserve records what you report and does not assess it.`,
        supportingEvidenceIds,
        contradictingEvidenceIds: [],
        observationDates: group.map((o) => isoDate(o.performedAt)),
        weeks: weeksForSessions(context, group.map((o) => o.executionRecordId)),
        phases: uniq(group.map((o) => o.comparisonContext.phaseId ?? "").filter(Boolean)),
        totalObservations: totalExposures,
        comparableObservations: group.length,
        supportingObservations: group.length,
        contradictingObservations: 0,
        direction: "negative",
        magnitudeDescription: `Highest reported discomfort level ${maxPain} across ${group.length} exposure${group.length === 1 ? "" : "s"}.`,
        limitations: [
          "Reserve records discomfort exactly as reported. It does not assess, diagnose, or interpret it.",
          ...(single ? ["A single exposure cannot establish a pattern."] : []),
        ],
        missingCriticalContext: [],
        // Concerning pain routes to professional review regardless of sample
        // size — that path does not require a confident training pattern.
        eligibilityOverride: concerning
          ? { eligible: true, reason: "A high reported discomfort level routes to professional review rather than a training change." }
          : single
            ? { eligible: false, reason: "One painful exposure is monitored, never acted on." }
            : undefined,
      }),
    );
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY
   ════════════════════════════════════════════════════════════════════════ */

export function detectRecoveryInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  const out: InsightCandidate[] = [];

  // Sleep is used ONLY where it was actually recorded.
  const withSleep = bundle.recovery.filter((entry) => entry.sleepHours != null);
  if (withSleep.length >= 2) {
    const sessionQuality = new Map<string, number>();
    for (const observation of bundle.performance) {
      if (observation.sessionQuality != null) sessionQuality.set(observation.executionRecordId, observation.sessionQuality);
    }
    const scored = withSleep
      .map((entry) => ({ entry, quality: sessionQuality.get(entry.sessionId) }))
      .filter((item): item is { entry: typeof withSleep[number]; quality: number } => item.quality != null);

    if (scored.length >= 2) {
      const lowSleep = scored.filter((item) => (item.entry.sleepHours ?? 0) < 6.5);
      const goodSleep = scored.filter((item) => (item.entry.sleepHours ?? 0) >= 7);
      if (lowSleep.length >= 1 && goodSleep.length >= 1) {
        const lowMean = lowSleep.reduce((sum, item) => sum + item.quality, 0) / lowSleep.length;
        const goodMean = goodSleep.reduce((sum, item) => sum + item.quality, 0) / goodSleep.length;
        if (goodMean - lowMean >= 1) {
          // Both arms of the comparison SUPPORT the finding. The short-sleep
          // sessions are the contrast that makes the pattern visible, not
          // evidence against it — miscounting them as contradiction was
          // marking a clean comparison as conflicted.
          const supportingEvidenceIds = evidenceIdsForSessions(
            bundle,
            [...goodSleep, ...lowSleep].map((item) => item.entry.sessionId),
          );
          out.push(
            buildCandidate(bundle, context, {
              domain: "recovery",
              targetType: "session",
              targetId: "sleep-quality",
              targetLabel: "Sleep and session quality",
              finding: `Sessions after 7 or more hours of recorded sleep have rated ${Math.round((goodMean - lowMean) * 10) / 10} points higher for quality than sessions after under 6.5 hours.`,
              interpretation:
                "Reserve has observed that your session quality tracks your recorded sleep. This is an observed association in your own logs, not a physiological measurement.",
              supportingEvidenceIds,
              contradictingEvidenceIds: [],
              observationDates: scored.map((item) => item.entry.calendarDate),
              weeks: weeksForSessions(context, scored.map((item) => item.entry.sessionId)),
              phases: [],
              totalObservations: bundle.recovery.length,
              comparableObservations: scored.length,
              supportingObservations: goodSleep.length,
              contradictingObservations: 0,
              direction: "positive",
              magnitudeDescription: `${goodSleep.length} well-slept sessions compared against ${lowSleep.length} short-sleep sessions.`,
              limitations: ["Sleep is self-recorded and only used where it was actually entered."],
              missingCriticalContext: bundle.recovery.some((entry) => entry.missingFields.includes("sleepHours"))
                ? ["sleep was not recorded for every session"]
                : [],
            }),
          );
        }
      }
    }
  }

  // Spacing between related exposures.
  const spaced = bundle.recovery.filter((entry) => entry.hoursSinceRelatedExposure != null);
  if (spaced.length >= 2) {
    const quality = new Map<string, number>();
    for (const observation of bundle.performance) {
      if (observation.sessionQuality != null) quality.set(observation.executionRecordId, observation.sessionQuality);
    }
    const close = spaced.filter((entry) => (entry.hoursSinceRelatedExposure ?? 0) < 48 && quality.has(entry.sessionId));
    const wide = spaced.filter((entry) => (entry.hoursSinceRelatedExposure ?? 0) >= 48 && quality.has(entry.sessionId));
    if (close.length >= 1 && wide.length >= 1) {
      const closeMean = close.reduce((sum, e) => sum + (quality.get(e.sessionId) ?? 0), 0) / close.length;
      const wideMean = wide.reduce((sum, e) => sum + (quality.get(e.sessionId) ?? 0), 0) / wide.length;
      if (wideMean - closeMean >= 1) {
        // Again: both arms are the comparison, so both support the finding.
        const supportingEvidenceIds = evidenceIdsForSessions(
          bundle,
          [...wide, ...close].map((e) => e.sessionId),
        );
        out.push(
          buildCandidate(bundle, context, {
            domain: "recovery",
            targetType: "session",
            targetId: "exposure-spacing",
            targetLabel: "Session spacing",
            finding: `Sessions with 48 or more hours since the related exposure have rated higher for quality than sessions inside 48 hours.`,
            interpretation:
              "Comparable sessions have performed better when the related exposure was further away. Reserve describes this as an observed spacing pattern, not an exact physiological recovery time.",
            supportingEvidenceIds,
            contradictingEvidenceIds: [],
            observationDates: [...close, ...wide].map((e) => e.calendarDate),
            weeks: weeksForSessions(context, [...close, ...wide].map((e) => e.sessionId)),
            phases: [],
            totalObservations: spaced.length,
            comparableObservations: close.length + wide.length,
            supportingObservations: wide.length,
            contradictingObservations: 0,
            direction: "positive",
            magnitudeDescription: `${wide.length} widely spaced sessions compared against ${close.length} closely spaced sessions.`,
            limitations: ["Timing is evidence of association, not proof of a recovery mechanism."],
            missingCriticalContext: [],
          }),
        );
      }
    }
  }

  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   CONDITIONING
   ════════════════════════════════════════════════════════════════════════ */

export function detectConditioningInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  if (bundle.conditioning.length === 0) return [];
  const out: InsightCandidate[] = [];

  const byModality = new Map<string, ConditioningEvidence[]>();
  for (const entry of bundle.conditioning) {
    const list = byModality.get(entry.modality) ?? [];
    list.push(entry);
    byModality.set(entry.modality, list);
  }

  // Session quality on the day AFTER a conditioning exposure, keyed by date.
  const qualityByDate = new Map<string, number>();
  for (const observation of bundle.performance) {
    if (observation.sessionQuality != null) qualityByDate.set(isoDate(observation.performedAt), observation.sessionQuality);
  }

  for (const [modality, entries] of byModality) {
    const close = entries.filter((entry) => (entry.proximityToNextLowerTrainingHours ?? Infinity) <= 24);
    const separated = entries.filter((entry) => (entry.proximityToNextLowerTrainingHours ?? 0) >= 48);

    // Timing alone is never enough. A performance or recovery relationship is
    // required before Reserve will call anything interference.
    const closeWithOutcome = close
      .map((entry) => ({ entry, quality: nextDayQuality(entry, qualityByDate) }))
      .filter((item): item is { entry: ConditioningEvidence; quality: number } => item.quality != null);
    const separatedWithOutcome = separated
      .map((entry) => ({ entry, quality: nextDayQuality(entry, qualityByDate) }))
      .filter((item): item is { entry: ConditioningEvidence; quality: number } => item.quality != null);

    if (closeWithOutcome.length === 0) continue;

    const closeMean = closeWithOutcome.reduce((sum, item) => sum + item.quality, 0) / closeWithOutcome.length;
    const separatedMean = separatedWithOutcome.length
      ? separatedWithOutcome.reduce((sum, item) => sum + item.quality, 0) / separatedWithOutcome.length
      : null;

    const suggestsInterference = separatedMean != null ? separatedMean - closeMean >= 1 : closeMean <= 5;
    if (!suggestsInterference) continue;

    const supportingEvidenceIds = bundle.evidence
      .filter((record) => record.domain === "conditioning" && closeWithOutcome.some((item) => record.calendarDate === item.entry.date))
      .map((record) => record.id);

    // The well-separated exposures are the control arm of the comparison, so
    // they support the finding rather than argue against it.
    const separatedEvidenceIds = separatedWithOutcome.length
      ? bundle.evidence
          .filter((record) => record.domain === "conditioning" && separatedWithOutcome.some((item) => record.calendarDate === item.entry.date))
          .map((record) => record.id)
          .filter((id) => !supportingEvidenceIds.includes(id))
      : [];

    out.push(
      buildCandidate(bundle, context, {
        domain: "conditioning",
        targetType: "conditioning-modality",
        targetId: modality,
        targetLabel: modality,
        finding: `${closeWithOutcome.length} lower-body session${closeWithOutcome.length === 1 ? "" : "s"} within 24 hours of ${modality} rated lower for quality${separatedMean != null ? ` than the ${separatedWithOutcome.length} that followed at least 48 hours later` : ""}.`,
        interpretation: `The evidence is compatible with ${modality} carrying into the following lower-body session at this spacing. Reserve reads this as an observed relationship between two things you logged, not a proven interference mechanism.`,
        supportingEvidenceIds: [...supportingEvidenceIds, ...separatedEvidenceIds],
        contradictingEvidenceIds: [],
        observationDates: [...closeWithOutcome, ...separatedWithOutcome].map((item) => item.entry.date),
        weeks: isoWeeksForDates([...closeWithOutcome, ...separatedWithOutcome].map((item) => item.entry.date)),
        phases: [],
        totalObservations: entries.length,
        comparableObservations: closeWithOutcome.length + separatedWithOutcome.length,
        supportingObservations: closeWithOutcome.length,
        contradictingObservations: 0,
        direction: "negative",
        magnitudeDescription: separatedMean != null
          ? `Mean session quality ${Math.round(closeMean * 10) / 10} within 24 hours against ${Math.round(separatedMean * 10) / 10} when separated.`
          : `Mean session quality ${Math.round(closeMean * 10) / 10} within 24 hours.`,
        limitations: [
          "Timing on its own is not evidence of interference; this rests on the repeated performance relationship.",
          ...(separatedWithOutcome.length === 0 ? ["No widely separated exposures yet to compare against."] : []),
        ],
        missingCriticalContext: separatedWithOutcome.length === 0 ? ["no separated conditioning exposures to compare"] : [],
      }),
    );
  }
  return out;
}

function nextDayQuality(entry: ConditioningEvidence, qualityByDate: Map<string, number>): number | null {
  const base = Date.parse(`${entry.date}T00:00:00.000Z`);
  if (Number.isNaN(base)) return null;
  // Offset 0 matters: an early-morning class followed by that same day's
  // lower session is the tightest collision there is, and skipping it made
  // the clearest interference case invisible.
  for (const offset of [0, 1, 2]) {
    const key = new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
    const value = qualityByDate.get(key);
    if (value != null) return value;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════
   BODY COMPOSITION + NUTRITION / ADHERENCE
   ════════════════════════════════════════════════════════════════════════ */

export function detectBodyCompositionInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  const points = [...bundle.bodyComposition]
    .filter((entry) => entry.weightKg != null)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (points.length < 2) return [];

  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.max(1, (Date.parse(last.observedAt) - Date.parse(first.observedAt)) / 86_400_000);
  const deltaKg = (last.weightKg ?? 0) - (first.weightKg ?? 0);
  const kgPerWeek = Math.round((deltaKg / (days / 7)) * 100) / 100;

  // Performance direction over the same span — the context without which a
  // weight change means nothing.
  const observations = [...bundle.performance].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  let improved = 0;
  let declined = 0;
  for (let i = 1; i < observations.length; i += 1) {
    if (!compareResponseEvidence(observations[i - 1], observations[i]).comparable) continue;
    const delta = performanceDelta(observations[i - 1], observations[i]);
    if (delta === "improved") improved += 1;
    if (delta === "declined") declined += 1;
  }
  const performanceKnown = improved + declined > 0;
  const performanceDirection: PerformanceDelta = !performanceKnown
    ? "unknown"
    : improved > declined ? "improved" : declined > improved ? "declined" : "held";

  const trend = kgPerWeek <= -0.2 ? "declining" : kgPerWeek >= 0.2 ? "increasing" : "stable";
  const adherenceKnown = points.some((entry) => entry.adherence != null);

  let finding: string;
  let interpretation: string;
  let direction: ResponseInsightDirection = "neutral";

  if (trend === "declining" && performanceDirection === "declined") {
    finding = `Body weight is declining at about ${Math.abs(kgPerWeek)} kg per week while comparable training performance has fallen.`;
    interpretation = "This combination is compatible with total demand exceeding what current intake and recovery are supporting. It does not on its own identify a cause, and it is a reason to review demand and intake before adding anything.";
    direction = "negative";
  } else if (trend === "declining" && performanceDirection === "improved") {
    finding = `Body weight is declining at about ${Math.abs(kgPerWeek)} kg per week while comparable training performance has improved.`;
    interpretation = "Weight loss with retained or improving performance is compatible with the intended direction of a fat-loss phase. Reserve cannot confirm from scale weight alone what tissue changed.";
    direction = "positive";
  } else if (trend === "stable" && performanceDirection === "improved") {
    finding = "Body weight has held stable while comparable training performance has improved.";
    interpretation = "A stable scale with improving performance is compatible with recomposition. It is not proof of it — measurements and photographs carry that judgement, not body weight.";
    direction = "positive";
  } else if (trend === "increasing" && performanceDirection === "improved") {
    finding = `Body weight is increasing at about ${kgPerWeek} kg per week while comparable performance has improved.`;
    interpretation = "Weight gain alongside improving performance is compatible with a productive gain phase. Reserve cannot determine from the scale how much of the gain is lean tissue.";
    direction = "positive";
  } else if (trend === "increasing" && performanceDirection !== "improved") {
    finding = `Body weight is increasing at about ${kgPerWeek} kg per week without a matching improvement in comparable performance.`;
    interpretation = "Weight is moving without the training evidence that would make it productive. Reserve would look at intake, adherence, and stimulus before changing the training itself.";
    direction = "mixed";
  } else {
    /* The direction is in the word, so the rate is unsigned: never "declining at about -0.22". */
    finding = `Body weight has been ${trend} at about ${Math.abs(kgPerWeek)} kg per week.`;
    interpretation = performanceKnown
      ? "Reserve has weight data and some performance context, but the two do not yet form a clear pattern."
      : "Reserve has weight data without enough comparable performance evidence to interpret it. Scale weight alone cannot be read as fat loss, muscle gain, or recomposition.";
    direction = "unknown";
  }

  const supportingEvidenceIds = bundle.evidence
    .filter((record) => record.domain === "body-composition")
    .map((record) => record.id);

  return [
    buildCandidate(bundle, context, {
      domain: "body-composition",
      targetType: "body-composition-phase",
      targetId: context.currentNutritionPhase ?? last.nutritionPhase ?? "current-phase",
      targetLabel: "Body-composition trend",
      finding,
      interpretation,
      supportingEvidenceIds,
      contradictingEvidenceIds: [],
      observationDates: points.map((entry) => isoDate(entry.observedAt)),
      weeks: isoWeeksForDates(points.map((entry) => entry.observedAt)),
      phases: uniq(points.map((entry) => entry.nutritionPhase ?? "").filter(Boolean)),
      totalObservations: points.length,
      comparableObservations: points.length,
      supportingObservations: points.length,
      contradictingObservations: 0,
      direction,
      magnitudeDescription: `${points.length} weigh-ins spanning ${Math.round(days)} days at about ${kgPerWeek} kg per week.`,
      limitations: [
        "Scale weight alone cannot distinguish fat, muscle, water, or gut content.",
        ...(adherenceKnown ? [] : ["Nutrition adherence has not been logged, so intake cannot be ruled in or out."]),
        ...points.flatMap((entry) => entry.limitations),
      ],
      missingCriticalContext: [
        ...(performanceKnown ? [] : ["no comparable performance evidence over this span"]),
        ...(adherenceKnown ? [] : ["no nutrition adherence data"]),
      ],
    }),
  ];
}

export function detectAdherenceInsights(
  bundle: ResponseEvidenceBundle,
  context: DomainContext,
): InsightCandidate[] {
  const withAdherence = bundle.bodyComposition.filter((entry) => entry.adherence != null);
  if (withAdherence.length === 0) return [];

  const mean = withAdherence.reduce((sum, entry) => sum + (entry.adherence ?? 0), 0) / withAdherence.length;
  const incomplete = mean < 0.8;
  if (!incomplete) return [];

  const supportingEvidenceIds = bundle.evidence
    .filter((record) => record.domain === "nutrition" || record.domain === "adherence")
    .map((record) => record.id);

  return [
    buildCandidate(bundle, context, {
      domain: "adherence",
      targetType: "nutrition-pattern",
      targetId: "nutrition-adherence",
      targetLabel: "Nutrition adherence",
      finding: `Logged nutrition adherence has averaged about ${Math.round(mean * 100)}% across ${withAdherence.length} record${withAdherence.length === 1 ? "" : "s"}.`,
      interpretation:
        "When adherence is incomplete, an unchanged body weight is an execution question before it is a plan question. Reserve does not have the evidence to change intake targets on this basis.",
      supportingEvidenceIds,
      contradictingEvidenceIds: [],
      observationDates: withAdherence.map((entry) => isoDate(entry.observedAt)),
      weeks: isoWeeksForDates(withAdherence.map((entry) => entry.observedAt)),
      phases: uniq(withAdherence.map((entry) => entry.nutritionPhase ?? "").filter(Boolean)),
      totalObservations: withAdherence.length,
      comparableObservations: withAdherence.length,
      supportingObservations: withAdherence.length,
      contradictingObservations: 0,
      direction: "negative",
      magnitudeDescription: `Mean logged adherence about ${Math.round(mean * 100)}%.`,
      limitations: ["Adherence is self-reported and incomplete logging is itself missing data."],
      missingCriticalContext: ["complete nutrition logging"],
      eligibilityOverride: {
        eligible: true,
        reason: "Incomplete adherence is itself the finding, and the correct response is a review rather than a plan change.",
      },
    }),
  ];
}
