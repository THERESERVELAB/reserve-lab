"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Moon, Sun } from "lucide-react";
import { useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { localDateKey } from "@/lib/recovery/types";
import { formSnapshot } from "@/lib/ui/form-close-guard";
import {
  BEDTIME_WINDOW,
  SLEEP_STEP_MINUTES,
  WAKE_WINDOW,
  formatDuration,
  minutesToHours,
  positionToTime,
  sleepMinutes,
  targetLine,
  timeToPosition,
} from "@/lib/recovery/sleep-window";
import { formatTime12 } from "@/lib/schedule/engine";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveDetailImage, useReportDirty } from "@/components/ui/reserve";

import { recordRecoveryLog } from "./record-recovery-log";

const GOLD = "#d5b15f";
const VIOLET = "#a78bfa";
const GREEN = "#79e3b5";

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[#f2eee6] outline-none transition-colors focus:border-[#a78bfa]/40 placeholder:text-white/18";

/** Where a slider rests before the member touches it. It is never saved from there. */
const RESTING_BEDTIME = "22:30";
const RESTING_WAKE = "06:30";

/**
 * One end of the night. Dragging sets it; until then it reads "Slide to set"
 * and the night cannot be saved.
 */
function TimeSlider({
  label,
  icon,
  value,
  resting,
  window,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  resting: string;
  window: { startHour: number; span: number };
  onChange: (time: string) => void;
}) {
  const set = value !== "";
  const position = timeToPosition(set ? value : resting, window);
  const startLabel = formatTime12(positionToTime(0, window));
  const endLabel = formatTime12(positionToTime(window.span, window));
  const fill = `${(position / window.span) * 100}%`;

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
          {icon}
          {label}
        </span>
        <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: set ? "#f2eee6" : "rgba(255,255,255,0.28)" }}>
          {set ? formatTime12(value) : "Slide to set"}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={window.span}
        step={SLEEP_STEP_MINUTES}
        value={position}
        aria-valuetext={set ? formatTime12(value) : "Not set"}
        onChange={(e) => onChange(positionToTime(Number(e.target.value), window))}
        /* Touching the thumb where it already rests is a real answer too —
           otherwise a night that matches the resting spot could never be set. */
        onPointerUp={() => { if (!set) onChange(positionToTime(position, window)); }}
        className="reserve-sleep-range mt-3 h-11 w-full cursor-pointer"
        style={{ "--fill": fill, "--accent": set ? VIOLET : "rgba(255,255,255,0.3)" } as React.CSSProperties}
      />
      <span className="mt-0.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </span>
    </label>
  );
}

/** Sleep logger — drag to when you fell asleep and woke, or enter a total.
    Record keeping and trend observation only. */
/** `detail`: the sleep-suite band above the log. Recovery's section carries it; a bottom sheet does not. */
/** `onDirtyChange`: told whether the night holds unsaved entries, for a sheet that guards its close. */
export function SleepLoggerCard({ detail = false, onDirtyChange }: { detail?: boolean; onDirtyChange?: (dirty: boolean) => void } = {}) {
  const logSleep = useAthleteDashboardStore((s) => s.logSleep);
  const sleepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs);
  const sleepTargetHours = useAthleteDashboardStore((s) => s.recoveryCommand.sleepTargetHours);
  const scheduleSleep = useAthleteDashboardStore((s) => s.scheduleProfile.sleepTarget);
  const scheduleWake = useAthleteDashboardStore((s) => s.scheduleProfile.wakeTime);

  const [mode, setMode] = useState<"times" | "manual">("times");
  const [detailed, setDetailed] = useState(false);
  /* Nothing is pre-filled: a night is saved only from times the member set or
     confirmed. "Use my schedule" is that confirmation, one tap on a phone. */
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [deepSleep, setDeepSleep] = useState("");
  const [quality, setQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  /* Clean again after a save: the sheet stays open showing the saved night. */
  const entered = formSnapshot({ bedtime, wakeTime, manualHours, deepSleep, quality, notes });
  const [savedEntries, setSavedEntries] = useState(entered);
  useReportDirty(entered !== savedEntries, onDirtyChange);

  const today = localDateKey();
  const todayLog = useMemo(() => sleepLogs.find((l) => l.date === today), [sleepLogs, today]);

  const nightMinutes = mode === "times" ? sleepMinutes(bedtime, wakeTime) : null;
  const manual = Number(manualHours);
  const computedHours = mode === "times" ? (nightMinutes != null ? minutesToHours(nightMinutes) : null) : manual > 0 ? manual : null;
  const shownMinutes = mode === "times" ? nightMinutes : computedHours != null ? Math.round(computedHours * 60) : null;
  const canSave = computedHours != null && computedHours > 0 && computedHours <= 16;
  const saveBlockedReason = mode === "times"
    ? bedtime === "" && wakeTime === ""
      ? "Slide to when you fell asleep and when you woke up."
      : bedtime === ""
        ? "Slide to when you fell asleep."
        : wakeTime === ""
          ? "Slide to when you woke up."
          : "That night is longer than 16 hours — check both times."
    : "Enter the hours you slept.";
  const scheduleTimes = /^\d{1,2}:\d{2}$/.test(scheduleSleep ?? "") && /^\d{1,2}:\d{2}$/.test(scheduleWake ?? "");
  const scheduleApplied = bedtime === scheduleSleep && wakeTime === scheduleWake;
  const vsTarget = shownMinutes != null ? targetLine(shownMinutes, sleepTargetHours) : null;

  function save() {
    if (!canSave || computedHours == null) return;
    recordRecoveryLog("sleep", () => logSleep({
      date: today,
      hours: computedHours,
      bedtime: mode === "times" ? bedtime : undefined,
      wakeTime: mode === "times" ? wakeTime : undefined,
      deepSleepHours: detailed && Number(deepSleep) > 0 ? Number(deepSleep) : undefined,
      quality: detailed && quality != null ? quality : undefined,
      notes: detailed && notes.trim() ? notes.trim().slice(0, 280) : undefined,
    }));
    setSaved(true);
    setSavedEntries(entered);
    setTimeout(() => setSaved(false), 2600);
  }

  return (
    <GlassPanel accent={VIOLET} phone="flush">
      {detail && <ReserveDetailImage id="sleep-suite" className={DETAIL_BAND_BLEED} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Moon size={13} style={{ color: VIOLET }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${VIOLET}cc` }}>Sleep Log</p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Drag to when you fell asleep and when you woke. Reserve works out the night. Record keeping and trend observation only.
          </p>
        </div>
      </div>

      {todayLog && !saved && (
        <p className="mt-3 text-[11px] text-white/45">
          Logged for last night: <span className="font-bold text-[#f2eee6]">{formatDuration(Math.round(todayLog.hours * 60))}</span>
          {todayLog.bedtime && todayLog.wakeTime ? ` · ${formatTime12(todayLog.bedtime)} → ${formatTime12(todayLog.wakeTime)}` : ""}
          {todayLog.quality != null ? ` · quality ${todayLog.quality}/10` : ""} — saving again replaces it.
        </p>
      )}

      {/* The night, read at a glance. */}
      {/* Rimless and untinted: this sits inside the Sleep Log panel, so it groups by
          light and spacing — a hairline of violet — never a box (no card in a card). */}
      <div className="relative mt-5 pt-3.5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${VIOLET}66, ${VIOLET}00 70%)` }} />
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Last night</p>
        <p aria-live="polite" data-log-readout="sleep" className="mt-1 text-[34px] font-black leading-none tracking-tight tabular-nums" style={{ color: shownMinutes != null ? "#f2eee6" : "rgba(255,255,255,0.22)" }}>
          {shownMinutes != null ? formatDuration(shownMinutes) : "—"}
        </p>
        <p className="mt-1.5 text-[11px] text-white/45">
          {mode === "times" && bedtime && wakeTime ? `${formatTime12(bedtime)} → ${formatTime12(wakeTime)}` : null}
          {mode === "times" && bedtime && wakeTime && vsTarget ? " · " : null}
          {vsTarget ?? (shownMinutes == null ? `Your target is ${formatDuration(Math.round(sleepTargetHours * 60))}` : null)}
        </p>
      </div>

      {mode === "times" ? (
        <div className="mt-4 flex flex-col gap-5">
          {scheduleTimes && !scheduleApplied && (
            <button
              type="button"
              onClick={() => { setBedtime(scheduleSleep); setWakeTime(scheduleWake); }}
              className="min-h-[44px] w-full rounded-xl border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] transition hover:bg-white/[0.04]"
              style={{ borderColor: `${VIOLET}40`, color: VIOLET }}
            >
              Same as my schedule · {formatTime12(scheduleSleep)} → {formatTime12(scheduleWake)}
            </button>
          )}
          <TimeSlider label="Fell asleep" icon={<Moon size={10} />} value={bedtime} resting={RESTING_BEDTIME} window={BEDTIME_WINDOW} onChange={setBedtime} />
          <TimeSlider label="Woke up" icon={<Sun size={10} />} value={wakeTime} resting={RESTING_WAKE} window={WAKE_WINDOW} onChange={setWakeTime} />
          <button type="button" onClick={() => setMode("manual")} className="self-start font-mono text-[8px] uppercase tracking-[0.16em] text-white/35 underline decoration-white/15 underline-offset-4 transition hover:text-white/60">
            Only know the total?
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Total hours slept</span>
            <input
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              placeholder="e.g. 7.5"
              inputMode="decimal"
              className={`mt-1.5 w-32 ${inputCls} text-center`}
            />
          </label>
          <button type="button" onClick={() => setMode("times")} className="self-start font-mono text-[8px] uppercase tracking-[0.16em] text-white/35 underline decoration-white/15 underline-offset-4 transition hover:text-white/60">
            Set bedtime and wake instead
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetailed((v) => !v)}
        className="mt-4 min-h-[40px] rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70"
      >
        {detailed ? "Hide detail" : "Add quality, deep sleep or a note"}
      </button>

      {detailed && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
          <label className="block">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Deep sleep (h)</span>
            <input
              value={deepSleep}
              onChange={(e) => setDeepSleep(e.target.value)}
              placeholder="e.g. 1.5"
              inputMode="decimal"
              className={`mt-1.5 ${inputCls} text-center`}
            />
          </label>
          <div>
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Sleep quality</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const v = i + 1;
                const active = quality === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setQuality(active ? null : v)}
                    aria-pressed={active}
                    className="h-9 w-9 rounded-lg border font-mono text-[11px] transition"
                    style={{
                      borderColor: active ? `${GOLD}55` : "rgba(255,255,255,0.07)",
                      background: active ? `${GOLD}16` : "rgba(255,255,255,0.02)",
                      color: active ? GOLD : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block sm:col-span-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              placeholder="Optional — late meal, travel, stress…"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>
        </div>
      )}

      <div data-log-row="sleep" className="mt-4">
        {saved ? (
          <p role="status" className="flex min-h-[48px] items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: GREEN }}>
            <CheckCircle2 size={14} />Night saved
          </p>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={save}
            disabled={!canSave}
            className="min-h-[48px] w-full rounded-xl px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: `linear-gradient(160deg, ${VIOLET}, #8b6fe0)` }}
          >
            Save Sleep
          </motion.button>
        )}
        {!canSave && !saved && <p className="mt-2 text-center text-[10.5px] text-white/40">{saveBlockedReason}</p>}
      </div>
    </GlassPanel>
  );
}
