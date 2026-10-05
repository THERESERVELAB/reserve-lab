/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE RECOVERY ENGINE — missed-day intelligence + priority debt.

   Pure function. No store access. Reads the resolved week, the member's
   muscle focus, recovery reserve, and training overrides to return the
   highest-value next session when life disrupts the schedule.

   Core rule: the architecture stays intelligent even when days are missed.
   Reserve protects priority exposures and moves support work — not the
   reverse.

   No medical claims. No prescriptions. Stop-with-pain language delegated
   to the training disclaimer at the view layer.
   ════════════════════════════════════════════════════════════════════════ */

import type { ResolvedDay } from "@/lib/training/daily-context";
import type { PhysiqueFocus, MusclePriority } from "@/lib/physique/types";
import type { TrainingOverride } from "@/lib/athlete-store";
import type { ActualWeekRecord } from "@/lib/lifestyle/types";

export type ScheduleStatus =
  | "on-track"
  | "flex-active"
  | "priority-debt"
  | "recovery-protected";

export type SessionMatchLevel = "high" | "moderate" | "low";

export type RecommendedOption = {
  session: ResolvedDay;
  priorityMatch: SessionMatchLevel;
  recoveryDemand: "high" | "moderate" | "low";
  reason: string;
  protects: string;
  movesSessions: string[];
};

export type CalendarEntry = {
  day: ResolvedDay;
  status:
    | "today"
    | "upcoming"
    | "completed"
    | "partial"
    | "missed"
    | "skipped"
    | "rescheduled"
    | "swapped"
    | "not-ready"
    | "accidental-start"
    | "recovery";
};

export type ScheduleRecoveryResult = {
  scheduleStatus: ScheduleStatus;
  missedCount: number;
  hasPriorityDebt: boolean;
  priorityDebtLabel: string | null;
  recoveryTooLow: boolean;
  recoveryReason: string | null;
  todayOverride: TrainingOverride | null;
  recommendedNextSession: RecommendedOption | null;
  calendarEntries: CalendarEntry[];
};

export type ScheduleRecoveryInput = {
  now: Date;
  weeklyPlan: ResolvedDay[];
  todayIndex: number;
  overrides: Record<string, TrainingOverride>;
  actualWeeks?: ActualWeekRecord[];
  focus: PhysiqueFocus | undefined;
  recoveryReserve: number | null;
  hasRecoveryData: boolean;
};

const LOW_RECOVERY_THRESHOLD = 35;

function dateKey(d: Date, offsetDays = 0): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + offsetDays);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function overrideCalendarStatus(override: TrainingOverride | undefined): CalendarEntry["status"] | null {
  if (!override || override.status === "cancelled") return null;
  if (override.action === "rescheduled") return "rescheduled";
  if (override.action === "swapped") return "swapped";
  if (override.action === "skipped") return "skipped";
  if (override.action === "not_ready" || override.action === "session_reset") return "not-ready";
  if (override.action === "accidental_start") return "accidental-start";
  return null;
}

function primaryFrom(focus: PhysiqueFocus | undefined): MusclePriority | null {
  return focus?.primary ?? null;
}

function sessionMatchesPriority(day: ResolvedDay, primary: MusclePriority | null): boolean {
  if (!primary || day.recovery) return false;
  const t = day.transform;
  const sk = day.splitKey;
  if (primary === "glutes" || primary === "hamstrings")
    return t === "glute-strength" || t === "glute-shape" || t === "glute-strength-waist" || t === "glute-hamstring-shape" || sk === "lower-posterior";
  if (primary === "quads")
    return t === "quad-volume" || t === "quad-shape-glute-support" || sk === "legs";
  if (primary === "chest" || primary === "upper-chest")
    return t === "chest" || sk === "chest-back";
  if (primary === "back-width" || primary === "back-thickness")
    return sk === "upper" || sk === "chest-back" || t === "back-line-delts-conditioning";
  if (primary === "delts")
    return sk === "upper" || sk === "arms-delts" || t === "back-line-delts-conditioning";
  if (primary === "core")
    return t === "glute-strength-waist" || t === "upper-sculpt-posture";
  return false;
}

function matchLevelFor(day: ResolvedDay, primary: MusclePriority | null): SessionMatchLevel {
  if (day.recovery) return "low";
  if (sessionMatchesPriority(day, primary)) return "high";
  if (primary) return "moderate";
  return "moderate";
}

function recoveryDemandFor(day: ResolvedDay): "high" | "moderate" | "low" {
  if (day.recovery) return "low";
  const t = day.transform;
  if (t === "glute-strength" || t === "quad-volume" || t === "glute-strength-waist" || t === "chest") return "high";
  if (t === "glute-shape" || t === "quad-shape-glute-support" || t === "glute-hamstring-shape") return "moderate";
  return "moderate";
}

function buildPriorityReasonCopy(primary: MusclePriority | null, missed: ResolvedDay, todayTitle: string | null): string {
  const primaryLabel = primary ? primary.replace(/-/g, " ") : null;
  const parts: string[] = [];
  if (primaryLabel) parts.push(`Primary focus (${primaryLabel}) exposure was missed.`);
  else parts.push("A priority session was missed.");
  if (todayTitle) parts.push(`${todayTitle} can move later without breaking the week.`);
  return parts.join(" ");
}

export function resolveTrainingScheduleRecovery(input: ScheduleRecoveryInput): ScheduleRecoveryResult {
  const { now, weeklyPlan, todayIndex, overrides, actualWeeks = [], focus, recoveryReserve, hasRecoveryData } = input;
  const primary = primaryFrom(focus);
  const todayKey = dateKey(now);
  const todayOverride = overrides[todayKey]?.status === "cancelled" ? null : overrides[todayKey] ?? null;
  const actualByDate = new Map(
    actualWeeks.flatMap((week) => week.records).map((record) => [record.date, record]),
  );

  const missedDays: ResolvedDay[] = [];
  const calendarEntries: CalendarEntry[] = weeklyPlan.map((day) => {
    const k = dateKey(now, day.dayIndex - todayIndex);
    const actual = actualByDate.get(k);
    const flex = overrideCalendarStatus(overrides[k]);
    const inbound = Object.values(overrides).find((override) =>
      override.status !== "cancelled" && override.action === "rescheduled" && override.targetDate === k,
    );
    if (actual?.status === "completed") return { day, status: "completed" };
    if (actual?.status === "partial") return { day, status: "partial" };
    if (flex) {
      if (["skipped", "not-ready", "accidental-start"].includes(flex)) missedDays.push(day);
      return { day, status: flex };
    }
    if (inbound) return { day, status: "rescheduled" };
    if (day.recovery) return { day, status: "recovery" };
    if (day.dayIndex < todayIndex) {
      missedDays.push(day);
      return { day, status: "missed" };
    }
    return { day, status: day.dayIndex === todayIndex ? "today" : "upcoming" };
  });

  const priorityMissed = missedDays.find((d) => sessionMatchesPriority(d, primary)) ?? null;
  const hasPriorityDebt = Boolean(priorityMissed);
  const priorityDebtLabel = priorityMissed ? priorityMissed.displayTitle : null;

  const recoveryTooLow = hasRecoveryData && recoveryReserve !== null && recoveryReserve < LOW_RECOVERY_THRESHOLD;
  const recoveryReason = recoveryTooLow
    ? "Reserve score is low. Priority catch-up is staged — a recovery session now protects the next output."
    : null;

  const today = weeklyPlan.find((d) => d.dayIndex === todayIndex) ?? null;

  let recommendedNextSession: RecommendedOption | null = null;
  if (recoveryTooLow) {
    const recoveryDay = weeklyPlan.find((d) => d.recovery) ?? today;
    if (recoveryDay) {
      recommendedNextSession = {
        session: recoveryDay,
        priorityMatch: "low",
        recoveryDemand: "low",
        reason: "Reserve score is too low for high-demand output today. Recovery protects the next priority session.",
        protects: "Priority catch-up is staged for when reserve is restored.",
        movesSessions: priorityMissed ? [priorityMissed.displayTitle] : [],
      };
    }
  } else if (hasPriorityDebt && priorityMissed) {
    const todayIsLower = today && !today.recovery && !sessionMatchesPriority(today, primary);
    recommendedNextSession = {
      session: priorityMissed,
      priorityMatch: "high",
      recoveryDemand: recoveryDemandFor(priorityMissed),
      reason: buildPriorityReasonCopy(primary, priorityMissed, todayIsLower ? today.displayTitle : null),
      protects: "Priority architecture stays intact. Support sessions slide without losing the week.",
      movesSessions: todayIsLower ? [today.displayTitle] : [],
    };
  } else if (today) {
    recommendedNextSession = {
      session: today,
      priorityMatch: matchLevelFor(today, primary),
      recoveryDemand: recoveryDemandFor(today),
      reason: today.recovery
        ? "Today is a scheduled recovery day. Reserve protects output with structured mobility and steps."
        : `Today's session aligns with your ${primary ? primary.replace(/-/g, " ") + " priority" : "active architecture"}.`,
      protects: today.recovery ? "Tomorrow's training window opens clean." : "Fuel and recovery stay matched to today's output.",
      movesSessions: [],
    };
  }

  const hasActiveOverride = Boolean(todayOverride);
  const scheduleStatus: ScheduleStatus =
    recoveryTooLow ? "recovery-protected"
    : hasPriorityDebt ? "priority-debt"
    : (hasActiveOverride || missedDays.length > 0) ? "flex-active"
    : "on-track";

  return {
    scheduleStatus,
    missedCount: missedDays.length,
    hasPriorityDebt,
    priorityDebtLabel,
    recoveryTooLow,
    recoveryReason,
    todayOverride,
    recommendedNextSession,
    calendarEntries,
  };
}
