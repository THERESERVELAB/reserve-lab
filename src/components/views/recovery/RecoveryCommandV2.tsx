"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Droplet,
  Footprints,
  Gauge,
  Moon,
  Sparkles,
  TrendingUp,
  Waves,
  Wind,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { RecoveryHorizonStrip } from "@/components/recovery/RecoveryHorizonStrip";
import { RecoveryTargetsSheet } from "@/components/recovery/RecoveryTargetsSheet";
import { WaterLogger } from "@/components/recovery/WaterLogger";
import { focusRecoverySleepLog } from "@/components/recovery/sleep-log-anchor";
import { markDone } from "@/components/ui/reserve/log-moment/recorders";
import { RECOVERY_REFERENCE_CLOCK, useRecoveryClock } from "@/components/recovery/useRecoveryClock";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED_GLASS, ReserveButton, ReserveDetailImage, ReserveDisclosure, ReserveSection } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { useProtocolWeek } from "@/lib/hooks/useProtocolWeek";
import { buildRecoverySnapshot, buildRecoverySuite, buildRecoveryTimeline, RESERVE_CALIBRATION_DAYS } from "@/lib/recovery/engine";
import {
  RECOVERY_RESET_DONE_LABEL,
  RECOVERY_RESET_MIN,
  resolveRecoveryPrimaryAction,
  type RecoveryPrimaryAction,
} from "@/lib/recovery/primary-action";
import { buildRecoveryHorizon, type RecoveryHorizonAction } from "@/lib/recovery/tonight-horizon";
import { localDateKey, type MomentumState, type SuiteRecommendation } from "@/lib/recovery/types";
import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import {
  detectSleepConflict,
  formatTime12,
  localScheduleDateKey,
  resolveTrainingScheduleContext,
} from "@/lib/schedule/engine";
import { getTodayTrainingWeekDay } from "@/lib/training/weekly-split";

const C = {
  GREEN: "#6ee7b7",
  GOLD: "#d5b15f",
  STEEL: "#5fb7d5",
  VIOLET: "#a78bfa",
  AMBER: "#e8c87a",
  RED: "#ef7d55",
  SLATE: "#8ea0b8",
  IVORY: "#f2eee6",
};

/** Log dates match the recovery engine's own local date key. Called from handlers only, never during render. */
function todayISO(): string {
  return localDateKey(new Date());
}

const MOMENTUM_WORD: Record<MomentumState, string> = {
  improving: "Improving",
  stable: "Stable",
  slipping: "Slipping",
  "data-limited": "Evidence needed",
};

function Dial({ value, label, color, size = 110 }: { value: number; label: string; color: string; size?: number }) {
  const r = size * 0.34;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.06} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.06} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black leading-none" style={{ color }}>{value || "—"}</span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">{label}</span>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

function StatTile({ label, value, sub, color, icon: Icon, readout }: { label: string; value: string; sub: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; readout?: string }) {
  return (
    /* A read on a left rule in its own colour, not a tinted tile: the room's panels are the only surfaces. */
    <div className="border-l py-1 pl-3.5" style={{ borderColor: `${color}40` }}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">{label}</p>
        <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ borderColor: `${color}33`, background: `${color}12`, color }}><Icon size={12} /></span>
      </div>
      <p data-log-readout={readout} className="mt-2 text-xl font-black leading-none" style={{ color }}>{value}</p>
      <p className="mt-1.5 text-[10px] leading-[1.4] text-white/45">{sub}</p>
    </div>
  );
}

function SectionHead({ kicker, title, icon: Icon, color }: { kicker: string; title: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ borderColor: `${color}30`, background: `${color}12`, color }}><Icon size={14} /></span>
      <div>
        <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color }}>{kicker}</p>
        <h3 className="text-[15px] font-black uppercase tracking-tight" style={{ color: C.IVORY }}>{title}</h3>
      </div>
    </div>
  );
}

const SUITE_BADGE: Record<SuiteRecommendation, { label: string; color: string }> = {
  recommended: { label: "Recommended", color: C.GREEN },
  optional: { label: "Optional", color: C.STEEL },
  "not-needed": { label: "Not Needed", color: C.SLATE },
  skipped: { label: "Skipped", color: C.SLATE },
};

/**
 * The Recovery hero leads the screen: the Reserve dial, the one gold action,
 * and tonight's horizon, all inside the first screen at 1440×1000 and
 * 390×844. `afterHero` is the secondary region that sits directly below it.
 *
 * Owner direction 2026-09-19 ("keep it more minimalist"): the room shows
 * three things — the hero, one row of readouts, and one Log section (sleep
 * and water side by side). Everything that explains the readouts lives
 * behind one "Recovery detail" disclosure: nothing deleted, only folded.
 */
export function RecoveryCommandV2({
  afterHero,
  sleepLog,
  detail,
}: {
  afterHero?: React.ReactNode;
  /** The sleep logger: sits beside water in the room's one Log section. */
  sleepLog?: React.ReactNode;
  /** More detail from the view, folded behind the same disclosure. */
  detail?: React.ReactNode;
}) {
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const logMobility = useAthleteDashboardStore((s) => s.logMobility);
  const toggleRecoverySuiteTool = useAthleteDashboardStore((s) => s.toggleRecoverySuiteTool);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const trainingOverrides = useAthleteDashboardStore((s) => s.trainingOverrides);
  const sleepConflict = useMemo(() => detectSleepConflict(scheduleProfile), [scheduleProfile]);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const openTargets = useCallback(() => setTargetsOpen(true), []);
  const closeTargets = useCallback(() => setTargetsOpen(false), []);

  /* ONE clock. Server and first client render read the fixed reference, so the
     markup matches; the real clock arrives after mount and ticks per minute. */
  const now = useRecoveryClock();
  const clock = now ?? RECOVERY_REFERENCE_CLOCK;

  const snapshot = useMemo(() => buildRecoverySnapshot(recoveryCommand, clock), [recoveryCommand, clock]);
  const suite = useMemo(() => buildRecoverySuite(snapshot, recoveryCommand, clock), [snapshot, recoveryCommand, clock]);
  const timeline = useMemo(() => {
    const todayKey = localDateKey(clock);
    /* The engine reads the wall clock for this one cell; read the screen's clock instead. */
    return buildRecoveryTimeline(recoveryCommand, snapshot).map((row, i) =>
      i === 0 ? { ...row, mobility: recoveryCommand.mobilityLogs.some((m) => m.date === todayKey) ? "Logged" : "—" } : row,
    );
  }, [recoveryCommand, snapshot, clock]);

  /* Tonight's horizon: the schedule engine's markers for the day the program
     plans (a recovery day or a moved session has no handoff), plus the suite. */
  const { week } = useProtocolWeek(clock);
  const recoveryDay = week.length > 0 ? getTodayTrainingWeekDay(week).recovery : false;
  const trainingContext = useMemo(
    () => resolveTrainingScheduleContext(trainingOverrides, localScheduleDateKey(clock)),
    [trainingOverrides, clock],
  );
  const horizon = useMemo(
    () =>
      now
        ? buildRecoveryHorizon({
            now,
            schedule: scheduleProfile,
            trainingContext,
            recoveryDay,
            /* No logs, no suite items: nothing on the horizon is inferred from absent evidence. */
            suite: snapshot.hasLogs ? suite : [],
          })
        : null,
    [now, scheduleProfile, trainingContext, recoveryDay, snapshot.hasLogs, suite],
  );

  const sleepLoggedToday = recoveryCommand.sleepLogs.some((log) => log.date === localScheduleDateKey(clock));
  const plan = resolveRecoveryPrimaryAction({ snapshot, suite, sleepLoggedToday });

  const reserveColor = snapshot.hasData ? snapshot.reserveColor : C.SLATE;
  const debtColor = snapshot.debt.overall === "clear" ? C.GREEN : snapshot.debt.overall === "building" ? C.AMBER : C.RED;
  const momentumColor = snapshot.momentum === "improving" ? C.GREEN : snapshot.momentum === "slipping" ? C.RED : C.STEEL;

  /** Marks a suite tool done. Never un-marks one — the gold action only records. */
  function completeTool(toolId: string) {
    if (!suite.some((tool) => tool.id === toolId && tool.completed)) toggleSuiteTool(toolId);
  }

  /** Toggles a suite tool and marks the moment: "Cold Plunge done" / "Cold Plunge not done". */
  function toggleSuiteTool(toolId: string) {
    const tool = suite.find((t) => t.id === toolId);
    toggleRecoverySuiteTool(toolId);
    if (tool) markDone({ key: `suite:${toolId}`, label: tool.name, done: !tool.completed });
  }

  function runPrimary(action: RecoveryPrimaryAction) {
    switch (action.kind) {
      case "open-sleep-log":
        focusRecoverySleepLog();
        break;
      case "log-hydration":
        recordRecoveryLog("water", () => logHydration({ date: todayISO(), oz: action.oz }));
        break;
      case "log-mobility":
        recordRecoveryLog("mobility", () => logMobility({ date: todayISO(), kind: "recovery", minutes: action.minutes, focus: "Reset" }));
        completeTool(action.toolId);
        break;
      case "complete-suite-tool":
        completeTool(action.toolId);
        break;
    }
  }

  function runHorizonAction(action: RecoveryHorizonAction) {
    switch (action.kind) {
      case "toggle-suite-tool":
        toggleSuiteTool(action.toolId);
        break;
      case "log-hydration":
        recordRecoveryLog("water", () => logHydration({ date: todayISO(), oz: action.oz }));
        break;
      case "open-view":
        setActiveView(action.view);
        break;
    }
  }

  const hero = (
    /* Phones: a flush section inside the page gutter, not a card (components.md rule 1). */
    <GlassPanel accent={reserveColor} noPad phone="flush" className="md:overflow-hidden">
      <div data-recovery="hero" className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex items-center gap-4 pb-3 pt-4 md:gap-5 md:border-b md:border-white/[0.06] md:p-5 lg:border-b-0 lg:border-r">
          <Dial value={snapshot.hasData ? snapshot.reserve : 0} label="Reserve" color={reserveColor} size={104} />
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">Recovery Reserve</p>
            {snapshot.hasData ? (
              <>
                <p className="mt-1 text-[22px] font-black uppercase leading-tight tracking-tight" style={{ color: snapshot.reserveColor }}>{snapshot.reserveLabel}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: momentumColor }}>
                  <TrendingUp size={12} aria-hidden="true" />Momentum · {MOMENTUM_WORD[snapshot.momentum]}
                </p>
                <p className="mt-1.5 max-w-[36ch] text-[11px] leading-[1.45] text-white/55" data-recovery-evidence>
                  {snapshot.calibrating
                    ? `${snapshot.daysLogged} of ${RESERVE_CALIBRATION_DAYS} days logged. The read settles once your record covers a few days. Not medical data.`
                    : "From your logged sleep, water, mobility and check-ins. Not medical data."}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[22px] font-black uppercase leading-tight tracking-tight" style={{ color: C.IVORY }}>Evidence needed</p>
                <p className="mt-1.5 max-w-[36ch] text-[11px] leading-[1.45] text-white/55">
                  {snapshot.evidence === "limited"
                    ? `Reserve reads at least two kinds of log. So far: ${snapshot.inputsLogged.join(", ")}. Nothing here is estimated.`
                    : "Reserve is built only from what you log. Nothing here is estimated."}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="pb-1 pt-2 md:p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: C.GOLD }}>
            {snapshot.hasLogs ? "Next recovery action" : "First log"}
          </p>
          {/* The room's statement: on phones it is the one big headline, above the title line. */}
          <p data-recovery="action-title" data-room-statement className="mt-1.5 text-[24px] font-black uppercase leading-[1.02] tracking-tight [text-wrap:balance] sm:text-[22px]" style={{ color: C.IVORY }}>
            {plan.title}
          </p>
          <p className="mt-1.5 max-w-[56ch] text-[12.5px] leading-[1.5] text-white/60">{plan.reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {/* The screen's one gold action (Bible §11). */}
            <div data-recovery="primary-action">
              <ReserveButton
                tier="primary"
                size="md"
                iconAfter={plan.primary.kind === "open-sleep-log" ? ArrowRight : undefined}
                onClick={() => runPrimary(plan.primary)}
              >
                {plan.primary.label}
              </ReserveButton>
            </div>
            {plan.secondary && (
              <ReserveButton tier="secondary" size="md" accent={RESERVE.steel} onClick={() => runPrimary(plan.secondary!)}>
                {plan.secondary.label}
              </ReserveButton>
            )}
          </div>
          {!snapshot.hasLogs && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-white/55">Behavioral tracking only · not medical data</p>
          )}
        </div>
      </div>

      <RecoveryHorizonStrip horizon={horizon} onAction={runHorizonAction} />
    </GlassPanel>
  );

  /* The room's one Log section: water first (the quick, frequent log), then
     sleep. One column: a log's confirmation always finds a clear place. */
  const logSection = (
    <ReserveSection label="Log" accent={RESERVE.violet}>
      <div className="grid gap-4">
        <div data-log-moment-guard>
        <GlassPanel accent={C.STEEL}>
          <ReserveDetailImage id="hydration-bar" width="half" className={DETAIL_BAND_BLEED_GLASS} />
          <WaterLogger onEditTargets={openTargets} />
          <p className="mt-3 text-[11px] leading-[1.5] text-white/50">{snapshot.hydrationStatus === "data-limited" ? "No water logged yet. Add a log." : `7-day adherence ${snapshot.hydrationAdherence}% · ${snapshot.hydrationStatus === "on-target" ? "On target" : "Behind pace today"}.`}</p>
        </GlassPanel>
        </div>
        {sleepLog}
      </div>
    </ReserveSection>
  );

  /* No evidence yet: the hero leads with the first log, and nothing below it
     pretends to measure anything. */
  /* One tree whether or not anything is logged yet: the Log section keeps its
     place, so a member's first save keeps its confirmation instead of the
     logger remounting in a new layout. With no evidence, nothing above or
     behind it pretends to measure anything. */
  return (
    <div data-room-sections className="flex flex-col gap-4">
      {hero}
      {afterHero}

      {/* COMMAND GRID */}
      {snapshot.hasLogs && (
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 xl:grid-cols-4">
        <StatTile readout="sleep" label="Sleep" value={snapshot.sleepLastNight !== null ? `${snapshot.sleepLastNight}h` : "—"} sub={snapshot.sleepLastNight !== null ? `7-day avg ${snapshot.sleepAvg7}h · ${snapshot.sleepConsistency}` : "No sleep logged"} color={C.VIOLET} icon={Moon} />
        <StatTile readout="water" label="Hydration" value={snapshot.hydrationStatus === "on-target" ? "On Target" : snapshot.hydrationStatus === "behind-pace" ? "Behind" : "—"} sub={`${snapshot.hydrationTodayOz} / ${snapshot.hydrationTargetOz} oz today`} color={C.STEEL} icon={Droplet} />
        <StatTile readout="mobility" label="Mobility" value={`${snapshot.mobilityThisWeek} / ${snapshot.mobilityWeeklyTarget}`} sub={snapshot.mobilityStreak > 0 ? `${snapshot.mobilityStreak}-day streak` : "Sessions this week"} color={C.GOLD} icon={Waves} />
        <StatTile label="Stress Load" value={snapshot.stressLoadLabel} sub={`Recovery debt: ${snapshot.debt.overall}`} color={snapshot.stressLoadColor} icon={Activity} />
      </div>
      )}

      {logSection}

      {(snapshot.hasLogs || detail) && (
      <ReserveDisclosure summary="Recovery detail" accent={RESERVE.violet}>
      <div className="flex flex-col gap-4 pt-2">
      {snapshot.hasLogs && (
      <>
      {/* RECOVERY DEBT */}
      <GlassPanel accent={debtColor}>
        <SectionHead kicker="What's Quietly Slowing Progress" title="Recovery Debt" icon={Gauge} color={debtColor} />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            snapshot.debt.sleepDebtHours === null
              ? { label: "Sleep Debt", value: "Not logged", color: C.SLATE }
              : { label: "Sleep Debt", value: `${snapshot.debt.sleepDebtHours >= 0 ? "+" : ""}${snapshot.debt.sleepDebtHours}h`, color: snapshot.debt.sleepDebtHours < -2 ? C.RED : snapshot.debt.sleepDebtHours < 0 ? C.AMBER : C.GREEN },
            { label: "Hydration Debt", value: `${snapshot.debt.hydrationMissed} missed`, color: snapshot.debt.hydrationMissed >= 2 ? C.AMBER : C.GREEN },
            snapshot.debt.mobilityMissed === null
              ? { label: "Mobility Debt", value: "Not logged", color: C.SLATE }
              : { label: "Mobility Debt", value: `${snapshot.debt.mobilityMissed} short`, color: snapshot.debt.mobilityMissed >= 2 ? C.AMBER : C.GREEN },
            snapshot.debt.trainingFatigue === "unknown"
              ? { label: "Training Fatigue", value: "Evidence needed", color: C.SLATE }
              : { label: "Training Fatigue", value: snapshot.debt.trainingFatigue, color: snapshot.debt.trainingFatigue === "high" ? C.RED : snapshot.debt.trainingFatigue === "elevated" ? C.AMBER : C.GREEN },
          ].map((row) => (
            <div key={row.label} className="py-1">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/40">{row.label}</p>
              <p className="mt-1 text-[15px] font-black capitalize" style={{ color: row.color }}>{row.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] leading-[1.5] text-white/40">Overall recovery debt: <span className="font-semibold capitalize" style={{ color: debtColor }}>{snapshot.debt.overall}</span>. These are observations from your logged data, not a diagnosis.</p>
      </GlassPanel>

      {/* SLEEP + MOBILITY */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel accent={C.VIOLET}>
          <SectionHead kicker="Sleep Pillar" title="Sleep Command" icon={Moon} color={C.VIOLET} />
          <div className="grid grid-cols-3 gap-2">
            <div className="py-1 text-center"><p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/40">Last Night</p><p className="mt-1 text-lg font-black" style={{ color: C.VIOLET }}>{snapshot.sleepLastNight !== null ? `${snapshot.sleepLastNight}h` : "—"}</p></div>
            <div className="py-1 text-center"><p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/40">7-Day Avg</p><p className="mt-1 text-lg font-black" style={{ color: C.VIOLET }}>{snapshot.sleepLastNight !== null ? `${snapshot.sleepAvg7}h` : "—"}</p></div>
            <div className="py-1 text-center"><p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/40">Consistency</p><p className="mt-1 text-[13px] font-black capitalize" style={{ color: snapshot.sleepConsistency === "strong" ? C.GREEN : C.AMBER }}>{snapshot.sleepConsistency === "data-limited" ? "—" : snapshot.sleepConsistency}</p></div>
          </div>
          <p className="mt-3 text-[11px] leading-[1.5] text-white/50">Recovery impact: <span className="font-semibold capitalize" style={{ color: snapshot.sleepImpact === "supporting" ? C.GREEN : snapshot.sleepImpact === "limiting" ? C.RED : C.SLATE }}>{snapshot.sleepImpact}</span>.</p>
        </GlassPanel>

        <GlassPanel accent={C.GOLD}>
          <SectionHead kicker="First-Class Recovery System" title="Mobility Command" icon={Waves} color={C.GOLD} />
          <div className="flex items-center justify-between">
            <div><p className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/40">This Week</p><p className="text-2xl font-black" style={{ color: C.GOLD }}>{snapshot.mobilityThisWeek} <span className="text-sm text-white/40">/ {snapshot.mobilityWeeklyTarget}</span></p></div>
            <button type="button" onClick={() => recordRecoveryLog("mobility", () => logMobility({ date: todayISO(), kind: "recovery", minutes: RECOVERY_RESET_MIN, focus: "Reset" }))} className="rounded-xl border px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] transition after:absolute after:inset-x-0 after:-inset-y-[8px] after:content-['']" style={{ position: "relative", zIndex: 1, borderColor: `${C.GOLD}40`, background: `${C.GOLD}12`, color: C.GOLD }}>+ {RECOVERY_RESET_DONE_LABEL}</button>
          </div>
          <div className="mt-3"><Bar value={(snapshot.mobilityThisWeek / snapshot.mobilityWeeklyTarget) * 100} color={C.GOLD} /></div>
          <p className="mt-2 text-[11px] leading-[1.5] text-white/50">
            {snapshot.mobilityStreak > 0 ? `${snapshot.mobilityStreak}-day streak · ` : ""}Your target: {snapshot.mobilityWeeklyTarget} a week ·{" "}
            <button type="button" onClick={openTargets} className="underline decoration-white/25 underline-offset-2 hover:text-white/70">Edit target</button>
          </p>
        </GlassPanel>
      </div>

      {/* STRESS */}
      <div className="grid gap-4">
        <GlassPanel accent={snapshot.stressLoadColor}>
          <SectionHead kicker="Behavioral Stress Load" title="Stress Load" icon={Wind} color={snapshot.stressLoadColor} />
          <p className="text-2xl font-black uppercase tracking-tight" style={{ color: snapshot.stressLoadColor }}>{snapshot.stressLoadLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: C.RED }}>Increasing</p>
              <ul className="mt-1 space-y-0.5">{snapshot.stressIncreasing.length ? snapshot.stressIncreasing.map((s) => <li key={s} className="text-[10.5px] text-white/55">· {s}</li>) : <li className="text-[10.5px] text-white/35">· None flagged</li>}</ul>
            </div>
            <div>
              <p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: C.GREEN }}>Reducing</p>
              <ul className="mt-1 space-y-0.5">{snapshot.stressReducing.map((s) => <li key={s} className="text-[10.5px] text-white/55">· {s}</li>)}</ul>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* RECOVERY INTELLIGENCE */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel accent={C.GREEN}>
          <SectionHead kicker="Supporting Recovery" title="What's Helping" icon={CheckCircle2} color={C.GREEN} />
          <ul className="space-y-2">{snapshot.helping.length ? snapshot.helping.map((i) => <li key={i.id} className="py-1"><p className="text-[11.5px] font-semibold text-white/75">{i.label}</p><p className="mt-0.5 text-[10px] leading-[1.4] text-white/45">{i.detail}</p></li>) : <li className="text-[11px] text-white/40">Log more to surface what helps.</li>}</ul>
        </GlassPanel>
        <GlassPanel accent={C.RED}>
          <SectionHead kicker="Limiting Recovery" title="What's Hurting" icon={AlertTriangle} color={C.RED} />
          <ul className="space-y-2">{snapshot.hurting.length ? snapshot.hurting.map((i) => <li key={i.id} className="py-1"><p className="text-[11.5px] font-semibold text-white/75">{i.label}</p><p className="mt-0.5 text-[10px] leading-[1.4] text-white/45">{i.detail}</p></li>) : <li className="text-[11px] text-white/40">Nothing flagged right now.</li>}</ul>
        </GlassPanel>
        <GlassPanel accent={C.GOLD}>
          <SectionHead kicker="One Move That Matters" title="Biggest Opportunity" icon={Sparkles} color={C.GOLD} />
          {snapshot.opportunity ? (
            /* Grouped by light, not a tinted box inside the panel (components.md rule 1). */
            <div className="relative pl-3.5">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px" style={{ background: `linear-gradient(180deg, ${C.GOLD}99, ${C.GOLD}00)` }} />
              <p className="text-[13px] font-black uppercase tracking-tight" style={{ color: C.GOLD }}>{snapshot.opportunity.label}</p>
              <p className="mt-1 text-[11px] leading-[1.5] text-white/55">{snapshot.opportunity.detail}</p>
            </div>
          ) : <p className="text-[11px] text-white/40">More data needed.</p>}
        </GlassPanel>
      </div>

      {/* RECOVERY SUITE V2 */}
      <GlassPanel accent={C.GREEN}>
        <ReserveDetailImage id="recovery-plunge" className={DETAIL_BAND_BLEED_GLASS} />
        <SectionHead kicker="Context-Aware Tools" title="Recovery Suite" icon={Sparkles} color={C.GREEN} />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {suite.map((tool) => {
            const badge = SUITE_BADGE[tool.recommendation];
            return (
              <button key={tool.id} type="button" onClick={() => toggleSuiteTool(tool.id)} className="rounded-2xl border p-3.5 text-left transition" style={{ borderColor: tool.completed ? `${C.GREEN}45` : "rgba(255,255,255,0.07)", background: tool.completed ? `${C.GREEN}0e` : "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold" style={{ color: C.IVORY }}>{tool.name}</p>
                  {tool.completed ? <CheckCircle2 size={14} style={{ color: C.GREEN }} /> : <Circle size={12} className="text-white/25" />}
                </div>
                <span className="mt-1.5 inline-block rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ borderColor: `${badge.color}40`, background: `${badge.color}12`, color: badge.color }}>{badge.label}</span>
                <p className="mt-1.5 text-[10px] leading-[1.4] text-white/45">{tool.reason}</p>
                <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">{tool.durationLabel}</p>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* POST-TRAINING HANDOFF + TIMELINE */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel accent={C.STEEL}>
          <SectionHead kicker="After Training" title="Post-Session Recovery Handoff" icon={Footprints} color={C.STEEL} />
          {/* Grouped by light, not a tinted box inside the panel (components.md rule 1). */}
          <div className="relative mb-4 pl-3.5">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px" style={{ background: `linear-gradient(180deg, ${sleepConflict.conflict ? C.AMBER : C.STEEL}99, ${sleepConflict.conflict ? C.AMBER : C.STEEL}00)` }} />
            <p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: sleepConflict.conflict ? C.AMBER : C.STEEL }}>Night Routine Window</p>
            <p className="mt-1 text-[11px] leading-[1.45] text-white/60">{formatTime12(scheduleProfile.preferredTrainingEnd)} training end → {formatTime12(scheduleProfile.sleepTarget)} sleep target. {sleepConflict.message}</p>
          </div>
          <ul className="space-y-1.5">
            {[
              "Hydrate to today's remaining target",
              "Protein anchor + carbs in the recovery window",
              (snapshot.debt.mobilityMissed ?? 0) >= 1 ? "Gentle mobility reset (no aggressive stretching after heavy lifting)" : "Light mobility only if needed",
              snapshot.stressLoad === "elevated" || snapshot.stressLoad === "high" ? "Downshift: walk or breathwork" : "Optional breathwork downshift",
              (snapshot.debt.sleepDebtHours ?? 0) < -1.5 ? "Protect sleep window — debt is building" : "Honor your sleep window",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[11.5px] leading-[1.5] text-white/60"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: C.STEEL }} />{line}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setActiveView("training")} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-[8.5px] uppercase tracking-[0.18em] transition" style={{ borderColor: `${C.STEEL}40`, background: `${C.STEEL}12`, color: C.STEEL }}>Open Training Recovery Suite<ArrowRight size={12} /></button>
        </GlassPanel>

        <GlassPanel accent={C.GOLD} noPad className="overflow-hidden">
          <div className="p-5 pb-0"><SectionHead kicker="Today · Week · Momentum" title="Recovery Timeline" icon={TrendingUp} color={C.GOLD} /></div>
          <div className="overflow-x-auto p-5 pt-2">
            <table className="w-full text-left text-[11px]">
              <thead><tr className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">
                <th className="pb-2 pr-2 font-normal">Window</th><th className="pb-2 pr-2 font-normal">Sleep</th><th className="pb-2 pr-2 font-normal">Hydration</th><th className="pb-2 pr-2 font-normal">Mobility</th><th className="pb-2 pr-2 font-normal">Stress</th><th className="pb-2 font-normal">Recovery</th>
              </tr></thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.label} className="border-t border-white/[0.05]">
                    <td className="py-2 pr-2 font-semibold text-white/70">{row.label}</td>
                    <td className="py-2 pr-2 text-white/55">{row.sleep}</td>
                    <td className="py-2 pr-2 text-white/55">{row.hydration}</td>
                    <td className="py-2 pr-2 text-white/55">{row.mobility}</td>
                    <td className="py-2 pr-2 text-white/55">{row.stress}</td>
                    <td className="py-2 font-bold" style={{ color: C.GOLD }}>{row.recovery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>

      </>
      )}
      {detail}
      </div>
      </ReserveDisclosure>
      )}

      <RecoveryTargetsSheet open={targetsOpen} onClose={closeTargets} />
    </div>
  );
}
