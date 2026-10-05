import { describe, expect, it } from "vitest";

import {
  createStartedSessionExecution,
  finalizeSessionExecution,
  recordCompletedSet,
  type CompletedSetRecord,
  type LedgerSessionSnapshot,
  type MovementExecutionRecord,
} from "@/lib/training/session-execution";
import {
  EVIDENCE_SCENARIOS,
  aggregateConditioningEvidence,
  aggregateExercisePerformance,
  buildEvidenceScenario,
  buildEvidenceScenarioInput,
  buildResponseEvidence,
  compareResponseEvidence,
  findExerciseExposureProfile,
  inchesToCentimeters,
  normalizeActivity,
  normalizeBodyComposition,
  normalizeCompletedSet,
  poundsToKilograms,
  queryEvidenceWindow,
  resolvePerformedExposureProfile,
  type ExerciseExposureProfile,
  type ExercisePerformanceObservation,
  type ResponseEvidenceRecord,
} from "../index";

const DATE = "2026-07-20";

const SNAPSHOT: LedgerSessionSnapshot = {
  architectureId: "test-architecture",
  architectureVersion: "test-1",
  architectureName: "Evidence Tests",
  mesocycleId: "test-program:W1",
  generatedAt: `${DATE}T12:00:00.000Z`,
  splitTitle: "Evidence Session",
  movements: [
    { id: "hack-squat", name: "Hack Squat", sets: 2, reps: "8-10", role: "primary", primaryMuscles: ["Quads"], secondaryMuscles: ["Glutes"] },
    { id: "machine-chest-press", name: "Machine Chest Press", sets: 2, reps: "8-10", role: "primary", primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps"] },
  ],
  horizonProgramId: "test-program",
  horizonProtocolId: "test-protocol",
  horizonArchitectureVersion: "test-1",
  horizonWeekNumber: 1,
  horizonPhaseId: "phase-1",
  horizonDayIndex: 0,
  horizonDayTitle: "Evidence Session",
};

function started(id = "test-session", date = DATE, time = "18:00") {
  return createStartedSessionExecution({ id, snapshot: { ...SNAPSHOT, generatedAt: `${date}T12:00:00.000Z` }, calendarDate: date, startedAt: `${date}T${time}:00.000Z` });
}

function finalizedOneSet(id = "test-session", date = DATE, options: { load?: number; unit?: "lb" | "kg" | "bodyweight" | "assisted" | "band"; reps?: number; rir?: number; rpe?: number; completed?: boolean; failed?: boolean; pain?: number } = {}) {
  let record = started(id, date);
  record = recordCompletedSet(record, "hack-squat", {
    setNumber: 1,
    completedLoad: options.load,
    loadUnit: options.unit,
    completedReps: options.reps ?? 8,
    actualRir: options.rir,
    actualRpe: options.rpe,
    completed: options.completed ?? true,
    failed: options.failed,
    pain: options.pain,
    completedAt: `${date}T18:10:00.000Z`,
  }).record;
  return finalizeSessionExecution(record, "partial", `${date}T18:20:00.000Z`).record;
}

const MOVEMENT: MovementExecutionRecord = {
  id: "hack-squat", exerciseId: "hack-squat", plannedName: "Hack Squat", performedName: "Hack Squat", source: "planned", order: 0,
  plannedPrescription: { sets: 2, reps: "8-10" }, completedSets: [], status: "partial",
};

const SET: CompletedSetRecord = {
  id: "set-1", setNumber: 1, completedReps: 8, completedLoad: 180, loadUnit: "lb", actualRir: 2, actualRpe: 8, completed: true,
};

const PROFILE = findExerciseExposureProfile("hack-squat", "Hack Squat")!;

function performance(overrides: Partial<ExercisePerformanceObservation> = {}): ExercisePerformanceObservation {
  return {
    id: "performance-a", executionRecordId: "session-a", movementRecordId: "movement-a", exerciseId: "hack-squat", performedName: "Hack Squat",
    performedAt: "2026-07-20T18:00:00.000Z", comparisonKey: "hack-squat|hack squat|8-10|lb|bilateral|phase-1|primary",
    bestCompletedLoad: 180, loadUnit: "lb", totalCompletedReps: 18, completedSets: 2, failedSets: 0,
    comparableToPrevious: false, comparabilityLimitations: [],
    comparisonContext: { variation: "hack squat", repTarget: "8-10", unilateral: false, phaseId: "phase-1", sessionRole: "primary" },
    ...overrides,
  };
}

describe("Completed set normalization", () => {
  it("1. Completed sets generate canonical evidence", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).evidence.some((item) => item.metric === "completed-set-exposure")).toBe(true);
  });

  it("2. Planned incomplete work does not count", () => {
    expect(normalizeCompletedSet({ ...SET, completed: false }, MOVEMENT, PROFILE).volumeContribution).toBe(0);
  });

  it("3. Partial work contributes only completed sets", () => {
    const bundle = buildResponseEvidence(buildEvidenceScenarioInput("complete-and-partial-session"));
    expect(bundle.normalizedSets.filter((set) => set.completed)).toHaveLength(5);
  });

  it("4. Skipped sessions create zero completed exposure", () => {
    expect(buildEvidenceScenario("planned-but-skipped-session").normalizedSets).toHaveLength(0);
  });

  it("5. Replacement activities do not count the original planned workout", () => {
    const bundle = buildEvidenceScenario("lower-body-class-replacement");
    expect(bundle.normalizedSets).toHaveLength(0);
    expect(bundle.muscleExposure.find((item) => item.muscle === "Quads")?.completedDirectSetEquivalents ?? 0).toBe(0);
  });

  it("6. Substitutions use performed exercise exposure", () => {
    const input = buildEvidenceScenarioInput("exercise-substitution");
    const movement = input.executionRecords[0].movements[0];
    expect(resolvePerformedExposureProfile(input.executionRecords[0], movement)?.exerciseId).toBe("belt-squat");
  });

  it("7. Added movements remain separate", () => {
    const input = buildEvidenceScenarioInput("added-movement");
    expect(input.executionRecords[0].addedMovements[0].source).toBe("athlete-added");
    expect(buildResponseEvidence(input).muscleExposure.some((item) => item.addedExposure > 0)).toBe(true);
  });

  it("8. Primary muscles receive direct exposure", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).muscleExposure.find((item) => item.muscle === "Quads")?.completedDirectSetEquivalents).toBe(1);
  });

  it("9. Secondary muscles receive indirect exposure", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).muscleExposure.find((item) => item.muscle === "Glutes")?.completedIndirectSetEquivalents).toBe(0.5);
  });

  it("10. Frequency counts exposure dates rather than sets", () => {
    const frequency = buildEvidenceScenario("two-comparable-completed-sessions").frequency.find((item) => item.category === "muscle" && item.target === "Quads");
    expect(frequency?.completedWeeklyFrequency).toBe(2);
  });

  it("11. Unknown exercises remain unclassified", () => {
    expect(findExerciseExposureProfile("unknown", "Never Classified Movement")).toBeNull();
  });

  it("12. Mobility does not count as resistance volume", () => {
    const mobilityProfile: ExerciseExposureProfile = { ...PROFILE, exerciseId: "mobility", movementPatterns: ["mobility"], resistanceVolumeEligible: false };
    expect(normalizeCompletedSet({ ...SET, completedDurationSeconds: 300, completedReps: undefined, completedLoad: undefined, loadUnit: undefined }, MOVEMENT, mobilityProfile).volumeContribution).toBe(0);
  });

  it("13. Conditioning does not become hypertrophy volume", () => {
    expect(buildEvidenceScenario("conditioning-within-24-hours").muscleExposure.reduce((sum, item) => sum + item.totalExposureEquivalent, 0)).toBeGreaterThan(0);
    expect(buildEvidenceScenario("lower-body-class-replacement").muscleExposure.reduce((sum, item) => sum + item.totalExposureEquivalent, 0)).toBe(0);
  });

  it("14. Bodyweight work does not require numeric load", () => {
    const normalized = normalizeCompletedSet({ ...SET, completedLoad: undefined, loadUnit: "bodyweight" }, MOVEMENT, PROFILE);
    expect(normalized.modality).toBe("bodyweight-reps");
    expect(normalized.load).toBeUndefined();
  });

  it("15. Timed work does not require repetitions", () => {
    const normalized = normalizeCompletedSet({ ...SET, completedReps: undefined, completedLoad: undefined, loadUnit: undefined, completedDurationSeconds: 45 }, MOVEMENT, PROFILE);
    expect(normalized.modality).toBe("timed");
    expect(normalized.reps).toBeUndefined();
  });

  it("16. Distance carries preserve actual meters", () => {
    const carry = findExerciseExposureProfile("suitcase-carry", "Suitcase Carry")!;
    const normalized = normalizeCompletedSet({ ...SET, completedReps: undefined, completedDistanceMeters: 30 }, { ...MOVEMENT, performedName: "Suitcase Carry" }, carry);
    expect(normalized.modality).toBe("carry");
    expect(normalized.distanceMeters).toBe(30);
  });

  it("17. Assisted repetitions remain distinguishable", () => {
    expect(normalizeCompletedSet({ ...SET, loadUnit: "assisted" }, MOVEMENT, PROFILE).modality).toBe("assisted-reps");
  });

  it("18. Band work remains distinguishable by load unit", () => {
    const normalized = normalizeCompletedSet({ ...SET, completedLoad: undefined, loadUnit: "band" }, MOVEMENT, PROFILE);
    expect(normalized.modality).toBe("loaded-reps");
    expect(normalized.loadUnit).toBe("band");
  });

  it("19. Missing RIR remains missing", () => {
    const normalized = normalizeCompletedSet({ ...SET, actualRir: undefined }, MOVEMENT, PROFILE);
    expect(normalized.actualRir).toBeUndefined();
    expect(normalized.limitations).toContain("Actual RIR was not logged.");
  });

  it("20. Missing load remains missing", () => {
    expect(normalizeCompletedSet({ ...SET, completedLoad: undefined, loadUnit: undefined }, MOVEMENT, PROFILE).load).toBeUndefined();
  });

  it("21. Failed sets remain recorded", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet("failed", DATE, { load: 180, unit: "lb", failed: true })] }).performance[0].failedSets).toBe(1);
  });

  it("22. Near-limit effort is classified from actual RIR", () => {
    expect(normalizeCompletedSet({ ...SET, actualRir: 0 }, MOVEMENT, PROFILE).effortClass).toBe("near-limit");
  });
});

describe("Exposure and frequency aggregation", () => {
  it("23. Planned direct sets remain inspectable", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).muscleExposure.find((item) => item.muscle === "Quads")?.plannedDirectSets).toBe(2);
  });

  it("24. Direct coefficient is one set equivalent", () => {
    expect(PROFILE.directExposureWeight).toBe(1);
  });

  it("25. Indirect coefficient remains separate", () => {
    expect(PROFILE.indirectExposureWeight).toBe(0.5);
  });

  it("26. A skipped session retains planned exposure without completed exposure", () => {
    const quads = buildEvidenceScenario("planned-but-skipped-session").muscleExposure.find((item) => item.muscle === "Quads");
    expect(quads?.plannedDirectSets).toBe(2);
    expect(quads?.totalExposureEquivalent).toBe(0);
  });

  it("27. Partial sessions contribute the exact completed subset", () => {
    const quads = buildEvidenceScenario("complete-and-partial-session").muscleExposure.find((item) => item.muscle === "Quads");
    expect(quads?.completedDirectSetEquivalents).toBe(3);
  });

  it("28. Replacement activities remain visible as classified events", () => {
    expect(buildEvidenceScenario("lower-body-class-replacement").muscleExposure.find((item) => item.muscle === "Quads")?.replacementActivityExposure).toBe(1);
  });

  it("29. Replacement events are not added to set equivalents", () => {
    const quads = buildEvidenceScenario("lower-body-class-replacement").muscleExposure.find((item) => item.muscle === "Quads");
    expect(quads?.totalExposureEquivalent).toBe(0);
  });

  it("30. Several sets on one date create one exposure day", () => {
    const quads = buildEvidenceScenario("two-comparable-completed-sessions").muscleExposure.find((item) => item.muscle === "Quads");
    expect(quads?.completedDirectSetEquivalents).toBe(4);
    expect(quads?.exposureDays).toBe(2);
  });

  it("31. Frequency reports spacing between exposure dates", () => {
    expect(buildEvidenceScenario("two-comparable-completed-sessions").frequency.find((item) => item.target === "Quads")?.spacingHours).toEqual([168]);
  });

  it("32. High-effort sets are counted", () => {
    expect(buildEvidenceScenario("two-comparable-completed-sessions").muscleExposure.find((item) => item.muscle === "Quads")?.highEffortSets).toBe(4);
  });

  it("33. Near-limit sets remain distinct from high effort", () => {
    const bundle = buildResponseEvidence({ executionRecords: [finalizedOneSet("near", DATE, { load: 180, unit: "lb", rir: 0 })] });
    expect(bundle.muscleExposure.find((item) => item.muscle === "Quads")?.nearLimitSets).toBe(1);
  });

  it("34. Movement-pattern exposure retains contributing movement IDs", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).movementExposure.find((item) => item.pattern === "squat")?.contributingMovementIds).toContain("hack-squat");
  });
});

describe("Exercise performance and comparability", () => {
  it("35. Performance observations retain load, repetitions, and set count", () => {
    const observation = buildEvidenceScenario("two-comparable-completed-sessions").performance.find((item) => item.exerciseId === "hack-squat")!;
    expect([observation.bestCompletedLoad, observation.totalCompletedReps, observation.completedSets]).toEqual([180, 19, 2]);
  });

  it("36. Comparable observations score highly", () => {
    const comparison = compareResponseEvidence(performance(), performance({ id: "performance-b", performedAt: "2026-07-27T18:00:00.000Z" }));
    expect(comparison.comparable).toBe(true);
    expect(comparison.score).toBe(100);
  });

  it("37. Unlike movements do not compare directly", () => {
    expect(compareResponseEvidence(performance(), performance({ exerciseId: "rdl", performedName: "Romanian Deadlift", comparisonContext: { ...performance().comparisonContext, variation: "romanian deadlift" } })).comparable).toBe(false);
  });

  it("38. Different units block direct load comparison", () => {
    expect(compareResponseEvidence(performance(), performance({ loadUnit: "kg" })).blockingDifferences).toContain("Load units differ");
  });

  it("39. Different rep targets reduce comparability score", () => {
    const comparison = compareResponseEvidence(performance(), performance({ comparisonContext: { ...performance().comparisonContext, repTarget: "12-15" } }));
    expect(comparison.meaningfulDifferences).toContain("Rep targets differ");
    expect(comparison.score).toBeLessThan(100);
  });

  it("40. Different performed variations block comparison", () => {
    expect(compareResponseEvidence(performance(), performance({ comparisonContext: { ...performance().comparisonContext, variation: "belt squat" } })).blockingDifferences).toContain("Performed variation differs");
  });

  it("41. Unilateral and bilateral setup differences block comparison", () => {
    expect(compareResponseEvidence(performance(), performance({ comparisonContext: { ...performance().comparisonContext, unilateral: true } })).blockingDifferences).toContain("Unilateral and bilateral setups differ");
  });

  it("42. Program phase differences remain visible", () => {
    expect(compareResponseEvidence(performance(), performance({ comparisonContext: { ...performance().comparisonContext, phaseId: "phase-2" } })).meaningfulDifferences).toContain("Program phases differ");
  });

  it("43. Session-role differences remain visible", () => {
    expect(compareResponseEvidence(performance(), performance({ comparisonContext: { ...performance().comparisonContext, sessionRole: "secondary" } })).meaningfulDifferences).toContain("Session roles differ");
  });

  it("44. Nutrition-phase differences remain visible", () => {
    const a = performance({ comparisonContext: { ...performance().comparisonContext, nutritionPhase: "maintenance" } });
    const b = performance({ comparisonContext: { ...performance().comparisonContext, nutritionPhase: "fat-loss" } });
    expect(compareResponseEvidence(a, b).meaningfulDifferences).toContain("Nutrition phases differ");
  });

  it("45. A first observation states that no prior comparison exists", () => {
    expect(aggregateExercisePerformance([finalizedOneSet()])[0].comparabilityLimitations).toContain("No previous observation exists for this exercise.");
  });

  it("46. Failed set counts remain factual", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet("failed-2", DATE, { failed: true })] }).performance[0].failedSets).toBe(1);
  });

  it("47. Pain maximum remains attached to the performance observation", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet("pain", DATE, { pain: 5 })] }).performance[0].painMax).toBe(5);
  });
});

describe("Conditioning and recovery facts", () => {
  it("48. Conditioning within 24 hours reports its actual proximity", () => {
    expect(buildEvidenceScenario("conditioning-within-24-hours").conditioning[0].proximityToPreviousLowerTrainingHours).toBeLessThan(24);
  });

  it("49. Conditioning 72 hours away remains a timing fact", () => {
    expect(buildEvidenceScenario("conditioning-72-hours-away").conditioning[0].proximityToPreviousLowerTrainingHours).toBe(72);
  });

  it("50. Conditioning proximity handles week wrap-around using calendar timestamps", () => {
    const lower = finalizedOneSet("sunday-lower", "2026-07-19", { load: 180, unit: "lb" });
    const activity = { id: "monday-run", title: "Monday Run", source: "athlete-added" as const, recurrence: "one-time" as const, date: "2026-07-20", dayOfWeek: 0, startTime: "06:00", durationMinutes: 30, location: "outdoor" as const, activityType: "running" as const, focusAreas: ["running"], intensity: "moderate" as const, relationship: "supplement" as const };
    const evidence = aggregateConditioningEvidence([lower], [activity])[0];
    expect(evidence.proximityToPreviousLowerTrainingHours).toBeLessThan(24);
  });

  it("51. Activity without a concrete date exposes a limitation", () => {
    const activity = buildEvidenceScenarioInput("lower-body-class-replacement").activities![0];
    expect(normalizeActivity({ ...activity, date: undefined }).limitations.some((item) => item.includes("no concrete calendar date"))).toBe(true);
  });

  it("52. Lower-body and systemic demand remain separate", () => {
    const evidence = buildEvidenceScenario("conditioning-within-24-hours").conditioning[0];
    expect(evidence.lowerBodyDemand).toBeDefined();
    expect(evidence.systemicDemand).toBeDefined();
  });

  it("53. Conditioning evidence does not claim interference", () => {
    expect(JSON.stringify(buildEvidenceScenario("conditioning-within-24-hours").conditioning).toLowerCase()).not.toContain("interference occurred");
  });

  it("54. Missing sleep remains missing", () => {
    const record = finalizedOneSet();
    const recovery = buildResponseEvidence({ executionRecords: [record] }).recovery[0];
    expect(recovery.sleepHours).toBeUndefined();
    expect(recovery.missingFields).toContain("sleepHours");
  });

  it("55. Missing readiness remains missing", () => {
    expect(buildResponseEvidence({ executionRecords: [finalizedOneSet()] }).recovery[0].missingFields).toContain("readinessScore");
  });

  it("56. Pain before and pain during remain distinct", () => {
    const bundle = buildEvidenceScenario("one-painful-exposure");
    expect(bundle.recovery[0].painBefore?.[0].severity).toBe(2);
    expect(bundle.recovery[0].painDuring?.[0].severity).toBe(4);
  });

  it("57. Available sleep and readiness fields are retained", () => {
    const recovery = buildEvidenceScenario("two-comparable-completed-sessions").recovery[0];
    expect([recovery.sleepHours, recovery.readinessScore, recovery.restingHeartRate, recovery.hrv]).toEqual([7.5, 78, 58, 52]);
  });

  it("58. Related exposure spacing is calculated", () => {
    expect(buildEvidenceScenario("two-comparable-completed-sessions").recovery[1].hoursSinceRelatedExposure).toBe(168);
  });

  it("59. Mutable active sessions are excluded with a provenance reason", () => {
    const bundle = buildResponseEvidence({ executionRecords: [started("active")] });
    expect(bundle.normalizedSets).toHaveLength(0);
    expect(bundle.provenance.excludedEvidence[0].id).toBe("active");
  });
});

describe("Body composition, windows, provenance, and determinism", () => {
  it("60. Pounds normalize to kilograms", () => {
    expect(poundsToKilograms(220)).toBeCloseTo(99.79, 2);
  });

  it("61. Waist inches normalize to centimeters", () => {
    expect(inchesToCentimeters(34)).toBe(86.36);
  });

  it("62. Stable weight creates no coaching conclusion", () => {
    const text = JSON.stringify(buildEvidenceScenario("stable-weight-improving-performance-facts").bodyComposition).toLowerCase();
    expect(text).not.toContain("muscle gained");
    expect(text).not.toContain("recomposition occurred");
  });

  it("63. Nutrition targets and actuals remain factual fields", () => {
    const body = buildEvidenceScenario("fat-loss-declining-performance-facts").bodyComposition.at(-1)!;
    expect([body.calorieTarget, body.calorieActual, body.proteinTarget, body.proteinActual]).toEqual([2400, 2320, 190, 182]);
  });

  it("64. Current-week evidence queries use deterministic Monday boundaries", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    expect(queryEvidenceWindow(evidence, "current-week", { now: "2026-07-22T12:00:00.000Z" }).every((item) => item.calendarDate >= "2026-07-20")).toBe(true);
  });

  it("65. Previous-week queries exclude current-week records", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    const previous = queryEvidenceWindow(evidence, "previous-week", { now: "2026-07-22T12:00:00.000Z" });
    expect(previous.some((item) => item.calendarDate === "2026-07-14")).toBe(true);
    expect(previous.some((item) => item.calendarDate === "2026-07-21")).toBe(false);
  });

  it("66. Last-four-weeks queries retain recent records", () => {
    expect(queryEvidenceWindow(buildEvidenceScenario("two-comparable-completed-sessions").evidence, "last-four-weeks", { now: "2026-07-22T12:00:00.000Z" }).length).toBeGreaterThan(0);
  });

  it("67. Phase windows use canonical phase context", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    expect(queryEvidenceWindow(evidence, "current-phase", { now: "2026-07-22T12:00:00.000Z", currentPhaseId: "synthetic-phase" }).length).toBeGreaterThan(0);
  });

  it("68. Provenance exposes contributing sessions, movements, sets, activities, and weeks", () => {
    const provenance = buildEvidenceScenario("conditioning-within-24-hours").provenance;
    expect(provenance.contributingSessions.length).toBeGreaterThan(0);
    expect(provenance.contributingMovements.length).toBeGreaterThan(0);
    expect(provenance.contributingSets.length).toBeGreaterThan(0);
    expect(provenance.contributingActivities.length).toBeGreaterThan(0);
    expect(provenance.includedWeeks).toEqual([1]);
  });

  it("69. Rebuilding from the same canonical inputs is idempotent", () => {
    const input = buildEvidenceScenarioInput("added-movement");
    expect(buildResponseEvidence(input)).toEqual(buildResponseEvidence(input));
  });

  it("70. Evidence identifiers are deterministic and unique", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    expect(new Set(evidence.map((item) => item.id)).size).toBe(evidence.length);
  });

  it("71. Last-session queries return one canonical execution identity", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    const last = queryEvidenceWindow(evidence, "last-session", { now: "2026-07-22T12:00:00.000Z" });
    expect(new Set(last.map((item) => item.provenance.executionRecordId).filter(Boolean)).size).toBe(1);
  });

  it("72. Last-comparable queries require an explicit comparison key", () => {
    const evidence = buildEvidenceScenario("two-comparable-completed-sessions").evidence;
    expect(queryEvidenceWindow(evidence, "last-comparable-exposure", { now: "2026-07-22T12:00:00.000Z" })).toEqual([]);
  });

  it("73. Canonical source changes rebuild evidence rather than reading a stale cache", () => {
    const input = buildEvidenceScenarioInput("two-comparable-completed-sessions");
    const before = buildResponseEvidence(input).normalizedSets.length;
    input.executionRecords = [input.executionRecords[0]];
    expect(buildResponseEvidence(input).normalizedSets.length).toBeLessThan(before);
  });

  it("74. All development scenarios use the synthetic athlete identity", () => {
    expect(EVIDENCE_SCENARIOS.every((scenario) => buildEvidenceScenario(scenario).athleteId === "synthetic-athlete")).toBe(true);
  });

  it("75. Body-composition normalization does not invent absent values", () => {
    const body = normalizeBodyComposition([{ id: "empty-body", observedAt: "2026-07-20T08:00:00.000Z", source: "test" }], [])[0];
    expect(body.weightKg).toBeUndefined();
    expect(body.bodyFatPercent).toBeUndefined();
    expect(body.waistCm).toBeUndefined();
  });

  it("76. Generic response records compare using their evidence context", () => {
    const base: ResponseEvidenceRecord = {
      id: "evidence-a", athleteId: "athlete", observedAt: "2026-07-20T12:00:00.000Z", calendarDate: "2026-07-20", source: "set", domain: "performance", metric: "completed-load", value: 180, unit: "lb",
      context: { exerciseId: "hack-squat", variation: "hack squat", repTarget: "8-10", loadUnit: "lb" }, comparisonKey: "hack", provenance: {}, quality: "high", limitations: [],
    };
    expect(compareResponseEvidence(base, { ...base, id: "evidence-b" }).comparable).toBe(true);
  });

  it("77. Completed exposure week preserves completed, added, substituted, and replacement provenance", () => {
    const week = buildEvidenceScenario("completed-exposure-week");
    expect(week.provenance.contributingSessions).toEqual(expect.arrayContaining(["week-completed", "week-substitution", "week-added", "week-replaced"]));
    expect(week.provenance.contributingActivities).toContain("week-friday-lower-class");
    expect(week.muscleExposure.some((item) => item.addedExposure > 0)).toBe(true);
    expect(week.muscleExposure.some((item) => item.substitutedExposure > 0)).toBe(true);
    expect(week.muscleExposure.some((item) => item.replacementActivityExposure > 0)).toBe(true);
  });
});
