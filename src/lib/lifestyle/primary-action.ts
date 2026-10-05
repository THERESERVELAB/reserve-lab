/* ════════════════════════════════════════════════════════════════════════
   BUILD STUDIO PRIMARY ACTION — the one gold action on the screen where the
   member builds their own week and their own sessions.

     0. no week built      → build one
     1. none of them live  → make one the active week
     2. no session built   → build the first session
     3. everything built   → read what Reserve sees in the week

   Every action here moves the member into a real editor that is already on
   the screen. Nothing is created, activated or rewritten on their behalf —
   the member defines the week, Reserve analyses it.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type LifestylePrimaryAction =
  | { kind: "build-week"; label: string }
  | { kind: "activate-week"; label: string }
  | { kind: "build-session"; label: string }
  | { kind: "review-week"; label: string };

export type LifestylePrimaryPlan = {
  /** The member's current state on this screen, in one plain sentence. */
  statement: string;
  title: string;
  reason: string;
  primary: LifestylePrimaryAction;
};

export type LifestylePrimaryInput = {
  /** Saved, non-archived schedules. */
  scheduleCount: number;
  /** The active schedule's name, or null when none is active. */
  activeScheduleName: string | null;
  /** Activities on the active schedule. */
  activityCount: number;
  /** Custom session templates the member has built. */
  sessionCount: number;
};

/** "1 activity" / "11 activities" — an irregular plural is passed in, never guessed at. */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function resolveLifestylePrimaryAction(input: LifestylePrimaryInput): LifestylePrimaryPlan {
  /* 0 ── Nothing built yet. */
  if (input.scheduleCount === 0) {
    return {
      statement: "No week is built yet.",
      title: "Build the week you actually live",
      reason:
        "Any shape works — a seven-day week, a rotation, two-a-days, night shifts. Reserve analyses whatever you build and never rearranges it without you.",
      primary: { kind: "build-week", label: "Build Your Week" },
    };
  }

  /* 1 ── Saved, but nothing is running. */
  if (!input.activeScheduleName) {
    return {
      statement: `${plural(input.scheduleCount, "week")} saved, none of them active.`,
      title: "No week is running",
      reason: "Reserve reads exposure, conflicts and adherence against the week you set active.",
      primary: { kind: "activate-week", label: "Set Your Active Week" },
    };
  }

  const statement = `${input.activeScheduleName} is your active week · ${plural(input.activityCount, "activity", "activities")}.`;

  /* 2 ── The week is running, but no session has been built into it. */
  if (input.sessionCount === 0) {
    return {
      statement,
      title: "No custom session built yet",
      reason:
        "Build from movement slots and Reserve ranks the options against your equipment, history and what you have logged. Your pick is the one that is kept.",
      primary: { kind: "build-session", label: "Build Your First Session" },
    };
  }

  /* 3 ── Built. The next real thing is reading it back. */
  return {
    statement,
    title: `${plural(input.sessionCount, "custom session")} built`,
    reason: "Exposure, repeated conflicts and planned-against-actual are all read from the week you built.",
    primary: { kind: "review-week", label: "Review Your Week" },
  };
}
