import {
  EnhancementEntry,
  EnhancementFrequencyType,
} from "@/lib/athlete-store";

/**
 * Legacy-text schedule migration.
 *
 * Older entries stored free-text timing like "BEFORE BREAKFAST ON SUNDAYS".
 * The default migration to v9 made these "Daily", which is wrong — a Sunday-
 * only item must not become a daily reminder.
 *
 * This pass scans the timingPreference / frequency / customTime strings for
 * weekday tokens. If found, the entry is converted to weekly + the matching
 * `daysOfWeek`. If the text is ambiguous (mentions a day word but the
 * structured fields already disagree), the entry is flagged so it surfaces
 * in the Reserve Review panel and is NOT scheduled until the member resolves
 * it.
 */

const DAY_TOKENS: Array<{ tokens: string[]; dow: number }> = [
  { tokens: ["sunday", "sundays", "sun"], dow: 0 },
  { tokens: ["monday", "mondays", "mon"], dow: 1 },
  { tokens: ["tuesday", "tuesdays", "tue", "tues"], dow: 2 },
  { tokens: ["wednesday", "wednesdays", "wed"], dow: 3 },
  { tokens: ["thursday", "thursdays", "thu", "thur", "thurs"], dow: 4 },
  { tokens: ["friday", "fridays", "fri"], dow: 5 },
  { tokens: ["saturday", "saturdays", "sat"], dow: 6 },
];

function containsWord(text: string, word: string): boolean {
  // Match as a whole word, case-insensitive
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function extractDaysFromText(text: string): number[] {
  if (!text) return [];
  const days = new Set<number>();
  for (const { tokens, dow } of DAY_TOKENS) {
    for (const token of tokens) {
      if (containsWord(text, token)) {
        days.add(dow);
        break;
      }
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

export type ScheduleMigrationResult = {
  /** Suggested frequencyType after parsing. */
  frequencyType: EnhancementFrequencyType;
  /** Suggested daysOfWeek if the text mentioned specific weekdays. */
  daysOfWeek: number[];
  /** True if Reserve cannot safely schedule this entry until the member updates it. */
  reviewRequired: boolean;
  /** Human-readable reason for the review flag, or null. */
  reviewReason: string | null;
};

/**
 * Inspect legacy text fields on an entry and decide what its schedule
 * should actually be. Returns the recommended schedule + a review flag.
 */
export function migrateScheduleFromLegacyText(entry: EnhancementEntry): ScheduleMigrationResult {
  const combined = [entry.timingPreference, entry.frequency, entry.customTime]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" · ");

  const parsedDays = extractDaysFromText(combined);
  const declared = entry.frequencyType ?? "daily";
  const declaredDays = entry.daysOfWeek ?? [];

  // No weekday tokens — keep whatever the entry already had.
  if (parsedDays.length === 0) {
    return {
      frequencyType: declared,
      daysOfWeek: declaredDays,
      reviewRequired: false,
      reviewReason: null,
    };
  }

  // Legacy text mentions weekdays, but entry is marked Daily. That's the
  // exact bug we're fixing — upgrade to weekly.
  if (declared === "daily") {
    return {
      frequencyType: "weekly",
      daysOfWeek: parsedDays,
      reviewRequired: false,
      reviewReason: null,
    };
  }

  // Already weekly / specific_days but no days picked — adopt the parsed days.
  if ((declared === "weekly" || declared === "specific_days") && declaredDays.length === 0) {
    return {
      frequencyType: declared,
      daysOfWeek: parsedDays,
      reviewRequired: false,
      reviewReason: null,
    };
  }

  // Already weekly / specific_days with explicit days that DIFFER from the text.
  // Reserve cannot decide which the member meant — mark for review.
  if ((declared === "weekly" || declared === "specific_days") && declaredDays.length > 0) {
    const sameSet = declaredDays.length === parsedDays.length && declaredDays.every((d) => parsedDays.includes(d));
    if (sameSet) {
      return {
        frequencyType: declared,
        daysOfWeek: declaredDays,
        reviewRequired: false,
        reviewReason: null,
      };
    }
    return {
      frequencyType: declared,
      daysOfWeek: declaredDays,
      reviewRequired: true,
      reviewReason: "Legacy timing text mentions different days than the structured schedule.",
    };
  }

  // training_only / rest_only / custom but text says a specific weekday —
  // ambiguous, flag for review.
  return {
    frequencyType: declared,
    daysOfWeek: declaredDays,
    reviewRequired: true,
    reviewReason: "Legacy timing text mentions a specific weekday but the entry is set to a different frequency mode.",
  };
}

/**
 * Apply migration in-place style — returns a NEW entry with corrected schedule
 * and an optional `scheduleReviewReason` annotation when ambiguous.
 */
export function applyScheduleMigration<T extends EnhancementEntry>(entry: T): T {
  const result = migrateScheduleFromLegacyText(entry);
  const next: T = {
    ...entry,
    frequencyType: result.frequencyType,
    daysOfWeek: result.daysOfWeek,
  };
  if (result.reviewRequired) {
    (next as EnhancementEntry).scheduleReviewReason = result.reviewReason ?? "Schedule needs review.";
  }
  return next;
}
