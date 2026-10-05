/* ════════════════════════════════════════════════════════════════════════
   LEG EMPHASIS — what a Legs day leads with.

   A Legs day can lead with the front of the legs (quads), the back
   (hamstrings and glutes), or train them completely. Reserve decides:

     1. Legs is the week's only lower session → complete legs. A weak point
        then rides inside the session instead of skipping half the leg.
     2. The member flagged a lower-body weak point → Legs leads with it.
     3. Otherwise → front one week, posterior the next, so both halves get a
        lead session while the Lower day keeps training the whole lower body.

   Pure and deterministic.
   ════════════════════════════════════════════════════════════════════════ */

import type { SessionArchetype } from "./split-blueprints";

export type LegEmphasis = "front" | "posterior" | "full";

export function chooseLegEmphasis(input: {
  /** Another training day this week already trains the whole lower body (Lower, Posterior Legs…). */
  hasLowerDay: boolean;
  weekNumber?: number | null;
  musclePriority?: readonly string[] | null;
}): LegEmphasis {
  if (!input.hasLowerDay) return "full";
  const priorities = (input.musclePriority ?? []).map((p) => p.toLowerCase());
  if (priorities.some((p) => /glute|hamstring|posterior/.test(p))) return "posterior";
  if (priorities.some((p) => /quad/.test(p))) return "front";
  const week = Math.max(1, Math.round(input.weekNumber ?? 1));
  return week % 2 === 1 ? "front" : "posterior";
}

/** The authored template each lead loads. Complete legs keeps the Legs template. */
export const LEG_EMPHASIS_ARCHETYPE: Record<Exclude<LegEmphasis, "full">, SessionArchetype> = {
  front: "quad-focus",
  posterior: "hamstring-glute",
};

/* Copy describes what each template actually trains: the quad session is
   knee-dominant work only, the posterior session is hinge and curl work with
   glutes supporting. The week's Lower day covers the rest. */
export const LEG_EMPHASIS_GOAL: Record<LegEmphasis, string> = {
  front: "Front-led legs — quads lead the session",
  posterior: "Posterior-led legs — hamstrings and glutes lead the session",
  full: "Complete legs — quads, hamstrings, glutes and calves",
};

export const LEG_EMPHASIS_MUSCLES: Record<LegEmphasis, string[]> = {
  front: ["Quads"],
  posterior: ["Hamstrings", "Glutes"],
  full: ["Quads", "Hamstrings", "Glutes", "Calves"],
};
