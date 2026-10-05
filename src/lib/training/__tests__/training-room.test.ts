import { describe, expect, it } from "vitest";

import {
  formatClockSeconds,
  programSourceLine,
  restClock,
  sessionClockLead,
  sessionMinutes,
  sessionVolume,
  readinessRead,
  sessionMetric,
  trainingHeroCopy,
  trainingPrimaryAction,
  type SessionMetricInput,
} from "../training-room";

const base: SessionMetricInput = {
  mode: "pre",
  kind: "lifting",
  estimatedDurationMin: 72,
  movements: 6,
  totalSets: 20,
  loggedSets: 0,
  recoveryMoves: null,
  activityLabel: null,
  activityMinutes: null,
};

describe("readinessRead", () => {
  it("is null without logged recovery evidence, whatever the reserve says", () => {
    expect(readinessRead({ hasData: false, reserve: 84, reserveLabel: "Strong" })).toBeNull();
    expect(readinessRead({ hasData: true, reserve: Number.NaN, reserveLabel: "Strong" })).toBeNull();
  });

  it("rounds and clamps the engine's reserve and keeps its label", () => {
    expect(readinessRead({ hasData: true, reserve: 66.6, reserveLabel: "Stable" })).toEqual({ value: 67, label: "Stable" });
    expect(readinessRead({ hasData: true, reserve: 140, reserveLabel: "Optimal" })?.value).toBe(100);
  });
});

describe("sessionMetric", () => {
  it("before the session, shows the template's estimate labelled est.", () => {
    expect(sessionMetric(base)).toEqual({ label: "Session", value: "72 min", detail: "6 movements · 20 sets", provenance: "est." });
  });

  it("falls back to the planned sets when the template has no estimate", () => {
    expect(sessionMetric({ ...base, estimatedDurationMin: null })).toEqual({
      label: "Session",
      value: "20 sets",
      detail: "6 movements",
      provenance: "planned",
    });
  });

  it("once live, shows only the sets the member has logged, without repeating 'logged'", () => {
    // "Sets logged · logged" read as a stutter in the cockpit.
    expect(sessionMetric({ ...base, mode: "live", loggedSets: 5 })).toEqual({
      label: "Sets logged",
      value: "5/20",
      detail: "25% of planned sets",
      provenance: null,
    });
    expect(sessionMetric({ ...base, mode: "complete", loggedSets: 40 })?.value).toBe("20/20");
  });

  it("returns nothing it would have to invent", () => {
    expect(sessionMetric({ ...base, kind: "missing", totalSets: 0, movements: 0 })).toBeNull();
    expect(sessionMetric({ ...base, mode: "live", totalSets: 0 })).toBeNull();
    expect(sessionMetric({ ...base, kind: "recovery", totalSets: 0, recoveryMoves: 0 })).toBeNull();
  });

  it("describes recovery and activity days by their own plan", () => {
    expect(sessionMetric({ ...base, kind: "recovery", totalSets: 0, recoveryMoves: 5 })?.value).toBe("5");
    expect(sessionMetric({ ...base, kind: "activity", totalSets: 0, activityLabel: "Track Session", activityMinutes: 60 })).toEqual({
      label: "Activity",
      value: "60 min",
      detail: "Track Session",
      provenance: "planned",
    });
  });
});

describe("hero copy", () => {
  const pre = { mode: "pre" as const, liftingStarted: false, isCatchUp: false, title: "Pull", kind: "lifting" as const, hasPlan: true };

  it("names today's session before it starts", () => {
    expect(trainingHeroCopy(pre)).toEqual({ statement: "Pull.", accent: null });
    expect(trainingHeroCopy({ ...pre, isCatchUp: true }).accent).toBe("Priority catch-up");
    expect(trainingHeroCopy({ ...pre, kind: "recovery", title: "No session" }).statement).toBe("Recovery day.");
    expect(trainingHeroCopy({ ...pre, kind: "activity", title: "Track Session" }).statement).toBe("Track Session.");
  });

  it("says there is no plan rather than dressing an empty day as recovery", () => {
    expect(trainingHeroCopy({ ...pre, kind: "missing", title: "No session", hasPlan: false })).toEqual({ statement: "No plan yet.", accent: null });
    expect(trainingHeroCopy({ ...pre, kind: "missing", hasPlan: true })).toEqual({ statement: "Pull.", accent: "Not built yet" });
  });

  it("follows the session lifecycle", () => {
    expect(trainingHeroCopy({ ...pre, mode: "live" })).toEqual({ statement: "Pull.", accent: "Live" });
    expect(trainingHeroCopy({ ...pre, mode: "live", liftingStarted: true }).accent).toBe("Live");
    expect(trainingHeroCopy({ ...pre, mode: "closed" })).toEqual({ statement: "Pull.", accent: "Captured" });
  });
});

describe("trainingPrimaryAction — the one gold action", () => {
  const idle = {
    mode: "pre" as const,
    staleLive: false,
    launchStage: "idle" as const,
    kind: "lifting" as const,
    movementCount: 9,
    hasRecoveryRunway: false,
    hasPlan: true,
  };

  it("is Start Session on a built lifting day, idle and in the readiness step", () => {
    expect(trainingPrimaryAction(idle)).toEqual({ kind: "begin", label: "Start Session" });
    expect(trainingPrimaryAction({ ...idle, launchStage: "pre-session" })).toEqual({ kind: "start", label: "Start Session" });
  });

  it("is nothing while live, after the session, stale, in the primer or on an activity day", () => {
    expect(trainingPrimaryAction({ ...idle, mode: "live" })).toBeNull();
    expect(trainingPrimaryAction({ ...idle, mode: "complete" })).toBeNull();
    expect(trainingPrimaryAction({ ...idle, mode: "closed" })).toBeNull();
    expect(trainingPrimaryAction({ ...idle, staleLive: true })).toBeNull();
    expect(trainingPrimaryAction({ ...idle, launchStage: "primer" })).toBeNull();
    expect(trainingPrimaryAction({ ...idle, kind: "activity", movementCount: 0 })).toBeNull();
  });

  it("routes a day with nothing to lift to its real next step", () => {
    expect(trainingPrimaryAction({ ...idle, kind: "recovery", movementCount: 0, hasRecoveryRunway: true })?.kind).toBe("recovery-runway");
    expect(trainingPrimaryAction({ ...idle, kind: "missing", movementCount: 0, hasPlan: false })).toEqual({ kind: "choose-split", label: "Choose Your Split" });
    expect(trainingPrimaryAction({ ...idle, kind: "missing", movementCount: 0 })).toEqual({ kind: "build", label: "Build Today's Session" });
    expect(trainingPrimaryAction({ ...idle, kind: "missing", movementCount: 0, launchStage: "pre-session" })).toBeNull();
  });
});

describe("programSourceLine — what generated today's session", () => {
  const none = { generation: null, horizon: null, programDay: null, memberSplitName: null, memberDayEdit: false };

  it("never claims there is no program when the member's split built the session", () => {
    const line = programSourceLine({ ...none, memberSplitName: "Reserve Strength + Physique Rotation" });
    expect(line.source).toBe("member-split");
    expect(line.text).toBe("Built from your split · Reserve Strength + Physique Rotation · no Program Horizon set");
    expect(line.text).not.toMatch(/No executable|did not create/i);
  });

  it("follows the resolver's precedence", () => {
    const horizon = { protocolName: "Hypertrophy Block", phaseName: "Accumulation", weekNumber: 3, totalWeeks: 12 };
    const programDay = { title: "Pull A", ownershipLabel: "Member Created" };
    const generation = { architectureName: "PPL + Upper / Lower", splitTitle: "Pull" };
    const all = { generation, horizon, programDay, memberSplitName: "Split", memberDayEdit: true };
    expect(programSourceLine(all).source).toBe("session");
    expect(programSourceLine({ ...all, generation: null }).text).toBe("Program Horizon · Hypertrophy Block · Accumulation · Week 3 of 12");
    expect(programSourceLine({ ...all, generation: null, horizon: null }).text).toBe("Your program · Pull A · Member Created");
    expect(programSourceLine({ ...none, memberDayEdit: true }).source).toBe("member-day");
  });

  it("says no plan only when nothing resolved", () => {
    expect(programSourceLine(none)).toEqual({ source: "none", text: "No plan set · Reserve does not build a generic workout" });
  });
});

describe("live and close-out reads", () => {
  const fmt = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const start = new Date(2026, 8, 15, 16, 0, 0).toISOString();

  it("times the session from its own stamps, and says nothing before it starts", () => {
    expect(sessionMinutes(start, new Date(2026, 8, 15, 16, 42, 20))).toBe(42);
    expect(sessionMinutes(null, new Date())).toBeNull();
    expect(sessionClockLead({ mode: "pre", startedAt: start, endedAt: null, now: new Date(), formatTime: fmt })).toBeNull();
    expect(sessionClockLead({ mode: "live", startedAt: start, endedAt: null, now: new Date(2026, 8, 15, 16, 30), formatTime: fmt })).toEqual({
      label: "Elapsed",
      value: "30 min",
      detail: "Started 16:00",
      // The clock is the member's own session; "Elapsed · logged" said it twice.
      provenance: null,
    });
    const closed = sessionClockLead({ mode: "closed", startedAt: start, endedAt: new Date(2026, 8, 15, 17, 5).toISOString(), now: null, formatTime: fmt });
    expect(closed?.label).toBe("Duration");
    expect(closed?.value).toBe("65 min");
  });

  it("sums volume only from loaded sets", () => {
    expect(sessionVolume([{ load: 135, reps: 8 }, { load: 0, reps: 12 }, { load: 140, reps: 6 }])).toBe(1920);
    expect(sessionVolume([{ load: 0, reps: 10 }])).toBeNull();
  });

  it("counts rest down from the last logged set, then over", () => {
    const logged = new Date(2026, 8, 15, 16, 0, 0);
    expect(restClock(null, 90, logged.getTime())).toBeNull();
    expect(restClock(logged.toISOString(), 90, logged.getTime() + 30_000)).toEqual({ remaining: 60, over: false });
    expect(restClock(logged.toISOString(), 90, logged.getTime() + 100_000)).toEqual({ remaining: 10, over: true });
    expect(formatClockSeconds(75)).toBe("1:15");
  });
});
