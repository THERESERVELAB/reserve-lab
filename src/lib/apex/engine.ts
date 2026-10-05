/* ────────────────────────────────────────────────────────────────────────────
   APEX COMMAND V2 — ENGINE

   The command layer above every feature. Reuses the AI Strategist briefing
   (no duplicated logic) and adds Apex-specific structures: today's mission,
   the momentum board, the weekly operating snapshot, and hero metrics.
   Deterministic, behavioral-only, no medical/compound claims.
   ──────────────────────────────────────────────────────────────────────── */

import { buildStrategistBriefing, type StrategistContext } from "@/lib/ai-strategist/engine";
import type { StrategistBriefing } from "@/lib/ai-strategist/types";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { buildPhysiqueGuidance } from "@/lib/physique/engine";
import {
  buildTodaySchedule,
  classifyTrainingDaypart,
  detectSleepConflict,
  formatTime12,
  getScheduleNextAction,
  nextUpcomingIndex,
  timeToMinutes,
  type TrainingDaypart,
} from "@/lib/schedule/engine";

const COLOR = {
  green: "#6ee7b7",
  gold: "#d5b15f",
  steel: "#5fb7d5",
  violet: "#a78bfa",
  amber: "#e8c87a",
  red: "#ef7d55",
  slate: "#8ea0b8",
};

export type ApexMetric = { label: string; value: string; color: string };

export type ApexBadge = { label: string; color: string };

export type ApexHero = {
  /** Short command-status eyebrow. */
  eyebrow: string;
  /** One strong, sharp sentence. */
  headline: string;
  /** Max 1–2 short lines of supporting command brief. */
  support: string;
  /** Compact status badges (mission + live risk flags). */
  badges: ApexBadge[];
};

export type ApexMomentumState = "improving" | "stable" | "staged" | "watch" | "slipping" | "conflict" | "data-limited";

export type ApexMomentumRow = { label: string; state: ApexMomentumState; color: string };

export type ApexMission = {
  training: string;
  nutrition: string;
  recovery: string;
  physique: string;
  scheduleContext: string;
  priority: string;
};

export type ApexSnapshotRow = { label: string; value: string; color: string };

/* ─── Live intelligence layer ──────────────────────────────────────────── */

export type ApexPhase =
  | "pre-day"
  | "morning-build"
  | "midday-execution"
  | "pre-training"
  | "training-window"
  | "post-session"
  | "recovery-window"
  | "night-recovery"
  | "sleep-protection";

export type ApexLiveState =
  | "on-track"
  | "ahead"
  | "behind"
  | "needs-action"
  | "schedule-conflict"
  | "recovery-watch"
  | "data-limited";

export type ApexLiveStatus = {
  phase: ApexPhase;
  phaseLabel: string;
  state: ApexLiveState;
  stateLabel: string;
  stateColor: string;
  reason: string;
  /** 0–100 progress through the waking day (wake → sleep target). */
  dayProgress: number;
  /** Live clock label, e.g. "7:42 PM". */
  clockLabel: string;
  /** "Pre-Workout Meal" — the window the member is currently inside, if any. */
  currentWindow: string;
  /** Next scheduled item label + minutes away. */
  nextItem: string;
  nextItemInMinutes: number | null;
};

export type ApexNextMove = {
  title: string;
  whyNow: string;
  /** "Active now" / "Next 30 minutes" / "Next 48 min". */
  timeSensitivity: string;
  /** 2–4 ordered micro-steps. */
  stack: string[];
  buttonLabel: string;
  target?: string;
};

export type ApexScoreState = "good" | "watch" | "bad" | "neutral";
export type ApexScoreItem = { label: string; value: string; state: ApexScoreState; color: string };

export type ApexCommandBrief = { status: string; priority: string; limiter: string; nextMove: string };

export type ApexActionItem = { label: string; sublabel: string; target: string };

export type ApexSignal = { detail: string; color: string };

export type ApexView = {
  briefing: StrategistBriefing;
  hero: ApexHero;
  live: ApexLiveStatus;
  nextMove: ApexNextMove;
  scoreboard: ApexScoreItem[];
  commandBrief: ApexCommandBrief;
  actionCenter: ApexActionItem[];
  latestSignal: ApexSignal;
  heroMetrics: ApexMetric[];
  mission: ApexMission;
  momentum: ApexMomentumRow[];
  weeklySnapshot: ApexSnapshotRow[];
};

const MOMENTUM_COLOR: Record<ApexMomentumState, string> = {
  improving: COLOR.green,
  stable: COLOR.steel,
  staged: COLOR.steel,
  watch: COLOR.amber,
  slipping: COLOR.red,
  conflict: COLOR.amber,
  "data-limited": COLOR.slate,
};

const MOMENTUM_LABEL: Record<ApexMomentumState, string> = {
  improving: "Improving",
  stable: "Stable",
  staged: "Staged",
  watch: "Watch",
  slipping: "Slipping",
  conflict: "Conflict Tonight",
  "data-limited": "Data Limited",
};

export function momentumLabel(state: ApexMomentumState): string {
  return MOMENTUM_LABEL[state];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const DAYPART_PHRASE: Record<TrainingDaypart, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

/** Strip leading command verbs so a metric value reads as a clean noun. */
function shortenAction(title: string): string {
  const stripped = title.replace(/^(Prepare|Begin|Start|Open|Log|Hit|Complete)\s+/i, "").trim();
  return stripped.length ? stripped : title;
}

function humanGap(mins: number): string {
  if (mins <= 0) return "now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function targetButton(target?: string): string {
  switch (target) {
    case "training": return "Open Training Command";
    case "nutrition": return "Open Nutrition Command";
    case "recovery": return "Open Recovery Command";
    case "physique": return "Open Physique Command";
    case "schedule-command": return "Open Schedule Command";
    default: return "Open Command";
  }
}

const WHY_NOW: Record<string, string> = {
  "Pre-Dawn": "Pre-session fuel window is open.",
  Morning: "Morning fuel window is open.",
  "Pre-Training": "Pre-workout fuel window is active.",
  "Pre-Session": "Pre-session readiness window is active.",
  Training: "You're in your training window.",
  "Post-Session": "Post-session recovery window is active.",
  Midday: "Midday meal window is open.",
  "Wind-Down": "Wind-down toward the sleep target.",
  Overnight: "It's before your wake time.",
  Night: "Past your sleep target — protect sleep.",
};

const PHASE_REASON: Record<ApexPhase, string> = {
  "pre-day": "The day hasn't started. Rest is doing the work.",
  "morning-build": "Morning build. Fuel, hydrate, and set up the session.",
  "midday-execution": "Midday execution. Keep meals and hydration on pace.",
  "pre-training": "Pre-training window. Fuel and run the readiness check.",
  "training-window": "Training is in its window. Execute clean.",
  "post-session": "Training is complete. Recovery handoff is now the priority.",
  "recovery-window": "Post-session recovery window is active.",
  "night-recovery": "Night recovery. Downshift and protect the sleep window.",
  "sleep-protection": "Past the sleep target. Protect sleep to bank tomorrow's readiness.",
};

const PHASE_LABEL: Record<ApexPhase, string> = {
  "pre-day": "Pre-Day",
  "morning-build": "Morning Build",
  "midday-execution": "Midday Execution",
  "pre-training": "Pre-Training",
  "training-window": "Training Window",
  "post-session": "Post-Session",
  "recovery-window": "Recovery Window",
  "night-recovery": "Night Recovery",
  "sleep-protection": "Sleep Protection",
};

const STATE_META: Record<ApexLiveState, { label: string; color: string }> = {
  "on-track": { label: "On Track", color: COLOR.green },
  ahead: { label: "Ahead", color: COLOR.green },
  behind: { label: "Behind", color: COLOR.amber },
  "needs-action": { label: "Needs Action", color: COLOR.gold },
  "schedule-conflict": { label: "Schedule Conflict", color: COLOR.amber },
  "recovery-watch": { label: "Recovery Watch", color: COLOR.amber },
  "data-limited": { label: "Data Limited", color: COLOR.slate },
};

const SCORE_COLOR: Record<ApexScoreState, string> = {
  good: COLOR.green,
  watch: COLOR.amber,
  bad: COLOR.red,
  neutral: COLOR.slate,
};

/** Current position in the day → live phase. Schedule-aware (morning vs night). */
function derivePhase(
  cur: number,
  wake: number,
  trainStart: number,
  trainEnd: number,
  sleepAdj: number,
  daypart: TrainingDaypart,
): ApexPhase {
  const earlyTraining = daypart === "morning" || daypart === "midday";
  const preTrainAt = trainStart - 40;
  const postEnd = trainEnd + 45;
  const windDownAt = daypart === "night" || daypart === "evening" ? trainEnd + 45 : sleepAdj - 75;

  if (cur < wake) return "sleep-protection";
  if (cur >= sleepAdj) return "sleep-protection";
  if (cur >= preTrainAt && cur < trainStart) return "pre-training";
  if (cur >= trainStart && cur < trainEnd) return "training-window";
  if (cur >= trainEnd && cur < postEnd) return "post-session";
  if (cur >= postEnd) {
    if (cur >= windDownAt) return "night-recovery";
    return earlyTraining ? "midday-execution" : "recovery-window";
  }
  // Between wake and the pre-training lead-in.
  return cur < 11 * 60 + 30 ? "morning-build" : "midday-execution";
}

/** Ordered micro-step stack for the next move, keyed off the action window. */
function actionStack(windowLabel: string, conflict: boolean): string[] {
  switch (windowLabel) {
    case "Pre-Dawn":
    case "Morning":
      return ["Hydrate on wake", "Take the protein anchor / light fuel", "Set up pre-session"];
    case "Pre-Training":
      return ["Eat the pre-workout meal", "Hydrate", "Prep pre-session"];
    case "Pre-Session":
      return ["Run the readiness check", "Mobility primer", "Hydrate before lifting"];
    case "Training":
      return ["Execute the session", "Log working sets", "Stay hydrated"];
    case "Post-Session":
      return conflict
        ? ["Hydrate to target", "Light post-workout meal", "Downshift fast", "Protect the sleep window"]
        : ["Hydrate to target", "Post-workout meal", "Downshift"];
    case "Midday":
      return ["Hit the midday meal", "Keep protein on pace", "Hydrate"];
    case "Wind-Down":
      return ["Hydrate", "Log a meal only if needed", "Downshift", "Protect the sleep window"];
    case "Overnight":
    case "Night":
    default:
      return ["Dim and downshift", "Protect the sleep window", "Let recovery run"];
  }
}

const PHASE_ACTIONS: Record<ApexPhase, ApexActionItem[]> = {
  "pre-day": [
    { label: "Protect Sleep Window", sublabel: "Rest builds tomorrow's readiness", target: "recovery" },
    { label: "Review Today's Plan", sublabel: "See the day's operating plan", target: "schedule-command" },
  ],
  "morning-build": [
    { label: "Log Morning Protein Anchor", sublabel: "Start the day fueled", target: "nutrition" },
    { label: "Hydration Check", sublabel: "Open the recovery handoff", target: "recovery" },
    { label: "Review Today's Plan", sublabel: "Confirm the training window", target: "schedule-command" },
  ],
  "midday-execution": [
    { label: "Hit Your Midday Meal", sublabel: "Keep protein on pace", target: "nutrition" },
    { label: "Hydration Check", sublabel: "Stay ahead of the target", target: "recovery" },
    { label: "Review Training Session", sublabel: "Prep the working sets", target: "training" },
  ],
  "pre-training": [
    { label: "Prepare Pre-Workout Meal", sublabel: "Fuel the session", target: "nutrition" },
    { label: "Begin Pre-Session", sublabel: "Readiness + mobility primer", target: "training" },
    { label: "Hydration Check", sublabel: "Top off before lifting", target: "recovery" },
  ],
  "training-window": [
    { label: "Open Live Workout", sublabel: "Run the session", target: "training" },
    { label: "Log Next Set", sublabel: "Keep execution tight", target: "training" },
    { label: "Hydration Check", sublabel: "Sip through the session", target: "recovery" },
  ],
  "post-session": [
    { label: "Start Recovery Handoff", sublabel: "Hydrate, refuel, downshift", target: "recovery" },
    { label: "Log Post-Workout Meal", sublabel: "Refill the recovery window", target: "nutrition" },
    { label: "Review Session", sublabel: "Close out the workout", target: "training" },
  ],
  "recovery-window": [
    { label: "Start Recovery Handoff", sublabel: "Protect the reserve", target: "recovery" },
    { label: "Log Post-Workout Meal", sublabel: "Keep protein on target", target: "nutrition" },
    { label: "Start Downshift", sublabel: "Walk or breathwork", target: "recovery" },
  ],
  "night-recovery": [
    { label: "Start Night Brief", sublabel: "Protect the sleep window", target: "recovery" },
    { label: "Log a Light Meal", sublabel: "Only if macros need it", target: "nutrition" },
    { label: "Complete Recovery Check-In", sublabel: "Close the day clean", target: "recovery" },
  ],
  "sleep-protection": [
    { label: "Protect Sleep Window", sublabel: "Prioritize sleep", target: "recovery" },
    { label: "Complete Recovery Check-In", sublabel: "Log the day before bed", target: "recovery" },
  ],
};

type HeroSignals = {
  briefing: StrategistBriefing;
  reserve: number;
  reserveHasData: boolean;
  physiqueImproving: boolean;
  checkInDue: boolean;
  conflict: boolean;
  daypart: TrainingDaypart;
  trainStart: string;
  trainEnd: string;
  sleepTarget: string;
  hour: number;
};

/* Premium, command-center hero copy. Sharp headline + ≤2-line support.
   Deterministic priority: data → recovery limiter → schedule risk →
   check-in → momentum → next move. Schedule-aware (morning vs night), so a
   morning session never gets night-routine language. Behavioral only. */
function buildApexHero(s: HeroSignals): ApexHero {
  const { briefing, reserve, reserveHasData, physiqueImproving, checkInDue, conflict, daypart, trainStart, trainEnd, sleepTarget, hour } = s;
  const roi = briefing.highestRoiAction;
  const nextMove = `Next move: ${roi.title.toLowerCase()}.`;
  const early = daypart === "morning" || daypart === "midday";

  const eyebrow = !briefing.hasData
    ? "Command status"
    : hour < 12
      ? "Daily execution brief"
      : hour < 18
        ? "Current mission status"
        : "Tonight's command brief";

  const badges: ApexBadge[] = [{ label: briefing.missionLabel, color: briefing.missionColor }];
  if (conflict && briefing.missionStatus !== "schedule-conflict") badges.push({ label: "Schedule Conflict", color: COLOR.amber });
  if (reserveHasData && reserve < 62 && briefing.missionStatus !== "recovery-limited") badges.push({ label: "Recovery Watch", color: COLOR.amber });
  if (briefing.confidence.level !== "high") badges.push({ label: `${cap(briefing.confidence.level)} Confidence`, color: briefing.confidence.level === "moderate" ? COLOR.gold : COLOR.slate });

  if (!briefing.hasData) {
    return { eyebrow, badges, headline: "Bring your systems online.", support: "Log a recovery check-in and a physique baseline to activate the brief." };
  }
  if (reserveHasData && reserve < 62) {
    return {
      eyebrow, badges,
      headline: "Recovery is the limiter today.",
      support: conflict
        ? `Reserve is low and tonight's ${trainStart} session compresses sleep. Keep load honest and the handoff tight.`
        : "Reserve is running low. Keep training load honest and protect sleep.",
    };
  }
  // Morning / midday session — no night-routine framing.
  if (early) {
    return {
      eyebrow, badges,
      headline: "Morning session is staged.",
      support: `Training runs ${trainStart}–${trainEnd}. Fuel light, move clean, and get post-session nutrition in before the workday.`,
    };
  }
  if (conflict && hour >= 15) {
    return {
      eyebrow, badges,
      headline: "Fuel early. Train clean. Protect sleep.",
      support: `Tonight's ${trainStart} session runs past the ${sleepTarget} sleep target. Keep the recovery handoff tight.`,
    };
  }
  if (checkInDue) {
    return { eyebrow, badges, headline: "Today's priority is your check-in.", support: `Log the weekly physique check-in to hold the trend. ${nextMove}` };
  }
  if (physiqueImproving && reserve >= 78) {
    return {
      eyebrow, badges,
      headline: "Physique momentum is building.",
      support: conflict ? "Recovery is supporting the work — keep tonight's handoff tight to protect it." : "Recovery is supporting the work. Hold the standard and recover hard.",
    };
  }
  return {
    eyebrow, badges,
    headline: `Next move: ${roi.title.toLowerCase()}.`,
    support: roi.reason,
  };
}

export function buildApexView(ctx: StrategistContext): ApexView {
  const { now } = ctx;
  const briefing = buildStrategistBriefing(ctx);
  const recovery = buildRecoverySnapshot(ctx.recovery, now);
  const physique = buildPhysiqueGuidance(ctx.physique, now);
  const sleepConflict = detectSleepConflict(ctx.schedule, ctx.trainingContext);
  const mealsMapped = ctx.schedule.mealWindows.some((m) => m.enabled);
  const daypart = classifyTrainingDaypart(ctx.schedule);
  const earlyTraining = daypart === "morning" || daypart === "midday";

  /* Hero copy — sharp command-center headline + support */
  const hero = buildApexHero({
    briefing,
    reserve: recovery.reserve,
    reserveHasData: recovery.hasData,
    physiqueImproving: physique.momentum === "improving",
    checkInDue: physique.daysUntilNextCheckIn === 0,
    conflict: sleepConflict.conflict,
    daypart,
    trainStart: formatTime12(ctx.schedule.preferredTrainingStart),
    trainEnd: formatTime12(ctx.schedule.preferredTrainingEnd),
    sleepTarget: formatTime12(ctx.schedule.sleepTarget),
    hour: now.getHours(),
  });

  /* Hero metrics */
  const trainingLoad = ctx.trainingSessionMode === "live" ? "Session Live" : ctx.trainingSessionMode === "complete" || ctx.trainingSessionMode === "closed" ? "Recovered" : "Session Staged";
  const heroMetrics: ApexMetric[] = [
    { label: "Readiness", value: recovery.hasData ? `${recovery.reserve}` : "—", color: COLOR.green },
    { label: "Output Capacity", value: trainingLoad, color: COLOR.gold },
    { label: "Recovery Capacity", value: recovery.hasData ? recovery.reserveLabel : "Data Limited", color: COLOR.steel },
    { label: "Fuel Status", value: mealsMapped ? "Meal Timing Set" : "Needs Input", color: mealsMapped ? COLOR.green : COLOR.amber },
    { label: "Physique Momentum", value: physique.hasData ? physique.momentum.replace("-", " ") : "Data Limited", color: physique.momentumColor },
    { label: "Schedule Risk", value: sleepConflict.conflict ? "Sleep Compression" : "Clear", color: sleepConflict.conflict ? COLOR.amber : COLOR.green },
    { label: "System Status", value: briefing.missionLabel, color: briefing.missionColor },
    { label: "Next Move", value: shortenAction(briefing.highestRoiAction.title), color: COLOR.gold },
  ];

  /* Today's Mission — schedule-aware (morning vs night) */
  const sessionDone = ctx.trainingSessionMode === "complete" || ctx.trainingSessionMode === "closed";
  const mission: ApexMission = {
    training: ctx.trainingSessionMode === "live"
      ? "Session is live — execute clean."
      : sessionDone
        ? "Session complete — protect the recovery window."
        : earlyTraining
          ? `${DAYPART_PHRASE[daypart]} session — execute clean.`
          : `Prepare for the ${formatTime12(ctx.schedule.preferredTrainingStart)} session.`,
    nutrition: !mealsMapped
      ? "Map meal windows so nutrition is timed to your day."
      : earlyTraining
        ? "Post-workout meal after training. Keep the midday meal on time."
        : "Pre-workout meal window opens before training — fuel and hydrate.",
    recovery: sleepConflict.conflict
      ? "Post-session handoff must stay efficient — training compresses sleep."
      : earlyTraining
        ? `Recover early. Protect the ${formatTime12(ctx.schedule.sleepTarget)} sleep target tonight.`
        : "Protect the recovery window and sleep target after training.",
    physique: physique.daysUntilNextCheckIn === 0 ? "Weekly physique check-in is due." : "Keep the weekly check-in cadence active.",
    scheduleContext: `Training ${formatTime12(ctx.schedule.preferredTrainingStart)}–${formatTime12(ctx.schedule.preferredTrainingEnd)} · sleep target ${formatTime12(ctx.schedule.sleepTarget)}`,
    priority: sleepConflict.conflict ? "No junk volume. Protect the night routine." : "Hold the standard. Recover hard.",
  };

  /* Momentum board */
  const recoveryState: ApexMomentumState = !recovery.hasData ? "data-limited" : recovery.reserve >= 78 ? "improving" : recovery.reserve >= 62 ? "stable" : "watch";
  const physiqueState: ApexMomentumState = !physique.hasData ? "data-limited" : physique.momentum === "improving" ? "improving" : physique.momentum === "holding" ? "stable" : physique.momentum === "needs-data" ? "data-limited" : "watch";
  const trainingState: ApexMomentumState = ctx.trainingSessionMode === "live" ? "improving" : ctx.trainingSessionMode === "complete" || ctx.trainingSessionMode === "closed" ? "stable" : "staged";
  const momentum: ApexMomentumRow[] = [
    { label: "Training", state: trainingState, color: MOMENTUM_COLOR[trainingState] },
    { label: "Nutrition", state: mealsMapped ? "stable" : "data-limited", color: MOMENTUM_COLOR[mealsMapped ? "stable" : "data-limited"] },
    { label: "Recovery", state: recoveryState, color: MOMENTUM_COLOR[recoveryState] },
    { label: "Physique", state: physiqueState, color: MOMENTUM_COLOR[physiqueState] },
    { label: "Schedule", state: sleepConflict.conflict ? "conflict" : "stable", color: MOMENTUM_COLOR[sleepConflict.conflict ? "conflict" : "stable"] },
    { label: "Weekly", state: recoveryState === "watch" || sleepConflict.conflict ? "watch" : "improving", color: MOMENTUM_COLOR[recoveryState === "watch" || sleepConflict.conflict ? "watch" : "improving"] },
  ];

  /* Weekly snapshot */
  const topWin = briefing.helping[0]?.title ?? "Schedule profile complete";
  const weeklySnapshot: ApexSnapshotRow[] = [
    { label: "Training", value: MOMENTUM_LABEL[trainingState], color: MOMENTUM_COLOR[trainingState] },
    { label: "Recovery", value: recovery.hasData ? recovery.reserveLabel : "Data Limited", color: MOMENTUM_COLOR[recoveryState] },
    { label: "Mobility", value: recovery.hasData ? `${recovery.mobilityThisWeek} / ${recovery.mobilityWeeklyTarget}` : "—", color: COLOR.gold },
    { label: "Physique", value: physique.hasData ? physique.momentum.replace("-", " ") : "Data Limited", color: physique.momentumColor },
    { label: "Hydration", value: recovery.hasData ? (recovery.hydrationStatus === "on-target" ? "On Target" : recovery.hydrationStatus === "behind-pace" ? "Behind" : "—") : "—", color: COLOR.steel },
    { label: "Top Win", value: topWin, color: COLOR.green },
    { label: "Top Limiter", value: briefing.primaryLimiter, color: COLOR.amber },
  ];

  /* ── Live intelligence ── */
  const cur = now.getHours() * 60 + now.getMinutes();
  const wake = timeToMinutes(ctx.schedule.wakeTime);
  const trainStart = timeToMinutes(ctx.schedule.preferredTrainingStart);
  const trainEnd = timeToMinutes(ctx.schedule.preferredTrainingEnd);
  const sleepMin = timeToMinutes(ctx.schedule.sleepTarget);
  const sleepAdj = sleepMin < 360 ? sleepMin + 1440 : sleepMin;

  const phase = derivePhase(cur, wake, trainStart, trainEnd, sleepAdj, daypart);
  const span = sleepAdj - wake;
  const dayProgress = span > 0 ? Math.round(Math.max(0, Math.min(100, ((cur - wake) / span) * 100))) : 0;

  const sched = buildTodaySchedule(ctx.schedule, ctx.trainingContext);
  const upcomingIdx = nextUpcomingIndex(sched, now);
  const nextSchedItem = upcomingIdx >= 0 ? sched[upcomingIdx] : null;
  const minsToNext = nextSchedItem ? nextSchedItem.minutes - cur : null;
  let currentWindow = "—";
  for (const it of sched) if (it.minutes <= cur) currentWindow = it.label.replace(/ · optional$/, "");

  const conflictPhase = phase === "training-window" || phase === "post-session" || phase === "recovery-window" || phase === "night-recovery";
  const actionPhase = phase === "pre-training" || phase === "training-window" || phase === "post-session" || phase === "night-recovery";

  let state: ApexLiveState = "on-track";
  if (!briefing.hasData) state = "data-limited";
  else if (sleepConflict.conflict && conflictPhase) state = "schedule-conflict";
  else if (recovery.hasData && recovery.reserve < 62) state = "recovery-watch";
  else if (physique.daysUntilNextCheckIn === 0) state = "needs-action";
  else if (actionPhase) state = "needs-action";
  else if (recovery.hasData && recovery.reserve >= 78 && physique.momentum === "improving") state = "ahead";
  else if (recovery.debt.overall === "accumulating" || recovery.hydrationStatus === "behind-pace") state = "behind";
  else state = "on-track";

  const stateReason = state === "data-limited"
    ? "Log a recovery check-in and physique baseline to bring the system online."
    : state === "schedule-conflict"
      ? "Training runs into the sleep window. Recovery handoff is the priority."
      : state === "recovery-watch"
        ? "Recovery reserve is low. Protect sleep and keep training load honest."
        : PHASE_REASON[phase];

  const live: ApexLiveStatus = {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    state,
    stateLabel: STATE_META[state].label,
    stateColor: STATE_META[state].color,
    reason: stateReason,
    dayProgress,
    clockLabel: formatTime12(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`),
    currentWindow,
    nextItem: nextSchedItem ? nextSchedItem.label.replace(/ · optional$/, "") : "Day complete",
    nextItemInMinutes: minsToNext,
  };

  /* ── Next Move (operational) ── */
  const na = getScheduleNextAction(ctx.schedule, now, ctx.trainingContext);
  const nextMove: ApexNextMove = {
    title: na.label,
    whyNow: WHY_NOW[na.windowLabel] ?? na.reason,
    timeSensitivity: actionPhase
      ? "Active now"
      : minsToNext != null
        ? minsToNext <= 0 ? "Now" : `Next ${humanGap(minsToNext)}`
        : "Today",
    stack: actionStack(na.windowLabel, sleepConflict.conflict),
    buttonLabel: targetButton(na.target),
    target: na.target,
  };

  /* ── Today's Scoreboard ── */
  const trainScore: ApexScoreItem = ctx.trainingSessionMode === "live"
    ? { label: "Training", value: "Session Live", state: "good", color: SCORE_COLOR.good }
    : sessionDone
      ? { label: "Training", value: "Complete", state: "good", color: SCORE_COLOR.good }
      : cur > trainEnd + 60
        ? { label: "Training", value: "Missed", state: "bad", color: SCORE_COLOR.bad }
        : { label: "Training", value: "Staged", state: "neutral", color: SCORE_COLOR.neutral };
  const hydrState: ApexScoreState = !recovery.hasData ? "neutral" : recovery.hydrationStatus === "on-target" ? "good" : recovery.hydrationStatus === "behind-pace" ? "bad" : "neutral";
  const recState: ApexScoreState = !recovery.hasData ? "neutral" : recovery.reserve >= 62 ? "good" : "watch";
  const schedState: ApexScoreState = sleepConflict.severity === "conflict" ? "bad" : sleepConflict.severity === "compression" ? "watch" : "good";
  const physState: ApexScoreState = physique.daysUntilNextCheckIn === 0 ? "watch" : physique.hasData ? "good" : "neutral";
  const scoreboard: ApexScoreItem[] = [
    trainScore,
    { label: "Nutrition", value: mealsMapped ? "Meal Timing Set" : "Needs Input", state: mealsMapped ? "good" : "watch", color: mealsMapped ? SCORE_COLOR.good : SCORE_COLOR.watch },
    { label: "Hydration", value: !recovery.hasData ? "Data Limited" : recovery.hydrationStatus === "on-target" ? "On Track" : recovery.hydrationStatus === "behind-pace" ? "Behind" : "Data Limited", state: hydrState, color: SCORE_COLOR[hydrState] },
    { label: "Recovery", value: !recovery.hasData ? "Data Limited" : recovery.reserve >= 78 ? "Protected" : recovery.reserve >= 62 ? "Stable" : "Watch", state: recState, color: SCORE_COLOR[recState] },
    { label: "Schedule", value: sleepConflict.severity === "conflict" ? "Conflict" : sleepConflict.severity === "compression" ? "Compression" : "On Time", state: schedState, color: SCORE_COLOR[schedState] },
    { label: "Physique", value: physique.daysUntilNextCheckIn === 0 ? "Check-In Due" : physique.hasData ? "Active" : "Data Limited", state: physState, color: SCORE_COLOR[physState] },
  ];

  /* ── Structured Command Brief ── */
  const briefPriority = sleepConflict.conflict
    ? "Protect recovery — training runs into the sleep window."
    : earlyTraining
      ? "Fuel light, train clean, recover early."
      : phase === "post-session" || phase === "recovery-window"
        ? "Protect recovery after today's session."
        : "Hold the standard. Fuel and recover on time.";
  let briefLimiter = briefing.primaryLimiter;
  if (briefLimiter.startsWith("None")) briefLimiter = earlyTraining ? "Hydration and post-session meal timing." : "No hard limiter — keep the standard.";
  const commandBrief: ApexCommandBrief = {
    status: hero.headline,
    priority: briefPriority,
    limiter: briefLimiter,
    nextMove: na.label,
  };

  /* ── Action Center (3–5 schedule + state-aware) ── */
  const actionCenter = PHASE_ACTIONS[phase];

  /* ── Latest Signal (deterministic from current state) ── */
  const latestSignal: ApexSignal = !briefing.hasData
    ? { detail: "Reserve is waiting on your first logged actions to build the brief.", color: COLOR.slate }
    : sleepConflict.conflict
      ? { detail: "Sleep compression active. Meal and recovery windows are timed around the late session.", color: COLOR.amber }
      : recovery.hasData && recovery.reserve < 62
        ? { detail: "Recovery moved to Watch. Protect sleep and keep training load honest.", color: COLOR.amber }
        : physique.daysUntilNextCheckIn === 0
          ? { detail: "Weekly physique check-in is due — log it to hold the trend.", color: COLOR.gold }
          : ctx.trainingSessionMode === "live"
            ? { detail: "Training session is live.", color: COLOR.green }
            : sessionDone
              ? { detail: "Session complete. Recovery handoff is active.", color: COLOR.steel }
              : earlyTraining
                ? { detail: "Schedule set to morning training. Meal windows recalculated around the early session.", color: COLOR.steel }
                : { detail: "Systems aligned. Schedule, meals, and recovery are timed around your day.", color: COLOR.green };

  return { briefing, hero, live, nextMove, scoreboard, commandBrief, actionCenter, latestSignal, heroMetrics, mission, momentum, weeklySnapshot };
}
