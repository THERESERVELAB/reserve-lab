import type {
  ActivityIntensity,
  CustomWorkoutMovement,
  LifestyleStatus,
} from "@/lib/lifestyle/types";
import type { WorkoutDemandLevel } from "@/lib/training/workout-demand";

/** Shared authorship vocabulary for training now and nutrition later. */
export type ContentOwnership =
  | "reserve-original"
  | "reserve-optimized"
  | "member-customized"
  | "member-created"
  | "imported";

export type ProgramOperatingMode =
  | "reserve-managed"
  | "hybrid"
  | "member-managed";

export type ProgramDayChangeScope =
  | "today-only"
  | "future-occurrences"
  | "new-program-version";

export type ProgramDaySessionType =
  | "strength"
  | "hypertrophy"
  | "track"
  | "sprint"
  | "conditioning"
  | "sport"
  | "mobility"
  | "recovery"
  | "rest"
  | "custom";

export type ProgramDayDefinition = {
  /** Version-specific id. `lineageId` stays stable across edits/restores. */
  id: string;
  lineageId: string;
  programId: string;
  programVersion: number;
  dayIndex: number;
  rotationPosition?: number;
  calendarDay?: string;
  title: string;
  sessionType: ProgramDaySessionType;
  sessionObjective: string;
  primaryTargets: string[];
  secondaryTargets: string[];
  workoutTemplateId?: string;
  secondarySession?: {
    title: string;
    sessionType: ProgramDaySessionType;
    sessionObjective: string;
    workoutTemplateId?: string;
    expectedDurationMinutes?: number;
  };
  activityId?: string;
  ownership: ContentOwnership;
  sourceDayId?: string;
  reserveOriginalDayId?: string;
  parentVersionId?: string;
  version: number;
  locked: boolean;
  preserveFromAiOverwrite: boolean;
  performanceGoal?: string;
  expectedDurationMinutes?: number;
  expectedDemand?: WorkoutDemandLevel;
  intensity?: ActivityIntensity;
  facility?: string;
  equipment?: string[];
  conditioning?: string;
  coreWork?: string;
  mobility?: string;
  finisher?: string;
  coachingNotes?: string;
  painRestrictions?: string[];
  memberNotes?: string;
  reserveNotes?: string;
  phaseLabel?: string;
  lastReserveAuditAt?: string;
  status: LifestyleStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProgramSource =
  | "reserve"
  | "member"
  | "outside-coach"
  | "imported"
  | "collaborative";

export type ProgramDefinition = {
  id: string;
  lineageId: string;
  version: number;
  parentVersionId?: string;
  name: string;
  description?: string;
  status: LifestyleStatus;
  source: ProgramSource;
  operatingMode: ProgramOperatingMode;
  rotationLengthDays: number;
  weekAnchor: number;
  days: ProgramDayDefinition[];
  scheduleId?: string;
  importedDraftId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramDayOverride = {
  id: string;
  date: string;
  programId: string;
  programVersion: number;
  dayLineageId: string;
  sourceDayId: string;
  definition: ProgramDayDefinition;
  status: "active" | "used" | "archived";
  createdAt: string;
  usedAt?: string;
};

export type ProgramRecommendationCategory =
  | "goal-alignment"
  | "volume"
  | "movement-balance"
  | "fatigue"
  | "joint-overlap"
  | "pain-compatibility"
  | "equipment-fit"
  | "duration"
  | "week-placement"
  | "side-activity";

export type ProgramRecommendationPreferences = Record<ProgramRecommendationCategory, boolean>;

export type ProgramRecommendationDecision = {
  id: string;
  programId: string;
  dayLineageId: string;
  dayVersion: number;
  recommendationId: string;
  decision: "accepted" | "modified" | "rejected" | "kept";
  note?: string;
  at: string;
};

export type ImportedMovementDraft = {
  id: string;
  name: string;
  sets?: number;
  repMin?: number;
  repMax?: number;
  restSeconds?: number;
  notes?: string;
  uncertainFields: string[];
};

export type ImportedProgramDayDraft = {
  id: string;
  title: string;
  sessionType: ProgramDaySessionType;
  movements: ImportedMovementDraft[];
  notes?: string;
  uncertainFields: string[];
};

export type ProgramImportSourceKind =
  | "manual"
  | "paste"
  | "text-file"
  | "spreadsheet"
  | "pdf"
  | "template";

export type ImportedProgramDraft = {
  id: string;
  name: string;
  sourceKind: ProgramImportSourceKind;
  sourceName?: string;
  /** Bounded source reference for review; never treated as parsed truth. */
  sourceExcerpt?: string;
  rotationLengthDays: number;
  days: ImportedProgramDayDraft[];
  uncertainFields: string[];
  status: "draft" | "reviewed" | "activated" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type NutritionOwnershipState = {
  operatingMode: ProgramOperatingMode;
  dayOwnership: Record<string, ContentOwnership>;
  mealOwnership: Record<string, ContentOwnership>;
  /** Contract-only references for later meal/day version records. */
  activePlanId: string | null;
  updatedAt: string | null;
};

export type ProgramDayEditPayload = {
  programId: string;
  dayId: string;
  definition: ProgramDayDefinition;
  scope: ProgramDayChangeScope;
  dateKey?: string;
};

export type ProgramDayVersionAction = "activate" | "archive" | "duplicate" | "rename";

export const PROGRAM_MODE_LABELS: Record<ProgramOperatingMode, string> = {
  "reserve-managed": "Reserve Managed",
  hybrid: "Hybrid Coaching",
  "member-managed": "Member Managed",
};

export const PROGRAM_MODE_DESCRIPTIONS: Record<ProgramOperatingMode, string> = {
  "reserve-managed": "Reserve evolves the program while every day remains customizable.",
  hybrid: "Reserve-owned and member-owned days run together inside one week.",
  "member-managed": "Your program stays yours. Reserve logs, analyzes, and offers optional review.",
};

export const PROGRAM_OWNERSHIP_LABELS: Record<ContentOwnership, string> = {
  "reserve-original": "Reserve Original",
  "reserve-optimized": "Reserve Optimized",
  "member-customized": "Member Customized",
  "member-created": "Member Created",
  imported: "Imported",
};

export const DEFAULT_PROGRAM_RECOMMENDATION_PREFERENCES: ProgramRecommendationPreferences = {
  "goal-alignment": true,
  volume: true,
  "movement-balance": true,
  fatigue: true,
  "joint-overlap": true,
  "pain-compatibility": true,
  "equipment-fit": true,
  duration: true,
  "week-placement": true,
  "side-activity": true,
};

export const DEFAULT_NUTRITION_OWNERSHIP: NutritionOwnershipState = {
  operatingMode: "reserve-managed",
  dayOwnership: {},
  mealOwnership: {},
  activePlanId: null,
  updatedAt: null,
};

/** A day-library template can carry the full editing surface without forcing
 * every existing template constructor to fill new fields. */
export type ProgramTemplateDetail = {
  movements: CustomWorkoutMovement[];
  expectedDurationMinutes?: number;
  expectedDemand?: WorkoutDemandLevel;
  facility?: string;
  equipment?: string[];
  conditioning?: string;
  coreWork?: string;
  mobility?: string;
  finisher?: string;
  coachingNotes?: string;
};
