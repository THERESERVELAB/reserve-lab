/* ────────────────────────────────────────────────────────────────────────────
   MEMBER SCHEDULE PROFILE — the member's real day

   Single cross-app source of truth for schedule awareness. Drives Today's
   Schedule, time-aware Next Best Action, meal timing, and recovery/sleep
   conflict detection. Behavioral/logistics only — no medical claims.

   (The training-session `schedulePlan` in athlete-store stays as-is for
   training-specific logistics; this profile is the whole-day schedule.)
   ──────────────────────────────────────────────────────────────────────── */

export type TrainingWindow = "morning" | "midday" | "afternoon" | "evening" | "night";

export type MobilityPreference = "pre-session" | "post-session" | "both" | "as-needed";

export type MealWindowId =
  | "morning-anchor"
  | "midday"
  | "pre-workout"
  | "post-workout"
  | "night";

export type MealWindow = {
  id: MealWindowId;
  label: string;
  /** "HH:MM" 24h. For pre/post workout this is a sensible default the engine can refine. */
  time: string;
  enabled: boolean;
};

/**
 * What the member eats before a session.
 *   fasted    — nothing before training; an optional salted citrus water slot.
 *   light     — an optional, food-only light shake before training.
 *   carb-load — a full pre-workout meal, even for a session right after waking.
 * Unset: fasted when the session starts within EARLY_SESSION_WINDOW_MIN of
 * waking, otherwise a full pre-workout meal (the engine's long-standing rule).
 */
export type PreWorkoutFuel = "fasted" | "light" | "carb-load";

export const PRE_WORKOUT_FUEL_LABELS: Record<PreWorkoutFuel, string> = {
  fasted: "Train fasted",
  light: "Light shake",
  "carb-load": "Full meal / carb-load",
};

/** The fuel slot a planned meal fills (matches the fuel plan's MealSlot). */
export type PlannedMealSlot = "breakfast" | "pre-workout" | "lunch" | "post-workout" | "dinner" | "snack";

export type WeeklyActivity = {
  id: string;
  name: string;
  perWeek: number;
  durationLabel?: string;
};

export type MemberScheduleProfile = {
  wakeTime: string; // "06:30"
  sleepTarget: string; // "22:30"
  trainingWindow: TrainingWindow;
  preferredTrainingStart: string; // "21:00"
  preferredTrainingEnd: string; // "23:00"
  trainingDaysPerWeek: number;
  cardioDaysPerWeek: number;
  absDaysPerWeek: number;
  saunaDaysPerWeek: number;
  mobilityPreference: MobilityPreference;
  preSessionMobilityMinutes: number;
  postSessionMobilityEnabled: boolean;
  mealWindows: MealWindow[];
  weeklyActivities: WeeklyActivity[];
  /** The member's stated pre-workout fuel. Unset = derived from how soon the session follows waking. */
  preWorkoutFuel?: PreWorkoutFuel | null;
  /** Minutes from the end of the session until the member is home to eat. Unset = the engine's default. */
  postWorkoutHomeMinutes?: number | null;
};

export const TRAINING_WINDOW_LABELS: Record<TrainingWindow, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Evening / Night",
};

export const MOBILITY_PREFERENCE_LABELS: Record<MobilityPreference, string> = {
  "pre-session": "Pre-session",
  "post-session": "Post-session",
  both: "Pre + Post",
  "as-needed": "As needed",
};

/** Default = the member's real described day. */
export const DEFAULT_SCHEDULE_PROFILE: MemberScheduleProfile = {
  wakeTime: "06:30",
  sleepTarget: "22:30",
  trainingWindow: "night",
  preferredTrainingStart: "21:00",
  preferredTrainingEnd: "23:00",
  trainingDaysPerWeek: 6,
  cardioDaysPerWeek: 4,
  absDaysPerWeek: 4,
  saunaDaysPerWeek: 4,
  mobilityPreference: "pre-session",
  preSessionMobilityMinutes: 8,
  postSessionMobilityEnabled: true,
  mealWindows: [
    { id: "morning-anchor", label: "Morning Protein Anchor", time: "07:00", enabled: true },
    { id: "midday", label: "Midday Meal", time: "12:30", enabled: true },
    { id: "pre-workout", label: "Pre-Workout Meal", time: "19:30", enabled: true },
    { id: "post-workout", label: "Post-Workout Meal", time: "23:10", enabled: true },
    { id: "night", label: "Night Recovery Meal", time: "23:20", enabled: false },
  ],
  weeklyActivities: [
    { id: "pickleball", name: "Pickleball", perWeek: 1, durationLabel: "2 hours" },
  ],
};
