/* ════════════════════════════════════════════════════════════════════════
   WOMEN'S SLICE — the sample values that used to seed a new member.

   DEFAULT_WOMENS_STATE once shipped a recovery reserve of 82, seven "recent"
   recovery scores, four habit adherences and seven nutrition adherences. No
   action ever replaced them, and the "womens" slice persists and syncs, so a
   member's saved state can still carry them as if they were logged.

   `clearUntouchedWomensSample` removes them ONLY where they still equal the
   exact shipped sample — anything a member changed is left alone. It is pure
   and idempotent, so it runs on every rehydrate (local and cloud).
   ════════════════════════════════════════════════════════════════════════ */

import type { WomensRecoveryHabit, WomensState } from "./types";

export const LEGACY_WOMENS_SAMPLE = {
  nutritionRecentAdherence: [88, 90, 92, 89, 91, 93, 91],
  recoveryReserve: 82,
  recoveryRecentScores: [78, 80, 79, 83, 81, 84, 82],
  recoveryHabits: [
    { id: "sleep", label: "Sleep ≥ 8h", adherence: 84, direction: "helping" },
    { id: "walking", label: "Daily walking", adherence: 76, direction: "helping" },
    { id: "mobility", label: "Mobility flow", adherence: 61, direction: "watch" },
    { id: "stress", label: "Stress downshift", adherence: 58, direction: "hurting" },
  ] satisfies WomensRecoveryHabit[],
} as const;

const sameNumbers = (a: unknown, b: readonly number[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((value, i) => value === b[i]);

const sameHabits = (a: unknown, b: readonly WomensRecoveryHabit[]): boolean =>
  Array.isArray(a) &&
  a.length === b.length &&
  a.every((habit, i) => {
    const h = habit as Partial<WomensRecoveryHabit> | null;
    return Boolean(h) && h!.id === b[i].id && h!.label === b[i].label && h!.adherence === b[i].adherence && h!.direction === b[i].direction;
  });

/**
 * Two defaults that read as the member's own choices:
 *   · Fertility shipped with five focus areas preselected, which fed a
 *     "Fertility Readiness Score" of 71 before the member chose anything.
 *   · Pregnancy shipped with "first-trimester" as the stage.
 * Both are cleared only while the module has never been switched on — a
 * member could not have chosen either value without turning it on first.
 */
export const LEGACY_WOMENS_DEFAULTS = {
  fertilityFocusAreas: ["hydration", "nutrition", "recovery", "sleep", "stress"],
  pregnancyStage: "first-trimester",
} as const;

type WomensLike = {
  nutrition?: Partial<WomensState["nutrition"]>;
  recovery?: Partial<WomensState["recovery"]>;
  fertility?: Partial<WomensState["fertility"]>;
  pregnancy?: Partial<Omit<WomensState["pregnancy"], "stage">> & { stage?: string | null };
};

const sameStrings = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((value, i) => value === b[i]);

/** Clears the shipped sample from a saved women's slice. Returns the same object when nothing matched. */
export function clearUntouchedWomensSample<T extends WomensLike>(womens: T): T {
  let next = womens;
  const nutrition = womens.nutrition;
  if (nutrition && sameNumbers(nutrition.recentAdherence, LEGACY_WOMENS_SAMPLE.nutritionRecentAdherence)) {
    next = { ...next, nutrition: { ...nutrition, recentAdherence: [] } };
  }
  const recovery = womens.recovery;
  if (
    recovery &&
    recovery.reserve === LEGACY_WOMENS_SAMPLE.recoveryReserve &&
    sameNumbers(recovery.recentScores, LEGACY_WOMENS_SAMPLE.recoveryRecentScores) &&
    sameHabits(recovery.habits, LEGACY_WOMENS_SAMPLE.recoveryHabits)
  ) {
    next = { ...next, recovery: { ...recovery, reserve: null, recentScores: [], habits: [] } };
  }
  const fertility = womens.fertility;
  if (fertility && fertility.enabled !== true && sameStrings(fertility.focusAreas, LEGACY_WOMENS_DEFAULTS.fertilityFocusAreas)) {
    next = { ...next, fertility: { ...fertility, focusAreas: [] } };
  }
  const pregnancy = womens.pregnancy;
  if (pregnancy && pregnancy.enabled !== true && pregnancy.stage === LEGACY_WOMENS_DEFAULTS.pregnancyStage) {
    next = { ...next, pregnancy: { ...pregnancy, stage: null } };
  }
  return next;
}
