/* ════════════════════════════════════════════════════════════════════════
   ARCHITECTURE SELECTION — the coach brain.

   Ranks the protocol architectures against the WHOLE athlete profile (goal,
   frequency, session length, recovery, experience, weak points, environment,
   occupation, injury) and returns the chosen architecture plus an
   explainability trace: the traits that drove the pick and the single trait
   that disqualified each rejected alternative.

   Reuses the library's scoreProtocol (one scorer, no fork). Pure and
   deterministic. Coaching/organization support only — no medical content.
   ════════════════════════════════════════════════════════════════════════ */

import {
  PROTOCOL_LIBRARY,
  scoreProtocol,
  type ProtocolDefinition,
  type ProtocolRecoInput,
} from "@/lib/protocol/library";
import {
  architectureFingerprint,
  type ArchitectureFingerprint,
  type ScoreFactor,
} from "./architecture-profile";

export type ArchitectureSelection = {
  chosen: ProtocolDefinition;
  fingerprint: ArchitectureFingerprint;
  /** Up to two next-best complete architectures. */
  alternatives: ProtocolDefinition[];
  /** Why the strongest runners-up were not chosen (one trait each). */
  rejected: Array<{ id: string; name: string; reason: string }>;
  /** Top positive traits behind the choice (labels). */
  drivers: string[];
  /** One concise, honest sentence. No guarantees. */
  rationale: string;
  score: number;
};

function isSelectable(d: ProtocolDefinition, goal: string): boolean {
  if (d.logOnly && !/log|organi|enhanced/.test(goal)) return false;
  if (d.category === "fertility-lifestyle" || d.category === "pregnancy-lifestyle") return false;
  return true;
}

function topDriverLabels(factors: ScoreFactor[], n: number): string[] {
  return factors
    .filter((f) => f.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, n)
    .map((f) => f.label);
}

function rejectionReason(factors: ScoreFactor[], chosenName: string): string {
  const worst = factors
    .filter((f) => f.delta < 0)
    .sort((a, b) => a.delta - b.delta)[0];
  return worst ? worst.label : `Lower overall fit than ${chosenName}`;
}

/**
 * Select the best-fitting architecture for a profile, with rationale.
 * `pool` lets callers (and tests) restrict the candidate set; defaults to the
 * full library minus log-only/lifestyle-gated protocols.
 */
export function selectArchitecture(
  input: ProtocolRecoInput,
  opts: { pool?: ProtocolDefinition[] } = {},
): ArchitectureSelection {
  const goal = (input.goal || "").toLowerCase();
  const female = input.womensPath || (input.genderIdentity || "").toLowerCase() === "female";

  const pool = (opts.pool ?? PROTOCOL_LIBRARY).filter((d) => isSelectable(d, goal));
  const scored = pool
    .map((d) => ({ d, ...scoreProtocol(d, input) }))
    .sort((a, b) => b.score - a.score);

  // Female members lead with a women's-performance architecture (mirrors the
  // recommender's guarantee) so a mis-scored goal never defaults to a male split.
  let ranked = scored;
  if (female && scored[0] && scored[0].d.category !== "womens-performance") {
    const womensIdx = scored.findIndex((x) => x.d.category === "womens-performance");
    if (womensIdx > 0) {
      const [w] = scored.splice(womensIdx, 1);
      ranked = [w, ...scored];
    }
  }

  const top = ranked[0];
  const chosen = top.d;
  const alternatives = ranked.slice(1, 3).map((x) => x.d);
  const rejected = ranked.slice(1, 4).map((x) => ({
    id: x.d.id,
    name: x.d.name,
    reason: rejectionReason(x.factors, chosen.name),
  }));
  const drivers = topDriverLabels(top.factors, 3);
  const days = input.trainingDaysPerWeek;
  const rationale =
    `${chosen.name} — chosen for ${drivers.length ? drivers.map((d) => d.toLowerCase()).join(", ") : "your goal and profile"}` +
    (days ? ` at ${days} training day${days === 1 ? "" : "s"}.` : ".");

  return {
    chosen,
    fingerprint: architectureFingerprint(chosen),
    alternatives,
    rejected,
    drivers,
    rationale,
    score: top.score,
  };
}
