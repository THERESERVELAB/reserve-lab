/* ════════════════════════════════════════════════════════════════════════
   DAY HORIZON — what the Schedule hero's horizon strip shows.

   Pure and deterministic. Reads the member's own schedule (wake, the training
   window, sleep lock), today's fuel plan meals (timed by the schedule engine's
   meal-window plan, so no meal is ever invented past sleep lock), and whether
   a session is planned today, from the one training-day resolver. It returns
   what stands between now and sleep lock. No store, no React, no clock of its
   own: `input.now` is the only time it reads.

   Honest by construction:
     - Nothing is drawn until the member has set their day: an unset schedule
       is a quiet state that says so, never a track of starting times.
     - A meal is "completed" only when the member logged it; wake is
       "completed" only when last night's sleep is logged. Opening an item
       never records anything by itself.
     - Training moved onto today is drawn and says so; training moved away is
       not drawn, and its lane says why.
     - No meal sits at or past sleep lock.
     - Every item carries at least one real action. Before wake or after sleep
       lock there is no track: a quiet state says why.

   The minute space matches the Apex day resolver and the Nutrition fuel
   horizon, so every screen places a meal and sleep lock on the same minute.
   ════════════════════════════════════════════════════════════════════════ */

import type { ApexItemStatus, ApexLaneItem } from "@/lib/apex/today-types";
import { fuelDayClock, timedFuelMeals } from "@/lib/nutrition/fuel-horizon";
import type { PlannedFuelMeal } from "@/lib/nutrition/fuel-plan";

import { formatTime12, minutesToTime, timeToMinutes, type TrainingScheduleContext } from "./engine";
import type { MemberScheduleProfile } from "./types";

/** The operating times the Schedule screen's editor holds. */
export type ScheduleTimeField = "wakeTime" | "sleepTarget" | "preferredTrainingStart";

/** One thing the Schedule screen lets the member do. Described, never bound. */
export type ScheduleAction =
  /** Opens the meal confirmation for this meal. Never logs on its own. */
  | { kind: "open-meal-log"; label: string; mealId: string }
  /** Takes back a meal the member already logged. */
  | { kind: "undo-meal-log"; label: string; mealId: string }
  /** Training's real launch path: the pre-session flow on the Training screen. */
  | { kind: "start-session"; label: string }
  | { kind: "review-session"; label: string }
  /** Opens the Sleep Log. Nothing is saved until the member sets the times. */
  | { kind: "open-sleep-log"; label: string }
  /** Records this many ounces of water. The amount is printed in the label. */
  | { kind: "log-water"; label: string; oz: number }
  /** Brings this operating time into view in the editor on this screen. */
  | { kind: "edit-time"; label: string; field: ScheduleTimeField }
  /** Brings the operating-times editor into view, to set the day for the first time. */
  | { kind: "set-day"; label: string };

export type DayHorizonLaneId = "training" | "fuel" | "sleep";

/**
 * An item on today's plan. Shaped as an Apex lane item so the shared horizon
 * projection lays it out; `action` stays null and `actions` carries what the
 * item opens.
 */
export type DayHorizonItem = Omit<ApexLaneItem, "lane"> & {
  lane: DayHorizonLaneId;
  source: "wake" | "meal" | "training" | "sleep";
  actions: ScheduleAction[];
};

export type DayHorizonLane = {
  id: DayHorizonLaneId;
  label: string;
  items: DayHorizonItem[];
  /** Why the lane has nothing on it. Null when it has items. */
  empty: string | null;
};

export type DayHorizonClock = { min: number; label: string };

export type DayHorizon =
  | {
      state: "quiet";
      reason: "not-set" | "before-wake" | "after-sleep-lock";
      nowMin: number;
      headline: string;
      detail: string;
      wake: DayHorizonClock;
      sleepLock: DayHorizonClock;
    }
  | {
      state: "track";
      nowMin: number;
      /** The visible range: a short look back behind now, ending just after sleep lock. */
      window: { startMin: number; endMin: number };
      /** Training (when a session is planned or was moved off today), fuel, then sleep. */
      lanes: DayHorizonLane[];
      /** Every item on the track in time order: the phone list reads this. */
      items: DayHorizonItem[];
      /** Items from earlier today that fell before the window. */
      earlier: number;
      wake: DayHorizonClock;
      sleepLock: DayHorizonClock;
    };

export type DayHorizonInput = {
  now: Date;
  schedule: Pick<MemberScheduleProfile, "wakeTime" | "sleepTarget" | "preferredTrainingStart" | "preferredTrainingEnd">;
  /** The member has set (or confirmed) their operating times. */
  scheduleSet: boolean;
  /** A session is planned today, from `isTrainingPlannedToday`. */
  trainingPlanned: boolean;
  /** How today's training was changed, from the schedule context. */
  direction: TrainingScheduleContext["direction"];
  /** What the session is called, e.g. "Pull". */
  sessionLabel: string | null;
  /** The live session state, when there is one. */
  sessionMode?: string | null;
  /** Today's fuel plan meals. */
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "windowLabel" | "name" | "time" | "optional">>;
  loggedMealIds: readonly string[];
  /** Last night's sleep is in the member's sleep log. */
  sleepLoggedToday: boolean;
};

export const DAY_HORIZON = {
  /** Minutes of the day kept visible behind the now gate. */
  lookBackMin: 90,
  /** Minutes drawn past sleep lock, so the lock is never on the track's edge. */
  tailMin: 20,
} as const;

const fmt = (min: number): string => formatTime12(minutesToTime(min));

/** Same thresholds as the Apex day resolver: over 30 min late, due within 20 min, else upcoming. */
function pointStatus(startMin: number, nowMin: number): ApexItemStatus {
  const delta = startMin - nowMin;
  if (delta < -30) return "past-due";
  if (delta <= 20) return "due-now";
  return "upcoming";
}

/** The earliest upcoming item becomes due-next. Items arrive time-sorted, so the first wins a tie. */
function promoteDueNext(items: readonly DayHorizonItem[]): void {
  const next = items.find((item) => item.status === "upcoming");
  if (next) next.status = "due-next";
}

export const isSessionDone = (mode: string | null | undefined): boolean => mode === "complete" || mode === "closed";

/** The member's training window in the day's minute space. An end before the start runs past midnight. */
export function sessionWindow(
  schedule: DayHorizonInput["schedule"],
  dayMin: (raw: number) => number,
): { startMin: number; endMin: number } {
  const startMin = dayMin(timeToMinutes(schedule.preferredTrainingStart));
  const endRaw = dayMin(timeToMinutes(schedule.preferredTrainingEnd));
  return { startMin, endMin: endRaw > startMin ? endRaw : endRaw + 1440 };
}

/** Same rule as the Apex resolver: live is due now, finished is completed, else the clock decides. */
export function sessionStatus(mode: string | null | undefined, nowMin: number, win: { startMin: number; endMin: number }): ApexItemStatus {
  if (mode === "live") return "due-now";
  if (isSessionDone(mode)) return "completed";
  if (nowMin < win.startMin - 20) return "upcoming";
  if (nowMin <= win.endMin) return "due-now";
  return "past-due";
}

/** The session's one action, as Apex words it. */
export function sessionAction(status: ApexItemStatus, mode: string | null | undefined): ScheduleAction {
  if (mode === "live") return { kind: "start-session", label: "Resume Live Session" };
  if (status === "completed" || status === "past-due") return { kind: "review-session", label: "Review Session" };
  return { kind: "start-session", label: "Start Session" };
}

export function buildDayHorizon(input: DayHorizonInput): DayHorizon {
  const { schedule } = input;
  const { wakeMin, sleepMin, dayMin, nowMin } = fuelDayClock(input.now, schedule);
  const wake: DayHorizonClock = { min: wakeMin, label: fmt(wakeMin) };
  const sleepLock: DayHorizonClock = { min: sleepMin, label: fmt(sleepMin) };

  /* ── Not set, or outside the day: an honest quiet state, never an empty track. ── */
  if (!input.scheduleSet) {
    return {
      state: "quiet",
      reason: "not-set",
      nowMin,
      headline: "No plan drawn yet",
      detail: "Wake, meal windows, the training window and sleep lock appear here once your times are set below.",
      wake,
      sleepLock,
    };
  }
  if (nowMin < wakeMin) {
    return {
      state: "quiet",
      reason: "before-wake",
      nowMin,
      headline: "Before wake",
      detail: `Today's plan starts at your ${wake.label} wake. Sleep lock tonight is ${sleepLock.label}.`,
      wake,
      sleepLock,
    };
  }
  if (nowMin >= sleepMin) {
    return {
      state: "quiet",
      reason: "after-sleep-lock",
      nowMin,
      headline: "Past sleep lock",
      detail: `Sleep lock was ${sleepLock.label}. No meal is planned past it; today's plan reopens after your ${wake.label} wake.`,
      wake,
      sleepLock,
    };
  }

  const all: DayHorizonItem[] = [];
  const adjust = (field: ScheduleTimeField, label: string): ScheduleAction => ({ kind: "edit-time", label, field });

  /* ── Wake: done once last night's sleep is logged. ── */
  all.push({
    id: "wake",
    lane: "sleep",
    label: "Wake",
    sub: input.sleepLoggedToday ? "Last night's sleep is logged" : "Last night's sleep is not logged",
    startMin: wakeMin,
    endMin: null,
    timeLabel: wake.label,
    status: input.sleepLoggedToday ? "completed" : pointStatus(wakeMin, nowMin),
    action: null,
    logOnly: false,
    source: "wake",
    actions: input.sleepLoggedToday
      ? [adjust("wakeTime", "Adjust Wake Time")]
      : [{ kind: "open-sleep-log", label: "Log Last Night's Sleep" }, adjust("wakeTime", "Adjust Wake Time")],
  });

  /* ── Meals: the fuel plan's own, at the schedule engine's times, never at or past sleep lock. ── */
  for (const meal of timedFuelMeals(input.meals, input.loggedMealIds, dayMin)) {
    if (meal.startMin >= sleepMin) continue;
    const status: ApexItemStatus = meal.logged ? "completed" : pointStatus(meal.startMin, nowMin);
    all.push({
      id: `meal-${meal.id}`,
      lane: "fuel",
      label: meal.label,
      sub: meal.name,
      startMin: meal.startMin,
      endMin: null,
      timeLabel: meal.timeLabel,
      status,
      action: null,
      logOnly: false,
      source: "meal",
      actions: meal.logged
        ? [{ kind: "undo-meal-log", label: "Undo Log", mealId: meal.id }]
        : [{ kind: "open-meal-log", label: status === "past-due" ? `Log ${meal.label} If Eaten` : `Log ${meal.label}`, mealId: meal.id }],
    });
  }

  /* ── The training window, when a session is planned today (including one moved here). ── */
  if (input.trainingPlanned) {
    const win = sessionWindow(schedule, dayMin);
    const status = sessionStatus(input.sessionMode, nowMin, win);
    const primary = sessionAction(status, input.sessionMode);
    all.push({
      id: "training-window",
      lane: "training",
      label: input.sessionLabel?.trim() || "Training",
      sub: `Until ${fmt(win.endMin)}${input.direction === "moved-here" ? " · moved here" : ""}`,
      startMin: win.startMin,
      endMin: win.endMin,
      timeLabel: fmt(win.startMin),
      status,
      action: null,
      logOnly: false,
      source: "training",
      actions: input.sessionMode === "live" ? [primary] : [primary, adjust("preferredTrainingStart", "Adjust Training Window")],
    });
  }

  /* ── Sleep lock closes the day. ── */
  all.push({
    id: "sleep-lock",
    lane: "sleep",
    label: "Sleep Lock",
    sub: "No meal is planned past it",
    startMin: sleepMin,
    endMin: null,
    timeLabel: sleepLock.label,
    status: pointStatus(sleepMin, nowMin),
    action: null,
    logOnly: false,
    source: "sleep",
    actions: [adjust("sleepTarget", "Adjust Sleep Target")],
  });

  const window = {
    startMin: Math.max(wakeMin, nowMin - DAY_HORIZON.lookBackMin),
    endMin: sleepMin + DAY_HORIZON.tailMin,
  };
  const rank = (item: DayHorizonItem) => (item.source === "wake" ? -1 : item.source === "sleep" ? 1 : 0);
  const items = all
    .filter((item) => (item.endMin ?? item.startMin) >= window.startMin)
    .sort((a, b) => a.startMin - b.startMin || rank(a) - rank(b));
  promoteDueNext(items);

  const laneItems = (id: DayHorizonLaneId) => items.filter((item) => item.lane === id);
  const lanes: DayHorizonLane[] = [];
  if (input.trainingPlanned) {
    const training = laneItems("training");
    lanes.push({ id: "training", label: "Training", items: training, empty: training.length ? null : "Training window has passed" });
  } else if (input.direction === "moved-away" || input.direction === "set-aside") {
    lanes.push({
      id: "training",
      label: "Training",
      items: [],
      empty: input.direction === "moved-away" ? "Session moved off today" : "Session set aside today",
    });
  }
  const fuel = laneItems("fuel");
  lanes.push({ id: "fuel", label: "Fuel", items: fuel, empty: fuel.length ? null : "No meal window until sleep lock" });
  lanes.push({ id: "sleep", label: "Sleep", items: laneItems("sleep"), empty: null });

  return { state: "track", nowMin, window, lanes, items, earlier: all.length - items.length, wake, sleepLock };
}
