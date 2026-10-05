"use client";

import { AlertTriangle, ArrowRight, Calendar, RotateCcw, Shuffle } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import type { ResolvedDay } from "@/lib/training/daily-context";
import {
  resolveTrainingScheduleRecovery,
  type ScheduleStatus,
} from "@/lib/training/schedule-recovery";
import { localDateKey } from "@/lib/dates/local-day";

/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE FLEX PANEL — the schedule notice in Training Command.

   Full mode speaks only when there is something to act on: missed
   exposures, priority debt, a recovery-protected day, an override, a
   reset, or a catch-up day the member selected. On schedule it renders
   nothing — the week rail carries the week. Compact mode (live and after
   the session) keeps the seven-day status strip.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const STEEL = "#5fb7d5";
const AMBER = "#e8954a";
const GREEN = "#5fb784";
const RED = "#ef7d55";
const VIOLET = "#a78bfa";

type Props = {
  weeklyPlan: ResolvedDay[];
  todayIndex: number;
  sessionResetNote: string | null;
  onSelectDay: (dayIndex: number) => void;
  onClearReset: () => void;
  /** Compact strip mode — shows only the 7-day calendar and status. Used in live/post-session views. */
  compact?: boolean;
  /** The day the member has selected (defaults to today). When != today, the panel
      reflects a catch-up selection instead of claiming "today". */
  selectedDayIndex?: number;
  /** Undo a just-performed Reset Session (restores the live session snapshot). */
  onUndo?: () => void;
  /** Whether an undoable reset snapshot exists. */
  canUndo?: boolean;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusAccent(status: ScheduleStatus): string {
  if (status === "priority-debt") return AMBER;
  if (status === "recovery-protected") return STEEL;
  if (status === "flex-active") return VIOLET;
  return GOLD;
}

function statusLabel(status: ScheduleStatus): string {
  if (status === "priority-debt") return "Priority Catch-Up Available";
  if (status === "recovery-protected") return "Recovery Protected";
  if (status === "flex-active") return "Schedule Flex Active";
  return "On Schedule";
}

export function ScheduleFlexPanel({ weeklyPlan, todayIndex, sessionResetNote, onSelectDay, onClearReset, compact, selectedDayIndex, onUndo, canUndo }: Props) {
  const isCatchUp = selectedDayIndex !== undefined && selectedDayIndex !== todayIndex;
  const selectedRow = selectedDayIndex !== undefined ? weeklyPlan.find((d) => d.dayIndex === selectedDayIndex) : undefined;
  const trainingOverrides = useAthleteDashboardStore((s) => s.trainingOverrides);
  const actualWeeks = useAthleteDashboardStore((s) => s.actualWeeks);
  const clearTrainingOverride = useAthleteDashboardStore((s) => s.clearTrainingOverride);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);

  const todayKey = localDateKey();

  const recovery = useMemo(() => {
    const snap = buildRecoverySnapshot(recoveryCommand, new Date());
    return { reserve: snap.hasData ? snap.reserve : null, hasData: snap.hasData };
  }, [recoveryCommand]);

  const scheduleRec = useMemo(() =>
    resolveTrainingScheduleRecovery({
      now: new Date(),
      weeklyPlan,
      todayIndex,
      overrides: trainingOverrides,
      actualWeeks,
      focus: physiqueCommand.focus,
      recoveryReserve: recovery.reserve,
      hasRecoveryData: recovery.hasData,
    }),
    [weeklyPlan, todayIndex, trainingOverrides, actualWeeks, physiqueCommand.focus, recovery]
  );

  const { scheduleStatus, hasPriorityDebt, recoveryTooLow, recoveryReason, todayOverride, recommendedNextSession, calendarEntries } = scheduleRec;

  const accent = statusAccent(scheduleStatus);
  const isOnTrack = scheduleStatus === "on-track" && !sessionResetNote;

  if (compact) {
    return (
      <GlassPanel accent={accent} noPad className="overflow-hidden">
        <div className="relative px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={11} style={{ color: accent }} />
              <p className="font-mono text-[7.5px] uppercase tracking-[0.24em]" style={{ color: accent }}>
                Week · {statusLabel(scheduleStatus)}
              </p>
            </div>
            {hasPriorityDebt && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={9} style={{ color: AMBER }} />
                <p className="font-mono text-[7px] uppercase tracking-[0.14em]" style={{ color: AMBER }}>Catch-Up Available</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarEntries.map(({ day, status }) => {
              const isToday = day.dayIndex === todayIndex;
              const isComplete = status === "completed";
              const isPartial = status === "partial";
              const isMissed = status === "missed" || status === "skipped" || status === "not-ready" || status === "accidental-start";
              const isRec = status === "recovery";
              const dotColor = isComplete ? GREEN : isPartial ? GOLD : isMissed ? RED : isRec ? STEEL : status === "rescheduled" || status === "swapped" ? VIOLET : isToday ? accent : "rgba(255,255,255,0.2)";
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  onClick={() => onSelectDay(day.dayIndex)}
                  title={day.displayTitle}
                  className="flex flex-col items-center gap-0.5 rounded-lg p-1 transition-all hover:bg-white/[0.05]"
                  style={isToday ? { background: `${accent}14`, outline: `1px solid ${accent}44` } : {}}
                >
                  <p className="font-mono text-[6.5px] uppercase tracking-[0.1em]" style={{ color: isToday ? accent : isMissed ? RED : "rgba(255,255,255,0.3)" }}>
                    {DAY_LABELS[day.dayIndex]}
                  </p>
                  <div className="h-1 w-1 rounded-full" style={{ background: dotColor }} />
                </button>
              );
            })}
          </div>
        </div>
      </GlassPanel>
    );
  }

  function handlePickUp() {
    if (!recommendedNextSession) return;
    onSelectDay(recommendedNextSession.session.dayIndex);
  }

  function handleStartOver() {
    clearTrainingOverride(todayKey);
    onClearReset();
  }

  /* "Pick up" only when it moves the member somewhere: a recommended day that
     is already the selected day would be a button that does nothing. */
  const currentDay = selectedDayIndex ?? todayIndex;
  const canPickUp = Boolean(recommendedNextSession && !isOnTrack && recommendedNextSession.session.dayIndex !== currentDay);

  /* Nothing to decide: the week rail already shows the week and the hero names
     today's session, so this panel says nothing. */
  const needsDecision = Boolean(sessionResetNote || todayOverride || hasPriorityDebt || recoveryTooLow || isCatchUp || canPickUp);
  if (!needsDecision) return null;

  const heading = sessionResetNote
    ? "Session reset"
    : isCatchUp && isOnTrack
      ? "Catch-up selected"
      : statusLabel(scheduleStatus);
  const message = sessionResetNote
    ? `${sessionResetNote} No training data was recorded.`
    : isCatchUp && isOnTrack && selectedRow
      ? `${selectedRow.displayTitle} is selected as a catch-up. The week stays intact.`
      : hasPriorityDebt
        ? scheduleRec.priorityDebtLabel
        : recoveryTooLow
          ? recoveryReason
          : todayOverride
            ? `${todayOverride.originalSessionTitle} was ${todayOverride.action === "rescheduled" ? "moved" : "set aside"}. Reserve is protecting the split.`
            : recommendedNextSession?.reason ?? null;
  const detail = hasPriorityDebt && !sessionResetNote ? recommendedNextSession?.reason ?? null : null;

  /* ── Schedule notice: one line, one reason, secondary actions only. ──
     The room's one gold action is Start Session in the hero; nothing here
     competes with it (Bible §11). No tiles inside the panel: it is a single
     flush section with plain text and quiet controls. */
  return (
    <GlassPanel accent={accent} phone="flush">
      <section aria-label="Schedule" data-training="schedule-flex">
        <div className="flex items-center gap-2">
          {hasPriorityDebt || recoveryTooLow ? (
            <AlertTriangle size={12} aria-hidden="true" style={{ color: accent }} />
          ) : (
            <Calendar size={12} aria-hidden="true" style={{ color: accent }} />
          )}
          <h2 className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: accent }}>
            {heading}
          </h2>
        </div>
        {message && <p className="mt-2 max-w-[72ch] text-[13px] font-semibold leading-[1.5] text-[#f2eee6]">{message}</p>}
        {detail && detail !== message && <p className="mt-1 max-w-[72ch] text-[12px] leading-[1.55] text-white/55">{detail}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sessionResetNote && canUndo && onUndo && (
            <ReserveButton tier="secondary" size="sm" icon={RotateCcw} onClick={onUndo}>
              Undo · Restore Session
            </ReserveButton>
          )}
          {canPickUp && (
            <ReserveButton tier="secondary" size="sm" icon={ArrowRight} onClick={handlePickUp}>
              Pick Up Where I Left Off
            </ReserveButton>
          )}
          {(sessionResetNote || todayOverride) && (
            <ReserveButton tier="quiet" size="sm" icon={RotateCcw} onClick={handleStartOver}>
              {sessionResetNote ? "Clear Override" : "Restore"}
            </ReserveButton>
          )}
          {isCatchUp && (
            <ReserveButton tier="quiet" size="sm" icon={Shuffle} onClick={() => onSelectDay(todayIndex)}>
              Today&apos;s Session
            </ReserveButton>
          )}
        </div>
      </section>
    </GlassPanel>
  );
}
