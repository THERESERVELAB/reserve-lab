import { describe, expect, it } from "vitest";

import { resolveLifestylePrimaryAction, type LifestylePrimaryInput } from "../primary-action";

function input(over: Partial<LifestylePrimaryInput> = {}): LifestylePrimaryInput {
  return {
    scheduleCount: 2,
    activeScheduleName: "My Week",
    activityCount: 11,
    sessionCount: 3,
    ...over,
  };
}

const plan = (over: Partial<LifestylePrimaryInput> = {}) => resolveLifestylePrimaryAction(input(over));

describe("resolveLifestylePrimaryAction", () => {
  it("says no week is built and offers to build one", () => {
    const result = plan({ scheduleCount: 0, activeScheduleName: null, activityCount: 0, sessionCount: 0 });
    expect(result.statement).toBe("No week is built yet.");
    expect(result.primary).toEqual({ kind: "build-week", label: "Build Your Week" });
  });

  it("asks the member to activate one when schedules exist but none is running", () => {
    const result = plan({ activeScheduleName: null });
    expect(result.statement).toBe("2 weeks saved, none of them active.");
    expect(result.primary).toEqual({ kind: "activate-week", label: "Set Your Active Week" });
  });

  it("uses the singular for a single saved week", () => {
    expect(plan({ scheduleCount: 1, activeScheduleName: null }).statement).toBe(
      "1 week saved, none of them active.",
    );
  });

  it("names the active week and its real activity count", () => {
    expect(plan().statement).toBe("My Week is your active week · 11 activities.");
  });

  it("offers the session builder when the week has no custom session", () => {
    const result = plan({ sessionCount: 0 });
    expect(result.primary).toEqual({ kind: "build-session", label: "Build Your First Session" });
  });

  it("points a fully built week at what Reserve reads from it", () => {
    const result = plan();
    expect(result.primary).toEqual({ kind: "review-week", label: "Review Your Week" });
    expect(result.title).toBe("3 custom sessions built");
  });

  it("returns exactly one action, with real copy, in every state", () => {
    const states: Array<Partial<LifestylePrimaryInput>> = [
      { scheduleCount: 0, activeScheduleName: null, activityCount: 0, sessionCount: 0 },
      { activeScheduleName: null },
      { sessionCount: 0 },
      {},
    ];
    for (const state of states) {
      const result = plan(state);
      expect(result.primary.label.length).toBeGreaterThan(0);
      expect(result.statement.length).toBeGreaterThan(0);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("never promises Reserve will change the member's week for them", () => {
    const banned = /\b(automatically (?:rearrange|rebuild|change)|we will (?:fix|rebuild)|guaranteed)\b/i;
    for (const state of [{ scheduleCount: 0, activeScheduleName: null }, { activeScheduleName: null }, {}]) {
      const result = plan(state);
      const text = `${result.statement} ${result.title} ${result.reason} ${result.primary.label}`;
      expect(text, text).not.toMatch(banned);
    }
  });
});
