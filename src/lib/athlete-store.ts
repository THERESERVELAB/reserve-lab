"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PeakKitchenPrefs } from "@/lib/nutrition/peak-kitchen";
import type { GroundFamily } from "@/lib/nutrition/peak-ratios";
import type { PeakFood } from "@/lib/nutrition/peak-signatures";
import type { CustomBowl } from "@/lib/nutrition/peak-bowls";
import type { PeakLook, PeakSnackPeriod } from "@/lib/nutrition/peak-mode";

import { requestSyncFlush } from "@/lib/sync/flush-signal";
import { emitSignal } from "@/lib/ui/signal-bus";
import { supportOptionByKey } from "@/lib/compound-intelligence/support-options";
import { pickMemberState } from "@/lib/sync/state-contract";
import type { RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";
import type { CycleCheckpoint, CycleEndReason, CycleInput, CyclePeriod } from "@/lib/cycle/cycle-period";
import type { TrainingBlockIntent } from "@/lib/training/cycle-training-block";
import type { CycleCheckIn, CycleCheckInInput, CycleGoalSetup, CycleReviewSnapshot, SupportPlanDetails, SupportPlanItem } from "@/lib/cycle-review/types";
import {
  appendChangeEvents,
  checkpointEvent,
  compoundEvent,
  compoundUpdateEvents,
  cycleEvent,
  cycleUpdateEvents,
  supportEvent,
  supportItemName,
  supportUpdateEvents,
  type ChangeEvent,
} from "@/lib/history/change-events";
import {
  OBSERVATION_LIMIT,
  TIMELINE_NOTE_LIMIT,
  normalizeNoteInput,
  normalizeObservationInput,
  type Observation,
  type ObservationInput,
  type TimelineNote,
  type TimelineNoteInput,
} from "@/lib/history/types";
import type { LabFlag } from "@/lib/labs/types";
import { MIN_MEMBER_AGE, SAFETY_ACK_VERSION, type SafetyAcknowledgement } from "@/lib/safety/acknowledgement";
import type { RedFlagReport } from "@/lib/safety/escalation";
import {
  DEFAULT_SPLIT_CUSTOMIZATION,
  recordSplitDayEdit,
  type SplitCustomization,
  type SplitDayEditInput,
} from "@/lib/training/split-customization";

import {
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_PERSISTENT_SETTINGS,
  ONBOARDING_DRAFT_VERSION,
  OnboardingState,
  OnboardingStep,
  PersistentSettings,
  SubscriptionTier,
  UserPersona,
} from "@/lib/saas-config";
import {
  calculateActivationScore,
  clearUntouchedRetentionSample,
  createEngagementEvent,
  DEFAULT_RETENTION_STATE,
  getDateKey,
  isYesterday,
  RetentionMilestoneKey,
  RetentionState,
  UpgradeIntent,
} from "@/lib/retention-config";
import type { SignatureMeal } from "@/lib/nutrition/signature-meals";
import type { LoggedMealEvent } from "@/lib/nutrition/meal-confirmation";
import { DEFAULT_USER_TRAINING_PROFILE, type UserTrainingProfile } from "@/lib/training/gym-environment";
import { programKeepsMemberSplit } from "@/lib/training/split-program-fit";
import { defaultWorkoutDemand, type WorkoutDemandLevel } from "@/lib/training/workout-demand";
import {
  addMovement as addExecutionMovement,
  adjustStartedSession,
  appendReserveDecision,
  createPlannedSessionExecution,
  createReserveDecision,
  createStartedSessionExecution,
  editCompletedSet as editExecutionSet,
  finalizeSessionExecution,
  migrateLegacyExecutionHistory,
  recordCompletedSet,
  relateFutureRevision,
  removeLastCompletedSet,
  removePlannedMovement,
  skipMovement as skipExecutionMovement,
  substituteMovement as substituteExecutionMovement,
  summarizeWeekExecution,
  transitionSessionStatus,
  updateSessionMetrics as updateExecutionMetrics,
  upsertExecutionRecord,
  upsertWeekExecutionSummary,
  type AddMovementInput,
  type LedgerSessionSnapshot,
  type RecordCompletedSetInput,
  type ReserveDecisionInput,
  type ReserveDecisionRecord,
  type SessionExecutionRecord,
  type WeekExecutionSummary,
} from "@/lib/training/session-execution";
import type { ActivityStack, SportType } from "@/lib/training/activity-stack";
import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import type { ProgramHorizon } from "@/lib/horizon/types";
import type { AthleteResponseModel, ResponseEvent, WeeklyResponseReview } from "@/lib/response-model/types";
import { upsertWeeklyResponseReview } from "@/lib/response-model/weekly-review";
import type { FacilityAmenity } from "@/lib/training/facilities";
import {
  EMPTY_MOVEMENT_PREFERENCES,
  type TrainingExperience,
  type MovementPreferences,
  type MovementFeedback,
  type MovementFeedbackKind,
  type CoreTiming,
} from "@/lib/training/workout-templates";
import {
  activateProtocol,
  getProtocol,
  type ActivateOptions,
  type ActiveProtocol,
  type ProtocolDefinition,
  type ProtocolStatus,
} from "@/lib/protocol/library";
import { clearUntouchedWomensSample } from "@/lib/women/legacy-sample";
import { sanitizeRegions, type ActivityCoverage, type TrainingRegion } from "@/lib/training/activity-coverage";
import { DEFAULT_DOUBLE_DAY, sanitizeDoubleDay, type DoubleDay } from "@/lib/training/double-day";
import type { SplitActivityKey } from "@/lib/training/split-activities";
import { deriveActivityStackKey, sanitizeCommitments, type WeekdayIndex, type WeeklyCommitment } from "@/lib/training/weekly-commitments";
import { clearUntouchedDefaultBodyweight } from "@/lib/profile/bodyweight";
import {
  DEFAULT_WOMENS_STATE,
  type CycleLogEntry,
  type CycleProfile,
  type FertilityModuleState,
  type PregnancyModuleState,
  type WomensNutritionGoal,
  type WomensState,
} from "@/lib/women/types";
import { deriveProfilePath, type ProfilePath } from "@/lib/modules/registry";
import type { CustomWorkoutPlan } from "@/lib/custom/workout-plans";
import {
  isoWeekKey,
  lifestyleId,
  TRAINING_ACTIVITY_TYPES,
  type ActualActivityRecord,
  type ActualWeekRecord,
  type CustomWorkoutTemplate,
  type LifestyleSchedule,
  type MovementSelectionRecord,
  type WeekAssignment,
} from "@/lib/lifestyle/types";
import { rotationIndexForDate } from "@/lib/lifestyle/adherence-engine";
import { buildCustomSessionSnapshot } from "@/lib/lifestyle/session-bridge";
import {
  buildProgramDaySessionSnapshot,
  movementDraftToTemplateMovement,
  resolveProgramDayForDate,
} from "@/lib/program/engine";
import {
  DEFAULT_NUTRITION_OWNERSHIP,
  DEFAULT_PROGRAM_RECOMMENDATION_PREFERENCES,
  type ImportedProgramDraft,
  type NutritionOwnershipState,
  type ProgramDayDefinition,
  type ProgramDayEditPayload,
  type ProgramDayOverride,
  type ProgramDefinition,
  type ProgramOperatingMode,
  type ProgramRecommendationDecision,
  type ProgramRecommendationPreferences,
} from "@/lib/program/types";
import type { CustomMeal } from "@/lib/nutrition/custom-meals";
import type { HydrationLogEntry } from "@/lib/nutrition/hydration-library";
import type { MemberMealPlan } from "@/lib/nutrition/member-meal-plan";
import { installChangeLedger, withLedgerSuppressed } from "@/lib/sync/change-ledger";
import { EMPTY_SYNC_LEDGER, readLedger, type SyncLedger } from "@/lib/sync/sync-ledger";
import {
  DEFAULT_RECOVERY_COMMAND,
  type HydrationLog,
  type MobilityLog,
  type RecoveryCommandState,
  type SleepLog,
  type StressCheckIn,
} from "@/lib/recovery/types";
import { clampMobilityTarget, clampPour, clampWaterTarget } from "@/lib/recovery/water";
import {
  DEFAULT_SCHEDULE_PROFILE,
  type MealWindowId,
  type MemberScheduleProfile,
} from "@/lib/schedule/types";
import {
  deriveScheduleProfile,
  reconcileScheduleSources,
  repairScheduleProfile,
  scheduleContradictions,
  type ScheduleIntent,
} from "@/lib/schedule/derive";
import {
  DEFAULT_PHYSIQUE_COMMAND,
  DEFAULT_PHYSIQUE_FOCUS,
  type PhotoCheckIn,
  type PhysiqueCommandState,
  type PhysiqueEntry,
  type PhysiqueFocus,
  type PhysiqueGoalV2,
  type MusclePriority,
  type WeakPoint,
} from "@/lib/physique/types";

export type ModulePreferences = {
  /** null = auto-derive from gender identity / persona. */
  profilePath: ProfilePath | null;
  /** Observational compound/bloodwork/enhanced-monitor surfaces. */
  enhancedLogOnly: boolean;
  /** Explicit per-module enable/disable for optional modules, keyed by module id. */
  overrides: Record<string, boolean>;
  /** Member-ordered module ids (within their nav groups). Empty = registry order. */
  order: string[];
  /** Pinned module ids — surface first inside their group. */
  pinned: string[];
};

export const DEFAULT_MODULE_PREFERENCES: ModulePreferences = {
  profilePath: null,
  enhancedLogOnly: false,
  overrides: {},
  order: [],
  pinned: [],
};

export type DashboardView =
  | "dashboard"
  | "my-coach"
  | "training"
  | "nutrition"
  | "physique"
  | "recovery"
  | "progress-photos"
  | "measurements"
  | "enhanced-monitor"
  | "bloodwork"
  | "supplements"
  | "journal"
  | "education"
  | "settings"
  | "schedule-command"
  | "protocol-command"
  | "program-horizon"
  | "response-profile"
  | "lifestyle-builder"
  /* Elite views */
  | "physique-intelligence"
  | "mesocycle-planner"
  | "biomarker-intelligence"
  | "performance-intelligence"
  | "peak-physique"
  | "ai-strategist"
  /* Community */
  | "community"
  /* Reserve Women */
  | "womens-cycle"
  | "womens-fertility"
  | "womens-pregnancy";

export type DensityMode = "simple" | "operator" | "advanced";
export type PhysiqueGoal = "lean" | "athletic" | "classic" | "mass";
export type AvatarAura = "gold" | "teal" | "violet" | "red";
export type FocusZone =
  | "upper-chest"
  | "delts"
  | "lats"
  | "arms"
  | "quads"
  | "hamstrings"
  | "core";
export type ExperienceLevel = UserPersona;

export type PhysiqueArchetype =
  | "classic-physique"
  | "mens-physique"
  | "open-bodybuilding"
  | "powerbuilder"
  | "hybrid-athlete"
  | "functional-tactical"
  | "fat-loss-transformation"
  | "female-bikini"
  | "female-wellness"
  | "female-performance";

export type SpecialMode =
  | "none"
  | "travel-mode"
  | "peak-mode"
  | "deload-mode"
  | "vacation-maintenance"
  | "competition-prep";

export type TrainingIntelligenceMode = "adaptive" | "periodized" | "manual";
export type RecoveryAggression = "conservative" | "moderate" | "aggressive";
export type FatigueSensitivity = "low" | "medium" | "high";
export type AICoachStyle =
  | "operator"
  | "elite-coach"
  | "hardass-prep"
  | "recovery-scientist"
  | "lifestyle-strategist";

export type MemberGenderIdentity = "male" | "female" | "custom";

export type CoachingProfile = {
  genderIdentity?: MemberGenderIdentity;
  /** Current Chapter — the single primary identity chosen in onboarding. */
  currentChapter?: string;
  /** Life Context — optional supporting modifiers (parent, traveler, …). */
  lifeContext?: string[];
  lifeStages: string[];
  healthContext: string[];
  healthNotes: string;
  medications: string;
  injuryNotes: string;
  bodyGoals: string[];
  trainingStyles: string[];
  goalStack: string[];
  lifestyle: string[];
  schedule: {
    trainingDays: number;
    preferredWindow: string;
    wakeTime: string;
    sleepTime: string;
  };
  motivationStyle: string;
  coachingNotes: string[];
  alertPlan: string[];
};

export type AthleteProfile = {
  name: string;
  goal: string;
  phase: string;
  trainingStyle: string;
  primaryFocus: string;
  enhancedTracking: boolean;
  bodyFat: string;
  experienceLevel: ExperienceLevel;
  persona: UserPersona;
  densityMode: DensityMode;
  physiqueGoal: PhysiqueGoal;
  avatarAura: AvatarAura;
  focusZones: FocusZone[];
  physiqueArchetype: PhysiqueArchetype;
  specialMode: SpecialMode;
  trainingIntelligenceMode: TrainingIntelligenceMode;
  recoveryAggression: RecoveryAggression;
  fatigueSensitivity: FatigueSensitivity;
  aiCoachStyle: AICoachStyle;
  weakPoints: FocusZone[];
  coachingProfile?: CoachingProfile;
};

const DEFAULT_PROFILE: AthleteProfile = {
  // Blank identity until onboarding (or the Google account) provides one —
  // a new member must never see someone else's name.
  name: "",
  goal: "Competition Cut",
  phase: "Peak Week Prep",
  trainingStyle: "Reserve Strength + Physique Rotation",
  primaryFocus: "Upper Chest + Delts",
  enhancedTracking: true,
  bodyFat: "",
  experienceLevel: "advanced",
  persona: "advanced",
  densityMode: "operator",
  physiqueGoal: "athletic",
  avatarAura: "gold",
  focusZones: ["upper-chest", "delts", "core"],
  physiqueArchetype: "classic-physique",
  specialMode: "none",
  trainingIntelligenceMode: "adaptive",
  recoveryAggression: "moderate",
  fatigueSensitivity: "medium",
  aiCoachStyle: "elite-coach",
  weakPoints: ["core"],
};

export type SessionMode = "pre" | "live" | "complete" | "closed";

export type CloseoutAccuracy = "fully-logged" | "operationally-accurate" | "quick-closeout";

// New: log accuracy + session completion (separate concerns)
export type LogAccuracy = "fully-accurate" | "mostly-accurate" | "estimated";
export type SessionCompletion = "as-planned" | "partial" | "minimum-effective" | "stopped-early";
export type ProgressionDecision =
  | "aggressive"
  | "standard"
  | "conservative"
  | "hold"
  | "recalibrate";

export type PostWorkoutMealGuidance = {
  mealLabel: string;
  timingWindow: string;
  reason: string;
  emphasis: string;
  examples: string[];
};

export type SessionIntelligenceCard = {
  id: string;
  date: string;
  dateLabel: string;
  sessionName: string;
  splitName: string;
  weekLabel: string;
  phaseLabel: string;
  rating: number;
  completionStatus: SessionCompletion;
  completionLabel: string;
  logAccuracy: LogAccuracy;
  dataConfidence: "high" | "moderate" | "low";
  progressionDecision: ProgressionDecision;
  improved: string;
  heldBack: string;
  nextTen: string;
  nutritionNext: string;
  recoveryNote: string;
  enhancementSummary?: string;
  enhancementCategories?: string;
  enhancementReviewAction?: string;
  momentum: number;
};

export type TrainingJournalEntry = {
  id: string;
  loggedAt: string;
  dateLabel: string;
  sessionName: string;
  splitName: string;
  weekLabel: string;
  phaseLabel: string;
  completionStatus: SessionCompletion;
  completionLabel: string;
  logAccuracy: LogAccuracy;
  dataConfidence: "high" | "moderate" | "low";
  rating: number;
  bestOutput: string;
  limiter: string;
  coreStatus: string;
  conditioningStatus: string;
  selectedCardio: string;
  recoveryStatus: string;
  selectedRecovery: string;
  postWorkoutMeal: string;
  hydration: string;
  sleepPriority: string;
  tomorrowReadiness: string;
  nextSessionAdjustment: string;
  enhancementSummary?: string;
  enhancementCategories?: string;
  enhancementReviewAction?: string;
  enhancementToleranceNote?: string;
  notes: string;
};

export type EnhancementCategory =
  | "supplement"
  | "peptide"
  | "hormone"
  | "medication"
  | "vitamin"
  | "nootropic"
  | "recovery"
  | "other";

export type EnhancementTimeOfDayPreference =
  | "morning"
  | "pre_training"
  | "post_training"
  | "evening"
  | "bedtime"
  | "custom"
  | "unspecified";

export type EnhancementDoseSource =
  | "provider_directed"
  | "member_entered"
  | "label_directed"
  | "unknown";

export type EnhancementFrequencyType =
  | "daily"
  | "weekly"
  | "specific_days"
  | "training_only"
  | "rest_only"
  | "custom";

export type CompoundRoute = "oral" | "injectable" | "topical" | "nasal" | "other";
export type CompoundInjectionType = "subq" | "im" | "other" | "none";
export type CompoundSourceType =
  | "member_entered"
  | "provider_entered"
  | "prescription"
  | "clinic"
  | "other";

export type CompoundScheduleRuleType =
  | "daily"
  | "specific_weekdays"
  | "every_x_days"
  | "every_x_weeks"
  | "training_days_only"
  | "rest_days_only"
  | "all_training_days"
  | "all_6_training_days"
  | "upper_body_days"
  | "lower_body_days"
  | "push_days"
  | "pull_days"
  | "leg_days"
  | "chest_back_days"
  | "arm_shoulder_days"
  | "conditioning_days"
  | "custom_training_tags"
  | "custom_date_sequence"
  | "on_off_cycle"
  | "manual_only";

/**
 * One member-set dose time on a scheduled day. The member chooses every part
 * of it; Reserve only turns it into a clock time against the member's own day.
 *   clock  a fixed time ("HH:MM")
 *   meal   relative to a meal on today's plan: "breakfast" | "lunch" | "dinner"
 *          (by the plan's slot) or "window:<meal window id>" (a named meal);
 *          offsetMin < 0 before, 0 with, > 0 after
 *   wake   offsetMin after the schedule's wake time (0 = on waking)
 *   bed    offsetMin before the schedule's sleep target
 */
/** "training": minutes before the member's own training start, on a day they train. */
export type CompoundDoseAnchor = "clock" | "meal" | "wake" | "bed" | "training";
export type CompoundDoseTiming = {
  anchor: CompoundDoseAnchor;
  time?: string;
  meal?: string;
  offsetMin?: number;
};

export type CompoundScheduleRule = {
  type: CompoundScheduleRuleType;
  weekdays?: number[];
  intervalDays?: number;
  intervalWeeks?: number;
  anchorDate?: string;
  trainingTags?: string[];
  dateSequence?: string[];
  /** on_off_cycle: consecutive scheduled days, then days off, repeating from the anchor date (or the entry's start date). */
  daysOn?: number;
  daysOff?: number;
  /** 1–4 member-set dose times on each scheduled day. Absent = the entry's time-of-day setting. */
  doses?: CompoundDoseTiming[];
};

export type CompoundAmountSource =
  | "manual"
  | "reconstitution_calculator"
  | "ml_calculator"
  | "oral_unit_calculator"
  | "liquid_oral_calculator";

export type CompoundSupportRelationshipType =
  | "Lab monitoring support"
  | "Tolerance tracking"
  | "Side-effect tracking"
  | "Recovery support"
  | "Sleep/recovery timing"
  | "Hydration/electrolyte support"
  | "Injection comfort tracking"
  | "Inventory pairing"
  | "Provider-entered support plan"
  | "Member-entered note"
  | "Other";

export type CompoundSupportLink = {
  parentEntryId: string;
  supportEntryId: string;
  reason: string;
  trigger?: string;
  relationshipType?: CompoundSupportRelationshipType;
  reasonTags?: string[];
  labMarkers?: string[];
  symptomWatches?: string[];
  customNote?: string;
  source?: "member_entered" | "provider_entered";
};

export type InjectionLogRecord = {
  id: string;
  entryId: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:MM
  amountValue?: string; // user-entered numeric string
  amountUnit?: string;
  unitsUsed?: number;
  calculatedMgUsed?: number;
  amountSource?: CompoundAmountSource;
  route?: CompoundRoute;
  injectionType?: CompoundInjectionType;
  site: string;
  side?: "left" | "right" | "center";
  reactionNote?: string;
  painLevel?: number; // 0-10
  rednessNote?: string;
  swellingNote?: string;
  createdAt: string;
};

export type EnhancementAdherenceStatus = "taken" | "skipped" | "missed" | "planned";

export type EnhancementToleranceRating = "good" | "neutral" | "poor" | "unknown";

export type EnhancementEntry = {
  id: string;
  name: string;
  /** Official catalog name when known (e.g. "Retatrutide"). */
  officialName?: string;
  /** Member-facing display label — usually officialName, or nickname. */
  displayName?: string;
  /** Aliases the member uses informally ("Reta", "Big R"). */
  aliases?: string[];
  /** Compound class key (e.g. "peptides_glp1"). */
  compoundClass?: string;
  category: EnhancementCategory;
  doseAmount: string;
  doseUnit: string;
  frequency: string;
  timingPreference: string;
  timeOfDayPreference?: EnhancementTimeOfDayPreference;
  customTime?: string;
  goalAssociation: string[];
  trainingDayUse?: boolean;
  restDayUse?: boolean;
  clinicianOversight?: boolean;
  sourceOfDose?: EnhancementDoseSource;
  sourceType?: CompoundSourceType;
  notes?: string;
  toleranceNotes?: string;
  sideEffectNotes?: string;
  symptomNotes?: string;
  labMarkersToDiscuss?: string[];
  isActive: boolean;
  /** Scheduling */
  frequencyType?: EnhancementFrequencyType;
  /** Days of week (0 = Sunday … 6 = Saturday) when frequencyType is weekly / specific_days */
  daysOfWeek?: number[];
  scheduleRule?: CompoundScheduleRule;
  /** Local ISO date (YYYY-MM-DD) the entry begins. Schedules suppressed before this. */
  startDate?: string;
  /** When set, entry is treated as paused regardless of isActive. */
  pausedAt?: string;
  /** Surfaces a "Schedule needs review" badge in the Reserve Review panel. */
  scheduleReviewReason?: string;
  /** Set when the entry was put on the schedule from the member's support plan. */
  supportPlanItemId?: string;
  /** Delivery route + injection type for injectables. */
  route?: CompoundRoute;
  injectionType?: CompoundInjectionType;
  /** Inventory — member-entered values only. Reserve does no dose math beyond
   *  pure arithmetic on these fields. */
  vialVolumeMl?: number;
  concentrationMgPerMl?: number;
  totalQuantityMg?: number;
  remainingQuantityMg?: number;
  amountPerLogMg?: number;
  amountSource?: CompoundAmountSource;
  vialTotalAmount?: number;
  vialTotalUnit?: "mg" | "mcg";
  reconstitutionVolumeMl?: number;
  syringeUnitsPerMl?: number;
  unitsPlannedPerLog?: number;
  vialCount?: number;
  remainingVialCount?: number;
  partialVialRemainingMg?: number;
  reorderLeadDays?: number;
  costPerVial?: number;
  supplierNote?: string;
  expirationDate?: string;
  storageNote?: string;
  /** Linked support / parent items (e.g. anastrozole linked to testosterone). */
  parentCompoundId?: string;
  linkedSupportItemIds?: string[];
  /** Free-form lab markers + minimum rest days for site rotation. */
  minimumSiteRestDays?: number;
  /**
   * Where the member shows this entry on Compound Command's Today: with their
   * main compounds ("hero") or with their add-ons. Organisational only. Unset
   * means the default from class and category (lib/compound-command/today-tiers).
   */
  todayTier?: "hero" | "add-on";
  createdAt: string;
  updatedAt: string;
};

export type EnhancementAdherenceRecord = {
  id: string;
  entryId: string;
  date: string; // YYYY-MM-DD
  plannedTime: string;
  takenStatus: EnhancementAdherenceStatus;
  actualTime?: string;
  note?: string;
  tolerance?: EnhancementToleranceRating;
  symptoms?: string;
  createdAt: string;
};

// Legacy alias for backwards compat with earlier callsites
export type EnhancementLogEntry = EnhancementEntry;

export type StoredSetReview = {
  stimulus: string;
  performance: string;
  coachDecision: string;
  goalImpact: string;
  nextSetRecommendation: string;
  restDirective: string;
};

export type StoredLoggedSet = {
  movementId: string;
  load: number;
  reps: number;
  intensity: number;
  setNumber: number;
  loggedAt: string;
  review?: StoredSetReview;
  loadUnit?: "lb" | "kg" | "bodyweight" | "assisted" | "band";
  completedDurationSeconds?: number;
  completedDistanceMeters?: number;
  actualRir?: number;
  actualRpe?: number;
  completed?: boolean;
  failed?: boolean;
  pain?: number;
  notes?: string;
};

export type StoredSubstitution = {
  movementId: string;
  reason: string | null;
  replacementName: string;
  equipment: string;
  preservesStimulus: boolean;
  selectedAt: string;
};

export type TrainingDebriefSummary = {
  confidence: "high" | "moderate" | "low";
  completion: number;
  rating: number;
  summary: string;
  nextBestAction: string;
  generatedAt: string;
  logAccuracy?: LogAccuracy;
  sessionCompletion?: SessionCompletion;
  progressionDecision?: ProgressionDecision;
  mealTimingGuidance?: PostWorkoutMealGuidance;
};

export type SchedulePlan = {
  workoutTime: string;
  commuteMinutes: number;
  prepMinutes: number;
  wakeTime: string;
  sleepTime: string;
  preferFasted: boolean;
};

export type SupportPhaseStatus = "pending" | "due-now" | "completed" | "skipped" | "not-included";
export type SupportPhaseKey = "core" | "conditioning" | "recovery" | "handoff";

export type RecoveryPreferences = {
  preferredTools: string[];
  dislikedTools: string[];
  availableTools: string[];
  prefersHeat: boolean;
  prefersCold: boolean;
  prefersAtHome: boolean;
  prefersLowEffort: boolean;
};

/**
 * SESSION GENERATION SNAPSHOT — the immutable record of HOW an active
 * workout was built. Captured the moment the member starts a session; the
 * live cockpit renders FROM this snapshot, so later demand/architecture
 * changes can never silently rewrite a workout in progress. Movements are
 * the frozen queue (JSON-safe Movement objects from the session resolver).
 */
export type SessionGenerationSnapshot = {
  /** Effective (gated) demand tier used to build the session. */
  demandAtGeneration: WorkoutDemandLevel;
  /** What the member had selected (may differ when the gate stepped down). */
  requestedDemand: WorkoutDemandLevel;
  /** Authorized demand after readiness/training-age gating. Legacy snapshots may omit it. */
  authorizedDemand?: WorkoutDemandLevel;
  /** Split-system key / architecture source id ("elite-six", "reserve-default", …). */
  architectureId: string;
  /** Member's architecture save timestamp — acts as the version. */
  architectureVersion: string | null;
  architectureName: string;
  /** Protocol + game-plan week the session belongs to. */
  mesocycleId: string;
  generatedAt: string;
  generationReason:
    | "member-start"
    | "member-rebuild"
    | "program-day-start"
    | "today-override";
  splitTitle: string;
  /** Frozen movement queue (TrainingView Movement[] — data-only). */
  movements: unknown[];
  /** Frozen movement-id → session-phase map for the cockpit. */
  phaseMap?: Record<string, string>;
  /** Member acknowledged "settings changed, apply next session". */
  changeAcknowledgedAt: string | null;
  /** Optional v16 program provenance. Missing on legacy sessions by design. */
  programId?: string;
  programVersion?: number;
  programDayId?: string;
  programDayLineageId?: string;
  programDayVersion?: number;
  programDayOwnership?: import("@/lib/program/types").ContentOwnership;
  sourceWorkoutTemplateId?: string;
  /** Program Horizon provenance. Present on Horizon-generated sessions and
      frozen with the queue so later revisions cannot rewrite the session. */
  horizonProgramId?: string;
  horizonProtocolId?: string;
  horizonArchitectureVersion?: string;
  horizonWeekNumber?: number;
  horizonPhaseId?: string;
  horizonDayIndex?: number;
  horizonDayTitle?: string;
  horizonRevisionIds?: string[];
  horizonSource?: import("@/lib/horizon/active-program").ActiveProgramSource;
  horizonWeekSnapshot?: import("@/lib/horizon/types").ProjectedProgramWeek;
};

export type TrainingSessionState = {
  sessionMode: SessionMode;
  sessionId: string | null;
  startedAt: string | null;
  /** Immutable generation record for the CURRENT session (null = legacy). */
  generation: SessionGenerationSnapshot | null;
  /** Canonical planned-versus-actual record for the current session. This is
      part of the existing trainingSession slice, not a second active store. */
  executionRecord: SessionExecutionRecord | null;
  /** Bounded immutable execution history, including safe legacy migrations. */
  executionHistory: SessionExecutionRecord[];
  weekExecutionSummaries: WeekExecutionSummary[];
  decisionHistory: ReserveDecisionRecord[];
  endedAt: string | null;
  closeoutAccuracy: CloseoutAccuracy | null;
  logAccuracy: LogAccuracy | null;
  sessionCompletion: SessionCompletion | null;
  minimalLogging: boolean;
  workoutSets: Record<string, StoredLoggedSet[]>;
  liveSetReviews: Record<string, StoredSetReview[]>;
  substitutions: StoredSubstitution[];
  debriefSummary: TrainingDebriefSummary | null;
  currentMovementId: string | null;
  schedulePlan: SchedulePlan;
  corePhaseStatus: SupportPhaseStatus;
  conditioningPhaseStatus: SupportPhaseStatus;
  recoveryPhaseStatus: SupportPhaseStatus;
  handoffPhaseStatus: SupportPhaseStatus;
  currentSupportPhase: SupportPhaseKey | null;
  manualMovementSelection: boolean;
  selectedCardioOptionId: string | null;
  selectedRecoveryOptionId: string | null;
  recoveryPreferences: RecoveryPreferences;
  sessionHistory: SessionIntelligenceCard[];
  trainingJournal: TrainingJournalEntry[];
  enhancementLog: EnhancementEntry[];
  enhancementAdherence: EnhancementAdherenceRecord[];
  injectionLogs: InjectionLogRecord[];
  compoundSupportLinks: CompoundSupportLink[];
};

/* ─── Support plan → schedule ──────────────────────────────────────────
   A supplement the member chose for their plan is theirs to track on the
   schedule too. It lands untimed: Reserve never picks when or how often, so
   the entry asks the member to set it. The log holds ENHANCEMENT_LOG_LIMIT
   entries and adding past that drops the oldest, so a full log is reported,
   never trimmed.

   The limit was 40. With the sync ledger, any entry dropped past the limit
   would travel to every device as a removal, so it now sits far above any
   real stack and exists only as a guard against runaway growth: a member's
   log must never lose an entry they didn't remove. */
export const ENHANCEMENT_LOG_LIMIT = 500;
export const SUPPORT_PLAN_SCHEDULE_REASON = "Added from your support plan. Set when and how often you take it to include it in schedule checks.";

/** What an add put in the member's records: the plan item, and the untimed schedule entry it created
    (`entryId` is null when the log is already at its limit). Returned so the surface that asked can
    follow up with the one question the entry still needs — when they take it. */
export type AddedSupport = { planItemId: string; entryId: string | null; name: string };

function supportPlanItemName(item: SupportPlanItem): string | null {
  if (item.optionKey === "custom") return item.customTitle?.trim() || null;
  return supportOptionByKey(item.optionKey)?.catalogName ?? null;
}

function entryMatchesName(entry: EnhancementEntry, name: string): boolean {
  const target = name.toLowerCase();
  return [entry.name, entry.officialName, entry.displayName].some((n) => n?.toLowerCase() === target);
}

function scheduleEntryForPlanItem(item: SupportPlanItem, name: string, at: Date): EnhancementEntry {
  const now = at.toISOString();
  return {
    id: `enh-${at.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    officialName: item.optionKey === "custom" ? undefined : name,
    category: /vitamin/i.test(name) ? "vitamin" : "supplement",
    doseAmount: item.amount ?? "",
    doseUnit: item.unit ?? "",
    frequency: item.frequency ?? "",
    timingPreference: "",
    timeOfDayPreference: "unspecified",
    goalAssociation: [],
    isActive: true,
    scheduleReviewReason: SUPPORT_PLAN_SCHEDULE_REASON,
    supportPlanItemId: item.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** Plan items not yet on the schedule, as new untimed entries — never past the log limit. */
function planEntriesToAdd(plan: SupportPlanItem[], log: EnhancementEntry[], at: Date): { entries: EnhancementEntry[]; skippedFull: number } {
  const entries: EnhancementEntry[] = [];
  let skippedFull = 0;
  for (const item of plan) {
    const name = supportPlanItemName(item);
    if (!name) continue;
    if ([...log, ...entries].some((e) => e.supportPlanItemId === item.id || entryMatchesName(e, name))) continue;
    if (log.length + entries.length >= ENHANCEMENT_LOG_LIMIT) {
      skippedFull += 1;
      continue;
    }
    entries.push(scheduleEntryForPlanItem(item, name, new Date(at.getTime() + entries.length)));
  }
  return { entries, skippedFull };
}

/** Support plan items that are not on the schedule, by name. Pure: for display. */
export function supportPlanItemsNotOnSchedule(plan: SupportPlanItem[], log: EnhancementEntry[]): string[] {
  return plan.flatMap((item) => {
    const name = supportPlanItemName(item);
    return name && !log.some((e) => e.supportPlanItemId === item.id || entryMatchesName(e, name)) ? [name] : [];
  });
}

const DEFAULT_SCHEDULE_PLAN: SchedulePlan = {
  workoutTime: "17:30",
  commuteMinutes: 20,
  prepMinutes: 25,
  wakeTime: "06:00",
  sleepTime: "22:30",
  preferFasted: false,
};

const DEFAULT_RECOVERY_PREFERENCES: RecoveryPreferences = {
  preferredTools: ["sauna"],
  dislikedTools: ["cold-plunge", "cold-shower", "contrast"],
  availableTools: [
    "sauna",
    "mobility-flow",
    "breath-downshift",
    "walking-cooldown",
    "compression-boots",
    "cold-plunge",
    "massage-gun",
    "red-light",
  ],
  prefersHeat: true,
  prefersCold: false,
  prefersAtHome: false,
  prefersLowEffort: false,
};

const DEFAULT_TRAINING_SESSION: TrainingSessionState = {
  sessionMode: "pre",
  sessionId: null,
  startedAt: null,
  generation: null,
  executionRecord: null,
  executionHistory: [],
  weekExecutionSummaries: [],
  decisionHistory: [],
  endedAt: null,
  closeoutAccuracy: null,
  logAccuracy: null,
  sessionCompletion: null,
  minimalLogging: false,
  workoutSets: {},
  liveSetReviews: {},
  substitutions: [],
  debriefSummary: null,
  currentMovementId: null,
  schedulePlan: DEFAULT_SCHEDULE_PLAN,
  corePhaseStatus: "pending",
  conditioningPhaseStatus: "pending",
  recoveryPhaseStatus: "pending",
  handoffPhaseStatus: "pending",
  currentSupportPhase: null,
  manualMovementSelection: false,
  selectedCardioOptionId: null,
  selectedRecoveryOptionId: null,
  recoveryPreferences: DEFAULT_RECOVERY_PREFERENCES,
  sessionHistory: [],
  trainingJournal: [],
  enhancementLog: [],
  enhancementAdherence: [],
  injectionLogs: [],
  compoundSupportLinks: [],
};

const SUPPORT_PHASE_STATUSES = new Set<SupportPhaseStatus>(["pending", "due-now", "completed", "skipped", "not-included"]);
const SUPPORT_PHASE_KEYS = new Set<SupportPhaseKey>(["core", "conditioning", "recovery", "handoff"]);

function normalizeSupportPhaseStatus(value: unknown): SupportPhaseStatus {
  return SUPPORT_PHASE_STATUSES.has(value as SupportPhaseStatus) ? (value as SupportPhaseStatus) : "pending";
}

function normalizeSupportPhaseKey(value: unknown): SupportPhaseKey | null {
  return SUPPORT_PHASE_KEYS.has(value as SupportPhaseKey) ? (value as SupportPhaseKey) : null;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === "string");
  return out;
}

const ENHANCEMENT_CATEGORIES = new Set<EnhancementCategory>([
  "supplement",
  "peptide",
  "hormone",
  "medication",
  "vitamin",
  "nootropic",
  "recovery",
  "other",
]);

const ENHANCEMENT_TIME_PREFS = new Set<EnhancementTimeOfDayPreference>([
  "morning",
  "pre_training",
  "post_training",
  "evening",
  "bedtime",
  "custom",
  "unspecified",
]);

const ENHANCEMENT_DOSE_SOURCES = new Set<EnhancementDoseSource>([
  "provider_directed",
  "member_entered",
  "label_directed",
  "unknown",
]);

const ENHANCEMENT_FREQUENCY_TYPES = new Set<EnhancementFrequencyType>([
  "daily",
  "weekly",
  "specific_days",
  "training_only",
  "rest_only",
  "custom",
]);

const COMPOUND_ROUTES = new Set<CompoundRoute>(["oral", "injectable", "topical", "nasal", "other"]);
const COMPOUND_INJECTION_TYPES = new Set<CompoundInjectionType>(["subq", "im", "other", "none"]);
const COMPOUND_SOURCE_TYPES = new Set<CompoundSourceType>(["member_entered", "provider_entered", "prescription", "clinic", "other"]);
const COMPOUND_AMOUNT_SOURCES = new Set<CompoundAmountSource>(["manual", "reconstitution_calculator", "ml_calculator", "oral_unit_calculator", "liquid_oral_calculator"]);
const COMPOUND_SCHEDULE_RULE_TYPES = new Set<CompoundScheduleRuleType>([
  "daily",
  "on_off_cycle",
  "specific_weekdays",
  "every_x_days",
  "every_x_weeks",
  "training_days_only",
  "rest_days_only",
  "all_training_days",
  "all_6_training_days",
  "upper_body_days",
  "lower_body_days",
  "push_days",
  "pull_days",
  "leg_days",
  "chest_back_days",
  "arm_shoulder_days",
  "conditioning_days",
  "custom_training_tags",
  "custom_date_sequence",
  "manual_only",
]);

const ENHANCEMENT_ADHERENCE_STATUSES = new Set<EnhancementAdherenceStatus>([
  "taken",
  "skipped",
  "missed",
  "planned",
]);

const ENHANCEMENT_TOLERANCE_RATINGS = new Set<EnhancementToleranceRating>([
  "good",
  "neutral",
  "poor",
  "unknown",
]);

function normalizeSessionIntelligenceArray(value: unknown): SessionIntelligenceCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SessionIntelligenceCard => isRecord(item) && typeof item.id === "string" && typeof item.sessionName === "string")
    .slice(0, 24);
}

function normalizeTrainingJournalArray(value: unknown): TrainingJournalEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is TrainingJournalEntry => isRecord(item) && typeof item.id === "string" && typeof item.sessionName === "string")
    .slice(0, 60);
}

function normalizeEnhancementEntry(raw: unknown): EnhancementEntry | null {
  if (!isRecord(raw)) return null;
  const r = raw as Partial<EnhancementEntry> & Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const category = ENHANCEMENT_CATEGORIES.has(r.category as EnhancementCategory)
    ? (r.category as EnhancementCategory)
    : "other";

  // Migrate legacy field names (doseEntered → doseAmount, etc.)
  const doseAmount = typeof r.doseAmount === "string" ? r.doseAmount
    : typeof (r as Record<string, unknown>).doseEntered === "string" ? (r as Record<string, string>).doseEntered
    : "";
  const doseUnit = typeof r.doseUnit === "string" ? r.doseUnit
    : typeof (r as Record<string, unknown>).unitEntered === "string" ? (r as Record<string, string>).unitEntered
    : "";
  const frequency = typeof r.frequency === "string" ? r.frequency
    : typeof (r as Record<string, unknown>).frequencyEntered === "string" ? (r as Record<string, string>).frequencyEntered
    : "";
  const timingPreference = typeof r.timingPreference === "string" ? r.timingPreference : "";
  const timeOfDayPreference = ENHANCEMENT_TIME_PREFS.has(r.timeOfDayPreference as EnhancementTimeOfDayPreference)
    ? (r.timeOfDayPreference as EnhancementTimeOfDayPreference)
    : "unspecified";
  const sourceOfDose = ENHANCEMENT_DOSE_SOURCES.has(r.sourceOfDose as EnhancementDoseSource)
    ? (r.sourceOfDose as EnhancementDoseSource)
    : "unknown";

  let goalAssociation: string[] = [];
  const goalsRaw = (r as Record<string, unknown>).goalAssociation;
  if (Array.isArray(goalsRaw)) {
    goalAssociation = goalsRaw.filter((g): g is string => typeof g === "string");
  } else if (typeof goalsRaw === "string" && goalsRaw.trim().length > 0) {
    goalAssociation = [goalsRaw];
  }
  let labMarkers: string[] = [];
  if (Array.isArray(r.labMarkersToDiscuss)) {
    labMarkers = r.labMarkersToDiscuss.filter((g): g is string => typeof g === "string");
  } else if (typeof (r as Record<string, unknown>).labMarkers === "string" && ((r as Record<string, string>).labMarkers || "").trim().length > 0) {
    labMarkers = [(r as Record<string, string>).labMarkers];
  }

  const now = new Date().toISOString();

  // Frequency / scheduling
  const trainingDayUseVal = typeof r.trainingDayUse === "boolean" ? r.trainingDayUse : true;
  const restDayUseVal = typeof r.restDayUse === "boolean" ? r.restDayUse : true;
  let frequencyType: EnhancementFrequencyType;
  if (ENHANCEMENT_FREQUENCY_TYPES.has(r.frequencyType as EnhancementFrequencyType)) {
    frequencyType = r.frequencyType as EnhancementFrequencyType;
  } else if (!trainingDayUseVal && restDayUseVal) {
    frequencyType = "rest_only";
  } else if (trainingDayUseVal && !restDayUseVal) {
    frequencyType = "training_only";
  } else {
    frequencyType = "daily";
  }
  let daysOfWeek: number[] = [];
  if (Array.isArray(r.daysOfWeek)) {
    daysOfWeek = r.daysOfWeek
      .map((d) => (typeof d === "number" ? d : Number(d)))
      .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6);
  }

  // Optional / extended persisted strings
  const officialName = typeof r.officialName === "string" ? r.officialName : undefined;
  /* The member's own name leads: "Masteron" stays Masteron even when the catalog knows it as Drostanolone.
     A display name that only echoes the official name while the member named it differently is the old
     default, so the member's name replaces it. */
  const storedDisplay = typeof r.displayName === "string" && r.displayName.trim() ? r.displayName : undefined;
  const displayName = storedDisplay && !(officialName && storedDisplay === officialName && r.name.trim() && r.name !== officialName) ? storedDisplay : r.name;
  const aliases = Array.isArray(r.aliases) ? r.aliases.filter((a): a is string => typeof a === "string") : undefined;
  const compoundClass = typeof r.compoundClass === "string" ? r.compoundClass : undefined;
  const route = COMPOUND_ROUTES.has(r.route as CompoundRoute) ? (r.route as CompoundRoute) : undefined;
  const injectionType = COMPOUND_INJECTION_TYPES.has(r.injectionType as CompoundInjectionType)
    ? (r.injectionType as CompoundInjectionType)
    : undefined;
  const sourceType = COMPOUND_SOURCE_TYPES.has(r.sourceType as CompoundSourceType)
    ? (r.sourceType as CompoundSourceType)
    : undefined;

  function maybeNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const n = parseFloat(value);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  }

  const linkedSupportItemIds = Array.isArray(r.linkedSupportItemIds)
    ? r.linkedSupportItemIds.filter((s): s is string => typeof s === "string")
    : undefined;
  const scheduleRule = normalizeCompoundScheduleRule(r.scheduleRule);
  const amountSource = COMPOUND_AMOUNT_SOURCES.has(r.amountSource as CompoundAmountSource)
    ? (r.amountSource as CompoundAmountSource)
    : undefined;

  const baseEntry: EnhancementEntry = {
    id: r.id,
    name: r.name,
    officialName,
    displayName,
    aliases,
    compoundClass,
    category,
    doseAmount,
    doseUnit,
    frequency,
    timingPreference,
    timeOfDayPreference,
    customTime: typeof r.customTime === "string" ? r.customTime : "",
    goalAssociation,
    trainingDayUse: trainingDayUseVal,
    restDayUse: restDayUseVal,
    clinicianOversight: typeof r.clinicianOversight === "boolean" ? r.clinicianOversight : false,
    sourceOfDose,
    sourceType,
    notes: typeof r.notes === "string" ? r.notes : (typeof (r as Record<string, unknown>).sideEffectsNotes === "string" ? (r as Record<string, string>).sideEffectsNotes : ""),
    toleranceNotes: typeof r.toleranceNotes === "string" ? r.toleranceNotes : "",
    sideEffectNotes: typeof r.sideEffectNotes === "string" ? r.sideEffectNotes
      : typeof (r as Record<string, unknown>).sideEffectsNotes === "string" ? (r as Record<string, string>).sideEffectsNotes
      : "",
    symptomNotes: typeof r.symptomNotes === "string" ? r.symptomNotes : "",
    labMarkersToDiscuss: labMarkers,
    isActive: typeof r.isActive === "boolean" ? r.isActive : true,
    frequencyType,
    daysOfWeek,
    scheduleRule,
    startDate: typeof r.startDate === "string" ? r.startDate : undefined,
    pausedAt: typeof r.pausedAt === "string" ? r.pausedAt : undefined,
    scheduleReviewReason: typeof r.scheduleReviewReason === "string" ? r.scheduleReviewReason : undefined,
    route,
    injectionType,
    vialVolumeMl: maybeNumber(r.vialVolumeMl),
    concentrationMgPerMl: maybeNumber(r.concentrationMgPerMl),
    totalQuantityMg: maybeNumber(r.totalQuantityMg),
    remainingQuantityMg: maybeNumber(r.remainingQuantityMg),
    amountPerLogMg: maybeNumber(r.amountPerLogMg),
    amountSource,
    vialTotalAmount: maybeNumber(r.vialTotalAmount),
    vialTotalUnit: r.vialTotalUnit === "mg" || r.vialTotalUnit === "mcg" ? r.vialTotalUnit : undefined,
    reconstitutionVolumeMl: maybeNumber(r.reconstitutionVolumeMl),
    syringeUnitsPerMl: maybeNumber(r.syringeUnitsPerMl),
    unitsPlannedPerLog: maybeNumber(r.unitsPlannedPerLog),
    vialCount: maybeNumber(r.vialCount),
    remainingVialCount: maybeNumber(r.remainingVialCount),
    partialVialRemainingMg: maybeNumber(r.partialVialRemainingMg),
    reorderLeadDays: maybeNumber(r.reorderLeadDays),
    costPerVial: maybeNumber(r.costPerVial),
    supplierNote: typeof r.supplierNote === "string" ? r.supplierNote : undefined,
    expirationDate: typeof r.expirationDate === "string" ? r.expirationDate : undefined,
    storageNote: typeof r.storageNote === "string" ? r.storageNote : undefined,
    parentCompoundId: typeof r.parentCompoundId === "string" ? r.parentCompoundId : undefined,
    linkedSupportItemIds,
    minimumSiteRestDays: maybeNumber(r.minimumSiteRestDays),
    todayTier: r.todayTier === "hero" || r.todayTier === "add-on" ? r.todayTier : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (typeof r.createdAt === "string" ? r.createdAt : now),
  };

  // Schedule migration: parse legacy weekday tokens from free-text timing.
  // This is the fix for entries that became Daily but contained "Sundays".
  return migrateLegacyScheduleText(baseEntry);
}

function normalizeCompoundScheduleRule(value: unknown): CompoundScheduleRule | undefined {
  if (!isRecord(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (!COMPOUND_SCHEDULE_RULE_TYPES.has(r.type as CompoundScheduleRuleType)) return undefined;
  const numberArray = (raw: unknown, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) =>
    Array.isArray(raw)
      ? raw.map((item) => typeof item === "number" ? item : Number(item)).filter((item) => Number.isFinite(item) && item >= min && item <= max)
      : undefined;
  const stringArray = (raw: unknown) =>
    Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;

  return {
    type: r.type as CompoundScheduleRuleType,
    weekdays: numberArray(r.weekdays, 0, 6),
    intervalDays: typeof r.intervalDays === "number" && r.intervalDays > 0 ? r.intervalDays : undefined,
    intervalWeeks: typeof r.intervalWeeks === "number" && r.intervalWeeks > 0 ? r.intervalWeeks : undefined,
    anchorDate: typeof r.anchorDate === "string" ? r.anchorDate : undefined,
    trainingTags: stringArray(r.trainingTags),
    dateSequence: stringArray(r.dateSequence),
    daysOn: wholeInRange(r.daysOn, 1, 60),
    daysOff: wholeInRange(r.daysOff, 0, 60),
    doses: normalizeDoseTimings(r.doses),
  };
}

function wholeInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

const DOSE_ANCHORS = new Set<CompoundDoseAnchor>(["clock", "meal", "wake", "bed", "training"]);

function normalizeDoseTimings(value: unknown): CompoundDoseTiming[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const doses = value
    .filter(isRecord)
    .map((raw) => raw as Record<string, unknown>)
    .filter((raw) => DOSE_ANCHORS.has(raw.anchor as CompoundDoseAnchor))
    .slice(0, 4)
    .map((raw): CompoundDoseTiming => ({
      anchor: raw.anchor as CompoundDoseAnchor,
      time: typeof raw.time === "string" ? raw.time : undefined,
      meal: typeof raw.meal === "string" ? raw.meal : undefined,
      offsetMin: typeof raw.offsetMin === "number" && Number.isFinite(raw.offsetMin) ? Math.max(-720, Math.min(720, Math.round(raw.offsetMin))) : undefined,
    }));
  return doses.length > 0 ? doses : undefined;
}

function migrateLegacyScheduleText(entry: EnhancementEntry): EnhancementEntry {
  const combined = [entry.timingPreference, entry.frequency, entry.customTime]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" · ")
    .toLowerCase();
  if (combined.length === 0) return entry;

  const DAY_MAP: Array<{ tokens: string[]; dow: number }> = [
    { tokens: ["sunday", "sundays", "sun"], dow: 0 },
    { tokens: ["monday", "mondays", "mon"], dow: 1 },
    { tokens: ["tuesday", "tuesdays", "tue", "tues"], dow: 2 },
    { tokens: ["wednesday", "wednesdays", "wed"], dow: 3 },
    { tokens: ["thursday", "thursdays", "thu", "thur", "thurs"], dow: 4 },
    { tokens: ["friday", "fridays", "fri"], dow: 5 },
    { tokens: ["saturday", "saturdays", "sat"], dow: 6 },
  ];
  const found = new Set<number>();
  for (const { tokens, dow } of DAY_MAP) {
    for (const token of tokens) {
      const re = new RegExp(`\\b${token}\\b`, "i");
      if (re.test(combined)) {
        found.add(dow);
        break;
      }
    }
  }
  if (found.size === 0) return entry;
  const parsedDays = Array.from(found).sort((a, b) => a - b);
  const declared = entry.frequencyType ?? "daily";
  const declaredDays = entry.daysOfWeek ?? [];

  if (declared === "daily") {
    return { ...entry, frequencyType: "weekly", daysOfWeek: parsedDays };
  }
  if ((declared === "weekly" || declared === "specific_days") && declaredDays.length === 0) {
    return { ...entry, daysOfWeek: parsedDays };
  }
  if ((declared === "weekly" || declared === "specific_days") && declaredDays.length > 0) {
    const sameSet = declaredDays.length === parsedDays.length && declaredDays.every((d) => parsedDays.includes(d));
    if (sameSet) return entry;
    return { ...entry, scheduleReviewReason: "Legacy timing text mentions different days than the structured schedule." };
  }
  return { ...entry, scheduleReviewReason: "Legacy timing text mentions a specific weekday but the entry is set to a different frequency mode." };
}

function normalizeEnhancementLogArray(value: unknown): EnhancementEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeEnhancementEntry(item))
    .filter((item): item is EnhancementEntry => item !== null)
    .slice(0, 40);
}

function normalizeInjectionLogArray(value: unknown): InjectionLogRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): InjectionLogRecord | null => {
      if (!isRecord(item)) return null;
      const r = item as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.entryId !== "string" || typeof r.date !== "string") return null;
      return {
        id: r.id,
        entryId: r.entryId,
        date: r.date,
        time: typeof r.time === "string" ? r.time : undefined,
        amountValue: typeof r.amountValue === "string" ? r.amountValue : undefined,
        amountUnit: typeof r.amountUnit === "string" ? r.amountUnit : undefined,
        unitsUsed: typeof r.unitsUsed === "number" ? r.unitsUsed : undefined,
        calculatedMgUsed: typeof r.calculatedMgUsed === "number" ? r.calculatedMgUsed : undefined,
        amountSource: COMPOUND_AMOUNT_SOURCES.has(r.amountSource as CompoundAmountSource) ? (r.amountSource as CompoundAmountSource) : undefined,
        route: COMPOUND_ROUTES.has(r.route as CompoundRoute) ? (r.route as CompoundRoute) : undefined,
        injectionType: COMPOUND_INJECTION_TYPES.has(r.injectionType as CompoundInjectionType)
          ? (r.injectionType as CompoundInjectionType)
          : undefined,
        site: typeof r.site === "string" ? r.site : "Unspecified",
        side: r.side === "left" || r.side === "right" || r.side === "center" ? r.side : undefined,
        reactionNote: typeof r.reactionNote === "string" ? r.reactionNote : undefined,
        painLevel: typeof r.painLevel === "number" ? r.painLevel : undefined,
        rednessNote: typeof r.rednessNote === "string" ? r.rednessNote : undefined,
        swellingNote: typeof r.swellingNote === "string" ? r.swellingNote : undefined,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
    })
    .filter((r): r is InjectionLogRecord => r !== null)
    .slice(0, 400);
}

function normalizeCompoundSupportLinkArray(value: unknown): CompoundSupportLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CompoundSupportLink | null => {
      if (!isRecord(item)) return null;
      const r = item as Record<string, unknown>;
      if (typeof r.parentEntryId !== "string" || typeof r.supportEntryId !== "string") return null;
      return {
        parentEntryId: r.parentEntryId,
        supportEntryId: r.supportEntryId,
        reason: typeof r.reason === "string" ? r.reason : "Member/provider-entered",
        trigger: typeof r.trigger === "string" ? r.trigger : undefined,
        relationshipType: typeof r.relationshipType === "string" ? (r.relationshipType as CompoundSupportRelationshipType) : undefined,
        reasonTags: normalizeStringArray(r.reasonTags, []),
        labMarkers: normalizeStringArray(r.labMarkers, []),
        symptomWatches: normalizeStringArray(r.symptomWatches, []),
        customNote: typeof r.customNote === "string" ? r.customNote : undefined,
        source: r.source === "provider_entered" ? "provider_entered" : "member_entered",
      };
    })
    .filter((item): item is CompoundSupportLink => item !== null)
    .slice(0, 80);
}

function normalizeEnhancementAdherenceArray(value: unknown): EnhancementAdherenceRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const r = item as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.entryId !== "string" || typeof r.date !== "string") return null;
      if (!ENHANCEMENT_ADHERENCE_STATUSES.has(r.takenStatus as EnhancementAdherenceStatus)) return null;
      const tolerance = ENHANCEMENT_TOLERANCE_RATINGS.has(r.tolerance as EnhancementToleranceRating)
        ? (r.tolerance as EnhancementToleranceRating)
        : undefined;
      const record: EnhancementAdherenceRecord = {
        id: r.id,
        entryId: r.entryId,
        date: r.date,
        plannedTime: typeof r.plannedTime === "string" ? r.plannedTime : "—",
        takenStatus: r.takenStatus as EnhancementAdherenceStatus,
        actualTime: typeof r.actualTime === "string" ? r.actualTime : undefined,
        note: typeof r.note === "string" ? r.note : undefined,
        tolerance,
        symptoms: typeof r.symptoms === "string" ? r.symptoms : undefined,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
      return record;
    })
    .filter((item): item is EnhancementAdherenceRecord => item !== null)
    .slice(0, 400);
}

function normalizeRecoveryPreferences(value: unknown): RecoveryPreferences {
  const r = isRecord(value) ? value : {};
  return {
    preferredTools: normalizeStringArray(r.preferredTools, DEFAULT_RECOVERY_PREFERENCES.preferredTools),
    dislikedTools: normalizeStringArray(r.dislikedTools, DEFAULT_RECOVERY_PREFERENCES.dislikedTools),
    availableTools: normalizeStringArray(r.availableTools, DEFAULT_RECOVERY_PREFERENCES.availableTools),
    prefersHeat: typeof r.prefersHeat === "boolean" ? r.prefersHeat : DEFAULT_RECOVERY_PREFERENCES.prefersHeat,
    prefersCold: typeof r.prefersCold === "boolean" ? r.prefersCold : DEFAULT_RECOVERY_PREFERENCES.prefersCold,
    prefersAtHome: typeof r.prefersAtHome === "boolean" ? r.prefersAtHome : DEFAULT_RECOVERY_PREFERENCES.prefersAtHome,
    prefersLowEffort: typeof r.prefersLowEffort === "boolean" ? r.prefersLowEffort : DEFAULT_RECOVERY_PREFERENCES.prefersLowEffort,
  };
}

/* ─── Nutrition preferences (single source of truth for Nutrition Command) ── */
export type NutritionPurchase = {
  id: string;
  itemName: string;
  category: string;
  quantityPurchased: number;
  unit: string;
  store: string;
  pricePaid: number;
  purchaseDate: string;
  expirationDate?: string;
  qualityTags?: string[];
  notes?: string;
};

export type NutritionPrepPreference = "batch" | "cook-fresh" | "low-prep";
export type NutritionCookingEquipment = "stovetop" | "oven" | "grill" | "air-fryer" | "microwave" | "slow-cooker";

export type NutritionPrefsState = {
  dietStyle: string;
  /** Carnivore strictness rung — only meaningful when dietStyle === "carnivore". */
  carnivoreStrictness: "strict" | "dairy_allowed" | "animal_based_flex";
  bodyweightLb: number;
  dislikedFoods: string[];
  excludedFoods: string[];
  favoriteFoods: string[];
  allergies: string[];
  caffeineStyle: string;
  dairyAllowed: boolean;
  preferredStores: string[];
  qualityPreferences: string[];
  appetiteLevel: "low" | "normal" | "high";
  purchases: NutritionPurchase[];
  loggedMealIds: string[];
  /** Date (YYYY-MM-DD) the current loggedMealIds + signature `addedToday` flags belong to.
      When the calendar day changes, the daily log state resets so yesterday's logs never
      mark today's meals as logged. Historical detail lives in the logging backend. */
  nutritionLogDate: string | null;
  /** Archived per-day logged meal ids — preserves the day's record when it rolls over. */
  nutritionLogHistory: Record<string, string[]>;
  signatureMeals: SignatureMeal[];
  /** Most recent confirmed meal-log event — drives the Live Fuel Brief + Apex/AI nutrition signal. */
  latestMealLog: LoggedMealEvent | null;
  /** Role-typed preferred protein sources (e.g. "salmon", "eggs", "chicken"). */
  favoriteProteinSources: string[];
  /** Role-typed preferred carb sources (e.g. "rice", "sweet potato", "sourdough"). */
  favoriteCarbSources: string[];
  /** How the member prefers to prepare their meals across the week. */
  prepPreference: NutritionPrepPreference;
  /** Cooking equipment available to the member. Meals requiring only unavailable equipment are deprioritised. */
  cookingEquipment: NutritionCookingEquipment[];
  /** Budget tier — mirrors setupProfile.groceryBudgetLevel as a nutrition-scoped preference. */
  groceryBudgetLevel: "lean" | "standard" | "premium";
  /** Peak Mode: the look the member picked. When set, it sets the fuel goal every Nutrition surface builds from. */
  peakLook?: PeakLook | null;
  /** Peak Mode kitchen: the member's food answers (carbs, proteins, foods they avoid). */
  peakKitchen?: PeakKitchenPrefs | null;
  /** Plates the member swapped in, by date then swap key (the meal slot, or "snack:<id>"). */
  peakSwaps?: Record<string, Record<string, string>>;
  /** Snacks the member wants between meals. Unset: mid-morning and afternoon. Empty: none. */
  peakSnacks?: PeakSnackPeriod[];
  /** Bowls the member built themselves, offered for their own slot. */
  peakBowls?: CustomBowl[];
  /** The cooking list the member has ticked off, for the day it belongs to. */
  peakPrep?: { day: string; done: string[] };
  /** Plates the member hid for good. */
  peakHidden?: string[];
  /** Lean-to-fat ratios the member picked for ground meats, overriding Reserve's pick. */
  peakRatios?: Partial<Record<GroundFamily, PeakFood>>;
  /** Shopping list check-offs for the week that starts on `weekStart`. */
  peakShopping?: { weekStart: string; checked: string[] } | null;
};

/* Seed signature meal — the member's real "Sniper Breakfast Build". Demonstrates
   ingredient roles, store/quality preference, beverage + electrolyte items, and
   auto-computed macros from per-ingredient data. */
const SNIPER_BREAKFAST_BUILD: SignatureMeal = {
  id: "sig-sniper-breakfast",
  name: "Sniper Breakfast Build",
  purpose: "morning-anchor",
  manualMacros: false,
  storePreference: "whole-foods",
  qualityPreference: ["organic", "clean-label"],
  frequencyPerWeek: 4,
  favorite: true,
  addedToday: false,
  inRotation: true,
  createdAt: "2026-06-02",
  notes: "Morning protein anchor / training-day breakfast.",
  ingredients: [
    { id: "sb-espresso", name: "Espresso Coffee", amount: 2, unit: "shot", role: "beverage", groceryCategory: "coffee", store: "whole-foods", qualityPreference: ["organic", "clean-label"], macros: { calories: 5, proteinG: 0, carbsG: 1, fatG: 0 } },
    { id: "sb-monkfruit", name: "Monk Fruit", amount: 1, unit: "tsp", role: "sweetener", groceryCategory: "pantry", macros: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
    { id: "sb-agave", name: "Agave", amount: 1, unit: "tbsp", role: "sweetener", groceryCategory: "pantry", macros: { calories: 60, proteinG: 0, carbsG: 16, fatG: 0 } },
    { id: "sb-eggs", name: "Whole Eggs", amount: 3, unit: "count", role: "protein", groceryCategory: "protein", store: "whole-foods", qualityPreference: ["pasture-raised", "organic"], macros: { calories: 210, proteinG: 18, carbsG: 2, fatG: 15 } },
    { id: "sb-egg-whites", name: "Egg Whites", amount: 3, unit: "count", role: "protein", groceryCategory: "protein", store: "whole-foods", qualityPreference: ["pasture-raised"], macros: { calories: 51, proteinG: 11, carbsG: 0, fatG: 0 } },
    { id: "sb-sourdough", name: "Sourdough Toast", amount: 1, unit: "slice", role: "carb", groceryCategory: "carb", store: "whole-foods", qualityPreference: ["clean-label"], macros: { calories: 120, proteinG: 4, carbsG: 22, fatG: 1 } },
    { id: "sb-jam", name: "Strawberry Jam", amount: 1, unit: "tbsp", role: "carb", groceryCategory: "pantry", store: "whole-foods", qualityPreference: ["clean-label"], macros: { calories: 50, proteinG: 0, carbsG: 13, fatG: 0 } },
    { id: "sb-sweet-potato", name: "Sweet Potato Slices", amount: 150, unit: "g", role: "carb", groceryCategory: "carb", store: "whole-foods", qualityPreference: ["organic"], macros: { calories: 130, proteinG: 2, carbsG: 30, fatG: 0 } },
    { id: "sb-cottage", name: "Cottage Cheese", amount: 0.5, unit: "cup", role: "protein", groceryCategory: "dairy", store: "whole-foods", qualityPreference: ["organic"], macros: { calories: 110, proteinG: 12, carbsG: 5, fatG: 5 } },
    { id: "sb-parmesan", name: "Shredded Parmesan", amount: 2, unit: "tbsp", role: "fat", groceryCategory: "dairy", brand: "Whole Foods", store: "whole-foods", qualityPreference: ["clean-label"], macros: { calories: 40, proteinG: 3, carbsG: 0, fatG: 3 } },
    { id: "sb-water", name: "Water", amount: 16, unit: "oz", role: "hydration", groceryCategory: "hydration" },
    { id: "sb-electrolytes", name: "Electrolytes", amount: 1, unit: "scoop", role: "hydration", groceryCategory: "hydration", brand: "Santa Cruz Paleo · Dragonfruit", store: "whole-foods", qualityPreference: ["clean-label"], macros: { calories: 10, proteinG: 0, carbsG: 2, fatG: 0 } },
  ],
};

export const DEFAULT_NUTRITION_PREFS: NutritionPrefsState = {
  dietStyle: "standard",
  carnivoreStrictness: "strict",
  /* 0 = not entered. Read it through resolveMemberBodyweight, never directly. */
  bodyweightLb: 0,
  dislikedFoods: [],
  excludedFoods: [],
  favoriteFoods: [],
  allergies: [],
  caffeineStyle: "iced-coffee",
  dairyAllowed: true,
  preferredStores: ["whole-foods", "costco", "farmers-market"],
  qualityPreferences: ["clean-label"],
  appetiteLevel: "normal",
  purchases: [],
  loggedMealIds: [],
  nutritionLogDate: null,
  nutritionLogHistory: {},
  signatureMeals: [SNIPER_BREAKFAST_BUILD],
  latestMealLog: null,
  favoriteProteinSources: [],
  favoriteCarbSources: [],
  prepPreference: "cook-fresh",
  cookingEquipment: ["stovetop", "oven", "microwave"],
  groceryBudgetLevel: "standard",
};

/* ─── Setup profile (onboarding-captured Tier-1 personalization) ──────────── */
export type SetupProfile = {
  setupComplete: boolean;
  completedAt: string | null;
  completedSteps: string[];
  heightIn?: number;
  age?: number;
  sex?: "male" | "female" | "other";
  targetWeightLb?: number;
  workStartTime?: string;
  workEndTime?: string;
  trainingDaysPerWeek?: number;
  sessionDurationMin?: number;
  mealsPerDay?: number;
  groceryBudgetLevel?: "lean" | "standard" | "premium";
  usesCompounds?: boolean;
  bloodworkStatus?: "none" | "baseline" | "current";
  labReviewCadenceWeeks?: number;
  checkInDay?: number; // 0=Sun … 6=Sat
  baselineWeightLb?: number;
  baselineLoggedAt?: string;
  // Captured by the Operating System Setup flow (all optional, additive)
  preferredSplit?: string;
  equipmentAccess?: string;
  weakPoints?: string[];
  /** Daily physical demand outside training — feeds recovery-aware architecture
      selection (a physical job leaves less recovery for high-demand structures). */
  occupationLoad?: "sedentary" | "active" | "physical";
  targetTimelineWeeks?: number;
  priorities?: string[];
  enhancementTracking?: string[];
  bloodworkMarkers?: string[];
  lastLabDate?: string;
  nextReviewDate?: string;
  checkInFrequency?: "weekly" | "biweekly" | "monthly";
  baselineWaistIn?: number;
  baselineChestIn?: number;
  baselineArmsIn?: number;
};

export const DEFAULT_SETUP_PROFILE: SetupProfile = {
  setupComplete: false,
  completedAt: null,
  completedSteps: [],
};

/* ─── Split system selection (Split Architect) ────────────────────────────
   The member's chosen split system. The custom split NAME lives on
   profile.trainingStyle (existing field). Key values come from
   lib/training/split-architect (kept as string here to stay decoupled). */
export type SplitSystemSource = "reserve" | "member";

export type SplitSystemSelection = {
  key: string | null;
  source: SplitSystemSource | null;
  selectedAt: string | null;
  /** The weekday the member rests on (0 = Monday … 6 = Sunday). The split's
      cycle turns to meet it; null keeps the split's own rest day. */
  restDayIndex: number | null;
};

export const DEFAULT_SPLIT_SYSTEM: SplitSystemSelection = { key: null, source: null, selectedAt: null, restDayIndex: null };

/* ─── Program horizon state ───────────────────────────────────────────────
   The complete projected program plus the recurring activities that shaped
   it. Persisted so revisions and history survive a refresh. */
export type ProgramHorizonState = {
  horizon: ProgramHorizon | null;
  recurringActivities: AthleteActivity[];
  updatedAt: string | null;
};

export const DEFAULT_PROGRAM_HORIZON_STATE: ProgramHorizonState = {
  horizon: null,
  recurringActivities: [],
  updatedAt: null,
};

/* ─── Response Model state ────────────────────────────────────────────────
   Insights are derived and rebuilt from the execution ledger. What is
   persisted is what cannot be rederived: the athlete's decisions, the insight
   history that carries lifecycle state, and the response event log. */
export type ResponseModelState = {
  model: AthleteResponseModel | null;
  /** Bounded event log surfaced by the Decision Log. */
  events: ResponseEvent[];
  /** Immutable once completed; provisional active-week reviews are replaced
      deterministically until the Week Execution Summary closes. */
  weeklyReviews: WeeklyResponseReview[];
  updatedAt: string | null;
};

export const DEFAULT_RESPONSE_MODEL_STATE: ResponseModelState = {
  model: null,
  events: [],
  weeklyReviews: [],
  updatedAt: null,
};

/** Keeps the persisted event log from growing without bound. */
const MAX_RESPONSE_EVENTS = 200;

/* ─── Training overrides (session flex · missed-day · accidental start) ──── */
export type TrainingOverrideAction =
  | "rescheduled"
  | "skipped"
  | "swapped"
  | "favorite"
  | "session_reset"
  | "accidental_start"
  | "not_ready";

export type TrainingOverrideStatus = "active" | "completed" | "cancelled";

export type TrainingOverride = {
  id: string;
  action: TrainingOverrideAction;
  status: TrainingOverrideStatus;
  /** Calendar occurrence that was changed. */
  originalDate: string;
  originalSessionTitle: string;
  /** splitKey of the session that was displaced (for swap / reschedule tracking). */
  originalSessionId?: string;
  originalProgramDayId?: string;
  originalDayIndex?: number;
  newSessionTitle?: string;
  /** splitKey of the session the member switched to. */
  newSessionId?: string;
  /** ISO date (YYYY-MM-DD) the member wants to move the session to. */
  targetDate?: string;
  targetDayIndex?: number;
  targetDayTitle?: string;
  targetProgramDayId?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

/* ─── Bloodwork Log ───────────────────────────────────────────────────────
   Member-entered or member-confirmed lab records. A reference range and lab
   flag are stored only as printed on the member's own report — Reserve never
   supplies either. No diagnosis, no recommendations. File binaries stay on
   the member's device; a PDF is parsed on-device and only the confirmed
   marker rows are persisted. */
export type BloodworkMarkerValue = {
  name: string;
  value: string;
  unit?: string;
  /** Exactly as printed on the report, e.g. "38.5-50.0" or "≥ 40". */
  referenceRange?: string;
  /** The flag the LAB printed. */
  labFlag?: LabFlag;
  /** Canonical marker key when the name was recognized. */
  markerKey?: string;
};

export type BloodworkLogRecord = {
  id: string;
  testDate: string; // YYYY-MM-DD
  labName?: string;
  /** Selected file metadata only — the binary is never persisted. */
  fileName?: string;
  fileType?: string;
  fileSizeKb?: number;
  notes?: string;
  /** Member-entered marker values exactly as typed. No ranges, no flags. */
  markers?: BloodworkMarkerValue[];
  createdAt: string;
};

/* ════════════════════════════════════════════════════════════════════════
   ONBOARDING — SINGLE SOURCE OF TRUTH
   ------------------------------------------------------------------------
   One transactional payload that the onboarding flow fans out to every
   canonical slice in a single write. This guarantees answers are saved once
   and reused everywhere (no repeated prompts, no per-flow drift). Every field
   is optional and additive so partial saves never wipe existing values.
   ════════════════════════════════════════════════════════════════════════ */
export type OnboardingWritePayload = {
  profile?: Partial<AthleteProfile>;
  setupProfile?: Partial<SetupProfile>;
  /** Daily schedule — written to the canonical trainingSession.schedulePlan. */
  schedulePlan?: Partial<SchedulePlan>;
  scheduleProfile?: Partial<MemberScheduleProfile>;
  /** Preferred over raw slices: derives a coherent whole-day schedule
      (training block + meal windows) and mirrors it into schedulePlan. */
  scheduleIntent?: ScheduleIntent;
  nutritionPrefs?: Partial<NutritionPrefsState>;
  userTrainingProfile?: Partial<UserTrainingProfile>;
  trainingExperience?: TrainingExperience;
  activityStack?: ActivityStack;
  activitySport?: SportType | null;
  womensNutritionGoal?: WomensNutritionGoal;
  /** Protocol confirmation. null/omitted leaves the current protocol untouched. */
  protocolId?: string | null;
  protocolOptions?: ActivateOptions;
  persona?: UserPersona;
  subscriptionTier?: SubscriptionTier;
  /** Setup steps to mark done (unioned with existing). */
  completedSetupSteps?: string[];
  /** Mark the Tier-1 setup as fully complete (stops the "finish setup" nudge). */
  markSetupComplete?: boolean;
  /** Mark the onboarding wizard itself complete. */
  completeOnboarding?: boolean;
};

type AthleteDashboardStore = {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  /** Transient launch intent: the primary command CTA (Apex hero, command
      board) sets this so Training Command opens DIRECTLY into today's session
      — resuming a live session or entering pre-session readiness — instead of
      landing at the top of the cockpit. Never persisted or synced. */
  trainingLaunchIntent: boolean;
  requestTrainingLaunch: () => void;
  clearTrainingLaunchIntent: () => void;
  profile: AthleteProfile;
  updateProfile: (updates: Partial<AthleteProfile>) => void;
  subscriptionTier: SubscriptionTier;
  setSubscriptionTier: (tier: SubscriptionTier) => void;
  onboarding: OnboardingState;
  startOnboarding: () => void;
  completeOnboardingStep: (step: OnboardingStep) => void;
  resetOnboarding: () => void;
  /**
   * Save partial onboarding answers so a refresh cannot lose them. Pass `step`
   * only when the member actually moves; omitting it preserves the saved step.
   */
  saveOnboardingDraft: (answers: Record<string, unknown>, step?: number) => void;
  /** Clear the draft once its answers are written to canonical slices. */
  clearOnboardingDraft: () => void;
  /** Single transactional write of an onboarding submission to every canonical slice. */
  writeOnboardingProfile: (payload: OnboardingWritePayload) => void;
  settings: PersistentSettings;
  updateSettings: (updates: Partial<PersistentSettings>) => void;
  setPersona: (persona: UserPersona) => void;
  engagement: RetentionState;
  recordAppOpen: () => void;
  recordModuleView: (view: DashboardView) => void;
  recordDailyCheckIn: (scores?: { readiness?: number; adherence?: number }) => void;
  completeRetentionMilestone: (milestone: RetentionMilestoneKey) => void;
  recordUpgradeIntent: (intent: Omit<UpgradeIntent, "count" | "lastSeenAt">) => void;
  dismissEngagementPrompt: (promptId: string) => void;
  trainingSession: TrainingSessionState;
  /** Transient in-memory snapshot captured before a zero-output Reset Session, so
      the member can Undo a reset that was a test or an accident. Never persisted. */
  trainingResetSnapshot: TrainingSessionState | null;
  startTrainingSession: (movementId?: string | null, generation?: SessionGenerationSnapshot | null) => void;
  /** EXPLICIT member choice: rebuild the zero-progress session with the new
      architecture/demand. Refuses (no-op) once any set is logged. */
  rebuildLiveSession: (generation: SessionGenerationSnapshot, firstMovementId?: string | null) => void;
  /** Member chose "apply next session" — silences the change banner. */
  acknowledgeGenerationChange: () => void;
  setCurrentTrainingMovement: (movementId: string | null) => void;
  logTrainingSet: (entry: Omit<StoredLoggedSet, "loggedAt">) => void;
  editTrainingSet: (movementId: string, setNumber: number, updates: Omit<StoredLoggedSet, "movementId" | "setNumber" | "loggedAt">) => void;
  undoLastTrainingSet: (movementId: string) => void;
  markTrainingSessionComplete: () => void;
  closeOutTrainingSession: (accuracy: CloseoutAccuracy, extras?: { logAccuracy?: LogAccuracy; sessionCompletion?: SessionCompletion }) => void;
  recordTrainingSubstitution: (entry: Omit<StoredSubstitution, "selectedAt">) => void;
  skipTrainingMovement: (movementId: string, reason?: string) => boolean;
  removeTrainingMovement: (movementId: string, reason?: string) => boolean;
  addTrainingMovement: (entry: Omit<AddMovementInput, "id"> & { id?: string }) => string | null;
  logAddedTrainingSet: (
    movementId: string,
    entry: Omit<RecordCompletedSetInput, "id" | "setNumber"> & { setNumber?: number },
  ) => boolean;
  updateTrainingExecutionMetrics: (updates: Partial<SessionExecutionRecord["sessionMetrics"]>) => boolean;
  recordPlannedSessionOutcome: (input: {
    snapshot: LedgerSessionSnapshot;
    calendarDate: string;
    outcome: "skipped" | "replaced";
    reason: string;
    replacementActivityId?: string;
    adjustmentRevisionId?: string;
    reschedulingOffered?: boolean;
    reconciliationProposal?: string;
    athleteConfirmed?: boolean;
    nutritionAdjustment?: string[];
    recoveryAdjustment?: string[];
    affectedFutureDays?: string[];
  }) => string | null;
  recordReserveDecision: (input: ReserveDecisionInput) => void;
  refreshWeekExecutionSummary: (programId: string, weekNumber: number, plannedSessionCount: number) => WeekExecutionSummary;
  saveTrainingDebriefSummary: (summary: Omit<TrainingDebriefSummary, "generatedAt">) => void;
  resetTrainingSession: () => void;
  /** Reset the live session but stash a snapshot first, enabling Undo. */
  resetTrainingSessionWithUndo: () => void;
  /** Restore the snapshot captured by resetTrainingSessionWithUndo. */
  undoTrainingReset: () => void;
  /** Drop the reset snapshot (Undo no longer available). */
  clearTrainingResetSnapshot: () => void;
  toggleMinimalLogging: () => void;
  updateSchedulePlan: (updates: Partial<SchedulePlan>) => void;
  setSupportPhaseStatus: (phase: SupportPhaseKey, status: SupportPhaseStatus) => void;
  setManualMovementSelection: (manual: boolean) => void;
  setSelectedCardioOption: (optionId: string | null) => void;
  setSelectedRecoveryOption: (optionId: string | null) => void;
  updateRecoveryPreferences: (updates: Partial<RecoveryPreferences>) => void;
  appendSessionIntelligenceCard: (card: SessionIntelligenceCard) => void;
  appendTrainingJournalEntry: (entry: TrainingJournalEntry) => void;
  addEnhancementEntry: (entry: Omit<EnhancementEntry, "id" | "createdAt" | "updatedAt">) => void;
  updateEnhancementEntry: (id: string, updates: Partial<Omit<EnhancementEntry, "id" | "createdAt">>) => void;
  removeEnhancementEntry: (id: string) => void;
  toggleEnhancementEntryActive: (id: string) => void;
  logEnhancementAdherence: (record: Omit<EnhancementAdherenceRecord, "id" | "createdAt">) => void;
  clearEnhancementAdherenceForDay: (date: string) => void;
  addInjectionLog: (record: Omit<InjectionLogRecord, "id" | "createdAt">) => void;
  removeInjectionLog: (id: string) => void;
  addCompoundSupportLink: (link: CompoundSupportLink) => void;
  removeCompoundSupportLink: (parentEntryId: string, supportEntryId: string) => void;
  // Legacy aliases (kept for any older callers)
  addEnhancementLogEntry: (entry: Omit<EnhancementEntry, "id" | "createdAt" | "updatedAt">) => void;
  updateEnhancementLogEntry: (id: string, updates: Partial<Omit<EnhancementEntry, "id" | "createdAt">>) => void;
  removeEnhancementLogEntry: (id: string) => void;
  // Nutrition preferences (Nutrition Command source of truth)
  nutritionPrefs: NutritionPrefsState;
  setNutritionPrefs: (updates: Partial<NutritionPrefsState>) => void;
  addNutritionPurchase: (purchase: Omit<NutritionPurchase, "id">) => void;
  removeNutritionPurchase: (id: string) => void;
  toggleLoggedMeal: (mealId: string) => void;
  /** Roll the daily nutrition log to `today` (YYYY-MM-DD). If the stored log date is
      different, archive the prior day's logged ids and reset today's daily log state. */
  rolloverNutritionDay: (today: string) => void;
  /** Confirm a meal log (after the confirmation drawer) — marks it logged + records the event. */
  confirmMealLog: (event: LoggedMealEvent) => void;
  /** Undo the most recent confirmed meal log — un-logs it + clears the event. */
  undoLastMealLog: () => void;
  addSignatureMeal: (meal: Omit<SignatureMeal, "id" | "createdAt">) => void;
  updateSignatureMeal: (id: string, updates: Partial<SignatureMeal>) => void;
  removeSignatureMeal: (id: string) => void;
  toggleSignatureMealFavorite: (id: string) => void;
  toggleSignatureMealToday: (id: string) => void;
  toggleSignatureMealRotation: (id: string) => void;
  // Setup profile (deeper onboarding personalization)
  setupProfile: SetupProfile;
  setSetupProfile: (updates: Partial<SetupProfile>) => void;
  markSetupStepComplete: (step: string) => void;
  markSetupComplete: () => void;
  // Reserve Women — Women's Performance OS
  womens: WomensState;
  setWomensEnabled: (enabled: boolean) => void;
  setWomensNutritionGoal: (goal: WomensNutritionGoal) => void;
  updateCycleProfile: (updates: Partial<CycleProfile>) => void;
  logCycleEntry: (entry: Omit<CycleLogEntry, "id">) => void;
  removeCycleEntry: (id: string) => void;
  updateFertilityModule: (updates: Partial<FertilityModuleState>) => void;
  updatePregnancyModule: (updates: Partial<PregnancyModuleState>) => void;
  // Module enablement / profile routing
  modulePreferences: ModulePreferences;
  setProfilePath: (path: ProfilePath | null) => void;
  setEnhancedLogOnly: (enabled: boolean) => void;
  setModuleOverride: (moduleId: string, enabled: boolean | null) => void;
  /** Member layout: explicit module order + pinned modules (persisted). */
  setModuleOrder: (order: string[]) => void;
  toggleModulePin: (moduleId: string) => void;
  resetModuleLayout: () => void;
  // Member-authored training plans (run alongside or instead of generated splits)
  customPlans: CustomWorkoutPlan[];
  activeCustomPlanId: string | null;
  saveCustomPlan: (plan: CustomWorkoutPlan) => void;
  deleteCustomPlan: (id: string) => void;
  setActiveCustomPlan: (id: string | null) => void;
  /** Mark a custom-plan session complete — records a real session card so
      custom training counts toward the same game-plan progress. */
  markCustomSessionComplete: (planId: string, dayId: string) => void;
  // Member-authored meal plans — the member's own plan runs instead of the generated one
  memberMealPlans: MemberMealPlan[];
  activeMemberMealPlanId: string | null;
  saveMemberMealPlan: (plan: MemberMealPlan) => void;
  deleteMemberMealPlan: (id: string) => void;
  setActiveMemberMealPlan: (id: string | null) => void;
  // Member-authored meals (estimated macros — estimates only, never claims)
  customMeals: CustomMeal[];
  saveCustomMeal: (meal: CustomMeal) => void;
  deleteCustomMeal: (id: string) => void;
  toggleCustomMealFavorite: (id: string) => void;
  // Hydration bar (browse / favorite / log — general wellness support only)
  hydrationFavorites: string[];
  hydrationDrinkLogs: HydrationLogEntry[];
  toggleHydrationFavorite: (drinkId: string) => void;
  logHydrationDrink: (entry: HydrationLogEntry) => void;
  // Weekly challenge / retention
  completedChallengeKeys: string[];
  toggleChallengeComplete: (key: string) => void;
  // Recovery Command V2
  recoveryCommand: RecoveryCommandState;
  logSleep: (entry: SleepLog) => void;
  logHydration: (entry: HydrationLog) => void;
  logMobility: (entry: MobilityLog) => void;
  /** Set today's step count (replaces any earlier count for that day). */
  logSteps: (date: string, steps: number) => void;
  logStressCheckIn: (entry: StressCheckIn) => void;
  toggleRecoverySuiteTool: (toolId: string) => void;
  updateRecoveryTargets: (updates: Partial<Pick<RecoveryCommandState, "sleepTargetHours" | "hydrationTargetOz" | "mobilityWeeklyTarget">>) => void;
  /** Takes back the most recent water log on this day (a mistaken pour). */
  undoLastHydration: (date: string) => void;
  /** Remembers the member's usual pour size. */
  setWaterPour: (oz: number) => void;
  // Member schedule profile (whole-day schedule awareness)
  scheduleProfile: MemberScheduleProfile;
  updateScheduleProfile: (updates: Partial<MemberScheduleProfile>) => void;
  updateMealWindow: (id: MealWindowId, updates: { time?: string; enabled?: boolean }) => void;
  // User training profile (gym environment + equipment intelligence)
  userTrainingProfile: UserTrainingProfile;
  updateUserTrainingProfile: (updates: Partial<UserTrainingProfile>) => void;
  // Active protocol (the operating system the rest of Reserve organizes around)
  activeProtocol: ActiveProtocol | null;
  /** Select + activate a protocol. Pass a definition or its id. */
  selectProtocol: (def: ProtocolDefinition | string, opts?: ActivateOptions) => void;
  /** Patch the active protocol (status, notes, goal, event). */
  updateActiveProtocol: (updates: Partial<ActiveProtocol>) => void;
  /** Move the active protocol through its lifecycle status. */
  setProtocolStatus: (status: ProtocolStatus) => void;
  /** Pause / resume / complete the active protocol (semantic lifecycle helpers). */
  pauseProtocol: () => void;
  resumeProtocol: () => void;
  completeProtocol: () => void;
  /** Clear the active protocol (back to no protocol selected). */
  clearProtocol: () => void;
  /* ─── Program horizon (the complete projected program) ─────────────────
     Persisted so a refresh restores the athlete's REAL program — the one
     carrying their applied revisions — rather than regenerating a pristine
     projection and silently discarding their history. */
  programHorizon: ProgramHorizonState;
  /** Store an updated horizon, optionally recording a new recurring activity. */
  setProgramHorizon: (horizon: ProgramHorizon, newRecurringActivity?: AthleteActivity) => void;
  /** Drop the stored horizon so the next read regenerates from the profile. */
  clearProgramHorizon: () => void;
  /** Remove a recurring activity and clear the horizon it shaped. */
  removeRecurringActivity: (activityId: string) => void;
  /* ─── Response Model (derived, but decisions are canonical) ────────────
     The insights themselves are rebuilt deterministically from the execution
     ledger, so only what CANNOT be rederived is persisted: the athlete's
     decisions, the insight history, and the processed-evidence marker. */
  responseModel: ResponseModelState;
  /** Persist a rebuilt model. Decisions on it are already merged. */
  setResponseModel: (model: AthleteResponseModel) => void;
  /** Record response events for the Decision Log. */
  appendResponseEvents: (events: ResponseEvent[]) => void;
  /** Persist a provisional or completed weekly response review. */
  setWeeklyResponseReview: (review: WeeklyResponseReview) => void;
  /** Clear the model so the next read rebuilds from the ledger. */
  clearResponseModel: () => void;
  // Split system selection (Split Architect — Reserve recommends, member can override)
  splitSystem: SplitSystemSelection;
  /** Select the split system the member runs (source: Reserve recommendation vs member override). */
  setSplitSystem: (key: string, source: SplitSystemSource, restDayIndex?: number | null) => void;
  /** Move the member's rest day (0 = Monday … 6 = Sunday); the split turns to meet it. */
  setSplitRestDay: (restDayIndex: number | null) => void;
  /** Clear the split-system selection (back to Reserve recommendation flow). */
  clearSplitSystem: () => void;
  /** The member's own day changes, layered on top of their split. */
  splitCustomization: SplitCustomization;
  /** What the member said each activity day actually trained, keyed by ISO date. */
  activityCoverage: Record<string, ActivityCoverage>;
  /** Change one day — just this date, or every week. `edit: null` clears it. */
  setSplitDayEdit: (input: SplitDayEditInput) => void;
  /** Several day changes in one update — e.g. moving today's session to tomorrow. */
  setSplitDayEdits: (inputs: SplitDayEditInput[]) => void;
  /** Remove every day change and return to the plan. */
  resetSplitCustomization: () => void;
  // Training overrides (session flex · missed-day · accidental start)
  trainingOverrides: Record<string, TrainingOverride>;
  /** Bounded audit trail. Active overrides live in `trainingOverrides`; replaced,
      completed, and cancelled records remain here for planned-vs-actual review. */
  trainingOverrideHistory: TrainingOverride[];
  /** Set a per-day training override (YYYY-MM-DD key). */
  setTrainingOverride: (
    dateKey: string,
    override: Omit<TrainingOverride, "id" | "status" | "originalDate" | "createdAt" | "updatedAt">,
  ) => void;
  /** Remove a per-day training override. */
  clearTrainingOverride: (dateKey: string) => void;
  // Bloodwork Log (log-only member records)
  bloodworkLogs: BloodworkLogRecord[];
  addBloodworkLog: (record: Omit<BloodworkLogRecord, "id" | "createdAt">) => void;
  removeBloodworkLog: (id: string) => void;

  // Cycle periods — the member's own stated plan
  cyclePeriods: CyclePeriod[];
  /** Returns the new cycle's id. */
  addCyclePeriod: (input: CycleInput) => string;
  updateCyclePeriod: (id: string, updates: Partial<CycleInput>) => void;
  endCyclePeriod: (id: string, reason: CycleEndReason, endedOn: string) => void;
  reopenCyclePeriod: (id: string) => void;
  removeCyclePeriod: (id: string) => void;
  addCycleCheckpoint: (cycleId: string, checkpoint: Omit<CycleCheckpoint, "id">) => void;
  removeCycleCheckpoint: (cycleId: string, checkpointId: string) => void;

  // Safety — acknowledgement and member-reported red-flag symptoms
  safetyAcknowledgement: SafetyAcknowledgement | null;
  acknowledgeSafety: () => void;
  redFlagReports: RedFlagReport[];
  addRedFlagReport: (flags: RedFlagKey[]) => void;
  removeRedFlagReport: (id: string) => void;

  // Cycle review — the member's goal per cycle, weekly check-ins, saved summaries
  cycleGoals: Record<string, CycleGoalSetup>;
  setCycleGoal: (cycleId: string, setup: Omit<CycleGoalSetup, "updatedAt">) => void;
  cycleCheckIns: CycleCheckIn[];
  /** Returns the new check-in's id. */
  addCycleCheckIn: (input: CycleCheckInInput) => string;
  removeCycleCheckIn: (id: string) => void;
  cycleReviewSnapshots: CycleReviewSnapshot[];
  saveCycleReviewSnapshot: (cycleId: string, text: string) => void;
  removeCycleReviewSnapshot: (id: string) => void;
  /** Supplements the member chose to track. Never added automatically. */
  supportPlan: SupportPlanItem[];
  /** Returns what was added, or null when it is already in the plan or the plan is full. */
  addSupportPlanItem: (optionKey: string) => AddedSupport | null;
  updateSupportPlanItem: (id: string, details: SupportPlanDetails) => void;
  removeSupportPlanItem: (id: string) => void;
  /** A supplement that is not in the library, by the member's own name. Returns what was added, or null for a blank or duplicate name. */
  addCustomSupportPlanItem: (title: string) => AddedSupport | null;
  /** Put support plan items the member chose onto their schedule, untimed. Returns how many were added and how many did not fit. */
  syncSupportPlanToSchedule: () => { added: number; skippedFull: number };
  // Timeline — how the plan changed, and the member's own notes and observations
  /** Written only by the actions that change a compound, support plan item or cycle. Newest first. */
  changeHistory: ChangeEvent[];
  /** Sync bookkeeping: when each slice and record last changed, and tombstones for removed records.
      Written by the change ledger (lib/sync/change-ledger.ts), never by member-facing actions. */
  syncLedger: SyncLedger;
  timelineNotes: TimelineNote[];
  /** Returns the new note's id, or null when the text is blank or the date is invalid. */
  addTimelineNote: (input: TimelineNoteInput) => string | null;
  updateTimelineNote: (id: string, updates: Partial<TimelineNoteInput>) => void;
  removeTimelineNote: (id: string) => void;
  observations: Observation[];
  /** Returns the new observation's id, or null when it is incomplete. */
  addObservation: (input: ObservationInput) => string | null;
  removeObservation: (id: string) => void;
  toggleObservationReview: (id: string) => void;
  // Physique Command V2
  physiqueCommand: PhysiqueCommandState;
  addPhysiqueEntry: (entry: Omit<PhysiqueEntry, "id">) => void;
  editPhysiqueEntry: (id: string, updates: Partial<Omit<PhysiqueEntry, "id">>) => void;
  deletePhysiqueEntry: (id: string) => void;
  addPhotoCheckIn: (checkIn: Omit<PhotoCheckIn, "id">) => void;
  deletePhotoCheckIn: (id: string) => void;
  setPhysiqueWeakPoints: (weakPoints: WeakPoint[]) => void;
  setPhysiqueGoal: (goal: PhysiqueGoalV2) => void;
  /* Member Muscle Priority (Focus Engine) — member-specific, never global. */
  setPhysiqueFocus: (focus: Partial<PhysiqueFocus>) => void;
  clearPhysiqueFocus: () => void;
  toggleSecondaryFocus: (muscle: MusclePriority) => void;
  /* Activity Stack — lifestyle / outside-training context (Pilates · yoga · sport). */
  activityStack: ActivityStack;
  activitySport: SportType | null;
  setActivityStack: (stack: ActivityStack, sport?: SportType | null) => void;
  /* Weekly commitments — the standing facts about her week. The activity stack
     above is eight preset bundles with no frequency and no days; these carry
     both, so "Pilates twice on Tue and Thu, track on Sat" is sayable. Setting
     them also derives the stack key, so she answers one question, not two. */
  weeklyCommitments: WeeklyCommitment[];
  setWeeklyCommitments: (commitments: WeeklyCommitment[]) => void;
  addWeeklyCommitment: (commitment: Omit<WeeklyCommitment, "id">) => void;
  removeWeeklyCommitment: (id: string) => void;
  /* Double Day — an opt-in morning session in front of the evening lift, on
     weekdays she names. Available to every member, on any split. */
  doubleDay: DoubleDay;
  setDoubleDay: (next: Partial<DoubleDay>) => void;
  toggleDoubleDayDay: (day: WeekdayIndex) => void;
  /** Reserve Athlete facility/amenity access (selected in Reserve Athlete onboarding). */
  reserveAthleteFacilities: FacilityAmenity[];
  setReserveAthleteFacilities: (amenities: FacilityAmenity[]) => void;
  /* Training experience — honest training level that scales session intensity. */
  trainingExperience: TrainingExperience;
  /** Member's chosen session-depth tier (Personal Command). Null until chosen —
      engines fall back to defaultWorkoutDemand(trainingAge). */
  workoutDemand: WorkoutDemandLevel | null;
  setWorkoutDemand: (level: WorkoutDemandLevel) => void;
  /** A session depth the member pinned to one declared cycle span. Null when
      they have not pinned one; cleared the day that span ends. Never set by
      Reserve, and never derived from a compound (lib/training/cycle-training-block). */
  trainingBlockIntent: TrainingBlockIntent | null;
  setTrainingBlockIntent: (intent: TrainingBlockIntent | null) => void;
  setTrainingExperience: (experience: TrainingExperience) => void;
  setActivityCoverage: (
    date: string,
    activity: SplitActivityKey,
    regions: readonly TrainingRegion[],
    minutes?: number,
  ) => void;
  /* Core timing — when the core block is placed in the session (auto = coach-smart). */
  coreTiming: CoreTiming;
  setCoreTiming: (timing: CoreTiming) => void;
  /* Movement preferences — Reserve learns avoid / hard-to-access / substitutes / favorites. */
  movementPreferences: MovementPreferences;
  setMovementPreference: (kind: "avoid" | "hardToAccess" | "favorites", movement: string, on: boolean) => void;
  setPreferredSubstitute: (movement: string, substitute: string | null) => void;
  clearMovementPreferences: () => void;
  /* Per-movement fatigue feedback — observational hooks for later intelligence. */
  movementFeedback: Record<string, MovementFeedback>;
  logMovementFeedback: (movement: string, kind: MovementFeedbackKind) => void;
  clearMovementFeedback: (movement?: string) => void;
  /* ── Program ownership — v16 source of truth for per-day authorship. ── */
  programOperatingMode: ProgramOperatingMode;
  setProgramOperatingMode: (mode: ProgramOperatingMode) => void;
  programs: ProgramDefinition[];
  activeProgramId: string | null;
  saveProgram: (program: ProgramDefinition) => void;
  saveProgramVersion: (program: ProgramDefinition) => void;
  saveProgramStructureVersion: (
    programId: string,
    days: ProgramDayDefinition[],
    updates?: Partial<Pick<ProgramDefinition, "name" | "description" | "rotationLengthDays" | "weekAnchor" | "scheduleId">>,
  ) => void;
  archiveProgram: (id: string, archived: boolean) => void;
  setActiveProgram: (id: string | null) => void;
  programDayVersions: ProgramDayDefinition[];
  programDayOverrides: ProgramDayOverride[];
  saveProgramDayChange: (payload: ProgramDayEditPayload) => void;
  setProgramDayLocked: (programId: string, dayId: string, locked: boolean) => void;
  restoreProgramDayVersion: (programId: string, dayId: string, versionId: string) => void;
  duplicateProgramDayVersion: (programId: string, dayId: string, versionId: string) => void;
  renameProgramDayVersion: (versionId: string, title: string) => void;
  restoreReserveOriginalDay: (programId: string, dayId: string) => void;
  archiveProgramDayVersion: (versionId: string, archived: boolean) => void;
  programRecommendationPreferences: ProgramRecommendationPreferences;
  updateProgramRecommendationPreferences: (updates: Partial<ProgramRecommendationPreferences>) => void;
  programRecommendationDecisions: ProgramRecommendationDecision[];
  recordProgramRecommendationDecision: (decision: Omit<ProgramRecommendationDecision, "id" | "at">) => void;
  importedProgramDrafts: ImportedProgramDraft[];
  saveImportedProgramDraft: (draft: ImportedProgramDraft) => void;
  archiveImportedProgramDraft: (id: string) => void;
  activateImportedProgramDraft: (id: string) => boolean;
  nutritionOwnership: NutritionOwnershipState;
  updateNutritionOwnership: (updates: Partial<NutritionOwnershipState>) => void;
  /** Launch/rebuild from the resolved program day. Active progress always wins. */
  startSessionFromProgramDay: (dateKey?: string, rebuild?: boolean) => boolean;
  /* ── Build Your Player — member-built lifestyle systems ─────────────────
     Versioned, member-owned, never silently overwritten. Reserve recommends;
     the member decides. (lib/lifestyle) */
  lifestyleSchedules: LifestyleSchedule[];
  activeLifestyleScheduleId: string | null;
  saveLifestyleSchedule: (schedule: LifestyleSchedule) => void;
  /** Save as a NEW version of the same lineage (originals stay restorable). */
  saveLifestyleScheduleVersion: (schedule: LifestyleSchedule) => void;
  deleteLifestyleSchedule: (id: string) => void;
  archiveLifestyleSchedule: (id: string, archived: boolean) => void;
  setActiveLifestyleSchedule: (id: string | null) => void;
  /* Week variants — a different program per calendar week. */
  weekAssignments: WeekAssignment[];
  assignWeek: (assignment: Omit<WeekAssignment, "assignedAt">) => void;
  clearWeekAssignment: (weekKey: string) => void;
  /* Planned vs actual — what really happened, checked off or auto-reconciled. */
  actualWeeks: ActualWeekRecord[];
  recordActualActivity: (weekKey: string, scheduleId: string | null, record: Omit<ActualActivityRecord, "id" | "recordedAt">) => void;
  removeActualActivity: (weekKey: string, recordId: string) => void;
  /* Member-built workout templates (slot-based, ranked recommendations). */
  customWorkoutTemplates: CustomWorkoutTemplate[];
  saveCustomWorkoutTemplate: (template: CustomWorkoutTemplate) => void;
  saveCustomWorkoutTemplateVersion: (template: CustomWorkoutTemplate) => void;
  deleteCustomWorkoutTemplate: (id: string) => void;
  /* Movement-selection history — chosen/rejected per slot; Reserve learns. */
  movementSelections: MovementSelectionRecord[];
  recordMovementSelection: (record: Omit<MovementSelectionRecord, "id" | "at">) => void;
  /** Start a REAL training session from a member-built template — same
      immutable snapshot lifecycle as generated sessions (resume while live,
      never regenerate). Returns false when a live session already exists. */
  startSessionFromCustomTemplate: (templateId: string) => boolean;
};

const SESSION_MODES = new Set<SessionMode>(["pre", "live", "complete", "closed"]);
const CLOSEOUT_ACCURACIES = new Set<CloseoutAccuracy>(["fully-logged", "operationally-accurate", "quick-closeout"]);
const LOG_ACCURACIES = new Set<LogAccuracy>(["fully-accurate", "mostly-accurate", "estimated"]);
const SESSION_COMPLETIONS = new Set<SessionCompletion>(["as-planned", "partial", "minimum-effective", "stopped-early"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArrayRecord<T>(value: unknown): Record<string, T[]> {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, T[]>>((acc, [key, entry]) => {
    if (Array.isArray(entry)) {
      acc[key] = entry.filter(Boolean) as T[];
    }
    return acc;
  }, {});
}

function normalizeTrainingSessionState(value: unknown): TrainingSessionState {
  const persisted = isRecord(value) ? (value as Partial<TrainingSessionState>) : {};
  const schedulePlan = isRecord(persisted.schedulePlan) ? persisted.schedulePlan : {};
  const sessionMode = SESSION_MODES.has(persisted.sessionMode as SessionMode)
    ? (persisted.sessionMode as SessionMode)
    : DEFAULT_TRAINING_SESSION.sessionMode;
  const closeoutAccuracy = CLOSEOUT_ACCURACIES.has(persisted.closeoutAccuracy as CloseoutAccuracy)
    ? (persisted.closeoutAccuracy as CloseoutAccuracy)
    : null;
  const logAccuracy = LOG_ACCURACIES.has(persisted.logAccuracy as LogAccuracy)
    ? (persisted.logAccuracy as LogAccuracy)
    : null;
  const sessionCompletion = SESSION_COMPLETIONS.has(persisted.sessionCompletion as SessionCompletion)
    ? (persisted.sessionCompletion as SessionCompletion)
    : null;

  const normalized: TrainingSessionState = {
    ...DEFAULT_TRAINING_SESSION,
    ...persisted,
    sessionMode,
    sessionId: typeof persisted.sessionId === "string" ? persisted.sessionId : null,
    startedAt: typeof persisted.startedAt === "string" ? persisted.startedAt : null,
    endedAt: typeof persisted.endedAt === "string" ? persisted.endedAt : null,
    closeoutAccuracy,
    logAccuracy,
    sessionCompletion,
    minimalLogging: Boolean(persisted.minimalLogging),
    workoutSets: normalizeArrayRecord<StoredLoggedSet>(persisted.workoutSets),
    liveSetReviews: normalizeArrayRecord<StoredSetReview>(persisted.liveSetReviews),
    substitutions: Array.isArray(persisted.substitutions)
      ? (persisted.substitutions.filter(Boolean) as StoredSubstitution[])
      : [],
    debriefSummary: isRecord(persisted.debriefSummary)
      ? (persisted.debriefSummary as TrainingDebriefSummary)
      : null,
    currentMovementId: typeof persisted.currentMovementId === "string" ? persisted.currentMovementId : null,
    // Legacy sessions carry no snapshot — keep null (renderer falls back to
    // the derived queue) instead of inventing metadata. Never drop progress.
    generation:
      isRecord(persisted.generation) && Array.isArray((persisted.generation as SessionGenerationSnapshot).movements)
        ? (persisted.generation as SessionGenerationSnapshot)
        : null,
    executionRecord: isRecord(persisted.executionRecord)
      ? (persisted.executionRecord as SessionExecutionRecord)
      : null,
    executionHistory: Array.isArray(persisted.executionHistory)
      ? (persisted.executionHistory.filter(isRecord) as SessionExecutionRecord[]).slice(-180)
      : [],
    weekExecutionSummaries: Array.isArray(persisted.weekExecutionSummaries)
      ? (persisted.weekExecutionSummaries.filter(isRecord) as WeekExecutionSummary[]).slice(-104)
      : [],
    decisionHistory: Array.isArray(persisted.decisionHistory)
      ? (persisted.decisionHistory.filter(isRecord) as ReserveDecisionRecord[]).slice(-240)
      : [],
    schedulePlan: {
      ...DEFAULT_SCHEDULE_PLAN,
      ...schedulePlan,
    },
    corePhaseStatus: normalizeSupportPhaseStatus(persisted.corePhaseStatus),
    conditioningPhaseStatus: normalizeSupportPhaseStatus(persisted.conditioningPhaseStatus),
    recoveryPhaseStatus: normalizeSupportPhaseStatus(persisted.recoveryPhaseStatus),
    handoffPhaseStatus: normalizeSupportPhaseStatus(persisted.handoffPhaseStatus),
    currentSupportPhase: normalizeSupportPhaseKey(persisted.currentSupportPhase),
    manualMovementSelection: Boolean(persisted.manualMovementSelection),
    selectedCardioOptionId: typeof persisted.selectedCardioOptionId === "string" ? persisted.selectedCardioOptionId : null,
    selectedRecoveryOptionId: typeof persisted.selectedRecoveryOptionId === "string" ? persisted.selectedRecoveryOptionId : null,
    recoveryPreferences: normalizeRecoveryPreferences(persisted.recoveryPreferences),
    sessionHistory: normalizeSessionIntelligenceArray(persisted.sessionHistory),
    trainingJournal: normalizeTrainingJournalArray(persisted.trainingJournal),
    enhancementLog: normalizeEnhancementLogArray(persisted.enhancementLog),
    enhancementAdherence: normalizeEnhancementAdherenceArray((persisted as Record<string, unknown>).enhancementAdherence),
    injectionLogs: normalizeInjectionLogArray((persisted as Record<string, unknown>).injectionLogs),
    compoundSupportLinks: normalizeCompoundSupportLinkArray((persisted as Record<string, unknown>).compoundSupportLinks),
  };

  const legacy = migrateLegacyExecutionHistory({
    sessionHistory: normalized.sessionHistory,
    trainingJournal: normalized.trainingJournal,
    existingRecords: normalized.executionHistory,
    existingDecisions: normalized.decisionHistory,
  });
  normalized.executionHistory = legacy.records;
  normalized.decisionHistory = legacy.decisions;

  // v18 active-session backfill: preserve the already-frozen generation and
  // replay only sets/substitutions that were genuinely persisted. Never infer
  // a prescription for sessions that did not carry one.
  if (!normalized.executionRecord && normalized.generation && normalized.startedAt && normalized.sessionId) {
    let execution = createStartedSessionExecution({
      id: normalized.sessionId,
      snapshot: normalized.generation,
      calendarDate: normalized.startedAt.slice(0, 10),
      startedAt: normalized.startedAt,
    });
    for (const [movementId, sets] of Object.entries(normalized.workoutSets)) {
      for (const set of sets) {
        const recorded = recordCompletedSet(execution, movementId, {
          setNumber: set.setNumber,
          completedReps: set.reps,
          completedLoad: set.load,
          loadUnit: set.loadUnit,
          completedDurationSeconds: set.completedDurationSeconds,
          completedDistanceMeters: set.completedDistanceMeters,
          actualRir: set.actualRir,
          actualRpe: set.actualRpe ?? set.intensity,
          completed: set.completed ?? true,
          failed: set.failed,
          pain: set.pain,
          notes: set.notes,
          completedAt: set.loggedAt,
        });
        execution = recorded.record;
      }
    }
    for (const substitution of normalized.substitutions) {
      execution = substituteExecutionMovement(
        execution,
        substitution.movementId,
        substitution.replacementName,
        substitution.reason ?? "Legacy substitution reason not recorded",
        substitution.selectedAt,
      ).record;
    }
    if (normalized.sessionMode === "complete" || normalized.sessionMode === "closed") {
      const finalStatus = normalized.sessionCompletion === "as-planned"
        ? "completed"
        : normalized.sessionCompletion === "stopped-early"
          ? "abandoned"
          : "partial";
      execution = finalizeSessionExecution(
        execution,
        finalStatus,
        normalized.endedAt ?? normalized.startedAt,
        { endReason: "Migrated from the canonical pre-ledger training session." },
      ).record;
      normalized.executionHistory = upsertExecutionRecord(normalized.executionHistory, execution);
    }
    normalized.executionRecord = execution;
  }

  // Repair derived summaries from canonical records and decisions on every
  // local or cloud rehydration. This keeps the migration idempotent and lets
  // accepted supplemental activities backfill without rewriting history.
  normalized.weekExecutionSummaries = normalized.weekExecutionSummaries.map((summary) =>
    summary.programId && Number.isInteger(summary.weekNumber) && Number.isFinite(summary.plannedSessionCount) && summary.plannedSessionCount > 0
      ? summarizeWeekExecution({
          programId: summary.programId,
          weekNumber: summary.weekNumber,
          plannedSessionCount: summary.plannedSessionCount,
          records: normalized.executionHistory,
          decisions: normalized.decisionHistory,
          createdAt: summary.createdAt,
        })
      : summary
  );

  return normalized;
}

function normalizePersistedStore(value: unknown): Partial<AthleteDashboardStore> {
  if (!isRecord(value)) {
    return { trainingSession: DEFAULT_TRAINING_SESSION };
  }

  const persisted = value as Partial<AthleteDashboardStore>;
  const normalized: Partial<AthleteDashboardStore> = {
    ...persisted,
    trainingSession: normalizeTrainingSessionState(persisted.trainingSession),
  };

  if (isRecord(persisted.profile)) {
    normalized.profile = {
      ...DEFAULT_PROFILE,
      ...persisted.profile,
    };
  }

  /* Honesty pass — sample values the defaults once shipped (readiness 84 /
     adherence 79, the women's recovery reserve 82 and its scores, habits and
     nutrition adherence) are cleared from saved state, but ONLY while they still
     equal the exact shipped sample. Value-matched and idempotent, so no persist
     version bump: it runs on every local and cloud rehydrate. */
  if (isRecord(persisted.engagement)) {
    normalized.engagement = clearUntouchedRetentionSample(persisted.engagement as RetentionState);
  }
  if (isRecord(persisted.womens)) {
    normalized.womens = clearUntouchedWomensSample(persisted.womens as WomensState);
  }
  if (isRecord(persisted.nutritionPrefs)) {
    const setup = isRecord(persisted.setupProfile) ? (persisted.setupProfile as Partial<SetupProfile>) : null;
    normalized.nutritionPrefs = clearUntouchedDefaultBodyweight(
      persisted.nutritionPrefs as NutritionPrefsState,
      Array.isArray(setup?.completedSteps) ? setup.completedSteps : null,
    );
  }

  /* v15 — Build Your Player slices: backfill to safe empty defaults so
     pre-v15 saves (local or cloud) rehydrate without data loss. */
  if (!Array.isArray(normalized.lifestyleSchedules)) normalized.lifestyleSchedules = [];
  if (typeof normalized.activeLifestyleScheduleId !== "string") normalized.activeLifestyleScheduleId = null;
  if (!Array.isArray(normalized.weekAssignments)) normalized.weekAssignments = [];
  if (!Array.isArray(normalized.actualWeeks)) normalized.actualWeeks = [];
  if (!Array.isArray(normalized.customWorkoutTemplates)) normalized.customWorkoutTemplates = [];
  if (!Array.isArray(normalized.movementSelections)) normalized.movementSelections = [];
  /* Timeline — history, notes and observations are plain member lists; anything else rehydrates empty. */
  if (!Array.isArray(normalized.changeHistory)) normalized.changeHistory = [];
  if ("syncLedger" in normalized) normalized.syncLedger = readLedger(normalized.syncLedger);
  if (!Array.isArray(normalized.timelineNotes)) normalized.timelineNotes = [];
  if (!Array.isArray(normalized.observations)) normalized.observations = [];

  const normalizedOverrides: Record<string, TrainingOverride> = {};
  if (isRecord(normalized.trainingOverrides)) {
    for (const [key, raw] of Object.entries(normalized.trainingOverrides)) {
      if (!isRecord(raw) || typeof raw.action !== "string" || typeof raw.originalSessionTitle !== "string") continue;
      const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : `${key}T12:00:00.000Z`;
      normalizedOverrides[key] = {
        ...(raw as unknown as TrainingOverride),
        id: typeof raw.id === "string" ? raw.id : `legacy-flex:${key}:${raw.action}`,
        status: (raw.status === "completed" || raw.status === "cancelled" ? raw.status : "active") as TrainingOverrideStatus,
        originalDate: typeof raw.originalDate === "string" ? raw.originalDate : key,
        createdAt,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt,
      };
    }
  }
  normalized.trainingOverrides = normalizedOverrides;
  normalized.trainingOverrideHistory = Array.isArray(normalized.trainingOverrideHistory)
    ? (normalized.trainingOverrideHistory as unknown[])
        .filter(isRecord)
        .map((raw) => {
          const originalDate = typeof raw.originalDate === "string" ? raw.originalDate : "legacy";
          const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString();
          return {
            ...(raw as unknown as TrainingOverride),
            id: typeof raw.id === "string" ? raw.id : `legacy-flex:${originalDate}:${String(raw.action ?? "unknown")}`,
            status: (raw.status === "completed" || raw.status === "cancelled" ? raw.status : "active") as TrainingOverrideStatus,
            originalDate,
            createdAt,
            updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt,
          };
        })
        .filter((entry) => typeof entry.action === "string" && typeof entry.originalSessionTitle === "string")
        .filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(-180)
    : [];

  /* v16 — program ownership. Additive defaults preserve every pre-v16
     schedule, template, session, and history record exactly as saved. */
  if (!["reserve-managed", "hybrid", "member-managed"].includes(normalized.programOperatingMode ?? "")) {
    normalized.programOperatingMode = "reserve-managed";
  }
  if (!Array.isArray(normalized.programs)) normalized.programs = [];
  if (typeof normalized.activeProgramId !== "string") normalized.activeProgramId = null;
  if (!Array.isArray(normalized.programDayVersions)) normalized.programDayVersions = [];
  if (!Array.isArray(normalized.programDayOverrides)) normalized.programDayOverrides = [];
  if (!Array.isArray(normalized.programRecommendationDecisions)) normalized.programRecommendationDecisions = [];
  if (!Array.isArray(normalized.importedProgramDrafts)) normalized.importedProgramDrafts = [];
  normalized.programRecommendationPreferences = {
    ...DEFAULT_PROGRAM_RECOMMENDATION_PREFERENCES,
    ...(isRecord(normalized.programRecommendationPreferences) ? normalized.programRecommendationPreferences : {}),
  };
  normalized.nutritionOwnership = {
    ...DEFAULT_NUTRITION_OWNERSHIP,
    ...(isRecord(normalized.nutritionOwnership) ? normalized.nutritionOwnership : {}),
  };

  normalized.programs = boundPrograms(
    (normalized.programs as ProgramDefinition[]).map((program) => ({
      ...program,
      days: [...new Map((program.days ?? []).map((day) => [day.id, day])).values()],
    })),
    normalized.activeProgramId ?? null,
  );
  normalized.programDayVersions = boundProgramDayHistory(
    [...new Map((normalized.programDayVersions as ProgramDayDefinition[]).map((day) => [day.id, day])).values()],
  );
  normalized.programDayOverrides = [
    ...new Map((normalized.programDayOverrides as ProgramDayOverride[]).map((override) => [
      `${override.date}:${override.programId}:${override.dayLineageId}`,
      override,
    ])).values(),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-90);
  normalized.weekAssignments = [
    ...new Map((normalized.weekAssignments as WeekAssignment[]).map((assignment) => [assignment.weekKey, assignment])).values(),
  ];
  normalized.actualWeeks = (normalized.actualWeeks as ActualWeekRecord[])
    .map((week) => ({
      ...week,
      records: [...new Map(week.records.map((record) => [record.sourceSessionId ?? record.sourceOverrideId ?? record.id, record])).values()],
    }))
    .slice(-26);

  return normalized;
}

/* ════════════════════════════════════════════════════════════════════════
   v14 BACKFILL — light up canonical fields for pre-consolidation users.
   ------------------------------------------------------------------------
   Older saves stored gender + schedule only inside profile.coachingProfile.
   This maps those legacy values onto the canonical slices the app reads,
   so existing members get a coherent, gendered, schedule-aware experience
   without being re-onboarded. Purely additive — never overwrites a value
   the member has already set on a canonical field.
   ════════════════════════════════════════════════════════════════════════ */
function backfillOnboardingCanonicals(
  state: Partial<AthleteDashboardStore>,
): Partial<AthleteDashboardStore> {
  const coaching = state.profile?.coachingProfile;
  if (!coaching) return state;
  const next: Partial<AthleteDashboardStore> = { ...state };

  // Gender → setupProfile.sex + modulePreferences.profilePath
  const gender = coaching.genderIdentity;
  if (gender) {
    const setup = next.setupProfile;
    if (setup && !setup.sex) {
      next.setupProfile = {
        ...setup,
        sex: gender === "custom" ? "other" : gender,
      };
    }
    const prefs = next.modulePreferences;
    if (prefs && prefs.profilePath == null) {
      next.modulePreferences = { ...prefs, profilePath: deriveProfilePath(gender) };
    }
    if (gender === "female" && next.womens && !next.womens.enabled) {
      next.womens = { ...next.womens, enabled: true };
    }
  }

  // Legacy coachingProfile.schedule → canonical trainingSession.schedulePlan
  const legacySchedule = coaching.schedule;
  if (legacySchedule && next.trainingSession) {
    const plan = next.trainingSession.schedulePlan;
    next.trainingSession = {
      ...next.trainingSession,
      schedulePlan: {
        ...plan,
        wakeTime: plan?.wakeTime || legacySchedule.wakeTime || plan?.wakeTime,
        sleepTime: plan?.sleepTime || legacySchedule.sleepTime || plan?.sleepTime,
      },
    };
  }

  return next;
}

/* Dev-only: automated/hidden preview contexts (headless browsers) suspend the
   compositor. This pins the preview's starting view from localStorage. Never
   active in production or for real visible tabs.

   APPLIED AFTER MOUNT, not during store creation — see `usePreviewInitialView`.
   It used to seed `activeView` in the initializer, which meant the server
   rendered `dashboard` while the client rendered whatever the key held, and
   React failed hydration and regenerated the whole tree. That made the QA
   harness test a client-regenerated page rather than the real hydration path,
   and the resulting error masked any genuine mismatch behind it.

   The original reason for seeding at init — post-mount navigation wedging on a
   suspended compositor — was fixed separately by the rAF shim in
   instrumentation-client.ts, and is verified working: navigating after mount
   now lands correctly. */
function previewInitialView(): DashboardView | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  if (!(navigator.webdriver || document.visibilityState === "hidden")) return null;
  try {
    return (window.localStorage.getItem("fba-preview-view") as DashboardView) || null;
  } catch {
    return null;
  }
}

/**
 * Applies the dev preview's pinned starting view once, after mount.
 *
 * Running this in an effect rather than in the store initializer is the whole
 * point: an effect runs only on the client, after hydration has already
 * matched, so reading localStorage here cannot desynchronise the two renders.
 */
export function usePreviewInitialView(): void {
  useEffect(() => {
    const view = previewInitialView();
    if (!view) return;
    const store = useAthleteDashboardStore.getState();
    if (store.activeView !== view) store.setActiveView(view);
    // Mount-only: this pins a STARTING view, and must never fight the member's
    // own navigation afterwards.
  }, []);
}

/** Persist version — also stamped into cloud envelopes by the sync engine.
    v19: live Response activity provenance and immutable weekly reviews.
    v17: complete Session Flex provenance/history and calendar reconciliation.
    v16: operating modes, versioned program/day ownership, overrides, imports,
    recommendation decisions, and nutrition ownership primitives. */
export const ATHLETE_STORE_PERSIST_VERSION = 19;

const MAX_DAY_VERSIONS_PER_LINEAGE = 12;
const MAX_PROGRAM_DAY_VERSIONS = 240;
const MAX_PROGRAM_VERSIONS_PER_LINEAGE = 8;
const MAX_TRAINING_OVERRIDE_HISTORY = 180;

function localDateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function withTrainingOverrideHistory(history: TrainingOverride[], ...records: TrainingOverride[]): TrainingOverride[] {
  const byId = new Map(history.map((record) => [record.id, record]));
  for (const record of records) byId.set(record.id, record);
  return [...byId.values()]
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(-MAX_TRAINING_OVERRIDE_HISTORY);
}

function boundProgramDayHistory(history: ProgramDayDefinition[]): ProgramDayDefinition[] {
  const byLineage = new Map<string, ProgramDayDefinition[]>();
  for (const day of history) {
    const group = byLineage.get(day.lineageId) ?? [];
    group.push(day);
    byLineage.set(day.lineageId, group);
  }
  return [...byLineage.values()]
    .flatMap((group) => group.sort((a, b) => a.version - b.version).slice(-MAX_DAY_VERSIONS_PER_LINEAGE))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(-MAX_PROGRAM_DAY_VERSIONS);
}

function withDayHistory(history: ProgramDayDefinition[], ...days: ProgramDayDefinition[]): ProgramDayDefinition[] {
  const byId = new Map(history.map((day) => [day.id, day]));
  for (const day of days) byId.set(day.id, day);
  return boundProgramDayHistory([...byId.values()]);
}

function nextProgramDayVersion(history: ProgramDayDefinition[], current: ProgramDayDefinition): number {
  return Math.max(current.version, ...history.filter((day) => day.lineageId === current.lineageId).map((day) => day.version), 0) + 1;
}

function boundPrograms(programs: ProgramDefinition[], activeProgramId: string | null): ProgramDefinition[] {
  const deduped = [...new Map(programs.map((program) => [program.id, program])).values()];
  const kept = new Set<string>();
  const lineages = new Set(deduped.map((program) => program.lineageId));
  for (const lineageId of lineages) {
    deduped
      .filter((program) => program.lineageId === lineageId)
      .sort((a, b) => b.version - a.version || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_PROGRAM_VERSIONS_PER_LINEAGE)
      .forEach((program) => kept.add(program.id));
  }
  if (activeProgramId) kept.add(activeProgramId);
  return deduped.filter((program) => kept.has(program.id));
}

export const useAthleteDashboardStore = create<AthleteDashboardStore>()(
  persist(
    (set, get) => ({
      /* Always "dashboard" so the server's render and the client's first
         render agree. The preview override is applied post-mount by
         `usePreviewInitialView`. */
      activeView: "dashboard",
      setActiveView: (activeView) => set({ activeView }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      trainingLaunchIntent: false,
      requestTrainingLaunch: () => set({ trainingLaunchIntent: true }),
      clearTrainingLaunchIntent: () => set({ trainingLaunchIntent: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      profile: DEFAULT_PROFILE,
      updateProfile: (updates) =>
        set((s) => ({ profile: { ...s.profile, ...updates } })),
      subscriptionTier: "core",
      setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
      onboarding: DEFAULT_ONBOARDING_STATE,
      startOnboarding: () =>
        set((s) => ({
          onboarding: {
            ...s.onboarding,
            status: "in-progress",
            startedAt: s.onboarding.startedAt ?? new Date().toISOString(),
          },
        })),
      completeOnboardingStep: (step) =>
        set((s) => {
          const completedSteps = s.onboarding.completedSteps.includes(step)
            ? s.onboarding.completedSteps
            : [...s.onboarding.completedSteps, step];
          const isComplete = step === "complete";

          return {
            onboarding: {
              ...s.onboarding,
              status: isComplete ? "complete" : "in-progress",
              currentStep: step,
              completedSteps,
              completedAt: isComplete ? new Date().toISOString() : s.onboarding.completedAt,
              startedAt: s.onboarding.startedAt ?? new Date().toISOString(),
            },
          };
        }),
      resetOnboarding: () => set({ onboarding: DEFAULT_ONBOARDING_STATE }),

      /**
       * Persist partial onboarding answers. Called on every field change and
       * on every step move, so the member never loses work to a refresh.
       * Stamped with updatedAt so a stale device cannot clobber newer answers.
       */
      saveOnboardingDraft: (answers, step) =>
        set((s) => ({
          onboarding: {
            ...s.onboarding,
            status: s.onboarding.status === "complete" ? "complete" : "in-progress",
            startedAt: s.onboarding.startedAt ?? new Date().toISOString(),
            draft: {
              // Omitting `step` keeps whichever step the draft already records,
              // so a field edit can never rewind the member to an earlier step.
              step: step ?? s.onboarding.draft?.step ?? 0,
              answers,
              version: ONBOARDING_DRAFT_VERSION,
              updatedAt: new Date().toISOString(),
            },
          },
        })),

      /** Drop the draft once its answers have been written to canonical slices. */
      clearOnboardingDraft: () =>
        set((s) => (s.onboarding.draft === null ? s : { onboarding: { ...s.onboarding, draft: null } })),

      writeOnboardingProfile: (payload) => {
        set((s) => {
          // ── Profile (merge, never wipe) ────────────────────────────────
          const profile: AthleteProfile = { ...s.profile, ...payload.profile };
          if (payload.persona) {
            profile.persona = payload.persona;
            profile.experienceLevel = payload.persona;
          }

          // ── Gender hardening — one stable source mirrored everywhere ────
          const genderIdentity = profile.coachingProfile?.genderIdentity;

          // ── Setup profile — merge + mirror sex + union completed steps ──
          const completedSteps = Array.from(
            new Set([
              ...s.setupProfile.completedSteps,
              ...(payload.completedSetupSteps ?? []),
            ]),
          );
          const setupProfile: SetupProfile = {
            ...s.setupProfile,
            ...payload.setupProfile,
            completedSteps,
            sex:
              payload.setupProfile?.sex ??
              (genderIdentity === "female"
                ? "female"
                : genderIdentity === "male"
                  ? "male"
                  : genderIdentity === "custom"
                    ? "other"
                    : s.setupProfile.sex),
            ...(payload.markSetupComplete
              ? { setupComplete: true, completedAt: new Date().toISOString() }
              : {}),
          };

          // ── Module path — derive from gender unless user already chose ──
          const profilePath =
            s.modulePreferences.profilePath ??
            (genderIdentity ? deriveProfilePath(genderIdentity) : null);
          const modulePreferences: ModulePreferences = {
            ...s.modulePreferences,
            profilePath,
          };

          // ── Daily schedule — ONE truth, both representations ───────────
          // scheduleIntent derives a fully coherent scheduleProfile (training
          // block + meal windows) AND keeps schedulePlan in lockstep, so the
          // meal engine can never anchor to a stale factory evening block.
          const derivedSchedule = payload.scheduleIntent
            ? deriveScheduleProfile(payload.scheduleIntent, s.scheduleProfile)
            : null;
          const trainingSession = (payload.schedulePlan || derivedSchedule)
            ? {
                ...s.trainingSession,
                schedulePlan: {
                  ...s.trainingSession.schedulePlan,
                  ...payload.schedulePlan,
                  ...(derivedSchedule
                    ? {
                        workoutTime: derivedSchedule.preferredTrainingStart,
                        wakeTime: derivedSchedule.wakeTime,
                        sleepTime: derivedSchedule.sleepTarget,
                      }
                    : {}),
                },
              }
            : s.trainingSession;

          // ── Women's experience — auto-enable for female members ────────
          const womens = {
            ...s.womens,
            enabled: genderIdentity === "female" ? true : s.womens.enabled,
            ...(payload.womensNutritionGoal
              ? {
                  nutritionGoal: payload.womensNutritionGoal,
                  nutrition: { ...s.womens.nutrition, goal: payload.womensNutritionGoal },
                }
              : {}),
          };

          // ── Protocol confirmation (optional) ───────────────────────────
          let activeProtocol = s.activeProtocol;
          let physiqueCommand = s.physiqueCommand;
          if (payload.protocolId) {
            const definition = getProtocol(payload.protocolId);
            if (definition) {
              activeProtocol = activateProtocol(definition, payload.protocolOptions ?? {});
              const currentFocus = s.physiqueCommand.focus ?? DEFAULT_PHYSIQUE_FOCUS;
              physiqueCommand = {
                ...s.physiqueCommand,
                focus: {
                  ...currentFocus,
                  track: definition.womensTrack ?? null,
                  updatedAt: new Date().toISOString(),
                },
              };
            }
          }

          // ── Onboarding status ──────────────────────────────────────────
          // The draft exists only to survive a refresh mid-wizard. Once these
          // answers land in the canonical slices it is redundant, and keeping
          // it would let a stale copy re-open a completed wizard.
          const onboarding = payload.completeOnboarding
            ? {
                ...s.onboarding,
                status: "complete" as const,
                currentStep: "complete" as const,
                completedSteps: s.onboarding.completedSteps.includes("complete")
                  ? s.onboarding.completedSteps
                  : [...s.onboarding.completedSteps, "complete" as const],
                completedAt: new Date().toISOString(),
                startedAt: s.onboarding.startedAt ?? new Date().toISOString(),
                draft: null,
              }
            : s.onboarding;

          return {
            profile,
            setupProfile,
            modulePreferences,
            trainingSession,
            womens,
            activeProtocol,
            physiqueCommand,
            onboarding,
            nutritionPrefs: payload.nutritionPrefs
              ? { ...s.nutritionPrefs, ...payload.nutritionPrefs }
              : s.nutritionPrefs,
            scheduleProfile:
              derivedSchedule ??
              (payload.scheduleProfile
                ? { ...s.scheduleProfile, ...payload.scheduleProfile }
                : s.scheduleProfile),
            userTrainingProfile: payload.userTrainingProfile
              ? { ...s.userTrainingProfile, ...payload.userTrainingProfile }
              : s.userTrainingProfile,
            trainingExperience: payload.trainingExperience ?? s.trainingExperience,
            activityStack: payload.activityStack ?? s.activityStack,
            activitySport:
              payload.activitySport !== undefined ? payload.activitySport : s.activitySport,
            subscriptionTier: payload.subscriptionTier ?? s.subscriptionTier,
          };
        });
        if (payload.completeOnboarding) requestSyncFlush("onboarding-complete");
      },

      settings: DEFAULT_PERSISTENT_SETTINGS,
      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),
      setPersona: (persona) =>
        set((s) => ({
          profile: {
            ...s.profile,
            persona,
            experienceLevel: persona,
          },
        })),
      engagement: DEFAULT_RETENTION_STATE,
      recordAppOpen: () =>
        set((s) => ({
          engagement: {
            ...s.engagement,
            events: [
              createEngagementEvent("app-opened", { activeView: s.activeView }),
              ...s.engagement.events,
            ].slice(0, 50),
          },
        })),
      recordModuleView: (view) =>
        set((s) => ({
          engagement: {
            ...s.engagement,
            events: [
              createEngagementEvent("module-viewed", { view }),
              ...s.engagement.events,
            ].slice(0, 50),
          },
        })),
      recordDailyCheckIn: (scores) =>
        set((s) => {
          const today = getDateKey();
          /* A saved date ahead of today is the old UTC key for this same evening. */
          const alreadyCheckedIn = s.engagement.lastCheckInDate === today || Boolean(s.engagement.lastCheckInDate && s.engagement.lastCheckInDate > today);
          const currentStreak = alreadyCheckedIn
            ? s.engagement.currentStreak
            : s.engagement.lastCheckInDate && isYesterday(s.engagement.lastCheckInDate, today)
              ? s.engagement.currentStreak + 1
              : 1;
          const completedMilestones = new Set(s.engagement.completedMilestones);
          completedMilestones.add("first-daily-check-in");
          if (currentStreak >= 3) completedMilestones.add("three-day-streak");
          const milestoneList = Array.from(completedMilestones);
          const readiness = scores?.readiness ?? s.engagement.weeklyReadinessScore;
          const adherence = scores?.adherence ?? s.engagement.adherenceScore;

          return {
            engagement: {
              ...s.engagement,
              currentStreak,
              bestStreak: Math.max(s.engagement.bestStreak, currentStreak),
              lastCheckInDate: today,
              weeklyReadinessScore: readiness,
              adherenceScore: adherence,
              activationScore: calculateActivationScore(milestoneList),
              completedMilestones: milestoneList,
              events: [
                /* Readiness and adherence ride along only when a real value exists. */
                createEngagementEvent("daily-check-in", {
                  streak: currentStreak,
                  ...(readiness != null ? { readiness } : {}),
                  ...(adherence != null ? { adherence } : {}),
                }),
                ...s.engagement.events,
              ].slice(0, 50),
            },
          };
        }),
      completeRetentionMilestone: (milestone) =>
        set((s) => {
          const completedMilestones = s.engagement.completedMilestones.includes(milestone)
            ? s.engagement.completedMilestones
            : [...s.engagement.completedMilestones, milestone];

          return {
            engagement: {
              ...s.engagement,
              completedMilestones,
              activationScore: calculateActivationScore(completedMilestones),
              events: [
                createEngagementEvent("milestone-completed", { milestone }),
                ...s.engagement.events,
              ].slice(0, 50),
            },
          };
        }),
      recordUpgradeIntent: (intent) =>
        set((s) => {
          const now = new Date().toISOString();
          const existing = s.engagement.upgradeIntents.find(
            (item) => item.feature === intent.feature && item.source === intent.source,
          );
          const upgradeIntents = existing
            ? s.engagement.upgradeIntents.map((item) =>
                item === existing
                  ? { ...item, count: item.count + 1, lastSeenAt: now }
                  : item,
              )
            : [{ ...intent, count: 1, lastSeenAt: now }, ...s.engagement.upgradeIntents];
          const completedMilestones = s.engagement.completedMilestones.includes("first-upgrade-intent")
            ? s.engagement.completedMilestones
            : ([
                ...s.engagement.completedMilestones,
                "first-upgrade-intent",
              ] satisfies RetentionMilestoneKey[]);

          return {
            engagement: {
              ...s.engagement,
              upgradeIntents,
              completedMilestones,
              activationScore: calculateActivationScore(completedMilestones),
              events: [
                createEngagementEvent("upgrade-intent", {
                  feature: intent.feature,
                  tier: intent.requiredTier,
                  source: intent.source,
                }),
                ...s.engagement.events,
              ].slice(0, 50),
            },
          };
        }),
      dismissEngagementPrompt: (promptId) =>
        set((s) => ({
          engagement: {
            ...s.engagement,
            prompts: s.engagement.prompts.map((prompt) =>
              prompt.id === promptId
                ? { ...prompt, dismissedAt: new Date().toISOString() }
                : prompt,
            ),
          },
        })),
      trainingSession: DEFAULT_TRAINING_SESSION,
      trainingResetSnapshot: null,
      startTrainingSession: (movementId, generation = null) =>
        set((s) => {
          const now = new Date().toISOString();
          // Resume existing live session — NEVER regenerate or re-snapshot.
          if (s.trainingSession.sessionMode === "live" && s.trainingSession.startedAt) {
            return {
              trainingSession: {
                ...s.trainingSession,
                currentMovementId: movementId ?? s.trainingSession.currentMovementId,
              },
            };
          }
          const sessionId = `reserve-${Date.now()}`;
          const executionRecord = generation
            ? createStartedSessionExecution({
                id: sessionId,
                snapshot: generation,
                calendarDate: now.slice(0, 10),
                startedAt: now,
              })
            : null;
          return {
            trainingSession: {
              ...s.trainingSession,
              sessionMode: "live",
              sessionId,
              startedAt: now,
              endedAt: null,
              closeoutAccuracy: null,
              logAccuracy: null,
              sessionCompletion: null,
              currentMovementId: movementId ?? null,
              // Freeze HOW this session was built — the cockpit renders from
              // this snapshot, immune to later settings changes.
              generation,
              executionRecord,
              workoutSets: {},
              liveSetReviews: {},
              substitutions: [],
              debriefSummary: null,
              corePhaseStatus: "pending",
              conditioningPhaseStatus: "pending",
              recoveryPhaseStatus: "pending",
              handoffPhaseStatus: "pending",
              currentSupportPhase: null,
              manualMovementSelection: false,
              selectedCardioOptionId: s.trainingSession.selectedCardioOptionId ?? null,
              selectedRecoveryOptionId: s.trainingSession.selectedRecoveryOptionId ?? null,
              recoveryPreferences: s.trainingSession.recoveryPreferences,
            },
          };
        }),
      rebuildLiveSession: (generation, firstMovementId = null) =>
        set((s) => {
          const logged = Object.values(s.trainingSession.workoutSets).reduce((n, sets) => n + sets.length, 0);
          // Immutability rule: once ANY set is logged the session is frozen —
          // rebuilding is only offered (and only works) at zero progress.
          if (s.trainingSession.sessionMode !== "live" || logged > 0) return s;
          const now = new Date().toISOString();
          const revisionId = `session-adjustment:${s.trainingSession.sessionId ?? now}`;
          const adjusted = s.trainingSession.executionRecord
            ? adjustStartedSession(s.trainingSession.executionRecord, generation, revisionId, now)
            : null;
          const decision = createReserveDecision({
            id: `decision:${revisionId}`,
            createdAt: now,
            category: "session-adjustment",
            source: "athlete",
            programId: generation.horizonProgramId ?? generation.programId,
            observation: "A frozen session existed with zero logged output.",
            decision: "Rebuilt the active prescription after the athlete explicitly requested it.",
            reason: "No completed work was discarded; the original started snapshot remains inspectable.",
            affectedSessionIds: s.trainingSession.sessionId ? [s.trainingSession.sessionId] : undefined,
            athleteDecision: "accepted",
            before: s.trainingSession.executionRecord?.startedSnapshot,
            after: generation,
          });
          return {
            trainingSession: {
              ...s.trainingSession,
              // Keep the same identity and original started snapshot. The
              // explicit rebuild is the adjusted snapshot for this record.
              generation: { ...generation, generationReason: "member-rebuild" },
              executionRecord: adjusted?.ok ? adjusted.record : s.trainingSession.executionRecord,
              decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, decision),
              currentMovementId: firstMovementId,
              workoutSets: {},
              liveSetReviews: {},
              substitutions: [],
              manualMovementSelection: false,
            },
          };
        }),
      acknowledgeGenerationChange: () =>
        set((s) => {
          if (!s.trainingSession.generation) return s;
          return {
            trainingSession: {
              ...s.trainingSession,
              generation: { ...s.trainingSession.generation, changeAcknowledgedAt: new Date().toISOString() },
            },
          };
        }),
      setCurrentTrainingMovement: (movementId) =>
        set((s) => ({
          trainingSession: { ...s.trainingSession, currentMovementId: movementId },
        })),
      setSupportPhaseStatus: (phase, status) =>
        set((s) => {
          const key: keyof TrainingSessionState =
            phase === "core" ? "corePhaseStatus"
            : phase === "conditioning" ? "conditioningPhaseStatus"
            : phase === "recovery" ? "recoveryPhaseStatus"
            : "handoffPhaseStatus";
          return {
            trainingSession: {
              ...s.trainingSession,
              [key]: status,
              currentSupportPhase:
                status === "due-now" || status === "pending"
                  ? phase
                  : s.trainingSession.currentSupportPhase === phase
                    ? null
                    : s.trainingSession.currentSupportPhase,
            },
          };
        }),
      setManualMovementSelection: (manual) =>
        set((s) => ({
          trainingSession: { ...s.trainingSession, manualMovementSelection: manual },
        })),
      setSelectedCardioOption: (optionId) =>
        set((s) => ({
          trainingSession: { ...s.trainingSession, selectedCardioOptionId: optionId },
        })),
      setSelectedRecoveryOption: (optionId) =>
        set((s) => ({
          trainingSession: { ...s.trainingSession, selectedRecoveryOptionId: optionId },
        })),
      updateRecoveryPreferences: (updates) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            recoveryPreferences: { ...s.trainingSession.recoveryPreferences, ...updates },
          },
        })),
      logTrainingSet: (entry) =>
        set((s) => {
          const existing = s.trainingSession.workoutSets[entry.movementId] ?? [];
          const loggedAt = new Date().toISOString();
          const stored: StoredLoggedSet = { ...entry, loggedAt };
          // Ensure session is live the moment a set is logged
          const startedAt = s.trainingSession.startedAt ?? loggedAt;
          const execution = s.trainingSession.executionRecord
            ? recordCompletedSet(s.trainingSession.executionRecord, entry.movementId, {
                setNumber: entry.setNumber,
                completedReps: entry.reps,
                completedLoad: entry.load,
                loadUnit: entry.loadUnit,
                completedDurationSeconds: entry.completedDurationSeconds,
                completedDistanceMeters: entry.completedDistanceMeters,
                actualRir: entry.actualRir,
                actualRpe: entry.actualRpe ?? entry.intensity,
                completed: entry.completed ?? true,
                failed: entry.failed,
                pain: entry.pain,
                notes: entry.notes,
                completedAt: loggedAt,
              })
            : null;
          return {
            trainingSession: {
              ...s.trainingSession,
              sessionMode: s.trainingSession.sessionMode === "pre" ? "live" : s.trainingSession.sessionMode,
              startedAt,
              executionRecord: execution?.ok ? execution.record : s.trainingSession.executionRecord,
              workoutSets: {
                ...s.trainingSession.workoutSets,
                [entry.movementId]: [...existing, stored],
              },
              liveSetReviews: entry.review
                ? {
                    ...s.trainingSession.liveSetReviews,
                    [entry.movementId]: [
                      ...(s.trainingSession.liveSetReviews[entry.movementId] ?? []),
                      entry.review,
                    ],
                  }
                : s.trainingSession.liveSetReviews,
            },
          };
        }),
      editTrainingSet: (movementId, setNumber, updates) =>
        set((s) => {
          const existing = s.trainingSession.workoutSets[movementId] ?? [];
          const updatedAt = new Date().toISOString();
          const execution = s.trainingSession.executionRecord
            ? editExecutionSet(s.trainingSession.executionRecord, movementId, setNumber, {
                completedReps: updates.reps,
                completedLoad: updates.load,
                actualRir: updates.actualRir,
                actualRpe: updates.actualRpe ?? updates.intensity,
                completed: updates.completed ?? true,
                failed: updates.failed,
                pain: updates.pain,
                notes: updates.notes,
              }, updatedAt)
            : null;
          return {
            trainingSession: {
              ...s.trainingSession,
              executionRecord: execution?.ok ? execution.record : s.trainingSession.executionRecord,
              workoutSets: {
                ...s.trainingSession.workoutSets,
                [movementId]: existing.map((set) =>
                  set.setNumber === setNumber
                    ? {
                        ...set,
                        ...updates,
                        movementId,
                        setNumber,
                        loggedAt: updatedAt,
                      }
                    : set,
                ),
              },
              liveSetReviews: updates.review
                ? {
                    ...s.trainingSession.liveSetReviews,
                    [movementId]: (s.trainingSession.liveSetReviews[movementId] ?? []).map((review, index) =>
                      index === setNumber - 1 ? updates.review! : review,
                    ),
                  }
                : s.trainingSession.liveSetReviews,
            },
          };
        }),
      undoLastTrainingSet: (movementId) =>
        set((s) => {
          const existing = s.trainingSession.workoutSets[movementId] ?? [];
          if (existing.length === 0) return {};
          const execution = s.trainingSession.executionRecord
            ? removeLastCompletedSet(s.trainingSession.executionRecord, movementId)
            : null;
          return {
            trainingSession: {
              ...s.trainingSession,
              executionRecord: execution?.ok ? execution.record : s.trainingSession.executionRecord,
              workoutSets: {
                ...s.trainingSession.workoutSets,
                [movementId]: existing.slice(0, -1),
              },
              liveSetReviews: {
                ...s.trainingSession.liveSetReviews,
                [movementId]: (s.trainingSession.liveSetReviews[movementId] ?? []).slice(0, -1),
              },
            },
          };
        }),
      markTrainingSessionComplete: () =>
        set((s) => {
          const endedAt = new Date().toISOString();
          const finalized = s.trainingSession.executionRecord
            ? finalizeSessionExecution(s.trainingSession.executionRecord, "completed", endedAt)
            : null;
          const executionRecord = finalized?.ok ? finalized.record : s.trainingSession.executionRecord;
          return {
            trainingSession: {
              ...s.trainingSession,
              sessionMode: "complete",
              endedAt,
              closeoutAccuracy: s.trainingSession.closeoutAccuracy ?? "fully-logged",
              executionRecord,
              executionHistory: executionRecord?.integrity.completedRecordLockedAt
                ? upsertExecutionRecord(s.trainingSession.executionHistory, executionRecord)
                : s.trainingSession.executionHistory,
            },
          };
        }),
      closeOutTrainingSession: (accuracy, extras) => {
        set((s) => {
          const now = new Date();
          /* Planned-vs-actual reconciliation: a closed real session counts
             into the active lifestyle week automatically (autoFromSession). */
          let actualWeeks = s.actualWeeks;
          const weekKey = isoWeekKey(now);
          const weekAssignment = s.weekAssignments.find((assignment) => assignment.weekKey === weekKey);
          const activeSchedule = s.lifestyleSchedules.find(
            (x) => x.id === (weekAssignment?.scheduleId ?? s.activeLifestyleScheduleId),
          );
          const isoDate = localDateKey(now);
          const directOverride = s.trainingOverrides[isoDate];
          const inboundOverride = Object.values(s.trainingOverrides).find((override) =>
            override.action === "rescheduled" &&
            override.targetDate === isoDate &&
            override.status !== "cancelled",
          );
          const sessionOverride = inboundOverride ?? directOverride;
          if (s.trainingSession.startedAt) {
            const dayIdx = activeSchedule ? rotationIndexForDate(activeSchedule, isoDate) : null;
            const scheduledTraining = dayIdx === null
              ? []
              : activeSchedule?.activities.filter(
                  (activity) => activity.dayIndex === dayIdx && TRAINING_ACTIVITY_TYPES.has(activity.type),
                ) ?? [];
            const planned = scheduledTraining.find(
              (activity) => activity.programDayId === s.trainingSession.generation?.programDayLineageId,
            ) ?? scheduledTraining[0];
            const sessionTitle =
              (s.trainingSession.generation?.splitTitle as string | undefined) ?? "Training Session";
            const completion = extras?.sessionCompletion ?? s.trainingSession.sessionCompletion;
            const record: ActualActivityRecord = {
              id: lifestyleId("actual"),
              date: isoDate,
              plannedActivityId: planned?.id,
              type: planned?.type ?? "strength",
              title: sessionTitle,
              status: completion === "as-planned" ? "completed" : "partial",
              recordedAt: now.toISOString(),
              autoFromSession: true,
              sourceSessionId: s.trainingSession.sessionId ?? undefined,
              programId: s.trainingSession.generation?.horizonProgramId ?? s.trainingSession.generation?.programId,
              programVersion: s.trainingSession.generation?.programVersion,
              programDayId: s.trainingSession.generation?.programDayId,
              programDayVersion: s.trainingSession.generation?.programDayVersion,
              programDayOwnership: s.trainingSession.generation?.programDayOwnership,
              sourceWorkoutTemplateId: s.trainingSession.generation?.sourceWorkoutTemplateId,
              completedSets: Object.values(s.trainingSession.workoutSets).reduce((sum, sets) => sum + sets.length, 0),
              durationMinutes: s.trainingSession.startedAt
                ? Math.max(0, Math.round((now.getTime() - new Date(s.trainingSession.startedAt).getTime()) / 60_000))
                : undefined,
              completedSetsByMovement: Object.fromEntries(
                Object.entries(s.trainingSession.workoutSets).map(([movementId, sets]) => [movementId, sets.length]),
              ),
              substitutedFromActivityId:
                sessionOverride?.action === "swapped" || sessionOverride?.action === "rescheduled"
                  ? sessionOverride.originalProgramDayId ?? sessionOverride.originalSessionId
                  : undefined,
            };
            const existing = actualWeeks.find((w) => w.weekKey === weekKey);
            const alreadyRecorded = existing?.records.some(
              (r) => r.autoFromSession && r.sourceSessionId === record.sourceSessionId,
            );
            if (!alreadyRecorded) {
              actualWeeks = existing
                ? actualWeeks.map((w) =>
                    w.weekKey === weekKey ? { ...w, records: [...w.records, record] } : w,
                  )
                : [...actualWeeks, { weekKey, scheduleId: activeSchedule?.id ?? null, records: [record] }];
              actualWeeks = actualWeeks.slice(-26);
            }
          }
          const completedOverride = sessionOverride
            ? { ...sessionOverride, status: "completed" as const, completedAt: now.toISOString(), updatedAt: now.toISOString() }
            : null;
          const completion = extras?.sessionCompletion ?? s.trainingSession.sessionCompletion;
          const finalStatus = completion === "as-planned"
            ? "completed"
            : completion === "stopped-early"
              ? "abandoned"
              : "partial";
          const finalized = s.trainingSession.executionRecord
            ? finalizeSessionExecution(
                s.trainingSession.executionRecord,
                finalStatus,
                now.toISOString(),
                {
                  athleteNotes: s.trainingSession.executionRecord.sessionMetrics.athleteNotes ?? s.trainingSession.debriefSummary?.summary,
                  endReason: completion ? `Athlete closeout: ${completion}.` : "Athlete closed the session.",
                },
              )
            : null;
          const executionRecord = finalized?.ok ? finalized.record : s.trainingSession.executionRecord;
          const executionHistory = executionRecord?.integrity.completedRecordLockedAt
            ? upsertExecutionRecord(s.trainingSession.executionHistory, executionRecord)
            : s.trainingSession.executionHistory;
          const executionWeek = executionRecord?.programId && executionRecord.weekNumber != null
            ? s.programHorizon.horizon?.weeks.find((week) => week.weekNumber === executionRecord.weekNumber)
            : null;
          const plannedSessionCount = executionWeek
            ? executionWeek.weeklyStructure.filter((day) => !day.recovery).length
            : 0;
          const weekSummary = executionRecord?.programId && executionRecord.weekNumber != null && plannedSessionCount > 0
            ? summarizeWeekExecution({
                programId: executionRecord.programId,
                weekNumber: executionRecord.weekNumber,
                plannedSessionCount,
                records: executionHistory,
                decisions: s.trainingSession.decisionHistory,
                createdAt: now.toISOString(),
              })
            : null;
          const weekExecutionSummaries = weekSummary
            ? upsertWeekExecutionSummary(s.trainingSession.weekExecutionSummaries, weekSummary)
            : s.trainingSession.weekExecutionSummaries;
          const closesHorizonWeek = Boolean(
            weekSummary &&
            (weekSummary.status === "completed" || weekSummary.status === "completed-with-deviations") &&
            s.programHorizon.horizon?.programId === weekSummary.programId,
          );
          return {
            actualWeeks,
            programHorizon: closesHorizonWeek && weekSummary
              ? {
                  ...s.programHorizon,
                  horizon: {
                    ...s.programHorizon.horizon!,
                    weeks: s.programHorizon.horizon!.weeks.map((week) =>
                      week.weekNumber === weekSummary.weekNumber ? { ...week, status: "completed" as const } : week,
                    ),
                  },
                  updatedAt: now.toISOString(),
                }
              : s.programHorizon,
            trainingOverrides: completedOverride
              ? Object.fromEntries(Object.entries(s.trainingOverrides).map(([key, override]) => [
                  key,
                  override.id === completedOverride.id ? completedOverride : override,
                ]))
              : s.trainingOverrides,
            trainingOverrideHistory: completedOverride
              ? withTrainingOverrideHistory(s.trainingOverrideHistory, completedOverride)
              : s.trainingOverrideHistory,
            programDayOverrides: s.programDayOverrides.map((override) =>
              override.status === "active" &&
              override.date === isoDate &&
              override.dayLineageId === s.trainingSession.generation?.programDayLineageId
                ? { ...override, status: "used" as const, usedAt: now.toISOString() }
                : override,
            ),
            trainingSession: {
              ...s.trainingSession,
              sessionMode: "closed",
              endedAt: now.toISOString(),
              closeoutAccuracy: accuracy,
              logAccuracy: extras?.logAccuracy ?? s.trainingSession.logAccuracy,
              sessionCompletion: extras?.sessionCompletion ?? s.trainingSession.sessionCompletion,
              executionRecord,
              executionHistory,
              weekExecutionSummaries,
            },
          };
        });
        /* The member closed a session: the shell acknowledges it (signal-bus.ts). */
        emitSignal("training");
      },
      recordTrainingSubstitution: (entry) =>
        set((s) => {
          const selectedAt = new Date().toISOString();
          const substitution = { ...entry, selectedAt };
          const execution = s.trainingSession.executionRecord
            ? substituteExecutionMovement(
                s.trainingSession.executionRecord,
                entry.movementId,
                entry.replacementName,
                entry.reason ?? "Reason not recorded",
                selectedAt,
              )
            : null;
          const decision = createReserveDecision({
            createdAt: selectedAt,
            category: entry.reason === "joint-discomfort" ? "pain-adjustment" : "exercise-substitution",
            source: "athlete",
            programId: s.trainingSession.executionRecord?.programId ?? undefined,
            observation: `${s.trainingSession.executionRecord?.movements.find((movement) => movement.id === entry.movementId)?.plannedName ?? entry.movementId} was replaced during execution.`,
            decision: `Performed ${entry.replacementName} instead of the planned movement.`,
            reason: entry.reason ?? "Athlete did not provide a reason.",
            affectedSessionIds: s.trainingSession.sessionId ? [s.trainingSession.sessionId] : undefined,
            athleteDecision: "accepted",
            before: s.trainingSession.executionRecord?.movements.find((movement) => movement.id === entry.movementId),
            after: { replacementName: entry.replacementName, equipment: entry.equipment, preservesStimulus: entry.preservesStimulus },
          });
          return {
            trainingSession: {
              ...s.trainingSession,
              executionRecord: execution?.ok ? execution.record : s.trainingSession.executionRecord,
              decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, decision),
              substitutions: [substitution, ...s.trainingSession.substitutions].slice(0, 20),
            },
          };
        }),
      skipTrainingMovement: (movementId, reason) => {
        let changed = false;
        set((s) => {
          if (!s.trainingSession.executionRecord) return {};
          const execution = skipExecutionMovement(s.trainingSession.executionRecord, movementId, reason);
          changed = execution.ok;
          return execution.ok
            ? { trainingSession: { ...s.trainingSession, executionRecord: execution.record } }
            : {};
        });
        return changed;
      },
      removeTrainingMovement: (movementId, reason) => {
        let changed = false;
        set((s) => {
          if (!s.trainingSession.executionRecord) return {};
          const execution = removePlannedMovement(s.trainingSession.executionRecord, movementId, reason);
          changed = execution.ok;
          return execution.ok
            ? { trainingSession: { ...s.trainingSession, executionRecord: execution.record } }
            : {};
        });
        return changed;
      },
      addTrainingMovement: (entry) => {
        const id = entry.id ?? lifestyleId("athlete-added-movement");
        let changed = false;
        set((s) => {
          if (!s.trainingSession.executionRecord) return {};
          const execution = addExecutionMovement(s.trainingSession.executionRecord, { ...entry, id });
          changed = execution.ok;
          return execution.ok
            ? { trainingSession: { ...s.trainingSession, executionRecord: execution.record } }
            : {};
        });
        return changed ? id : null;
      },
      logAddedTrainingSet: (movementId, entry) => {
        let changed = false;
        set((s) => {
          const record = s.trainingSession.executionRecord;
          if (!record) return {};
          const movement = record.addedMovements.find((candidate) => candidate.id === movementId);
          if (!movement) return {};
          const setNumber = entry.setNumber ?? movement.completedSets.length + 1;
          const execution = recordCompletedSet(record, movementId, { ...entry, setNumber });
          changed = execution.ok;
          return execution.ok
            ? { trainingSession: { ...s.trainingSession, executionRecord: execution.record } }
            : {};
        });
        return changed;
      },
      updateTrainingExecutionMetrics: (updates) => {
        let changed = false;
        set((s) => {
          if (!s.trainingSession.executionRecord) return {};
          const execution = updateExecutionMetrics(s.trainingSession.executionRecord, updates);
          changed = execution.ok;
          return execution.ok
            ? { trainingSession: { ...s.trainingSession, executionRecord: execution.record } }
            : {};
        });
        return changed;
      },
      recordPlannedSessionOutcome: (input) => {
        const programKey = input.snapshot.horizonProgramId ?? input.snapshot.programId ?? input.snapshot.architectureId;
        const dayKey = input.snapshot.horizonDayIndex ?? input.snapshot.programDayId ?? input.snapshot.splitTitle;
        const id = `planned:${programKey}:${input.calendarDate}:${dayKey}`;
        let recorded = false;
        set((s) => {
          if (s.trainingSession.executionHistory.some((record) => record.id === id)) return {};
          let record = createPlannedSessionExecution({
            id,
            snapshot: input.snapshot,
            calendarDate: input.calendarDate,
            source: input.outcome === "replaced" ? "replacement-activity" : undefined,
            replacementActivityId: input.replacementActivityId,
            adjustmentRevisionId: input.adjustmentRevisionId,
          });
          record.skipReason = input.outcome === "skipped" ? input.reason : undefined;
          record.skipSource = input.outcome === "skipped" ? "athlete" : undefined;
          record.reschedulingOffered = input.reschedulingOffered;
          record.reconciliationProposal = input.reconciliationProposal;
          record.athleteConfirmedReplacement = input.athleteConfirmed;
          record.nutritionAdjustment = input.nutritionAdjustment;
          record.recoveryAdjustment = input.recoveryAdjustment;
          record.affectedFutureDays = input.affectedFutureDays;
          const transitioned = transitionSessionStatus(record, input.outcome, new Date().toISOString(), input.reason);
          if (!transitioned.ok) return {};
          record = transitioned.record;
          const history = upsertExecutionRecord(s.trainingSession.executionHistory, record);
          const executionWeek = record.programId && record.weekNumber != null
            ? s.programHorizon.horizon?.weeks.find((week) => week.weekNumber === record.weekNumber)
            : null;
          const plannedSessionCount = executionWeek
            ? executionWeek.weeklyStructure.filter((day) => !day.recovery).length
            : 0;
          const decision = createReserveDecision({
            category: input.outcome === "replaced" ? "activity-reconciliation" : "athlete-decision",
            source: "athlete",
            programId: record.programId ?? undefined,
            observation: `${record.plannedSnapshot?.splitTitle ?? "Planned session"} was ${input.outcome}.`,
            decision: input.outcome === "replaced"
              ? `Preserved the original session and linked replacement activity ${input.replacementActivityId ?? "unlinked"}.`
              : "Recorded the planned session as skipped without completion credit.",
            reason: input.reason,
            affectedWeekNumbers: record.weekNumber != null ? [record.weekNumber] : undefined,
            affectedSessionIds: [record.id],
            athleteDecision: input.athleteConfirmed === false ? "declined" : "accepted",
          });
          const decisionHistory = appendReserveDecision(s.trainingSession.decisionHistory, decision);
          const weekSummary = record.programId && record.weekNumber != null && plannedSessionCount > 0
            ? summarizeWeekExecution({
                programId: record.programId,
                weekNumber: record.weekNumber,
                plannedSessionCount,
                records: history,
                decisions: decisionHistory,
              })
            : null;
          recorded = true;
          return {
            trainingSession: {
              ...s.trainingSession,
              executionHistory: history,
              weekExecutionSummaries: weekSummary
                ? upsertWeekExecutionSummary(s.trainingSession.weekExecutionSummaries, weekSummary)
                : s.trainingSession.weekExecutionSummaries,
              decisionHistory,
            },
          };
        });
        return recorded ? id : null;
      },
      recordReserveDecision: (input) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, createReserveDecision(input)),
          },
        })),
      refreshWeekExecutionSummary: (programId, weekNumber, plannedSessionCount) => {
        let summary = summarizeWeekExecution({ programId, weekNumber, plannedSessionCount, records: [] });
        set((s) => {
          summary = summarizeWeekExecution({
            programId,
            weekNumber,
            plannedSessionCount,
            records: s.trainingSession.executionHistory,
            decisions: s.trainingSession.decisionHistory,
          });
          const completed = summary.status === "completed" || summary.status === "completed-with-deviations";
          return {
            programHorizon: completed && s.programHorizon.horizon?.programId === programId
              ? {
                  ...s.programHorizon,
                  horizon: {
                    ...s.programHorizon.horizon,
                    weeks: s.programHorizon.horizon.weeks.map((week) =>
                      week.weekNumber === weekNumber ? { ...week, status: "completed" as const } : week,
                    ),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : s.programHorizon,
            trainingSession: {
              ...s.trainingSession,
              weekExecutionSummaries: upsertWeekExecutionSummary(s.trainingSession.weekExecutionSummaries, summary),
            },
          };
        });
        return summary;
      },
      saveTrainingDebriefSummary: (summary) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            debriefSummary: { ...summary, generatedAt: new Date().toISOString() },
          },
        })),
      resetTrainingSession: () =>
        set((s) => {
          const current = s.trainingSession.executionRecord;
          const abandoned = current && !current.integrity.completedRecordLockedAt
            ? finalizeSessionExecution(current, "abandoned", new Date().toISOString(), {
                endReason: "Active session was explicitly reset.",
              }).record
            : current;
          const executionHistory = abandoned?.integrity.completedRecordLockedAt
            ? upsertExecutionRecord(s.trainingSession.executionHistory, abandoned)
            : s.trainingSession.executionHistory;
          return {
            trainingSession: {
              ...DEFAULT_TRAINING_SESSION,
              executionHistory,
              weekExecutionSummaries: s.trainingSession.weekExecutionSummaries,
              decisionHistory: s.trainingSession.decisionHistory,
              schedulePlan: s.trainingSession.schedulePlan,
              minimalLogging: s.trainingSession.minimalLogging,
              recoveryPreferences: s.trainingSession.recoveryPreferences,
              selectedCardioOptionId: s.trainingSession.selectedCardioOptionId ?? null,
              selectedRecoveryOptionId: s.trainingSession.selectedRecoveryOptionId ?? null,
            },
          };
        }),
      resetTrainingSessionWithUndo: () =>
        set((s) => ({
          /* Snapshot the live session BEFORE reset so a test / accidental reset is undoable.
             No post-workout logic, debrief, meal timing, recovery handoff, or progression runs. */
          trainingResetSnapshot: s.trainingSession,
          trainingSession: {
            ...DEFAULT_TRAINING_SESSION,
            executionHistory: s.trainingSession.executionHistory,
            weekExecutionSummaries: s.trainingSession.weekExecutionSummaries,
            decisionHistory: s.trainingSession.decisionHistory,
            schedulePlan: s.trainingSession.schedulePlan,
            minimalLogging: s.trainingSession.minimalLogging,
            recoveryPreferences: s.trainingSession.recoveryPreferences,
            selectedCardioOptionId: s.trainingSession.selectedCardioOptionId ?? null,
            selectedRecoveryOptionId: s.trainingSession.selectedRecoveryOptionId ?? null,
          },
        })),
      undoTrainingReset: () =>
        set((s) => (s.trainingResetSnapshot
          ? { trainingSession: s.trainingResetSnapshot, trainingResetSnapshot: null }
          : s)),
      clearTrainingResetSnapshot: () =>
        set((s) => {
          const resetRecord = s.trainingResetSnapshot?.executionRecord;
          const finalized = resetRecord && !resetRecord.integrity.completedRecordLockedAt
            ? finalizeSessionExecution(resetRecord, "abandoned", new Date().toISOString(), {
                endReason: "The reset undo window was dismissed without restoring the active session.",
              })
            : null;
          const archived = finalized?.ok ? finalized.record : resetRecord;
          return {
            trainingResetSnapshot: null,
            trainingSession: archived?.integrity.completedRecordLockedAt
              ? {
                  ...s.trainingSession,
                  executionHistory: upsertExecutionRecord(s.trainingSession.executionHistory, archived),
                }
              : s.trainingSession,
          };
        }),
      toggleMinimalLogging: () =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            minimalLogging: !s.trainingSession.minimalLogging,
          },
        })),
      updateSchedulePlan: (updates) =>
        set((s) => {
          const schedulePlan = { ...s.trainingSession.schedulePlan, ...updates };
          // Shared fields propagate to the whole-day schedule so meal timing
          // always follows the real training time (never a stale window).
          const touchesShared =
            updates.workoutTime !== undefined ||
            updates.wakeTime !== undefined ||
            updates.sleepTime !== undefined;
          const scheduleProfile = touchesShared
            ? deriveScheduleProfile(
                {
                  wakeTime: schedulePlan.wakeTime,
                  sleepTime: schedulePlan.sleepTime,
                  explicitTrainingStart: schedulePlan.workoutTime,
                  trainingDaysPerWeek: s.scheduleProfile.trainingDaysPerWeek,
                },
                s.scheduleProfile,
              )
            : s.scheduleProfile;
          return {
            scheduleProfile,
            trainingSession: { ...s.trainingSession, schedulePlan },
          };
        }),
      appendSessionIntelligenceCard: (card) => {
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            sessionHistory: [card, ...(s.trainingSession.sessionHistory ?? [])].slice(0, 24),
          },
        }));
        requestSyncFlush("workout-complete");
      },
      appendTrainingJournalEntry: (entry) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            trainingJournal: [entry, ...(s.trainingSession.trainingJournal ?? [])].slice(0, 60),
          },
        })),
      addEnhancementEntry: (entry) =>
        set((s) => {
          const at = new Date();
          const now = at.toISOString();
          const stored: EnhancementEntry = {
            ...entry,
            id: `enh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: now,
            updatedAt: now,
          };
          return {
            trainingSession: {
              ...s.trainingSession,
              enhancementLog: [stored, ...(s.trainingSession.enhancementLog ?? [])].slice(0, ENHANCEMENT_LOG_LIMIT),
            },
            changeHistory: appendChangeEvents(s.changeHistory, [compoundEvent(stored, "added", at)]),
          };
        }),
      updateEnhancementEntry: (id, updates) =>
        set((s) => {
          const at = new Date();
          const log = s.trainingSession.enhancementLog ?? [];
          const before = log.find((item) => item.id === id);
          if (!before) return {};
          const after: EnhancementEntry = { ...before, ...updates, updatedAt: at.toISOString() };
          return {
            trainingSession: { ...s.trainingSession, enhancementLog: log.map((item) => (item.id === id ? after : item)) },
            changeHistory: appendChangeEvents(s.changeHistory, compoundUpdateEvents(before, after, at)),
          };
        }),
      removeEnhancementEntry: (id) =>
        set((s) => {
          const log = s.trainingSession.enhancementLog ?? [];
          const removed = log.find((item) => item.id === id);
          return {
            trainingSession: {
              ...s.trainingSession,
              enhancementLog: log.filter((item) => item.id !== id),
              enhancementAdherence: (s.trainingSession.enhancementAdherence ?? []).filter((item) => item.entryId !== id),
            },
            ...(removed ? { changeHistory: appendChangeEvents(s.changeHistory, [compoundEvent(removed, "removed", new Date())]) } : {}),
          };
        }),
      toggleEnhancementEntryActive: (id) =>
        set((s) => {
          const at = new Date();
          const log = s.trainingSession.enhancementLog ?? [];
          const before = log.find((item) => item.id === id);
          if (!before) return {};
          const after: EnhancementEntry = { ...before, isActive: !before.isActive, updatedAt: at.toISOString() };
          return {
            trainingSession: { ...s.trainingSession, enhancementLog: log.map((item) => (item.id === id ? after : item)) },
            changeHistory: appendChangeEvents(s.changeHistory, compoundUpdateEvents(before, after, at)),
          };
        }),
      logEnhancementAdherence: (record) =>
        set((s) => {
          const stored: EnhancementAdherenceRecord = {
            ...record,
            id: `adh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
          };
          const existing = (s.trainingSession.enhancementAdherence ?? []).filter(
            (r) => !(r.entryId === record.entryId && r.date === record.date && r.plannedTime === record.plannedTime),
          );
          return {
            trainingSession: {
              ...s.trainingSession,
              enhancementAdherence: [stored, ...existing].slice(0, 400),
            },
          };
        }),
      clearEnhancementAdherenceForDay: (date) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            enhancementAdherence: (s.trainingSession.enhancementAdherence ?? []).filter((r) => r.date !== date),
          },
        })),
      addInjectionLog: (record) =>
        set((s) => {
          const stored: InjectionLogRecord = {
            ...record,
            id: `inj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
          };
          return {
            trainingSession: {
              ...s.trainingSession,
              injectionLogs: [stored, ...(s.trainingSession.injectionLogs ?? [])].slice(0, 400),
            },
          };
        }),
      removeInjectionLog: (id) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            injectionLogs: (s.trainingSession.injectionLogs ?? []).filter((r) => r.id !== id),
          },
        })),
      addCompoundSupportLink: (link) =>
        set((s) => {
          const existing = s.trainingSession.compoundSupportLinks ?? [];
          if (existing.some((l) => l.parentEntryId === link.parentEntryId && l.supportEntryId === link.supportEntryId)) {
            return {};
          }
          return {
            trainingSession: {
              ...s.trainingSession,
              compoundSupportLinks: [link, ...existing].slice(0, 80),
            },
          };
        }),
      removeCompoundSupportLink: (parentEntryId, supportEntryId) =>
        set((s) => ({
          trainingSession: {
            ...s.trainingSession,
            compoundSupportLinks: (s.trainingSession.compoundSupportLinks ?? []).filter(
              (l) => !(l.parentEntryId === parentEntryId && l.supportEntryId === supportEntryId),
            ),
          },
        })),
      // Legacy aliases
      addEnhancementLogEntry: (entry) =>
        set((s) => {
          const at = new Date();
          const now = at.toISOString();
          const stored: EnhancementEntry = {
            ...entry,
            id: `enh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: now,
            updatedAt: now,
          };
          return {
            trainingSession: {
              ...s.trainingSession,
              enhancementLog: [stored, ...(s.trainingSession.enhancementLog ?? [])].slice(0, ENHANCEMENT_LOG_LIMIT),
            },
            changeHistory: appendChangeEvents(s.changeHistory, [compoundEvent(stored, "added", at)]),
          };
        }),
      updateEnhancementLogEntry: (id, updates) =>
        set((s) => {
          const at = new Date();
          const log = s.trainingSession.enhancementLog ?? [];
          const before = log.find((item) => item.id === id);
          if (!before) return {};
          const after: EnhancementEntry = { ...before, ...updates, updatedAt: at.toISOString() };
          return {
            trainingSession: { ...s.trainingSession, enhancementLog: log.map((item) => (item.id === id ? after : item)) },
            changeHistory: appendChangeEvents(s.changeHistory, compoundUpdateEvents(before, after, at)),
          };
        }),
      removeEnhancementLogEntry: (id) =>
        set((s) => {
          const log = s.trainingSession.enhancementLog ?? [];
          const removed = log.find((item) => item.id === id);
          return {
            trainingSession: { ...s.trainingSession, enhancementLog: log.filter((item) => item.id !== id) },
            ...(removed ? { changeHistory: appendChangeEvents(s.changeHistory, [compoundEvent(removed, "removed", new Date())]) } : {}),
          };
        }),

      nutritionPrefs: DEFAULT_NUTRITION_PREFS,
      setNutritionPrefs: (updates) =>
        set((s) => ({ nutritionPrefs: { ...s.nutritionPrefs, ...updates } })),
      addNutritionPurchase: (purchase) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            purchases: [...s.nutritionPrefs.purchases, { ...purchase, id: `np-${Date.now()}` }],
          },
        })),
      removeNutritionPurchase: (id) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            purchases: s.nutritionPrefs.purchases.filter((p) => p.id !== id),
          },
        })),
      addSignatureMeal: (meal) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: [
              ...s.nutritionPrefs.signatureMeals,
              { ...meal, id: `sig-${Date.now()}`, createdAt: localDateKey(new Date()) },
            ],
          },
        })),
      updateSignatureMeal: (id, updates) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: s.nutritionPrefs.signatureMeals.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          },
        })),
      removeSignatureMeal: (id) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: s.nutritionPrefs.signatureMeals.filter((m) => m.id !== id),
          },
        })),
      toggleSignatureMealFavorite: (id) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: s.nutritionPrefs.signatureMeals.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)),
          },
        })),
      toggleSignatureMealToday: (id) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: s.nutritionPrefs.signatureMeals.map((m) => (m.id === id ? { ...m, addedToday: !m.addedToday } : m)),
          },
        })),
      toggleSignatureMealRotation: (id) =>
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            signatureMeals: s.nutritionPrefs.signatureMeals.map((m) => (m.id === id ? { ...m, inRotation: !m.inRotation } : m)),
          },
        })),
      toggleLoggedMeal: (mealId) => {
        const adding = !get().nutritionPrefs.loggedMealIds.includes(mealId);
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            loggedMealIds: s.nutritionPrefs.loggedMealIds.includes(mealId)
              ? s.nutritionPrefs.loggedMealIds.filter((x) => x !== mealId)
              : [...s.nutritionPrefs.loggedMealIds, mealId],
          },
        }));
        /* Only a meal marked logged is acknowledged; clearing one is not a log. */
        if (adding) emitSignal("meal");
      },
      rolloverNutritionDay: (today) =>
        set((s) => {
          if (s.nutritionPrefs.nutritionLogDate === today) return s;
          const prevDate = s.nutritionPrefs.nutritionLogDate;
          /* The day used to be keyed to UTC, which runs ahead of US evenings. A saved
             date later than today is that UTC day for this same evening: adopt today's
             key and keep the member's log instead of archiving it early. */
          if (prevDate && prevDate > today) {
            return { nutritionPrefs: { ...s.nutritionPrefs, nutritionLogDate: today } };
          }
          const prevLogged = s.nutritionPrefs.loggedMealIds;
          /* Archive the prior day's logged ids so history is never lost, then reset
             today's daily log state (checkmarks + "added today" flags). The detailed
             nutrition history lives in the logging backend and is untouched. */
          const nutritionLogHistory = prevDate && prevLogged.length > 0
            ? { ...s.nutritionPrefs.nutritionLogHistory, [prevDate]: prevLogged }
            : s.nutritionPrefs.nutritionLogHistory;
          return {
            nutritionPrefs: {
              ...s.nutritionPrefs,
              nutritionLogDate: today,
              loggedMealIds: [],
              nutritionLogHistory,
              latestMealLog: null,
              signatureMeals: s.nutritionPrefs.signatureMeals.map((m) =>
                m.addedToday ? { ...m, addedToday: false } : m),
            },
          };
        }),
      confirmMealLog: (event) => {
        set((s) => ({
          nutritionPrefs: {
            ...s.nutritionPrefs,
            loggedMealIds: s.nutritionPrefs.loggedMealIds.includes(event.mealId)
              ? s.nutritionPrefs.loggedMealIds
              : [...s.nutritionPrefs.loggedMealIds, event.mealId],
            latestMealLog: event,
          },
        }));
        requestSyncFlush("meal-log");
        emitSignal("meal");
      },
      undoLastMealLog: () =>
        set((s) => {
          const last = s.nutritionPrefs.latestMealLog;
          if (!last) return s;
          return {
            nutritionPrefs: {
              ...s.nutritionPrefs,
              loggedMealIds: s.nutritionPrefs.loggedMealIds.filter((x) => x !== last.mealId),
              latestMealLog: null,
            },
          };
        }),

      setupProfile: DEFAULT_SETUP_PROFILE,
      setSetupProfile: (updates) =>
        set((s) => {
          const setupProfile = { ...s.setupProfile, ...updates };
          // An age under 18 withdraws the adult confirmation; raising it later means confirming again.
          const underAge = typeof updates.age === "number" && updates.age > 0 && updates.age < MIN_MEMBER_AGE;
          return underAge ? { setupProfile, safetyAcknowledgement: null } : { setupProfile };
        }),
      markSetupStepComplete: (step) =>
        set((s) => ({
          setupProfile: {
            ...s.setupProfile,
            completedSteps: s.setupProfile.completedSteps.includes(step)
              ? s.setupProfile.completedSteps
              : [...s.setupProfile.completedSteps, step],
          },
        })),
      markSetupComplete: () =>
        set((s) => ({ setupProfile: { ...s.setupProfile, setupComplete: true, completedAt: new Date().toISOString() } })),

      womens: DEFAULT_WOMENS_STATE,
      setWomensEnabled: (enabled) =>
        set((s) => ({ womens: { ...s.womens, enabled } })),
      setWomensNutritionGoal: (goal) =>
        set((s) => ({
          womens: {
            ...s.womens,
            nutritionGoal: goal,
            nutrition: { ...s.womens.nutrition, goal },
          },
        })),
      updateCycleProfile: (updates) =>
        set((s) => ({ womens: { ...s.womens, cycle: { ...s.womens.cycle, ...updates } } })),
      logCycleEntry: (entry) =>
        set((s) => ({
          womens: {
            ...s.womens,
            cycleLogs: [
              ...s.womens.cycleLogs,
              { ...entry, id: `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
            ],
          },
        })),
      removeCycleEntry: (id) =>
        set((s) => ({
          womens: { ...s.womens, cycleLogs: s.womens.cycleLogs.filter((l) => l.id !== id) },
        })),
      updateFertilityModule: (updates) =>
        set((s) => ({ womens: { ...s.womens, fertility: { ...s.womens.fertility, ...updates } } })),
      updatePregnancyModule: (updates) =>
        set((s) => ({ womens: { ...s.womens, pregnancy: { ...s.womens.pregnancy, ...updates } } })),

      modulePreferences: DEFAULT_MODULE_PREFERENCES,
      setModuleOrder: (order) =>
        set((s) => ({ modulePreferences: { ...s.modulePreferences, order } })),
      toggleModulePin: (moduleId) =>
        set((s) => ({
          modulePreferences: {
            ...s.modulePreferences,
            pinned: s.modulePreferences.pinned.includes(moduleId)
              ? s.modulePreferences.pinned.filter((id) => id !== moduleId)
              : [...s.modulePreferences.pinned, moduleId],
          },
        })),
      resetModuleLayout: () =>
        set((s) => ({ modulePreferences: { ...s.modulePreferences, order: [], pinned: [] } })),

      /* ── Member-authored training plans ─────────────────────────────── */
      customPlans: [],
      activeCustomPlanId: null,
      saveCustomPlan: (plan) => {
        set((s) => {
          const updated = { ...plan, updatedAt: new Date().toISOString() };
          const exists = s.customPlans.some((p) => p.id === plan.id);
          return {
            customPlans: exists
              ? s.customPlans.map((p) => (p.id === plan.id ? updated : p))
              : [...s.customPlans, updated],
          };
        });
        requestSyncFlush("custom-plan-save");
      },
      deleteCustomPlan: (id) =>
        set((s) => ({
          customPlans: s.customPlans.filter((p) => p.id !== id),
          activeCustomPlanId: s.activeCustomPlanId === id ? null : s.activeCustomPlanId,
        })),
      setActiveCustomPlan: (activeCustomPlanId) => set({ activeCustomPlanId }),
      markCustomSessionComplete: (planId, dayId) => {
        set((s) => {
          const plan = s.customPlans.find((p) => p.id === planId);
          const day = plan?.days.find((d) => d.id === dayId);
          if (!plan || !day) return s;
          const now = new Date();
          const card: SessionIntelligenceCard = {
            id: `custom-${now.getTime()}`,
            date: now.toISOString(),
            dateLabel: now.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            sessionName: day.title || "Custom Session",
            splitName: plan.name,
            weekLabel: "Custom Plan",
            phaseLabel: "Complete",
            rating: 8,
            completionStatus: "as-planned",
            completionLabel: "As planned",
            logAccuracy: "estimated",
            dataConfidence: "moderate",
            progressionDecision: "standard",
            improved: `${day.title || "Custom session"} completed from your own plan (${plan.name}).`,
            heldBack: "Set-level detail not captured — mark sets in a Reserve session for full progression data.",
            nextTen: "Keep the plan honest: beat one movement by a rep before adding load.",
            nutritionNext: "Protein anchor within your normal post-training window.",
            recoveryNote: "Standard wind-down — custom sessions count toward weekly training load.",
            momentum: 72,
          };
          return {
            trainingSession: {
              ...s.trainingSession,
              sessionHistory: [card, ...(s.trainingSession.sessionHistory ?? [])].slice(0, 24),
            },
          };
        });
        requestSyncFlush("workout-complete");
        if (get().customPlans.some((p) => p.id === planId && p.days.some((d) => d.id === dayId))) emitSignal("training");
      },

      /* ── Member-authored meal plans ─────────────────────────────────
         The member's own plan. While one is active it replaces the
         generated fuel plan everywhere; deleting the active one falls the
         member back to the generated plan rather than to nothing. */
      memberMealPlans: [],
      activeMemberMealPlanId: null,
      saveMemberMealPlan: (plan) => {
        set((s) => {
          const updated = { ...plan, updatedAt: new Date().toISOString() };
          const exists = s.memberMealPlans.some((p) => p.id === plan.id);
          return {
            memberMealPlans: exists
              ? s.memberMealPlans.map((p) => (p.id === plan.id ? updated : p))
              : [...s.memberMealPlans, updated],
          };
        });
        requestSyncFlush("meal-plan-save");
      },
      deleteMemberMealPlan: (id) => {
        set((s) => ({
          memberMealPlans: s.memberMealPlans.filter((p) => p.id !== id),
          activeMemberMealPlanId: s.activeMemberMealPlanId === id ? null : s.activeMemberMealPlanId,
        }));
        requestSyncFlush("meal-plan-save");
      },
      setActiveMemberMealPlan: (activeMemberMealPlanId) => {
        set({ activeMemberMealPlanId });
        requestSyncFlush("meal-plan-save");
      },

      /* ── Member-authored meals (estimates only) ─────────────────────── */
      customMeals: [],
      saveCustomMeal: (meal) => {
        set((s) => {
          const updated = { ...meal, updatedAt: new Date().toISOString() };
          const exists = s.customMeals.some((m) => m.id === meal.id);
          return {
            customMeals: exists
              ? s.customMeals.map((m) => (m.id === meal.id ? updated : m))
              : [...s.customMeals, updated],
          };
        });
        requestSyncFlush("custom-meal-save");
      },
      deleteCustomMeal: (id) =>
        set((s) => ({ customMeals: s.customMeals.filter((m) => m.id !== id) })),
      toggleCustomMealFavorite: (id) =>
        set((s) => ({
          customMeals: s.customMeals.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m)),
        })),

      /* ── Program ownership — every day is independently versioned. ──── */
      programOperatingMode: "reserve-managed",
      setProgramOperatingMode: (programOperatingMode) => {
        set((s) => ({
          programOperatingMode,
          programs: s.programs.map((program) =>
            program.id === s.activeProgramId
              ? { ...program, operatingMode: programOperatingMode, updatedAt: new Date().toISOString() }
              : program,
          ),
          nutritionOwnership: {
            ...s.nutritionOwnership,
            operatingMode: programOperatingMode,
            updatedAt: new Date().toISOString(),
          },
        }));
        requestSyncFlush("program-mode-change");
      },
      programs: [],
      activeProgramId: null,
      saveProgram: (program) => {
        set((s) => {
          const now = new Date().toISOString();
          const updated = { ...program, updatedAt: now };
          const exists = s.programs.some((candidate) => candidate.id === program.id);
          const programs = exists
            ? s.programs.map((candidate) => candidate.id === program.id ? updated : candidate)
            : [...s.programs, updated];
          return {
            programs: boundPrograms(programs, program.status === "active" ? program.id : s.activeProgramId),
            activeProgramId: program.status === "active" ? program.id : s.activeProgramId,
            programDayVersions: withDayHistory(s.programDayVersions, ...program.days),
          };
        });
        requestSyncFlush("program-save");
      },
      saveProgramVersion: (program) => {
        set((s) => {
          const now = new Date().toISOString();
          const lineage = s.programs.filter((candidate) => candidate.lineageId === program.lineageId);
          const nextVersion = Math.max(0, ...lineage.map((candidate) => candidate.version)) + 1;
          const id = lifestyleId("program");
          const days = program.days.map((day) => ({
            ...day,
            id: lifestyleId("pday"),
            programId: id,
            programVersion: nextVersion,
            sourceDayId: day.id,
            createdAt: now,
            updatedAt: now,
          }));
          const version: ProgramDefinition = {
            ...program,
            id,
            version: nextVersion,
            parentVersionId: program.id,
            status: "draft",
            days,
            createdAt: now,
            updatedAt: now,
          };
          const kept = boundPrograms([...s.programs, version], s.activeProgramId);
          return { programs: kept, programDayVersions: withDayHistory(s.programDayVersions, ...days) };
        });
        requestSyncFlush("program-save");
      },
      saveProgramStructureVersion: (programId, days, updates) => {
        set((s) => {
          const current = s.programs.find((program) => program.id === programId);
          if (!current) return {};
          const now = new Date().toISOString();
          const version = Math.max(
            current.version,
            ...s.programs.filter((program) => program.lineageId === current.lineageId).map((program) => program.version),
          ) + 1;
          const id = lifestyleId("program");
          const clonedDays = days.map((day, index) => ({
            ...day,
            id: lifestyleId("pday"),
            programId: id,
            programVersion: version,
            dayIndex: index,
            sourceDayId: day.id,
            createdAt: now,
            updatedAt: now,
          }));
          const next: ProgramDefinition = {
            ...current,
            ...updates,
            id,
            version,
            parentVersionId: current.id,
            status: "active",
            days: clonedDays,
            rotationLengthDays: Math.max(1, updates?.rotationLengthDays ?? clonedDays.length),
            createdAt: now,
            updatedAt: now,
          };
          return {
            programs: boundPrograms([
              ...s.programs.map((program) => program.id === current.id ? { ...program, status: "draft" as const } : program),
              next,
            ], next.id),
            activeProgramId: next.id,
            programDayVersions: withDayHistory(s.programDayVersions, ...clonedDays),
          };
        });
        requestSyncFlush("program-save");
      },
      archiveProgram: (id, archived) => {
        set((s) => ({
          programs: s.programs.map((program) =>
            program.id === id
              ? { ...program, status: archived ? "archived" : "draft", updatedAt: new Date().toISOString() }
              : program,
          ),
          activeProgramId: archived && s.activeProgramId === id ? null : s.activeProgramId,
        }));
        requestSyncFlush("program-save");
      },
      setActiveProgram: (id) => {
        set((s) => {
          const valid = id === null || s.programs.some((program) => program.id === id && program.status !== "archived");
          if (!valid) return {};
          return {
            activeProgramId: id,
            programs: s.programs.map((program) => ({
              ...program,
              status: program.id === id ? "active" : program.status === "active" ? "draft" : program.status,
            })),
          };
        });
        requestSyncFlush("program-activate");
      },
      programDayVersions: [],
      programDayOverrides: [],
      saveProgramDayChange: (payload) => {
        set((s) => {
          const program = s.programs.find((candidate) => candidate.id === payload.programId);
          const current = program?.days.find((candidate) => candidate.id === payload.dayId);
          if (!program || !current) return {};
          const now = new Date().toISOString();
          const nextVersion = nextProgramDayVersion(s.programDayVersions, current);
          const definition: ProgramDayDefinition = {
            ...current,
            ...payload.definition,
            id: lifestyleId("pday"),
            lineageId: current.lineageId,
            programId: program.id,
            programVersion: program.version,
            sourceDayId: current.id,
            reserveOriginalDayId:
              current.reserveOriginalDayId ?? (current.ownership === "reserve-original" ? current.id : undefined),
            parentVersionId: current.id,
            version: nextVersion,
            ownership: payload.definition.ownership === "reserve-original" ? "member-customized" : payload.definition.ownership,
            locked: payload.definition.locked ?? current.locked,
            preserveFromAiOverwrite:
              payload.definition.preserveFromAiOverwrite ?? current.preserveFromAiOverwrite,
            status: "active",
            createdAt: now,
            updatedAt: now,
          };

          if (payload.scope === "today-only") {
            const override: ProgramDayOverride = {
              id: lifestyleId("day-override"),
              date: payload.dateKey ?? now.slice(0, 10),
              programId: program.id,
              programVersion: program.version,
              dayLineageId: current.lineageId,
              sourceDayId: current.id,
              definition,
              status: "active",
              createdAt: now,
            };
            return {
              programDayOverrides: [
                ...s.programDayOverrides.filter((entry) =>
                  !(entry.date === override.date && entry.programId === override.programId && entry.dayLineageId === override.dayLineageId),
                ),
                override,
              ].slice(-90),
              programDayVersions: withDayHistory(s.programDayVersions, current, definition),
            };
          }

          if (payload.scope === "new-program-version") {
            const programVersion = Math.max(
              program.version,
              ...s.programs.filter((candidate) => candidate.lineageId === program.lineageId).map((candidate) => candidate.version),
            ) + 1;
            const programId = lifestyleId("program");
            const clonedDays = program.days.map((day) => {
              if (day.id === current.id) {
                return { ...definition, id: lifestyleId("pday"), programId, programVersion };
              }
              return {
                ...day,
                id: lifestyleId("pday"),
                programId,
                programVersion,
                sourceDayId: day.id,
                createdAt: now,
                updatedAt: now,
              };
            });
            const newProgram: ProgramDefinition = {
              ...program,
              id: programId,
              version: programVersion,
              parentVersionId: program.id,
              status: "active",
              days: clonedDays,
              createdAt: now,
              updatedAt: now,
            };
            return {
              programs: boundPrograms([
                ...s.programs.map((candidate) =>
                  candidate.id === program.id ? { ...candidate, status: "draft" as const } : candidate,
                ),
                newProgram,
              ], newProgram.id),
              activeProgramId: newProgram.id,
              programDayVersions: withDayHistory(s.programDayVersions, current, ...clonedDays),
            };
          }

          return {
            programs: s.programs.map((candidate) =>
              candidate.id === program.id
                ? {
                    ...candidate,
                    days: candidate.days.map((day) => day.id === current.id ? definition : day),
                    updatedAt: now,
                  }
                : candidate,
            ),
            lifestyleSchedules: s.lifestyleSchedules.map((schedule) => ({
              ...schedule,
              activities: schedule.activities.map((activity) =>
                activity.id === current.activityId || activity.programDayId === current.lineageId
                  ? {
                      ...activity,
                      programDayId: current.lineageId,
                      workoutTemplateId: definition.workoutTemplateId,
                      title: definition.title,
                    }
                  : activity,
              ),
            })),
            programDayVersions: withDayHistory(s.programDayVersions, current, definition),
          };
        });
        requestSyncFlush("program-day-save");
      },
      setProgramDayLocked: (programId, dayId, locked) => {
        set((s) => ({
          programs: s.programs.map((program) =>
            program.id === programId
              ? {
                  ...program,
                  days: program.days.map((day) =>
                    day.id === dayId
                      ? { ...day, locked, preserveFromAiOverwrite: locked, updatedAt: new Date().toISOString() }
                      : day,
                  ),
                }
              : program,
          ),
        }));
        requestSyncFlush("program-day-lock");
      },
      restoreProgramDayVersion: (programId, dayId, versionId) => {
        set((s) => {
          const program = s.programs.find((candidate) => candidate.id === programId);
          const current = program?.days.find((candidate) => candidate.id === dayId);
          const target = s.programDayVersions.find((candidate) => candidate.id === versionId);
          if (!program || !current || !target || target.lineageId !== current.lineageId) return {};
          const now = new Date().toISOString();
          const restored: ProgramDayDefinition = {
            ...target,
            id: lifestyleId("pday"),
            programId: program.id,
            programVersion: program.version,
            sourceDayId: target.id,
            parentVersionId: current.id,
            version: nextProgramDayVersion(s.programDayVersions, current),
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
          return {
            programs: s.programs.map((candidate) =>
              candidate.id === program.id
                ? { ...candidate, days: candidate.days.map((day) => day.id === current.id ? restored : day), updatedAt: now }
                : candidate,
            ),
            programDayVersions: withDayHistory(s.programDayVersions, current, restored),
          };
        });
        requestSyncFlush("program-day-restore");
      },
      duplicateProgramDayVersion: (programId, dayId, versionId) => {
        set((s) => {
          const program = s.programs.find((candidate) => candidate.id === programId);
          const current = program?.days.find((candidate) => candidate.id === dayId);
          const source = s.programDayVersions.find((candidate) => candidate.id === versionId);
          if (!program || !current || !source || source.lineageId !== current.lineageId) return {};
          const now = new Date().toISOString();
          const duplicate: ProgramDayDefinition = {
            ...source,
            id: lifestyleId("pday"),
            programId: program.id,
            programVersion: program.version,
            sourceDayId: source.id,
            parentVersionId: source.id,
            version: nextProgramDayVersion(s.programDayVersions, current),
            title: `${source.title} Copy`,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          };
          return { programDayVersions: withDayHistory(s.programDayVersions, duplicate) };
        });
        requestSyncFlush("program-day-history");
      },
      renameProgramDayVersion: (versionId, title) => {
        const nextTitle = title.trim();
        if (!nextTitle) return;
        set((s) => ({
          programs: s.programs.map((program) => ({
            ...program,
            days: program.days.map((day) => day.id === versionId ? { ...day, title: nextTitle, updatedAt: new Date().toISOString() } : day),
          })),
          programDayVersions: s.programDayVersions.map((day) =>
            day.id === versionId ? { ...day, title: nextTitle, updatedAt: new Date().toISOString() } : day,
          ),
        }));
        requestSyncFlush("program-day-history");
      },
      restoreReserveOriginalDay: (programId, dayId) => {
        const s = get();
        const program = s.programs.find((candidate) => candidate.id === programId);
        const current = program?.days.find((candidate) => candidate.id === dayId);
        if (!program || !current) return;
        const original = s.programDayVersions.find((candidate) =>
          candidate.id === current.reserveOriginalDayId ||
          (candidate.lineageId === current.lineageId && candidate.ownership === "reserve-original"),
        );
        if (original) s.restoreProgramDayVersion(programId, dayId, original.id);
      },
      archiveProgramDayVersion: (versionId, archived) => {
        set((s) => {
          const activeIds = new Set(s.programs.flatMap((program) => program.days.map((day) => day.id)));
          if (activeIds.has(versionId)) return {};
          return {
            programDayVersions: s.programDayVersions.map((day) =>
              day.id === versionId
                ? { ...day, status: archived ? "archived" : "draft", updatedAt: new Date().toISOString() }
                : day,
            ),
          };
        });
        requestSyncFlush("program-day-history");
      },
      programRecommendationPreferences: DEFAULT_PROGRAM_RECOMMENDATION_PREFERENCES,
      updateProgramRecommendationPreferences: (updates) => {
        set((s) => ({
          programRecommendationPreferences: { ...s.programRecommendationPreferences, ...updates },
        }));
        requestSyncFlush("program-recommendation-preferences");
      },
      programRecommendationDecisions: [],
      recordProgramRecommendationDecision: (decision) => {
        set((s) => ({
          programRecommendationDecisions: [
            ...s.programRecommendationDecisions,
            { ...decision, id: lifestyleId("program-decision"), at: new Date().toISOString() },
          ].slice(-300),
        }));
        requestSyncFlush("program-recommendation-decision");
      },
      importedProgramDrafts: [],
      saveImportedProgramDraft: (draft) => {
        set((s) => ({
          importedProgramDrafts: [
            ...s.importedProgramDrafts.filter((candidate) => candidate.id !== draft.id),
            { ...draft, sourceExcerpt: draft.sourceExcerpt?.slice(0, 30_000), updatedAt: new Date().toISOString() },
          ].slice(-20),
        }));
        requestSyncFlush("program-import-draft");
      },
      archiveImportedProgramDraft: (id) => {
        set((s) => ({
          importedProgramDrafts: s.importedProgramDrafts.map((draft) =>
            draft.id === id ? { ...draft, status: "archived", updatedAt: new Date().toISOString() } : draft,
          ),
        }));
        requestSyncFlush("program-import-draft");
      },
      activateImportedProgramDraft: (id) => {
        const s = get();
        const draft = s.importedProgramDrafts.find((candidate) => candidate.id === id && candidate.status !== "archived");
        if (!draft || draft.days.length === 0) return false;
        const existingProgram = s.programs.find((candidate) => candidate.importedDraftId === draft.id);
        if (existingProgram) {
          set((current) => ({
            activeProgramId: existingProgram.id,
            programs: current.programs.map((candidate) => ({
              ...candidate,
              status: candidate.id === existingProgram.id
                ? "active"
                : candidate.status === "active" ? "draft" : candidate.status,
            })),
            importedProgramDrafts: current.importedProgramDrafts.map((candidate) =>
              candidate.id === draft.id
                ? { ...candidate, status: "activated", updatedAt: new Date().toISOString() }
                : candidate,
            ),
          }));
          requestSyncFlush("program-import-activate");
          return true;
        }
        const now = new Date().toISOString();
        const programId = lifestyleId("program");
        const templates: CustomWorkoutTemplate[] = draft.days.map((day) => {
          const templateId = lifestyleId("cwt");
          return {
            id: templateId,
            lineageId: templateId,
            name: day.title,
            version: 1,
            status: "active",
            sessionObjective: day.notes ?? "Imported session — member reviewed",
            targetMuscles: [],
            painObservations: [],
            movements: day.movements.map((movement, index) => movementDraftToTemplateMovement(movement, index)),
            source: "member",
            importedSourceRef: `${draft.sourceKind}:${draft.sourceName ?? draft.id}`,
            createdAt: now,
            updatedAt: now,
          };
        });
        const days: ProgramDayDefinition[] = draft.days.map((day, dayIndex) => {
          const dayId = lifestyleId("pday");
          return {
            id: dayId,
            lineageId: dayId,
            programId,
            programVersion: 1,
            dayIndex,
            title: day.title,
            sessionType: day.sessionType,
            sessionObjective: day.notes ?? "Imported day — reviewed by member",
            primaryTargets: [],
            secondaryTargets: [],
            workoutTemplateId: templates[dayIndex]?.id,
            ownership: "imported",
            version: 1,
            locked: true,
            preserveFromAiOverwrite: true,
            memberNotes: day.uncertainFields.length
              ? `Reviewed import. Original uncertain fields: ${day.uncertainFields.join(", ")}.`
              : "Reviewed import.",
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
        });
        const program: ProgramDefinition = {
          id: programId,
          lineageId: programId,
          version: 1,
          name: draft.name,
          status: "active",
          source: "imported",
          operatingMode: s.programOperatingMode,
          rotationLengthDays: Math.max(1, draft.rotationLengthDays),
          weekAnchor: 0,
          days,
          importedDraftId: draft.id,
          createdAt: now,
          updatedAt: now,
        };
        set((current) => ({
          programs: boundPrograms([
            ...current.programs.map((candidate) => candidate.status === "active" ? { ...candidate, status: "draft" as const } : candidate),
            program,
          ], program.id),
          activeProgramId: program.id,
          customWorkoutTemplates: [...current.customWorkoutTemplates, ...templates],
          programDayVersions: withDayHistory(current.programDayVersions, ...days),
          importedProgramDrafts: current.importedProgramDrafts.map((candidate) =>
            candidate.id === draft.id ? { ...candidate, status: "activated", updatedAt: now } : candidate,
          ),
        }));
        requestSyncFlush("program-import-activate");
        return true;
      },
      nutritionOwnership: DEFAULT_NUTRITION_OWNERSHIP,
      updateNutritionOwnership: (updates) => {
        set((s) => ({
          nutritionOwnership: { ...s.nutritionOwnership, ...updates, updatedAt: new Date().toISOString() },
        }));
        requestSyncFlush("nutrition-ownership");
      },
      startSessionFromProgramDay: (requestedDateKey, rebuild = false) => {
        const s = get();
        const requestedDate = requestedDateKey
          ? new Date(`${requestedDateKey}T12:00:00`)
          : new Date();
        const resolution = resolveProgramDayForDate({
          programs: s.programs,
          activeProgramId: s.activeProgramId,
          assignments: s.weekAssignments,
          overrides: s.programDayOverrides,
          date: requestedDate,
        });
        if (!resolution) return false;
        const demand =
          resolution.day.expectedDemand ?? s.workoutDemand ??
          defaultWorkoutDemand(
            (["beginner", "intermediate", "advanced"].includes(s.trainingExperience)
              ? s.trainingExperience
              : "intermediate") as "beginner" | "intermediate" | "advanced",
          );
        const built = buildProgramDaySessionSnapshot(resolution, s.customWorkoutTemplates, demand, demand);
        if (!built) return false;
        if (s.trainingSession.sessionMode === "live" && s.trainingSession.startedAt) {
          const logged = Object.values(s.trainingSession.workoutSets).reduce((sum, sets) => sum + sets.length, 0);
          if (!rebuild || logged > 0) return false;
          s.rebuildLiveSession(built.snapshot, built.firstMovementId);
        } else {
          s.startTrainingSession(built.firstMovementId, built.snapshot);
        }
        requestSyncFlush("workout-start");
        return true;
      },

      /* ── Build Your Player — member-built lifestyle systems ──────────────
         Member-owned and versioned. Reserve recommends; only explicit member
         actions mutate these slices — no engine ever writes here. */
      lifestyleSchedules: [],
      activeLifestyleScheduleId: null,
      saveLifestyleSchedule: (schedule) => {
        set((s) => {
          const updated = { ...schedule, updatedAt: new Date().toISOString() };
          const exists = s.lifestyleSchedules.some((x) => x.id === schedule.id);
          return {
            lifestyleSchedules: exists
              ? s.lifestyleSchedules.map((x) => (x.id === schedule.id ? updated : x))
              : [...s.lifestyleSchedules, updated],
          };
        });
        requestSyncFlush("lifestyle-schedule-save");
      },
      saveLifestyleScheduleVersion: (schedule) => {
        set((s) => {
          const now = new Date().toISOString();
          const lineage = s.lifestyleSchedules.filter((x) => x.lineageId === schedule.lineageId);
          const nextVersion = lineage.reduce((max, x) => Math.max(max, x.version), 0) + 1;
          const version: LifestyleSchedule = {
            ...schedule,
            id: lifestyleId("sched"),
            version: nextVersion,
            parentVersionId: schedule.id,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          };
          return { lifestyleSchedules: [...s.lifestyleSchedules, version] };
        });
        requestSyncFlush("lifestyle-schedule-save");
      },
      deleteLifestyleSchedule: (id) =>
        set((s) => ({
          lifestyleSchedules: s.lifestyleSchedules.filter((x) => x.id !== id),
          activeLifestyleScheduleId: s.activeLifestyleScheduleId === id ? null : s.activeLifestyleScheduleId,
        })),
      archiveLifestyleSchedule: (id, archived) =>
        set((s) => ({
          lifestyleSchedules: s.lifestyleSchedules.map((x) =>
            x.id === id ? { ...x, status: archived ? "archived" : "draft", updatedAt: new Date().toISOString() } : x,
          ),
          activeLifestyleScheduleId:
            archived && s.activeLifestyleScheduleId === id ? null : s.activeLifestyleScheduleId,
        })),
      setActiveLifestyleSchedule: (id) => {
        set((s) => ({
          activeLifestyleScheduleId: id,
          lifestyleSchedules: s.lifestyleSchedules.map((x) =>
            x.id === id
              ? { ...x, status: "active" }
              : x.status === "active"
                ? { ...x, status: "draft" }
                : x,
          ),
        }));
        requestSyncFlush("lifestyle-schedule-save");
      },

      weekAssignments: [],
      assignWeek: (assignment) => {
        set((s) => ({
          weekAssignments: [
            ...s.weekAssignments.filter((w) => w.weekKey !== assignment.weekKey),
            { ...assignment, assignedAt: new Date().toISOString() },
          ],
        }));
        requestSyncFlush("lifestyle-week-assign");
      },
      clearWeekAssignment: (weekKey) =>
        set((s) => ({ weekAssignments: s.weekAssignments.filter((w) => w.weekKey !== weekKey) })),

      actualWeeks: [],
      recordActualActivity: (weekKey, scheduleId, record) => {
        set((s) => {
          const entry: ActualActivityRecord = {
            ...record,
            id: lifestyleId("actual"),
            recordedAt: new Date().toISOString(),
          };
          const existing = s.actualWeeks.find((w) => w.weekKey === weekKey);
          const weeks = existing
            ? s.actualWeeks.map((w) =>
                w.weekKey === weekKey
                  ? { ...w, scheduleId: scheduleId ?? w.scheduleId, records: [...w.records, entry] }
                  : w,
              )
            : [...s.actualWeeks, { weekKey, scheduleId, records: [entry] }];
          // Bounded history — the most recent 26 tracked weeks.
          return { actualWeeks: weeks.slice(-26) };
        });
        requestSyncFlush("lifestyle-actual-record");
      },
      removeActualActivity: (weekKey, recordId) =>
        set((s) => ({
          actualWeeks: s.actualWeeks.map((w) =>
            w.weekKey === weekKey ? { ...w, records: w.records.filter((r) => r.id !== recordId) } : w,
          ),
        })),

      customWorkoutTemplates: [],
      saveCustomWorkoutTemplate: (template) => {
        set((s) => {
          const updated = { ...template, updatedAt: new Date().toISOString() };
          const exists = s.customWorkoutTemplates.some((t) => t.id === template.id);
          return {
            customWorkoutTemplates: exists
              ? s.customWorkoutTemplates.map((t) => (t.id === template.id ? updated : t))
              : [...s.customWorkoutTemplates, updated],
          };
        });
        requestSyncFlush("custom-workout-template-save");
      },
      saveCustomWorkoutTemplateVersion: (template) => {
        set((s) => {
          const now = new Date().toISOString();
          const lineage = s.customWorkoutTemplates.filter((t) => t.lineageId === template.lineageId);
          const nextVersion = lineage.reduce((max, t) => Math.max(max, t.version), 0) + 1;
          const version: CustomWorkoutTemplate = {
            ...template,
            id: lifestyleId("cwt"),
            version: nextVersion,
            parentVersionId: template.id,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          };
          return { customWorkoutTemplates: [...s.customWorkoutTemplates, version] };
        });
        requestSyncFlush("custom-workout-template-save");
      },
      deleteCustomWorkoutTemplate: (id) =>
        set((s) => ({
          customWorkoutTemplates: s.customWorkoutTemplates.filter((t) => t.id !== id),
          // Detach the template from any schedule day that referenced it.
          lifestyleSchedules: s.lifestyleSchedules.map((sch) =>
            sch.activities.some((a) => a.workoutTemplateId === id)
              ? {
                  ...sch,
                  activities: sch.activities.map((a) =>
                    a.workoutTemplateId === id ? { ...a, workoutTemplateId: undefined } : a,
                  ),
                }
              : sch,
          ),
        })),

      movementSelections: [],
      recordMovementSelection: (record) => {
        set((s) => ({
          movementSelections: [
            ...s.movementSelections,
            { ...record, id: lifestyleId("msel"), at: new Date().toISOString() },
          ].slice(-200),
        }));
        requestSyncFlush("movement-selection");
      },

      startSessionFromCustomTemplate: (templateId) => {
        const s = get();
        // Same immutability rule as generated sessions: a live session is
        // resumed, never replaced. The member closes it out first.
        if (s.trainingSession.sessionMode === "live" && s.trainingSession.startedAt) return false;
        const template = s.customWorkoutTemplates.find((t) => t.id === templateId);
        if (!template || template.movements.length === 0) return false;
        const demand =
          s.workoutDemand ??
          defaultWorkoutDemand(
            (["beginner", "intermediate", "advanced"].includes(s.trainingExperience)
              ? s.trainingExperience
              : "intermediate") as "beginner" | "intermediate" | "advanced",
          );
        const { snapshot, firstMovementId } = buildCustomSessionSnapshot(template, demand);
        s.startTrainingSession(firstMovementId, snapshot);
        requestSyncFlush("workout-start");
        return true;
      },

      /* ── Hydration bar ──────────────────────────────────────────────── */
      hydrationFavorites: [],
      hydrationDrinkLogs: [],
      toggleHydrationFavorite: (drinkId) =>
        set((s) => ({
          hydrationFavorites: s.hydrationFavorites.includes(drinkId)
            ? s.hydrationFavorites.filter((id) => id !== drinkId)
            : [...s.hydrationFavorites, drinkId],
        })),
      logHydrationDrink: (entry) =>
        set((s) => ({ hydrationDrinkLogs: [entry, ...s.hydrationDrinkLogs].slice(0, 120) })),

      /* ── Weekly challenge / retention ───────────────────────────────── */
      completedChallengeKeys: [],
      toggleChallengeComplete: (key) =>
        set((s) => ({
          completedChallengeKeys: s.completedChallengeKeys.includes(key)
            ? s.completedChallengeKeys.filter((k) => k !== key)
            : [...s.completedChallengeKeys, key],
        })),

      setProfilePath: (profilePath) =>
        set((s) => ({ modulePreferences: { ...s.modulePreferences, profilePath } })),
      setEnhancedLogOnly: (enhancedLogOnly) =>
        set((s) => ({ modulePreferences: { ...s.modulePreferences, enhancedLogOnly } })),
      setModuleOverride: (moduleId, enabled) =>
        set((s) => {
          const overrides = { ...s.modulePreferences.overrides };
          if (enabled === null) delete overrides[moduleId];
          else overrides[moduleId] = enabled;
          return { modulePreferences: { ...s.modulePreferences, overrides } };
        }),

      recoveryCommand: DEFAULT_RECOVERY_COMMAND,
      logSleep: (entry) => {
        set((s) => ({
          recoveryCommand: {
            ...s.recoveryCommand,
            sleepLogs: [...s.recoveryCommand.sleepLogs.filter((l) => l.date !== entry.date), entry],
          },
        }));
        requestSyncFlush("sleep-log");
        emitSignal("sleep");
      },
      logHydration: (entry) => {
        set((s) => ({
          recoveryCommand: {
            ...s.recoveryCommand,
            hydrationLogs: [...s.recoveryCommand.hydrationLogs, entry],
          },
        }));
        requestSyncFlush("recovery-log");
        emitSignal("water");
      },
      logMobility: (entry) => {
        set((s) => ({
          recoveryCommand: {
            ...s.recoveryCommand,
            mobilityLogs: [...s.recoveryCommand.mobilityLogs, entry],
          },
        }));
        requestSyncFlush("recovery-log");
        emitSignal("mobility");
      },
      logSteps: (date, steps) => {
        const clean = Math.max(0, Math.min(100_000, Math.round(steps)));
        if (!Number.isFinite(clean)) return;
        set((s) => ({
          recoveryCommand: {
            ...s.recoveryCommand,
            stepLogs: [...(s.recoveryCommand.stepLogs ?? []).filter((l) => l.date !== date), { date, steps: clean, updatedAt: new Date().toISOString() }].slice(-120),
          },
        }));
        requestSyncFlush("recovery-log");
      },
      logStressCheckIn: (entry) => {
        set((s) => ({
          recoveryCommand: {
            ...s.recoveryCommand,
            stressCheckIns: [...s.recoveryCommand.stressCheckIns.filter((l) => l.date !== entry.date), entry],
          },
        }));
        requestSyncFlush("recovery-log");
        emitSignal("check-in");
      },
      toggleRecoverySuiteTool: (toolId) =>
        set((s) => {
          /* Local day: a UTC key carried last night's checks into this morning. */
          const today = localDateKey(new Date());
          const sameDay = s.recoveryCommand.suiteDate === today;
          const current = sameDay ? s.recoveryCommand.suiteCompletedToday : [];
          const next = current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
          return { recoveryCommand: { ...s.recoveryCommand, suiteDate: today, suiteCompletedToday: next } };
        }),
      updateRecoveryTargets: (updates) => {
        const clean: typeof updates = {};
        if (updates.sleepTargetHours !== undefined) clean.sleepTargetHours = updates.sleepTargetHours;
        if (updates.hydrationTargetOz !== undefined) clean.hydrationTargetOz = clampWaterTarget(updates.hydrationTargetOz);
        if (updates.mobilityWeeklyTarget !== undefined) clean.mobilityWeeklyTarget = clampMobilityTarget(updates.mobilityWeeklyTarget);
        set((s) => ({ recoveryCommand: { ...s.recoveryCommand, ...clean } }));
        requestSyncFlush("recovery-log");
      },
      undoLastHydration: (date) => {
        set((s) => {
          const logs = s.recoveryCommand.hydrationLogs;
          const at = logs.map((l) => l.date).lastIndexOf(date);
          if (at < 0) return {};
          return { recoveryCommand: { ...s.recoveryCommand, hydrationLogs: [...logs.slice(0, at), ...logs.slice(at + 1)] } };
        });
        requestSyncFlush("recovery-log");
      },
      setWaterPour: (oz) =>
        set((s) => ({ recoveryCommand: { ...s.recoveryCommand, waterPourOz: clampPour(oz) } })),

      scheduleProfile: DEFAULT_SCHEDULE_PROFILE,
      updateScheduleProfile: (updates) =>
        set((s) => {
          // Single edit point: repair contradictions, then mirror the shared
          // fields into trainingSession.schedulePlan so both stay one truth.
          const merged = { ...s.scheduleProfile, ...updates };
          const repaired = scheduleContradictions(merged).length
            ? repairScheduleProfile(merged)
            : merged;
          return {
            scheduleProfile: repaired,
            trainingSession: {
              ...s.trainingSession,
              schedulePlan: {
                ...s.trainingSession.schedulePlan,
                wakeTime: repaired.wakeTime,
                sleepTime: repaired.sleepTarget,
                workoutTime: repaired.preferredTrainingStart,
              },
            },
          };
        }),
      userTrainingProfile: DEFAULT_USER_TRAINING_PROFILE,
      updateUserTrainingProfile: (updates) =>
        set((s) => ({ userTrainingProfile: { ...s.userTrainingProfile, ...updates } })),

      activeProtocol: null,
      selectProtocol: (def, opts) => {
        const definition = typeof def === "string" ? getProtocol(def) : def;
        if (!definition) return;
        set((s) => {
          const now = new Date().toISOString();
          const activeExecution = s.trainingSession.executionRecord;
          if (
            activeExecution &&
            !activeExecution.integrity.completedRecordLockedAt &&
            s.activeProtocol?.protocolId !== definition.id
          ) {
            const deferred = createReserveDecision({
              createdAt: now,
              category: "protocol-selection",
              source: "athlete",
              programId: activeExecution.programId ?? undefined,
              observation: `${definition.name} was selected while ${activeExecution.plannedSnapshot?.splitTitle ?? "a training session"} was active.`,
              decision: "Deferred the protocol change until the active session is finished or abandoned.",
              reason: "Changing protocols cannot silently replace a frozen session.",
              affectedSessionIds: [activeExecution.id],
              athleteDecision: "deferred",
            });
            return {
              trainingSession: {
                ...s.trainingSession,
                decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, deferred),
              },
            };
          }
          const activation = activateProtocol(definition, opts);
          const activationDecision = createReserveDecision({
            createdAt: now,
            category: "protocol-selection",
            source: "athlete",
            observation: `${definition.name} was selected as the active protocol.`,
            decision: `Activated ${definition.name}.`,
            reason: "The athlete selected this protocol in Reserve.",
            athleteDecision: "accepted",
            before: s.activeProtocol,
            after: activation,
          });
          const currentFocus = s.physiqueCommand.focus ?? DEFAULT_PHYSIQUE_FOCUS;
          return {
            activeProtocol: activation,
            trainingSession: {
              ...s.trainingSession,
              decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, activationDecision),
            },
            // A split the member chose keeps setting the days when the new program's
            // week is still a bodybuilding split. A program built around a different
            // kind of week (distance, strength, constrained, home, women's track)
            // replaces it, so an old split can never hide that program's days.
            splitSystem: programKeepsMemberSplit(definition) ? s.splitSystem : DEFAULT_SPLIT_SYSTEM,
            physiqueCommand: {
              ...s.physiqueCommand,
              focus: {
                ...currentFocus,
                // Protocol selection owns the women's architecture binding.
                // Non-women protocols clear a stale track but preserve the
                // member's explicit muscle priorities.
                track: definition.womensTrack ?? null,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      updateActiveProtocol: (updates) =>
        set((s) => (s.activeProtocol ? { activeProtocol: { ...s.activeProtocol, ...updates } } : s)),
      setProtocolStatus: (status) =>
        set((s) => (s.activeProtocol ? { activeProtocol: { ...s.activeProtocol, status } } : s)),
      pauseProtocol: () =>
        set((s) => (s.activeProtocol ? { activeProtocol: { ...s.activeProtocol, status: "paused" } } : s)),
      resumeProtocol: () =>
        set((s) => (s.activeProtocol ? { activeProtocol: { ...s.activeProtocol, status: "active" } } : s)),
      completeProtocol: () =>
        set((s) => (s.activeProtocol ? { activeProtocol: { ...s.activeProtocol, status: "completed" } } : s)),
      clearProtocol: () =>
        set((s) => {
          const activeExecution = s.trainingSession.executionRecord;
          if (activeExecution && !activeExecution.integrity.completedRecordLockedAt) {
            const deferred = createReserveDecision({
              category: "protocol-selection",
              source: "athlete",
              programId: activeExecution.programId ?? undefined,
              observation: "Protocol removal was requested during an active frozen session.",
              decision: "Deferred protocol removal until the active session is finished or abandoned.",
              reason: "The active session must remain resumable and attributable.",
              affectedSessionIds: [activeExecution.id],
              athleteDecision: "deferred",
            });
            return {
              trainingSession: {
                ...s.trainingSession,
                decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, deferred),
              },
            };
          }
          return { activeProtocol: null, programHorizon: DEFAULT_PROGRAM_HORIZON_STATE };
        }),
      programHorizon: DEFAULT_PROGRAM_HORIZON_STATE,
      setProgramHorizon: (horizon, newRecurringActivity) =>
        set((s) => {
          const previousRevisionIds = new Set(s.programHorizon.horizon?.revisions.map((revision) => revision.id) ?? []);
          const newRevisionIds = horizon.revisions
            .map((revision) => revision.id)
            .filter((id) => !previousRevisionIds.has(id));
          let executionRecord = s.trainingSession.executionRecord;
          if (
            executionRecord &&
            !executionRecord.integrity.completedRecordLockedAt &&
            executionRecord.programId === horizon.programId
          ) {
            for (const revisionId of newRevisionIds) {
              executionRecord = relateFutureRevision(executionRecord, revisionId);
            }
          }
          return {
            trainingSession: { ...s.trainingSession, executionRecord },
            programHorizon: {
              horizon,
              recurringActivities: newRecurringActivity
                ? [
                    ...s.programHorizon.recurringActivities.filter((a) => a.id !== newRecurringActivity.id),
                    newRecurringActivity,
                  ]
                : s.programHorizon.recurringActivities,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      clearProgramHorizon: () =>
        set((s) => ({ programHorizon: { ...s.programHorizon, horizon: null, updatedAt: new Date().toISOString() } })),
      responseModel: DEFAULT_RESPONSE_MODEL_STATE,
      setResponseModel: (model) =>
        set((s) => ({ responseModel: { ...s.responseModel, model, updatedAt: new Date().toISOString() } })),
      appendResponseEvents: (events) =>
        set((s) => {
          if (events.length === 0) return s;
          // Events are identified deterministically, so a rebuild that
          // reproduces the same event must not duplicate the log entry.
          const seen = new Set(s.responseModel.events.map((event) => event.id));
          const added = events.filter((event) => !seen.has(event.id));
          if (added.length === 0) return s;
          return {
            responseModel: {
              ...s.responseModel,
              events: [...s.responseModel.events, ...added].slice(-MAX_RESPONSE_EVENTS),
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      clearResponseModel: () =>
        set((s) => ({ responseModel: { ...s.responseModel, model: null, updatedAt: new Date().toISOString() } })),
      setWeeklyResponseReview: (review) =>
        set((s) => ({
          responseModel: {
            ...s.responseModel,
            weeklyReviews: upsertWeeklyResponseReview(s.responseModel.weeklyReviews, review),
            updatedAt: new Date().toISOString(),
          },
        })),
      removeRecurringActivity: (activityId) =>
        set((s) => {
          const activity = s.programHorizon.recurringActivities.find((candidate) => candidate.id === activityId);
          const now = new Date().toISOString();
          const cancellation = activity
            ? createReserveDecision({
                id: `decision:activity-cancelled:${activityId}:${now}`,
                createdAt: now,
                category: "activity-reconciliation",
                source: "athlete",
                programId: s.programHorizon.horizon?.programId,
                observation: `${activity.title} was removed from the recurring schedule.`,
                decision: "Stopped future activity occurrences from entering the active program and Response evidence.",
                reason: "The athlete removed the recurring activity. Earlier dated occurrences remain historical evidence.",
                athleteDecision: "accepted",
                activity: {
                  activityId,
                  status: "cancelled",
                  programStartDate: s.programHorizon.horizon?.startDate,
                  snapshot: activity,
                },
              })
            : null;
          return {
            trainingSession: cancellation
              ? {
                  ...s.trainingSession,
                  decisionHistory: appendReserveDecision(s.trainingSession.decisionHistory, cancellation),
                }
              : s.trainingSession,
            programHorizon: {
              // Re-plan future weeks without the removed recurring activity.
              horizon: null,
              recurringActivities: s.programHorizon.recurringActivities.filter((a) => a.id !== activityId),
              updatedAt: now,
            },
          };
        }),
      splitSystem: DEFAULT_SPLIT_SYSTEM,
      setSplitSystem: (key, source, restDayIndex) =>
        set((s) => ({
          splitSystem: {
            key,
            source,
            selectedAt: new Date().toISOString(),
            // A rest day the member already chose carries over to a new split.
            restDayIndex: restDayIndex === undefined ? s.splitSystem.restDayIndex ?? null : restDayIndex,
          },
        })),
      setSplitRestDay: (restDayIndex) =>
        set((s) => ({ splitSystem: { ...s.splitSystem, restDayIndex } })),
      clearSplitSystem: () => set({ splitSystem: DEFAULT_SPLIT_SYSTEM }),
      bloodworkLogs: [],
      addBloodworkLog: (record) => {
        set((s) => ({
          bloodworkLogs: [
            { ...record, id: `bw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() },
            ...s.bloodworkLogs,
          ].slice(0, 200),
        }));
        emitSignal("bloodwork");
      },
      removeBloodworkLog: (id) =>
        set((s) => ({ bloodworkLogs: s.bloodworkLogs.filter((r) => r.id !== id) })),

      cyclePeriods: [],
      addCyclePeriod: (input) => {
        const id = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const at = new Date();
        const stamp = at.toISOString();
        const stored: CyclePeriod = {
          id,
          name: input.name.trim(),
          startDate: input.startDate,
          plannedWeeks: input.plannedWeeks,
          compoundIds: [...new Set(input.compoundIds)],
          clinicianOversight: input.clinicianOversight,
          checkpoints: [],
          notes: input.notes?.trim() || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        };
        set((s) => ({
          cyclePeriods: [stored, ...s.cyclePeriods].slice(0, 50),
          changeHistory: appendChangeEvents(s.changeHistory, [cycleEvent(stored, "added", at)]),
        }));
        return id;
      },
      updateCyclePeriod: (id, updates) =>
        set((s) => {
          const at = new Date();
          const before = s.cyclePeriods.find((c) => c.id === id);
          if (!before) return {};
          const after: CyclePeriod = {
            ...before,
            ...updates,
            name: updates.name !== undefined ? updates.name.trim() : before.name,
            compoundIds: updates.compoundIds ? [...new Set(updates.compoundIds)] : before.compoundIds,
            notes: updates.notes !== undefined ? updates.notes.trim() || undefined : before.notes,
            updatedAt: at.toISOString(),
          };
          return {
            cyclePeriods: s.cyclePeriods.map((c) => (c.id === id ? after : c)),
            changeHistory: appendChangeEvents(s.changeHistory, cycleUpdateEvents(before, after, at)),
          };
        }),
      endCyclePeriod: (id, reason, endedOn) =>
        set((s) => {
          const at = new Date();
          const before = s.cyclePeriods.find((c) => c.id === id);
          if (!before) return {};
          return {
            cyclePeriods: s.cyclePeriods.map((c) => (c.id === id ? { ...c, endedOn, endReason: reason, updatedAt: at.toISOString() } : c)),
            changeHistory: appendChangeEvents(s.changeHistory, [cycleEvent(before, "ended", at, [{ field: "endedOn", label: "Ended on", from: "", to: endedOn }])]),
          };
        }),
      reopenCyclePeriod: (id) =>
        set((s) => {
          const at = new Date();
          const before = s.cyclePeriods.find((c) => c.id === id);
          if (!before) return {};
          return {
            cyclePeriods: s.cyclePeriods.map((c) => (c.id === id ? { ...c, endedOn: undefined, endReason: undefined, updatedAt: at.toISOString() } : c)),
            changeHistory: appendChangeEvents(s.changeHistory, [cycleEvent(before, "reopened", at)]),
          };
        }),
      removeCyclePeriod: (id) =>
        set((s) => {
          const removed = s.cyclePeriods.find((c) => c.id === id);
          return {
            cyclePeriods: s.cyclePeriods.filter((c) => c.id !== id),
            ...(removed ? { changeHistory: appendChangeEvents(s.changeHistory, [cycleEvent(removed, "removed", new Date())]) } : {}),
          };
        }),
      addCycleCheckpoint: (cycleId, checkpoint) =>
        set((s) => {
          const at = new Date();
          const cycle = s.cyclePeriods.find((c) => c.id === cycleId);
          if (!cycle) return {};
          const stored: CycleCheckpoint = { ...checkpoint, label: checkpoint.label.trim() || "Bloodwork", id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
          return {
            cyclePeriods: s.cyclePeriods.map((c) =>
              c.id === cycleId
                ? { ...c, checkpoints: [...c.checkpoints, stored].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 30), updatedAt: at.toISOString() }
                : c,
            ),
            changeHistory: appendChangeEvents(s.changeHistory, [checkpointEvent(cycle, stored, "checkpoint-added", at)]),
          };
        }),
      removeCycleCheckpoint: (cycleId, checkpointId) =>
        set((s) => {
          const at = new Date();
          const cycle = s.cyclePeriods.find((c) => c.id === cycleId);
          const checkpoint = cycle?.checkpoints.find((cp) => cp.id === checkpointId);
          if (!cycle || !checkpoint) return {};
          return {
            cyclePeriods: s.cyclePeriods.map((c) =>
              c.id === cycleId ? { ...c, checkpoints: c.checkpoints.filter((cp) => cp.id !== checkpointId), updatedAt: at.toISOString() } : c,
            ),
            changeHistory: appendChangeEvents(s.changeHistory, [checkpointEvent(cycle, checkpoint, "checkpoint-removed", at)]),
          };
        }),

      safetyAcknowledgement: null,
      acknowledgeSafety: () => {
        const now = new Date().toISOString();
        set({ safetyAcknowledgement: { acknowledgedAt: now, version: SAFETY_ACK_VERSION, adultConfirmedAt: now } });
      },
      redFlagReports: [],
      addRedFlagReport: (flags) =>
        set((s) =>
          flags.length === 0
            ? {}
            : {
                redFlagReports: [
                  { id: `rf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, reportedAt: new Date().toISOString(), flags: [...new Set(flags)] },
                  ...s.redFlagReports,
                ].slice(0, 100),
              },
        ),
      removeRedFlagReport: (id) =>
        set((s) => ({ redFlagReports: s.redFlagReports.filter((r) => r.id !== id) })),

      cycleGoals: {},
      setCycleGoal: (cycleId, setup) =>
        set((s) => ({
          cycleGoals: {
            ...s.cycleGoals,
            [cycleId]: {
              primaryGoal: setup.primaryGoal,
              priorities: [...new Set(setup.priorities)],
              compoundPurposes: setup.compoundPurposes,
              updatedAt: new Date().toISOString(),
            },
          },
        })),
      cycleCheckIns: [],
      addCycleCheckIn: (input) => {
        const id = `checkin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          cycleCheckIns: [
            {
              ...input,
              id,
              symptoms: [...new Set(input.symptoms)],
              newMedications: input.newMedications?.trim() || undefined,
              outsideChanges: input.outsideChanges?.trim() || undefined,
              createdAt: new Date().toISOString(),
            },
            ...s.cycleCheckIns,
          ].slice(0, 156),
        }));
        return id;
      },
      removeCycleCheckIn: (id) =>
        set((s) => ({ cycleCheckIns: s.cycleCheckIns.filter((c) => c.id !== id) })),
      cycleReviewSnapshots: [],
      saveCycleReviewSnapshot: (cycleId, text) =>
        set((s) => ({
          cycleReviewSnapshots: [
            { id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, cycleId, savedAt: new Date().toISOString(), text },
            ...s.cycleReviewSnapshots,
          ].slice(0, 30),
        })),
      removeCycleReviewSnapshot: (id) =>
        set((s) => ({ cycleReviewSnapshots: s.cycleReviewSnapshots.filter((r) => r.id !== id) })),
      supportPlan: [],
      addSupportPlanItem: (optionKey) => {
        let added: AddedSupport | null = null;
        set((s) => {
          if (optionKey === "custom" || s.supportPlan.some((item) => item.optionKey === optionKey) || s.supportPlan.length >= 40) return {};
          const at = new Date();
          const item: SupportPlanItem = { id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, optionKey, addedAt: at.toISOString() };
          const log = s.trainingSession.enhancementLog ?? [];
          const { entries } = planEntriesToAdd([item], log, at);
          added = { planItemId: item.id, entryId: entries[0]?.id ?? null, name: supportPlanItemName(item) ?? optionKey };
          return {
            supportPlan: [...s.supportPlan, item],
            ...(entries.length ? { trainingSession: { ...s.trainingSession, enhancementLog: [...entries, ...log] } } : {}),
            /* The timeline records the member's choice once; the schedule entry follows from it. */
            changeHistory: appendChangeEvents(s.changeHistory, [supportEvent(item, "added", at)]),
          };
        });
        return added;
      },
      addCustomSupportPlanItem: (title) => {
        const name = title.trim().replace(/\s+/g, " ").slice(0, 80);
        if (!name) return null;
        let added: AddedSupport | null = null;
        set((s) => {
          const duplicate = s.supportPlan.some((item) => item.optionKey === "custom" && item.customTitle?.toLowerCase() === name.toLowerCase());
          if (duplicate || s.supportPlan.length >= 40) return {};
          const at = new Date();
          const item: SupportPlanItem = { id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, optionKey: "custom", customTitle: name, addedAt: at.toISOString() };
          const log = s.trainingSession.enhancementLog ?? [];
          const { entries } = planEntriesToAdd([item], log, at);
          added = { planItemId: item.id, entryId: entries[0]?.id ?? null, name };
          return {
            supportPlan: [...s.supportPlan, item],
            ...(entries.length ? { trainingSession: { ...s.trainingSession, enhancementLog: [...entries, ...log] } } : {}),
            /* The timeline records the member's choice once; the schedule entry follows from it. */
            changeHistory: appendChangeEvents(s.changeHistory, [supportEvent(item, "added", at)]),
          };
        });
        return added;
      },
      syncSupportPlanToSchedule: () => {
        let result = { added: 0, skippedFull: 0 };
        set((s) => {
          const at = new Date();
          const log = s.trainingSession.enhancementLog ?? [];
          const { entries, skippedFull } = planEntriesToAdd(s.supportPlan, log, at);
          result = { added: entries.length, skippedFull };
          if (entries.length === 0) return {};
          /* A catch-up of choices already on the timeline: no new timeline events. */
          return { trainingSession: { ...s.trainingSession, enhancementLog: [...entries, ...log] } };
        });
        return result;
      },
      updateSupportPlanItem: (id, details) =>
        set((s) => {
          const before = s.supportPlan.find((item) => item.id === id);
          if (!before) return {};
          const clean = (value: string | undefined) => value?.trim() || undefined;
          const after: SupportPlanItem = {
            ...before,
            amount: clean(details.amount),
            unit: clean(details.unit),
            frequency: clean(details.frequency),
            brand: clean(details.brand),
            startDate: clean(details.startDate),
            notes: clean(details.notes),
          };
          return {
            supportPlan: s.supportPlan.map((item) => (item.id === id ? after : item)),
            changeHistory: appendChangeEvents(s.changeHistory, supportUpdateEvents(before, after, supportItemName(after), new Date())),
          };
        }),
      removeSupportPlanItem: (id) =>
        set((s) => {
          const removed = s.supportPlan.find((item) => item.id === id);
          return {
            supportPlan: s.supportPlan.filter((item) => item.id !== id),
            ...(removed ? { changeHistory: appendChangeEvents(s.changeHistory, [supportEvent(removed, "removed", new Date())]) } : {}),
          };
        }),

      changeHistory: [],
      syncLedger: EMPTY_SYNC_LEDGER,
      timelineNotes: [],
      addTimelineNote: (input) => {
        const clean = normalizeNoteInput(input);
        if (!clean) return null;
        const stamp = new Date().toISOString();
        const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ timelineNotes: [{ id, ...clean, createdAt: stamp, updatedAt: stamp }, ...s.timelineNotes].slice(0, TIMELINE_NOTE_LIMIT) }));
        return id;
      },
      updateTimelineNote: (id, updates) =>
        set((s) => ({
          timelineNotes: s.timelineNotes.map((note) => {
            if (note.id !== id) return note;
            const clean = normalizeNoteInput({ date: updates.date ?? note.date, text: updates.text ?? note.text });
            return clean ? { ...note, ...clean, updatedAt: new Date().toISOString() } : note;
          }),
        })),
      removeTimelineNote: (id) => set((s) => ({ timelineNotes: s.timelineNotes.filter((note) => note.id !== id) })),
      observations: [],
      addObservation: (input) => {
        const clean = normalizeObservationInput(input);
        if (!clean) return null;
        const id = `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ observations: [{ id, ...clean, createdAt: new Date().toISOString() }, ...s.observations].slice(0, OBSERVATION_LIMIT) }));
        return id;
      },
      removeObservation: (id) => set((s) => ({ observations: s.observations.filter((o) => o.id !== id) })),
      toggleObservationReview: (id) =>
        set((s) => ({
          observations: s.observations.map((o) =>
            o.id !== id ? o : o.markedForReviewAt ? { ...o, markedForReviewAt: undefined } : { ...o, markedForReviewAt: new Date().toISOString() },
          ),
        })),
      updateMealWindow: (id, updates) =>
        set((s) => ({
          scheduleProfile: {
            ...s.scheduleProfile,
            mealWindows: s.scheduleProfile.mealWindows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
          },
        })),

      physiqueCommand: DEFAULT_PHYSIQUE_COMMAND,
      addPhysiqueEntry: (entry) => {
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            entries: [...s.physiqueCommand.entries, { ...entry, id: `phys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
          },
        }));
        emitSignal("measurement");
      },
      editPhysiqueEntry: (id, updates) =>
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            entries: s.physiqueCommand.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          },
        })),
      deletePhysiqueEntry: (id) =>
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            entries: s.physiqueCommand.entries.filter((e) => e.id !== id),
            photoCheckIns: s.physiqueCommand.photoCheckIns.filter((p) => p.linkedEntryId !== id),
          },
        })),
      addPhotoCheckIn: (checkIn) => {
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            photoCheckIns: [...s.physiqueCommand.photoCheckIns, { ...checkIn, id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
          },
        }));
        emitSignal("photo");
      },
      deletePhotoCheckIn: (id) =>
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            photoCheckIns: s.physiqueCommand.photoCheckIns.filter((p) => p.id !== id),
          },
        })),
      setPhysiqueWeakPoints: (weakPoints) =>
        set((s) => ({ physiqueCommand: { ...s.physiqueCommand, weakPoints } })),
      setPhysiqueGoal: (goal) =>
        set((s) => ({ physiqueCommand: { ...s.physiqueCommand, goal } })),
      setPhysiqueFocus: (focus) =>
        set((s) => ({
          physiqueCommand: {
            ...s.physiqueCommand,
            focus: {
              ...(s.physiqueCommand.focus ?? DEFAULT_PHYSIQUE_FOCUS),
              ...focus,
              updatedAt: new Date().toISOString(),
            },
          },
        })),
      clearPhysiqueFocus: () =>
        set((s) => ({ physiqueCommand: { ...s.physiqueCommand, focus: { ...DEFAULT_PHYSIQUE_FOCUS } } })),
      activityStack: "gym-only",
      activitySport: null,
      setActivityStack: (stack, sport = null) => {
        const includesSport = stack === "gym-sports" || stack === "gym-pilates-sports" || stack === "full-hybrid";
        set({ activityStack: stack, activitySport: includesSport ? sport : null });
      },
      weeklyCommitments: [],
      /* The derived stack keeps the blueprint layer working unchanged while the
         member states her real week once. Her own sport choice is preserved. */
      setWeeklyCommitments: (commitments) => {
        const clean = sanitizeCommitments(commitments);
        set((s) => ({
          weeklyCommitments: clean,
          activityStack: deriveActivityStackKey(clean) as ActivityStack,
          activitySport: s.activitySport,
        }));
      },
      addWeeklyCommitment: (commitment) =>
        set((s) => {
          const next = sanitizeCommitments([
            ...s.weeklyCommitments,
            { ...commitment, id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
          ]);
          return { weeklyCommitments: next, activityStack: deriveActivityStackKey(next) as ActivityStack };
        }),
      removeWeeklyCommitment: (id) =>
        set((s) => {
          const next = s.weeklyCommitments.filter((c) => c.id !== id);
          return { weeklyCommitments: next, activityStack: deriveActivityStackKey(next) as ActivityStack };
        }),
      doubleDay: DEFAULT_DOUBLE_DAY,
      setDoubleDay: (next) =>
        set((s) => ({ doubleDay: sanitizeDoubleDay({ ...s.doubleDay, ...next }) })),
      toggleDoubleDayDay: (day) =>
        set((s) => {
          const has = s.doubleDay.days.includes(day);
          const days = has ? s.doubleDay.days.filter((d) => d !== day) : [...s.doubleDay.days, day].sort((a, b) => a - b);
          /* Picking a first morning turns the arrangement on; clearing the last
             one turns it off, so the switch can never disagree with the days. */
          return { doubleDay: sanitizeDoubleDay({ ...s.doubleDay, days, enabled: days.length > 0 }) };
        }),
      reserveAthleteFacilities: [],
      setReserveAthleteFacilities: (amenities) => set({ reserveAthleteFacilities: amenities }),

      trainingExperience: "advanced",
      setTrainingExperience: (experience) => set({ trainingExperience: experience }),
      workoutDemand: null,
      setWorkoutDemand: (workoutDemand) => set({ workoutDemand }),
      trainingBlockIntent: null,
      setTrainingBlockIntent: (trainingBlockIntent) => set({ trainingBlockIntent }),
      coreTiming: "auto",
      setCoreTiming: (timing) => set({ coreTiming: timing }),

      movementPreferences: { ...EMPTY_MOVEMENT_PREFERENCES },
      setMovementPreference: (kind, movement, on) =>
        set((s) => {
          const cur = s.movementPreferences;
          const list = cur[kind];
          const next = on
            ? Array.from(new Set([...list, movement]))
            : list.filter((m) => m.toLowerCase() !== movement.toLowerCase());
          return { movementPreferences: { ...cur, [kind]: next } };
        }),
      setPreferredSubstitute: (movement, substitute) =>
        set((s) => {
          const subs = { ...s.movementPreferences.preferredSubstitutes };
          if (substitute) subs[movement] = substitute;
          else delete subs[movement];
          return { movementPreferences: { ...s.movementPreferences, preferredSubstitutes: subs } };
        }),
      clearMovementPreferences: () => set({ movementPreferences: { ...EMPTY_MOVEMENT_PREFERENCES } }),

      movementFeedback: {},
      logMovementFeedback: (movement, kind) =>
        set((s) => {
          const cur = s.movementFeedback[movement];
          const kinds = cur ? (cur.kinds.includes(kind) ? cur.kinds.filter((k) => k !== kind) : [...cur.kinds, kind]) : [kind];
          const next = { ...s.movementFeedback };
          if (kinds.length === 0) delete next[movement];
          else next[movement] = { movement, kinds, at: new Date().toISOString() };
          return { movementFeedback: next };
        }),
      clearMovementFeedback: (movement) =>
        set((s) => {
          if (!movement) return { movementFeedback: {} };
          const next = { ...s.movementFeedback };
          delete next[movement];
          return { movementFeedback: next };
        }),
      toggleSecondaryFocus: (muscle) =>
        set((s) => {
          const cur = s.physiqueCommand.focus ?? DEFAULT_PHYSIQUE_FOCUS;
          const has = cur.secondary.includes(muscle);
          const secondary = has ? cur.secondary.filter((m) => m !== muscle) : [...cur.secondary, muscle];
          return { physiqueCommand: { ...s.physiqueCommand, focus: { ...cur, secondary, updatedAt: new Date().toISOString() } } };
        }),

      splitCustomization: DEFAULT_SPLIT_CUSTOMIZATION,
      activityCoverage: {},
      /* The member's own answer to "what did this hit?". Regions are
         sanitized on the way in so a stored key can never drift, and an
         empty answer CLEARS the day rather than recording a session that
         trained nothing. */
      setActivityCoverage: (date, activity, regions, minutes) =>
        set((s) => {
          const clean = sanitizeRegions(regions);
          if (clean.length === 0) {
            const rest = { ...s.activityCoverage };
            delete rest[date];
            return { activityCoverage: rest };
          }
          return {
            activityCoverage: {
              ...s.activityCoverage,
              [date]: { date, activity, regions: clean, minutes, loggedAt: new Date().toISOString() },
            },
          };
        }),
      setSplitDayEdit: (input) =>
        set((s) => ({ splitCustomization: recordSplitDayEdit(s.splitCustomization, input) })),
      setSplitDayEdits: (inputs) =>
        set((s) => ({
          splitCustomization: inputs.reduce(
            (acc, input) => recordSplitDayEdit(acc, input),
            s.splitCustomization,
          ),
        })),
      resetSplitCustomization: () => set({ splitCustomization: DEFAULT_SPLIT_CUSTOMIZATION }),

      trainingOverrides: {},
      trainingOverrideHistory: [],
      setTrainingOverride: (dateKey, override) => {
        set((s) => {
          const now = new Date().toISOString();
          const previous = s.trainingOverrides[dateKey];
          const archivedPrevious = previous
            ? {
                ...previous,
                status: previous.status === "active" ? "cancelled" as const : previous.status,
                updatedAt: now,
              }
            : null;
          const record: TrainingOverride = {
            ...override,
            id: lifestyleId("training-override"),
            status: "active",
            originalDate: dateKey,
            createdAt: now,
            updatedAt: now,
          };

          let actualWeeks = s.actualWeeks;
          if (record.action !== "favorite") {
            const weekKey = isoWeekKey(new Date(`${dateKey}T12:00:00`));
            const assignment = s.weekAssignments.find((entry) => entry.weekKey === weekKey);
            const schedule = s.lifestyleSchedules.find(
              (entry) => entry.id === (assignment?.scheduleId ?? s.activeLifestyleScheduleId),
            );
            const planned = schedule?.activities.find((activity) =>
              TRAINING_ACTIVITY_TYPES.has(activity.type) && (
                activity.id === record.originalSessionId ||
                activity.programDayId === record.originalProgramDayId ||
                activity.dayIndex === record.originalDayIndex
              ),
            );
            const outcome: NonNullable<ActualActivityRecord["flexOutcome"]> =
              record.action === "rescheduled" ? "rescheduled"
              : record.action === "swapped" ? "swapped"
              : record.action === "not_ready" || record.action === "session_reset" ? "not-ready"
              : record.action === "accidental_start" ? "accidental-start"
              : "skipped";
            const actual: ActualActivityRecord = {
              id: lifestyleId("actual"),
              date: dateKey,
              plannedActivityId: planned?.id,
              type: planned?.type ?? "strength",
              title: record.originalSessionTitle,
              status: record.action === "rescheduled" || record.action === "swapped" ? "moved" : "skipped",
              recordedAt: now,
              sourceOverrideId: record.id,
              flexOutcome: outcome,
              rescheduledToDate: record.targetDate,
              rescheduledToDayIndex: record.targetDayIndex,
              programDayId: record.originalProgramDayId,
              substitutedFromActivityId: record.action === "swapped" ? record.newSessionId : undefined,
            };
            const existing = actualWeeks.find((week) => week.weekKey === weekKey);
            actualWeeks = existing
              ? actualWeeks.map((week) => week.weekKey === weekKey
                  ? { ...week, scheduleId: schedule?.id ?? week.scheduleId, records: [...week.records.filter((entry) => entry.sourceOverrideId !== record.id), actual] }
                  : week)
              : [...actualWeeks, { weekKey, scheduleId: schedule?.id ?? null, records: [actual] }];
            actualWeeks = actualWeeks.slice(-26);
          }

          return {
            actualWeeks,
            trainingOverrides: { ...s.trainingOverrides, [dateKey]: record },
            trainingOverrideHistory: withTrainingOverrideHistory(
              s.trainingOverrideHistory,
              ...(archivedPrevious ? [archivedPrevious] : []),
              record,
            ),
          };
        });
        requestSyncFlush("training-override");
      },
      clearTrainingOverride: (dateKey) => {
        set((s) => {
          const existing = s.trainingOverrides[dateKey];
          if (!existing) return {};
          const updatedAt = new Date().toISOString();
          const cancelled = {
            ...existing,
            status: existing.status === "active" ? "cancelled" as const : existing.status,
            updatedAt,
          };
          const next = { ...s.trainingOverrides };
          delete next[dateKey];
          return {
            trainingOverrides: next,
            trainingOverrideHistory: withTrainingOverrideHistory(s.trainingOverrideHistory, cancelled),
          };
        });
        requestSyncFlush("training-override");
      },
    }),
    {
      name: "final-boss-athlete-settings",
      version: ATHLETE_STORE_PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Cloud-safe member contract: localStorage persists EXACTLY the slices
      // the sync engine mirrors to public.member_state (see state-contract.ts).
      partialize: (state) =>
        pickMemberState(state as unknown as Record<string, unknown>) as Partial<AthleteDashboardStore>,
      migrate: (persistedState) => backfillOnboardingCanonicals(normalizePersistedStore(persistedState)),
      merge: (persistedState, currentState) =>
        mergePersistedMemberState(normalizePersistedStore(persistedState), currentState),
    },
  ),
);

/**
 * Rehydration merge shared by the localStorage persist middleware and cloud
 * hydration: normalizes a persisted/cloud snapshot into a full store state,
 * defaulting every gap from `currentState`.
 */
function mergePersistedMemberState(
  persisted: Partial<AthleteDashboardStore>,
  currentState: AthleteDashboardStore,
): AthleteDashboardStore {
  const persistedTrainingSession = persisted.trainingSession ?? currentState.trainingSession;

        return {
          ...currentState,
          ...persisted,
          profile: {
            ...currentState.profile,
            ...persisted?.profile,
          },
          onboarding: {
            ...currentState.onboarding,
            ...persisted?.onboarding,
          },
          settings: {
            ...currentState.settings,
            ...persisted?.settings,
          },
          engagement: {
            ...currentState.engagement,
            ...persisted?.engagement,
          },
          nutritionPrefs: {
            ...currentState.nutritionPrefs,
            ...(persisted as { nutritionPrefs?: Partial<NutritionPrefsState> })?.nutritionPrefs,
          },
          setupProfile: {
            ...currentState.setupProfile,
            ...(persisted as { setupProfile?: Partial<SetupProfile> })?.setupProfile,
          },
          modulePreferences: {
            ...currentState.modulePreferences,
            ...(persisted as { modulePreferences?: Partial<ModulePreferences> })?.modulePreferences,
            overrides: {
              ...currentState.modulePreferences.overrides,
              ...((persisted as { modulePreferences?: Partial<ModulePreferences> })?.modulePreferences?.overrides ?? {}),
            },
          },
          recoveryCommand: {
            ...currentState.recoveryCommand,
            ...(persisted as { recoveryCommand?: Partial<RecoveryCommandState> })?.recoveryCommand,
          },
          scheduleProfile: reconcileScheduleSources(
            {
              ...currentState.scheduleProfile,
              ...(persisted as { scheduleProfile?: Partial<MemberScheduleProfile> })?.scheduleProfile,
              mealWindows: (persisted as { scheduleProfile?: Partial<MemberScheduleProfile> })?.scheduleProfile?.mealWindows
                ?? currentState.scheduleProfile.mealWindows,
            },
            // Repairs the stale factory-evening bug: a profile never touched
            // by the member realigns to the real workout time in schedulePlan.
            persistedTrainingSession.schedulePlan,
          ),
          userTrainingProfile: {
            ...currentState.userTrainingProfile,
            ...(persisted as { userTrainingProfile?: Partial<UserTrainingProfile> })?.userTrainingProfile,
          },
          activeProtocol: (() => {
            const saved = (persisted as { activeProtocol?: ActiveProtocol | null })?.activeProtocol;
            if (saved?.protocolId === "womens-performance") {
              return {
                ...saved,
                protocolId: "signature-shape",
                protocolName: "Signature",
                goal: "Balanced feminine physique foundation",
              };
            }
            return saved ?? currentState.activeProtocol;
          })(),
          splitSystem: {
            ...DEFAULT_SPLIT_SYSTEM,
            ...((persisted as { splitSystem?: Partial<SplitSystemSelection> })?.splitSystem ?? {}),
          },
          bloodworkLogs: Array.isArray((persisted as { bloodworkLogs?: unknown })?.bloodworkLogs)
            ? ((persisted as { bloodworkLogs: BloodworkLogRecord[] }).bloodworkLogs)
            : currentState.bloodworkLogs,
          trainingOverrides: {
            ...((persisted as { trainingOverrides?: Record<string, TrainingOverride> })?.trainingOverrides ?? {}),
          },
          physiqueCommand: {
            ...currentState.physiqueCommand,
            ...(persisted as { physiqueCommand?: Partial<PhysiqueCommandState> })?.physiqueCommand,
            entries: (persisted as { physiqueCommand?: Partial<PhysiqueCommandState> })?.physiqueCommand?.entries
              ?? currentState.physiqueCommand.entries,
            photoCheckIns: (persisted as { physiqueCommand?: Partial<PhysiqueCommandState> })?.physiqueCommand?.photoCheckIns
              ?? currentState.physiqueCommand.photoCheckIns,
            weakPoints: (persisted as { physiqueCommand?: Partial<PhysiqueCommandState> })?.physiqueCommand?.weakPoints
              ?? currentState.physiqueCommand.weakPoints,
            focus: (() => {
              const savedFocus = (persisted as { physiqueCommand?: Partial<PhysiqueCommandState> })?.physiqueCommand?.focus;
              const savedProtocol = (persisted as { activeProtocol?: ActiveProtocol | null })?.activeProtocol;
              return {
                ...DEFAULT_PHYSIQUE_FOCUS,
                ...(savedFocus ?? {}),
                track: savedFocus?.track ?? (savedProtocol?.protocolId === "womens-performance" ? "signature-shape" : null),
              };
            })(),
          },
          womens: (() => {
            const pw = (persisted as { womens?: Partial<WomensState> })?.womens;
            if (!pw) return currentState.womens;
            return {
              ...currentState.womens,
              ...pw,
              cycle: { ...currentState.womens.cycle, ...pw.cycle },
              cycleLogs: Array.isArray(pw.cycleLogs) ? pw.cycleLogs : currentState.womens.cycleLogs,
              nutrition: { ...currentState.womens.nutrition, ...pw.nutrition },
              recovery: { ...currentState.womens.recovery, ...pw.recovery },
              physique: { ...currentState.womens.physique, ...pw.physique },
              fertility: { ...currentState.womens.fertility, ...pw.fertility },
              pregnancy: { ...currentState.womens.pregnancy, ...pw.pregnancy },
            };
          })(),
          trainingSession: {
            ...currentState.trainingSession,
            ...persistedTrainingSession,
            liveSetReviews: persistedTrainingSession.liveSetReviews ?? currentState.trainingSession.liveSetReviews,
            substitutions: persistedTrainingSession.substitutions ?? currentState.trainingSession.substitutions,
            debriefSummary: persistedTrainingSession.debriefSummary ?? currentState.trainingSession.debriefSummary,
            schedulePlan: {
              ...currentState.trainingSession.schedulePlan,
              ...persistedTrainingSession.schedulePlan,
            },
            sessionHistory: persistedTrainingSession.sessionHistory ?? currentState.trainingSession.sessionHistory ?? [],
            trainingJournal: persistedTrainingSession.trainingJournal ?? currentState.trainingSession.trainingJournal ?? [],
            enhancementLog: persistedTrainingSession.enhancementLog ?? currentState.trainingSession.enhancementLog ?? [],
            enhancementAdherence: persistedTrainingSession.enhancementAdherence ?? currentState.trainingSession.enhancementAdherence ?? [],
            injectionLogs: persistedTrainingSession.injectionLogs ?? currentState.trainingSession.injectionLogs ?? [],
            compoundSupportLinks: persistedTrainingSession.compoundSupportLinks ?? currentState.trainingSession.compoundSupportLinks ?? [],
          },
          responseModel: {
            ...currentState.responseModel,
            ...((persisted as { responseModel?: Partial<ResponseModelState> })?.responseModel ?? {}),
            events: (persisted as { responseModel?: Partial<ResponseModelState> })?.responseModel?.events
              ?? currentState.responseModel.events,
            weeklyReviews: (persisted as { responseModel?: Partial<ResponseModelState> })?.responseModel?.weeklyReviews
              ?? currentState.responseModel.weeklyReviews,
          },
        };
}

/** Serialize the cloud-safe member slices from the live store. */
export function serializeMemberState(): Record<string, unknown> {
  return pickMemberState(useAthleteDashboardStore.getState() as unknown as Record<string, unknown>);
}

/**
 * Apply a cloud member-state snapshot through the exact same normalize →
 * backfill → merge pipeline that localStorage rehydration uses.
 */
export function hydrateMemberState(raw: unknown): void {
  const migrated = backfillOnboardingCanonicals(normalizePersistedStore(raw));
  // A hydration or cloud merge is not a member edit: it must not stamp or tombstone.
  withLedgerSuppressed(() =>
    useAthleteDashboardStore.setState((current) => mergePersistedMemberState(migrated, current)),
  );
}

/** Reset only the member-data slices to pristine defaults (logout / user switch). */
export function resetMemberStateToDefaults(): void {
  const initial = useAthleteDashboardStore.getInitialState() as unknown as Record<string, unknown>;
  // Clearing an account off this device must never read as the member deleting every record.
  withLedgerSuppressed(() =>
    useAthleteDashboardStore.setState(pickMemberState(initial) as Partial<AthleteDashboardStore>),
  );
}

/* Keep the sync ledger current in the browser: every member-state change is
   diffed into slice clocks, record clocks and tombstones (change-ledger.ts). */
if (typeof window !== "undefined") {
  installChangeLedger(useAthleteDashboardStore as unknown as Parameters<typeof installChangeLedger>[0]);
}

export function getTimeGreeting(name: string): string {
  const h = new Date().getHours();
  // Empty name (first-time user) → drop the ", name" suffix cleanly.
  const suffix = name.trim() ? `, ${name.trim()}.` : ".";
  if (h >= 5 && h < 12) return `Good morning${suffix}`;
  if (h >= 12 && h < 17) return `Good afternoon${suffix}`;
  if (h >= 17 && h < 21) return `Good evening${suffix}`;
  if (h >= 21) return `Late session detected${suffix}`;
  return `Recovery window active${suffix}`;
}
