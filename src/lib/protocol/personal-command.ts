/* ════════════════════════════════════════════════════════════════════════
   PERSONAL COMMAND — the small decisions the screen makes about the member.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { calendarDateLabel } from "@/lib/dates/local-day";

/**
 * The women's physique architecture (Runway, Summit…) is shown to
 * a female member only. It used to open for anyone with the women's module
 * switched on, including a member whose profile sets no sex, which assumed a
 * body from a setting. Sex or gender identity must say female.
 */
export function showsWomensArchitecture(input: {
  genderIdentity?: string | null;
  sex?: string | null;
}): boolean {
  return (input.genderIdentity ?? "").toLowerCase() === "female" || (input.sex ?? "").toLowerCase() === "female";
}

/* ─── The chooser ──────────────────────────────────────────────────────── */

export type ChooserStep = "goal" | "activities" | "focus" | "protocol" | "confirm";

/** The steps the member can move between. "confirm" is reached by picking a protocol, never from the step list. */
export const CHOOSER_STEPS: ReadonlyArray<{ step: Exclude<ChooserStep, "confirm">; label: string }> = [
  { step: "goal", label: "Goal" },
  { step: "activities", label: "Activities" },
  { step: "focus", label: "Focus" },
  { step: "protocol", label: "Protocol" },
];

/** Next and back, in step order. Confirm goes back to the protocol list. */
export function adjacentChooserStep(step: ChooserStep, direction: "next" | "back"): ChooserStep | null {
  if (step === "confirm") return direction === "back" ? "protocol" : null;
  const i = CHOOSER_STEPS.findIndex((s) => s.step === step);
  const j = direction === "next" ? i + 1 : i - 1;
  return CHOOSER_STEPS[j]?.step ?? null;
}

/**
 * Where the chooser opens. Activating a named protocol lands on its
 * confirmation; browsing the library lands on the list; the hero's
 * "Choose Your Protocol" starts at the member's goal.
 */
export function chooserStartStep(input: { protocolId?: string | null; browse?: boolean }): ChooserStep {
  if (input.protocolId) return "confirm";
  if (input.browse) return "protocol";
  return "goal";
}

/* ─── What Reserve still does not have ─────────────────────────────────── */

/**
 * One row in place of a 405-character paragraph listing every missing field:
 * the count of fields the recommendation is working without. It no longer sits
 * beside the command profile's percent — the two are different measures, and
 * "Profile 80% · 14 inputs missing" read as a contradiction.
 */
export function profileInputsLine(input: { missingCount: number }): string {
  if (input.missingCount <= 0) return "Nothing missing";
  return `${input.missingCount} input${input.missingCount === 1 ? "" : "s"} missing`;
}

/* ─── The block's rows ─────────────────────────────────────────────────── */

const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A stored YYYY-MM-DD target, read as the calendar day it names (never shifted by time zone). */
export function targetDateLabel(isoDate: string | null | undefined, eventName?: string | null): string {
  const date = calendarDateLabel(isoDate);
  if (!date) return "Not set";
  return eventName?.trim() ? `${eventName.trim()} · ${date}` : date;
}

/** The week the member trains: their chosen split and rest days, or the program's own mix. */
export function weekLine(input: {
  split: { name: string; restDays: number[] } | null;
  trainingDays: number;
  cardioDays: number;
  mobilityDays: number;
  checkInCadence: string;
}): string {
  if (input.split) {
    const rest = input.split.restDays.map((i) => WEEKDAYS_SHORT[i]).filter(Boolean);
    return rest.length ? `${input.split.name} · rest ${rest.join(", ")}` : input.split.name;
  }
  return `${input.trainingDays} train · ${input.cardioDays} cardio · ${input.mobilityDays} mobility · ${input.checkInCadence.toLowerCase()} check-in`;
}
