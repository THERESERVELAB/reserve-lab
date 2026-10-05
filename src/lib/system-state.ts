/* ════════════════════════════════════════════════════════════════════════
   RESERVE SYSTEM STATE — who owns a deficiency, and where it appears.

   THE PROBLEM THIS SOLVES

   "Program Horizon Required" originated in three places but reached the
   member five or more times on a single screen — in the hero, in all seven
   weekday cards, and again in Split Command — because nothing decided WHERE
   a system limitation belonged. Every component that received the string
   rendered it, at equal weight. One missing program read as a broken product.

   TWO PIECES, DELIBERATELY NOT ONE

   `resolveSystemState()` owns the BLOCKING banner: the single highest-priority
   thing standing between the member and a usable day. One state, rendered
   once, at the top of the screen. This is what stops the repetition.

   `deficiencyCopy()` owns the WORDING of a per-metric gap, and is called
   LOCALLY by whichever surface needs it. It is intentionally not centralised
   into a single renderer — a hint about missing readiness belongs beside
   readiness, not hoisted into a banner. Centralising it would trade one
   failure (the same sentence five times) for a worse one (the hint nowhere
   near the thing it explains).

   The rule: a BLOCKING state appears once, at the top. A PRECISION LIMIT
   appears beside the metric it limits, quietly, and never as an alarm.
   ════════════════════════════════════════════════════════════════════════ */

import type { DashboardView } from "@/lib/athlete-store";

/* ─── Blocking states ─────────────────────────────────────────────────── */

export type SystemStateId = "program-unconfirmed" | "setup-incomplete";

export type SystemState = {
  id: SystemStateId;
  /** Whisper label. Names the state, does not describe it. */
  label: string;
  /** One sentence. What is true, in the member's terms — never in system terms. */
  headline: string;
  /** The single action that clears this state. */
  actionLabel: string;
  actionTarget: DashboardView | null;
};

export type SystemStateInput = {
  /**
   * True when the week resolved to the explicit fallback — no executable
   * Program Horizon and no member-authored program. Reserve deliberately does
   * not substitute a generic workout, so this is a real blocking state rather
   * than a cosmetic gap.
   */
  programUnconfirmed: boolean;
  /** Outstanding profile-setup gaps. Sharpens estimates; does not block. */
  setupGapCount: number;
  setupTotal: number;
};

/**
 * The ONE state to surface, or null when nothing needs saying.
 *
 * Returning a single value rather than a list is the entire point: a page
 * cannot stack four banners if the resolver can only ever hand it one.
 *
 * Order is by what most blocks the member's day. A missing program stops
 * Reserve planning the week at all, so it outranks profile gaps — which only
 * sharpen estimates that already work. Before this existed, both rendered
 * simultaneously as two near-identical "Setup" notices, which is the same
 * repetition disease one level up.
 */
export function resolveSystemState(input: SystemStateInput): SystemState | null {
  if (input.programUnconfirmed) {
    return {
      id: "program-unconfirmed",
      label: "Program",
      /* "Needs confirmation", not "Required" / "Missing" / "Error". The
         member has not done anything wrong, and Reserve is not broken — it is
         declining to invent a program it does not have. */
      headline: "Your program needs confirmation before Reserve can plan the week.",
      actionLabel: "Choose a program",
      actionTarget: "protocol-command",
    };
  }

  if (input.setupGapCount > 0) {
    return {
      id: "setup-incomplete",
      label: `Setup · ${input.setupTotal - input.setupGapCount} of ${input.setupTotal}`,
      headline: "A few more details sharpen every estimate Reserve makes.",
      actionLabel: "Finish setup",
      /* Opens the setup overlay rather than navigating, so the caller owns
         the action. */
      actionTarget: null,
    };
  }

  return null;
}

/* ─── Per-metric precision limits ─────────────────────────────────────── */

export type DeficiencyMetric =
  | "readiness"
  | "recovery"
  | "sleep"
  | "physique"
  | "hydration"
  | "nutrition";

/**
 * Canonical wording for "this reading would sharpen with more evidence".
 *
 * Called at the point of use so the hint sits beside its metric. The wording
 * is centralised; the RENDERING is not.
 *
 * Deliberately never returns a number, a range, or a judgement — an absent
 * reading names the action that would produce it and nothing else (Bible §12:
 * fabricated certainty is the cheapest thing software can do).
 */
export function deficiencyCopy(metric: DeficiencyMetric): {
  value: string;
  hint: string;
} {
  switch (metric) {
    case "readiness":
      return { value: "Not logged", hint: "Add today's check-in to sharpen this" };
    case "recovery":
      return { value: "Not logged", hint: "Log sleep and soreness to sharpen this" };
    case "sleep":
      return { value: "Not logged", hint: "Log last night to sharpen this" };
    case "physique":
      return { value: "No check-in", hint: "Add a check-in to start the trend" };
    case "hydration":
      return { value: "Not logged", hint: "Log intake to sharpen this" };
    case "nutrition":
      return { value: "Not logged", hint: "Confirm a meal to sharpen this" };
  }
}
