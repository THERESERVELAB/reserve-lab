import type { MovementExecutionRecord, SessionExecutionRecord } from "@/lib/training/session-execution";

import {
  aggregateConditioningEvidence,
  aggregateExercisePerformance,
  aggregateFrequency,
  aggregateMovementExposure,
  aggregateMuscleExposure,
  aggregateRecoveryContext,
  buildProvenance,
  collectNormalizedSets,
  isFinalizedEvidenceRecord,
} from "./aggregates";
import { resolvePerformedExposureProfile } from "./exercise-exposure";
import { aggregateBodyCompositionEvidence, normalizeCompletedSet } from "./normalize";
import {
  RESPONSE_EVIDENCE_VERSION,
  type EvidenceComparison,
  type EvidenceWindow,
  type ExercisePerformanceObservation,
  type ResponseEvidenceBundle,
  type ResponseEvidenceInput,
  type ResponseEvidenceRecord,
} from "./types";

function quality(limitations: string[], hasValue = true): ResponseEvidenceRecord["quality"] {
  if (!hasValue) return "insufficient";
  if (limitations.length >= 3) return "low";
  if (limitations.length) return "moderate";
  return "high";
}

function observedAt(record: SessionExecutionRecord): string {
  return record.completedAt ?? record.startedAt ?? `${record.calendarDate}T12:00:00.000Z`;
}

function completedMovements(record: SessionExecutionRecord): MovementExecutionRecord[] {
  return [...record.movements, ...record.addedMovements];
}

function evidenceFromExecution(input: ResponseEvidenceInput): ResponseEvidenceRecord[] {
  const output: ResponseEvidenceRecord[] = [];
  for (const record of input.executionRecords.filter(isFinalizedEvidenceRecord)) {
    output.push({
      id: `evidence:session:${record.id}:status`,
      athleteId: record.athleteId,
      observedAt: observedAt(record),
      calendarDate: record.calendarDate,
      source: "session",
      domain: "adherence",
      metric: "session-status",
      value: record.status,
      context: {
        programId: record.programId,
        protocolId: record.protocolId,
        phaseId: record.phaseId,
        sessionId: record.sessionId,
        plannedCompletionPercent: record.sessionMetrics.completionPercent ?? null,
      },
      provenance: { executionRecordId: record.id, weekNumber: record.weekNumber ?? undefined, migrated: record.source === "legacy-migration" },
      quality: record.source === "legacy-migration" ? "low" : "high",
      limitations: record.source === "legacy-migration" ? ["Legacy session detail may be incomplete."] : [],
    });
    for (const movement of completedMovements(record)) {
      const profile = resolvePerformedExposureProfile(record, movement);
      for (const set of movement.completedSets) {
        const normalized = normalizeCompletedSet(set, movement, profile);
        output.push({
          id: `evidence:set:${set.id}:volume`,
          athleteId: record.athleteId,
          observedAt: set.completedAt ?? observedAt(record),
          calendarDate: record.calendarDate,
          source: "set",
          domain: "volume",
          metric: "completed-set-exposure",
          value: normalized.volumeContribution,
          unit: profile?.resistanceVolumeEligible ? "set-equivalent" : "event",
          context: {
            programId: record.programId,
            protocolId: record.protocolId,
            phaseId: record.phaseId,
            exerciseId: profile?.exerciseId ?? movement.exerciseId,
            variation: movement.performedName,
            repTarget: movement.plannedPrescription.reps ?? null,
            loadUnit: normalized.loadUnit ?? null,
            modality: normalized.modality,
            source: movement.source,
          },
          comparisonKey: [profile?.exerciseId ?? movement.exerciseId, movement.performedName.toLowerCase(), movement.plannedPrescription.reps ?? "unknown", normalized.loadUnit ?? "unknown", record.phaseId ?? "unknown"].join("|"),
          provenance: { executionRecordId: record.id, movementRecordId: movement.id, setRecordId: set.id, weekNumber: record.weekNumber ?? undefined },
          quality: quality(normalized.limitations, set.completed),
          limitations: normalized.limitations,
        });
        const factualMetrics: Array<[string, number | undefined, string | undefined]> = [
          ["completed-repetitions", normalized.reps, "repetitions"],
          ["completed-load", normalized.load, normalized.loadUnit],
          ["completed-duration", normalized.durationSeconds, "seconds"],
          ["completed-distance", normalized.distanceMeters, "meters"],
          ["actual-rir", normalized.actualRir, "RIR"],
          ["actual-rpe", normalized.actualRpe, "RPE"],
        ];
        for (const [metric, value, unit] of factualMetrics) {
          if (value == null) continue;
          output.push({
            id: `evidence:set:${set.id}:${metric}`,
            athleteId: record.athleteId,
            observedAt: set.completedAt ?? observedAt(record),
            calendarDate: record.calendarDate,
            source: "set",
            domain: "performance",
            metric,
            value,
            unit,
            context: { exerciseId: profile?.exerciseId ?? movement.exerciseId, variation: movement.performedName, loadUnit: normalized.loadUnit ?? null },
            comparisonKey: output.at(-1)?.comparisonKey,
            provenance: { executionRecordId: record.id, movementRecordId: movement.id, setRecordId: set.id, weekNumber: record.weekNumber ?? undefined },
            quality: "high",
            limitations: [],
          });
        }
      }
      if (movement.athleteFeedback?.pain != null) {
        output.push({
          id: `evidence:movement:${record.id}:${movement.id}:pain`, athleteId: record.athleteId,
          observedAt: observedAt(record), calendarDate: record.calendarDate, source: "athlete-feedback", domain: "pain",
          metric: "movement-pain", value: movement.athleteFeedback.pain, unit: "athlete-rating",
          context: { exerciseId: profile?.exerciseId ?? movement.exerciseId, variation: movement.performedName },
          provenance: { executionRecordId: record.id, movementRecordId: movement.id, weekNumber: record.weekNumber ?? undefined },
          quality: "moderate", limitations: ["Athlete-reported rating; no cause is inferred."],
        });
      }
    }
  }
  return output;
}

function aggregateEvidence(bundle: Omit<ResponseEvidenceBundle, "evidence">, input: ResponseEvidenceInput): ResponseEvidenceRecord[] {
  const athleteId = bundle.athleteId;
  const output: ResponseEvidenceRecord[] = [];
  for (const muscle of bundle.muscleExposure) {
    output.push({
      id: `evidence:muscle:${muscle.muscle.toLowerCase().replace(/\s+/g, "-")}:total`,
      athleteId, observedAt: muscle.completedExposureDates.at(-1) ? `${muscle.completedExposureDates.at(-1)}T12:00:00.000Z` : "1970-01-01T00:00:00.000Z",
      calendarDate: muscle.completedExposureDates.at(-1) ?? "unknown", source: "week", domain: "volume",
      metric: "muscle-total-exposure-equivalent", value: muscle.totalExposureEquivalent, unit: "set-equivalent",
      context: { muscle: muscle.muscle, exposureDays: muscle.exposureDays, replacementActivityEvents: muscle.replacementActivityExposure },
      provenance: {}, quality: muscle.confidence, limitations: muscle.limitations,
    });
  }
  for (const activity of bundle.conditioning) {
    output.push({
      id: `evidence:${activity.id}:duration`, athleteId,
      observedAt: activity.date === "unknown" ? "1970-01-01T00:00:00.000Z" : `${activity.date}T12:00:00.000Z`,
      calendarDate: activity.date, source: "activity", domain: "conditioning", metric: "activity-duration",
      value: activity.durationMinutes ?? null, unit: "minutes",
      context: { modality: activity.modality, intensity: activity.intensity ?? null, impact: activity.impact ?? null, lowerBodyDemand: activity.lowerBodyDemand ?? null, systemicDemand: activity.systemicDemand ?? null, relationship: activity.activityRelationship ?? null, occurrenceWeekNumber: activity.occurrenceWeekNumber ?? null, sourceActivityId: activity.sourceActivityId ?? null, activityRevisionId: activity.activityRevisionId ?? null, previousLowerHours: activity.proximityToPreviousLowerTrainingHours ?? null, nextLowerHours: activity.proximityToNextLowerTrainingHours ?? null },
      provenance: { activityId: activity.activityId, weekNumber: activity.occurrenceWeekNumber }, quality: quality(activity.limitations, activity.durationMinutes != null), limitations: activity.limitations,
    });
  }
  for (const recovery of bundle.recovery) {
    const facts: Array<[string, number | undefined, string]> = [
      ["sleep-hours", recovery.sleepHours, "hours"], ["readiness-score", recovery.readinessScore, "score"],
      ["resting-heart-rate", recovery.restingHeartRate, "bpm"], ["hrv", recovery.hrv, "ms"],
    ];
    for (const [metric, value, unit] of facts) {
      output.push({
        id: `evidence:recovery:${recovery.sessionId}:${metric}`, athleteId,
        observedAt: `${recovery.calendarDate}T12:00:00.000Z`, calendarDate: recovery.calendarDate,
        source: metric === "sleep-hours" ? "sleep" : "readiness", domain: "recovery", metric,
        value: value ?? null, unit, context: { sessionId: recovery.sessionId },
        provenance: { executionRecordId: recovery.sessionId }, quality: value == null ? "insufficient" : "high",
        limitations: value == null ? [`${metric} was not available.`] : [],
      });
    }
  }
  for (const body of bundle.bodyComposition) {
    const facts: Array<[string, number | undefined, string, ResponseEvidenceRecord["source"], ResponseEvidenceRecord["domain"]]> = [
      ["body-weight", body.weightKg, "kg", "weight", "body-composition"], ["body-fat", body.bodyFatPercent, "%", "measurement", "body-composition"],
      ["waist", body.waistCm, "cm", "measurement", "body-composition"], ["calorie-target", body.calorieTarget, "kcal", "nutrition", "nutrition"],
      ["calorie-actual", body.calorieActual, "kcal", "nutrition", "nutrition"], ["protein-target", body.proteinTarget, "g", "nutrition", "nutrition"],
      ["protein-actual", body.proteinActual, "g", "nutrition", "nutrition"], ["nutrition-adherence", body.adherence, "%", "nutrition", "adherence"],
    ];
    for (const [metric, value, unit, source, domain] of facts) {
      if (value == null) continue;
      output.push({
        id: `evidence:${body.id}:${metric}`, athleteId, observedAt: body.observedAt, calendarDate: body.observedAt.slice(0, 10), source, domain,
        metric, value, unit, context: { source: body.source, nutritionPhase: body.nutritionPhase ?? null }, provenance: {}, quality: "high", limitations: [],
      });
    }
  }
  for (const week of input.weekSummaries ?? []) {
    output.push({
      id: `evidence:week:${week.id}:completion`, athleteId, observedAt: week.createdAt, calendarDate: week.createdAt.slice(0, 10), source: "week", domain: "adherence",
      metric: "week-completion", value: week.completionPercent, unit: "%",
      context: { programId: week.programId, weekNumber: week.weekNumber, unresolvedSessions: week.unresolvedSessionCount },
      provenance: { weekNumber: week.weekNumber }, quality: week.unresolvedSessionCount ? "moderate" : "high", limitations: week.majorDeviations,
    });
  }
  return output;
}

export function buildResponseEvidence(input: ResponseEvidenceInput): ResponseEvidenceBundle {
  const athleteId = input.athleteId ?? input.executionRecords.find((record) => record.athleteId)?.athleteId ?? "local-athlete";
  const activities = input.activities ?? [];
  const normalizedSets = collectNormalizedSets(input.executionRecords);
  const muscleExposure = aggregateMuscleExposure(input.executionRecords, activities);
  const movementExposure = aggregateMovementExposure(input.executionRecords);
  const frequency = aggregateFrequency(input.executionRecords, muscleExposure, movementExposure);
  const performance = aggregateExercisePerformance(input.executionRecords);
  const conditioning = aggregateConditioningEvidence(input.executionRecords, activities);
  const recovery = aggregateRecoveryContext(input.executionRecords, input.sleepLogs ?? [], input.readiness ?? [], conditioning);
  const bodyComposition = aggregateBodyCompositionEvidence(input.bodyComposition ?? [], input.nutrition ?? []);
  const provenance = buildProvenance(input.executionRecords, activities);
  const base = {
    version: RESPONSE_EVIDENCE_VERSION,
    athleteId,
    normalizedSets,
    muscleExposure,
    movementExposure,
    frequency,
    performance,
    conditioning,
    recovery,
    bodyComposition,
    provenance,
    limitations: [
      "Evidence records describe observed facts and missing context; they do not establish causation or coaching recommendations.",
      ...(provenance.excludedEvidence.length ? ["Mutable sessions were excluded until finalized."] : []),
    ],
  };
  const evidence = [...evidenceFromExecution(input), ...aggregateEvidence(base, input)];
  return { ...base, evidence: [...new Map(evidence.map((record) => [record.id, record])).values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

type Comparable = ResponseEvidenceRecord | ExercisePerformanceObservation;

function comparableContext(value: Comparable) {
  if ("comparisonContext" in value) {
    return {
      exerciseId: value.exerciseId,
      variation: value.comparisonContext.variation,
      repTarget: value.comparisonContext.repTarget,
      loadUnit: value.loadUnit,
      unilateral: value.comparisonContext.unilateral,
      phaseId: value.comparisonContext.phaseId,
      sessionRole: value.comparisonContext.sessionRole,
      recoveryContext: value.comparisonContext.recoveryContext,
      conditioningProximityHours: value.comparisonContext.conditioningProximityHours,
      nutritionPhase: value.comparisonContext.nutritionPhase,
      weeklyTrainingContext: value.comparisonContext.weeklyTrainingContext,
      comparisonKey: value.comparisonKey,
    };
  }
  return {
    exerciseId: value.context.exerciseId,
    variation: value.context.variation,
    repTarget: value.context.repTarget,
    loadUnit: value.context.loadUnit ?? value.unit,
    unilateral: value.context.unilateral,
    phaseId: value.context.phaseId,
    sessionRole: value.context.sessionRole,
    recoveryContext: value.context.recoveryContext,
    conditioningProximityHours: value.context.conditioningProximityHours,
    nutritionPhase: value.context.nutritionPhase,
    weeklyTrainingContext: value.context.weeklyTrainingContext,
    comparisonKey: value.comparisonKey,
  };
}

export function compareResponseEvidence(a: Comparable, b: Comparable): EvidenceComparison {
  const left = comparableContext(a);
  const right = comparableContext(b);
  const sharedConditions: string[] = [];
  const meaningfulDifferences: string[] = [];
  const blockingDifferences: string[] = [];
  let score = 100;
  const block = (label: string) => { blockingDifferences.push(label); score -= 55; };
  const differ = (label: string, penalty = 10) => { meaningfulDifferences.push(label); score -= penalty; };
  const share = (label: string) => sharedConditions.push(label);

  if (left.exerciseId && right.exerciseId) {
    if (left.exerciseId === right.exerciseId) share("Same exercise identity"); else block("Exercise identity differs");
  }
  if (left.variation && right.variation) {
    if (left.variation === right.variation) share("Same performed variation"); else block("Performed variation differs");
  }
  if (left.loadUnit && right.loadUnit) {
    if (left.loadUnit === right.loadUnit) share("Same load unit"); else block("Load units differ");
  }
  if (left.repTarget && right.repTarget) {
    if (left.repTarget === right.repTarget) share("Same rep target"); else differ("Rep targets differ", 15);
  }
  if (left.unilateral != null && right.unilateral != null) {
    if (left.unilateral === right.unilateral) share("Same unilateral setup"); else block("Unilateral and bilateral setups differ");
  }
  if (left.phaseId && right.phaseId) {
    if (left.phaseId === right.phaseId) share("Same program phase"); else differ("Program phases differ");
  }
  if (left.sessionRole && right.sessionRole) {
    if (left.sessionRole === right.sessionRole) share("Same session role"); else differ("Session roles differ");
  }
  if (left.nutritionPhase && right.nutritionPhase) {
    if (left.nutritionPhase === right.nutritionPhase) share("Same nutrition phase"); else differ("Nutrition phases differ");
  }
  if (left.recoveryContext && right.recoveryContext) {
    if (left.recoveryContext === right.recoveryContext) share("Same recovery context"); else differ("Recovery context differs");
  }
  if (left.weeklyTrainingContext && right.weeklyTrainingContext) {
    if (left.weeklyTrainingContext === right.weeklyTrainingContext) share("Same weekly training context"); else differ("Weekly training context differs");
  }
  if (typeof left.conditioningProximityHours === "number" && typeof right.conditioningProximityHours === "number") {
    if (Math.abs(left.conditioningProximityHours - right.conditioningProximityHours) <= 12) share("Similar conditioning proximity"); else differ("Conditioning proximity differs");
  }
  const bounded = Math.max(0, Math.min(100, score));
  const comparable = blockingDifferences.length === 0 && bounded >= 70;
  const confidence = blockingDifferences.length ? "insufficient" : sharedConditions.length >= 5 ? "high" : sharedConditions.length >= 3 ? "moderate" : sharedConditions.length ? "low" : "insufficient";
  return { comparable, score: bounded, sharedConditions, meaningfulDifferences, blockingDifferences, confidence };
}

function monday(date: Date): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - (day === 0 ? 6 : day - 1));
  return copy;
}

export function queryEvidenceWindow(
  evidence: ResponseEvidenceRecord[],
  window: EvidenceWindow,
  options: { now: string; comparisonKey?: string; currentPhaseId?: string; previousPhaseId?: string; programId?: string },
): ResponseEvidenceRecord[] {
  const sorted = [...evidence].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (window === "last-session") {
    const session = [...sorted].reverse().find((record) => record.provenance.executionRecordId)?.provenance.executionRecordId;
    return session ? sorted.filter((record) => record.provenance.executionRecordId === session) : [];
  }
  if (window === "last-comparable-exposure") {
    return options.comparisonKey ? sorted.filter((record) => record.comparisonKey === options.comparisonKey).slice(-1) : [];
  }
  if (window === "current-phase" || window === "previous-phase") {
    const phase = window === "current-phase" ? options.currentPhaseId : options.previousPhaseId;
    return phase ? sorted.filter((record) => record.context.phaseId === phase) : [];
  }
  if (window === "entire-training-block") {
    return options.programId ? sorted.filter((record) => record.context.programId === options.programId) : sorted;
  }
  const now = new Date(options.now);
  const start = monday(now);
  const end = new Date(start);
  if (window === "previous-week") {
    start.setUTCDate(start.getUTCDate() - 7);
    end.setUTCDate(end.getUTCDate() - 1);
  } else if (window === "last-four-weeks") {
    start.setUTCDate(start.getUTCDate() - 21);
    end.setUTCDate(end.getUTCDate() + 6);
  } else {
    end.setUTCDate(end.getUTCDate() + 6);
  }
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return sorted.filter((record) => record.calendarDate >= startKey && record.calendarDate <= endKey);
}

export * from "./aggregates";
export * from "./exercise-exposure";
export * from "./normalize";
export * from "./types";
