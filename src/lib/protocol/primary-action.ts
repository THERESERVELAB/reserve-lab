/* ════════════════════════════════════════════════════════════════════════
   PERSONAL COMMAND PRIMARY ACTION — the one gold action on the screen that
   chooses the protocol everything else in Reserve organizes around.

   The order is the order the member actually needs:

     0. no protocol            → choose one (nothing is scheduled without it)
     1. the protocol is paused → resume it
     2. the protocol is done   → choose the next one
     3. no target date         → set it, so the block has a runway
     4. command inputs missing → complete the first one Reserve lacks
     5. everything is set      → open the projected block

   The statement is the member's own state in plain language, and it is
   honest when there is nothing: "No protocol is set." is a real sentence,
   not an empty slot.

   Organization only. No dosage, compound, supplement or clinical language,
   and no claim about an outcome. Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { ActiveProtocol, CommandCompleteness, ProtocolProgress } from "./library";

export type ProtocolPrimaryAction =
  | { kind: "choose-protocol"; label: string }
  | { kind: "resume-protocol"; label: string }
  | { kind: "choose-next-protocol"; label: string }
  | { kind: "set-target-date"; label: string }
  | { kind: "complete-profile"; label: string; missing: string }
  | { kind: "open-program-horizon"; label: string };

export type ProtocolPrimaryPlan = {
  /** The member's current state on this screen, in one plain sentence. */
  statement: string;
  /** One line naming the move. */
  title: string;
  /** Why now, from the member's own protocol and inputs. */
  reason: string;
  primary: ProtocolPrimaryAction;
};

export type ProtocolPrimaryInput = {
  /** The member's active protocol, or null when none has been chosen. */
  active: ActiveProtocol | null;
  /** `computeProtocolProgress(active)`. Null whenever `active` is null. */
  progress: ProtocolProgress | null;
  /** `computeCommandCompleteness(signals)` — what Reserve still does not have. */
  completeness: CommandCompleteness;
};

/** "Week 3 of 12 on Recomposition Block." — or the honest open-ended form. */
function blockStatement(name: string, progress: ProtocolProgress): string {
  if (progress.totalWeeks > 0) {
    return `Week ${progress.currentWeek} of ${progress.totalWeeks} on ${name}.`;
  }
  return `${name} is running without a set block length.`;
}

export function resolveProtocolPrimaryAction(input: ProtocolPrimaryInput): ProtocolPrimaryPlan {
  const { active, progress, completeness } = input;

  /* 0 ── Nothing is organized until a protocol is chosen. */
  if (!active || !progress) {
    return {
      statement: "No protocol is set.",
      title: "Choose the protocol Reserve organizes around",
      reason:
        "Your protocol sets the mission, the timeline and the phase the rest of Reserve is built from. Nothing is scheduled until you choose one.",
      primary: { kind: "choose-protocol", label: "Choose Your Protocol" },
    };
  }

  const name = active.protocolName;

  /* 1 ── Paused: the block clock is stopped, and only the member restarts it. */
  if (active.status === "paused") {
    return {
      statement: `${name} is paused.`,
      title: "Your protocol is paused",
      reason: "Training, fuel and recovery keep running. The block clock stays stopped until you resume it.",
      primary: { kind: "resume-protocol", label: "Resume Protocol" },
    };
  }

  /* 2 ── Complete: the next decision is the next block. */
  if (active.status === "completed") {
    return {
      statement: `${name} is complete.`,
      title: "This block is finished",
      reason: "Choosing the next protocol sets a new mission, timeline and phase for everything downstream.",
      primary: { kind: "choose-next-protocol", label: "Choose Your Next Protocol" },
    };
  }

  const statement = blockStatement(name, progress);

  /* 3 ── No date to work toward: the plan cannot be timeline-aware. */
  if (progress.pace === "no-deadline") {
    return {
      statement,
      title: "No target date is set",
      reason: "Add the date you are working toward and Reserve can say how much runway the block has left.",
      primary: { kind: "set-target-date", label: "Set Your Target Date" },
    };
  }

  /* 4 ── Reserve is missing inputs it would otherwise be guessing at. */
  const missing = completeness.missing[0];
  if (missing) {
    const count = completeness.missing.length;
    return {
      statement,
      title: `${count} command input${count === 1 ? " is" : "s are"} still missing`,
      reason: `Reserve is working from ${completeness.confidence} confidence. ${missing} is the first thing it does not have.`,
      primary: { kind: "complete-profile", label: "Complete Your Profile", missing },
    };
  }

  /* 5 ── Set: the block is the thing to read next. */
  return {
    statement,
    title: "Your block is set",
    reason: "Every week of the block is projected from today. The horizon shows what each one asks for, and why.",
    primary: { kind: "open-program-horizon", label: "Open Program Horizon" },
  };
}
