/* ════════════════════════════════════════════════════════════════════════
   FUEL HORIZON — what the Nutrition hero's horizon strip shows.

   Pure and deterministic. Reads today's fuel plan (the same timed meals the
   Apex fuel lane reads, already capped before the sleep target by the
   schedule engine), the member's training window when a session is planned,
   and sleep lock, and returns what stands between now and sleep lock. No
   store, no React, no clock of its own: `input.now` is the only time it reads.

   Honest by construction:
     - Every meal is the fuel plan's own, at the plan's own time. Nothing is
       added: no meal is invented past sleep lock.
     - A meal is "completed" only when the member logged it. Opening one never
       logs it: its action opens the meal confirmation, where nothing counts
       until the member confirms.
     - Every item carries at least one real action. Before wake or after sleep
       lock there is no track: a quiet state says why.

   Food and meal logging only. The minute space matches the Apex day resolver,
   so both screens place a meal and sleep lock on the same minute.
   ════════════════════════════════════════════════════════════════════════ */

import type { ApexItemStatus, ApexLaneItem } from "@/lib/apex/today-types";
import { formatTime12, minutesToTime, timeToMinutes } from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";

import type { PlannedFuelMeal } from "./fuel-plan";

export type FuelHorizonLaneId = "fuel" | "training";

/** The only screens the fuel horizon routes to. */
export type FuelHorizonView = "training" | "schedule-command";

/** One thing opening an item lets the member do. Described, never bound. */
export type FuelHorizonAction =
  /** Opens the meal confirmation for this meal. Never logs on its own. */
  | { kind: "open-meal-log"; label: string; mealId: string }
  /** Takes back a meal the member already logged. */
  | { kind: "undo-meal-log"; label: string; mealId: string }
  | { kind: "open-view"; label: string; view: FuelHorizonView };

/**
 * An item on today's fuel horizon. Shaped as an Apex lane item so the shared
 * horizon projection lays it out; `action` stays null and `actions` carries
 * what the item opens.
 */
export type FuelHorizonItem = Omit<ApexLaneItem, "lane"> & {
  lane: FuelHorizonLaneId;
  source: "meal" | "training" | "sleep";
  actions: FuelHorizonAction[];
};

export type FuelHorizonClock = { min: number; label: string };

export type FuelHorizonLane = { id: FuelHorizonLaneId; label: string; items: FuelHorizonItem[] };

export type FuelHorizon =
  | {
      state: "quiet";
      reason: "before-wake" | "after-sleep-lock";
      nowMin: number;
      headline: string;
      detail: string;
      wake: FuelHorizonClock;
      sleepLock: FuelHorizonClock;
    }
  | {
      state: "track";
      nowMin: number;
      /** The visible range: a short look back behind now, ending just after sleep lock. */
      window: { startMin: number; endMin: number };
      /** Fuel first, then training when a session is planned. */
      lanes: FuelHorizonLane[];
      /** Every item on the track in time order: the phone list reads this. */
      items: FuelHorizonItem[];
      /** Items from earlier today that fell before the window. */
      earlier: number;
      wake: FuelHorizonClock;
      sleepLock: FuelHorizonClock;
    };

export type FuelHorizonInput = {
  now: Date;
  schedule: MemberScheduleProfile;
  /** A session is planned today: not a recovery day, not moved away. */
  trainingPlanned: boolean;
  /** What the training item is called, e.g. "Pull". */
  sessionLabel: string | null;
  /** The live session state, when there is one. */
  sessionMode?: string | null;
  /** Today's fuel plan meals. */
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "windowLabel" | "name" | "time" | "optional">>;
  loggedMealIds: readonly string[];
};

export const FUEL_HORIZON = {
  /** Minutes of the day kept visible behind the now gate. */
  lookBackMin: 90,
  /** Minutes drawn past sleep lock, so the lock is never on the track's edge. */
  tailMin: 20,
} as const;

const SLEEP_ITEM_ID = "sleep-lock";
const TRAINING_ITEM_ID = "training-window";

const fmt = (min: number): string => formatTime12(minutesToTime(min));

/** Same thresholds as the Apex day resolver: over 30 min late, due within 20 min, else upcoming. */
function pointStatus(startMin: number, nowMin: number): ApexItemStatus {
  const delta = startMin - nowMin;
  if (delta < -30) return "past-due";
  if (delta <= 20) return "due-now";
  return "upcoming";
}

/** The earliest upcoming item becomes due-next. Items arrive time-sorted, so the first wins a tie. */
function promoteDueNext(items: readonly FuelHorizonItem[]): void {
  const next = items.find((item) => item.status === "upcoming");
  if (next) next.status = "due-next";
}

/**
 * The day's minute space, shared with the Apex resolver. A sleep target after
 * midnight counts on past 1440, so a clock time before wake on such a day
 * belongs to the end of today.
 */
export function fuelDayClock(now: Date, schedule: Pick<MemberScheduleProfile, "wakeTime" | "sleepTarget">) {
  const wakeMin = timeToMinutes(schedule.wakeTime);
  const sleepRaw = timeToMinutes(schedule.sleepTarget);
  /* Sleep at or before wake on the clock is tomorrow: a 12:30 AM target, or a
     shift worker's 7:00 AM sleep after a 3:00 PM wake. */
  const sleepMin = sleepRaw <= wakeMin ? sleepRaw + 1440 : sleepRaw;
  const dayMin = (raw: number): number => (raw < wakeMin && sleepMin > 1440 ? raw + 1440 : raw);
  return { wakeMin, sleepMin, dayMin, nowMin: dayMin(now.getHours() * 60 + now.getMinutes()) };
}

/** Today's timed meals in the day's minute space, in time order. Untimed meals have no place on a horizon. */
export function timedFuelMeals(
  meals: FuelHorizonInput["meals"],
  loggedMealIds: readonly string[],
  dayMin: (raw: number) => number,
): Array<{ id: string; label: string; name: string; startMin: number; timeLabel: string; logged: boolean; optional: boolean }> {
  return meals
    .filter((meal): meal is typeof meal & { time: string } => typeof meal.time === "string" && meal.time.length > 0)
    .map((meal) => {
      const startMin = dayMin(timeToMinutes(meal.time));
      return {
        id: meal.id,
        label: meal.windowLabel,
        name: meal.name,
        startMin,
        timeLabel: fmt(startMin),
        logged: loggedMealIds.includes(meal.id),
        /* The optional pre-workout shake: shown on the day, never chased by a gold action. */
        optional: meal.optional === true,
      };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

export function buildFuelHorizon(input: FuelHorizonInput): FuelHorizon {
  const { schedule } = input;
  const { wakeMin, sleepMin, dayMin, nowMin } = fuelDayClock(input.now, schedule);
  const wake: FuelHorizonClock = { min: wakeMin, label: fmt(wakeMin) };
  const sleepLock: FuelHorizonClock = { min: sleepMin, label: fmt(sleepMin) };

  /* ── Outside the day: an honest quiet state, never an empty track. ── */
  if (nowMin < wakeMin) {
    return {
      state: "quiet",
      reason: "before-wake",
      nowMin,
      headline: "Before wake",
      detail: `No fuel window opens before your ${wake.label} wake. Sleep lock tonight is ${sleepLock.label}.`,
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
      detail: `Sleep lock was ${sleepLock.label}. No meal is planned past it; today's fuel horizon reopens after your ${wake.label} wake.`,
      wake,
      sleepLock,
    };
  }

  /* ── Meals: the fuel plan's own, at its own times. ── */
  const all: FuelHorizonItem[] = [];
  for (const meal of timedFuelMeals(input.meals, input.loggedMealIds, dayMin)) {
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

  /* ── The training window, when a session is planned today. ── */
  if (input.trainingPlanned) {
    const startMin = dayMin(timeToMinutes(schedule.preferredTrainingStart));
    const endRaw = dayMin(timeToMinutes(schedule.preferredTrainingEnd));
    const endMin = endRaw > startMin ? endRaw : endRaw + 1440;
    const status: ApexItemStatus =
      input.sessionMode === "live" ? "due-now"
        : input.sessionMode === "complete" || input.sessionMode === "closed" ? "completed"
          : nowMin < startMin - 20 ? "upcoming"
            : nowMin <= endMin ? "due-now"
              : "past-due";
    all.push({
      id: TRAINING_ITEM_ID,
      lane: "training",
      label: input.sessionLabel?.trim() || "Training",
      sub: `Until ${fmt(endMin)}`,
      startMin,
      endMin,
      timeLabel: fmt(startMin),
      status,
      action: null,
      logOnly: false,
      source: "training",
      actions: [{ kind: "open-view", label: "Open Training Command", view: "training" }],
    });
  }

  /* ── Sleep lock closes the fuel day. ── */
  all.push({
    id: SLEEP_ITEM_ID,
    lane: "fuel",
    label: "Sleep Lock",
    sub: "No meal is planned past it",
    startMin: sleepMin,
    endMin: null,
    timeLabel: sleepLock.label,
    status: pointStatus(sleepMin, nowMin),
    action: null,
    logOnly: false,
    source: "sleep",
    actions: [{ kind: "open-view", label: "Adjust Sleep Target", view: "schedule-command" }],
  });

  const window = {
    startMin: Math.max(wakeMin, nowMin - FUEL_HORIZON.lookBackMin),
    endMin: sleepMin + FUEL_HORIZON.tailMin,
  };
  const items = all
    .filter((item) => (item.endMin ?? item.startMin) >= window.startMin)
    .sort((a, b) => a.startMin - b.startMin || (a.source === "sleep" ? 1 : b.source === "sleep" ? -1 : 0));
  promoteDueNext(items);

  const lanes: FuelHorizonLane[] = [{ id: "fuel", label: "Fuel", items: items.filter((item) => item.lane === "fuel") }];
  if (input.trainingPlanned) lanes.push({ id: "training", label: "Training", items: items.filter((item) => item.lane === "training") });

  return { state: "track", nowMin, window, lanes, items, earlier: all.length - items.length, wake, sleepLock };
}
