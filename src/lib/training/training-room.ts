/* ════════════════════════════════════════════════════════════════════════
   TRAINING ROOM — what the top of the Training screen says, and why.

   The hero used to carry two hardcoded tiles ("84%", "72%"). Every number
   it shows now comes from a real source and carries its provenance
   (Bible §12): readiness is derived from the member's recovery logs, the
   session metric is the plan's own estimate or the sets actually logged.
   Where there is no evidence, the read is null and the view says
   "Evidence needed" beside the logging action. Nothing here guesses.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type TrainingRoomMode = "pre" | "live" | "complete" | "closed";

export type TrainingSessionKind = "lifting" | "recovery" | "missing" | "activity";

/**
 * The hero's one statement. It names today's session — the member reads what
 * they are training, not a slogan. With no plan it says so. Live and after,
 * the accent carries the session's state in one word.
 */
export function trainingHeroCopy(input: {
  mode: TrainingRoomMode;
  liftingStarted: boolean;
  isCatchUp: boolean;
  /** The session's display name ("Pull", "Recovery", "Track Session"). */
  title: string | undefined;
  kind: TrainingSessionKind;
  /** A Program Horizon, a program day or a member split resolved today. */
  hasPlan: boolean;
}): { statement: string; accent: string | null } {
  const title = input.title?.trim() || "Today's session";
  /* Live and after, the statement stays the session's name and the accent is its state — no slogans. */
  if (input.mode === "live") return { statement: `${title}.`, accent: "Live" };
  if (input.mode === "complete" || input.mode === "closed") return { statement: `${title}.`, accent: "Captured" };

  const catchUp = input.isCatchUp ? "Priority catch-up" : null;
  if (input.kind === "recovery") return { statement: "Recovery day.", accent: catchUp };
  if (input.kind === "activity") return { statement: `${title}.`, accent: catchUp };
  if (input.kind === "missing") {
    return input.hasPlan ? { statement: `${title}.`, accent: "Not built yet" } : { statement: "No plan yet.", accent: null };
  }
  return { statement: `${title}.`, accent: catchUp };
}

/* ── The one gold action ─────────────────────────────────────────────────── */

export type TrainingLaunchStage = "idle" | "pre-session" | "primer";

export type TrainingPrimaryKind =
  /** Idle lifting day: open the readiness step. */
  | "begin"
  /** Readiness step: start the live session. */
  | "start"
  | "recovery-runway"
  /** No plan resolved: the split chooser is the real next thing. */
  | "choose-split"
  /** A plan exists but today's session has no template yet. */
  | "build";

export type TrainingPrimary = { kind: TrainingPrimaryKind; label: string };

/**
 * Exactly one gold action, or none. Live, after the session, on a stale
 * live session and inside the primer the cockpit or the step owns the
 * actions, so the hero offers nothing. An activity day has nothing to start.
 */
export function trainingPrimaryAction(input: {
  mode: TrainingRoomMode;
  staleLive: boolean;
  launchStage: TrainingLaunchStage;
  kind: TrainingSessionKind;
  movementCount: number;
  hasRecoveryRunway: boolean;
  hasPlan: boolean;
}): TrainingPrimary | null {
  if (input.staleLive || input.mode !== "pre" || input.launchStage === "primer") return null;
  if (input.kind === "lifting" && input.movementCount > 0) {
    return { kind: input.launchStage === "pre-session" ? "start" : "begin", label: "Start Session" };
  }
  if (input.launchStage !== "idle" || input.kind === "activity") return null;
  if (input.kind === "recovery" && input.hasRecoveryRunway) return { kind: "recovery-runway", label: "Open Recovery Runway" };
  if (!input.hasPlan) return { kind: "choose-split", label: "Choose Your Split" };
  return { kind: "build", label: "Build Today's Session" };
}

/* ── Who owns today's session ──────────────────────────────── */

export type TodaySessionOwner = "horizon" | "program-day" | "member-day" | "member-split" | "none";

/**
 * Which plan gets to say what today is.
 *
 * The member's own change to a DATE is first, because it is the most specific
 * thing anyone has said about that date. It used to sit below the program day,
 * and the screen came apart: a member who set "Legs every Friday" over a
 * program whose Friday was a member-authored day with no template read "Legs."
 * in the hero, "Your program · Chest Day" underneath it, and then "No workout
 * template for Legs yet" where the session should have been — three names for
 * one day and nothing to start.
 *
 * Below that: an active Program Horizon, then a program day, then a split the
 * member chose. With none of them Reserve has no plan and says so rather than
 * generating a generic workout.
 */
export function todaySessionOwner(input: {
  /** An active, executable Program Horizon resolved for today. */
  horizonActive: boolean;
  /** A program day resolved for the selected date. */
  programDayResolved: boolean;
  /** The member changed THIS date (or every one of this weekday). */
  memberDayEdit: boolean;
  /** The member chose a split architecture. */
  memberSplitActive: boolean;
}): TodaySessionOwner {
  if (input.memberDayEdit) return "member-day";
  if (input.horizonActive) return "horizon";
  if (input.programDayResolved) return "program-day";
  if (input.memberSplitActive) return "member-split";
  return "none";
}

/* ── Where today's session came from ─────────────────────────────────────── */

export type ProgramSource = "session" | "horizon" | "program-day" | "member-split" | "member-day" | "none";

/**
 * One honest line: what actually generated today's session. It replaces a
 * panel that said "No executable Program Horizon is available" directly
 * above a session the member's own split had generated. Precedence follows
 * the resolver in TrainingView: a started session's frozen snapshot, then an
 * active Program Horizon, then a program day, then the member's split or
 * their own change to today. Only with none of those does it say no plan.
 */
export function programSourceLine(input: {
  /** A started session's frozen generation snapshot. */
  generation: { architectureName: string; splitTitle: string } | null;
  horizon: { protocolName: string; phaseName: string; weekNumber: number; totalWeeks: number } | null;
  programDay: {
    title: string;
    ownershipLabel: string | null;
    /** The day carried no workout template, so Reserve built the session its
        TITLE names. The member authored the day; they did not author these
        movements, and the line has to say so. */
    builtFromDayName?: boolean;
  } | null;
  memberSplitName: string | null;
  memberDayEdit: boolean;
}): { source: ProgramSource; text: string } {
  if (input.generation) {
    return { source: "session", text: `This session · built from ${input.generation.architectureName} · ${input.generation.splitTitle}` };
  }
  if (input.horizon) {
    const h = input.horizon;
    return { source: "horizon", text: `Program Horizon · ${h.protocolName} · ${h.phaseName} · Week ${h.weekNumber} of ${h.totalWeeks}` };
  }
  if (input.programDay) {
    const owner = input.programDay.ownershipLabel ? ` · ${input.programDay.ownershipLabel}` : "";
    if (input.programDay.builtFromDayName) {
      return {
        source: "program-day",
        text: `Your program · ${input.programDay.title}${owner} · session built from the day you named`,
      };
    }
    return { source: "program-day", text: `Your program · ${input.programDay.title}${owner}` };
  }
  if (input.memberSplitName) {
    return { source: "member-split", text: `Built from your split · ${input.memberSplitName} · no Program Horizon set` };
  }
  if (input.memberDayEdit) {
    return { source: "member-day", text: "Built from your change to today · no Program Horizon set" };
  }
  return { source: "none", text: "No plan set · Reserve does not build a generic workout" };
}

export type ReadinessRead = { value: number; label: string };

/** Readiness from the recovery engine's snapshot. Null without logged evidence — never a default. */
export function readinessRead(snapshot: { hasData: boolean; reserve: number; reserveLabel: string }): ReadinessRead | null {
  if (!snapshot.hasData || !Number.isFinite(snapshot.reserve)) return null;
  return { value: Math.round(Math.min(100, Math.max(0, snapshot.reserve))), label: snapshot.reserveLabel };
}

export type SessionMetricInput = {
  mode: TrainingRoomMode;
  kind: "lifting" | "recovery" | "missing" | "activity";
  /** The template's own estimate, when there is a template. */
  estimatedDurationMin: number | null;
  movements: number;
  totalSets: number;
  loggedSets: number;
  recoveryMoves: number | null;
  activityLabel: string | null;
  activityMinutes: number | null;
};

export type SessionMetric = {
  label: string;
  value: string;
  detail: string;
  /** Bible §12: estimated says "est.", planned comes from the plan. Null when the
      label already says where the number came from ("Sets logged", "Elapsed"). */
  provenance: "est." | "planned" | null;
};

export function sessionMetric(input: SessionMetricInput): SessionMetric | null {
  if (input.mode !== "pre" && input.totalSets > 0) {
    const logged = Math.min(input.loggedSets, input.totalSets);
    return {
      label: "Sets logged",
      value: `${logged}/${input.totalSets}`,
      detail: `${Math.round((logged / input.totalSets) * 100)}% of planned sets`,
      provenance: null,
    };
  }
  if (input.mode !== "pre") return null;

  if (input.kind === "lifting" && input.totalSets > 0) {
    const movements = `${input.movements} ${input.movements === 1 ? "movement" : "movements"}`;
    return input.estimatedDurationMin && input.estimatedDurationMin > 0
      ? { label: "Session", value: `${input.estimatedDurationMin} min`, detail: `${movements} · ${input.totalSets} sets`, provenance: "est." }
      : { label: "Session", value: `${input.totalSets} sets`, detail: movements, provenance: "planned" };
  }
  if (input.kind === "recovery" && input.recoveryMoves) {
    return { label: "Recovery", value: `${input.recoveryMoves}`, detail: "moves · no lifting today", provenance: "planned" };
  }
  if (input.kind === "activity" && input.activityLabel) {
    return input.activityMinutes
      ? { label: "Activity", value: `${input.activityMinutes} min`, detail: input.activityLabel, provenance: "planned" }
      : { label: "Activity", value: input.activityLabel, detail: "No lifting today", provenance: "planned" };
  }
  return null;
}

/* ── Live and after: elapsed time and the session's own totals ───────────── */

export type HeroLead = { label: string; value: string; detail: string; provenance: null };

/** Minutes between two instants, never negative. Null without a start. */
export function sessionMinutes(startedAt: string | null | undefined, end: Date | null): number | null {
  if (!startedAt || !end) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.round((end.getTime() - start) / 60_000));
}

/**
 * The hero's first readout once a session has started. Mid-set readiness does
 * not change a decision; the clock does. Live it is time elapsed, after it is
 * the session's duration — both from the member's own start and end stamps.
 */
export function sessionClockLead(input: {
  mode: TrainingRoomMode;
  startedAt: string | null | undefined;
  endedAt: string | null | undefined;
  now: Date | null;
  formatTime: (d: Date) => string;
}): HeroLead | null {
  if (input.mode === "pre" || !input.startedAt) return null;
  const live = input.mode === "live";
  const end = live ? input.now : input.endedAt ? new Date(input.endedAt) : null;
  const minutes = sessionMinutes(input.startedAt, end);
  if (minutes === null) return null;
  return {
    label: live ? "Elapsed" : "Duration",
    value: `${minutes} min`,
    detail: `Started ${input.formatTime(new Date(input.startedAt))}`,
    provenance: null,
  };
}

/** Total load moved: the sum of load × reps over logged sets. Null when nothing loaded was logged. */
export function sessionVolume(sets: { load: number; reps: number }[]): number | null {
  const total = sets.reduce((sum, s) => sum + (s.load > 0 && s.reps > 0 ? s.load * s.reps : 0), 0);
  return total > 0 ? Math.round(total) : null;
}

/**
 * Rest between sets, from the last logged set's own timestamp and the
 * movement's programmed rest. Null before the first set of the session.
 */
export function restClock(lastLoggedAt: string | null, restSeconds: number, nowMs: number): { remaining: number; over: boolean } | null {
  if (!lastLoggedAt) return null;
  const at = Date.parse(lastLoggedAt);
  if (!Number.isFinite(at)) return null;
  const elapsed = Math.max(0, Math.floor((nowMs - at) / 1000));
  const remaining = restSeconds - elapsed;
  return { remaining: Math.abs(remaining), over: remaining <= 0 };
}

export function formatClockSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
