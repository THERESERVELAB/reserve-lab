/* ════════════════════════════════════════════════════════════════════════
   APEX TODAY RESOLVER — one day, one decision.

   Pure and deterministic. Turns what the engines already know (the schedule
   engine's markers, the fuel plan's meals, the edit-aware training day, the
   member's logbook slots, the strategist's watch signals) into the Pit Wall's
   lanes, its one Next Move and its one risk line. No store, no React, no clock
   of its own: `input.now` is the only time it reads.

   Compliance: the logbook lane is log-only. Its items carry the member's own
   entry name and nothing else, and they never drive the Next Move, the risk
   line or any grade.
   ════════════════════════════════════════════════════════════════════════ */

import {
  buildTodaySchedule,
  detectSleepConflict,
  formatTime12,
  minutesToTime,
  timeToMinutes,
} from "@/lib/schedule/engine";

import type {
  ApexAction,
  ApexItemStatus,
  ApexLane,
  ApexLaneId,
  ApexLaneItem,
  ApexNextMove,
  ApexToday,
  ApexTodayInput,
} from "./today-types";

type DayLaneId = Exclude<ApexLaneId, "logbook">;

/** Reading order of the day lanes, and every tie-break between them. */
const DAY_LANES: readonly DayLaneId[] = ["training", "fuel", "recovery", "sleep"];

const LANE_LABEL: Record<ApexLaneId, string> = {
  training: "Training",
  fuel: "Fuel",
  recovery: "Recovery",
  sleep: "Sleep",
  logbook: "Logbook · user-entered · log-only",
};

const SESSION_ID = "session";
const SLEEP_ITEM_ID = "sched-sleep-target";

/** The after-session protocol: minutes after the training window ends, and the lane each step sits on. */
const PROTOCOL_STEPS: ReadonlyArray<{
  key: "cardio" | "abs" | "sauna" | "mobility" | "posing";
  label: string;
  offset: number;
  lane: DayLaneId;
}> = [
  { key: "cardio", label: "Cardio", offset: 5, lane: "training" },
  { key: "abs", label: "Abs", offset: 20, lane: "training" },
  { key: "sauna", label: "Sauna", offset: 35, lane: "recovery" },
  { key: "mobility", label: "Mobility", offset: 50, lane: "recovery" },
  { key: "posing", label: "Posing", offset: 65, lane: "training" },
];

/** Among due-now items: the session first, then a meal, then navigation. */
const MOVE_RANK: Partial<Record<ApexAction["kind"], number>> = {
  "start-session": 0,
  "review-session": 0,
  "log-meal": 1,
  "open-view": 2,
};

/** The actionable day items counted by the "Earlier · n of m done" stub. */
const EARLIER_KINDS: ReadonlySet<ApexAction["kind"]> = new Set<ApexAction["kind"]>([
  "log-meal",
  "undo-meal-log",
  "start-session",
  "review-session",
]);

const openTraining = (): ApexAction => ({ kind: "open-view", label: "Open Training Command", view: "training" });
const openRecovery = (): ApexAction => ({ kind: "open-view", label: "Open Recovery Command", view: "recovery" });
const openLogbook = (): ApexAction => ({ kind: "open-view", label: "Open Compound Command", view: "supplements" });

/** "4:30 PM" for a lane minute, including minutes past midnight. */
const fmt = (min: number): string => formatTime12(minutesToTime(min));

const slug = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const withSub = (head: string, sub: string | null): string => (sub ? `${head} · ${sub}` : head);

/** Status of an item not yet logged or completed: over 30 min late, due within 20 min, else upcoming. */
function pointStatus(startMin: number, nowMin: number): ApexItemStatus {
  const delta = startMin - nowMin;
  if (delta < -30) return "past-due";
  if (delta <= 20) return "due-now";
  return "upcoming";
}

function statusWord(status: ApexItemStatus): string {
  if (status === "due-now") return "Due now";
  if (status === "due-next") return "Due next";
  return "Upcoming";
}

/** The earliest upcoming item becomes due-next. Items arrive in lane order, each lane sorted by start, so the first wins a tie. */
function promoteDueNext(items: readonly ApexLaneItem[]): void {
  let next: ApexLaneItem | null = null;
  for (const item of items) {
    if (item.status === "upcoming" && (next === null || item.startMin < next.startMin)) next = item;
  }
  if (next) next.status = "due-next";
}

/** Title and copy for a Next Move drawn from a day-lane item. */
function moveFromItem(item: ApexLaneItem, durationMin: number | null): ApexNextMove {
  const word = statusWord(item.status);
  const dueNow = item.status === "due-now";
  if (item.lane === "fuel") {
    return {
      title: /meal|snack/i.test(item.label) ? item.label : `${item.label} Meal`,
      context: `Fuel window · ${word}`,
      whyNow: withSub(dueNow ? `Window closes ${fmt(item.startMin + 30)}` : `Opens ${item.timeLabel}`, item.sub),
      itemId: item.id,
      action: item.action,
    };
  }
  if (item.id === SESSION_ID) {
    const planned = durationMin != null ? ` · ${durationMin} min planned` : "";
    return {
      title: item.label,
      context: `Training · ${word}`,
      whyNow: dueNow
        ? `Session window ${fmt(item.startMin)}–${fmt(item.endMin ?? item.startMin)}${planned}.`
        : `Starts ${fmt(item.startMin)}${planned}.`,
      itemId: item.id,
      action: item.action,
    };
  }
  return {
    title: item.label,
    context: `${LANE_LABEL[item.lane]} · ${word}`,
    whyNow: withSub(item.timeLabel, item.sub),
    itemId: item.id,
    action: item.action,
  };
}

export function resolveApexToday(input: ApexTodayInput): ApexToday {
  const { schedule, today, trainingContext, sessionMode } = input;

  /* ── Minute space. A day whose sleep target falls after midnight counts on past 1440,
        so a clock time before wake on such a day belongs to the end of today. ── */
  const wakeMin = timeToMinutes(schedule.wakeTime);
  const sleepRaw = timeToMinutes(schedule.sleepTarget);
  /* Sleep at or before wake on the clock is tomorrow (a 12:30 AM target, or a shift worker's 7 AM sleep). */
  const sleepMin = sleepRaw <= wakeMin ? sleepRaw + 1440 : sleepRaw;
  const dayMin = (raw: number): number => (raw < wakeMin && sleepMin > 1440 ? raw + 1440 : raw);
  const nowMin = dayMin(input.now.getHours() * 60 + input.now.getMinutes());

  const trainingPlanned = trainingContext.trainingPlanned && !today.recovery;
  const trainStart = dayMin(timeToMinutes(schedule.preferredTrainingStart));
  const trainEndRaw = dayMin(timeToMinutes(schedule.preferredTrainingEnd));
  const trainEnd = trainEndRaw > trainStart ? trainEndRaw : trainEndRaw + 1440;

  const items: Record<ApexLaneId, ApexLaneItem[]> = { training: [], fuel: [], recovery: [], sleep: [], logbook: [] };
  const place = (item: Omit<ApexLaneItem, "timeLabel">): void => {
    items[item.lane].push({ ...item, timeLabel: fmt(item.startMin) });
  };

  /* ── Schedule engine: prep, recovery and sleep markers. Wake bounds the timeline;
        meals come from the fuel plan and the session from the training day. ── */
  for (const entry of buildTodaySchedule(schedule, { trainingPlanned, direction: trainingContext.direction })) {
    const lane: DayLaneId | null =
      entry.kind === "prep" ? "training"
        : entry.kind === "recovery" ? (entry.label === "Evening Wind-Down" ? "sleep" : "recovery")
          : entry.kind === "sleep" ? "sleep"
            : null;
    if (lane === null) continue;
    const startMin = dayMin(entry.minutes);
    place({
      id: `sched-${slug(entry.label)}`,
      lane,
      label: entry.kind === "sleep" ? "Sleep Lock" : entry.label,
      sub: entry.sub ?? null,
      startMin,
      endMin: null,
      status: pointStatus(startMin, nowMin),
      action: entry.kind === "prep" ? openTraining() : entry.kind === "sleep" ? null : openRecovery(),
      logOnly: false,
    });
  }

  /* ── The session, on the member's training window or the day's activity ── */
  if (trainingPlanned) {
    const { activity } = today;
    const startMin = dayMin(timeToMinutes(activity?.startTime ?? schedule.preferredTrainingStart));
    const endMin = activity ? startMin + (activity.durationMinutes ?? 60) : trainEnd;
    const minutes = activity?.durationMinutes ?? today.durationMin;
    const status: ApexItemStatus =
      sessionMode === "live" ? "due-now"
        : sessionMode === "complete" || sessionMode === "closed" ? "completed"
          : nowMin < startMin - 20 ? "upcoming"
            : nowMin <= endMin ? "due-now"
              : "past-due";
    place({
      id: SESSION_ID,
      lane: "training",
      label: activity?.label ?? today.sessionName,
      sub: minutes != null ? `${minutes} min` : null,
      startMin,
      endMin,
      status,
      action:
        sessionMode === "live" ? { kind: "start-session", label: "Resume Live Session" }
          : status === "completed" || status === "past-due" ? { kind: "review-session", label: "Review Session" }
            : { kind: "start-session", label: "Start Session" },
      logOnly: false,
    });
  }

  /* ── After-session protocol, anchored at the end of the training window ── */
  if (trainingPlanned || today.recovery) {
    for (const step of PROTOCOL_STEPS) {
      const detail = today.protocol[step.key];
      if (detail == null) continue;
      const startMin = trainEnd + step.offset;
      place({
        id: `protocol-${step.key}`,
        lane: step.lane,
        label: step.label,
        sub: detail,
        startMin,
        endMin: null,
        status: pointStatus(startMin, nowMin),
        action: trainingPlanned ? openTraining() : openRecovery(),
        logOnly: false,
      });
    }
  }

  /* ── Fuel: the fuel plan's timed meals, the one meal source ── */
  /** The optional pre-workout shake sits on the lane but never becomes the Next Move. */
  const optionalMealItems = new Set(input.meals.filter((meal) => meal.optional).map((meal) => `meal-${meal.id}`));
  for (const meal of input.meals) {
    if (meal.time === null) continue;
    const startMin = dayMin(timeToMinutes(meal.time));
    const logged = input.loggedMealIds.includes(meal.id);
    const status: ApexItemStatus = logged ? "completed" : pointStatus(startMin, nowMin);
    place({
      id: `meal-${meal.id}`,
      lane: "fuel",
      label: meal.windowLabel,
      sub: meal.name,
      startMin,
      endMin: null,
      status,
      action: logged
        ? { kind: "undo-meal-log", label: "Undo Log", mealId: meal.id }
        : { kind: "log-meal", label: status === "past-due" ? "Log If Eaten" : "Log Meal", mealId: meal.id },
      logOnly: false,
    });
  }

  /* ── Logbook: member-entered and log-only. The entry's name, its time, a log action. ── */
  for (const slot of input.intakeSlots) {
    if (slot.plannedTime === "—") continue;
    const startMin = dayMin(timeToMinutes(slot.plannedTime));
    const status: ApexItemStatus =
      slot.status === "taken" ? "completed"
        : slot.status === "skipped" ? "skipped"
          : slot.status === "missed" ? "past-due"
            : pointStatus(startMin, nowMin);
    place({
      id: `log-${slot.id}`,
      lane: "logbook",
      label: slot.entry.displayName ?? slot.entry.officialName ?? slot.entry.name,
      sub: null,
      startMin,
      endMin: null,
      status,
      action: status === "completed" || status === "skipped"
        ? openLogbook()
        : { kind: "mark-logged", label: "Mark Completed", entryId: slot.entryId, plannedTime: slot.plannedTime },
      logOnly: true,
    });
  }

  for (const list of Object.values(items)) list.sort((a, b) => a.startMin - b.startMin);

  /* ── Due next: one across the day lanes, one inside the logbook ── */
  const timeline = DAY_LANES.flatMap((id) => items[id]);
  promoteDueNext(timeline.filter((item) => !optionalMealItems.has(item.id)));
  promoteDueNext(items.logbook);
  /** Every day-lane item in time order, lane order breaking ties. Logbook items are never in it. */
  timeline.sort((a, b) => a.startMin - b.startMin);

  /* ── Window: four hours back, never before wake, ending just after the sleep lock ── */
  const windowEnd = sleepMin + 30;
  const range = {
    startMin: Math.max(wakeMin, Math.min(Math.min(nowMin, sleepMin) - 240, windowEnd - 360)),
    endMin: windowEnd,
  };

  const before = timeline.filter(
    (item) => item.action !== null && EARLIER_KINDS.has(item.action.kind) && (item.endMin ?? item.startMin) < range.startMin,
  );
  const earlier = { done: before.filter((item) => item.status === "completed").length, total: before.length };

  /* ── Next Move: a live session, then the overnight rules, then the lanes ── */
  const sleepLockMove = (whyNow: string): ApexNextMove => ({
    title: "Protect Sleep",
    context: "Sleep lock",
    whyNow,
    itemId: timeline.some((item) => item.id === SLEEP_ITEM_ID) ? SLEEP_ITEM_ID : null,
    action: openRecovery(),
  });

  let nextMove: ApexNextMove;
  if (sessionMode === "live") {
    nextMove = {
      title: "Resume Live Session",
      context: "Training · Live",
      whyNow: `${today.sessionName} is live — pick up where you left off.`,
      itemId: timeline.some((item) => item.id === SESSION_ID) ? SESSION_ID : null,
      action: { kind: "start-session", label: "Resume Live Session" },
    };
  } else if (nowMin < wakeMin) {
    nextMove = {
      title: "Protect Sleep",
      context: "Overnight",
      whyNow: `It's before your ${fmt(wakeMin)} wake time — rest supports tomorrow's readiness.`,
      itemId: null,
      action: openRecovery(),
    };
  } else if (nowMin >= sleepMin) {
    nextMove = sleepLockMove(`Past your ${fmt(sleepMin)} sleep target — close the day and protect the window.`);
  } else {
    const rank = (item: ApexLaneItem): number => (item.action ? MOVE_RANK[item.action.kind] ?? 3 : 3);
    const dueNow = timeline
      .filter((item) => item.status === "due-now" && item.action !== null && item.action.kind !== "undo-meal-log" && !optionalMealItems.has(item.id))
      .sort((a, b) => rank(a) - rank(b) || a.startMin - b.startMin);
    const chosen = dueNow.length > 0 ? dueNow[0] : timeline.find((item) => item.status === "due-next" && !optionalMealItems.has(item.id));
    nextMove = chosen
      ? moveFromItem(chosen, today.durationMin)
      : sleepLockMove(`Nothing else stands between you and the ${fmt(sleepMin)} sleep target.`);
  }

  /* ── Then: the next open day item after the Next Move ── */
  const afterMin = timeline.find((item) => item.id === nextMove.itemId)?.startMin ?? nowMin;
  const then =
    timeline.find(
      (item) =>
        item.startMin > afterMin && item.status !== "completed" && item.status !== "skipped" && item.status !== "past-due",
    ) ?? null;

  /* ── Risk: sleep compression, then a high watch signal, then any watch signal ── */
  const conflict = detectSleepConflict(schedule, { trainingPlanned });
  const highSignal = input.watchSignals.find((signal) => signal.severity === "high");
  const firstSignal = input.watchSignals.length > 0 ? input.watchSignals[0] : null;
  const risk: ApexToday["risk"] = conflict.conflict
    ? {
      level: "Sleep compression",
      detail: conflict.severity === "conflict" ? "Training ends at or after sleep" : "Short window before sleep",
    }
    : highSignal
      ? { level: "Elevated", detail: highSignal.title }
      : firstSignal
        ? { level: "Moderate", detail: firstSignal.title }
        : { level: "Low", detail: `Sleep lock ${fmt(sleepMin)}` };

  /* ── Lanes: always the four day lanes, then the logbook when the member has entries ── */
  const toLane = (id: ApexLaneId, empty: NonNullable<ApexLane["empty"]>): ApexLane => ({
    id,
    label: LANE_LABEL[id],
    items: items[id],
    empty: items[id].length > 0 ? null : empty,
  });
  const lanes: ApexLane[] = [
    toLane("training", {
      message: trainingContext.direction === "moved-away" ? "Session moved off today" : "Session set aside today",
      action: openTraining(),
    }),
    toLane("fuel", {
      message: "No meal windows mapped",
      action: { kind: "open-view", label: "Map Meal Windows", view: "schedule-command" },
    }),
    toLane("recovery", { message: "Nothing scheduled", action: null }),
    toLane("sleep", {
      message: "Sleep target not set",
      action: { kind: "open-view", label: "Open Schedule", view: "schedule-command" },
    }),
  ];
  if (input.intakeSlots.length > 0) {
    lanes.push(toLane("logbook", { message: "No timed entries today", action: openLogbook() }));
  }

  return {
    nowMin,
    trainingPlanned,
    window: range,
    earlier,
    lanes,
    nextMove,
    then,
    risk,
    sleepLock: { min: sleepMin, label: fmt(sleepMin) },
  };
}
