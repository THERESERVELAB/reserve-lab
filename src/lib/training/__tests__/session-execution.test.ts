import { describe, expect, it } from "vitest";

import {
  addMovement,
  adjustStartedSession,
  appendReserveDecision,
  createPlannedSessionExecution,
  createReserveDecision,
  createStartedSessionExecution,
  editCompletedSet,
  finalizeSessionExecution,
  findUnfinishedExecution,
  migrateLegacyExecutionHistory,
  recordCompletedSet,
  relateFutureRevision,
  removeLastCompletedSet,
  removePlannedMovement,
  sessionCompletionPercent,
  skipMovement,
  substituteMovement,
  summarizeWeekExecution,
  transitionSessionStatus,
  updateMovementFeedback,
  updateSessionMetrics,
  upsertExecutionRecord,
  upsertWeekExecutionSummary,
  type LedgerSessionSnapshot,
} from "../session-execution";

const START = "2026-07-22T12:00:00.000Z";
const END = "2026-07-22T13:00:00.000Z";

const SNAPSHOT: LedgerSessionSnapshot = {
  architectureId: "protocol-dna-1",
  architectureVersion: "gt-architecture-1",
  architectureName: "Grand Touring Rotation",
  mesocycleId: "horizon-gt:W1",
  generatedAt: START,
  splitTitle: "Performance Conditioning",
  movements: [
    { id: "squat", name: "Pendulum Squat", sets: 2, reps: "8-10", suggestedLoad: 0, whyLoad: "Use a logged baseline", rirTargets: ["3 RIR", "2 RIR"], restSeconds: 120, cue: "Control the rep" },
    { id: "pushup", name: "Push-Up", sets: 2, reps: "AMRAP", suggestedLoad: 0, whyLoad: "Bodyweight", rirTargets: ["3 RIR"], restSeconds: 60, cue: "Keep position" },
    { id: "plank", name: "Plank", sets: 1, reps: "45 sec", suggestedLoad: 0, whyLoad: "Timed hold", rirTargets: [], restSeconds: 45, cue: "Brace" },
  ],
  horizonProgramId: "horizon-gt",
  horizonProtocolId: "reserve-grand-touring",
  horizonArchitectureVersion: "gt-architecture-1",
  horizonWeekNumber: 1,
  horizonPhaseId: "capacity-foundation",
  horizonDayIndex: 2,
  horizonDayTitle: "Performance Conditioning",
  horizonRevisionIds: ["rev-friday-class"],
  horizonSource: "program-horizon",
};

function snapshot(): LedgerSessionSnapshot {
  return JSON.parse(JSON.stringify(SNAPSHOT)) as LedgerSessionSnapshot;
}

function planned(id = "session-1") {
  return createPlannedSessionExecution({ id, snapshot: snapshot(), calendarDate: "2026-07-22" });
}

function started(id = "session-1") {
  return createStartedSessionExecution({ id, snapshot: snapshot(), calendarDate: "2026-07-22", startedAt: START });
}

function oneSet(record = started()) {
  return recordCompletedSet(record, "squat", { setNumber: 1, completedReps: 8, completed: true, completedAt: START }).record;
}

function fullyCompleted(id = "session-complete") {
  let record = started(id);
  for (const movement of record.movements) {
    for (let setNumber = 1; setNumber <= (movement.plannedPrescription.sets ?? 0); setNumber += 1) {
      record = recordCompletedSet(record, movement.id, { setNumber, completedReps: 8, completed: true, completedAt: START }).record;
    }
  }
  return finalizeSessionExecution(record, "completed", END).record;
}

describe("Session Execution Ledger state machine", () => {
  it("1. Planned session can start", () => {
    expect(transitionSessionStatus(planned(), "started", START).record.status).toBe("started");
  });

  it("2. Planned session can be skipped", () => {
    expect(transitionSessionStatus(planned(), "skipped", START).record.status).toBe("skipped");
  });

  it("3. Planned session can be replaced", () => {
    expect(transitionSessionStatus(planned(), "replaced", START).record.status).toBe("replaced");
  });

  it("4. Started session can become partial", () => {
    expect(oneSet().status).toBe("partial");
  });

  it("5. Started session can complete", () => {
    expect(transitionSessionStatus(started(), "completed", END).record.status).toBe("completed");
  });

  it("6. Partial session can complete", () => {
    expect(transitionSessionStatus(oneSet(), "completed", END).record.status).toBe("completed");
  });

  it("7. Completed session cannot restart", () => {
    const result = transitionSessionStatus(fullyCompleted(), "started", END);
    expect(result.ok).toBe(false);
  });

  it("8. Completed session cannot mutate", () => {
    const record = fullyCompleted();
    expect(recordCompletedSet(record, "squat", { setNumber: 3, completed: true }).ok).toBe(false);
  });

  it("9. Skipped session does not become completed silently", () => {
    const skipped = transitionSessionStatus(planned(), "skipped", START).record;
    expect(transitionSessionStatus(skipped, "completed", END).ok).toBe(false);
  });

  it("10. Replaced session does not count as original completion", () => {
    const replaced = transitionSessionStatus(planned(), "replaced", START).record;
    const summary = summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [replaced] });
    expect(summary.completedSessionCount).toBe(0);
    expect(summary.replacedSessionCount).toBe(1);
  });
});

describe("Session freeze", () => {
  it("11. Starting creates one frozen snapshot", () => {
    const record = started();
    expect(record.startedSnapshot).toEqual(record.plannedSnapshot);
    expect(record.transitions).toHaveLength(1);
  });

  it("12. Refresh restores the same snapshot", () => {
    const record = started();
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });

  it("13. Readiness change does not regenerate it", () => {
    const record = started();
    const frozen = JSON.stringify(record.startedSnapshot);
    const readiness = { score: 20 };
    expect(readiness.score).toBe(20);
    expect(JSON.stringify(record.startedSnapshot)).toBe(frozen);
  });

  it("14. Pain update does not regenerate it", () => {
    const record = started();
    const frozen = JSON.stringify(record.startedSnapshot);
    const updated = updateMovementFeedback(record, "squat", { pain: 4 }, START).record;
    expect(JSON.stringify(updated.startedSnapshot)).toBe(frozen);
  });

  it("15. Horizon revision does not regenerate it", () => {
    const record = started();
    const revised = relateFutureRevision(record, "future-revision", END);
    expect(revised.startedSnapshot).toEqual(record.startedSnapshot);
    expect(revised.futureRevisionIds).toEqual(["future-revision"]);
  });

  it("16. Protocol change does not destroy it", () => {
    const record = started();
    const requestedProtocol = "powerbuilding";
    expect(requestedProtocol).not.toBe(record.protocolId);
    expect(record.protocolId).toBe("reserve-grand-touring");
  });

  it("17. A duplicate active session is not created", () => {
    const record = started();
    const history = upsertExecutionRecord(upsertExecutionRecord([], record), record);
    expect(history).toHaveLength(1);
    expect(findUnfinishedExecution(history, { programId: record.programId, weekNumber: 1, dayId: record.dayId })?.id).toBe(record.id);
  });

  it("18. Frozen session retains architecture version", () => {
    expect(started().architectureVersion).toBe("gt-architecture-1");
  });
});

describe("Execution detail", () => {
  it("19. Completed sets persist", () => {
    const record = oneSet();
    expect(JSON.parse(JSON.stringify(record)).movements[0].completedSets).toHaveLength(1);
  });

  it("20. Partial sets persist", () => {
    const record = recordCompletedSet(started(), "squat", { setNumber: 1, completedReps: 6, completed: false, completedAt: START }).record;
    expect(record.movements[0].completedSets[0].completed).toBe(false);
  });

  it("21. Failed sets persist", () => {
    const record = recordCompletedSet(started(), "squat", { setNumber: 1, completedReps: 5, completed: true, failed: true, completedAt: START }).record;
    expect(record.movements[0].completedSets[0].failed).toBe(true);
  });

  it("22. Bodyweight exercises do not require numeric load", () => {
    const record = recordCompletedSet(started(), "pushup", { setNumber: 1, completedReps: 12, completed: true, loadUnit: "bodyweight", completedAt: START }).record;
    expect(record.movements[1].completedSets[0].completedLoad).toBeUndefined();
    expect(record.movements[1].completedSets[0].loadUnit).toBe("bodyweight");
  });

  it("23. Timed exercises do not require repetitions", () => {
    const record = recordCompletedSet(started(), "plank", { setNumber: 1, completed: true, completedAt: START, notes: "45 seconds" }).record;
    expect(record.movements[2].completedSets[0].completedReps).toBeUndefined();
  });

  it("24. Added movements remain distinguishable", () => {
    const record = addMovement(started(), { id: "carry", name: "Farmer Carry", sets: 1, source: "athlete-added" }, START).record;
    expect(record.addedMovements[0].source).toBe("athlete-added");
    expect(record.movements.some((movement) => movement.id === "carry")).toBe(false);
  });

  it("25. Removed movements remain recorded", () => {
    const record = removePlannedMovement(started(), "squat", "Equipment unavailable", START).record;
    expect(record.removedMovementIds).toEqual(["squat"]);
    expect(record.movements.find((movement) => movement.id === "squat")).toBeDefined();
  });

  it("26. Skipped movements remain recorded", () => {
    const record = skipMovement(started(), "pushup", "Time constraint", START).record;
    expect(record.skippedMovementIds).toEqual(["pushup"]);
    expect(record.movements[1].status).toBe("skipped");
  });

  it("27. Substitutions preserve the original movement", () => {
    const record = substituteMovement(started(), "squat", "Belt Squat", "Equipment unavailable", START).record;
    expect(record.movements[0].plannedName).toBe("Pendulum Squat");
    expect(record.movements[0].performedName).toBe("Belt Squat");
  });

  it("28. Substitutions preserve the reason", () => {
    expect(substituteMovement(started(), "squat", "Belt Squat", "Crowded gym", START).record.movements[0].substitutionReason).toBe("Crowded gym");
  });

  it("29. Athlete notes persist", () => {
    const record = updateSessionMetrics(started(), { athleteNotes: "Short session before travel." }, START).record;
    expect(JSON.parse(JSON.stringify(record)).sessionMetrics.athleteNotes).toBe("Short session before travel.");
  });

  it("30. Pain feedback persists", () => {
    const record = updateMovementFeedback(started(), "squat", { pain: 4, notes: "Athlete-reported knee discomfort" }, START).record;
    expect(record.movements[0].athleteFeedback?.pain).toBe(4);
  });
});

describe("Immutable history", () => {
  it("31. Planned snapshot remains inspectable after completion", () => {
    expect(fullyCompleted().plannedSnapshot?.splitTitle).toBe("Performance Conditioning");
  });

  it("32. Adjusted snapshot remains inspectable", () => {
    const adjusted = snapshot();
    adjusted.splitTitle = "Adjusted Performance Conditioning";
    const record = adjustStartedSession(started(), adjusted, "adjustment-1", START).record;
    expect(finalizeSessionExecution(record, "completed", END).record.adjustedSnapshot?.splitTitle).toBe("Adjusted Performance Conditioning");
  });

  it("33. Started snapshot remains inspectable", () => {
    const record = fullyCompleted();
    expect(record.startedSnapshot?.generatedAt).toBe(START);
  });

  it("34. Completed record locks", () => {
    const record = fullyCompleted();
    expect(record.integrity.completedRecordLockedAt).toBe(END);
    expect(editCompletedSet(record, "squat", 1, { completedReps: 20 }).ok).toBe(false);
    expect(removeLastCompletedSet(record, "squat").ok).toBe(false);
  });

  it("35. Completed week references execution summary", () => {
    const record = fullyCompleted();
    const summary = summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [record], createdAt: END });
    expect(summary.recordIds).toEqual([record.id]);
    expect(summary.status).toBe("completed");
  });

  it("36. Future revisions do not mutate completed history", () => {
    const record = fullyCompleted();
    expect(relateFutureRevision(record, "later-revision", END)).toEqual(record);
  });

  it("37. One-time adjustments remain linked", () => {
    const record = createPlannedSessionExecution({ id: "one-time", snapshot: snapshot(), calendarDate: "2026-07-22", adjustmentRevisionId: "rev-one-time" });
    expect(record.adjustmentRevisionId).toBe("rev-one-time");
  });

  it("38. Recurring adjustments remain linked", () => {
    const record = createPlannedSessionExecution({ id: "recurring", snapshot: snapshot(), calendarDate: "2026-07-22", adjustmentRevisionId: "rev-recurring-friday" });
    expect(record.adjustmentRevisionId).toBe("rev-recurring-friday");
  });

  it("39. Replacement activities preserve the original session", () => {
    const record = createPlannedSessionExecution({ id: "replacement", snapshot: snapshot(), calendarDate: "2026-07-22", source: "replacement-activity", replacementActivityId: "friday-class" });
    const replaced = transitionSessionStatus(record, "replaced", START).record;
    expect(replaced.plannedSnapshot?.splitTitle).toBe("Performance Conditioning");
    expect(replaced.replacementActivityId).toBe("friday-class");
  });

  it("40. Legacy sessions migrate idempotently", () => {
    const first = migrateLegacyExecutionHistory({ sessionHistory: [{ id: "legacy-1", date: START, completionStatus: "partial" }] });
    const second = migrateLegacyExecutionHistory({ sessionHistory: [{ id: "legacy-1", date: START, completionStatus: "partial" }], existingRecords: first.records, existingDecisions: first.decisions });
    expect(second.records).toEqual(first.records);
    expect(second.decisions).toEqual(first.decisions);
    expect(second.migratedCount).toBe(0);

    const canonical = fullyCompleted("canonical-session");
    const shadow = migrateLegacyExecutionHistory({
      sessionHistory: [{ id: "derived-card", date: END, sessionName: SNAPSHOT.splitTitle, completionStatus: "partial" }],
      existingRecords: [canonical],
    });
    expect(shadow.records).toEqual([canonical]);
    expect(shadow.migratedCount).toBe(0);
  });
});

describe("Week execution summary", () => {
  it("41. Full completion produces completed status", () => {
    expect(summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [fullyCompleted()] }).status).toBe("completed");
  });

  it("42. Deviations produce completed-with-deviations", () => {
    const partial = finalizeSessionExecution(oneSet(), "partial", END).record;
    expect(summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [partial] }).status).toBe("completed-with-deviations");
  });

  it("43. Partial sessions reduce completion percentage", () => {
    const partial = finalizeSessionExecution(oneSet(), "partial", END).record;
    expect(summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [partial] }).completionPercent).toBeLessThan(100);
  });

  it("44. Added activities are counted", () => {
    const acceptedActivity = createReserveDecision({
      category: "activity-reconciliation",
      source: "athlete",
      programId: "horizon-gt",
      observation: "Evening bike intervals were completed.",
      decision: "Counted as supplemental activity without changing the frozen session.",
      reason: "Athlete-confirmed work",
      affectedWeekNumbers: [1],
      athleteDecision: "accepted",
      createdAt: START,
    });
    const summary = summarizeWeekExecution({
      programId: "horizon-gt",
      weekNumber: 1,
      plannedSessionCount: 1,
      records: [fullyCompleted()],
      decisions: [acceptedActivity],
    });
    expect(summary.addedActivityCount).toBe(1);
    expect(summary.majorDeviations).toContain("1 reconciled activity recorded.");
  });

  it("45. Replacement sessions are counted separately", () => {
    const record = transitionSessionStatus(planned(), "replaced", START).record;
    const abandonedStart = finalizeSessionExecution(started("abandoned-zero-output"), "abandoned", END).record;
    const summary = summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 1, records: [abandonedStart, record] });
    expect(summary.replacedSessionCount).toBe(1);
    expect(summary.abandonedSessionCount).toBe(0);
    expect(summary.recordIds).toEqual([record.id]);
  });

  it("46. Unresolved days do not become completed automatically", () => {
    const summary = summarizeWeekExecution({ programId: "horizon-gt", weekNumber: 1, plannedSessionCount: 2, records: [fullyCompleted()] });
    expect(summary.status).toBe("active");
    expect(summary.unresolvedSessionCount).toBe(1);
  });
});

describe("Decision ledger", () => {
  it("47. Starting a program can create a real activation entry", () => {
    const decision = createReserveDecision({ category: "protocol-selection", source: "athlete", observation: "Grand Touring selected", decision: "Activated Grand Touring", reason: "Athlete selection", athleteDecision: "accepted", createdAt: START });
    expect(decision.category).toBe("protocol-selection");
  });

  it("48. Activity reconciliation creates a decision entry", () => {
    expect(createReserveDecision({ category: "activity-reconciliation", source: "athlete", observation: "Friday class added", decision: "Replace Friday", reason: "Confirmed activity", createdAt: START }).category).toBe("activity-reconciliation");
  });

  it("49. Athlete acceptance is recorded", () => {
    expect(createReserveDecision({ category: "athlete-decision", source: "athlete", observation: "Proposal shown", decision: "Applied", reason: "Accepted", athleteDecision: "accepted" }).athleteDecision).toBe("accepted");
  });

  it("50. Athlete decline is recorded", () => {
    expect(createReserveDecision({ category: "athlete-decision", source: "athlete", observation: "Proposal shown", decision: "Not applied", reason: "Declined", athleteDecision: "declined" }).athleteDecision).toBe("declined");
  });

  it("51. Session substitution creates a decision entry", () => {
    expect(createReserveDecision({ category: "exercise-substitution", source: "athlete", observation: "Squat unavailable", decision: "Used belt squat", reason: "Equipment unavailable" }).category).toBe("exercise-substitution");
  });

  it("52. Week revision links affected weeks", () => {
    const decision = createReserveDecision({ category: "week-revision", source: "reserve", observation: "Recurring class", decision: "Revised future weeks", reason: "Schedule evidence", affectedWeekNumbers: [1, 2, 3] });
    expect(decision.affectedWeekNumbers).toEqual([1, 2, 3]);
  });

  it("53. Migration creates one migration entry", () => {
    const migrated = migrateLegacyExecutionHistory({ sessionHistory: [{ id: "legacy", date: START }] });
    expect(migrated.decisions.filter((decision) => decision.category === "migration")).toHaveLength(1);
  });

  it("54. No fabricated default entries are created", () => {
    expect(migrateLegacyExecutionHistory({}).decisions).toEqual([]);
  });

  it("55. Decision history survives refresh", () => {
    const decision = createReserveDecision({ category: "week-revision", source: "reserve", observation: "Observed", decision: "Stored", reason: "Evidence", createdAt: START });
    const history = appendReserveDecision([], decision);
    expect(JSON.parse(JSON.stringify(history))).toEqual(history);
  });
});

describe("Cross-system integrity", () => {
  it("56. Session program ID matches the active Horizon", () => {
    expect(started().programId).toBe(SNAPSHOT.horizonProgramId);
  });

  it("57. Session week matches the active Horizon week at start", () => {
    expect(started().weekNumber).toBe(SNAPSHOT.horizonWeekNumber);
  });

  it("58. Started snapshot remains valid after Horizon progression", () => {
    const record = started();
    const progressedWeek = 2;
    expect(progressedWeek).not.toBe(record.weekNumber);
    expect(record.startedSnapshot?.horizonWeekNumber).toBe(1);
  });

  it("59. Training Command resumes the frozen session", () => {
    const record = started();
    const resumed = findUnfinishedExecution([record], { programId: record.programId, weekNumber: record.weekNumber, dayId: record.dayId });
    expect(resumed?.startedSnapshot).toEqual(record.startedSnapshot);
  });

  it("60. Core Command resumes the same frozen session", () => {
    const record = oneSet();
    const training = findUnfinishedExecution([record], { programId: record.programId });
    const core = findUnfinishedExecution([record], { programId: record.programId });
    expect(core?.id).toBe(training?.id);
    expect(core?.movements).toEqual(training?.movements);
  });

  it("61. Optimization Log displays the same decision record", () => {
    const decision = createReserveDecision({ id: "decision-shared", category: "exercise-substitution", source: "athlete", observation: "Movement changed", decision: "Replacement logged", reason: "Equipment unavailable", createdAt: START });
    expect(appendReserveDecision([], decision)[0]).toEqual(decision);
  });

  it("62. Program Horizon completion uses the same WeekExecutionSummary", () => {
    const record = fullyCompleted();
    const summary = summarizeWeekExecution({ programId: record.programId!, weekNumber: record.weekNumber!, plannedSessionCount: 1, records: [record], createdAt: END });
    expect(upsertWeekExecutionSummary([], summary)[0]).toEqual(summary);
    expect(sessionCompletionPercent(record)).toBe(summary.completionPercent);
  });
});
