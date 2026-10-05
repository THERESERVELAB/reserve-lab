/* ════════════════════════════════════════════════════════════════════════
   DOUBLE DAY — a morning session in front of the evening lift.

   The repo claimed to support this. "two-a-days" appeared exactly twice, both
   times in marketing copy on the Schedule Builder, and the protocol week was
   strictly one session per day: neither ArchitectureDay nor BlueprintDay had
   any notion of a morning and an evening.

   `preferFasted` was stored on the profile and read by nothing at all.

   This is opt-in, available to every member on any split, and it names the
   weekdays rather than a count — four sessions a week on Monday, Tuesday,
   Thursday and Friday is a different week from "four sessions, you choose".

   Fasted training is described as PLACEMENT AND STRUCTURE only. Reserve makes
   no metabolic or body-composition claim for training before food, and never
   says a fasted session burns, targets or releases anything.

   Leaf module: imports the activity and commitment leaves only. Pure.
   ════════════════════════════════════════════════════════════════════════ */

import { splitActivity, type SplitActivityKey } from "./split-activities";
import { WEEKDAY_SHORT, type WeekdayIndex } from "./weekly-commitments";

/** How she runs the steady-state work. Routes, not prescriptions. */
export type MorningRoute = "outdoor" | "treadmill" | "stair-climber" | "bike" | "split";

export const MORNING_ROUTE_LABEL: Record<MorningRoute, string> = {
  outdoor: "Outdoors",
  treadmill: "Treadmill",
  "stair-climber": "Stair climber",
  bike: "Bike",
  split: "Treadmill + stair climber",
};

export type DoubleDay = {
  enabled: boolean;
  /** What the morning session is. Steady-state cardio by default. */
  activity: SplitActivityKey;
  /** The weekdays it runs on. 0 = Monday. */
  days: WeekdayIndex[];
  minutes: number;
  /** Trained before food, by her choice. Structure only — no claim attached. */
  fasted: boolean;
  route: MorningRoute;
};

export const DEFAULT_DOUBLE_DAY: DoubleDay = {
  enabled: false,
  activity: "zone2",
  days: [],
  minutes: 25,
  fasted: false,
  route: "treadmill",
};

export const DOUBLE_DAY_MIN_MINUTES = 10;
export const DOUBLE_DAY_MAX_MINUTES = 120;

export function isValidDoubleDay(value: unknown): value is DoubleDay {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DoubleDay>;
  if (typeof d.enabled !== "boolean") return false;
  if (!splitActivity(d.activity as string)) return false;
  if (!Array.isArray(d.days)) return false;
  if (d.days.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) return false;
  if (new Set(d.days).size !== d.days.length) return false;
  if (typeof d.minutes !== "number" || d.minutes < DOUBLE_DAY_MIN_MINUTES || d.minutes > DOUBLE_DAY_MAX_MINUTES) return false;
  if (typeof d.fasted !== "boolean") return false;
  if (!d.route || !(d.route in MORNING_ROUTE_LABEL)) return false;
  return true;
}

export function sanitizeDoubleDay(value: unknown): DoubleDay {
  return isValidDoubleDay(value) ? value : DEFAULT_DOUBLE_DAY;
}

/** Whether a morning session runs on this weekday. */
export function hasMorningSession(dd: DoubleDay, day: WeekdayIndex): boolean {
  return dd.enabled && dd.days.includes(day);
}

/** How many mornings a week she has committed to. */
export function morningsPerWeek(dd: DoubleDay): number {
  return dd.enabled ? dd.days.length : 0;
}

export type MorningSession = {
  title: string;
  /** "25 min · Zone 2 · Treadmill" */
  shape: string;
  /** The split route spelled out, when she chose it. */
  detail: string | null;
  fasted: boolean;
};

/**
 * The morning session for a day, or null when there is none. Describes what
 * she chose; it does not decide anything for her.
 */
export function morningSessionFor(dd: DoubleDay, day: WeekdayIndex): MorningSession | null {
  if (!hasMorningSession(dd, day)) return null;
  const def = splitActivity(dd.activity);
  const label = def?.label ?? "Morning session";
  const zone = dd.activity === "zone2" || dd.activity === "walk" ? " · Zone 2" : "";
  const detail =
    dd.route === "split" && dd.minutes >= 20
      ? `${Math.round(dd.minutes * 0.7)} min treadmill, then ${dd.minutes - Math.round(dd.minutes * 0.7)} min on the stair climber — same zone throughout.`
      : null;
  return {
    title: dd.fasted ? `Fasted ${label.toLowerCase()}` : label,
    shape: `${dd.minutes} min${zone} · ${MORNING_ROUTE_LABEL[dd.route]}`,
    detail,
    fasted: dd.fasted,
  };
}

/** "Mon, Tue, Thu and Fri" — the days, read back to her. */
export function morningDaysLabel(dd: DoubleDay): string {
  if (!dd.enabled || dd.days.length === 0) return "No mornings set";
  const names = dd.days.slice().sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]);
  if (names.length === 1) return names[0];
  if (names.length === 7) return "Every day";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One honest line summarising the arrangement. No claims, no encouragement. */
export function doubleDaySummary(dd: DoubleDay): string {
  if (!dd.enabled) return "Double Day is off — one session a day.";
  if (dd.days.length === 0) return "Double Day is on, but no mornings are set yet.";
  const def = splitActivity(dd.activity);
  const fasted = dd.fasted ? "before food, " : "";
  return `${def?.label ?? "Morning session"} ${fasted}${dd.minutes} min on ${morningDaysLabel(dd)}, with the lift later the same day.`;
}
