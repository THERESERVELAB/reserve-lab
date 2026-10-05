import { describe, expect, it } from "vitest";

import { fixtureSnapshot, FRIDAY_LOWER_CLASS } from "@/lib/athlete/fixtures";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { generateProgramHorizon } from "@/lib/horizon/generate";
import { applyActivityToHorizon } from "@/lib/horizon/revise";
import { buildResponseEvidence } from "@/lib/response-evidence/engine";
import { buildEvidenceScenarioInput } from "@/lib/response-evidence/fixtures";
import {
  activityOccurrenceDate,
  resolveLiveResponseActivities,
} from "@/lib/response-evidence/live-activities";
import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import { createReserveDecision, type ReserveDecisionRecord } from "@/lib/training/session-execution";

const START = "2026-07-20";
const FRIDAY_NOW = "2026-07-24T12:00:00.000Z";

function horizon() {
  const snapshot = fixtureSnapshot("grand-touring-with-friday-class")!;
  return generateProgramHorizon({
    protocolId: "reserve-grand-touring",
    snapshot,
    profile: deriveProgrammingProfile(snapshot),
    totalWeeks: 4,
    now: new Date(`${START}T08:00:00.000Z`),
    startDate: START,
  })!;
}

function activity(overrides: Partial<AthleteActivity> = {}): AthleteActivity {
  return { ...FRIDAY_LOWER_CLASS, ...overrides };
}

function decision(
  snapshot: AthleteActivity,
  status: "accepted" | "declined" | "cancelled",
  createdAt = "2026-07-20T08:00:00.000Z",
  revisionId = "rev-friday-class",
): ReserveDecisionRecord {
  return createReserveDecision({
    id: `decision:${snapshot.id}:${status}:${createdAt}`,
    createdAt,
    category: "activity-reconciliation",
    source: "athlete",
    programId: horizon().programId,
    observation: "Synthetic activity decision",
    decision: status,
    reason: "Test provenance",
    athleteDecision: status === "declined" ? "declined" : "accepted",
    activity: {
      activityId: snapshot.id,
      revisionId,
      status,
      effectiveWeek: 1,
      programStartDate: START,
      snapshot,
    },
  });
}

describe("live Response activity wiring", () => {
  it("1. Live one-time activity reaches the Response Model input", () => {
    const oneTime = activity({ id: "one-time-friday", recurrence: "one-time", date: "2026-07-24" });
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [], decisions: [decision(oneTime, "accepted")], executionRecords: [], now: FRIDAY_NOW });
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]).toMatchObject({ sourceActivityId: oneTime.id, date: "2026-07-24", durationMinutes: 60, intensity: "high" });
  });

  it("2. Live recurring activity reaches applicable weeks", () => {
    const recurring = activity();
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [recurring], decisions: [decision(recurring, "accepted")], executionRecords: [], now: "2026-07-31T12:00:00.000Z" });
    expect(result.activities.map((item) => item.date)).toEqual(["2026-07-24", "2026-07-31"]);
    expect(result.activities.map((item) => item.occurrenceWeekNumber)).toEqual([1, 2]);
  });

  it("3. Declined activity does not enter the model", () => {
    const declined = activity({ id: "declined-class" });
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [], decisions: [decision(declined, "declined")], executionRecords: [], now: FRIDAY_NOW });
    expect(result.activities).toEqual([]);
    expect(result.excluded[0]?.reason).toContain("declined");
  });

  it("4. Cancelled recurring activity stops future evidence", () => {
    const recurring = activity({ id: "cancelled-series" });
    const result = resolveLiveResponseActivities({
      horizon: horizon(),
      recurringActivities: [],
      decisions: [
        decision(recurring, "accepted"),
        decision(recurring, "cancelled", "2026-07-25T08:00:00.000Z"),
      ],
      executionRecords: [],
      now: "2026-08-07T12:00:00.000Z",
    });
    expect(result.activities.map((item) => item.date)).toEqual(["2026-07-24"]);
  });

  it("5. Replacement activity does not double-count the original session", () => {
    const fixture = buildEvidenceScenarioInput("lower-body-class-replacement");
    const source = fixture.activities![0];
    const live = resolveLiveResponseActivities({
      horizon: horizon(),
      recurringActivities: [],
      decisions: [decision(source, "accepted")],
      executionRecords: fixture.executionRecords,
      now: FRIDAY_NOW,
    });
    const evidence = buildResponseEvidence({ ...fixture, activities: live.activities });
    expect(evidence.muscleExposure.reduce((sum, item) => sum + item.totalExposureEquivalent, 0)).toBe(0);
    expect(evidence.muscleExposure.reduce((sum, item) => sum + item.replacementActivityExposure, 0)).toBeGreaterThan(0);
  });

  it("6. Supplemental activity remains supplemental", () => {
    const supplemental = activity({ id: "supplemental-class", recurrence: "one-time", date: "2026-07-24", relationship: "supplement" });
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [], decisions: [decision(supplemental, "accepted")], executionRecords: [], now: FRIDAY_NOW });
    expect(result.activities[0]?.relationship).toBe("supplement");
  });

  it("7. Activity provenance remains traceable", () => {
    const recurring = activity({ id: "traceable-class" });
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [], decisions: [decision(recurring, "accepted", undefined, "rev-traceable")], executionRecords: [], now: FRIDAY_NOW });
    const bundle = buildResponseEvidence({ athleteId: "athlete", executionRecords: [], activities: result.activities });
    expect(bundle.provenance.contributingActivitySources).toEqual([recurring.id]);
    expect(bundle.provenance.contributingActivityRevisions).toEqual(["rev-traceable"]);
    expect(bundle.conditioning[0]).toMatchObject({ sourceActivityId: recurring.id, activityRevisionId: "rev-traceable" });
  });

  it("8. Activity rebuild is deterministic", () => {
    const recurring = activity({ id: "deterministic-class" });
    const input = { horizon: horizon(), recurringActivities: [], decisions: [decision(recurring, "accepted")], executionRecords: [], now: "2026-07-31T12:00:00.000Z" };
    expect(resolveLiveResponseActivities(input)).toEqual(resolveLiveResponseActivities(input));
  });

  it("9. Week wrap-around remains correct", () => {
    expect(activityOccurrenceDate(START, 1, 6)).toBe("2026-07-26");
    expect(activityOccurrenceDate(START, 2, 0)).toBe("2026-07-27");
    expect(activityOccurrenceDate(START, 2, 6)).toBe("2026-08-02");
  });

  it("10. Missing activity details remain missing", () => {
    const incomplete = activity({ id: "missing-details", recurrence: "one-time", date: undefined, startTime: undefined, intensity: "unknown" });
    const result = resolveLiveResponseActivities({ horizon: horizon(), recurringActivities: [], decisions: [decision(incomplete, "accepted")], executionRecords: [], now: FRIDAY_NOW });
    expect(result.activities[0]?.date).toBeUndefined();
    expect(result.activities[0]?.startTime).toBeUndefined();
    const evidence = buildResponseEvidence({ athleteId: "athlete", executionRecords: [], activities: result.activities });
    expect(evidence.conditioning[0]?.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining("no concrete calendar date"),
      expect.stringContaining("intensity was not reported"),
    ]));
  });

  it("Grand Touring topology remains unchanged while Friday evidence is materialized", () => {
    const base = horizon();
    const before = JSON.stringify(base.weeks.map((week) => week.weeklyStructure));
    const applied = applyActivityToHorizon({ horizon: base, activity: activity(), athleteConfirmed: true, now: new Date(FRIDAY_NOW) });
    const result = resolveLiveResponseActivities({ horizon: applied.horizon, recurringActivities: [activity()], decisions: [], executionRecords: [], now: FRIDAY_NOW });
    expect(result.activities[0]).toMatchObject({ date: "2026-07-24", startTime: "05:45", durationMinutes: 60, intensity: "high" });
    expect(JSON.stringify(base.weeks.map((week) => week.weeklyStructure))).toBe(before);
    expect(applied.revision?.athleteConfirmed).toBe(true);
  });
});
