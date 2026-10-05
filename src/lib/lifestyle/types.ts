/* ════════════════════════════════════════════════════════════════════════
   BUILD YOUR PLAYER — LIFESTYLE ARCHITECTURE TYPES

   The member-controlled lifestyle layer: weekly schedules the member designs
   (training, track, sport, recovery, work, travel, meals — the whole week),
   week-by-week program selection, planned-vs-actual truth, and member-built
   workout templates with ranked movement recommendations.

   Contract with the rest of Reserve:
   - MEMBER DEFINES THE LIFESTYLE. Reserve analyzes, ranks, explains, and the
     member decides. Nothing here ever silently overwrites a member system —
     applying a recommendation creates a NEW version.
   - Pure JSON-safe data. No JSX, no functions in state, no medical content.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Activity vocabulary ────────────────────────────────────────────────── */

export type LifestyleActivityType =
  | "strength"
  | "hypertrophy"
  | "track"
  | "sprint"
  | "running"
  | "conditioning"
  | "zone2"
  | "hiit"
  | "sport"
  | "mobility"
  | "recovery"
  | "sauna"
  | "cold-exposure"
  | "physical-therapy"
  | "massage"
  | "rest"
  | "sleep"
  | "meal-prep"
  | "meal-window"
  | "hydration"
  | "supplement-reminder"
  | "biomarker-task"
  | "check-in"
  | "work"
  | "travel"
  | "custom";

export type ActivityIntensity = "low" | "moderate" | "high" | "max";

export type LifestyleActivity = {
  id: string;
  /** 0-based day inside the schedule rotation (NOT forced to Mon–Sun). */
  dayIndex: number;
  type: LifestyleActivityType;
  title: string;
  /** "HH:MM" 24h — optional; all-day items (travel, rest) omit times. */
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  intensity?: ActivityIntensity;
  location?: string;
  /** Fixed = life-anchored (work shift, practice). Flexible = Reserve may propose moves. */
  fixed: boolean;
  /** For strength/hypertrophy days: the member's assigned custom workout template. */
  workoutTemplateId?: string;
  /** Program-day lineage resolved by the ownership engine. */
  programDayId?: string;
  /** Muscle-group focus for training days without an assigned template ("chest", "quads"…). */
  focus?: string[];
  equipment?: string[];
  notes?: string;
};

/* ─── Schedules + versioning ─────────────────────────────────────────────── */

export type LifestyleStatus = "draft" | "active" | "archived";

export type LifestyleSchedule = {
  id: string;
  name: string;
  /** Monotonic per lineage; a new version = a new record pointing at its parent. */
  version: number;
  /** Root id shared by every version of the same schedule lineage. */
  lineageId: string;
  parentVersionId?: string;
  status: LifestyleStatus;
  /** 7 = calendar week; 8/9/10… = rotating (day 1..n repeats). 3-on-1-off = 4. */
  rotationLengthDays: number;
  /** Which calendar weekday dayIndex 0 maps to for 7-day plans (0=Mon). */
  weekAnchor: number;
  source: "member-created" | "reserve-template" | "reserve-optimized";
  activities: LifestyleActivity[];
  createdAt: string;
  updatedAt: string;
};

/* ─── Week variants: a different program per calendar week ───────────────── */

export type WeekKind =
  | "standard"
  | "alternating"
  | "travel"
  | "deload"
  | "event"
  | "contest"
  | "recovery"
  | "one-off"
  | "rolling"
  | "custom";

export const WEEK_KIND_LABELS: Record<WeekKind, string> = {
  standard: "Standard Week",
  alternating: "Alternating Week",
  travel: "Travel Week",
  deload: "Deload Week",
  event: "Event Week",
  contest: "Contest Week",
  recovery: "Recovery Week",
  "one-off": "One-Off Custom Week",
  rolling: "Rolling Rotation",
  custom: "Custom Week",
};

export type WeekAssignment = {
  /** ISO week key "2026-W29" — one assignment per calendar week. */
  weekKey: string;
  scheduleId?: string;
  programId?: string;
  kind: WeekKind;
  label?: string;
  startDate?: string;
  notes?: string;
  temporaryActivityIds?: string[];
  temporaryDayOverrideIds?: string[];
  travelConstraints?: string[];
  eventConstraints?: string[];
  availabilityNotes?: string;
  assignedAt: string;
};

/* ─── Planned vs actual ──────────────────────────────────────────────────── */

export type ActualActivityStatus = "completed" | "partial" | "skipped" | "moved" | "unplanned";

export type ActualActivityRecord = {
  id: string;
  /** ISO date "2026-07-15" the activity actually happened (or was skipped). */
  date: string;
  /** Planned activity this reconciles against — absent for unplanned work. */
  plannedActivityId?: string;
  type: LifestyleActivityType;
  title: string;
  status: ActualActivityStatus;
  /** Where it moved to (ISO date) when status === "moved". */
  movedToDate?: string;
  notes?: string;
  recordedAt: string;
  /** True when reconciled automatically from a completed training session. */
  autoFromSession?: boolean;
  sourceSessionId?: string;
  /** Immutable program provenance when the completed session carried it. */
  programId?: string;
  programVersion?: number;
  programDayId?: string;
  programDayVersion?: number;
  programDayOwnership?: string;
  sourceWorkoutTemplateId?: string;
  completedSets?: number;
  durationMinutes?: number;
  completedSetsByMovement?: Record<string, number>;
  substitutedFromActivityId?: string;
  /** Session Flex provenance keeps calendar outcomes distinguishable. */
  sourceOverrideId?: string;
  flexOutcome?: "rescheduled" | "swapped" | "skipped" | "not-ready" | "accidental-start";
  rescheduledToDate?: string;
  rescheduledToDayIndex?: number;
};

export type ActualWeekRecord = {
  weekKey: string;
  scheduleId: string | null;
  records: ActualActivityRecord[];
};

/* ─── Member-built workout templates ─────────────────────────────────────── */

export type IntensityTechnique =
  | "straight-sets"
  | "superset"
  | "giant-set"
  | "circuit"
  | "drop-set"
  | "rest-pause"
  | "partials"
  | "loaded-stretch"
  | "tempo-focus";

export const INTENSITY_TECHNIQUE_LABELS: Record<IntensityTechnique, string> = {
  "straight-sets": "Straight Sets",
  superset: "Superset",
  "giant-set": "Giant Set",
  circuit: "Circuit",
  "drop-set": "Drop Set",
  "rest-pause": "Rest-Pause",
  partials: "Partials",
  "loaded-stretch": "Loaded Stretch",
  "tempo-focus": "Tempo Focus",
};

export type CustomWorkoutMovement = {
  id: string;
  /** MOVEMENT_LIBRARY id when picked from ranked options. */
  exerciseId?: string;
  /** Free-text name when the member typed their own exercise. */
  customExerciseName?: string;
  /** Slot the movement fills (SLOT_ROLES id) — "" for freeform additions. */
  slotRole: string;
  order: number;
  warmupSets?: number;
  workingSets: number;
  repMin?: number;
  repMax?: number;
  rirTarget?: number;
  rpeTarget?: number;
  restSeconds?: number;
  tempo?: string;
  loadTarget?: number;
  intensityTechnique?: IntensityTechnique;
  /** MOVEMENT_LIBRARY ids the member saved as their substitutions. */
  substitutionExerciseIds: string[];
  notes?: string;
};

export type CustomWorkoutTemplate = {
  id: string;
  name: string;
  version: number;
  lineageId: string;
  parentVersionId?: string;
  status: LifestyleStatus;
  /** Session objective in member language ("Upper chest focus", "Full body strength"). */
  sessionObjective: string;
  /** Primary muscle groups this session targets. */
  targetMuscles: string[];
  /** Joint-area observations the member logged for this template ("elbow", "knee"…).
      Observational only — used to re-rank movement options, never medical guidance. */
  painObservations: string[];
  /** Minutes the member actually has for this session — drives time-fit ranking. */
  timeAvailableMin?: number;
  expectedDemand?: import("@/lib/training/workout-demand").WorkoutDemandLevel;
  facility?: string;
  equipment?: string[];
  conditioning?: string;
  coreWork?: string;
  mobility?: string;
  finisher?: string;
  coachingNotes?: string;
  importedSourceRef?: string;
  movements: CustomWorkoutMovement[];
  source: "member" | "reserve" | "collaborative";
  createdAt: string;
  updatedAt: string;
};

/* ─── Ranked recommendations (shared shape) ──────────────────────────────── */

export type RecommendationCategory =
  | "best-fit"
  | "strong-alternative"
  | "specialized"
  | "limited-fit"
  | "avoid-today";

export const RECOMMENDATION_CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  "best-fit": "Best Fit",
  "strong-alternative": "Strong Alternative",
  specialized: "Specialized Option",
  "limited-fit": "Limited Fit",
  "avoid-today": "Avoid Today",
};

export type RankedRecommendation<T> = {
  id: string;
  candidate: T;
  rank: number;
  category: RecommendationCategory;
  /** Plain-language reasons — shown to the member instead of raw scores. */
  reasons: string[];
  tradeoffs: string[];
};

/** Member's decision on any recommendation — recorded, never assumed. */
export type MovementSelectionRecord = {
  id: string;
  templateId: string;
  slotRole: string;
  chosenExerciseId: string | null;
  chosenName: string;
  /** Category the chosen option ranked at — lower-ranked picks teach Reserve. */
  chosenCategory: RecommendationCategory;
  rejectedExerciseIds: string[];
  at: string;
};

/* ─── Schedule audit ─────────────────────────────────────────────────────── */

export type AuditSeverity = "info" | "attention" | "conflict";

export type AuditFinding = {
  id: string;
  severity: AuditSeverity;
  title: string;
  detail: string;
  /** Day indices involved so the UI can highlight them. */
  dayIndices: number[];
};

/** A concrete alternative arrangement Reserve proposes — member decides.
    When `action` is present, "Accept as new version" can apply it
    mechanically (always to a NEW version — never the original). Proposals
    without an action are guidance the member applies by editing. */
export type ScheduleProposal = {
  title: string;
  detail: string;
  action?: { kind: "swap-days"; dayA: number; dayB: number };
};

export type ScheduleAudit = {
  scheduleId: string;
  generatedAt: string;
  findings: AuditFinding[];
  recommendations: RankedRecommendation<ScheduleProposal>[];
};

/* ─── ID + week-key helpers ──────────────────────────────────────────────── */

let idCounter = 0;
export function lifestyleId(prefix: string): string {
  idCounter = (idCounter + 1) % 10_000;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** ISO-8601 week key ("2026-W29") for a date — Monday-anchored. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const ROTATION_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Human label for a rotation day: weekday names for 7-day plans, "Day N" otherwise. */
export function rotationDayLabel(schedule: Pick<LifestyleSchedule, "rotationLengthDays" | "weekAnchor">, dayIndex: number): string {
  if (schedule.rotationLengthDays === 7) {
    return ROTATION_DAY_LABELS[(schedule.weekAnchor + dayIndex) % 7];
  }
  return `Day ${dayIndex + 1}`;
}

export const ACTIVITY_TYPE_LABELS: Record<LifestyleActivityType, string> = {
  strength: "Strength Training",
  hypertrophy: "Hypertrophy Training",
  track: "Track Work",
  sprint: "Sprint Session",
  running: "Running",
  conditioning: "Conditioning",
  zone2: "Zone 2",
  hiit: "HIIT",
  sport: "Sport / Practice",
  mobility: "Mobility",
  recovery: "Recovery",
  sauna: "Sauna",
  "cold-exposure": "Cold Exposure",
  "physical-therapy": "Physical Therapy",
  massage: "Massage",
  rest: "Rest",
  sleep: "Sleep",
  "meal-prep": "Meal Prep",
  "meal-window": "Meal Window",
  hydration: "Hydration Reminder",
  "supplement-reminder": "Supplement Reminder",
  "biomarker-task": "Biomarker Task",
  "check-in": "Check-In",
  work: "Work Block",
  travel: "Travel",
  custom: "Custom Activity",
};

/** Training-relevant activity types (contribute physical load). */
export const TRAINING_ACTIVITY_TYPES: ReadonlySet<LifestyleActivityType> = new Set([
  "strength", "hypertrophy", "track", "sprint", "running", "conditioning",
  "zone2", "hiit", "sport", "mobility",
]);
