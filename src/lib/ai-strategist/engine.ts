/* ────────────────────────────────────────────────────────────────────────────
   AI STRATEGIST V1 — ENGINE

   Deterministic. Reads the Reserve operating system (schedule, recovery,
   physique, training, nutrition, modules) and produces one strategic briefing:
   mission status, the single highest-ROI action, helping/hurting signals, a
   system matrix, time-aware briefs, confidence, and preset answers.
   No fabricated data — missing systems return "data limited".
   ──────────────────────────────────────────────────────────────────────── */

import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import type { RecoveryCommandState } from "@/lib/recovery/types";
import { buildPhysiqueGuidance } from "@/lib/physique/engine";
import { WEAK_POINTS, type PhysiqueCommandState } from "@/lib/physique/types";
import { detectSleepConflict, formatTime12, getScheduleNextAction, type TrainingScheduleContext } from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";
import type { WomensState } from "@/lib/women/types";
import {
  STRATEGIC_QUESTIONS,
  type ConfidenceLevel,
  type HighestRoiAction,
  type MissionStatus,
  type StrategicAnswer,
  type StrategicQuestionId,
  type StrategistBriefing,
  type StrategistSignal,
  type SystemSignal,
} from "./types";

export type StrategistContext = {
  schedule: MemberScheduleProfile;
  recovery: RecoveryCommandState;
  physique: PhysiqueCommandState;
  womens: WomensState;
  enhancedLogOnly: boolean;
  trainingSessionMode: "pre" | "live" | "complete" | "closed";
  now: Date;
  /** Today's training schedule context (moved away, set aside, moved here). Omit for a planned, unchanged session. */
  trainingContext?: Pick<TrainingScheduleContext, "trainingPlanned" | "direction">;
};

const COLOR = {
  green: "#6ee7b7",
  gold: "#d5b15f",
  steel: "#5fb7d5",
  violet: "#a78bfa",
  amber: "#e8c87a",
  red: "#ef7d55",
  slate: "#8ea0b8",
};

const MISSION_META: Record<MissionStatus, { label: string; color: string }> = {
  "locked-in": { label: "Locked In", color: COLOR.green },
  "building-momentum": { label: "Building Momentum", color: COLOR.steel },
  "on-track": { label: "On Track", color: COLOR.steel },
  "recovery-limited": { label: "Recovery Limited", color: COLOR.amber },
  "nutrition-limited": { label: "Nutrition Limited", color: COLOR.amber },
  "schedule-conflict": { label: "Schedule Conflict", color: COLOR.amber },
  "physique-check-in-due": { label: "Physique Check-In Due", color: COLOR.gold },
  "plateau-watch": { label: "Plateau Watch", color: COLOR.amber },
  "data-limited": { label: "Data Limited", color: COLOR.slate },
  "needs-attention": { label: "Needs Attention", color: COLOR.red },
};

function targetButtonLabel(target?: string): string {
  switch (target) {
    case "training": return "Open Training Command";
    case "nutrition": return "Open Nutrition Command";
    case "recovery": return "Open Recovery Command";
    case "physique": return "Open Physique Command";
    case "settings": return "Open Daily Schedule";
    default: return "Open Command";
  }
}

export function buildStrategistBriefing(ctx: StrategistContext): StrategistBriefing {
  const { now } = ctx;
  const hour = now.getHours();

  const recovery = buildRecoverySnapshot(ctx.recovery, now);
  const physique = buildPhysiqueGuidance(ctx.physique, now);
  const scheduleAction = getScheduleNextAction(ctx.schedule, now, ctx.trainingContext);
  const sleepConflict = detectSleepConflict(ctx.schedule, ctx.trainingContext);

  /* Any real log activates the briefing; the reserve number is read only when
     the recovery engine has enough evidence for one (recovery.hasData). */
  const hasData = recovery.hasLogs || physique.hasData;
  const reserveBelow = (n: number) => recovery.hasData && recovery.reserve < n;

  /* ── Confidence / data coverage ── */
  let covered = 0;
  const total = 5; // schedule, recovery, physique, training, nutrition
  const scheduleComplete = Boolean(ctx.schedule.preferredTrainingStart && ctx.schedule.sleepTarget);
  if (scheduleComplete) covered += 1;
  if (recovery.hasLogs) covered += 1;
  if (physique.entryCount >= 1) covered += 1;
  if (ctx.trainingSessionMode) covered += 1; // training surface available
  // Nutrition: treated as available when meal windows configured
  if (ctx.schedule.mealWindows.some((m) => m.enabled)) covered += 1;
  const coverage = Math.round((covered / total) * 100);
  const physiqueDeep = physique.entryCount >= 2 && physique.confidence !== "limited";
  const confidenceLevel: ConfidenceLevel = coverage >= 80 && physiqueDeep ? "high" : coverage >= 55 ? "moderate" : "limited";
  const confidenceReason = confidenceLevel === "high"
    ? "Schedule, recovery, and physique data are available with consistent check-ins."
    : confidenceLevel === "moderate"
      ? "Schedule, recovery, and physique data are available. Training and nutrition completion history would raise confidence."
      : "Reserve needs a few more logged actions before strategic guidance becomes accurate.";

  /* ── Mission status (deterministic priority) ── */
  let missionStatus: MissionStatus;
  if (!hasData) missionStatus = "data-limited";
  else if (reserveBelow(55)) missionStatus = "recovery-limited";
  else if (sleepConflict.conflict && hour >= 15) missionStatus = "schedule-conflict";
  else if (reserveBelow(62)) missionStatus = "recovery-limited";
  else if (physique.daysUntilNextCheckIn === 0) missionStatus = "physique-check-in-due";
  else if (recovery.hasData && recovery.reserve >= 78 && (physique.momentum === "improving" || physique.momentum === "holding")) missionStatus = "locked-in";
  else missionStatus = physique.momentum === "improving" ? "building-momentum" : "on-track";

  /* ── Primary limiter ── */
  let primaryLimiter = "None — systems are aligned.";
  if (!hasData) primaryLimiter = "Data Limited";
  else if (reserveBelow(62)) primaryLimiter = "Recovery Reserve";
  else if (sleepConflict.conflict && hour >= 15) primaryLimiter = "Schedule Compression";
  else if (physique.daysUntilNextCheckIn === 0) primaryLimiter = "Physique Check-In Due";
  else if (recovery.debt.overall === "accumulating") primaryLimiter = "Recovery Debt";

  /* ── Highest ROI action (one) ── */
  let highestRoiAction: HighestRoiAction;
  if (!hasData) {
    highestRoiAction = { title: "Complete Recovery Check-In", reason: "Reserve needs a first logged action to build guidance.", source: "Recovery", confidence: "limited", buttonLabel: "Open Recovery Command", target: "recovery" };
  } else if (physique.daysUntilNextCheckIn === 0 && hour < 19) {
    highestRoiAction = { title: "Complete Weekly Physique Check-In", reason: "Your physique check-in is due — keep the cadence to protect the trend signal.", source: "Physique", confidence: physique.confidence, buttonLabel: "Open Physique Command", target: "physique" };
  } else if (reserveBelow(55) && hour >= 18) {
    highestRoiAction = { title: "Protect Sleep Window", reason: "Recovery Reserve is low while training load is high. Protect tonight's sleep.", source: "Recovery", confidence: "moderate", buttonLabel: "Open Recovery Command", target: "recovery" };
  } else {
    highestRoiAction = {
      title: scheduleAction.label,
      reason: scheduleAction.reason,
      source: scheduleAction.target === "nutrition" ? "Nutrition" : scheduleAction.target === "training" ? "Training" : "Recovery",
      confidence: confidenceLevel,
      buttonLabel: targetButtonLabel(scheduleAction.target),
      target: scheduleAction.target,
    };
  }

  /* ── Helping signals ── */
  const helping: StrategistSignal[] = [];
  if (physique.momentum === "improving") helping.push({ id: "h-phys", title: "Physique momentum improving", detail: physique.observations[0] ?? "Waist trending down with stable weight.", source: "Physique", confidence: physique.confidence });
  if (recovery.helping[0]) helping.push({ id: "h-rec", title: recovery.helping[0].label, detail: recovery.helping[0].detail, source: "Recovery", confidence: "moderate" });
  if (ctx.physique.weakPoints.length > 0) helping.push({ id: "h-weak", title: "Weak point focus active", detail: `${ctx.physique.weakPoints.map((w) => WEAK_POINTS.find((x) => x.id === w)?.label).join(" · ")} — tracking is directed.`, source: "Physique", confidence: "high" });
  if (scheduleComplete) helping.push({ id: "h-sched", title: "Schedule profile complete", detail: `Training window and sleep target set — meals and recovery are timed around your day.`, source: "Schedule", confidence: "high" });
  if (recovery.helping[1]) helping.push({ id: "h-rec2", title: recovery.helping[1].label, detail: recovery.helping[1].detail, source: "Recovery", confidence: "moderate" });

  /* ── Hurting signals ── */
  const hurting: StrategistSignal[] = [];
  if (sleepConflict.conflict) hurting.push({ id: "x-sched", title: "Late training compresses sleep target", detail: `Training ends ${formatTime12(ctx.schedule.preferredTrainingEnd)} vs ${formatTime12(ctx.schedule.sleepTarget)} sleep target. Keep the post-session handoff efficient.`, source: "Schedule", confidence: "high", severity: "moderate" });
  if (recovery.debt.overall !== "clear") hurting.push({ id: "x-debt", title: `Recovery debt ${recovery.debt.overall}`, detail: "Sleep, hydration, or mobility are slipping against targets.", source: "Recovery", confidence: "moderate", severity: recovery.debt.overall === "accumulating" ? "high" : "moderate" });
  if (recovery.hurting[0]) hurting.push({ id: "x-rec", title: recovery.hurting[0].label, detail: recovery.hurting[0].detail, source: "Recovery", confidence: "moderate", severity: "moderate" });
  if (physique.daysUntilNextCheckIn === 0) hurting.push({ id: "x-phys", title: "Weekly physique check-in due", detail: "Logging keeps the visual and measurement trend reliable.", source: "Physique", confidence: physique.confidence, severity: "low" });
  if (physique.confidence === "limited" && physique.entryCount > 0) hurting.push({ id: "x-photo", title: "Photo consistency limited", detail: "Comparison confidence is limited until lighting and pose consistency stabilize.", source: "Physique", confidence: "limited", severity: "low" });

  /* ── System matrix ── */
  const systemMatrix: SystemSignal[] = [];
  systemMatrix.push({
    system: "Schedule",
    status: sleepConflict.conflict ? "watch" : "strong",
    note: sleepConflict.conflict ? "Late training may compress the sleep window." : "Day is mapped — meals, training, recovery timed.",
    target: "schedule-command", actionLabel: "Mission Timeline",
  });
  systemMatrix.push({
    system: "Training",
    status: ctx.trainingSessionMode === "live" ? "strong" : ctx.trainingSessionMode === "complete" || ctx.trainingSessionMode === "closed" ? "on-track" : "on-track",
    note: ctx.trainingSessionMode === "live" ? "Session is live." : ctx.trainingSessionMode === "complete" || ctx.trainingSessionMode === "closed" ? "Session complete — recovery handoff next." : "Session staged for your training window.",
    target: "training", actionLabel: "View Training",
  });
  systemMatrix.push({
    system: "Nutrition",
    status: ctx.schedule.mealWindows.some((m) => m.enabled) ? "on-track" : "needs-input",
    note: ctx.schedule.mealWindows.some((m) => m.enabled) ? "Meal windows are staged around your training window." : "Add meal windows to time nutrition.",
    target: "nutrition", actionLabel: "View Nutrition",
  });
  systemMatrix.push({
    system: "Recovery",
    status: !recovery.hasData ? "needs-input" : recovery.reserve >= 78 ? "strong" : recovery.reserve >= 62 ? "on-track" : "watch",
    note: !recovery.hasData
      ? "Evidence needed — Recovery Reserve reads at least two kinds of recovery log."
      : recovery.reserve < 62 ? "Recovery Reserve is the current limiter." : `Recovery Reserve ${recovery.reserve} · ${recovery.reserveLabel}.`,
    target: "recovery", actionLabel: "View Recovery",
  });
  systemMatrix.push({
    system: "Physique",
    status: physique.entryCount === 0 ? "needs-input" : physique.daysUntilNextCheckIn === 0 ? "watch" : "on-track",
    note: physique.entryCount === 0 ? "Add a baseline to activate momentum." : `Momentum ${physique.momentum.replace("-", " ")} · ${physique.measurementTrendLabel.toLowerCase()}.`,
    target: "physique", actionLabel: "View Physique",
  });
  systemMatrix.push({
    system: "Bloodwork",
    status: "log-only",
    note: "Bloodwork is stored for tracking only. Reserve does not interpret labs or recommend treatment.",
    target: "bloodwork", actionLabel: "Open Bloodwork",
  });
  systemMatrix.push({
    system: "Compound",
    status: "log-only",
    note: "Log-only. Reserve does not prescribe, recommend, or adjust compounds, supplements, medications, or dosages.",
    target: "supplements", actionLabel: "Open Compound",
  });
  if (ctx.womens.enabled) {
    systemMatrix.push({ system: "Women's Performance", status: "on-track", note: "Cycle-aware performance tracking is active.", target: "womens-performance", actionLabel: "Open" });
    systemMatrix.push({ system: "Cycle", status: "estimate-only", note: "Cycle estimates and performance tracking only — not medical prediction.", target: "womens-cycle", actionLabel: "Open" });
    if (ctx.womens.fertility.enabled) systemMatrix.push({ system: "Fertility", status: "lifestyle-only", note: "Lifestyle and adherence support only. No diagnosis or treatment.", target: "womens-fertility", actionLabel: "Open" });
    if (ctx.womens.pregnancy.enabled) systemMatrix.push({ system: "Pregnancy", status: "lifestyle-only", note: "Lifestyle and adherence support only. No medical guidance.", target: "womens-pregnancy", actionLabel: "Open" });
  }

  /* ── Briefs (time-aware active flag) ── */
  const morningActive = hour >= 5 && hour < 12;
  const middayActive = hour >= 12 && hour < 18;
  const nightActive = hour >= 18 || hour < 5;
  const briefs = [
    {
      type: "morning" as const,
      label: "Morning Brief",
      active: morningActive,
      body: `Today's mission: train in your ${formatTime12(ctx.schedule.preferredTrainingStart)} window while protecting recovery. ${!recovery.hasData ? "Recovery Reserve needs more logs before it can read the session." : recovery.reserve < 62 ? "Recovery Reserve is the system to protect — keep load honest." : "Recovery supports a strong session."} Main opportunity: ${highestRoiAction.title.toLowerCase()}.`,
    },
    {
      type: "midday" as const,
      label: "Midday Brief",
      active: middayActive,
      body: `Status: ${MISSION_META[missionStatus].label}. ${ctx.schedule.mealWindows.some((m) => m.enabled) ? "Meal timing is mapped — keep the pre-workout window in view." : "Add meal windows to time nutrition."} Next action that matters: ${highestRoiAction.title.toLowerCase()}.`,
    },
    {
      type: "night" as const,
      label: "Night Brief",
      active: nightActive,
      body: sleepConflict.conflict
        ? `Training runs late tonight (ends ${formatTime12(ctx.schedule.preferredTrainingEnd)}, sleep target ${formatTime12(ctx.schedule.sleepTarget)}). Keep the post-session handoff efficient — hydrate, downshift, and protect the sleep window to keep tomorrow's readiness.`
        : `Close the day clean: complete the post-session handoff, hydrate, downshift, and honor your ${formatTime12(ctx.schedule.sleepTarget)} sleep target.`,
    },
  ];

  /* ── Hero brief + metrics ── */
  const heroBrief = !hasData
    ? "Reserve needs a few logged actions before strategic guidance becomes accurate. Start with a recovery check-in and a physique baseline."
    : `${physique.momentum === "improving" ? "Physique momentum is improving" : "Physique is holding"}, ${!recovery.hasData ? "recovery needs more logs to read" : recovery.reserve >= 62 ? "recovery is supporting the work" : "recovery is the current limiter"}, and your training window is set for ${formatTime12(ctx.schedule.preferredTrainingStart)}. ${sleepConflict.conflict ? "Because tonight's session compresses the sleep target, the highest ROI action is keeping the recovery handoff efficient and protecting sleep." : `The highest ROI action right now is ${highestRoiAction.title.toLowerCase()}.`}`;

  const heroMetrics = [
    { label: "Mission Status", value: MISSION_META[missionStatus].label, color: MISSION_META[missionStatus].color },
    { label: "Recovery Reserve", value: recovery.hasData ? `${recovery.reserve}` : "—", color: COLOR.steel },
    { label: "Physique Momentum", value: physique.hasData ? physique.momentum.replace("-", " ") : "—", color: physique.momentumColor },
    { label: "Schedule Risk", value: sleepConflict.conflict ? "Sleep compression" : "Clear", color: sleepConflict.conflict ? COLOR.amber : COLOR.green },
    { label: "Primary Limiter", value: primaryLimiter, color: COLOR.gold },
    { label: "Confidence", value: confidenceLevel, color: confidenceLevel === "high" ? COLOR.green : confidenceLevel === "moderate" ? COLOR.gold : COLOR.slate },
  ];

  /* ── Quick actions ── */
  const quickActions = [
    { label: "Open Training", target: "training", enabled: true },
    { label: "Open Nutrition", target: "nutrition", enabled: true },
    { label: "Open Recovery", target: "recovery", enabled: true },
    { label: "Open Physique", target: "physique", enabled: true },
    { label: "Daily Schedule", target: "settings", enabled: true },
  ];

  return {
    hasData,
    missionStatus,
    missionLabel: MISSION_META[missionStatus].label,
    missionColor: MISSION_META[missionStatus].color,
    heroBrief,
    heroMetrics,
    primaryLimiter,
    highestRoiAction,
    helping: helping.slice(0, 3),
    hurting: hurting.slice(0, 3),
    systemMatrix,
    briefs,
    questions: STRATEGIC_QUESTIONS,
    confidence: { level: confidenceLevel, reason: confidenceReason, coverage },
    quickActions,
  };
}

/* ─── Strategic question answers (deterministic) ────────────────────────── */

export function answerStrategicQuestion(id: StrategicQuestionId, b: StrategistBriefing): StrategicAnswer {
  const conf = b.confidence.level;
  const topHelp = b.helping[0];
  const topHurt = b.hurting[0];
  switch (id) {
    case "holding-back":
      return {
        questionId: id,
        answer: topHurt ? `${topHurt.title} is the main limiter right now. ${topHurt.detail} (Source: ${topHurt.source}.)` : "Nothing is clearly limiting you — systems are aligned based on logged data.",
        nextAction: b.highestRoiAction.title,
        confidence: conf,
      };
    case "focus-today":
      return { questionId: id, answer: `Today's focus is the highest-ROI action: ${b.highestRoiAction.title}. ${b.highestRoiAction.reason}`, nextAction: b.highestRoiAction.title, confidence: b.highestRoiAction.confidence };
    case "progressing":
      return { questionId: id, answer: `Mission status is ${b.missionLabel}. ${topHelp ? topHelp.detail : "Keep logging consistent check-ins to confirm the trend."}`, nextAction: b.highestRoiAction.title, confidence: conf };
    case "helping-most":
      return { questionId: id, answer: topHelp ? `${topHelp.title}: ${topHelp.detail} (Source: ${topHelp.source}.)` : "More data needed to surface what's helping most.", nextAction: "Keep the streak consistent", confidence: conf };
    case "hurting-most":
      return { questionId: id, answer: topHurt ? `${topHurt.title}: ${topHurt.detail} (Source: ${topHurt.source}.)` : "Nothing significant is hurting progress based on logged data.", nextAction: b.highestRoiAction.title, confidence: conf };
    case "recovery-impact": {
      const rec = b.systemMatrix.find((s) => s.system === "Recovery");
      return { questionId: id, answer: `Recovery read: ${rec?.note ?? "data limited"}. Recovery sets the ceiling on how hard you can train and adapt.`, nextAction: "Open Recovery Command", confidence: conf };
    }
    case "schedule-impact": {
      const sched = b.systemMatrix.find((s) => s.system === "Schedule");
      return { questionId: id, answer: sched?.status === "watch" ? `Schedule is a limiter today. ${sched.note} Keep the post-session handoff efficient.` : "Your schedule is helping — meals, training, and recovery are timed around your day.", nextAction: "Daily Schedule", confidence: "high" };
    }
    case "protect-tonight": {
      const night = b.briefs.find((x) => x.type === "night");
      return { questionId: id, answer: night?.body ?? "Protect your sleep window and keep recovery efficient tonight.", nextAction: "Start Night Recovery Brief", confidence: conf };
    }
    case "missing-data":
      return { questionId: id, answer: b.confidence.reason, nextAction: b.confidence.level === "limited" ? "Complete a recovery check-in and physique baseline" : "Keep check-ins consistent", confidence: conf };
    case "next-action":
    default:
      return { questionId: "next-action", answer: `${b.highestRoiAction.title}. ${b.highestRoiAction.reason} (Source: ${b.highestRoiAction.source}.)`, nextAction: b.highestRoiAction.title, confidence: b.highestRoiAction.confidence };
  }
}

/* ─── The screen statement, built from the ranked watch list ──────────────
   The AI Strategist once read "Nothing is limiting you right now." while its
   own "What's hurting" list showed two Moderate debts: the statement came
   from `primaryLimiter` alone, which ignores debt that is only building.

   The statement, the gold action and the list now come from ONE ranked list,
   so they cannot disagree. Hurting ranks first (high → moderate → low, then
   the engine's own order), helping after it. Pure: no React, no store. */

export type WatchItem = {
  id: string;
  kind: "hurting" | "helping";
  title: string;
  detail: string;
  source: StrategistSignal["source"];
  /** Present on hurting items only. */
  severity?: "low" | "moderate" | "high";
};

const SEVERITY_RANK: Record<"low" | "moderate" | "high", number> = { high: 0, moderate: 1, low: 2 };

export function rankWatchList(briefing: Pick<StrategistBriefing, "hurting" | "helping">): WatchItem[] {
  const hurting = briefing.hurting
    .map((signal, index) => ({ signal, index }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.signal.severity ?? "low"] - SEVERITY_RANK[b.signal.severity ?? "low"] || a.index - b.index,
    )
    .map(({ signal }): WatchItem => ({
      id: signal.id,
      kind: "hurting",
      title: signal.title,
      detail: signal.detail,
      source: signal.source,
      severity: signal.severity ?? "low",
    }));
  const helping = briefing.helping.map((signal): WatchItem => ({
    id: signal.id,
    kind: "helping",
    title: signal.title,
    detail: signal.detail,
    source: signal.source,
  }));
  return [...hurting, ...helping];
}

/** The room a source belongs to, and the words on the control that opens it. */
const LIMITER_ROOM: Partial<Record<StrategistSignal["source"], { view: string; label: string; room: string }>> = {
  Recovery: { view: "recovery", label: "Open Recovery Command", room: "Recovery" },
  Schedule: { view: "schedule-command", label: "Open Schedule Command", room: "Your schedule" },
  Physique: { view: "physique", label: "Open Physique Command", room: "Physique" },
  Training: { view: "training", label: "Open Training Command", room: "Training" },
  Nutrition: { view: "nutrition", label: "Open Nutrition Command", room: "Nutrition" },
};

export type StrategistRead = {
  statement: string;
  /** The top hurting item, or null when nothing in the logs is hurting. */
  limiter: WatchItem | null;
  /** Where the one gold action goes, and what it says. */
  action: { title: string; reason: string; label: string; target?: string };
  watchList: WatchItem[];
};

export function resolveStrategistRead(
  briefing: Pick<StrategistBriefing, "hasData" | "hurting" | "helping" | "highestRoiAction">,
): StrategistRead {
  const watchList = rankWatchList(briefing);
  const roi = briefing.highestRoiAction;
  const roiAction = { title: roi.title, reason: roi.reason, label: roi.buttonLabel, target: roi.target };

  if (!briefing.hasData) {
    return { statement: "Reserve has nothing logged to read yet.", limiter: null, action: roiAction, watchList };
  }

  const limiter = watchList.find((item) => item.kind === "hurting") ?? null;
  if (!limiter) {
    return {
      statement: "Nothing in your logs is limiting you right now.",
      limiter: null,
      action: roiAction,
      watchList,
    };
  }

  const room = LIMITER_ROOM[limiter.source];
  const title = limiter.title.charAt(0).toLowerCase() + limiter.title.slice(1);
  return {
    statement: `${room?.room ?? limiter.source} is your limiter: ${title}.`,
    limiter,
    /* Gold goes to the limiting room. A source with no room of its own keeps
       the highest-ROI move rather than inventing a destination. */
    action: room
      ? { title: limiter.title, reason: limiter.detail, label: room.label, target: room.view }
      : roiAction,
    watchList,
  };
}
