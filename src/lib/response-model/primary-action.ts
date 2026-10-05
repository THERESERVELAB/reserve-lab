/* ════════════════════════════════════════════════════════════════════════
   RESPONSE MODEL PRIMARY ACTION — the one gold action on the screen that
   reports what Reserve has learned from the member's own training.

     0. a recommendation is waiting → review it (the member decides, always)
     1. no settled pattern yet      → go log comparable work
     2. patterns exist              → read the evidence under them

   The evidence status comes FIRST on this screen, so this module also
   composes the one sentence that says how much the model is built from.
   A finding is only ever the member's own; with none, the statement says so
   rather than reaching for something to display.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { calendarDateLabel } from "@/lib/dates/local-day";
import type { ResponseInsight } from "./types";

export type ResponsePrimaryAction =
  | { kind: "review-recommendation"; label: string }
  | { kind: "open-training"; label: string }
  | { kind: "review-evidence"; label: string };

export type ResponsePrimaryPlan = {
  /** The evidence this model is built from — always before any finding. */
  evidence: string;
  /** The strongest finding, or an honest absence. */
  statement: string;
  title: string;
  reason: string;
  primary: ResponsePrimaryAction;
};

export type ResponsePrimaryInput = {
  /** `model.dataQuality.finalizedSessions` — closed, comparable sessions. */
  finalizedSessions: number;
  /** `model.dataQuality.comparableExerciseObservations`. */
  comparableObservations: number;
  /** `model.dataQuality.completedWeeks`. */
  completedWeeks: number;
  /** Insights strong enough to show. */
  activeInsights: number;
  /** Recommendations waiting on the member's decision. */
  pendingRecommendations: number;
  /** The strongest current finding, verbatim. Null when there is none. */
  strongestFinding: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The finding the screen may state as its headline. A finding Reserve rates
 * insufficient never headlines — it would sit right under "Evidence needed"
 * and read as a conclusion. Settled positive findings lead; otherwise the
 * first finding with more than insufficient evidence.
 */
export function headlineInsight(insights: ResponseInsight[]): ResponseInsight | null {
  const stated = insights.filter((i) => i.confidence !== "insufficient");
  return (
    stated.find((i) => i.magnitude?.direction === "positive" && i.confidence !== "emerging") ??
    stated[0] ??
    null
  );
}

/** "2 comparable observations in 2 separate weeks, Jul 11, 2026 to Sep 12, 2026." */
export function evidenceSpanLine(input: {
  comparableObservations: number;
  weeks: number;
  firstObservedAt: string;
  lastObservedAt: string;
}): string {
  const first = calendarDateLabel(input.firstObservedAt) ?? input.firstObservedAt;
  const last = calendarDateLabel(input.lastObservedAt) ?? input.lastObservedAt;
  const weeks = input.weeks === 1 ? "1 week" : `${input.weeks} separate weeks`;
  const span = first === last ? `on ${first}` : `${first} to ${last}`;
  return `${plural(input.comparableObservations, "comparable observation")} in ${weeks}, ${span}.`;
}

/**
 * "Built from 6 closed sessions, 14 comparable observations and 3 completed weeks."
 * With nothing logged it says that instead — never a zeroed-out reading
 * dressed as a measurement.
 */
export function responseEvidenceLine(input: ResponsePrimaryInput): string {
  const parts: string[] = [];
  if (input.finalizedSessions > 0) parts.push(plural(input.finalizedSessions, "closed session"));
  if (input.comparableObservations > 0) parts.push(plural(input.comparableObservations, "comparable observation"));
  if (input.completedWeeks > 0) parts.push(plural(input.completedWeeks, "completed week"));

  if (parts.length === 0) return "Evidence needed · nothing comparable has been logged yet.";
  if (parts.length === 1) return `Built from ${parts[0]}.`;
  return `Built from ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
}

export function resolveResponsePrimaryAction(input: ResponsePrimaryInput): ResponsePrimaryPlan {
  const evidence = responseEvidenceLine(input);
  const statement =
    input.strongestFinding?.trim() || "Reserve has not formed a pattern from your training yet.";

  /* 0 ── A decision is waiting on the member. Nothing outranks that. */
  if (input.pendingRecommendations > 0) {
    const count = input.pendingRecommendations;
    return {
      evidence,
      statement,
      title: `${plural(count, "recommendation")} waiting on your decision`,
      reason: "Reserve never changes your program on its own. Reviewing shows what would change and what would not.",
      primary: { kind: "review-recommendation", label: "Review the Recommendation" },
    };
  }

  /* 1 ── Nothing settled: say what would settle it. */
  if (input.activeInsights === 0) {
    return {
      evidence,
      statement,
      title: "Not enough comparable work yet",
      reason:
        "A pattern needs the same work repeated across weeks. Closing more sessions is what turns these logs into something Reserve will state.",
      primary: { kind: "open-training", label: "Open Training Command" },
    };
  }

  /* 2 ── Patterns exist, and each one carries what it was built from. */
  return {
    evidence,
    statement,
    title: "Every pattern carries its evidence",
    reason:
      "What Reserve observed, what supports it, what contradicts it, and what it still does not know — all of it is under each finding.",
    primary: { kind: "review-evidence", label: "Review the Evidence" },
  };
}
