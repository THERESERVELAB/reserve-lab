"use client";

import { Activity, Footprints, HeartPulse, Moon, Sun } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { recordSteps } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { daysBetween } from "@/lib/cycle/cycle-period";
import { localDateKey } from "@/lib/dates/local-day";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { buildFieldOp } from "@/lib/lifestyle/field-op";
import { formatTime12 } from "@/lib/schedule/engine";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";

import { FieldOpLive } from "./FieldOpLive";

/** Check-ins older than this don't set today's gate. */
const CHECK_IN_CURRENT_DAYS = 14;

/**
 * FIELD OP — today's lifestyle mission in Schedule: a walk with duration,
 * distance and a heart-rate range, daylight and a wind-down. Harm prevention
 * sets the gate before any target.
 */
export function FieldOpCard() {
  const now = useClientNow();
  if (!now) return null;
  return <FieldOpBody now={now} />;
}

function FieldOpBody({ now }: { now: Date }) {
  const profile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const age = useAthleteDashboardStore((s) => s.setupProfile.age);
  const checkIns = useAthleteDashboardStore((s) => s.cycleCheckIns);
  const mobilityLogs = useAthleteDashboardStore((s) => s.recoveryCommand.mobilityLogs);
  const stepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.stepLogs);
  const logSteps = useAthleteDashboardStore((s) => s.logSteps);
  const [stepsDraft, setStepsDraft] = useState("");
  const stepsId = useId();
  const { trainingPlanned } = useTodayTrainingDay();
  const ctx = useSafetyContext(now);
  const [live, setLive] = useState(false);

  const today = localDateKey(now);
  const op = useMemo(() => {
    const latest = [...(checkIns ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const current = latest && daysBetween(latest.date, today) <= CHECK_IN_CURRENT_DAYS ? latest : null;
    return buildFieldOp({
      today,
      age,
      wakeTime: profile.wakeTime,
      sleepTime: profile.sleepTarget,
      trainingTime: profile.preferredTrainingStart,
      isTrainingDay: trainingPlanned,
      cardioDaysPerWeek: profile.cardioDaysPerWeek,
      latestCheckIn: current ? { date: current.date, systolic: current.systolic, diastolic: current.diastolic, restingHr: current.restingHr } : null,
      hematocritFlagged: (ctx.labBrief.findings ?? []).some((f) => f.markerKey === "hematocrit"),
      warningSignsReported: ctx.escalation.some((e) => e.level === "emergency" || e.level === "crisis"),
      walkedMinutesToday: (mobilityLogs ?? []).filter((m) => m.kind === "walk" && m.date === today).reduce((sum, m) => sum + m.minutes, 0),
      stepsToday: (stepLogs ?? []).find((l) => l.date === today)?.steps,
    });
  }, [checkIns, today, age, profile, trainingPlanned, ctx, mobilityLogs, stepLogs]);

  const saveSteps = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(stepsDraft.replace(/[^\d]/g, ""));
    if (!stepsDraft.trim() || !Number.isFinite(value)) return;
    recordSteps(() => logSteps(today, value), today);
    setStepsDraft("");
  };
  const stepsPct = op.steps.target && op.steps.today !== null ? Math.min(100, Math.round((op.steps.today / op.steps.target.low) * 100)) : 0;

  const gateColor = op.gate === "care-today" ? RESERVE.red : op.gate === "easy-only" ? RESERVE.amber : RESERVE.steel;

  return (
    <GlassPanel accent={gateColor}>
      <section aria-label="Field Op" className="flex flex-col gap-4" data-field-op="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="type-whisper" style={{ color: alpha(gateColor, 0.9) }}>
              Field Op{op.walk?.startTime ? ` · ${formatTime12(op.walk.startTime)}` : ""}{op.done ? " · complete" : ""}
            </p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>
              {op.gate === "care-today"
                ? "Get care today"
                : op.walk
                  ? `${op.gate === "easy-only" ? "Easy walk" : "Zone 2 walk"} · ${op.walk.minutes} min · ~${op.walk.miles} mi`
                  : "Today's lifestyle op"}
            </h3>
          </div>
          {op.walk && !op.done && (
            <ReserveButton tier="secondary" size="sm" icon={Footprints} onClick={() => setLive(true)}>
              Start op
            </ReserveButton>
          )}
        </div>

        {op.gateReason && (
          <p role={op.gate === "care-today" ? "alert" : undefined} className="text-[12.5px] leading-[1.55]" style={{ color: op.gate === "care-today" ? RESERVE.red : RESERVE.amber }}>
            {op.gateReason}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {op.walk && (
            <li className="flex gap-3 py-2.5">
              <HeartPulse size={15} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: RESERVE.steel }} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                  {op.walk.heartRate ? `Keep heart rate ${op.walk.heartRate.low}–${op.walk.heartRate.high} bpm` : "Easy, conversational pace"}
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.5] text-white/60">
                  {op.walk.heartRate
                    ? op.walk.heartRate.method === "heart-rate-reserve"
                      ? "Moderate intensity from your age and the resting heart rate in your latest check-in."
                      : "Moderate intensity from your age. Log a resting heart rate in a check-in for a closer range."
                    : "No heart-rate target while a reading needs a look."}{" "}
                  {op.walk.why}
                </p>
              </div>
            </li>
          )}
          {op.steps.target && (
            <li className="flex gap-3 py-2.5">
              <Activity size={15} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: RESERVE.green }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                  {op.steps.today !== null
                    ? `${op.steps.today.toLocaleString("en-US")} of ${op.steps.target.low.toLocaleString("en-US")}–${op.steps.target.high.toLocaleString("en-US")} steps`
                    : `Steps · ${op.steps.target.low.toLocaleString("en-US")}–${op.steps.target.high.toLocaleString("en-US")} a day`}
                </p>
                {op.steps.today !== null && (
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Steps toward the lower end of the range" aria-valuenow={stepsPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full" style={{ width: `${stepsPct}%`, background: RESERVE.green }} />
                  </div>
                )}
                <p className="mt-1 text-[12px] leading-[1.5] text-white/60">
                  {op.steps.text}{op.steps.walkAdds ? ` Today's walk is about ${op.steps.walkAdds.toLocaleString("en-US")} steps.` : ""}
                </p>
                <form onSubmit={saveSteps} className="mt-2 flex items-center gap-2">
                  <label htmlFor={stepsId} className="sr-only">Steps today</label>
                  <input
                    id={stepsId}
                    value={stepsDraft}
                    onChange={(e) => setStepsDraft(e.target.value.replace(/[^\d,]/g, "").slice(0, 7))}
                    inputMode="numeric"
                    placeholder={op.steps.today !== null ? "Update steps" : "Steps today"}
                    className="min-h-[40px] w-32 rounded-[12px] border border-white/[0.1] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none focus:border-[#6ee7b7]/60 sm:text-[13px]"
                  />
                  {stepsDraft.trim() ? (
                    <ReserveButton tier="secondary" size="sm" type="submit">Save</ReserveButton>
                  ) : (
                    <ReserveButton tier="secondary" size="sm" disabled disabledReason="Enter today's step count first.">Save</ReserveButton>
                  )}
                </form>
              </div>
            </li>
          )}
          <li className="flex gap-3 py-2.5">
            <Sun size={15} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: RESERVE.gold }} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                {op.daylight.minutes} min of daylight{op.daylight.startTime ? ` from ${formatTime12(op.daylight.startTime)}` : ""}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.5] text-white/60">{op.daylight.text}</p>
            </div>
          </li>
          <li className="flex gap-3 py-2.5">
            <Moon size={15} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: RESERVE.violet }} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                Wind down{op.windDown.time ? ` at ${formatTime12(op.windDown.time)}` : ""}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.5] text-white/60">{op.windDown.text}</p>
            </div>
          </li>
        </ul>

        <ReserveDisclosure summary="Sources" accent={RESERVE.slate}>
          <ul className="flex flex-col gap-1">
            {op.sources.map((src) => (
              <li key={src.label} className="text-[11px] leading-[1.5] text-white/45">
                {src.url ? <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2">{src.label}</a> : src.label}
              </li>
            ))}
            <li className="text-[11px] leading-[1.5] text-white/45">Heart-rate ranges are estimates. Some medicines, including beta blockers, change heart rate during exercise.</li>
          </ul>
        </ReserveDisclosure>
      </section>

      <FieldOpLive op={op} open={live} onClose={() => setLive(false)} />
    </GlassPanel>
  );
}
