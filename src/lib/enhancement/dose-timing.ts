/* ════════════════════════════════════════════════════════════════════════
   DOSE TIMING — a member-set dose time, turned into a clock time on the
   member's own day.

   The member sets every rule: a fixed clock time, a time relative to one of
   their own meals, on waking, or before bed. Reserve never suggests a timing,
   never says one is better than another, and never names an effect. This
   file only reads the member's day (their meal plan from the schedule
   engine, their wake time and sleep target) so that when a meal moves, a
   dose set relative to it moves with it.

   Pure: no React, no store. `getEnhancementDailySchedule` (schedule.ts) is
   the one caller that turns these into Today's slots.
   ════════════════════════════════════════════════════════════════════════ */

import type { CompoundDoseTiming, EnhancementEntry } from "@/lib/athlete-store";

/** One meal on the member's plan today, as the schedule engine placed it. */
export type DoseMealAnchor = { id: string; label: string; slot: string; time: string };

/** The member's day the dose rules resolve against. */
export type DoseAnchors = {
  wakeTime?: string;
  sleepTime?: string;
  meals: readonly DoseMealAnchor[];
  /**
   * Today's training start from the member's schedule ("HH:MM"). `null` on a
   * day they do not train; absent when nothing says either way.
   */
  trainingTime?: string | null;
};

export const MAX_DOSES_PER_DAY = 4;

/** The meal choices every plan can name, by the plan's own slot. */
export const DOSE_MEAL_SLOTS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
] as const;

/** Offsets the member can pick for a meal. Listed in time order; none is marked or preferred. */
export const MEAL_OFFSET_CHOICES = [
  { value: -60, label: "1 h before" },
  { value: -30, label: "30 min before" },
  { value: 0, label: "With" },
  { value: 30, label: "30 min after" },
  { value: 60, label: "1 h after" },
] as const;

export const WINDOW_PREFIX = "window:";

/** Minutes after midnight for "HH:MM", or null. */
export function clockMinutes(time?: string): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function wrap(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

export function minutesToClock(minutes: number): string {
  const w = wrap(minutes);
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
}

/** "8:00 AM" — the same formatting the schedule's other slot labels use. */
export function clockLabel(minutes: number): string {
  const w = wrap(minutes);
  const d = new Date(2000, 0, 1, Math.floor(w / 60), w % 60, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "1 h", "30 min", "1 h 15 min". */
export function durationPhrase(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "1 h before", "With", "45 min after". */
export function offsetPhrase(offsetMin: number): string {
  if (offsetMin === 0) return "With";
  return `${durationPhrase(offsetMin)} ${offsetMin < 0 ? "before" : "after"}`;
}

/** The meal a dose is set against, on today's plan. Null when that meal is not on today's plan. */
export function findMeal(meal: string | undefined, anchors: DoseAnchors): DoseMealAnchor | null {
  if (!meal) return null;
  if (meal.startsWith(WINDOW_PREFIX)) {
    const id = meal.slice(WINDOW_PREFIX.length);
    return anchors.meals.find((m) => m.id === id) ?? null;
  }
  return anchors.meals.find((m) => m.slot === meal) ?? null;
}

/** The meal's name as the member reads it inside a sentence. */
export function mealName(meal: string | undefined, anchors: DoseAnchors): string {
  if (!meal) return "a meal";
  if (meal.startsWith(WINDOW_PREFIX)) {
    const found = findMeal(meal, anchors);
    return found ? found.label : "a meal from your plan";
  }
  const slot = DOSE_MEAL_SLOTS.find((s) => s.value === meal);
  return slot ? slot.label.toLowerCase() : meal;
}

/** The member's rule in words: "1 h before breakfast", "With dinner", "On waking", "30 min before bed". */
export function doseRuleLabel(timing: CompoundDoseTiming, anchors: DoseAnchors): string {
  const offset = timing.offsetMin ?? 0;
  switch (timing.anchor) {
    case "clock":
      return "Set time";
    case "meal":
      return offset === 0 ? `With ${mealName(timing.meal, anchors)}` : `${offsetPhrase(offset)} ${mealName(timing.meal, anchors)}`;
    case "wake":
      return offset === 0 ? "On waking" : `${durationPhrase(offset)} after waking`;
    case "bed":
      return offset === 0 ? "Before bed" : `${durationPhrase(offset)} before bed`;
    case "training":
      return offset === 0 ? "At training" : `${durationPhrase(offset)} before training`;
  }
}

export type ResolvedDose = {
  /** 0-based position in the member's list. */
  index: number;
  minutes: number | null;
  /** "HH:MM", or "—" when the anchor is not on today's plan. */
  plannedTime: string;
  plannedTimeLabel: string;
  /** The member's rule in words. */
  ruleLabel: string;
  /** Why no time could be placed, in plain words. */
  unresolved?: string;
};

/** One dose rule against today's anchors. */
export function resolveDose(timing: CompoundDoseTiming, anchors: DoseAnchors): { minutes: number | null; unresolved?: string } {
  const offset = timing.offsetMin ?? 0;
  switch (timing.anchor) {
    case "clock": {
      const m = clockMinutes(timing.time);
      return m === null ? { minutes: null, unresolved: "No time set" } : { minutes: m };
    }
    case "meal": {
      const meal = findMeal(timing.meal, anchors);
      const base = meal ? clockMinutes(meal.time) : null;
      if (base === null) return { minutes: null, unresolved: `${capitalise(mealName(timing.meal, anchors))} is not on today's plan` };
      return { minutes: wrap(base + offset) };
    }
    case "wake": {
      const base = clockMinutes(anchors.wakeTime);
      return base === null ? { minutes: null, unresolved: "No wake time in your schedule" } : { minutes: wrap(base + offset) };
    }
    case "bed": {
      const base = clockMinutes(anchors.sleepTime);
      return base === null ? { minutes: null, unresolved: "No sleep target in your schedule" } : { minutes: wrap(base - offset) };
    }
    case "training": {
      if (anchors.trainingTime === null) return { minutes: null, unresolved: "No training today" };
      const base = clockMinutes(anchors.trainingTime);
      return base === null ? { minutes: null, unresolved: "No training time in your schedule" } : { minutes: wrap(base - offset) };
    }
  }
}

function capitalise(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Every dose the member set on this entry, resolved. Null when the entry uses its single time-of-day setting. */
export function resolveEntryDoses(entry: Pick<EnhancementEntry, "scheduleRule">, anchors: DoseAnchors): ResolvedDose[] | null {
  const doses = entry.scheduleRule?.doses;
  if (!doses || doses.length === 0) return null;
  return doses.slice(0, MAX_DOSES_PER_DAY).map((timing, index) => {
    const { minutes, unresolved } = resolveDose(timing, anchors);
    return {
      index,
      minutes,
      plannedTime: minutes === null ? "—" : minutesToClock(minutes),
      plannedTimeLabel: minutes === null ? "Unscheduled" : clockLabel(minutes),
      ruleLabel: doseRuleLabel(timing, anchors),
      unresolved,
    };
  });
}

/** "1 h before breakfast · 8:00 AM" — the rule and where it lands today. */
export function describeDose(timing: CompoundDoseTiming, anchors: DoseAnchors): string {
  const { minutes, unresolved } = resolveDose(timing, anchors);
  const when = minutes === null ? unresolved ?? "Unscheduled" : clockLabel(minutes);
  return timing.anchor === "clock" ? when : `${doseRuleLabel(timing, anchors)} · ${when}`;
}

/** A dose rule is complete when it names everything it needs. */
export function isDoseComplete(timing: CompoundDoseTiming): boolean {
  if (timing.anchor === "clock") return clockMinutes(timing.time) !== null;
  if (timing.anchor === "meal") return Boolean(timing.meal);
  return true;
}

/** The meal plan's meals, shaped as dose anchors. */
export function doseAnchorsFrom(
  schedule: { wakeTime?: string; sleepTarget?: string; preferredTrainingStart?: string },
  meals: ReadonlyArray<{ id: string; label: string; slot?: string; time: string }>,
  /** Whether the member trains today. Omitted: unknown, so the schedule's training start is used. */
  trainingToday?: boolean,
): DoseAnchors {
  return {
    wakeTime: schedule.wakeTime,
    sleepTime: schedule.sleepTarget,
    meals: meals.map((m) => ({ id: m.id, label: m.label, slot: m.slot ?? "", time: m.time })),
    trainingTime: trainingToday === false ? null : schedule.preferredTrainingStart,
  };
}
