/* ════════════════════════════════════════════════════════════════════════
   TRAINING + RECOVERY — is the member actually recovering better?

   Compares the four weeks before the cycle with the most recent four weeks:
   sessions, completed sets, strength (estimated one-rep max on lifts done in
   both windows), session effort, adherence, sleep, resting heart rate and
   the member's own recovery rating.

   A cycle is never treated as permission for unlimited volume. When training
   volume climbs while recovery signals fall, Reserve says so.
   ════════════════════════════════════════════════════════════════════════ */

import { addDays, daysBetween, isDateKey } from "@/lib/cycle/cycle-period";
import type { SessionExecutionRecord } from "@/lib/training/session-execution";

import type { CycleCheckIn } from "./types";

export type RecoveryDirection = "up" | "down" | "steady" | "unknown";

export type RecoveryMetricRow = { id: string; label: string; before: string; during: string; direction: RecoveryDirection };

export type TrainingSignal = { id: string; kind: "aligned" | "worth-watching"; text: string };

export type TrainingRecovery = {
  available: boolean;
  windowLabel: string;
  rows: RecoveryMetricRow[];
  signals: TrainingSignal[];
  gaps: string[];
};

export const RECOVERY_WINDOW_DAYS = 28;
/** The comparison opens once the cycle has run this long. */
export const MIN_DAYS_ON_CYCLE = 14;

type Window = { from: string; to: string };

type WindowStats = {
  sessionsPerWeek?: number;
  setsPerWeek?: number;
  rpe?: number;
  adherencePct?: number;
  sleepHours?: number;
  restingHr?: number;
  recoveryRating?: number;
  bestE1rm: Map<string, { name: string; lb: number }>;
  sessionCount: number;
  rpeCount: number;
};

function inWindow(date: string | undefined, w: Window): boolean {
  const key = date?.slice(0, 10);
  return Boolean(key && isDateKey(key) && key >= w.from && key <= w.to);
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

function statsFor(
  w: Window,
  sessions: SessionExecutionRecord[],
  sleepLogs: Array<{ date: string; hours: number }>,
  checkIns: CycleCheckIn[],
  restingHrEntries: Array<{ date: string; bpm: number }>,
): WindowStats {
  const weeks = (daysBetween(w.from, w.to) + 1) / 7;
  const inRange = sessions.filter((s) => inWindow(s.calendarDate, w));
  const done = inRange.filter((s) => s.status === "completed" || s.status === "partial");
  const missed = inRange.filter((s) => s.status === "skipped" || s.status === "abandoned");

  let sets = 0;
  const bestE1rm = new Map<string, { name: string; lb: number }>();
  for (const session of done) {
    for (const movement of [...session.movements, ...session.addedMovements]) {
      for (const set of movement.completedSets) {
        if (!set.completed) continue;
        sets += 1;
        const reps = set.completedReps ?? 0;
        const load = set.completedLoad ?? 0;
        if (reps < 1 || reps > 12 || load <= 0 || (set.loadUnit !== "lb" && set.loadUnit !== "kg")) continue;
        const lb = (set.loadUnit === "kg" ? load * 2.20462 : load) * (1 + reps / 30);
        const current = bestE1rm.get(movement.exerciseId);
        if (!current || lb > current.lb) bestE1rm.set(movement.exerciseId, { name: movement.performedName, lb });
      }
    }
  }
  const rpes = done.map((s) => s.sessionMetrics.sessionRpe).filter((v): v is number => typeof v === "number");

  return {
    sessionCount: done.length,
    sessionsPerWeek: inRange.length ? done.length / weeks : undefined,
    setsPerWeek: done.length ? sets / weeks : undefined,
    rpe: average(rpes),
    rpeCount: rpes.length,
    adherencePct: done.length + missed.length > 0 ? (done.length / (done.length + missed.length)) * 100 : undefined,
    sleepHours: average(sleepLogs.filter((l) => inWindow(l.date, w)).map((l) => l.hours)),
    restingHr: average([
      ...restingHrEntries.filter((e) => inWindow(e.date, w)).map((e) => e.bpm),
      ...checkIns.filter((c) => inWindow(c.date, w) && c.restingHr).map((c) => c.restingHr!),
    ]),
    recoveryRating: average(checkIns.filter((c) => inWindow(c.date, w) && c.ratings.recovery).map((c) => c.ratings.recovery!)),
    bestE1rm,
  };
}

function fmt(value: number | undefined, digits: number, suffix = ""): string {
  return value === undefined ? "—" : `${value.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
}

function direction(before: number | undefined, during: number | undefined, threshold: number, relative = false): RecoveryDirection {
  if (before === undefined || during === undefined) return "unknown";
  const delta = relative ? (before === 0 ? 0 : ((during - before) / before) * 100) : during - before;
  return delta >= threshold ? "up" : delta <= -threshold ? "down" : "steady";
}

export function buildTrainingRecovery(input: {
  sessions: SessionExecutionRecord[];
  sleepLogs: Array<{ date: string; hours: number }>;
  checkIns: CycleCheckIn[];
  restingHrEntries: Array<{ date: string; bpm: number }>;
  cycleStart: string;
  today: string;
}): TrainingRecovery {
  const daysOn = daysBetween(input.cycleStart, input.today);
  if (daysOn < MIN_DAYS_ON_CYCLE) {
    return {
      available: false,
      windowLabel: `The comparison opens after ${MIN_DAYS_ON_CYCLE} days on cycle.`,
      rows: [],
      signals: [],
      gaps: [],
    };
  }

  const before: Window = { from: addDays(input.cycleStart, -RECOVERY_WINDOW_DAYS), to: addDays(input.cycleStart, -1) };
  const during: Window = {
    from: daysOn + 1 >= RECOVERY_WINDOW_DAYS ? addDays(input.today, -(RECOVERY_WINDOW_DAYS - 1)) : input.cycleStart,
    to: input.today,
  };
  const b = statsFor(before, input.sessions, input.sleepLogs, input.checkIns, input.restingHrEntries);
  const d = statsFor(during, input.sessions, input.sleepLogs, input.checkIns, input.restingHrEntries);

  /* Strength: lifts done in both windows */
  const lifts = [...d.bestE1rm.entries()].filter(([id]) => b.bestE1rm.has(id));
  const changes = lifts.map(([id, now]) => ((now.lb - b.bestE1rm.get(id)!.lb) / b.bestE1rm.get(id)!.lb) * 100).sort((x, y) => x - y);
  const strengthChange = changes.length >= 2 ? changes[Math.floor(changes.length / 2)] : undefined;

  const rows: RecoveryMetricRow[] = [
    { id: "sessions", label: "Sessions a week", before: fmt(b.sessionsPerWeek, 1), during: fmt(d.sessionsPerWeek, 1), direction: direction(b.sessionsPerWeek, d.sessionsPerWeek, 0.5) },
    { id: "sets", label: "Completed sets a week", before: fmt(b.setsPerWeek, 0), during: fmt(d.setsPerWeek, 0), direction: direction(b.setsPerWeek, d.setsPerWeek, 10, true) },
    {
      id: "strength",
      label: "Strength change (est. 1RM, shared lifts)",
      before: "—",
      during: strengthChange === undefined ? "—" : `${strengthChange >= 0 ? "+" : ""}${strengthChange.toFixed(1)}% · ${lifts.length} lifts`,
      direction: strengthChange === undefined ? "unknown" : strengthChange >= 2 ? "up" : strengthChange <= -2 ? "down" : "steady",
    },
    { id: "rpe", label: "Session effort (RPE)", before: fmt(b.rpe, 1), during: fmt(d.rpe, 1), direction: direction(b.rpe, d.rpe, 0.5) },
    { id: "adherence", label: "Sessions completed", before: fmt(b.adherencePct, 0, "%"), during: fmt(d.adherencePct, 0, "%"), direction: direction(b.adherencePct, d.adherencePct, 10) },
    { id: "sleep", label: "Sleep", before: fmt(b.sleepHours, 1, " h"), during: fmt(d.sleepHours, 1, " h"), direction: direction(b.sleepHours, d.sleepHours, 0.3) },
    { id: "resting-hr", label: "Resting heart rate", before: fmt(b.restingHr, 0, " bpm"), during: fmt(d.restingHr, 0, " bpm"), direction: direction(b.restingHr, d.restingHr, 3) },
    { id: "recovery", label: "Recovery rating", before: fmt(b.recoveryRating, 1, " / 5"), during: fmt(d.recoveryRating, 1, " / 5"), direction: direction(b.recoveryRating, d.recoveryRating, 0.5) },
  ];

  const falling: string[] = [];
  if (b.sleepHours !== undefined && d.sleepHours !== undefined && d.sleepHours - b.sleepHours <= -0.5) falling.push(`sleep fell ${(b.sleepHours - d.sleepHours).toFixed(1)} h`);
  if (b.restingHr !== undefined && d.restingHr !== undefined && d.restingHr - b.restingHr >= 5) falling.push(`resting heart rate rose ${Math.round(d.restingHr - b.restingHr)} bpm`);
  if (b.recoveryRating !== undefined && d.recoveryRating !== undefined && d.recoveryRating - b.recoveryRating <= -0.75) falling.push(`your recovery rating fell ${(b.recoveryRating - d.recoveryRating).toFixed(1)} points`);
  if (b.rpe !== undefined && d.rpe !== undefined && d.rpe - b.rpe >= 1) falling.push(`session effort rose ${(d.rpe - b.rpe).toFixed(1)} RPE`);

  const signals: TrainingSignal[] = [];
  const setsChange = b.setsPerWeek && d.setsPerWeek ? ((d.setsPerWeek - b.setsPerWeek) / b.setsPerWeek) * 100 : undefined;
  if (setsChange !== undefined && setsChange >= 20 && falling.length > 0) {
    signals.push({
      id: "volume-recovery",
      kind: "worth-watching",
      text: `Completed sets rose ${Math.round(setsChange)}% while ${falling.join(", ")}. Review training volume against recovery before adding more.`,
    });
  } else if (falling.length > 0) {
    signals.push({ id: "recovery-down", kind: "worth-watching", text: `Compared with the four weeks before this cycle, ${falling.join(", ")}.` });
  }
  if (strengthChange !== undefined && strengthChange >= 2 && falling.length === 0) {
    signals.push({ id: "strength", kind: "aligned", text: `Strength is progressing (+${strengthChange.toFixed(1)}% across ${lifts.length} shared lifts, est.) with recovery signals steady.` });
  }
  if (d.adherencePct !== undefined && d.adherencePct >= 80) {
    signals.push({ id: "adherence", kind: "aligned", text: `${Math.round(d.adherencePct)}% of scheduled sessions completed in the last four weeks.` });
  }

  const gaps: string[] = [];
  if (d.sessionCount === 0) gaps.push("No training sessions logged in the last four weeks.");
  if (b.sessionCount === 0) gaps.push("No training logged in the four weeks before this cycle, so there is no training baseline.");
  if (d.sessionCount > 0 && d.rpeCount === 0) gaps.push("Session effort (RPE) is not logged on recent sessions.");

  return {
    available: true,
    windowLabel: "Four weeks before the cycle compared with the last four weeks.",
    rows,
    signals,
    gaps,
  };
}
