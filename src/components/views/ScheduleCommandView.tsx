"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Dumbbell,
  Footprints,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  Utensils,
  Waves,
} from "lucide-react";
import { useMemo } from "react";

import { RECOVERY_REFERENCE_CLOCK, useRecoveryClock } from "@/components/recovery/useRecoveryClock";
import { FieldOpCard } from "@/components/schedule/FieldOpCard";
import { ScheduleRoomHero } from "@/components/schedule/ScheduleRoomHero";
import { SCHEDULE_TIMES_ID } from "@/components/schedule/schedule-times-anchor";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSelect } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { buildMealPlan, detectSleepConflict, formatTime12 } from "@/lib/schedule/engine";
import { SCHEDULE_SETUP_STEP, scheduleIsSet } from "@/lib/schedule/schedule-room";
import {
  MOBILITY_PREFERENCE_LABELS,
  TRAINING_WINDOW_LABELS,
  type MemberScheduleProfile,
  type MobilityPreference,
  type TrainingWindow,
} from "@/lib/schedule/types";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE COMMAND — the planning desk (Bible §09, living room V1.6).

   The hero leads: day status, statement, the one gold action and today's plan
   horizon toward sleep lock, inside the first screen. It takes the place of the
   old hero, the second gold "Open" action and the stacked Mission Timeline
   card, so the day is drawn once. The operating-times editor follows it, then
   the meal-window plan and recovery window, then the weekly cadence.

   Honesty (Bible §12):
     - Every panel reads today's training context from the one resolver, so a
       recovery day or a session moved away never shows a pre-workout meal or
       a sleep conflict for a session that is not happening.
     - A schedule the member has not set is labelled unset. Starting times stay
       editable, and "Use These Times" is the member's own confirmation.
     - The old headline and support copy ("Tonight's plan is set", "Fuel light,
       move clean…") read the training window alone and ignored the day; gone.
   ════════════════════════════════════════════════════════════════════════ */

const TRAINING_WINDOWS: TrainingWindow[] = ["morning", "midday", "afternoon", "evening", "night"];
const MOBILITY_PREFERENCES: MobilityPreference[] = ["pre-session", "post-session", "both", "as-needed"];

type TimeKey = "wakeTime" | "sleepTarget" | "preferredTrainingStart" | "preferredTrainingEnd";

export function ScheduleCommandView() {
  const profile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const completedSteps = useAthleteDashboardStore((s) => s.setupProfile.completedSteps);
  const updateScheduleProfile = useAthleteDashboardStore((s) => s.updateScheduleProfile);
  const updateMealWindow = useAthleteDashboardStore((s) => s.updateMealWindow);
  const markSetupStepComplete = useAthleteDashboardStore((s) => s.markSetupStepComplete);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  const now = useRecoveryClock();
  const clock = now ?? RECOVERY_REFERENCE_CLOCK;
  const { trainingContext, trainingPlanned } = useTodayTrainingDay(clock);
  const scheduleSet = scheduleIsSet(completedSteps);

  /* The same schedule-engine context the fuel plan (and so the hero's meals) is built from. */
  const meals = useMemo(() => buildMealPlan(profile, trainingContext), [profile, trainingContext]);
  const conflict = useMemo(() => detectSleepConflict(profile, { trainingPlanned }), [profile, trainingPlanned]);

  /** A member edit is the member setting their day. */
  function setTimes(updates: Partial<MemberScheduleProfile>) {
    updateScheduleProfile(updates);
    if (!scheduleSet) markSetupStepComplete(SCHEDULE_SETUP_STEP);
  }

  const conflictColor = conflict.severity === "none" ? RESERVE.green : RESERVE.amber;
  const conflictLabel = conflict.severity === "conflict" ? "Schedule Conflict" : conflict.severity === "compression" ? "Sleep Compression" : "Window Clear";

  const coreTimes: Array<{ label: string; key: TimeKey; value: string }> = [
    { label: "Wake Time", key: "wakeTime", value: profile.wakeTime },
    { label: "Sleep Target", key: "sleepTarget", value: profile.sleepTarget },
    { label: "Training Start", key: "preferredTrainingStart", value: profile.preferredTrainingStart },
    { label: "Training End", key: "preferredTrainingEnd", value: profile.preferredTrainingEnd },
  ];

  const cadence = [
    { label: "Training / wk", value: profile.trainingDaysPerWeek, icon: Dumbbell, color: RESERVE.gold },
    { label: "Cardio / wk", value: profile.cardioDaysPerWeek, icon: Footprints, color: RESERVE.steel },
    { label: "Abs / wk", value: profile.absDaysPerWeek, icon: Target, color: RESERVE.slate },
    { label: "Sauna / wk", value: profile.saunaDaysPerWeek, icon: Waves, color: RESERVE.violet },
  ];

  return (
    <ViewShell
      label="Schedule"
      title="Schedule Command"
      icon={CalendarClock}
      accentColor={RESERVE.gold}
      roomHero
      command="Your wake, training and sleep times, and the next thing on today's plan."
    >
      <ScheduleRoomHero />

      {/* Today's lifestyle op: walk, daylight, wind-down — harm prevention sets the gate first. */}
      <FieldOpCard />

      {/* OPERATING TIMES — the editor every "Set Your Day" and "Adjust …" action brings into view.
          Top-aligned, so a short cadence panel never stretches into an empty box.
          Phones: every panel below is a flush section with plain rows (`phone="flush"`, `md:` tiles). */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div id={SCHEDULE_TIMES_ID} tabIndex={-1} className="scroll-mt-4 rounded-[22px] outline-none">
          <GlassPanel accent={RESERVE.steel} phone="flush">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock size={14} style={{ color: RESERVE.steel }} aria-hidden="true" />
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: RESERVE.steel }}>Operating Times</h2>
            </div>
            {!scheduleSet && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-l border-white/[0.14] pl-3">
                <p className="max-w-[46ch] text-[12.5px] leading-[1.5] text-white/70">
                  Not set yet. These are starting times until you change one or confirm them.
                </p>
                <ReserveButton tier="secondary" size="md" accent={RESERVE.steel} onClick={() => markSetupStepComplete(SCHEDULE_SETUP_STEP)}>
                  Use These Times
                </ReserveButton>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 md:gap-2.5">
              {coreTimes.map((f) => (
                /* Plain label over its field: the panel is the only rim, the input carries its own. */
                <label key={f.key} className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">{f.label}</span>
                  <input
                    type="time"
                    value={f.value}
                    data-schedule-field={f.key}
                    onChange={(e) => setTimes({ [f.key]: e.target.value })}
                    className="mt-1.5 min-h-[44px] w-full rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[16px] font-semibold text-[#f2eee6] outline-none focus:border-white/[0.3] focus-visible:ring-2 focus-visible:ring-[#e8c87a] sm:text-[13px]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <ReserveSelect
                label="Training Window"
                value={profile.trainingWindow}
                options={TRAINING_WINDOWS.map((w) => ({ value: w, label: TRAINING_WINDOW_LABELS[w] }))}
                onChange={(v) => setTimes({ trainingWindow: v as TrainingWindow })}
              />
              <ReserveSelect
                label="Mobility Preference"
                value={profile.mobilityPreference}
                options={MOBILITY_PREFERENCES.map((m) => ({ value: m, label: MOBILITY_PREFERENCE_LABELS[m] }))}
                onChange={(v) => setTimes({ mobilityPreference: v as MobilityPreference })}
              />
            </div>
            <p className="mt-3 text-[11px] leading-[1.5] text-white/50">Today&apos;s plan, meal windows and sleep lock are drawn from these times.</p>
          </GlassPanel>
        </div>

        <GlassPanel accent={RESERVE.violet} phone="flush">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={14} style={{ color: RESERVE.violet }} aria-hidden="true" />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: RESERVE.violet }}>Weekly Cadence</h2>
          </div>
          {scheduleSet ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {cadence.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="border-l border-white/[0.08] pl-3">
                      <div className="flex items-center gap-1.5">
                        <Icon size={12} style={{ color: c.color }} aria-hidden="true" />
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">{c.label}</p>
                      </div>
                      <p className="tnum mt-1 text-[18px] font-black leading-none text-[#f2eee6]">{c.value}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Mobility</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/75">
                  {MOBILITY_PREFERENCE_LABELS[profile.mobilityPreference]} · {profile.preSessionMobilityMinutes} min primer
                </p>
              </div>
            </>
          ) : (
            <p className="text-[12.5px] leading-[1.5] text-white/65">
              Evidence needed · weekly frequencies appear once your day is set. Set them in Settings.
            </p>
          )}
        </GlassPanel>
      </div>

      {/* MEAL WINDOW PLAN + RECOVERY WINDOW */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <GlassPanel accent={RESERVE.green} phone="flush">
          <div className="mb-3 flex items-center gap-2">
            <Utensils size={14} style={{ color: RESERVE.green }} aria-hidden="true" />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: RESERVE.green }}>Meal Window Plan</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {/* In the day's order: an early session can move a window (the anchor becomes dinner). */}
            {[...profile.mealWindows]
              .sort((a, b) => (meals.find((m) => m.id === a.id)?.dayMinutes ?? Infinity) - (meals.find((m) => m.id === b.id)?.dayMinutes ?? Infinity))
              .map((w) => {
              const planned = meals.find((m) => m.id === w.id);
              return (
                <div key={w.id} className="flex items-center justify-between gap-3 py-1.5 md:py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12.5px] font-bold text-[#f2eee6]">{planned?.label ?? w.label}</p>
                      {planned?.optional && (
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: `${RESERVE.amber}40`, color: RESERVE.amber }}>
                          Optional
                        </span>
                      )}
                    </div>
                    {w.enabled && planned ? (
                      <p className="tnum mt-0.5 text-[11.5px] text-white/60">{formatTime12(planned.time)}{planned.note ? ` · ${planned.note}` : ""}</p>
                    ) : w.enabled ? (
                      <p className="mt-0.5 text-[11.5px] text-white/55">Not planned today</p>
                    ) : (
                      <p className="mt-0.5 text-[11.5px] text-white/50">Off</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateMealWindow(w.id, { enabled: !w.enabled })}
                    aria-pressed={w.enabled}
                    aria-label={`${planned && planned.label !== w.label ? `${planned.label} (${w.label} window)` : w.label} ${w.enabled ? "on" : "off"}`}
                    className="min-h-[44px] min-w-[52px] shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c87a]"
                    style={{
                      background: w.enabled ? "rgba(110,231,183,0.14)" : "rgba(255,255,255,0.04)",
                      border: w.enabled ? "1px solid rgba(110,231,183,0.4)" : "1px solid rgba(255,255,255,0.1)",
                      color: w.enabled ? RESERVE.green : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {w.enabled ? "On" : "Off"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-[1.5] text-white/50">
            Pre- and post-workout meals are timed around the training window on a day that trains. No meal is planned past the sleep target.
          </p>
        </GlassPanel>

        <GlassPanel accent={conflictColor} phone="flush">
          <div className="mb-3 flex items-center gap-2">
            {conflict.conflict ? (
              <AlertTriangle size={14} style={{ color: conflictColor }} aria-hidden="true" />
            ) : (
              <Moon size={14} style={{ color: conflictColor }} aria-hidden="true" />
            )}
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: conflictColor }}>Recovery Window</h2>
          </div>
          <div className="border-l pl-3" style={{ borderColor: `${conflictColor}59` }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: conflictColor }}>{conflictLabel}</p>
            {trainingPlanned ? (
              <p className="tnum mt-1.5 text-[12px] leading-[1.5] text-white/70">
                {formatTime12(profile.preferredTrainingEnd)} training end → {formatTime12(profile.sleepTarget)} sleep target.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] leading-[1.5] text-white/70">No session is planned today.</p>
            )}
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-white/60">
              {trainingPlanned ? conflict.message : `Sleep target ${formatTime12(profile.sleepTarget)}.`}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Wake → Sleep</p>
              <p className="tnum mt-0.5 text-[12px] font-bold text-white/80">{formatTime12(profile.wakeTime)} – {formatTime12(profile.sleepTarget)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Training End → Sleep</p>
              <p className="tnum mt-0.5 text-[12px] font-bold" style={{ color: trainingPlanned ? conflictColor : "rgba(255,255,255,0.7)" }}>
                {!trainingPlanned ? "No session today" : conflict.gapMinutes <= 0 ? "Past sleep target" : `${conflict.gapMinutes} min`}
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* SETTINGS LINK */}
      <GlassPanel accent={RESERVE.slate} phone="flush">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SettingsIcon size={14} style={{ color: RESERVE.slate }} aria-hidden="true" />
            <div>
              <p className="text-[12.5px] font-bold text-[#f2eee6]">Schedule defaults</p>
              <p className="text-[11.5px] text-white/60">Edit meal-window default times, weekly frequencies, and activities in Settings.</p>
            </div>
          </div>
          <ReserveButton tier="quiet" size="md" iconAfter={ArrowRight} onClick={() => setActiveView("settings")}>
            Open Settings
          </ReserveButton>
        </div>
      </GlassPanel>
    </ViewShell>
  );
}
