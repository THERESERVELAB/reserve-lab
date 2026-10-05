/* ────────────────────────────────────────────────────────────────────────────
   SCHEDULE ENGINE — turn the member's day into a real operating plan

   Deterministic. Given the schedule profile and the current time, produces
   today's ordered schedule, the schedule-aware meal-window plan, the single
   time-aware next best action, and a graded sleep-conflict read.

   Everything is derived from the actual training window (morning vs night),
   so changing the saved schedule recalculates every downstream surface. No
   stale night-training assumptions. Behavioral/logistics only — no medical
   claims, no dosing, no compound guidance.
   ──────────────────────────────────────────────────────────────────────── */

import type { MemberScheduleProfile, MealWindowId, PlannedMealSlot, PreWorkoutFuel } from "./types";

export type TrainingScheduleContext = {
  trainingPlanned: boolean;
  direction: "unchanged" | "moved-away" | "moved-here" | "swapped" | "set-aside";
  originalDate?: string;
  targetDate?: string;
  reason?: string;
};

type ScheduleOverrideLike = {
  action?: string;
  status?: string;
  originalDate?: string;
  targetDate?: string;
  reason?: string;
};

export function localScheduleDateKey(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function resolveTrainingScheduleContext(
  overrides: Record<string, ScheduleOverrideLike>,
  dayKey: string = localScheduleDateKey(),
): TrainingScheduleContext {
  const direct = overrides[dayKey];
  const usableDirect = direct?.status !== "cancelled" ? direct : undefined;
  const incoming = Object.values(overrides).find((override) =>
    override.status !== "cancelled" && override.action === "rescheduled" && override.targetDate === dayKey,
  );
  if (incoming) {
    return {
      trainingPlanned: true,
      direction: "moved-here",
      originalDate: incoming.originalDate,
      targetDate: dayKey,
      reason: incoming.reason,
    };
  }
  if (usableDirect?.action === "swapped") {
    return { trainingPlanned: true, direction: "swapped", originalDate: dayKey, reason: usableDirect.reason };
  }
  if (usableDirect && ["rescheduled", "skipped", "not_ready", "accidental_start", "session_reset"].includes(usableDirect.action ?? "")) {
    return {
      trainingPlanned: false,
      direction: usableDirect.action === "rescheduled" ? "moved-away" : "set-aside",
      originalDate: dayKey,
      targetDate: usableDirect.targetDate,
      reason: usableDirect.reason,
    };
  }
  return { trainingPlanned: true, direction: "unchanged" };
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatTime12(hhmm: string): string {
  const mins = timeToMinutes(hhmm);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

/* ─── Training daypart ─────────────────────────────────────────────────────
   Derived from the actual start time so it stays correct regardless of the
   stored `trainingWindow` enum (which the member may not keep in sync). */
export type TrainingDaypart = "morning" | "midday" | "afternoon" | "evening" | "night";

export function classifyTrainingDaypart(p: MemberScheduleProfile): TrainingDaypart {
  const start = timeToMinutes(p.preferredTrainingStart);
  if (start < 11 * 60) return "morning";
  if (start < 15 * 60) return "midday";
  if (start < 17 * 60 + 30) return "afternoon";
  if (start < 20 * 60 + 30) return "evening";
  return "night";
}

export const DAYPART_LABEL: Record<TrainingDaypart, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

/* ─── Sleep conflict (graded) ──────────────────────────────────────────────
   none        → training ends > 60 min before the sleep target.
   compression → training ends within 60 min of the sleep target.
   conflict    → training ends at or after the sleep target. */
export type SleepConflictSeverity = "none" | "compression" | "conflict";

export type SleepConflict = {
  /** True for compression or conflict — kept for existing call sites. */
  conflict: boolean;
  severity: SleepConflictSeverity;
  message: string;
  /** Minutes between training end and sleep target (can be negative). */
  gapMinutes: number;
};

export function detectSleepConflict(
  p: MemberScheduleProfile,
  context: Pick<TrainingScheduleContext, "trainingPlanned"> = { trainingPlanned: true },
): SleepConflict {
  if (!context.trainingPlanned) {
    return {
      conflict: false,
      severity: "none",
      gapMinutes: 0,
      message: "Training moved off this date. The prior session window no longer creates a sleep conflict.",
    };
  }
  const end = timeToMinutes(p.preferredTrainingEnd);
  const sleep = timeToMinutes(p.sleepTarget);
  // Treat early-morning sleep/training as next-day for the comparison.
  const sleepAdj = sleep < 360 ? sleep + 1440 : sleep;
  const endAdj = end < 360 ? end + 1440 : end;
  const gap = sleepAdj - endAdj;

  if (gap <= 0) {
    return { conflict: true, severity: "conflict", gapMinutes: gap, message: "Training ends at or after your sleep target. Keep the post-session handoff efficient and protect the sleep window." };
  }
  if (gap <= 60) {
    return { conflict: true, severity: "compression", gapMinutes: gap, message: "Late training leaves a short window before sleep. Keep the handoff tight — hydrate, downshift, and protect sleep." };
  }
  return { conflict: false, severity: "none", gapMinutes: gap, message: "Your training window leaves room to recover before your sleep target." };
}

/* ─── Meal-window engine ───────────────────────────────────────────────────
   The one source of today's meal times. Nutrition (useTodayFuelPlan), the
   Schedule timeline, Apex's fuel lane and the member contract all read it.

   It knows a real day:
     - A session that starts within EARLY_SESSION_WINDOW_MIN of waking is
       trained fasted by default. No meal is served before it — only an
       optional, food-only shake slot. A full pre-workout meal before an early
       session only when the member chose "carb-load".
     - After an early session, meal #1 (the post-workout breakfast) lands when
       the member is home: the session end plus their travel time.
     - Meals run until bedtime. When nothing lands in the evening, a meal the
       day displaced (the morning anchor an early session absorbed, a midday
       meal the session sat on) moves to the evening, ahead of the sleep lock.
     - Real meals sit at least MIN_MEAL_SPACING_MIN apart; member-set times for
       the anchor, midday and night windows are kept whenever they fit.
     - Times are wake-relative, so a day that runs past midnight (a shift
       worker waking at 3 PM and sleeping at 7 AM) keeps its meals in order.

   Hard rule: nothing after the sleep target except a genuine late-training
   post-workout meal, which is kept light + optional with a clear note.
   Food timing only — no supplement, dosage or compound guidance. */

/** A session starting this soon after waking is an early session: trained fasted unless the member says otherwise. */
export const EARLY_SESSION_WINDOW_MIN = 90;
/** Default minutes from the end of an early session until the member is home for meal #1. */
export const POST_WORKOUT_HOME_BUFFER_MIN = 45;
/** Minutes after the session a post-workout meal lands when it is not the day's first meal. */
export const POST_WORKOUT_MEAL_DELAY_MIN = 15;
/** A pre-workout meal lands this long before the session. */
export const PRE_WORKOUT_MEAL_LEAD_MIN = 90;
/** The optional pre-workout shake slot lands this long before the session. */
export const PRE_WORKOUT_SHAKE_LEAD_MIN = 30;
/** The morning anchor never lands sooner than this after waking. */
export const MORNING_ANCHOR_AFTER_WAKE_MIN = 20;
/** The sleep lock: no planned meal inside this many minutes of the sleep target. */
export const SLEEP_LOCK_MEAL_BUFFER_MIN = 45;
/** The day's evening meal lands this long before the sleep target. */
export const EVENING_MEAL_LEAD_MIN = 120;
/** A meal inside this many minutes of the sleep target counts as the day's evening meal. */
export const EVENING_WINDOW_MIN = 240;
/** Real meals sit at least this far apart. */
export const MIN_MEAL_SPACING_MIN = 120;

export type PlannedMeal = {
  id: MealWindowId;
  label: string;
  time: string; // effective "HH:MM"
  /** Wall-clock minutes from midnight. */
  minutes: number;
  /** Minutes on the member's day: wake-relative, so times after midnight follow the evening. */
  dayMinutes: number;
  optional: boolean;
  note?: string;
  /** The fuel slot this meal fills. */
  slot: PlannedMealSlot;
  /** A shake slot is food-only and optional; everything else is a meal. */
  kind: "meal" | "shake";
  /** For a shake: what the member chose to have before training. */
  shakeStyle?: "fasted" | "light";
};

/** Sleep on the member's day: after wake, so a morning sleep target counts on past midnight. */
export function sleepAfterWake(wakeMin: number, sleepMin: number): number {
  return sleepMin <= wakeMin ? sleepMin + 1440 : sleepMin;
}

/** A clock minute on the member's day: anything before wake belongs after midnight. */
export function dayMinute(raw: number, wakeMin: number): number {
  return raw < wakeMin ? raw + 1440 : raw;
}

/** True when today's session starts within EARLY_SESSION_WINDOW_MIN of waking. */
export function isEarlySession(p: Pick<MemberScheduleProfile, "wakeTime" | "preferredTrainingStart">): boolean {
  const wake = timeToMinutes(p.wakeTime);
  return dayMinute(timeToMinutes(p.preferredTrainingStart), wake) - wake <= EARLY_SESSION_WINDOW_MIN;
}

/** The member's stated pre-workout fuel, or the timing rule's default. */
export function resolvePreWorkoutFuel(p: Pick<MemberScheduleProfile, "wakeTime" | "preferredTrainingStart" | "preWorkoutFuel">): PreWorkoutFuel {
  return p.preWorkoutFuel ?? (isEarlySession(p) ? "fasted" : "carb-load");
}

type MealDraft = Omit<PlannedMeal, "time" | "minutes" | "dayMinutes"> & { t: number };

function eveningLabel(t: number): string {
  return ((t % 1440) + 1440) % 1440 >= 16 * 60 ? "Dinner" : "Last Meal";
}

function middleLabel(t: number): string {
  const wall = ((t % 1440) + 1440) % 1440;
  if (wall >= 10 * 60 && wall < 15 * 60 + 30) return "Midday Meal";
  if (wall >= 15 * 60 + 30 && wall < 21 * 60) return "Afternoon Meal";
  return "Main Meal";
}

export function buildMealPlan(
  p: MemberScheduleProfile,
  context: Pick<TrainingScheduleContext, "trainingPlanned" | "direction"> = { trainingPlanned: true, direction: "unchanged" },
): PlannedMeal[] {
  const wake = timeToMinutes(p.wakeTime);
  const sleep = sleepAfterWake(wake, timeToMinutes(p.sleepTarget));
  const lock = sleep - SLEEP_LOCK_MEAL_BUFFER_MIN;
  const trainStart = dayMinute(timeToMinutes(p.preferredTrainingStart), wake);
  let trainEnd = dayMinute(timeToMinutes(p.preferredTrainingEnd), wake);
  if (trainEnd <= trainStart) trainEnd += 1440;
  const trainingPlanned = context.trainingPlanned;
  const early = trainingPlanned && trainStart - wake <= EARLY_SESSION_WINDOW_MIN;
  const fuel = resolvePreWorkoutFuel(p);
  const statedFuel = p.preWorkoutFuel != null;
  const startLabel = formatTime12(p.preferredTrainingStart);
  const sleepLabel = formatTime12(p.sleepTarget);
  const homeBuffer = p.postWorkoutHomeMinutes ?? (early ? POST_WORKOUT_HOME_BUFFER_MIN : POST_WORKOUT_MEAL_DELAY_MIN);
  /* Meal #1 is the post-workout breakfast: an early session, trained without a pre-workout meal. */
  const breakfastAfterSession = early && fuel !== "carb-load";

  const enabled = (id: MealWindowId) => p.mealWindows.find((w) => w.id === id && w.enabled);
  const stored = (id: MealWindowId): number | null => {
    const w = enabled(id);
    return w ? dayMinute(timeToMinutes(w.time), wake) : null;
  };

  const placed: MealDraft[] = [];
  const displaced: MealWindowId[] = [];
  const real = () => placed.filter((m) => !m.optional);
  const clearOfMeals = (t: number) => real().every((m) => Math.abs(m.t - t) >= MIN_MEAL_SPACING_MIN);
  const inSession = (t: number) => trainingPlanned && t >= trainStart - 30 && t <= trainEnd + homeBuffer;

  /* ── Before the session: a pre-workout meal, or the optional shake slot ── */
  const preWindow = enabled("pre-workout");
  if (trainingPlanned) {
    if (fuel === "carb-load") {
      if (preWindow || statedFuel) {
        let t = Math.max(wake + 30, trainStart - PRE_WORKOUT_MEAL_LEAD_MIN);
        if (t > trainStart - 15) t = Math.max(wake + 10, trainStart - 15);
        placed.push({
          id: "pre-workout",
          label: preWindow?.label ?? "Pre-Workout Meal",
          t,
          optional: false,
          note: early
            ? `Your pre-workout meal before the ${startLabel} session — you chose to fuel first.`
            : `Fuel ~90 min before the ${startLabel} session.`,
          slot: "pre-workout",
          kind: "meal",
        });
      }
    } else if (preWindow || statedFuel) {
      /* The pre-workout window is the slot before the session: switched off, nothing is offered. */
      let t = Math.max(wake + 15, trainStart - PRE_WORKOUT_SHAKE_LEAD_MIN);
      if (t > trainStart - 10) t = Math.max(wake, trainStart - 10);
      placed.push({
        id: "pre-workout",
        label: "Optional Pre-Workout Shake",
        t,
        optional: true,
        note: fuel === "fasted"
          ? `You train fasted. Water with a pinch of salt and citrus is here if you want anything before the ${startLabel} session.`
          : `A light, food-only shake before the ${startLabel} session. Skip it and nothing is missed.`,
        slot: "pre-workout",
        kind: "shake",
        shakeStyle: fuel,
      });
    }
  }

  /* ── The morning anchor ── */
  const anchorWindow = enabled("morning-anchor");
  const postWindow = enabled("post-workout");
  /* An early session opens the day: trained fasted, meal #1 is the post-workout
     breakfast; carb-loaded, breakfast was eaten before lifting. */
  const breakfastId: MealWindowId | null = breakfastAfterSession
    ? (postWindow ? "post-workout" : anchorWindow ? "morning-anchor" : null)
    : null;
  if (anchorWindow && breakfastId !== "morning-anchor") {
    if (early) {
      displaced.push("morning-anchor");
    } else {
      let t = stored("morning-anchor") ?? wake + MORNING_ANCHOR_AFTER_WAKE_MIN;
      if (t < wake + MORNING_ANCHOR_AFTER_WAKE_MIN || t > lock) t = wake + MORNING_ANCHOR_AFTER_WAKE_MIN;
      if (clearOfMeals(t) && !inSession(t)) {
        placed.push({
          id: "morning-anchor",
          label: /light fuel/i.test(anchorWindow.label) ? "Morning Protein Anchor" : anchorWindow.label,
          t,
          optional: false,
          slot: "breakfast",
          kind: "meal",
        });
      } else {
        displaced.push("morning-anchor");
      }
    }
  }

  /* ── After the session (or the rest day's recovery meal) ── */
  if (breakfastId) {
    const t = trainEnd + homeBuffer;
    placed.push({
      id: breakfastId,
      label: "Meal 1 · Post-Workout Breakfast",
      t,
      optional: t >= sleep,
      note: `Home from the session — meal 1 of the day, about ${homeBuffer} min after training ends.`,
      slot: "breakfast",
      kind: "meal",
    });
  } else if (postWindow && trainingPlanned) {
    const t = trainEnd + homeBuffer;
    const pastSleep = t >= sleep;
    placed.push({
      id: "post-workout",
      label: postWindow.label,
      t,
      optional: pastSleep,
      note: pastSleep
        ? `Light only — past the ${sleepLabel} sleep target.`
        : classifyTrainingDaypart(p) === "morning" ? "Refuel after the morning session." : undefined,
      slot: "post-workout",
      kind: "meal",
    });
  } else if (postWindow) {
    placed.push({
      id: "post-workout",
      label: "Recovery Meal",
      t: Math.max(wake + 6 * 60, sleep - EVENING_MEAL_LEAD_MIN),
      optional: false,
      note: context.direction === "moved-away"
        ? "Re-timed after the session moved; no fuel remains attached to the old workout window."
        : "General recovery meal; no workout window is staged on this date.",
      slot: "dinner",
      kind: "meal",
    });
  }

  /* ── Midday and night: the member's own times, whenever they fit ── */
  for (const id of ["midday", "night"] as const) {
    const w = enabled(id);
    if (!w) continue;
    const t = stored(id) as number;
    if (t >= wake + MORNING_ANCHOR_AFTER_WAKE_MIN && t <= lock && clearOfMeals(t) && !inSession(t)) {
      placed.push({ id, label: w.label, t, optional: false, slot: id === "night" ? "dinner" : "lunch", kind: "meal" });
    } else {
      displaced.push(id);
    }
  }

  /* ── Meals run until bedtime: a displaced meal becomes the evening meal ── */
  const hasEvening = real().some((m) => m.t >= sleep - EVENING_WINDOW_MIN);
  if (!hasEvening && displaced.length > 0) {
    const id = displaced.shift() as MealWindowId;
    const t = Math.min(sleep - EVENING_MEAL_LEAD_MIN, lock);
    placed.push({ id, label: eveningLabel(t), t, optional: false, slot: "dinner", kind: "meal" });
  }

  /* ── Anything still displaced fills the widest gap between real meals ── */
  for (const id of displaced) {
    const times = real().map((m) => m.t).sort((a, b) => a - b);
    let t = wake + MORNING_ANCHOR_AFTER_WAKE_MIN;
    if (times.length === 1) t = Math.min(lock, times[0] + MIN_MEAL_SPACING_MIN);
    if (times.length >= 2) {
      let best = 1;
      for (let i = 2; i < times.length; i += 1) if (times[i] - times[i - 1] > times[best] - times[best - 1]) best = i;
      t = Math.round((times[best - 1] + times[best]) / 2 / 5) * 5;
    }
    placed.push({ id, label: middleLabel(t), t, optional: false, slot: "lunch", kind: "meal" });
  }

  return placed
    .sort((a, b) => a.t - b.t)
    .map(({ t, ...m }) => ({ ...m, time: minutesToTime(t), minutes: ((t % 1440) + 1440) % 1440, dayMinutes: t }));
}

/* ─── Today's timeline ─────────────────────────────────────────────────────── */
export type ScheduleKind = "wake" | "meal" | "prep" | "training" | "recovery" | "sleep" | "activity";

export type ScheduleItem = {
  time: string; // "HH:MM"
  timeLabel: string; // "9:00 PM"
  label: string;
  sub?: string;
  kind: ScheduleKind;
  /** minutes from midnight, for sorting. */
  minutes: number;
};

function item(time: string, label: string, kind: ScheduleKind, sub?: string): ScheduleItem {
  return { time, timeLabel: formatTime12(time), label, sub, kind, minutes: timeToMinutes(time) };
}

export function buildTodaySchedule(
  p: MemberScheduleProfile,
  context: Pick<TrainingScheduleContext, "trainingPlanned" | "direction"> = { trainingPlanned: true, direction: "unchanged" },
): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const trainStart = timeToMinutes(p.preferredTrainingStart);
  const trainEnd = timeToMinutes(p.preferredTrainingEnd);
  const wake = timeToMinutes(p.wakeTime);
  const sleepAdj = sleepAfterWake(wake, timeToMinutes(p.sleepTarget));
  const daypart = classifyTrainingDaypart(p);

  items.push(item(p.wakeTime, "Wake", "wake", "Start the day"));

  // Meals (schedule-aware, hard-capped before the sleep target).
  for (const m of buildMealPlan(p, context)) {
    items.push({
      time: m.time,
      timeLabel: formatTime12(m.time),
      label: m.optional && !/optional/i.test(m.label) ? `${m.label} · optional` : m.label,
      sub: m.note,
      kind: "meal",
      minutes: m.minutes,
    });
  }

  if (context.trainingPlanned) {
    // Mobility primer + pre-session readiness.
    const mobilityAt = minutesToTime(trainStart - p.preSessionMobilityMinutes - 5);
    const preSessionAt = minutesToTime(trainStart - 25);
    if (p.mobilityPreference !== "post-session") {
      items.push(item(mobilityAt, "Mobility Primer", "prep", `${p.preSessionMobilityMinutes} min before lifting`));
    }
    items.push(item(preSessionAt, "Pre-Session Command", "prep", "Readiness · hydration · mission"));
    items.push(item(p.preferredTrainingStart, "Training", "training", `Until ${formatTime12(p.preferredTrainingEnd)}`));
    items.push(item(p.preferredTrainingEnd, "Post-Session Handoff", "recovery", daypart === "morning" ? "Hydrate · refuel · reset" : "Hydrate · downshift · protect sleep"));
  } else {
    items.push(item(minutesToTime(timeToMinutes(p.wakeTime) + 180), "Hydration Check", "recovery", "General hydration pace · no old workout timing"));
  }

  if (!context.trainingPlanned || daypart === "morning" || daypart === "midday") {
    // Recovery downshift belongs to the evening, not right after an early session.
    const windDownAt = minutesToTime(sleepAdj - 50);
    items.push(item(windDownAt, "Evening Wind-Down", "recovery", "Downshift · protect sleep"));
  } else {
    const downshiftAt = minutesToTime(trainEnd + 15);
    items.push(item(downshiftAt, "Recovery Downshift", "recovery", "Walk · breath · protect sleep"));
  }

  items.push(item(p.sleepTarget, "Sleep Target", "sleep", "Protect the window"));

  /* In the member's day order: a day that runs past midnight keeps its night items last. */
  return items.sort((a, b) => dayMinute(a.minutes, wake) - dayMinute(b.minutes, wake));
}

/* ─── Time-aware next best action ──────────────────────────────────────────── */
export type ScheduleNextAction = {
  label: string;
  reason: string;
  windowLabel: string;
  /** Optional view to route to. */
  target?: string;
};

type ActionCandidate = { time: number; within: number; action: ScheduleNextAction };

/**
 * One deterministic next best action from the current time + schedule.
 * Builds chronological candidate windows from the daypart-aware meal plan and
 * picks the most-immediate current window (or the next upcoming one).
 */
export function getScheduleNextAction(
  p: MemberScheduleProfile,
  now: Date = new Date(),
  context: Pick<TrainingScheduleContext, "trainingPlanned" | "direction"> = { trainingPlanned: true, direction: "unchanged" },
): ScheduleNextAction {
  const wake = timeToMinutes(p.wakeTime);
  const sleepAdj = sleepAfterWake(wake, timeToMinutes(p.sleepTarget));
  const rawNow = now.getHours() * 60 + now.getMinutes();
  /* Every time below is on the member's day (wake-relative), so a day that runs past midnight stays in order. */
  const cur = dayMinute(rawNow, wake);
  const trainStart = dayMinute(timeToMinutes(p.preferredTrainingStart), wake);
  let trainEnd = dayMinute(timeToMinutes(p.preferredTrainingEnd), wake);
  if (trainEnd <= trainStart) trainEnd += 1440;
  const daypart = classifyTrainingDaypart(p);
  const startLabel = formatTime12(p.preferredTrainingStart);

  /* Real meals only: the optional pre-workout shake never becomes the day's next action. */
  const meals = buildMealPlan(p, context).filter((m) => !m.optional);

  const preSessionAt = trainStart - 25;

  // Before wake — protect sleep.
  if (rawNow < wake && cur >= sleepAdj) {
    return { label: "Protect Sleep", reason: "It's before your wake time — rest supports tomorrow's readiness.", windowLabel: "Overnight", target: "recovery" };
  }

  if (!context.trainingPlanned) {
    const minutesToSleep = sleepAdj - cur;
    return minutesToSleep <= 90
      ? { label: "Protect Sleep", reason: "Training moved off today. Close the day without chasing the old workout window.", windowLabel: "Recovery", target: "recovery" }
      : { label: "Maintain Hydration Pace", reason: "Training moved. Hydration and the recovery meal now follow a non-training day.", windowLabel: "Recovery", target: "nutrition" };
  }

  const candidates: ActionCandidate[] = [];

  /* Every real meal on today's plan, in the plan's own words. */
  for (const meal of meals) {
    const at = meal.dayMinutes;
    if (meal.slot === "pre-workout") {
      candidates.push({ time: at, within: Math.max(30, preSessionAt - at), action: { label: "Prepare Pre-Workout Meal", reason: `Fuel the ${startLabel} session now. Hydrate before pre-session.`, windowLabel: "Pre-Training", target: "nutrition" } });
    } else if (meal.id === "morning-anchor" && meal.slot === "breakfast") {
      candidates.push({ time: at, within: 100, action: { label: "Log Morning Protein Anchor", reason: "Start the day with your protein anchor.", windowLabel: "Morning", target: "nutrition" } });
    } else if (meal.slot === "breakfast") {
      candidates.push({ time: at, within: 120, action: { label: "Log Post-Workout Breakfast", reason: "You're home from the session — meal 1 of the day.", windowLabel: "Breakfast", target: "nutrition" } });
    } else if (meal.slot === "post-workout") {
      // The post-session handoff below carries the post-workout meal.
      continue;
    } else if (meal.label === "Midday Meal") {
      candidates.push({ time: at, within: 120, action: { label: "Hit Your Midday Meal", reason: "Keep meal timing consistent through the day.", windowLabel: "Midday", target: "nutrition" } });
    } else {
      candidates.push({ time: at, within: 120, action: { label: `Log ${meal.label}`, reason: "Meals run until your sleep lock — keep the day fuelled.", windowLabel: meal.slot === "dinner" ? "Evening" : "Midday", target: "nutrition" } });
    }
  }

  // Pre-session readiness.
  candidates.push({ time: preSessionAt, within: 25, action: { label: "Begin Pre-Session Command", reason: "Run readiness, hydration, and the mobility primer before lifting.", windowLabel: "Pre-Session", target: "training" } });

  // Training.
  candidates.push({ time: trainStart, within: Math.max(30, trainEnd - trainStart), action: { label: "Start Training", reason: "You're in your preferred training window. Execute the session.", windowLabel: "Training", target: "training" } });

  // Post-session handoff.
  candidates.push({ time: trainEnd, within: 45, action: { label: "Open Post-Session Handoff", reason: daypart === "morning" ? "Hydrate, take the post-workout meal, and reset before the workday." : "Hydrate, take the recovery meal, and downshift while the window is fresh.", windowLabel: "Post-Session", target: "recovery" } });

  // Evening wind-down toward sleep. For early sessions this belongs to the
  // evening (anchored to sleep), not right after the morning workout.
  const windDownAt = daypart === "night" || daypart === "evening" ? trainEnd + 45 : sleepAdj - 75;
  if (windDownAt > trainEnd && windDownAt < sleepAdj) {
    candidates.push({ time: windDownAt, within: Math.max(30, sleepAdj - windDownAt), action: { label: "Start Night Recovery Brief", reason: "Protect the sleep window — downshift and keep recovery efficient.", windowLabel: "Wind-Down", target: "recovery" } });
  }

  candidates.sort((a, b) => a.time - b.time);

  // Most-immediate current window (largest start time we're still inside).
  let current: ActionCandidate | null = null;
  for (const c of candidates) {
    if (cur >= c.time && cur < c.time + c.within) current = c;
  }
  if (current) return current.action;

  // Otherwise the next upcoming window.
  const upcoming = candidates.find((c) => c.time > cur);
  if (upcoming) return upcoming.action;

  // Past everything — protect sleep.
  return { label: "Protect Sleep Window", reason: "Past your sleep target — prioritize sleep to keep tomorrow's readiness.", windowLabel: "Night", target: "recovery" };
}

/** Find the next upcoming item relative to now (for highlighting). */
export function nextUpcomingIndex(items: ScheduleItem[], now: Date = new Date()): number {
  /* Items run in the member's day order (buildTodaySchedule), which starts at wake. */
  const wake = items.find((i) => i.kind === "wake")?.minutes ?? 0;
  const cur = dayMinute(now.getHours() * 60 + now.getMinutes(), wake);
  return items.findIndex((i) => dayMinute(i.minutes, wake) >= cur);
}
