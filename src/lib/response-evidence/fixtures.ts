import { FRIDAY_LOWER_CLASS } from "@/lib/athlete/fixtures";
import {
  addMovement,
  createPlannedSessionExecution,
  createStartedSessionExecution,
  finalizeSessionExecution,
  recordCompletedSet,
  substituteMovement,
  transitionSessionStatus,
  updateMovementFeedback,
  type LedgerSessionSnapshot,
  type SessionExecutionRecord,
} from "@/lib/training/session-execution";

import { buildResponseEvidence } from "./engine";
import type { ResponseEvidenceBundle, ResponseEvidenceInput } from "./types";

export const EVIDENCE_SCENARIOS = [
  "completed-exposure-week",
  "two-comparable-completed-sessions",
  "complete-and-partial-session",
  "planned-but-skipped-session",
  "exercise-substitution",
  "added-movement",
  "lower-body-class-replacement",
  "conditioning-within-24-hours",
  "conditioning-72-hours-away",
  "one-painful-exposure",
  "three-painful-exposures",
  "fat-loss-declining-performance-facts",
  "stable-weight-improving-performance-facts",
] as const;

export type EvidenceScenario = (typeof EVIDENCE_SCENARIOS)[number];

const MOVEMENTS = {
  squat: {
    id: "hack-squat", name: "Hack Squat", sets: 2, reps: "8-10", suggestedLoad: 180, whyLoad: "Synthetic fixture load",
    rirTargets: ["2 RIR"], restSeconds: 120, cue: "Controlled execution", role: "primary",
    primaryMuscles: ["Quads"], secondaryMuscles: ["Glutes"],
  },
  press: {
    id: "machine-chest-press", name: "Machine Chest Press", sets: 2, reps: "8-10", suggestedLoad: 120, whyLoad: "Synthetic fixture load",
    rirTargets: ["2 RIR"], restSeconds: 90, cue: "Controlled execution", role: "primary",
    primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps", "Front Delts"],
  },
  mobility: {
    id: "fixture-mobility", name: "Hip Mobility Flow", sets: 1, reps: "5 min", suggestedLoad: 0, whyLoad: "Timed mobility",
    rirTargets: [], restSeconds: 0, cue: "Comfortable range", role: "recovery",
    primaryMuscles: [], secondaryMuscles: [],
  },
};

function snapshot(date: string, movements = [MOVEMENTS.squat, MOVEMENTS.press]): LedgerSessionSnapshot {
  return {
    architectureId: "synthetic-evidence-architecture",
    architectureVersion: "synthetic-evidence-1",
    architectureName: "Synthetic Evidence Fixture",
    mesocycleId: "synthetic-program:W1",
    generatedAt: `${date}T12:00:00.000Z`,
    splitTitle: "Synthetic Evidence Session",
    movements,
    horizonProgramId: "synthetic-program",
    horizonProtocolId: "synthetic-protocol",
    horizonArchitectureVersion: "synthetic-evidence-1",
    horizonWeekNumber: 1,
    horizonPhaseId: "synthetic-phase",
    horizonDayIndex: 1,
    horizonDayTitle: "Synthetic Evidence Session",
    horizonRevisionIds: [],
    horizonSource: "program-horizon",
  };
}

function started(id: string, date: string, movements = [MOVEMENTS.squat, MOVEMENTS.press], time = "18:00"): SessionExecutionRecord {
  return createStartedSessionExecution({ id, snapshot: snapshot(date, movements), calendarDate: date, startedAt: `${date}T${time}:00.000Z` });
}

function logSet(
  record: SessionExecutionRecord,
  movementId: string,
  setNumber: number,
  options: { load?: number; reps?: number; unit?: "lb" | "kg" | "bodyweight" | "assisted" | "band"; rir?: number; rpe?: number; pain?: number; duration?: number; distance?: number; failed?: boolean } = {},
): SessionExecutionRecord {
  return recordCompletedSet(record, movementId, {
    setNumber,
    completedLoad: options.load,
    completedReps: options.reps,
    loadUnit: options.unit,
    actualRir: options.rir,
    actualRpe: options.rpe,
    pain: options.pain,
    failed: options.failed,
    completedDurationSeconds: options.duration,
    completedDistanceMeters: options.distance,
    completed: true,
    completedAt: record.startedAt,
  }).record;
}

function completedSession(id: string, date: string, squatLoad = 180, time = "18:00"): SessionExecutionRecord {
  let record = started(id, date, undefined, time);
  record = logSet(record, "hack-squat", 1, { load: squatLoad, reps: 10, unit: "lb", rir: 2, rpe: 8 });
  record = logSet(record, "hack-squat", 2, { load: squatLoad, reps: 9, unit: "lb", rir: 1, rpe: 9 });
  record = logSet(record, "machine-chest-press", 1, { load: 120, reps: 10, unit: "lb", rir: 2, rpe: 8 });
  record = logSet(record, "machine-chest-press", 2, { load: 120, reps: 9, unit: "lb", rir: 1, rpe: 9 });
  const completedAt = new Date(`${date}T${time}:00.000Z`);
  completedAt.setUTCHours(completedAt.getUTCHours() + 1);
  return finalizeSessionExecution(record, "completed", completedAt.toISOString()).record;
}

function baseInput(records: SessionExecutionRecord[]): ResponseEvidenceInput {
  return {
    athleteId: "synthetic-athlete",
    executionRecords: records,
    sleepLogs: records.map((record) => ({ date: record.calendarDate, hours: 7.5 })),
    readiness: records.map((record, index) => ({ id: `ready-${index}`, date: record.calendarDate, readinessScore: 78, restingHeartRate: 58, hrv: 52 })),
  };
}

export function buildEvidenceScenarioInput(kind: EvidenceScenario): ResponseEvidenceInput {
  if (kind === "completed-exposure-week") {
    let substituted = started("week-substitution", "2026-07-22");
    substituted = substituteMovement(substituted, "hack-squat", "Belt Squat", "Synthetic equipment conflict", substituted.startedAt).record;
    substituted = logSet(substituted, "hack-squat", 1, { load: 160, reps: 10, unit: "lb", rir: 2 });
    substituted = finalizeSessionExecution(substituted, "partial", "2026-07-22T18:30:00.000Z").record;

    let added = started("week-added", "2026-07-23");
    added = logSet(added, "hack-squat", 1, { load: 180, reps: 10, unit: "lb", rir: 2 });
    added = addMovement(added, { id: "suitcase-carry", name: "Suitcase Carry", sets: 2, reps: "30 m/side", reason: "Synthetic added work" }, added.startedAt).record;
    added = logSet(added, "suitcase-carry", 1, { distance: 30, unit: "lb", load: 50, rpe: 7 });
    added = finalizeSessionExecution(added, "partial", "2026-07-23T18:40:00.000Z").record;

    const activity = { ...FRIDAY_LOWER_CLASS, id: "week-friday-lower-class", recurrence: "one-time" as const, date: "2026-07-24", relationship: "replace" as const };
    const planned = createPlannedSessionExecution({ id: "week-replaced", snapshot: snapshot("2026-07-24"), calendarDate: "2026-07-24", replacementActivityId: activity.id });
    const replaced = transitionSessionStatus(planned, "replaced", "2026-07-24T05:45:00.000Z", "Synthetic class replacement").record;

    return { ...baseInput([completedSession("week-completed", "2026-07-20"), substituted, added, replaced]), activities: [activity] };
  }
  if (kind === "two-comparable-completed-sessions") return baseInput([completedSession("comparable-1", "2026-07-14"), completedSession("comparable-2", "2026-07-21")]);
  if (kind === "complete-and-partial-session") {
    let partial = started("partial", "2026-07-21");
    partial = logSet(partial, "hack-squat", 1, { load: 180, reps: 8, unit: "lb", rir: 3 });
    partial = finalizeSessionExecution(partial, "partial", "2026-07-21T18:30:00.000Z", { endReason: "Synthetic time constraint" }).record;
    return baseInput([completedSession("complete", "2026-07-14"), partial]);
  }
  if (kind === "planned-but-skipped-session") {
    const planned = createPlannedSessionExecution({ id: "skipped", snapshot: snapshot("2026-07-21"), calendarDate: "2026-07-21" });
    return baseInput([transitionSessionStatus(planned, "skipped", "2026-07-21T18:00:00.000Z", "Synthetic schedule conflict").record]);
  }
  if (kind === "exercise-substitution") {
    let record = started("substitution", "2026-07-21");
    record = substituteMovement(record, "hack-squat", "Belt Squat", "Synthetic equipment conflict", record.startedAt).record;
    record = logSet(record, "hack-squat", 1, { load: 160, reps: 10, unit: "lb", rir: 2 });
    return baseInput([finalizeSessionExecution(record, "partial", "2026-07-21T18:30:00.000Z").record]);
  }
  if (kind === "added-movement") {
    let record = started("added", "2026-07-21");
    record = logSet(record, "hack-squat", 1, { load: 180, reps: 10, unit: "lb", rir: 2 });
    record = addMovement(record, { id: "suitcase-carry", name: "Suitcase Carry", sets: 2, reps: "30 m/side", reason: "Synthetic added work" }, record.startedAt).record;
    record = logSet(record, "suitcase-carry", 1, { distance: 30, unit: "lb", load: 50, rpe: 7 });
    return baseInput([finalizeSessionExecution(record, "partial", "2026-07-21T18:40:00.000Z").record]);
  }
  if (kind === "lower-body-class-replacement") {
    const activity = { ...FRIDAY_LOWER_CLASS, recurrence: "one-time" as const, date: "2026-07-24", relationship: "replace" as const };
    const planned = createPlannedSessionExecution({ id: "replaced", snapshot: snapshot("2026-07-24"), calendarDate: "2026-07-24", replacementActivityId: activity.id });
    return { ...baseInput([transitionSessionStatus(planned, "replaced", "2026-07-24T05:45:00.000Z", "Synthetic class replacement").record]), activities: [activity] };
  }
  if (kind === "conditioning-within-24-hours" || kind === "conditioning-72-hours-away") {
    const lowerDate = kind === "conditioning-within-24-hours" ? "2026-07-23" : "2026-07-21";
    const lowerTime = kind === "conditioning-within-24-hours" ? "18:00" : "04:45";
    const activity = { ...FRIDAY_LOWER_CLASS, id: `activity-${kind}`, recurrence: "one-time" as const, date: "2026-07-24", relationship: "supplement" as const };
    return { ...baseInput([completedSession(`lower-${kind}`, lowerDate, 180, lowerTime)]), activities: [activity] };
  }
  if (kind === "one-painful-exposure" || kind === "three-painful-exposures") {
    const count = kind === "one-painful-exposure" ? 1 : 3;
    const records = Array.from({ length: count }, (_, index) => {
      const date = `2026-07-${String(15 + index * 3).padStart(2, "0")}`;
      let record = started(`pain-${index}`, date);
      record = logSet(record, "hack-squat", 1, { load: 160, reps: 8, unit: "lb", pain: 4, rir: 3 });
      record = updateMovementFeedback(record, "hack-squat", { pain: 4, notes: "Synthetic athlete-reported pain" }, record.startedAt).record;
      record.sessionMetrics.painDuringSession = [{ region: "knee", severity: 4, note: "Synthetic report" }];
      return finalizeSessionExecution(record, "partial", `${date}T18:30:00.000Z`).record;
    });
    const input = baseInput(records);
    input.readiness = records.map((record, index) => ({ id: `pain-ready-${index}`, date: record.calendarDate, painBefore: [{ region: "knee", severity: 2 }], readinessScore: 70 }));
    return input;
  }
  if (kind === "fat-loss-declining-performance-facts") {
    return {
      ...baseInput([completedSession("cut-1", "2026-07-07", 190), completedSession("cut-2", "2026-07-21", 170)]),
      bodyComposition: [
        { id: "cut-body-1", observedAt: "2026-07-07T08:00:00.000Z", bodyWeightLb: 190, waistInches: 34, source: "synthetic-fixture" },
        { id: "cut-body-2", observedAt: "2026-07-21T08:00:00.000Z", bodyWeightLb: 187, waistInches: 33.5, source: "synthetic-fixture" },
      ],
      nutrition: [{ id: "cut-nutrition", observedAt: "2026-07-21T20:00:00.000Z", nutritionPhase: "fat-loss", calorieTarget: 2400, calorieActual: 2320, proteinTarget: 190, proteinActual: 182, adherence: 91, source: "synthetic-fixture" }],
    };
  }
  return {
    ...baseInput([completedSession("stable-1", "2026-07-07", 170), completedSession("stable-2", "2026-07-21", 190)]),
    bodyComposition: [
      { id: "stable-body-1", observedAt: "2026-07-07T08:00:00.000Z", bodyWeightLb: 185, source: "synthetic-fixture" },
      { id: "stable-body-2", observedAt: "2026-07-21T08:00:00.000Z", bodyWeightLb: 185.1, source: "synthetic-fixture" },
    ],
    nutrition: [{ id: "stable-nutrition", observedAt: "2026-07-21T20:00:00.000Z", nutritionPhase: "maintenance", calorieTarget: 2900, calorieActual: 2880, proteinTarget: 185, proteinActual: 186, adherence: 96, source: "synthetic-fixture" }],
  };
}

export function buildEvidenceScenario(kind: EvidenceScenario): ResponseEvidenceBundle {
  return buildResponseEvidence(buildEvidenceScenarioInput(kind));
}
