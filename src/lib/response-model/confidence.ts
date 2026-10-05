/* ════════════════════════════════════════════════════════════════════════
   RESPONSE CONFIDENCE — the single source of every threshold.

   Thresholds are NOT scattered across the domain detectors. Every insight in
   every domain is graded here, so the answer to "why is this only emerging"
   is always the same code path and always explainable.

   The governing principle: confidence is earned by REPEATED, COMPARABLE,
   well-conditioned observations spread across time — never by raw count.
   Twenty duplicate records logged on one afternoon are one observation's
   worth of evidence, and this module says so.
   ════════════════════════════════════════════════════════════════════════ */

import type { EvidenceQuality } from "@/lib/response-evidence/types";
import type { ResponseConfidence, ResponseConfidenceInput, ResponseConfidenceResult } from "./types";

/* ─── Thresholds — the only place these numbers exist ─────────────────── */

export const CONFIDENCE_POLICY = {
  /** Below this many comparable observations nothing can leave "insufficient". */
  minimumComparableForEmerging: 2,
  /** Comparable observations required before "moderate" is reachable. */
  minimumComparableForModerate: 4,
  /** Comparable observations required before "established" is reachable. */
  minimumComparableForEstablished: 6,

  /** Distinct weeks required for "moderate". A pattern inside one week is not yet a pattern. */
  minimumWeeksForModerate: 2,
  /** Distinct weeks required for "established". */
  minimumWeeksForEstablished: 3,
  /** Distinct phases required for "established" when week count is at the floor. */
  phasesRelaxingWeekFloor: 2,

  /** Distinct calendar dates required before anything above "emerging". */
  minimumDistinctDatesForModerate: 3,

  /** Above this contradiction ratio an insight cannot be "established". */
  contradictionCapsEstablished: 0.15,
  /** Above this contradiction ratio an insight cannot exceed "emerging". */
  contradictionCapsModerate: 0.34,

  /** Score bands. */
  scoreEmerging: 25,
  scoreModerate: 55,
  // Calibrated so that the intended "established" case — roughly eight
  // comparable observations across six weeks and two phases on well-detailed
  // records — actually clears the bar. The hard gates below still apply.
  scoreEstablished: 75,
} as const;

const QUALITY_WEIGHT: Record<EvidenceQuality, number> = {
  insufficient: 0,
  low: 0.4,
  moderate: 0.75,
  high: 1,
};

const ORDER: ResponseConfidence[] = ["insufficient", "emerging", "moderate", "established"];

export function confidenceRank(c: ResponseConfidence): number {
  return ORDER.indexOf(c);
}

/** The weaker of two confidence grades. */
export function minConfidence(a: ResponseConfidence, b: ResponseConfidence): ResponseConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

/** Mean evidence quality on a 0–1 scale. An empty set is zero, not neutral. */
export function averageQuality(qualities: EvidenceQuality[]): number {
  if (qualities.length === 0) return 0;
  return qualities.reduce((sum, q) => sum + QUALITY_WEIGHT[q], 0) / qualities.length;
}

/**
 * Grade an insight's confidence.
 *
 * Deterministic: the same input always yields the same result, including the
 * ordering of the reason strings.
 */
export function calculateResponseConfidence(input: ResponseConfidenceInput): ResponseConfidenceResult {
  const supporting: string[] = [];
  const limiting: string[] = [];

  const comparable = Math.max(0, Math.floor(input.comparableObservations));
  const contradicting = Math.max(0, Math.floor(input.contradictingObservations));
  const supportingCount = Math.max(0, Math.floor(input.supportingObservations));
  const weeks = Math.max(0, Math.floor(input.weeksRepresented));
  const phases = Math.max(0, Math.floor(input.phasesRepresented));
  // When the caller does not track distinct dates, fall back to the weakest
  // safe assumption rather than the most generous one.
  const distinctDates = input.distinctDates != null
    ? Math.max(0, Math.floor(input.distinctDates))
    : Math.min(comparable, Math.max(weeks, 1));

  const quality = averageQuality(input.evidenceQuality);
  const denominator = supportingCount + contradicting;
  const contradictionRatio = denominator > 0 ? contradicting / denominator : 0;

  /* ── Score ──────────────────────────────────────────────────────────── */
  // Comparable observations, with diminishing returns — the tenth comparable
  // rep of the same observation is worth much less than the second.
  let score = Math.min(46, comparable * 11);
  // Spread across weeks is the strongest single signal of a real pattern.
  score += Math.min(22, weeks * 8);
  // Holding across phases means the pattern survived a context change.
  score += Math.min(14, Math.max(0, phases - 1) * 9);
  // Quality gates the whole thing.
  score *= 0.55 + 0.45 * quality;
  // Contradiction subtracts directly.
  score -= contradictionRatio * 45;
  // Missing critical context subtracts per item, bounded.
  score -= Math.min(24, input.missingCriticalContext.length * 8);
  score = Math.max(0, Math.min(100, Math.round(score)));

  /* ── Reasons ────────────────────────────────────────────────────────── */
  if (comparable >= CONFIDENCE_POLICY.minimumComparableForEstablished) {
    supporting.push(`${comparable} genuinely comparable observations.`);
  } else if (comparable >= CONFIDENCE_POLICY.minimumComparableForEmerging) {
    supporting.push(`${comparable} comparable observations so far.`);
  } else {
    limiting.push(
      comparable === 1
        ? "Only one comparable observation — a single exposure cannot establish how you respond."
        : "No genuinely comparable observations yet.",
    );
  }

  if (weeks >= CONFIDENCE_POLICY.minimumWeeksForEstablished) {
    supporting.push(`Observed across ${weeks} separate weeks.`);
  } else if (weeks >= CONFIDENCE_POLICY.minimumWeeksForModerate) {
    supporting.push(`Observed across ${weeks} weeks.`);
  } else {
    limiting.push("Evidence sits inside a single week, so it may reflect that week rather than a pattern.");
  }

  if (phases >= CONFIDENCE_POLICY.phasesRelaxingWeekFloor) {
    supporting.push(`Held across ${phases} program phases.`);
  }

  if (distinctDates < CONFIDENCE_POLICY.minimumDistinctDatesForModerate) {
    limiting.push(
      distinctDates <= 1
        ? "All the evidence comes from a single day, which cannot show a repeated response."
        : `Evidence spans only ${distinctDates} separate days.`,
    );
  }

  if (quality < 0.5) {
    limiting.push("The underlying records are low quality — load, effort, or completion detail is thin.");
  } else if (quality >= 0.85) {
    supporting.push("The underlying records are well detailed.");
  }

  if (contradicting > 0) {
    limiting.push(
      `${contradicting} observation${contradicting === 1 ? "" : "s"} point the other way and remain part of the picture.`,
    );
  }

  for (const missing of input.missingCriticalContext) {
    limiting.push(`Missing context: ${missing}.`);
  }

  /* ── Grade, with hard gates that the score cannot override ──────────── */
  let confidence: ResponseConfidence = "insufficient";
  if (score >= CONFIDENCE_POLICY.scoreEstablished) confidence = "established";
  else if (score >= CONFIDENCE_POLICY.scoreModerate) confidence = "moderate";
  else if (score >= CONFIDENCE_POLICY.scoreEmerging) confidence = "emerging";

  const cap = (level: ResponseConfidence, reason: string) => {
    if (confidenceRank(confidence) > confidenceRank(level)) {
      confidence = level;
      if (!limiting.includes(reason)) limiting.push(reason);
    }
  };

  if (comparable < CONFIDENCE_POLICY.minimumComparableForEmerging) {
    cap("insufficient", "Fewer than two comparable observations.");
  }
  if (comparable < CONFIDENCE_POLICY.minimumComparableForModerate) {
    cap("emerging", `Fewer than ${CONFIDENCE_POLICY.minimumComparableForModerate} comparable observations.`);
  }
  if (comparable < CONFIDENCE_POLICY.minimumComparableForEstablished) {
    cap("moderate", `Fewer than ${CONFIDENCE_POLICY.minimumComparableForEstablished} comparable observations.`);
  }
  if (weeks < CONFIDENCE_POLICY.minimumWeeksForModerate) {
    cap("emerging", "A pattern inside one week is not yet a pattern across weeks.");
  }
  if (weeks < CONFIDENCE_POLICY.minimumWeeksForEstablished && phases < CONFIDENCE_POLICY.phasesRelaxingWeekFloor) {
    cap("moderate", "Not yet repeated across enough weeks or phases.");
  }
  if (distinctDates < CONFIDENCE_POLICY.minimumDistinctDatesForModerate) {
    cap("emerging", "Too few separate training days to read this as a repeated response.");
  }
  if (quality <= 0) {
    cap("insufficient", "The available records are not detailed enough to interpret.");
  }
  if (contradictionRatio > CONFIDENCE_POLICY.contradictionCapsModerate) {
    cap("emerging", "Contradicting evidence is too substantial for a confident read.");
  } else if (contradictionRatio > CONFIDENCE_POLICY.contradictionCapsEstablished) {
    cap("moderate", "Some contradicting evidence prevents a settled conclusion.");
  }
  if (input.missingCriticalContext.length > 0) {
    cap("moderate", "Critical context is missing, so this cannot be treated as settled.");
  }

  return {
    confidence,
    score,
    supportingReasons: supporting,
    limitingReasons: limiting,
  };
}

/* ─── Aggregate confidence ────────────────────────────────────────────── */

/** The model's overall confidence — the best domain, never an average that
    flatters thin evidence into looking substantial. */
export function overallConfidence(domainConfidences: ResponseConfidence[]): ResponseConfidence {
  if (domainConfidences.length === 0) return "insufficient";
  const established = domainConfidences.filter((c) => c === "established").length;
  const moderate = domainConfidences.filter((c) => c === "moderate").length;
  const emerging = domainConfidences.filter((c) => c === "emerging").length;
  // "Established" overall requires more than one settled domain — a single
  // well-evidenced muscle does not mean Reserve understands the athlete.
  if (established >= 2) return "established";
  if (established >= 1 || moderate >= 2) return "moderate";
  if (moderate >= 1 || emerging >= 2) return "emerging";
  return "insufficient";
}

export const CONFIDENCE_LABEL: Record<ResponseConfidence, string> = {
  insufficient: "Insufficient",
  emerging: "Emerging",
  moderate: "Moderate",
  established: "Established",
};
