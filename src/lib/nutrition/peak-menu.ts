/* ════════════════════════════════════════════════════════════════════════
   THE WEEK'S MENU — Reserve proposes, the member picks.

   A private chef does not hand over a fixed week. They bring a short menu for
   each meal — what suits the day, what fits the plan — and the client says
   what they want to eat. That is all this is: for every meal of the next
   seven days, a few plates worth eating, the member's own meals first, and
   whichever one they choose saved against that day.

   Nothing here decides for the member. When they choose nothing, the day runs
   on Reserve's own pick, exactly as it did before.
   ════════════════════════════════════════════════════════════════════════ */

import type { PeakMeal } from "./peak-mode";
import { isBowlPlateId } from "./peak-bowls";

/** One plate offered for a meal. `mine` marks a meal the member built themselves. */
export type MenuChoice = {
  id: string;
  name: string;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  match: number;
  mine: boolean;
  /** True for the plate currently on the plan for that meal. */
  current: boolean;
};

/** How many plates a menu offers per meal before it becomes a catalogue. */
export const MENU_CHOICES = 3;

type SwapOption = { id: string; name: string; macros: MenuChoice["macros"]; match: number; current: boolean };

/**
 * The shortlist for one meal: the plate on the plan, the member's own meals,
 * then the closest matches — never more than `limit`, never a duplicate.
 */
export function menuChoices(options: readonly SwapOption[], limit = MENU_CHOICES): MenuChoice[] {
  const decorated = options.map((o) => ({ ...o, mine: isBowlPlateId(o.id) }));
  const rank = (o: (typeof decorated)[number]) => (o.current ? 0 : o.mine ? 1 : 2);
  const ordered = [...decorated].sort((a, b) => rank(a) - rank(b) || b.match - a.match || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const out: MenuChoice[] = [];
  for (const o of ordered) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({ id: o.id, name: o.name, macros: o.macros, match: o.match, mine: o.mine, current: o.current });
    if (out.length >= limit) break;
  }
  return out;
}

export type MenuMeal = { key: string; label: string; time: string | null; slot: PeakMeal["slot"]; choices: MenuChoice[] };
export type MenuDay = { date: string; weekday: string; training: boolean; sessionName: string; meals: MenuMeal[] };

/** How much of the week the member has chosen themselves. */
export function menuProgress(days: readonly MenuDay[], swaps: Record<string, Record<string, string>> | undefined): { picked: number; total: number } {
  let picked = 0;
  let total = 0;
  for (const day of days) {
    for (const meal of day.meals) {
      total += 1;
      if (swaps?.[day.date]?.[meal.key]) picked += 1;
    }
  }
  return { picked, total };
}

/**
 * The same plate on the same meal every day of the week — the daily rotation a
 * member already eats, without choosing it seven times.
 */
export function repeatAcrossWeek(
  swaps: Record<string, Record<string, string>> | undefined,
  days: readonly { date: string }[],
  mealKey: string,
  plateId: string,
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...(swaps ?? {}) };
  for (const day of days) next[day.date] = { ...(next[day.date] ?? {}), [mealKey]: plateId };
  return next;
}

/** Hand the week back to Reserve: the member's picks for these days are dropped. */
export function clearWeek(
  swaps: Record<string, Record<string, string>> | undefined,
  days: readonly { date: string }[],
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...(swaps ?? {}) };
  for (const day of days) delete next[day.date];
  return next;
}

/** One pick, saved against its own day. */
export function pickOne(
  swaps: Record<string, Record<string, string>> | undefined,
  date: string,
  mealKey: string,
  plateId: string,
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...(swaps ?? {}) };
  next[date] = { ...(next[date] ?? {}), [mealKey]: plateId };
  return next;
}

/* ─── Surprise me ───────────────────────────────────────────────────────── */

/**
 * The chef's pick for the whole week: one plate per meal, chosen for variety
 * rather than for the highest match, so a week does not become the same plate
 * seven times. A meal the member built is left exactly where they put it, and
 * a meal they already chose themselves is never overwritten.
 *
 * Deterministic for a given seed, so the same week can be rebuilt and tested.
 */
export function surpriseWeek(
  days: readonly MenuDay[],
  swaps: Record<string, Record<string, string>> | undefined,
  seed = 0,
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...(swaps ?? {}) };
  /* How many times each plate has already been handed out this week. */
  const served = new Map<string, number>();
  for (const day of days) {
    for (const meal of day.meals) {
      if (meal.choices.length === 0) continue;
      const already = next[day.date]?.[meal.key];
      if (already) {
        served.set(already, (served.get(already) ?? 0) + 1);
        continue;
      }
      /* Least served first; ties go to the better match, then to a stable rotation. */
      const ordered = [...meal.choices].sort((a, b) => {
        const byServed = (served.get(a.id) ?? 0) - (served.get(b.id) ?? 0);
        return byServed !== 0 ? byServed : b.match - a.match || a.id.localeCompare(b.id);
      });
      const pick = ordered[(seed + served.size) % Math.min(ordered.length, 2)] ?? ordered[0];
      next[day.date] = { ...(next[day.date] ?? {}), [meal.key]: pick.id };
      served.set(pick.id, (served.get(pick.id) ?? 0) + 1);
    }
  }
  return next;
}
