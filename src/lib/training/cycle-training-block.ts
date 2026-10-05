/* ════════════════════════════════════════════════════════════════════════
   TRAINING BLOCK — the member's training and the member's cycle, on one clock.

   A cycle period is a span of time the member declared: it starts on a date
   they chose, runs the weeks they stated, and carries the lab checkpoints
   they or their clinician set. Reserve keeps them honest to that plan.

   Training used to know nothing about it. A member ran a twelve-week block
   and had to remember, twice, to change their session depth — once when it
   started and once when it ended. Nobody remembers the second one.

   So the member can hold a depth FOR the block. Reserve carries it while the
   span they declared is running and hands it back the day that span is over.

   WHAT THIS DOES NOT DO, deliberately and permanently:

     It never reads a compound. Not its name, not its class, not how many are
     running. No depth is chosen, raised, lowered or suggested because of
     anything the member is taking. Reserve would then be saying that a
     substance makes harder training appropriate, which is a medical claim
     about that substance, and CLAUDE.md forbids those. Nothing here implies
     a cycle is a reason to train harder or that training harder is safe.

     What it reads is a SPAN and a WEEK NUMBER — placement in the member's own
     declared time, the same standard the Research tab holds: "placement in
     time only — never correlation, cause, ranking or directives."

     The depth is the member's choice, made once, in their own words, and
     revocable in one tap. Reserve never sets it for them.

   And the gate still outranks everything: `gateWorkoutDemand` steps a held
   depth down for low readiness, an active discomfort report or a deload week,
   the same as any other. A block is a ceiling the member asked for, never a
   floor, and never a reason to override the day.

   Checkpoints run the other way. A lab date the member or their clinician set
   that has passed without a lab is surfaced where they are training, because
   that is the moment they are thinking about the block. It reports their own
   record and routes to their own log. It is not a verdict, it does not gate
   the session, and it never says what a result means.

   Pure and deterministic. No store, no React, no compound access.
   ════════════════════════════════════════════════════════════════════════ */

import type { CycleState } from "@/lib/cycle/cycle-period";
import type { WorkoutDemandLevel } from "./workout-demand";

/** A depth the member pinned to one declared cycle span. */
export type TrainingBlockIntent = {
  /** The cycle period it was chosen for. A different block does not inherit it. */
  cycleId: string;
  demand: WorkoutDemandLevel;
  /** ISO. Recorded so the member can see when they made the call. */
  setAt: string;
};

export type TrainingBlockCheckpoint = {
  label: string;
  /** Days since the date passed. Always positive here. */
  daysOverdue: number;
};

export type TrainingBlock = {
  cycleId: string;
  cycleName: string;
  /** Placement only: "Week 3 of 12". Never a reason, never a recommendation. */
  placement: string;
  weekNumber: number;
  totalWeeks: number;
  /** Days left in the span the member declared. */
  daysRemaining: number;
  /** The depth the member pinned to this block, or null if they have not. */
  demand: WorkoutDemandLevel | null;
  /** Lab dates the member or their clinician set that have passed without a lab. */
  overdue: TrainingBlockCheckpoint[];
};

/**
 * What happened to a depth the member pinned to a block.
 *
 * `returned` is the one that matters: the span they declared is over, so the
 * pin no longer applies and their baseline is back. Reserve says so rather
 * than quietly changing the session.
 */
export type TrainingBlockRelease =
  | { kind: "held" }
  | { kind: "returned"; reason: string }
  | { kind: "none" };

/** A cycle only holds a depth while the span the member declared is running. */
function spanIsRunning(cycleState: CycleState | null): boolean {
  return cycleState?.phase === "on-cycle";
}

/**
 * The member's current block, when there is one.
 *
 * Returns null unless a cycle span they declared is actually running — an
 * upcoming block, one past its stated end, and one they ended all resolve to
 * nothing, so nothing downstream can hold a depth for a block that is over.
 */
export function resolveTrainingBlock(input: {
  cycleState: CycleState | null;
  intent: TrainingBlockIntent | null;
}): TrainingBlock | null {
  const state = input.cycleState;
  if (!spanIsRunning(state) || !state) return null;

  const pinnedHere = input.intent && input.intent.cycleId === state.cycle.id ? input.intent : null;

  return {
    cycleId: state.cycle.id,
    cycleName: state.cycle.name,
    placement: `Week ${state.weekNumber} of ${state.totalWeeks}`,
    weekNumber: state.weekNumber,
    totalWeeks: state.totalWeeks,
    daysRemaining: state.daysRemaining,
    demand: pinnedHere?.demand ?? null,
    overdue: state.overdueCheckpoints.map((checkpoint) => ({
      label: checkpoint.label,
      daysOverdue: Math.abs(checkpoint.daysFromToday),
    })),
  };
}

/**
 * Whether a pinned depth still applies, and what to tell the member if not.
 *
 * Reserve hands depth back the day the member's own stated span ends. It does
 * not wait to be asked, and it does not keep driving a block that is over.
 */
export function resolveBlockRelease(input: {
  cycleState: CycleState | null;
  intent: TrainingBlockIntent | null;
}): TrainingBlockRelease {
  if (!input.intent) return { kind: "none" };
  const state = input.cycleState;

  if (state && state.cycle.id === input.intent.cycleId && spanIsRunning(state)) {
    return { kind: "held" };
  }
  if (state && state.cycle.id === input.intent.cycleId) {
    return {
      kind: "returned",
      reason:
        state.phase === "past-planned-end"
          ? `${state.cycle.name} is past the end you set — session depth is back to your own setting.`
          : `${state.cycle.name} has ended — session depth is back to your own setting.`,
    };
  }
  return { kind: "returned", reason: "That block is over — session depth is back to your own setting." };
}

/**
 * The depth to request today, before the gate.
 *
 * A held block first (the member pinned it for exactly this span), then their
 * standing choice, then the experience default. `gateWorkoutDemand` runs on
 * top of whatever this returns and can still pull it down for the day.
 */
export function requestedDemandForToday(input: {
  block: TrainingBlock | null;
  standing: WorkoutDemandLevel | null;
  fallback: WorkoutDemandLevel;
}): WorkoutDemandLevel {
  return input.block?.demand ?? input.standing ?? input.fallback;
}

/**
 * The one line Training Command prints beside the depth.
 *
 * Placement and the member's own words. No claim about the block, no reason
 * to train at this depth, nothing about what they are taking.
 */
export function blockPlacementLine(block: TrainingBlock | null): string | null {
  if (!block || !block.demand) return null;
  return `Held for ${block.cycleName} · ${block.placement}`;
}
