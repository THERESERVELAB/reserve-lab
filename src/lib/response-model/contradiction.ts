/* ════════════════════════════════════════════════════════════════════════
   CONTRADICTION — a first-class concept, not an error state.

   New contradictory evidence never erases old evidence. It changes what
   Reserve is willing to conclude and act on.

   The critical distinction this module makes: evidence that differs because
   the CONTEXT materially changed is not a contradiction. An athlete who
   tolerates high chest volume in a surplus and not in a late deficit has not
   contradicted themselves — they have shown a phase-specific response, and
   the correct outcome is supersession by a phase-specific insight, not a
   conflict that blocks all action.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  ContradictionEffect,
  ResponseContradictionAssessment,
  ResponseInsight,
} from "./types";

/** The context an observation was made in. Differences here can explain away
    an apparent contradiction. */
export type ObservationContext = {
  phaseId?: string;
  nutritionPhase?: string;
  /** Set when the exercise setup materially changed (variation, unilateral). */
  setupKey?: string;
};

export type ContradictionInput = {
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  /** Context of the supporting evidence. */
  supportingContext: ObservationContext;
  /** Context of the contradicting evidence. */
  contradictingContext: ObservationContext;
  /** Current confidence of the insight being challenged. */
  currentConfidence: "insufficient" | "emerging" | "moderate" | "established";
};

/**
 * True when the two bodies of evidence sit in materially different contexts,
 * which means they describe two situations rather than disagreeing about one.
 */
export function contextMateriallyDiffers(a: ObservationContext, b: ObservationContext): boolean {
  if (a.nutritionPhase && b.nutritionPhase && a.nutritionPhase !== b.nutritionPhase) return true;
  if (a.phaseId && b.phaseId && a.phaseId !== b.phaseId) return true;
  if (a.setupKey && b.setupKey && a.setupKey !== b.setupKey) return true;
  return false;
}

export function assessContradiction(input: ContradictionInput): ResponseContradictionAssessment {
  const supporting = [...new Set(input.supportingEvidenceIds)];
  const contradicting = [...new Set(input.contradictingEvidenceIds)];
  const total = supporting.length + contradicting.length;
  const ratio = total > 0 ? Math.round((contradicting.length / total) * 100) / 100 : 0;

  if (contradicting.length === 0) {
    return {
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: [],
      contradictionRatio: 0,
      effect: "none",
      explanation: "No contradicting evidence has been recorded.",
    };
  }

  // Context change is checked BEFORE ratio: a phase-specific difference is not
  // a disagreement, however large it looks.
  if (contextMateriallyDiffers(input.supportingContext, input.contradictingContext)) {
    return {
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: contradicting,
      contradictionRatio: ratio,
      effect: "supersedes-insight",
      explanation:
        "The differing evidence comes from a materially different context, so Reserve reads it as a separate phase-specific response rather than a contradiction. The earlier pattern is kept for the context it was observed in.",
    };
  }

  let effect: ContradictionEffect;
  let explanation: string;

  // These counts are EVIDENCE RECORDS, not observations — a single exposure
  // produces many records. Calling them observations overstates the sample by
  // an order of magnitude to anyone reading it.
  const share = `${Math.round(ratio * 100)}% of the evidence`;

  if (ratio >= 0.5) {
    effect = "conflicts-insight";
    explanation = `Contradicting evidence now matches or outweighs the supporting evidence. Reserve will not act on this pattern until it resolves.`;
  } else if (ratio >= 0.3) {
    effect = "weakens-insight";
    explanation = `${share} points the other way, which weakens the pattern without overturning it.`;
  } else if (ratio > 0.15) {
    effect = "limits-confidence";
    explanation = `${share} differs, which caps how confident Reserve can be.`;
  } else {
    effect = "limits-confidence";
    explanation = `A small amount of contradicting evidence remains part of the picture.`;
  }

  return {
    supportingEvidenceIds: supporting,
    contradictingEvidenceIds: contradicting,
    contradictionRatio: ratio,
    effect,
    explanation,
  };
}

/** A conflicted insight can never drive a material automatic revision. */
export function blocksMaterialAction(insight: ResponseInsight): boolean {
  return insight.status === "conflicted" || insight.status === "insufficient";
}
