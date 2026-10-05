/* ════════════════════════════════════════════════════════════════════════
   PROGRAM HORIZON / MESOCYCLE PRIMARY ACTION — the one gold action on the
   two screens that show the projected block.

   Both screens let the member read any week of the block, so both have the
   same two honest states: you are reading a week that is not the live one,
   or you are on the live one. What differs is only what the live week
   offers — the Horizon can change it, the Planner points at the screen that
   can.

     0. no program           → choose a protocol (there is nothing to project)
     1. reading another week → come back to the week that is running
     2. on the live week     → change it (Horizon) / open it (Planner)

   Projections stay labelled as projections by the screen; this module never
   claims a future week is a fact. Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type HorizonPrimaryAction =
  | { kind: "choose-protocol"; label: string }
  | { kind: "return-to-current-week"; label: string }
  | { kind: "adjust-day"; label: string }
  | { kind: "open-program-horizon"; label: string };

export type HorizonPrimaryPlan = {
  /** The member's current state on this screen, in one plain sentence. */
  statement: string;
  title: string;
  reason: string;
  primary: HorizonPrimaryAction;
};

export type HorizonPrimaryInput = {
  /** False when no protocol is active — there is no projected block at all. */
  hasHorizon: boolean;
  protocolName: string | null;
  totalWeeks: number;
  /** The week that is actually running. */
  currentWeek: number;
  /** The week the member is reading. Equal to `currentWeek` by default. */
  viewingWeek: number;
  /** The phase the current week sits in, when the block names one. */
  phaseName: string | null;
};

const NO_PROGRAM: HorizonPrimaryPlan = {
  statement: "No program is active yet.",
  title: "Choose a protocol to project your block",
  reason:
    "Reserve projects every week of a block from the protocol you choose. Until there is one, there is nothing to project.",
  primary: { kind: "choose-protocol", label: "Choose Your Protocol" },
};

function liveStatement(input: HorizonPrimaryInput): string {
  const name = input.protocolName?.trim();
  const phase = input.phaseName?.trim();
  const week =
    input.totalWeeks > 0
      ? `Week ${input.currentWeek} of ${input.totalWeeks}`
      : `Week ${input.currentWeek}`;
  const on = name ? ` on ${name}` : "";
  const inPhase = phase ? ` · ${phase}` : "";
  return `${week}${on}${inPhase}.`;
}

function readingAnotherWeek(input: HorizonPrimaryInput): HorizonPrimaryPlan {
  return {
    statement: liveStatement(input),
    title: `You are reading week ${input.viewingWeek}`,
    reason: `Week ${input.currentWeek} is the one running now. Every later week is a projection and changes as your weeks do.`,
    primary: { kind: "return-to-current-week", label: "Return to This Week" },
  };
}

/** Program Horizon: the live week is the one the member can actually change. */
export function resolveHorizonPrimaryAction(input: HorizonPrimaryInput): HorizonPrimaryPlan {
  if (!input.hasHorizon) return NO_PROGRAM;
  if (input.viewingWeek !== input.currentWeek) return readingAnotherWeek(input);

  return {
    statement: liveStatement(input),
    title: "This week is yours to change",
    reason:
      "Move a session, add something you are already doing, or take a day out. Reserve reprojects the weeks ahead and keeps the original beside it.",
    primary: { kind: "adjust-day", label: "Adjust This Week" },
  };
}

/** Mesocycle Planner: a reading surface, so the live week routes to the Horizon. */
export function resolveMesocyclePrimaryAction(input: HorizonPrimaryInput): HorizonPrimaryPlan {
  if (!input.hasHorizon) return NO_PROGRAM;
  if (input.viewingWeek !== input.currentWeek) return readingAnotherWeek(input);

  return {
    statement: liveStatement(input),
    title: "The block is projected from today",
    reason: "Phases, deloads and assessments are laid out ahead. Changing a week happens in Program Horizon.",
    primary: { kind: "open-program-horizon", label: "Open Program Horizon" },
  };
}
