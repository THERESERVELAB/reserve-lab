/* ════════════════════════════════════════════════════════════════════════
   EXPLAINABLE RECOMMENDATION SCORING — one core for movements, schedules,
   and (later) meals and plans.

   Candidates are scored on weighted factors; every factor that moves the
   score carries a plain-language reason or tradeoff. Raw scores stay
   INTERNAL — the member sees ranked categories and reasons, never fake
   precision ("92.7% optimal" is banned by design).
   ════════════════════════════════════════════════════════════════════════ */

import {
  type RankedRecommendation,
  type RecommendationCategory,
  lifestyleId,
} from "./types";

export type ScoreFactor = {
  label: string;
  /** Relative importance of this factor (typical 0.5–3). */
  weight: number;
  /** Fit on this factor: 0 = conflicts, 0.5 = neutral, 1 = ideal. */
  score: number;
  /** Shown when this factor helps the candidate (score >= 0.65). */
  reason?: string;
  /** Shown when this factor hurts the candidate (score <= 0.35). */
  tradeoff?: string;
  /** A hard disqualifier for TODAY (pain conflict, no equipment) — caps the
      candidate at avoid-today regardless of other strengths. */
  veto?: boolean;
};

export type ScoredCandidate = {
  /** Weighted 0..1 — internal ordering only, never displayed. */
  score: number;
  vetoed: boolean;
  reasons: string[];
  tradeoffs: string[];
};

export function scoreCandidate(factors: ScoreFactor[]): ScoredCandidate {
  let weightSum = 0;
  let weighted = 0;
  let vetoed = false;
  const reasons: string[] = [];
  const tradeoffs: string[] = [];

  for (const f of factors) {
    weightSum += f.weight;
    weighted += f.weight * Math.min(1, Math.max(0, f.score));
    if (f.veto) vetoed = true;
    if (f.reason && f.score >= 0.65) reasons.push(f.reason);
    if (f.tradeoff && f.score <= 0.35) tradeoffs.push(f.tradeoff);
  }

  return {
    score: weightSum > 0 ? weighted / weightSum : 0.5,
    vetoed,
    reasons,
    tradeoffs,
  };
}

/** Absolute floor — a weak option is labeled weak even when it leads. */
export function categoryFor(scored: ScoredCandidate): RecommendationCategory {
  if (scored.vetoed) return "avoid-today";
  if (scored.score >= 0.72) return "best-fit";
  if (scored.score >= 0.6) return "strong-alternative";
  if (scored.score >= 0.5) return "specialized";
  if (scored.score >= 0.38) return "limited-fit";
  return "avoid-today";
}

const CATEGORY_ORDER: RecommendationCategory[] = [
  "best-fit", "strong-alternative", "specialized", "limited-fit", "avoid-today",
];

/** Order candidates, assign ranks + categories, keep reasons/tradeoffs.
    Categories are RELATIVE to the leading option (gap-based demotion) and
    capped by the absolute floor, so a list never reads as ten identical
    "best fits" — and Reserve never pretends a weak leader is ideal. */
export function rankCandidates<T>(
  entries: Array<{ candidate: T; scored: ScoredCandidate }>,
): RankedRecommendation<T>[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.scored.vetoed !== b.scored.vetoed) return a.scored.vetoed ? 1 : -1;
    return b.scored.score - a.scored.score;
  });
  const leader = sorted.find((e) => !e.scored.vetoed)?.scored.score ?? 0;

  return sorted.map((e, i) => {
    const absolute = categoryFor(e.scored);
    const gap = leader - e.scored.score;
    const relative: RecommendationCategory =
      e.scored.vetoed ? "avoid-today"
      : gap <= 0.03 ? "best-fit"
      : gap <= 0.08 ? "strong-alternative"
      : gap <= 0.15 ? "specialized"
      : gap <= 0.24 ? "limited-fit"
      : "avoid-today";
    // The weaker of the two labels wins — relative spread AND absolute floor.
    const category = CATEGORY_ORDER[Math.max(CATEGORY_ORDER.indexOf(absolute), CATEGORY_ORDER.indexOf(relative))];
    return {
      id: lifestyleId("rec"),
      candidate: e.candidate,
      rank: i + 1,
      category,
      reasons: e.scored.reasons,
      tradeoffs: e.scored.tradeoffs,
    };
  });
}
