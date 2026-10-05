import { describe, expect, it } from "vitest";

import type { ActiveProtocol, CommandCompleteness, ProtocolProgress } from "../library";
import { resolveProtocolPrimaryAction, type ProtocolPrimaryInput } from "../primary-action";

const ACTIVE: ActiveProtocol = {
  protocolId: "recomp-12",
  protocolName: "Recomposition Block",
  category: "recomp",
  selectedDate: "2026-09-01",
  startDate: "2026-09-01",
  targetDate: "2026-12-01",
  durationWeeks: 12,
  commitmentLevel: "high",
  trainingDays: 5,
  cardioDays: 2,
  mobilityDays: 2,
  checkInCadence: "Weekly",
  nutritionFocus: "Maintenance",
  recoveryFocus: "Sleep first",
  goal: "Recomposition",
  eventName: null,
  eventType: null,
  eventDate: null,
  status: "active",
  notes: "",
};

const PROGRESS: ProtocolProgress = {
  currentWeek: 3,
  totalWeeks: 12,
  phase: { index: 0, label: "Build", weekStart: 1, weekEnd: 4, focus: "Base work" },
  phases: [],
  daysToTarget: 63,
  weeksRemaining: 9,
  percentComplete: 17,
  timelineLabel: "Target · 63 days",
  pace: "on-pace",
};

const COMPLETE: CommandCompleteness = { percent: 100, missing: [], confidence: "high" };

function input(over: Partial<ProtocolPrimaryInput> = {}): ProtocolPrimaryInput {
  return { active: ACTIVE, progress: PROGRESS, completeness: COMPLETE, ...over };
}

const plan = (over: Partial<ProtocolPrimaryInput> = {}) => resolveProtocolPrimaryAction(input(over));

describe("resolveProtocolPrimaryAction", () => {
  it("says so plainly and offers the choice when no protocol is set", () => {
    const result = plan({ active: null, progress: null });
    expect(result.statement).toBe("No protocol is set.");
    expect(result.primary).toEqual({ kind: "choose-protocol", label: "Choose Your Protocol" });
  });

  it("treats a missing progress read as no protocol rather than guessing a week", () => {
    expect(plan({ progress: null }).primary.kind).toBe("choose-protocol");
  });

  it("offers resume before anything else while the protocol is paused", () => {
    const result = plan({
      active: { ...ACTIVE, status: "paused" },
      completeness: { percent: 40, missing: ["Schedule", "Goal"], confidence: "limited" },
    });
    expect(result.statement).toBe("Recomposition Block is paused.");
    expect(result.primary).toEqual({ kind: "resume-protocol", label: "Resume Protocol" });
  });

  it("moves a completed block on to the next one", () => {
    const result = plan({ active: { ...ACTIVE, status: "completed" } });
    expect(result.statement).toBe("Recomposition Block is complete.");
    expect(result.primary).toEqual({ kind: "choose-next-protocol", label: "Choose Your Next Protocol" });
  });

  it("states the member's real week on an active block", () => {
    expect(plan().statement).toBe("Week 3 of 12 on Recomposition Block.");
  });

  it("never invents a block length it does not have", () => {
    const result = plan({ progress: { ...PROGRESS, totalWeeks: 0 } });
    expect(result.statement).toBe("Recomposition Block is running without a set block length.");
    expect(result.statement).not.toMatch(/week \d/i);
  });

  it("asks for a target date before it asks for anything else on a live block", () => {
    const result = plan({
      progress: { ...PROGRESS, pace: "no-deadline", daysToTarget: null, weeksRemaining: null },
      completeness: { percent: 60, missing: ["Recovery target"], confidence: "moderate" },
    });
    expect(result.primary).toEqual({ kind: "set-target-date", label: "Set Your Target Date" });
  });

  it("names the first missing input, and carries it on the action", () => {
    const result = plan({
      completeness: { percent: 70, missing: ["Gym environment", "Meal timing"], confidence: "moderate" },
    });
    expect(result.primary).toEqual({
      kind: "complete-profile",
      label: "Complete Your Profile",
      missing: "Gym environment",
    });
    expect(result.title).toBe("2 command inputs are still missing");
    expect(result.reason).toContain("Gym environment");
    expect(result.reason).toContain("moderate confidence");
  });

  it("uses the singular when exactly one input is missing", () => {
    const result = plan({ completeness: { percent: 90, missing: ["Meal timing"], confidence: "high" } });
    expect(result.title).toBe("1 command input is still missing");
  });

  it("points a fully set block at its projected weeks", () => {
    expect(plan().primary).toEqual({ kind: "open-program-horizon", label: "Open Program Horizon" });
  });

  it("returns exactly one action in every state", () => {
    const states: Array<Partial<ProtocolPrimaryInput>> = [
      { active: null, progress: null },
      { active: { ...ACTIVE, status: "paused" } },
      { active: { ...ACTIVE, status: "completed" } },
      { progress: { ...PROGRESS, pace: "no-deadline" } },
      { completeness: { percent: 50, missing: ["Goal"], confidence: "limited" } },
      {},
    ];
    for (const state of states) {
      const result = plan(state);
      expect(result.primary.label.length).toBeGreaterThan(0);
      expect(result.statement.length).toBeGreaterThan(0);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("never uses dosage, compound or outcome-guarantee language", () => {
    const banned = /\b(dose|dosage|cycle design|stack|guaranteed|will lose|will gain|optimi[sz]e your protocol)\b/i;
    const states: Array<Partial<ProtocolPrimaryInput>> = [
      { active: null, progress: null },
      { active: { ...ACTIVE, status: "paused" } },
      { active: { ...ACTIVE, status: "completed" } },
      { progress: { ...PROGRESS, pace: "no-deadline" } },
      { completeness: { percent: 50, missing: ["Goal"], confidence: "limited" } },
      {},
    ];
    for (const state of states) {
      const result = plan(state);
      const text = `${result.statement} ${result.title} ${result.reason} ${result.primary.label}`;
      expect(text, text).not.toMatch(banned);
    }
  });
});
