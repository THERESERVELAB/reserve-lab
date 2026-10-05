/* ════════════════════════════════════════════════════════════════════════
   REQUIREMENTS — what a cockpit needs before it can read anything.

   Reserve's higher-tier screens were measured with a real Reserve Black
   member and no data: Physique Cockpit 770 characters and one button,
   Biomarker Cockpit 784 and one, Peak Physique 810 and one. Each printed a
   single "waiting for data" sentence and offered no way in. A member who
   pays for the floor with the separate elevator key arrived to an empty
   room.

   The fix is not a preview and not sample data — both would be fabrication
   (Bible §12). It is to make the requirement list itself the content: name
   what the cockpit needs, show real progress toward each line, and point
   the one gold action at the first thing that is missing.

   Every number here is a count of the member's own entries. `have` never
   comes from anywhere but their logs.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type Requirement = {
  id: string;
  /** What the member has to do, named as a thing. "Photo check-ins". */
  label: string;
  /** How many of these the member has logged. Their own count, never a guess. */
  have: number;
  /** How many this cockpit needs before it can read anything from them. */
  need: number;
  /** Plural noun for the progress line: "photo check-ins", "lab panel". */
  noun: string;
  /** One line: what this requirement unlocks, in plain language. */
  detail: string;
  /** The words on the control that starts it. Describes the consequence. */
  action: string;
  /** Where that control lands — the real logger, never a marketing page. */
  view: string;
};

export function isMet(requirement: Requirement): boolean {
  return requirement.have >= requirement.need;
}

/** "1 of 3 photo check-ins" — real progress, in the member's own numbers. */
export function progressLabel(requirement: Requirement): string {
  return `${Math.min(requirement.have, requirement.need)} of ${requirement.need} ${requirement.noun}`;
}

/** 0–1 through this requirement. Used for a bar that can never overfill. */
export function progressFraction(requirement: Requirement): number {
  if (requirement.need <= 0) return 1;
  return Math.max(0, Math.min(1, requirement.have / requirement.need));
}

/**
 * The first requirement still missing, in the order the caller listed them —
 * the order is the sequence a member should actually work through.
 */
export function firstUnmet(requirements: readonly Requirement[]): Requirement | null {
  return requirements.find((requirement) => !isMet(requirement)) ?? null;
}

export function metCount(requirements: readonly Requirement[]): number {
  return requirements.filter(isMet).length;
}

export function allMet(requirements: readonly Requirement[]): boolean {
  return requirements.length > 0 && requirements.every(isMet);
}

/** "2 of 3 ready" — the honest headline for a cockpit that is partly fed. */
export function readinessLine(requirements: readonly Requirement[]): string {
  const met = metCount(requirements);
  if (requirements.length === 0) return "Nothing required";
  if (met === 0) return `Evidence needed · 0 of ${requirements.length} ready`;
  if (met === requirements.length) return `All ${requirements.length} ready`;
  return `${met} of ${requirements.length} ready`;
}

/**
 * The statement a cockpit leads with. Honest at every stage: nothing logged,
 * partly logged, or reading.
 */
export function requirementStatement(requirements: readonly Requirement[], reading: string): string {
  const met = metCount(requirements);
  if (met === 0) return "Nothing logged yet";
  if (met < requirements.length) return `${met} of ${requirements.length} ready`;
  return reading;
}
