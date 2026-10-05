import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import type { SleepLog } from "@/lib/recovery/types";
import type { MovementExecutionRecord, SessionExecutionRecord } from "@/lib/training/session-execution";

import { resolvePerformedExposureProfile, resolvePlannedExposureProfile } from "./exercise-exposure";
import { activityDateTime, normalizeActivity, normalizeCompletedSet } from "./normalize";
import type {
  ConditioningEvidence,
  EvidenceProvenance,
  ExercisePerformanceObservation,
  FrequencyEvidence,
  MovementExposureSummary,
  MovementPattern,
  MuscleExposureSummary,
  NormalizedSetExposure,
  ReadinessEvidenceInput,
  ResponseActivity,
  RecoveryContextEvidence,
} from "./types";

const LOWER_MUSCLES = ["quad", "glute", "hamstring", "calf", "calve", "adductor"];

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function canonicalMuscle(value: string): string {
  return value.trim().replace(/\b\w/g, (character) => character.toUpperCase());
}

function executionTime(record: SessionExecutionRecord): string {
  return record.completedAt ?? record.startedAt ?? `${record.calendarDate}T12:00:00.000Z`;
}

function hoursBetween(a: string, b: string): number | undefined {
  const milliseconds = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Number.isFinite(milliseconds) ? round(milliseconds / 3_600_000, 1) : undefined;
}

export function isFinalizedEvidenceRecord(record: SessionExecutionRecord): boolean {
  return Boolean(record.integrity.completedRecordLockedAt) || ["completed", "skipped", "replaced", "abandoned"].includes(record.status);
}

function allMovements(record: SessionExecutionRecord): MovementExecutionRecord[] {
  return [...record.movements, ...record.addedMovements];
}

export function collectNormalizedSets(records: SessionExecutionRecord[]): NormalizedSetExposure[] {
  const output: NormalizedSetExposure[] = [];
  for (const record of records.filter(isFinalizedEvidenceRecord)) {
    for (const movement of allMovements(record)) {
      const profile = resolvePerformedExposureProfile(record, movement);
      for (const set of movement.completedSets) output.push(normalizeCompletedSet(set, movement, profile));
    }
  }
  return [...new Map(output.map((set) => [set.setId, set])).values()].sort((a, b) => a.setId.localeCompare(b.setId));
}

type MuscleAccumulator = Omit<MuscleExposureSummary, "muscle" | "confidence" | "limitations" | "completedExposureDates" | "exposureDays"> & {
  dates: Set<string>;
  limitations: Set<string>;
  classifiedSets: number;
};

function muscleAccumulator(map: Map<string, MuscleAccumulator>, muscle: string): MuscleAccumulator {
  const key = canonicalMuscle(muscle);
  const existing = map.get(key);
  if (existing) return existing;
  const created: MuscleAccumulator = {
    plannedDirectSets: 0,
    completedDirectSetEquivalents: 0,
    completedIndirectSetEquivalents: 0,
    totalExposureEquivalent: 0,
    highEffortSets: 0,
    nearLimitSets: 0,
    addedExposure: 0,
    substitutedExposure: 0,
    replacementActivityExposure: 0,
    dates: new Set(),
    limitations: new Set(),
    classifiedSets: 0,
  };
  map.set(key, created);
  return created;
}

function activityMuscles(activity: AthleteActivity): string[] {
  const muscles: string[] = [];
  const joined = activity.focusAreas.join(" ").toLowerCase();
  const mappings: Array<[RegExp, string]> = [
    [/quad/, "Quads"], [/glute/, "Glutes"], [/hamstring/, "Hamstrings"], [/calf|calve/, "Calves"],
    [/chest/, "Chest"], [/lat/, "Lats"], [/back/, "Mid-Back"], [/delt|shoulder/, "Delts"],
    [/bicep/, "Biceps"], [/tricep/, "Triceps"], [/core|ab/, "Core"],
  ];
  for (const [pattern, muscle] of mappings) if (pattern.test(joined)) muscles.push(muscle);
  return unique(muscles);
}

export function aggregateMuscleExposure(
  records: SessionExecutionRecord[],
  activities: ResponseActivity[] = [],
): MuscleExposureSummary[] {
  const map = new Map<string, MuscleAccumulator>();
  for (const record of records.filter(isFinalizedEvidenceRecord)) {
    for (const movement of record.movements) {
      const plannedProfile = resolvePlannedExposureProfile(record, movement);
      if (plannedProfile) {
        for (const muscle of plannedProfile.primaryMuscles) {
          muscleAccumulator(map, muscle).plannedDirectSets += movement.plannedPrescription.sets ?? 0;
        }
      }
    }
    for (const movement of allMovements(record)) {
      const profile = resolvePerformedExposureProfile(record, movement);
      if (!profile) continue;
      for (const set of movement.completedSets) {
        const normalized = normalizeCompletedSet(set, movement, profile);
        if (!set.completed || normalized.volumeContribution <= 0) continue;
        const effortHigh = normalized.effortClass === "high" || normalized.effortClass === "near-limit";
        for (const muscle of profile.primaryMuscles) {
          const item = muscleAccumulator(map, muscle);
          item.completedDirectSetEquivalents += profile.directExposureWeight;
          item.totalExposureEquivalent += profile.directExposureWeight;
          item.classifiedSets += 1;
          item.dates.add(record.calendarDate);
          if (effortHigh) item.highEffortSets += 1;
          if (normalized.effortClass === "near-limit") item.nearLimitSets += 1;
          if (movement.source === "athlete-added") item.addedExposure += profile.directExposureWeight;
          if (movement.source === "substitution") item.substitutedExposure += profile.directExposureWeight;
          profile.limitations.forEach((limitation) => item.limitations.add(limitation));
        }
        for (const muscle of profile.secondaryMuscles) {
          const item = muscleAccumulator(map, muscle);
          item.completedIndirectSetEquivalents += profile.indirectExposureWeight;
          item.totalExposureEquivalent += profile.indirectExposureWeight;
          item.classifiedSets += 1;
          item.dates.add(record.calendarDate);
          if (movement.source === "athlete-added") item.addedExposure += profile.indirectExposureWeight;
          if (movement.source === "substitution") item.substitutedExposure += profile.indirectExposureWeight;
        }
      }
    }
  }
  for (const activity of activities) {
    const matchingReplacement = records.find((record) =>
      record.status === "replaced" &&
      record.replacementActivityId === (activity.sourceActivityId ?? activity.id) &&
      (!activity.date || record.calendarDate === activity.date)
    );
    if (!matchingReplacement || !activity.date) continue;
    for (const muscle of activityMuscles(activity)) {
      const item = muscleAccumulator(map, muscle);
      item.replacementActivityExposure += 1;
      item.dates.add(activity.date);
      item.limitations.add("Replacement activity exposure is an athlete-classified event, not a resistance-set equivalent.");
    }
  }
  return [...map.entries()].map(([muscle, item]) => {
    const limitations = [...item.limitations];
    const confidence = item.classifiedSets >= 4 ? "high" : item.classifiedSets >= 2 ? "moderate" : item.classifiedSets >= 1 || item.replacementActivityExposure ? "low" : "insufficient";
    if (!item.classifiedSets && item.plannedDirectSets) limitations.push("Planned work exists, but no classified completed sets contributed exposure.");
    const dates = [...item.dates].sort();
    return {
      muscle,
      plannedDirectSets: round(item.plannedDirectSets),
      completedDirectSetEquivalents: round(item.completedDirectSetEquivalents),
      completedIndirectSetEquivalents: round(item.completedIndirectSetEquivalents),
      totalExposureEquivalent: round(item.totalExposureEquivalent),
      exposureDays: dates.length,
      completedExposureDates: dates,
      highEffortSets: item.highEffortSets,
      nearLimitSets: item.nearLimitSets,
      addedExposure: round(item.addedExposure),
      substitutedExposure: round(item.substitutedExposure),
      replacementActivityExposure: item.replacementActivityExposure,
      confidence,
      limitations,
    } satisfies MuscleExposureSummary;
  }).sort((a, b) => a.muscle.localeCompare(b.muscle));
}

type MovementAccumulator = {
  exposure: number;
  dates: Set<string>;
  high: number;
  near: number;
  movements: Set<string>;
  limitations: Set<string>;
  sets: number;
};

export function aggregateMovementExposure(records: SessionExecutionRecord[]): MovementExposureSummary[] {
  const map = new Map<MovementPattern, MovementAccumulator>();
  for (const record of records.filter(isFinalizedEvidenceRecord)) {
    for (const movement of allMovements(record)) {
      const profile = resolvePerformedExposureProfile(record, movement);
      if (!profile) continue;
      for (const pattern of profile.movementPatterns) {
        const item = map.get(pattern) ?? { exposure: 0, dates: new Set(), high: 0, near: 0, movements: new Set(), limitations: new Set(), sets: 0 };
        for (const set of movement.completedSets) {
          const normalized = normalizeCompletedSet(set, movement, profile);
          if (!set.completed) continue;
          const contribution = profile.resistanceVolumeEligible ? 1 : 0;
          item.exposure += contribution;
          item.sets += 1;
          item.dates.add(record.calendarDate);
          item.movements.add(movement.id);
          if (normalized.effortClass === "high" || normalized.effortClass === "near-limit") item.high += 1;
          if (normalized.effortClass === "near-limit") item.near += 1;
          if (!profile.resistanceVolumeEligible) item.limitations.add("Conditioning exposure is retained as an event and not converted to resistance volume.");
        }
        map.set(pattern, item);
      }
    }
  }
  return [...map.entries()].map(([pattern, item]) => {
    const confidence: MovementExposureSummary["confidence"] = item.sets >= 4 ? "high" : item.sets >= 2 ? "moderate" : item.sets ? "low" : "insufficient";
    return {
      pattern,
      completedExposureEquivalent: round(item.exposure),
      exposureDays: item.dates.size,
      exposureDates: [...item.dates].sort(),
      highEffortSets: item.high,
      nearLimitSets: item.near,
      contributingMovementIds: [...item.movements].sort(),
      confidence,
      limitations: [...item.limitations],
    };
  }).sort((a, b) => a.pattern.localeCompare(b.pattern));
}

function spacing(dates: string[]): number[] {
  return dates.slice(1).map((date, index) => round((new Date(`${date}T12:00:00.000Z`).getTime() - new Date(`${dates[index]}T12:00:00.000Z`).getTime()) / 3_600_000, 1));
}

function frequencyRecord(target: string, category: FrequencyEvidence["category"], plannedDates: string[], completedDates: string[]): FrequencyEvidence {
  const planned = unique(plannedDates).sort();
  const completed = unique(completedDates).sort();
  const gaps = spacing(completed);
  return {
    target,
    category,
    plannedWeeklyFrequency: planned.length,
    completedWeeklyFrequency: completed.length,
    exposureDates: completed,
    spacingHours: gaps,
    averageSpacingHours: gaps.length ? round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length, 1) : undefined,
    minimumSpacingHours: gaps.length ? Math.min(...gaps) : undefined,
    maximumSpacingHours: gaps.length ? Math.max(...gaps) : undefined,
  };
}

export function aggregateFrequency(
  records: SessionExecutionRecord[],
  muscles: MuscleExposureSummary[],
  movements: MovementExposureSummary[],
): FrequencyEvidence[] {
  const output: FrequencyEvidence[] = [];
  for (const summary of muscles) {
    const plannedDates: string[] = [];
    for (const record of records.filter(isFinalizedEvidenceRecord)) {
      if (record.movements.some((movement) => resolvePlannedExposureProfile(record, movement)?.primaryMuscles.some((muscle) => canonicalMuscle(muscle) === summary.muscle))) {
        plannedDates.push(record.calendarDate);
      }
    }
    output.push(frequencyRecord(summary.muscle, "muscle", plannedDates, summary.completedExposureDates));
  }
  for (const summary of movements) {
    const plannedDates = records.filter(isFinalizedEvidenceRecord).flatMap((record) =>
      record.movements.some((movement) => resolvePlannedExposureProfile(record, movement)?.movementPatterns.includes(summary.pattern))
        ? [record.calendarDate]
        : []
    );
    output.push(frequencyRecord(summary.pattern, "movement-pattern", plannedDates, summary.exposureDates));
  }
  const primaryLifts = new Map<string, { planned: string[]; completed: string[] }>();
  for (const record of records.filter(isFinalizedEvidenceRecord)) {
    for (const movement of record.movements) {
      if (snapshotRole(record, movement.id) !== "primary") continue;
      const plannedProfile = resolvePlannedExposureProfile(record, movement);
      if (!plannedProfile) continue;
      const item = primaryLifts.get(plannedProfile.exerciseId) ?? { planned: [], completed: [] };
      item.planned.push(record.calendarDate);
      if (movement.completedSets.some((set) => set.completed)) item.completed.push(record.calendarDate);
      primaryLifts.set(plannedProfile.exerciseId, item);
    }
  }
  for (const [exerciseId, dates] of primaryLifts) output.push(frequencyRecord(exerciseId, "primary-lift", dates.planned, dates.completed));
  return output.sort((a, b) => `${a.category}:${a.target}`.localeCompare(`${b.category}:${b.target}`));
}

function snapshotRole(record: SessionExecutionRecord, movementId: string): string | undefined {
  const raw = (record.startedSnapshot?.movements ?? record.adjustedSnapshot?.movements ?? record.plannedSnapshot?.movements ?? []).find((value) =>
    Boolean(value) && typeof value === "object" && (value as Record<string, unknown>).id === movementId
  );
  return raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).role === "string"
    ? String((raw as Record<string, unknown>).role)
    : undefined;
}

export function aggregateExercisePerformance(records: SessionExecutionRecord[]): ExercisePerformanceObservation[] {
  const observations: ExercisePerformanceObservation[] = [];
  for (const record of records.filter(isFinalizedEvidenceRecord)) {
    for (const movement of allMovements(record)) {
      const completed = movement.completedSets.filter((set) => set.completed);
      if (!completed.length) continue;
      const profile = resolvePerformedExposureProfile(record, movement);
      const loads = completed.map((set) => set.completedLoad).filter((value): value is number => value != null);
      const reps = completed.map((set) => set.completedReps).filter((value): value is number => value != null);
      const rirs = completed.map((set) => set.actualRir).filter((value): value is number => value != null);
      const rpes = completed.map((set) => set.actualRpe).filter((value): value is number => value != null);
      const pains = completed.map((set) => set.pain).filter((value): value is number => value != null);
      const loadUnits = unique(completed.map((set) => set.loadUnit).filter((value): value is NonNullable<typeof value> => value != null));
      const sessionRole = snapshotRole(record, movement.id);
      const variation = movement.performedName.trim().toLowerCase();
      const repTarget = movement.plannedPrescription.reps;
      const comparisonKey = [profile?.exerciseId ?? movement.exerciseId, variation, repTarget ?? "unknown-reps", loadUnits.join("+") || "unknown-unit", profile?.characteristics.unilateral ? "unilateral" : "bilateral", record.phaseId ?? "unknown-phase", sessionRole ?? "unknown-role"].join("|");
      observations.push({
        id: `performance:${record.id}:${movement.id}`,
        executionRecordId: record.id,
        movementRecordId: movement.id,
        exerciseId: profile?.exerciseId ?? movement.exerciseId,
        performedName: movement.performedName,
        performedAt: executionTime(record),
        comparisonKey,
        bestCompletedLoad: loads.length ? Math.max(...loads) : undefined,
        loadUnit: loadUnits.length === 1 ? loadUnits[0] : undefined,
        totalCompletedReps: reps.length === completed.length ? reps.reduce((sum, value) => sum + value, 0) : undefined,
        completedSets: completed.length,
        failedSets: completed.filter((set) => set.failed).length,
        averageActualRir: rirs.length === completed.length ? round(rirs.reduce((sum, value) => sum + value, 0) / rirs.length, 1) : undefined,
        averageActualRpe: rpes.length === completed.length ? round(rpes.reduce((sum, value) => sum + value, 0) / rpes.length, 1) : undefined,
        painMax: pains.length ? Math.max(...pains) : movement.athleteFeedback?.pain,
        stimulusRating: movement.athleteFeedback?.stimulus,
        difficultyRating: movement.athleteFeedback?.difficulty,
        sessionQuality: record.sessionMetrics.sessionQuality,
        comparableToPrevious: false,
        comparabilityLimitations: profile ? [] : ["Exercise exposure identity is unclassified."],
        comparisonContext: {
          variation,
          repTarget,
          unilateral: profile?.characteristics.unilateral,
          phaseId: record.phaseId ?? undefined,
          sessionRole,
        },
      });
    }
  }
  observations.sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  for (let index = 0; index < observations.length; index += 1) {
    const current = observations[index];
    const previous = [...observations.slice(0, index)].reverse().find((candidate) => candidate.exerciseId === current.exerciseId);
    if (!previous) {
      current.comparabilityLimitations.push("No previous observation exists for this exercise.");
      continue;
    }
    current.comparableToPrevious = previous.comparisonKey === current.comparisonKey;
    if (!current.comparableToPrevious) current.comparabilityLimitations.push("Previous exercise observation has a different comparison key.");
  }
  return observations;
}

function lowerSessionTimes(records: SessionExecutionRecord[]): Array<{ id: string; at: string }> {
  return records.filter(isFinalizedEvidenceRecord).flatMap((record) => {
    const lower = allMovements(record).some((movement) => {
      if (!movement.completedSets.some((set) => set.completed)) return false;
      const profile = resolvePerformedExposureProfile(record, movement);
      return Boolean(profile?.primaryMuscles.some((muscle) => LOWER_MUSCLES.some((token) => muscle.toLowerCase().includes(token))) || profile?.movementPatterns.some((pattern) => ["squat", "hinge", "lunge", "knee-flexion", "hip-extension"].includes(pattern)));
    });
    return lower ? [{ id: record.id, at: executionTime(record) }] : [];
  });
}

export function aggregateConditioningEvidence(records: SessionExecutionRecord[], activities: ResponseActivity[]): ConditioningEvidence[] {
  const lower = lowerSessionTimes(records);
  const activityEvidence = activities.map((activity) => {
    const evidence = normalizeActivity(activity);
    const activityAt = activityDateTime(activity);
    if (!activityAt) return evidence;
    const previous = lower.filter((session) => new Date(session.at).getTime() <= activityAt.getTime()).sort((a, b) => b.at.localeCompare(a.at))[0];
    const next = lower.filter((session) => new Date(session.at).getTime() > activityAt.getTime()).sort((a, b) => a.at.localeCompare(b.at))[0];
    return {
      ...evidence,
      proximityToPreviousLowerTrainingHours: previous ? hoursBetween(previous.at, activityAt.toISOString()) : undefined,
      proximityToNextLowerTrainingHours: next ? hoursBetween(activityAt.toISOString(), next.at) : undefined,
    };
  });
  const sessionEvidence = records.filter(isFinalizedEvidenceRecord).flatMap((record) =>
    allMovements(record).flatMap((movement) => {
      const profile = resolvePerformedExposureProfile(record, movement);
      if (!profile?.movementPatterns.some((pattern) => ["aerobic", "sprint", "locomotion", "repeated-effort"].includes(pattern))) return [];
      const completed = movement.completedSets.filter((set) => set.completed).map((set) => normalizeCompletedSet(set, movement, profile));
      if (!completed.length) return [];
      const durationSeconds = completed.map((set) => set.durationSeconds).filter((value): value is number => value != null);
      const distances = completed.map((set) => set.distanceMeters).filter((value): value is number => value != null);
      const high = completed.some((set) => set.effortClass === "high" || set.effortClass === "near-limit");
      const sessionAt = executionTime(record);
      const previous = lower.filter((session) => session.id !== record.id && session.at <= sessionAt).sort((a, b) => b.at.localeCompare(a.at))[0];
      const next = lower.filter((session) => session.id !== record.id && session.at > sessionAt).sort((a, b) => a.at.localeCompare(b.at))[0];
      const limitations: string[] = [];
      if (!durationSeconds.length) limitations.push("Actual conditioning duration was not logged.");
      if (!distances.length) limitations.push("Actual conditioning distance was not logged.");
      return [{
        id: `conditioning:session:${record.id}:${movement.id}`,
        sessionId: record.id,
        date: record.calendarDate,
        modality: movement.performedName,
        durationMinutes: durationSeconds.length ? round(durationSeconds.reduce((sum, value) => sum + value, 0) / 60, 1) : undefined,
        distanceMeters: distances.length ? round(distances.reduce((sum, value) => sum + value, 0), 1) : undefined,
        intensity: high ? "high" : completed.every((set) => set.effortClass === "unknown") ? "unknown" : "moderate",
        impact: profile.characteristics.impact,
        lowerBodyDemand: profile.primaryMuscles.some((muscle) => LOWER_MUSCLES.some((token) => muscle.toLowerCase().includes(token))) ? profile.characteristics.systemicDemand : "low",
        systemicDemand: profile.characteristics.systemicDemand,
        proximityToPreviousLowerTrainingHours: previous ? hoursBetween(previous.at, sessionAt) : undefined,
        proximityToNextLowerTrainingHours: next ? hoursBetween(sessionAt, next.at) : undefined,
        limitations,
      } satisfies ConditioningEvidence];
    })
  );
  return [...activityEvidence, ...sessionEvidence].sort((a, b) => `${a.date}:${a.id}`.localeCompare(`${b.date}:${b.id}`));
}

function sessionMuscles(record: SessionExecutionRecord): string[] {
  return unique(allMovements(record).flatMap((movement) => resolvePerformedExposureProfile(record, movement)?.primaryMuscles ?? []));
}

export function aggregateRecoveryContext(
  records: SessionExecutionRecord[],
  sleepLogs: SleepLog[],
  readiness: ReadinessEvidenceInput[],
  conditioning: ConditioningEvidence[],
): RecoveryContextEvidence[] {
  const finalized = records.filter(isFinalizedEvidenceRecord).sort((a, b) => executionTime(a).localeCompare(executionTime(b)));
  return finalized.filter((record) => record.status !== "skipped" && record.status !== "replaced").map((record, index) => {
    const sleep = sleepLogs.find((entry) => entry.date === record.calendarDate);
    const ready = readiness.find((entry) => entry.date === record.calendarDate);
    const currentMuscles = sessionMuscles(record);
    const previousRelated = [...finalized.slice(0, index)].reverse().find((candidate) => sessionMuscles(candidate).some((muscle) => currentMuscles.includes(muscle)));
    const previousHigh = [...finalized.slice(0, index)].reverse().find((candidate) => candidate.sessionMetrics.sessionRpe != null && candidate.sessionMetrics.sessionRpe >= 8);
    const recentConditioning = conditioning
      .filter((entry) => entry.date <= record.calendarDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const missingFields: string[] = [];
    if (sleep?.hours == null) missingFields.push("sleepHours");
    if (ready?.readinessScore == null) missingFields.push("readinessScore");
    if (ready?.restingHeartRate == null) missingFields.push("restingHeartRate");
    if (ready?.hrv == null) missingFields.push("hrv");
    if (!ready?.painBefore) missingFields.push("painBefore");
    const localDemand = Object.fromEntries(currentMuscles.map((muscle) => [muscle, previousRelated ? 1 : 0]));
    return {
      sessionId: record.id,
      calendarDate: record.calendarDate,
      sleepHours: sleep?.hours,
      readinessScore: ready?.readinessScore,
      restingHeartRate: ready?.restingHeartRate,
      hrv: ready?.hrv,
      painBefore: ready?.painBefore,
      painDuring: record.sessionMetrics.painDuringSession,
      hoursSinceRelatedExposure: previousRelated ? hoursBetween(executionTime(previousRelated), executionTime(record)) : undefined,
      hoursSinceHighDemandSession: previousHigh ? hoursBetween(executionTime(previousHigh), executionTime(record)) : undefined,
      recentConditioningDemand: recentConditioning?.systemicDemand,
      recentLocalDemand: Object.keys(localDemand).length ? localDemand : undefined,
      missingFields,
    };
  });
}

export function buildProvenance(
  records: SessionExecutionRecord[],
  activities: ResponseActivity[],
): EvidenceProvenance {
  const included = records.filter(isFinalizedEvidenceRecord);
  const excluded = records.filter((record) => !isFinalizedEvidenceRecord(record));
  return {
    contributingSessions: included.map((record) => record.id).sort(),
    contributingMovements: unique(included.flatMap((record) => allMovements(record).map((movement) => movement.id))).sort(),
    contributingSets: unique(included.flatMap((record) => allMovements(record).flatMap((movement) => movement.completedSets.map((set) => set.id)))).sort(),
    contributingActivities: activities.map((activity) => activity.id).sort(),
    contributingActivitySources: unique(activities.map((activity) => activity.sourceActivityId ?? activity.id)).sort(),
    contributingActivityRevisions: unique(activities.map((activity) => activity.revisionId).filter((id): id is string => Boolean(id))).sort(),
    includedWeeks: unique(included.map((record) => record.weekNumber).filter((week): week is number => week != null)).sort((a, b) => a - b),
    excludedEvidence: excluded.map((record) => ({ id: record.id, reason: "Session is still mutable and has not reached a finalized ledger state." })),
  };
}
