/* ════════════════════════════════════════════════════════════════════════
   CYCLE PERIOD — the span of time a member says they will run compounds.

   Reserve records the member's own plan: when it starts, how many weeks they
   intend it to last, which logged compounds belong to it, and the bloodwork
   dates they or their clinician chose. From that it knows where the member
   is — before, week 6 of 12, or past the end they committed to — and notices
   when compounds tied to the cycle are still active after that end.

   It never designs a cycle, suggests a length, or says whether to continue.
   The plan is the member's; Reserve keeps them honest to it and keeps their
   clinician in the loop.
   ════════════════════════════════════════════════════════════════════════ */

export type CycleEndReason = "completed" | "ended-early";

export type CycleCheckpoint = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  setBy: "member" | "clinician";
};

export type CyclePeriod = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** The length the member stated, in weeks. */
  plannedWeeks: number;
  /** Ids of EnhancementEntry records that belong to this cycle. */
  compoundIds: string[];
  /** The member says a clinician is overseeing this cycle. */
  clinicianOversight: boolean;
  checkpoints: CycleCheckpoint[];
  /** YYYY-MM-DD the member ended it. */
  endedOn?: string;
  endReason?: CycleEndReason;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CyclePhase = "upcoming" | "on-cycle" | "past-planned-end" | "ended";

export const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  upcoming: "Starts soon",
  "on-cycle": "On cycle",
  "past-planned-end": "Past planned end",
  ended: "Ended",
};

export const CYCLE_MAX_WEEKS = 104;

/* ─── Dates ─────────────────────────────────────────────────────────────── */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string | undefined | null): value is string {
  if (!value) return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function toUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). DST-safe. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const date = new Date(toUtc(key) + days * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** The last day of the planned span, inclusive: 12 weeks from a Monday ends on a Sunday. */
export function plannedEndDate(cycle: Pick<CyclePeriod, "startDate" | "plannedWeeks">): string {
  return addDays(cycle.startDate, cycle.plannedWeeks * 7 - 1);
}

/* ─── Validation ────────────────────────────────────────────────────────── */

export type CycleInput = {
  name: string;
  startDate: string;
  plannedWeeks: number;
  compoundIds: string[];
  clinicianOversight: boolean;
  notes?: string;
};

export function validateCycleInput(input: CycleInput): string | null {
  if (!input.name.trim()) return "Name the cycle.";
  if (input.name.trim().length > 60) return "Keep the name under 60 characters.";
  if (!isDateKey(input.startDate)) return "Choose a start date.";
  if (!Number.isInteger(input.plannedWeeks) || input.plannedWeeks < 1) return "Enter how many weeks you plan to run it.";
  if (input.plannedWeeks > CYCLE_MAX_WEEKS) return `Enter ${CYCLE_MAX_WEEKS} weeks or fewer.`;
  return null;
}

/* ─── State ─────────────────────────────────────────────────────────────── */

/** A logged compound, reduced to what cycle state needs. */
export type CycleCompound = {
  id: string;
  name: string;
  isActive: boolean;
  pausedAt?: string;
};

export type CheckpointStatus = "met" | "upcoming" | "due" | "overdue";

export type ResolvedCheckpoint = CycleCheckpoint & {
  status: CheckpointStatus;
  /** Positive = days until; negative = days since. */
  daysFromToday: number;
  /** The lab date that satisfied it, when met. */
  metByLabDate?: string;
};

export type CycleState = {
  cycle: CyclePeriod;
  phase: CyclePhase;
  today: string;
  plannedEnd: string;
  totalWeeks: number;
  /** 1-based; clamped to the planned span while on cycle. */
  weekNumber: number;
  dayNumber: number;
  daysUntilStart: number;
  daysRemaining: number;
  daysPastPlannedEnd: number;
  /** 0–1 through the planned span. */
  progress: number;
  compounds: CycleCompound[];
  /** Ids the cycle references that no longer exist in the compound log. */
  missingCompoundIds: string[];
  /** Past the stated end while a linked compound is still active. */
  stillActivePastEnd: boolean;
  activePastEndNames: string[];
  checkpoints: ResolvedCheckpoint[];
  nextCheckpoint: ResolvedCheckpoint | null;
  overdueCheckpoints: ResolvedCheckpoint[];
};

/** A lab counts toward a checkpoint when drawn from a week before to two weeks after it. */
export const CHECKPOINT_EARLY_DAYS = 7;
export const CHECKPOINT_LATE_DAYS = 14;
/** A checkpoint is overdue once this many days pass without a lab. */
export const CHECKPOINT_OVERDUE_DAYS = 7;

function resolveCheckpoint(checkpoint: CycleCheckpoint, today: string, labDates: string[]): ResolvedCheckpoint {
  const daysFromToday = daysBetween(today, checkpoint.date);
  const metByLabDate = labDates
    .filter((date) => {
      const offset = daysBetween(checkpoint.date, date);
      return offset >= -CHECKPOINT_EARLY_DAYS && offset <= CHECKPOINT_LATE_DAYS;
    })
    .sort((a, b) => Math.abs(daysBetween(checkpoint.date, a)) - Math.abs(daysBetween(checkpoint.date, b)))[0];
  const status: CheckpointStatus = metByLabDate
    ? "met"
    : daysFromToday > 0
      ? "upcoming"
      : -daysFromToday > CHECKPOINT_OVERDUE_DAYS
        ? "overdue"
        : "due";
  return { ...checkpoint, status, daysFromToday, metByLabDate };
}

export function resolveCycleState(
  cycle: CyclePeriod,
  input: { now: Date; compounds: CycleCompound[]; labDates?: string[] },
): CycleState {
  const today = dateKeyOf(input.now);
  const plannedEnd = plannedEndDate(cycle);
  const totalDays = cycle.plannedWeeks * 7;

  const phase: CyclePhase = cycle.endedOn
    ? "ended"
    : today < cycle.startDate
      ? "upcoming"
      : today <= plannedEnd
        ? "on-cycle"
        : "past-planned-end";

  const elapsed = daysBetween(cycle.startDate, phase === "ended" ? cycle.endedOn! : today);
  const dayNumber = Math.max(0, elapsed + 1);
  const weekNumber = phase === "upcoming" ? 0 : Math.max(1, Math.ceil(dayNumber / 7));

  const byId = new Map(input.compounds.map((compound) => [compound.id, compound]));
  const compounds = cycle.compoundIds.map((id) => byId.get(id)).filter((c): c is CycleCompound => Boolean(c));
  const missingCompoundIds = cycle.compoundIds.filter((id) => !byId.has(id));
  const activePastEnd = phase === "past-planned-end" ? compounds.filter((c) => c.isActive && !c.pausedAt) : [];

  const labDates = (input.labDates ?? []).filter(isDateKey);
  const checkpoints = [...cycle.checkpoints]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((checkpoint) => resolveCheckpoint(checkpoint, today, labDates));

  return {
    cycle,
    phase,
    today,
    plannedEnd,
    totalWeeks: cycle.plannedWeeks,
    weekNumber: phase === "on-cycle" ? Math.min(weekNumber, cycle.plannedWeeks) : weekNumber,
    dayNumber,
    daysUntilStart: phase === "upcoming" ? daysBetween(today, cycle.startDate) : 0,
    daysRemaining: phase === "on-cycle" ? daysBetween(today, plannedEnd) : 0,
    daysPastPlannedEnd: phase === "past-planned-end" ? daysBetween(plannedEnd, today) : 0,
    progress: phase === "upcoming" ? 0 : Math.min(1, Math.max(0, dayNumber / totalDays)),
    compounds,
    missingCompoundIds,
    stillActivePastEnd: activePastEnd.length > 0,
    activePastEndNames: activePastEnd.map((c) => c.name),
    checkpoints,
    nextCheckpoint: checkpoints.find((c) => c.status === "upcoming" || c.status === "due") ?? null,
    overdueCheckpoints: checkpoints.filter((c) => c.status === "overdue"),
  };
}

/**
 * The cycle Reserve should reason about today: an unended cycle that has
 * started (latest start wins), else the soonest upcoming one.
 */
export function selectCurrentCycle(cycles: CyclePeriod[], now: Date): CyclePeriod | null {
  const today = dateKeyOf(now);
  const open = cycles.filter((c) => !c.endedOn);
  const started = open.filter((c) => c.startDate <= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (started[0]) return started[0];
  const upcoming = open.filter((c) => c.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? null;
}
