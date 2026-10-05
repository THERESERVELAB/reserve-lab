/* ────────────────────────────────────────────────────────────────────────────
   SCHEDULE DERIVATION + RECONCILIATION — one schedule truth, everywhere.

   Root cause this module kills: onboarding historically wrote only
   trainingSession.schedulePlan while every meal/timeline engine reads
   scheduleProfile — so a member training at 6:05 AM could keep the stale
   default 21:00–23:00 evening block and receive a 7:30 PM "pre-workout"
   meal and an 11:10 PM "post-workout" meal. All schedule writes now flow
   through these derivations, and rehydration repairs stale members.
   ──────────────────────────────────────────────────────────────────────── */

import {
  DEFAULT_SCHEDULE_PROFILE,
  type MealWindow,
  type MemberScheduleProfile,
  type TrainingWindow,
} from "./types";
import { classifyTrainingDaypart, minutesToTime, timeToMinutes } from "./engine";

const DAY = 1440;

/**
 * A clock minute on the member's day, which runs from wake: anything before
 * wake is after midnight. (A fixed "before 06:00" cut misread a 4:45 AM
 * riser's own 5:00 AM windows as falling after their 9:30 PM sleep, and a
 * shift worker's 7:00 AM sleep as before their 3:00 PM wake.)
 */
function onDay(mins: number, wake: number): number {
  return mins < wake ? mins + DAY : mins;
}

/** The sleep target on the member's day: at or before wake on the clock means tomorrow. */
function sleepOnDay(sleep: number, wake: number): number {
  return sleep <= wake ? sleep + DAY : sleep;
}

/**
 * Normalize any member-entered time ("6:30 AM", "10:30 PM", "06:30") to
 * 24h "HH:MM". Onboarding historically stored 12h strings, which the minute
 * parser silently misread (10:30 PM → 10:30 AM).
 */
export function to24h(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return raw;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === "PM" && h < 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export type ScheduleIntent = {
  wakeTime: string;
  sleepTime: string;
  /** Coarse window from onboarding ("morning", "evening", …). */
  preferredWindow?: TrainingWindow;
  /** Exact start ("06:05") — always wins over the coarse window. */
  explicitTrainingStart?: string;
  trainingDaysPerWeek?: number;
  sessionDurationMin?: number;
};

/** Map a coarse window to a concrete start, clamped inside the waking day. */
export function deriveTrainingStart(intent: ScheduleIntent): string {
  if (intent.explicitTrainingStart) return to24h(intent.explicitTrainingStart);
  const wake = timeToMinutes(to24h(intent.wakeTime));
  const sleep = sleepOnDay(timeToMinutes(to24h(intent.sleepTime)), wake);
  const anchor: Record<TrainingWindow, number> = {
    morning: wake + 30,
    midday: 12 * 60,
    afternoon: 16 * 60 + 30,
    evening: 18 * 60,
    night: 20 * 60,
  };
  const duration = intent.sessionDurationMin ?? 75;
  let start = anchor[intent.preferredWindow ?? "evening"];
  // Never before the member is awake, never so late the session eats sleep.
  if (start < wake + 20) start = wake + 20;
  const latestStart = sleep - duration - 60;
  if (start > latestStart) start = Math.max(wake + 20, latestStart);
  return minutesToTime(((start % DAY) + DAY) % DAY);
}

/**
 * Re-anchor the editable meal-window list to the member's actual day.
 * (Effective render times still flow through buildMealPlan, which derives
 * pre/post from the training block — these are the sane editable bases.)
 */
export function deriveMealWindows(p: {
  wakeTime: string;
  sleepTarget: string;
  preferredTrainingStart: string;
  preferredTrainingEnd: string;
}): MealWindow[] {
  const wake = timeToMinutes(p.wakeTime);
  const sleep = sleepOnDay(timeToMinutes(p.sleepTarget), wake);
  const trainStart = onDay(timeToMinutes(p.preferredTrainingStart), wake);
  const trainEndRaw = onDay(timeToMinutes(p.preferredTrainingEnd), wake);
  const trainEnd = trainEndRaw <= trainStart ? trainEndRaw + DAY : trainEndRaw;
  const morning = classifyTrainingDaypart({
    ...DEFAULT_SCHEDULE_PROFILE,
    ...p,
  }) === "morning";

  const clampToSleep = (mins: number, margin = 60) => Math.min(mins, sleep - margin);
  const t = (mins: number) => minutesToTime(((mins % DAY) + DAY) % DAY);

  return [
    {
      id: "morning-anchor",
      label: morning ? "Morning Hydration / Light Fuel" : "Morning Protein Anchor",
      time: t(morning ? Math.max(wake + 10, trainStart - 25) : wake + 45),
      enabled: true,
    },
    {
      id: "pre-workout",
      // The slot before the session. For a session right after waking the
      // engine makes it an optional food-only shake (the member trains fasted
      // unless they chose to fuel first), so it stays on and before the start.
      label: "Pre-Workout Meal",
      time: t(morning ? Math.min(trainStart - 10, Math.max(wake + 15, trainStart - 30)) : Math.max(wake + 30, trainStart - 90)),
      enabled: true,
    },
    {
      id: "post-workout",
      label: "Post-Workout Meal",
      time: t(clampToSleep(trainEnd + 15, 45)),
      enabled: true,
    },
    {
      id: "midday",
      label: "Midday Meal",
      // Keep clear of the training block.
      time: t(
        12 * 60 + 30 >= trainStart - 30 && 12 * 60 + 30 <= trainEnd
          ? trainEnd + 45
          : 12 * 60 + 30,
      ),
      enabled: true,
    },
    {
      id: "night",
      label: "Evening Recovery Meal",
      time: t(clampToSleep(sleep - 90, 60)),
      // Optional by default — the member opts in.
      enabled: false,
    },
  ];
}

/** Build a fully coherent schedule profile from onboarding/edit intent. */
export function deriveScheduleProfile(
  intent: ScheduleIntent,
  base: MemberScheduleProfile = DEFAULT_SCHEDULE_PROFILE,
): MemberScheduleProfile {
  const duration = intent.sessionDurationMin ?? 75;
  const start = deriveTrainingStart(intent);
  const startMin = timeToMinutes(start);
  const end = minutesToTime((startMin + duration + 15) % DAY);
  const draft: MemberScheduleProfile = {
    ...base,
    wakeTime: to24h(intent.wakeTime),
    sleepTarget: to24h(intent.sleepTime),
    preferredTrainingStart: start,
    preferredTrainingEnd: end,
    trainingDaysPerWeek: intent.trainingDaysPerWeek ?? base.trainingDaysPerWeek,
    trainingWindow: "evening",
  };
  draft.trainingWindow = classifyTrainingDaypart(draft);
  draft.mealWindows = deriveMealWindows(draft);
  return draft;
}

/* ─── Contradiction validation ────────────────────────────────────────────── */

export type ScheduleContradiction = {
  code:
    | "pre-workout-after-training"
    | "post-workout-detached"
    | "meal-after-sleep"
    | "training-window-mismatch"
    | "training-into-sleep"
    | "wake-after-sleep";
  message: string;
};

/**
 * Detect impossible schedule states BEFORE they render. The app must never
 * show a pre-workout meal after the workout, a recovery meal after bedtime,
 * or instructions for a training window the member doesn't use.
 */
export function scheduleContradictions(p: MemberScheduleProfile): ScheduleContradiction[] {
  const out: ScheduleContradiction[] = [];
  const wake = timeToMinutes(p.wakeTime);
  const sleep = sleepOnDay(timeToMinutes(p.sleepTarget), wake);
  const trainStart = onDay(timeToMinutes(p.preferredTrainingStart), wake);
  const trainEndRaw = onDay(timeToMinutes(p.preferredTrainingEnd), wake);
  const trainEnd = trainEndRaw <= trainStart ? trainEndRaw + DAY : trainEndRaw;

  if (timeToMinutes(p.sleepTarget) === wake) {
    /* A sleep target later on the clock than wake is a day that runs past midnight (a shift worker), not a contradiction. */
    out.push({ code: "wake-after-sleep", message: "Wake time is the same as the sleep target." });
  }
  if (trainEnd >= sleep) {
    out.push({ code: "training-into-sleep", message: "Training runs into the sleep window." });
  }
  if (classifyTrainingDaypart(p) !== p.trainingWindow) {
    out.push({
      code: "training-window-mismatch",
      message: `Training window label ("${p.trainingWindow}") disagrees with the ${p.preferredTrainingStart} start time.`,
    });
  }

  for (const w of p.mealWindows) {
    if (!w.enabled) continue;
    const mins = onDay(timeToMinutes(w.time), wake);
    if (w.id === "pre-workout" && mins >= trainStart) {
      out.push({
        code: "pre-workout-after-training",
        message: `Pre-workout meal (${w.time}) is scheduled after the ${p.preferredTrainingStart} session start.`,
      });
    }
    if (w.id === "post-workout" && mins > trainEnd + 180) {
      out.push({
        code: "post-workout-detached",
        message: `Post-workout meal (${w.time}) is more than 3 hours after training ends.`,
      });
    }
    if (mins >= sleep) {
      out.push({
        code: "meal-after-sleep",
        message: `${w.label} (${w.time}) falls at or after the ${p.sleepTarget} sleep target.`,
      });
    }
  }
  return out;
}

/** Recompute the derived parts of a contradictory profile. Member-chosen
    wake/sleep/training start and enabled/disabled meal choices are kept. */
export function repairScheduleProfile(p: MemberScheduleProfile): MemberScheduleProfile {
  const enabledById = new Map(p.mealWindows.map((w) => [w.id, w.enabled]));
  const repaired: MemberScheduleProfile = {
    ...p,
    trainingWindow: classifyTrainingDaypart(p),
    mealWindows: deriveMealWindows(p).map((w) => ({
      ...w,
      // Preserve explicit member opt-in/out. (A morning session no longer
      // forces the pre-workout slot off: the engine turns it into the optional
      // shake for an early session.)
      enabled: enabledById.get(w.id) ?? w.enabled,
    })),
  };
  return repaired;
}

/* ─── Rehydration reconciliation (existing members) ───────────────────────── */

type SchedulePlanLike = {
  workoutTime?: string;
  wakeTime?: string;
  sleepTime?: string;
};

const STALE_DEFAULT = {
  start: DEFAULT_SCHEDULE_PROFILE.preferredTrainingStart,
  end: DEFAULT_SCHEDULE_PROFILE.preferredTrainingEnd,
  window: DEFAULT_SCHEDULE_PROFILE.trainingWindow,
};

/**
 * One-time repair when local/cloud state rehydrates:
 *
 *  1. A profile still sitting on the untouched factory evening block while
 *     the training plan carries a real member workout time → rebuild the
 *     profile around the plan (this is the reported 6:05 AM bug).
 *  2. Otherwise the profile is the member's chosen truth.
 *  3. Any remaining contradictions are repaired deterministically.
 */
export function reconcileScheduleSources(
  profile: MemberScheduleProfile,
  plan: SchedulePlanLike | undefined,
): MemberScheduleProfile {
  let next = profile;

  const profileIsFactoryBlock =
    profile.preferredTrainingStart === STALE_DEFAULT.start &&
    profile.preferredTrainingEnd === STALE_DEFAULT.end &&
    profile.trainingWindow === STALE_DEFAULT.window;

  const planTime = plan?.workoutTime;
  if (
    profileIsFactoryBlock &&
    planTime &&
    planTime !== profile.preferredTrainingStart
  ) {
    next = deriveScheduleProfile(
      {
        wakeTime: plan?.wakeTime ?? profile.wakeTime,
        sleepTime: plan?.sleepTime ?? profile.sleepTarget,
        explicitTrainingStart: planTime,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
      },
      profile,
    );
  }

  if (scheduleContradictions(next).length > 0) {
    next = repairScheduleProfile(next);
  }
  return next;
}
