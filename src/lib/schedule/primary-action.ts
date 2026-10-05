/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE PRIMARY ACTION — the one gold action on the Schedule screen.

   Picks the one next real thing on today's plan, from the member's own
   schedule, the one training-day resolver, today's fuel plan, what the member
   has logged, and the clock:

     0. no schedule set             → Set Your Day
     1. a live session              → resume it
     2. a sleep conflict ahead      → adjust the training window
     3. the training window is open → start the session
     4. a meal window open now      → log it
     5. the morning, sleep unlogged → log last night's sleep
     6. the next block ahead        → start the session, or log the meal
     7. only passed blocks remain   → review the session, or log a meal if eaten
     8. every block handled         → water, last night's sleep, or the sleep target

   The rules the button keeps:
     - It never records a meal or a night by itself. A meal opens the meal
       confirmation and sleep opens the Sleep Log; nothing counts until the
       member confirms.
     - Every amount it records is printed in its label ("Log 16 oz Water").
     - Starting a session goes through Training's own launch path.
     - A recovery day, or training moved away, never offers a session.

   Scheduling and food logging only. No supplement, dosage, timing or clinical
   language. Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { fuelDayClock, timedFuelMeals } from "@/lib/nutrition/fuel-horizon";
import { MEAL_WINDOW } from "@/lib/nutrition/primary-action";

import {
  isSessionDone,
  sessionAction,
  sessionStatus,
  sessionWindow,
  type DayHorizonInput,
  type ScheduleAction,
} from "./day-horizon";
import { formatTime12, minutesToTime, type SleepConflictSeverity } from "./engine";

/** The amount a water log records. It is printed in the action's label. */
export const SCHEDULE_WATER_OZ = 16;

/** Last night's sleep leads the plan for this long after wake, while the times are fresh. */
export const SLEEP_LOG_MORNING_MIN = 180;

export type SchedulePrimaryPlan = {
  /** One line naming the move, e.g. "Pull · 5:30 PM to 7:00 PM". */
  title: string;
  /** Why now, from the member's own plan and logs. */
  reason: string;
  primary: ScheduleAction;
};

export type SchedulePrimaryInput = DayHorizonInput & {
  /** The schedule engine's graded sleep conflict, for today's training context. */
  sleepConflict: SleepConflictSeverity;
  /** Water logged today and the day's target, from the member's hydration log. */
  hydration: { todayOz: number; targetOz: number };
};

const confirmFirst = "Nothing counts until you confirm it.";

export function resolveSchedulePrimaryAction(input: SchedulePrimaryInput): SchedulePrimaryPlan {
  /* 0 ── Nothing is timed until the member sets their day. */
  if (!input.scheduleSet) {
    return {
      title: "Your day is not set yet",
      reason: "Today's plan is drawn from your own wake, training and sleep times. Nothing here is timed until you set them.",
      primary: { kind: "set-day", label: "Set Your Day" },
    };
  }

  const { wakeMin, sleepMin, dayMin, nowMin } = fuelDayClock(input.now, input.schedule);
  const fmt = (min: number) => formatTime12(minutesToTime(min));
  const meals = timedFuelMeals(input.meals, input.loggedMealIds, dayMin).filter((meal) => meal.startMin < sleepMin);
  /* The optional pre-workout shake is on the day, but never the gold action. */
  const pending = meals.filter((meal) => !meal.logged && !meal.optional);
  const label = input.sessionLabel?.trim() || "Training";
  const mode = input.sessionMode ?? null;

  const win = input.trainingPlanned ? sessionWindow(input.schedule, dayMin) : null;
  const session = win ? { ...win, status: sessionStatus(mode, nowMin, win) } : null;
  const sessionOpen = session !== null && !isSessionDone(mode);
  const range = win ? `${fmt(win.startMin)} to ${fmt(win.endMin)}` : "";

  const logMeal = (meal: (typeof meals)[number], ifEaten = false): ScheduleAction => ({
    kind: "open-meal-log",
    label: ifEaten ? `Log ${meal.label} If Eaten` : `Log ${meal.label}`,
    mealId: meal.id,
  });

  /* 1 ── A live session: back to it. */
  if (session && mode === "live") {
    return { title: `${label} is live`, reason: "Your session is running. Pick up where you left off.", primary: sessionAction(session.status, mode) };
  }

  /* ── After sleep lock: close the day honestly, never chase it. ── */
  if (nowMin >= sleepMin) {
    const last = pending[pending.length - 1];
    if (last) {
      return {
        title: "Close today's plan",
        reason: `Sleep lock was ${fmt(sleepMin)}. Log ${last.label} only if you ate it. ${confirmFirst}`,
        primary: logMeal(last, true),
      };
    }
    return {
      title: "Today's plan is closed",
      reason: `Sleep lock was ${fmt(sleepMin)}. Tomorrow's plan opens at your ${fmt(wakeMin)} wake.`,
      primary: { kind: "edit-time", label: "Adjust Wake Time", field: "wakeTime" },
    };
  }

  /* 2 ── A sleep conflict, while there is still time to move the window. */
  if (session && sessionOpen && input.sleepConflict === "conflict" && nowMin < session.startMin - 20) {
    return {
      title: `Training ends at ${fmt(session.endMin)}, at or after sleep lock`,
      reason: `Sleep lock is ${fmt(sleepMin)}. Move the training window or the sleep target so the session ends first.`,
      primary: { kind: "edit-time", label: "Adjust Training Window", field: "preferredTrainingStart" },
    };
  }

  /* 3 ── The training window is open. */
  if (session && sessionOpen && session.status === "due-now") {
    return { title: `${label} · ${range}`, reason: "Your training window is open now.", primary: sessionAction(session.status, mode) };
  }

  /* 4 ── A meal window open now: the most recent one that has opened and not yet gone stale. */
  const openMeal = [...pending]
    .reverse()
    .find((meal) => meal.startMin <= nowMin + MEAL_WINDOW.opensBeforeMin && nowMin - meal.startMin <= MEAL_WINDOW.staysOpenMin);
  if (openMeal && nowMin >= wakeMin) {
    return {
      title: `${openMeal.label} is due · ${openMeal.timeLabel}`,
      reason: `${openMeal.name} is planned for ${openMeal.timeLabel}. ${confirmFirst}`,
      primary: logMeal(openMeal),
    };
  }

  /* 5 ── The morning, with last night unlogged. */
  if (!input.sleepLoggedToday && nowMin >= wakeMin && nowMin < wakeMin + SLEEP_LOG_MORNING_MIN) {
    return {
      title: "Last night's sleep is not logged",
      reason: "Log it while the times are fresh. Nothing is saved until you set them.",
      primary: { kind: "open-sleep-log", label: "Log Last Night's Sleep" },
    };
  }

  /* 6 ── The next block ahead. */
  const nextMeal = pending.find((meal) => meal.startMin > nowMin) ?? null;
  const sessionAhead = session && sessionOpen && session.startMin > nowMin ? session : null;
  const beforeWake = nowMin < wakeMin ? ` Your day starts at ${fmt(wakeMin)}.` : "";
  if (sessionAhead && (!nextMeal || sessionAhead.startMin <= nextMeal.startMin)) {
    return {
      title: `Next · ${label} at ${fmt(sessionAhead.startMin)}`,
      reason: `Your training window runs ${range}.${beforeWake}`,
      primary: sessionAction(sessionAhead.status, mode),
    };
  }
  if (nextMeal) {
    return {
      title: `Next · ${nextMeal.label} at ${nextMeal.timeLabel}`,
      reason: `${nextMeal.name} is planned.${beforeWake} ${confirmFirst}`,
      primary: logMeal(nextMeal),
    };
  }

  /* 7 ── Only passed blocks remain. */
  if (session && sessionOpen && session.status === "past-due") {
    return {
      title: `${label} was planned for ${fmt(session.startMin)}`,
      reason: "The training window has passed. Review the session in Training.",
      primary: sessionAction(session.status, mode),
    };
  }
  const missed = pending[pending.length - 1];
  if (missed) {
    return {
      title: `${missed.label} was planned for ${missed.timeLabel}`,
      reason: `Log it only if you ate it. ${confirmFirst}`,
      primary: logMeal(missed, true),
    };
  }

  /* 8 ── Every block handled. */
  const { todayOz, targetOz } = input.hydration;
  if (targetOz > 0 && todayOz < targetOz) {
    return {
      title: "Every planned block is handled",
      reason: `${todayOz} of ${targetOz} oz of water logged today.`,
      primary: { kind: "log-water", label: `Log ${SCHEDULE_WATER_OZ} oz Water`, oz: SCHEDULE_WATER_OZ },
    };
  }
  if (!input.sleepLoggedToday) {
    return {
      title: "Every planned block is handled",
      reason: "Last night's sleep is the one log still open today.",
      primary: { kind: "open-sleep-log", label: "Log Last Night's Sleep" },
    };
  }
  return {
    title: "Today's plan is handled",
    reason: `Sleep lock is ${fmt(sleepMin)}.`,
    primary: { kind: "edit-time", label: "Adjust Sleep Target", field: "sleepTarget" },
  };
}
