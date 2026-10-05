import { describe, expect, it } from "vitest";

import { calendarDateLabel } from "@/lib/dates/local-day";
import {
  evidenceSpanLine,
  headlineInsight,
  resolveResponsePrimaryAction,
  responseEvidenceLine,
  type ResponsePrimaryInput,
} from "../primary-action";
import type { ResponseInsight } from "../types";

function input(over: Partial<ResponsePrimaryInput> = {}): ResponsePrimaryInput {
  return {
    finalizedSessions: 6,
    comparableObservations: 14,
    completedWeeks: 3,
    activeInsights: 4,
    pendingRecommendations: 0,
    strongestFinding: "Pressing volume above 14 sets a week has not improved your top set.",
    ...over,
  };
}

const plan = (over: Partial<ResponsePrimaryInput> = {}) => resolveResponsePrimaryAction(input(over));

describe("responseEvidenceLine", () => {
  it("reports every real count, in one sentence", () => {
    expect(responseEvidenceLine(input())).toBe(
      "Built from 6 closed sessions, 14 comparable observations and 3 completed weeks.",
    );
  });

  it("says evidence is needed rather than printing zeroes", () => {
    const line = responseEvidenceLine(
      input({ finalizedSessions: 0, comparableObservations: 0, completedWeeks: 0 }),
    );
    expect(line).toBe("Evidence needed · nothing comparable has been logged yet.");
    expect(line).not.toMatch(/\b0\b/);
  });

  it("drops the parts that are zero instead of listing them", () => {
    expect(responseEvidenceLine(input({ comparableObservations: 0, completedWeeks: 0 }))).toBe(
      "Built from 6 closed sessions.",
    );
    expect(responseEvidenceLine(input({ completedWeeks: 0 }))).toBe(
      "Built from 6 closed sessions and 14 comparable observations.",
    );
  });

  it("uses the singular for a count of one", () => {
    expect(
      responseEvidenceLine(input({ finalizedSessions: 1, comparableObservations: 0, completedWeeks: 0 })),
    ).toBe("Built from 1 closed session.");
  });
});

describe("headlineInsight", () => {
  const insight = (id: string, confidence: ResponseInsight["confidence"], direction?: "positive" | "negative") =>
    ({ id, confidence, magnitude: direction ? { direction } : undefined }) as unknown as ResponseInsight;

  it("never headlines a finding Reserve rates insufficient", () => {
    expect(headlineInsight([insight("weight", "insufficient")])).toBeNull();
  });

  it("prefers a settled positive finding, then any finding with more than insufficient evidence", () => {
    expect(headlineInsight([insight("a", "emerging", "positive"), insight("b", "moderate", "positive")])?.id).toBe("b");
    expect(headlineInsight([insight("a", "insufficient", "positive"), insight("b", "emerging", "negative")])?.id).toBe("b");
  });
});

describe("evidenceSpanLine", () => {
  it("says how many separate weeks the observations fall in, and the dates they span", () => {
    expect(evidenceSpanLine({ comparableObservations: 2, weeks: 2, firstObservedAt: "2026-07-11", lastObservedAt: "2026-09-12" }))
      .toBe("2 comparable observations in 2 separate weeks, Jul 11, 2026 to Sep 12, 2026.");
    expect(evidenceSpanLine({ comparableObservations: 1, weeks: 1, firstObservedAt: "2026-09-12", lastObservedAt: "2026-09-12" }))
      .toBe("1 comparable observation in 1 week, on Sep 12, 2026.");
  });
});

describe("calendarDateLabel", () => {
  it("reads a stored day as the calendar day it names", () => {
    expect(calendarDateLabel("2027-01-04")).toBe("Jan 4, 2027");
    expect(calendarDateLabel("2026-09-12T08:00:00.000Z")).toBe("Sep 12, 2026");
    expect(calendarDateLabel("soon")).toBeNull();
  });
});

describe("resolveResponsePrimaryAction", () => {
  it("puts the evidence line on every state, including the empty one", () => {
    expect(plan().evidence).toContain("Built from");
    expect(plan({ finalizedSessions: 0, comparableObservations: 0, completedWeeks: 0 }).evidence).toContain(
      "Evidence needed",
    );
  });

  it("states the strongest finding verbatim", () => {
    expect(plan().statement).toBe("Pressing volume above 14 sets a week has not improved your top set.");
  });

  it("says nothing has been found rather than inventing a finding", () => {
    const result = plan({ strongestFinding: null, activeInsights: 0 });
    expect(result.statement).toBe("Reserve has not formed a pattern from your training yet.");
  });

  it("treats a blank finding as no finding", () => {
    expect(plan({ strongestFinding: "   " }).statement).toBe(
      "Reserve has not formed a pattern from your training yet.",
    );
  });

  it("puts a waiting decision ahead of everything else", () => {
    const result = plan({ pendingRecommendations: 2, activeInsights: 0 });
    expect(result.primary).toEqual({ kind: "review-recommendation", label: "Review the Recommendation" });
    expect(result.title).toBe("2 recommendations waiting on your decision");
  });

  it("sends the member to log comparable work when nothing is settled", () => {
    expect(plan({ activeInsights: 0 }).primary).toEqual({
      kind: "open-training",
      label: "Open Training Command",
    });
  });

  it("opens the evidence under a settled pattern", () => {
    expect(plan().primary).toEqual({ kind: "review-evidence", label: "Review the Evidence" });
  });

  it("never gives medical, dosage or supplement direction", () => {
    const banned = /\b(dose|dosage|supplement|compound|diagnos|treat|prescrib|deficien|elevated|safe to)\b/i;
    const states: Array<Partial<ResponsePrimaryInput>> = [
      { pendingRecommendations: 1 },
      { activeInsights: 0, strongestFinding: null },
      {},
    ];
    for (const state of states) {
      const result = plan(state);
      const text = `${result.evidence} ${result.statement} ${result.title} ${result.reason} ${result.primary.label}`;
      expect(text, text).not.toMatch(banned);
    }
  });
});
