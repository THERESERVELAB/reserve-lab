import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  plannedEndDate,
  resolveCycleState,
  selectCurrentCycle,
  validateCycleInput,
  type CyclePeriod,
} from "../cycle-period";

const CYCLE: CyclePeriod = {
  id: "c1",
  name: "Fall cycle",
  startDate: "2026-09-14",
  plannedWeeks: 12,
  compoundIds: ["test-cyp", "var", "deleted"],
  clinicianOversight: false,
  checkpoints: [
    { id: "baseline", date: "2026-09-10", label: "Baseline", setBy: "member" },
    { id: "mid", date: "2026-10-12", label: "Mid-cycle", setBy: "clinician" },
    { id: "late", date: "2026-11-09", label: "Week 9", setBy: "member" },
  ],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const COMPOUNDS = [
  { id: "test-cyp", name: "Testosterone Cypionate", isActive: true },
  { id: "var", name: "Oxandrolone", isActive: true, pausedAt: "2026-11-01" },
];

describe("dates", () => {
  it("counts days across month and DST boundaries", () => {
    expect(daysBetween("2026-09-14", "2026-10-20")).toBe(36);
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
    expect(addDays("2026-09-14", 83)).toBe("2026-12-06");
  });

  it("ends a 12-week plan on the last day of week 12", () => {
    expect(plannedEndDate(CYCLE)).toBe("2026-12-06");
  });
});

describe("resolveCycleState", () => {
  it("knows the week, days left and progress while on cycle", () => {
    const state = resolveCycleState(CYCLE, { now: new Date(2026, 9, 20, 9), compounds: COMPOUNDS });
    expect(state.phase).toBe("on-cycle");
    expect(state.weekNumber).toBe(6);
    expect(state.totalWeeks).toBe(12);
    expect(state.daysRemaining).toBe(47);
    expect(state.progress).toBeCloseTo(37 / 84);
    expect(state.stillActivePastEnd).toBe(false);
  });

  it("reports a cycle that has not started", () => {
    const state = resolveCycleState(CYCLE, { now: new Date(2026, 8, 10), compounds: COMPOUNDS });
    expect(state.phase).toBe("upcoming");
    expect(state.daysUntilStart).toBe(4);
    expect(state.weekNumber).toBe(0);
  });

  it("notices compounds still active past the member's own end date", () => {
    const state = resolveCycleState(CYCLE, { now: new Date(2026, 11, 10), compounds: COMPOUNDS });
    expect(state.phase).toBe("past-planned-end");
    expect(state.daysPastPlannedEnd).toBe(4);
    expect(state.stillActivePastEnd).toBe(true);
    // Paused compounds do not count as still running.
    expect(state.activePastEndNames).toEqual(["Testosterone Cypionate"]);
  });

  it("stops flagging once the member ends the cycle", () => {
    const state = resolveCycleState({ ...CYCLE, endedOn: "2026-12-01", endReason: "completed" }, { now: new Date(2026, 11, 10), compounds: COMPOUNDS });
    expect(state.phase).toBe("ended");
    expect(state.stillActivePastEnd).toBe(false);
  });

  it("tracks bloodwork checkpoints against logged lab dates", () => {
    const state = resolveCycleState(CYCLE, {
      now: new Date(2026, 9, 20),
      compounds: COMPOUNDS,
      labDates: ["2026-10-15"],
    });
    const byId = Object.fromEntries(state.checkpoints.map((c) => [c.id, c]));
    expect(byId.baseline.status).toBe("overdue");
    expect(byId.mid).toMatchObject({ status: "met", metByLabDate: "2026-10-15" });
    expect(byId.late.status).toBe("upcoming");
    expect(state.nextCheckpoint?.id).toBe("late");
    expect(state.overdueCheckpoints.map((c) => c.id)).toEqual(["baseline"]);
  });

  it("reports compounds that were deleted from the log", () => {
    const state = resolveCycleState(CYCLE, { now: new Date(2026, 9, 20), compounds: COMPOUNDS });
    expect(state.missingCompoundIds).toEqual(["deleted"]);
    expect(state.compounds.map((c) => c.id)).toEqual(["test-cyp", "var"]);
  });
});

describe("selectCurrentCycle", () => {
  it("prefers the latest started, unended cycle, then the soonest upcoming", () => {
    const older = { ...CYCLE, id: "older", startDate: "2026-06-01" };
    const ended = { ...CYCLE, id: "ended", startDate: "2026-09-01", endedOn: "2026-09-05" };
    const upcoming = { ...CYCLE, id: "upcoming", startDate: "2027-01-05" };
    expect(selectCurrentCycle([older, ended, CYCLE, upcoming], new Date(2026, 9, 1))?.id).toBe("c1");
    expect(selectCurrentCycle([ended, upcoming], new Date(2026, 9, 1))?.id).toBe("upcoming");
    expect(selectCurrentCycle([ended], new Date(2026, 9, 1))).toBeNull();
  });
});

describe("validateCycleInput", () => {
  const base = { name: "Cycle", startDate: "2026-09-14", plannedWeeks: 12, compoundIds: [], clinicianOversight: false };
  it("accepts the member's plan as stated", () => {
    expect(validateCycleInput(base)).toBeNull();
  });
  it("rejects incomplete or impossible input", () => {
    expect(validateCycleInput({ ...base, name: " " })).toMatch(/Name/);
    expect(validateCycleInput({ ...base, startDate: "2026-02-30" })).toMatch(/start date/);
    expect(validateCycleInput({ ...base, plannedWeeks: 0 })).toMatch(/weeks/);
    expect(validateCycleInput({ ...base, plannedWeeks: 2.5 })).toMatch(/weeks/);
    expect(validateCycleInput({ ...base, plannedWeeks: 500 })).toMatch(/104/);
  });
});
