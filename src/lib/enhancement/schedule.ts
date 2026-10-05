import {
  CompoundScheduleRule,
  EnhancementAdherenceRecord,
  EnhancementAdherenceStatus,
  EnhancementEntry,
  EnhancementFrequencyType,
  EnhancementTimeOfDayPreference,
} from "@/lib/athlete-store";

import { resolveEntryDoses, type DoseAnchors } from "./dose-timing";

export type EnhancementScheduleSlot = {
  id: string; // synthetic per-day key (entryId + plannedTime)
  entryId: string;
  entry: EnhancementEntry;
  bucket: EnhancementTimeOfDayPreference | "post_workout" | "wake" | "wind_down";
  bucketLabel: string;
  plannedTime: string; // "HH:MM" 24h or "—"
  plannedTimeLabel: string; // formatted display
  source: "user-defined timing" | "schedule window";
  status: EnhancementAdherenceStatus;
  adherence?: EnhancementAdherenceRecord;
  /** Set when the member gave this entry its own dose times: which dose (0-based) of how many. */
  doseIndex?: number;
  doseCount?: number;
  /** The member's rule in words, e.g. "1 h before breakfast". */
  timingLabel?: string;
};

export type EnhancementScheduleInput = {
  entries: EnhancementEntry[];
  adherence: EnhancementAdherenceRecord[];
  isTrainingDay?: boolean;
  trainingDaysOfWeek?: number[]; // 0=Sun … 6=Sat — defaults to weekdays
  date?: string; // YYYY-MM-DD
  wakeTime?: string;
  sleepTime?: string;
  preferredGymTime?: string;
  /**
   * The member's day for dose rules set against a meal, waking or bed —
   * today's meal plan from the schedule engine plus the schedule profile's
   * wake time and sleep target. Without it, wake/bed read wakeTime/sleepTime
   * above and a meal-relative dose has no time.
   */
  anchors?: DoseAnchors;
};

const WEEKDAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseHM(t?: string): { h: number; m: number } | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return null;
  return { h: hh || 0, m: mm || 0 };
}

function toMinutes(t?: string): number | null {
  const p = parseHM(t);
  return p ? p.h * 60 + p.m : null;
}

function formatHM(total: number): string {
  const h = ((Math.floor(total / 60) % 24) + 24) % 24;
  const m = ((total % 60) + 60) % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function minutesToHM(total: number): string {
  const h = ((Math.floor(total / 60) % 24) + 24) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function todayDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bucketLabelFor(b: EnhancementScheduleSlot["bucket"]): string {
  switch (b) {
    case "morning": return "Morning";
    case "pre_training": return "Pre-Training";
    case "post_training": return "Post-Training";
    case "evening": return "Evening";
    case "bedtime": return "Bedtime";
    case "custom": return "Custom";
    case "post_workout": return "Post-Workout";
    case "wake": return "Wake Window";
    case "wind_down": return "Wind-Down";
    case "unspecified": return "Unscheduled";
  }
}

function pickPlannedMinutes(
  pref: EnhancementTimeOfDayPreference | undefined,
  customTime: string | undefined,
  wake: number | null,
  gym: number | null,
  gymEnd: number | null,
  sleep: number | null,
): { minutes: number | null; bucket: EnhancementScheduleSlot["bucket"] } {
  switch (pref) {
    case "morning":
      return { minutes: wake !== null ? wake + 15 : 7 * 60, bucket: "morning" };
    case "pre_training":
      return { minutes: gym !== null ? Math.max(0, gym - 30) : null, bucket: "pre_training" };
    case "post_training":
      return { minutes: gymEnd !== null ? gymEnd + 15 : null, bucket: "post_training" };
    case "evening":
      return { minutes: sleep !== null ? sleep - 180 : 19 * 60, bucket: "evening" };
    case "bedtime":
      return { minutes: sleep !== null ? sleep - 30 : 22 * 60, bucket: "bedtime" };
    case "custom": {
      const cm = toMinutes(customTime);
      return { minutes: cm, bucket: "custom" };
    }
    default:
      return { minutes: null, bucket: "unspecified" };
  }
}

/** Where a member-set dose sits in the day's bucket order, from its placed time. */
function doseBucket(minutes: number | null, sleep: number | null, anchor?: string): EnhancementScheduleSlot["bucket"] {
  if (minutes === null) return "unspecified";
  if (anchor === "wake") return "wake";
  if (anchor === "bed") return "bedtime";
  if (anchor === "training") return "pre_training";
  if (minutes >= 4 * 60 && minutes < 11 * 60) return "morning";
  if (minutes >= 4 * 60 && minutes < 17 * 60) return "custom";
  if (sleep !== null && minutes >= sleep - 60) return "bedtime";
  if (minutes >= 17 * 60) return "evening";
  return "bedtime";
}

const DEFAULT_TRAINING_DAYS = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri

const TRAINING_TAGS_BY_DOW: Record<number, string[]> = {
  0: ["rest", "recovery", "posing"],
  1: ["training", "upper", "chest", "back", "push", "pull", "chest-back"],
  2: ["training", "lower", "legs", "leg", "abs"],
  3: ["training", "upper", "arms", "shoulders", "delts", "arm-shoulder"],
  4: ["training", "upper", "chest", "back", "push", "pull", "chest-back"],
  5: ["training", "lower", "legs", "leg", "posterior"],
  6: ["training", "upper", "specialization", "conditioning", "arms", "shoulders"],
};

function dayMatchesTraining(dow: number, trainingDays: number[]): boolean {
  return trainingDays.includes(dow);
}

function dateDiffDays(a: Date, b: Date): number {
  const start = new Date(a);
  start.setHours(0, 0, 0, 0);
  const end = new Date(b);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export type ScheduleRuleResolution = {
  due: boolean;
  reviewRequired: boolean;
  reviewReason?: string;
};

/** Whole days since 1970 for a YYYY-MM-DD key — calendar arithmetic, so DST never shifts a day. */
function dayNumber(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/**
 * "N days on, M days off", counted from the anchor date. Deterministic by the
 * local day key. Days before the anchor are not scheduled.
 */
export function isOnOffCycleDay(daysOn: number, daysOff: number, anchorKey: string, dateKey: string): boolean {
  const start = dayNumber(anchorKey);
  const day = dayNumber(dateKey);
  if (start === null || day === null || daysOn <= 0 || daysOff < 0) return false;
  const diff = day - start;
  if (diff < 0) return false;
  return diff % (daysOn + daysOff) < daysOn;
}

export function resolveScheduleRuleForDate(
  rule: CompoundScheduleRule | undefined,
  date: Date,
  trainingDays: number[] = DEFAULT_TRAINING_DAYS,
  /** The entry's start date — the on/off cycle's anchor when the rule has none of its own. */
  fallbackAnchor?: string,
): ScheduleRuleResolution | null {
  if (!rule) return null;
  const dow = date.getDay();
  const key = todayDate(date);
  const isTraining = dayMatchesTraining(dow, trainingDays);
  const tags = TRAINING_TAGS_BY_DOW[dow] ?? [];
  const hasTag = (needles: string[]) => needles.some((needle) => tags.includes(needle));

  switch (rule.type) {
    case "daily":
      return { due: true, reviewRequired: false };
    case "specific_weekdays":
      return { due: (rule.weekdays ?? []).includes(dow), reviewRequired: false };
    case "every_x_days": {
      if (!rule.anchorDate || !rule.intervalDays || rule.intervalDays <= 0) {
        return { due: false, reviewRequired: true, reviewReason: "Every X days needs an anchor date and interval." };
      }
      return { due: dateDiffDays(new Date(`${rule.anchorDate}T00:00:00`), date) % rule.intervalDays === 0, reviewRequired: false };
    }
    case "every_x_weeks": {
      if (!rule.anchorDate || !rule.intervalWeeks || rule.intervalWeeks <= 0) {
        return { due: false, reviewRequired: true, reviewReason: "Every X weeks needs an anchor date and interval." };
      }
      const weekDiff = Math.floor(dateDiffDays(new Date(`${rule.anchorDate}T00:00:00`), date) / 7);
      const weekdayMatch = (rule.weekdays ?? [new Date(`${rule.anchorDate}T00:00:00`).getDay()]).includes(dow);
      return { due: weekdayMatch && weekDiff % rule.intervalWeeks === 0, reviewRequired: false };
    }
    case "training_days_only":
    case "all_training_days":
      return { due: isTraining, reviewRequired: false };
    case "all_6_training_days":
      return { due: dow >= 1 && dow <= 6, reviewRequired: false };
    case "rest_days_only":
      return { due: !isTraining, reviewRequired: false };
    case "upper_body_days":
      return { due: hasTag(["upper"]), reviewRequired: false };
    case "lower_body_days":
      return { due: hasTag(["lower", "legs", "leg"]), reviewRequired: false };
    case "push_days":
      return { due: hasTag(["push"]), reviewRequired: false };
    case "pull_days":
      return { due: hasTag(["pull"]), reviewRequired: false };
    case "leg_days":
      return { due: hasTag(["legs", "leg"]), reviewRequired: false };
    case "chest_back_days":
      return { due: hasTag(["chest-back", "chest", "back"]), reviewRequired: false };
    case "arm_shoulder_days":
      return { due: hasTag(["arm-shoulder", "arms", "shoulders", "delts"]), reviewRequired: false };
    case "conditioning_days":
      return { due: hasTag(["conditioning"]), reviewRequired: false };
    case "custom_training_tags": {
      const requested = (rule.trainingTags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
      if (requested.length === 0) {
        return { due: false, reviewRequired: true, reviewReason: "Custom training tags need at least one tag." };
      }
      const known = requested.some((tag) => tags.includes(tag));
      if (!known) {
        return { due: false, reviewRequired: true, reviewReason: "Custom training tag cannot be matched to today's training plan." };
      }
      return { due: true, reviewRequired: false };
    }
    case "custom_date_sequence":
      return { due: (rule.dateSequence ?? []).includes(key), reviewRequired: false };
    case "on_off_cycle": {
      const anchor = rule.anchorDate ?? fallbackAnchor;
      if (!anchor || !rule.daysOn || rule.daysOn <= 0) {
        return { due: false, reviewRequired: true, reviewReason: "On / off cycle needs days on and a start date." };
      }
      return { due: isOnOffCycleDay(rule.daysOn, rule.daysOff ?? 0, anchor, key), reviewRequired: false };
    }
    case "manual_only":
      return { due: false, reviewRequired: false };
  }
}

/**
 * Hard rule for "Due Today":
 *   isDueToday(entry, currentDate, isTrainingDay) returns true ONLY when the
 *   entry's frequencyType + daysOfWeek match the current calendar day.
 *   A weekly Sunday entry on a Thursday will return false.
 */
export function isEntryDueOnDate(
  entry: EnhancementEntry,
  date: Date,
  trainingDays: number[] = DEFAULT_TRAINING_DAYS,
): boolean {
  if (!entry.isActive) return false;
  if (entry.pausedAt) return false;
  if (entry.startDate && todayDate(date) < entry.startDate) return false;

  const ft: EnhancementFrequencyType = entry.frequencyType ?? "daily";
  const dow = date.getDay();
  const isTraining = dayMatchesTraining(dow, trainingDays);
  const ruleResolution = resolveScheduleRuleForDate(entry.scheduleRule, date, trainingDays, entry.startDate);
  if (ruleResolution) {
    return ruleResolution.reviewRequired ? false : ruleResolution.due;
  }

  switch (ft) {
    case "daily": return true;
    case "training_only": return isTraining;
    case "rest_only": return !isTraining;
    case "weekly":
    case "specific_days": {
      const days = entry.daysOfWeek ?? [];
      return days.includes(dow);
    }
    case "custom": return false;
  }
}

/**
 * Compute the next due Date for an entry, scanning up to 14 days ahead.
 * Returns null when frequency is custom or no future day matches in the window.
 */
export function computeNextDueDate(
  entry: EnhancementEntry,
  from: Date = new Date(),
  trainingDays: number[] = DEFAULT_TRAINING_DAYS,
): Date | null {
  const ft: EnhancementFrequencyType = entry.frequencyType ?? "daily";
  /* A schedule rule, when set, is the answer; the legacy frequency only speaks without one. */
  if (entry.scheduleRule ? entry.scheduleRule.type === "manual_only" : ft === "custom") return null;
  for (let i = 0; i < 14; i += 1) {
    const probe = new Date(from);
    probe.setDate(probe.getDate() + i);
    probe.setHours(0, 0, 0, 0);
    if (isEntryDueOnDate(entry, probe, trainingDays)) return probe;
  }
  return null;
}

export function formatNextDueLabel(
  nextDate: Date | null,
  plannedTimeMinutes: number | null,
): string {
  if (!nextDate) return "—";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const probeKey = todayDate(nextDate);
  const todayKey = todayDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = todayDate(tomorrow);

  const dayLabel = probeKey === todayKey ? "Today"
    : probeKey === tomorrowKey ? "Tomorrow"
    : WEEKDAY_LABELS_LONG[nextDate.getDay()];

  if (plannedTimeMinutes === null) return dayLabel;
  return `${dayLabel} · ${formatHM(plannedTimeMinutes)}`;
}

export type EnhancementScheduleState = {
  isDueToday: boolean;
  bucket: EnhancementScheduleSlot["bucket"];
  bucketLabel: string;
  plannedTime: string; // "HH:MM" today
  plannedTimeLabel: string;
  nextDueDate: Date | null;
  nextDueLabel: string; // e.g. "Sunday · 6:15 AM"
};

/**
 * Per-entry schedule state for today. Used by registry cards and by Today's Flow.
 */
export function computeEntryScheduleState(
  entry: EnhancementEntry,
  input: { wakeTime?: string; sleepTime?: string; preferredGymTime?: string; trainingDaysOfWeek?: number[]; now?: Date; anchors?: DoseAnchors },
): EnhancementScheduleState {
  const now = input.now ?? new Date();
  const trainingDays = input.trainingDaysOfWeek ?? DEFAULT_TRAINING_DAYS;
  const wake = toMinutes(input.wakeTime);
  const gym = toMinutes(input.preferredGymTime);
  const sleep = toMinutes(input.sleepTime);
  const gymEnd = gym !== null ? gym + 85 : null;

  const legacy = pickPlannedMinutes(
    entry.timeOfDayPreference,
    entry.customTime,
    wake,
    gym,
    gymEnd,
    sleep,
  );
  /* With member-set dose times, the first placed dose is the entry's time. */
  const doses = resolveEntryDoses(entry, input.anchors ?? { wakeTime: input.wakeTime, sleepTime: input.sleepTime, meals: [] });
  const firstDose = doses?.filter((d) => d.minutes !== null).sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0))[0];
  const minutes = doses ? firstDose?.minutes ?? null : legacy.minutes;
  const bucket = doses ? doseBucket(firstDose?.minutes ?? null, sleep) : legacy.bucket;
  const plannedTime = minutes !== null ? minutesToHM(minutes) : "—";
  const plannedTimeLabel = minutes !== null ? formatHM(minutes) : "Unscheduled";

  const isDueToday = isEntryDueOnDate(entry, now, trainingDays);
  const nextDueDate = isDueToday ? now : computeNextDueDate(entry, addDays(now, 1), trainingDays);
  const nextDueLabel = formatNextDueLabel(nextDueDate, minutes);

  return {
    isDueToday,
    bucket,
    bucketLabel: bucketLabelFor(bucket),
    plannedTime,
    plannedTimeLabel,
    nextDueDate,
    nextDueLabel,
  };
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * getEnhancementDailySchedule
 *
 * Returns the list of slots that are ACTUALLY scheduled for today, based on the
 * member's frequency rules. An entry scheduled for Sunday will NOT appear on
 * Thursday — instead, callers use computeEntryScheduleState for "next due".
 */
export function getEnhancementDailySchedule(input: EnhancementScheduleInput): EnhancementScheduleSlot[] {
  const dateStr = input.date ?? todayDate();
  const wake = toMinutes(input.wakeTime);
  const gym = toMinutes(input.preferredGymTime);
  const sleep = toMinutes(input.sleepTime);
  const gymEnd = gym !== null ? gym + 85 : null;
  const trainingDays = input.trainingDaysOfWeek ?? DEFAULT_TRAINING_DAYS;
  const refDate = new Date(`${dateStr}T00:00:00`);

  const dueEntries = input.entries.filter((e) => {
    const resolution = resolveScheduleRuleForDate(e.scheduleRule, refDate, trainingDays, e.startDate);
    if (resolution?.reviewRequired) return true;
    return isEntryDueOnDate(e, refDate, trainingDays);
  });
  const anchors: DoseAnchors = input.anchors ?? { wakeTime: input.wakeTime, sleepTime: input.sleepTime, meals: [] };
  const anchorSleep = toMinutes(anchors.sleepTime) ?? sleep;

  const slots: EnhancementScheduleSlot[] = dueEntries.flatMap((entry): EnhancementScheduleSlot[] => {
    const resolution = resolveScheduleRuleForDate(entry.scheduleRule, refDate, trainingDays, entry.startDate);
    const slotEntry = resolution?.reviewRequired
      ? { ...entry, scheduleReviewReason: resolution.reviewReason ?? entry.scheduleReviewReason ?? "Schedule Review Required" }
      : entry;

    /* Member-set dose times: one slot per dose, each with its own key so each is logged or skipped on its own. */
    const doses = resolveEntryDoses(entry, anchors);
    if (doses) {
      return doses.map((dose): EnhancementScheduleSlot => {
        const adherence = input.adherence.find(
          (r) => r.entryId === entry.id && r.date === dateStr && r.plannedTime === dose.plannedTime,
        );
        return {
          id: `${entry.id}-d${dose.index + 1}-${dose.plannedTime}`,
          entryId: entry.id,
          bucket: doseBucket(dose.minutes, anchorSleep, entry.scheduleRule?.doses?.[dose.index]?.anchor),
          bucketLabel: dose.ruleLabel,
          plannedTime: dose.plannedTime,
          plannedTimeLabel: dose.plannedTimeLabel,
          source: "user-defined timing",
          status: adherence?.takenStatus ?? "planned",
          adherence,
          entry: slotEntry,
          doseIndex: dose.index,
          doseCount: doses.length,
          timingLabel: dose.ruleLabel,
        };
      });
    }

    const pref = entry.timeOfDayPreference ?? "unspecified";
    const { minutes, bucket } = pickPlannedMinutes(pref, entry.customTime, wake, gym, gymEnd, sleep);
    const plannedTime = minutes !== null ? minutesToHM(minutes) : "—";
    const plannedTimeLabel = minutes !== null ? formatHM(minutes) : "Unscheduled";

    const adherence = input.adherence.find(
      (r) => r.entryId === entry.id && r.date === dateStr && r.plannedTime === plannedTime,
    );
    const status: EnhancementAdherenceStatus = adherence?.takenStatus ?? "planned";

    return [{
      id: `${entry.id}-${plannedTime}`,
      entryId: entry.id,
      bucket,
      bucketLabel: bucketLabelFor(bucket),
      plannedTime,
      plannedTimeLabel,
      source: pref === "custom" || pref === "unspecified" ? "user-defined timing" : "schedule window",
      status,
      adherence,
      entry: slotEntry,
    }];
  });

  // Sort by bucket order, then by time
  const bucketOrder: Record<EnhancementScheduleSlot["bucket"], number> = {
    wake: 0,
    morning: 1,
    pre_training: 2,
    post_training: 3,
    post_workout: 4,
    custom: 5,
    evening: 6,
    wind_down: 7,
    bedtime: 8,
    unspecified: 9,
  };

  slots.sort((a, b) => {
    const ord = bucketOrder[a.bucket] - bucketOrder[b.bucket];
    if (ord !== 0) return ord;
    return a.plannedTime.localeCompare(b.plannedTime);
  });

  return slots;
}

export type EnhancementDailySummary = {
  planned: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  nextSlot: EnhancementScheduleSlot | null;
};

export function summarizeEnhancementSchedule(slots: EnhancementScheduleSlot[]): EnhancementDailySummary {
  const summary: EnhancementDailySummary = { planned: slots.length, taken: 0, skipped: 0, missed: 0, pending: 0, nextSlot: null };
  for (const s of slots) {
    if (s.status === "taken") summary.taken += 1;
    else if (s.status === "skipped") summary.skipped += 1;
    else if (s.status === "missed") summary.missed += 1;
    else summary.pending += 1;
  }
  summary.nextSlot = slots.find((s) => s.status === "planned") ?? null;
  return summary;
}

export function todayDateString(): string {
  return todayDate();
}

export function weekdayShort(day: number): string {
  return WEEKDAY_LABELS_SHORT[((day % 7) + 7) % 7];
}

export function weekdayLong(day: number): string {
  return WEEKDAY_LABELS_LONG[((day % 7) + 7) % 7];
}
