/* ════════════════════════════════════════════════════════════════════════
   RESERVE PERFORMANCE OPERATIONS — DOMAIN TYPES

   Coach-authored, athlete-approved operational systems: supplement
   protocols, consent-gated clinical coordination (documentation only),
   nutrition architecture, meal plans, preparation operations, grocery
   command, lifestyle orchestration, and daily direction.

   HARD BOUNDARIES (enforced in copy, repositories, and engines):
   Reserve documents and organizes — it never prescribes, diagnoses,
   recommends compounds or cycles, generates doses, or replaces a
   qualified clinician. Clinical records are athlete-disclosed or
   clinician-directed documentation ONLY.
   ════════════════════════════════════════════════════════════════════════ */

import type { PermissionLevel } from "../types";

/* ─── Shared versioned-record base ────────────────────────────────────── */

export type AthleteDecision = "pending" | "accepted" | "revision_requested" | "declined";

export type OperationalStatus =
  | "draft"
  | "ready_for_review"
  | "sent"
  | "active"
  | "revision_requested"
  | "declined"
  | "paused"
  | "replaced"
  | "archived";

export type AuditEvent = {
  at: string;
  actorId: string;
  event: string;
  detail?: string;
};

export type VersionedRecordBase = {
  id: string;
  relationshipId: string;
  athleteId: string;
  coachId: string;
  status: OperationalStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  effectiveAt: string | null;
  createdBy: string;
  /** Prior version this record replaced — history is never overwritten. */
  supersedesId?: string;
  athleteDecision: AthleteDecision;
  athleteDecisionNote?: string;
  auditEvents: AuditEvent[];
};

/* ─── Supplement protocols (ordinary wellness products only) ──────────── */

export type SupplementCategory =
  | "performance"
  | "recovery"
  | "hydration"
  | "sleep"
  | "digestion"
  | "general_wellness"
  | "pre_training"
  | "intra_training"
  | "post_training"
  | "micronutrient"
  | "custom";

/** Athlete-experience grouping — moments, never a spreadsheet. */
export type ProtocolMoment =
  | "upon_waking"
  | "first_meal"
  | "pre_training"
  | "during_training"
  | "post_training"
  | "evening"
  | "before_sleep";

export const PROTOCOL_MOMENTS: ProtocolMoment[] = [
  "upon_waking", "first_meal", "pre_training", "during_training",
  "post_training", "evening", "before_sleep",
];

export const PROTOCOL_MOMENT_LABELS: Record<ProtocolMoment, string> = {
  upon_waking: "Upon Waking",
  first_meal: "First Meal",
  pre_training: "Pre-Training",
  during_training: "During Training",
  post_training: "Post-Training",
  evening: "Evening",
  before_sleep: "Before Sleep",
};

export type SupplementProtocolItem = {
  id: string;
  productName: string;
  isCustomProduct: boolean;
  category: SupplementCategory;
  /** Coach-entered serving text (e.g. "1 scoop", "5 g"). Reserve never computes doses. */
  servingDescription: string;
  moment: ProtocolMoment;
  frequency: "daily" | "training_days" | "rest_days" | "weekly" | "as_directed_by_coach";
  purpose: string;
  withFood: "with_food" | "empty_stomach" | "either";
  brandPreference?: string;
  purchaseStatus: "owned" | "needs_purchase" | "ordered";
  remainingSupplyEstimate?: string;
  runningLow: boolean;
  coachNote?: string;
  athleteNote?: string;
  reminderEnabled: boolean;
};

export type SupplementProtocol = VersionedRecordBase & {
  name: string;
  objective: string;
  reviewDate: string | null;
  endDate: string | null;
  coachRationale: string;
  items: SupplementProtocolItem[];
  /** Item ids active on training days only / rest days only (empty = both). */
  trainingDayItemIds: string[];
  restDayItemIds: string[];
};

export type AdherenceMark = "taken" | "skipped" | "unavailable";

export type ProtocolAdherenceEntry = {
  id: string;
  protocolId: string;
  athleteId: string;
  itemId: string;
  date: string; // YYYY-MM-DD
  mark: AdherenceMark;
  note?: string;
  at: string;
};

/* ─── Clinical coordination (documentation only, consent-gated) ───────── */

export type ClinicalCategory =
  | "prescription_medication"
  | "hormone_therapy"
  | "peptide_record"
  | "sarm_disclosure"
  | "anabolic_agent_disclosure"
  | "other_clinician_directed"
  | "custom_clinical";

export const CLINICAL_CATEGORY_LABELS: Record<ClinicalCategory, string> = {
  prescription_medication: "Prescription Medication",
  hormone_therapy: "Hormone Therapy",
  peptide_record: "Peptide Record",
  sarm_disclosure: "SARM Disclosure",
  anabolic_agent_disclosure: "Anabolic Agent Disclosure",
  other_clinician_directed: "Other Clinician-Directed Compound",
  custom_clinical: "Custom Clinical Record",
};

/** The acknowledgement shown and stored before any sensitive save. */
export const CLINICAL_ACKNOWLEDGEMENT =
  "This entry documents athlete-disclosed or clinician-directed information. Reserve does not prescribe, diagnose, or determine medical suitability. Medication and compound decisions require qualified medical oversight.";

export type ClinicalConsentScope = "none" | "view" | "view_and_note";

export type ClinicalConsent = {
  id: string;
  relationshipId: string;
  athleteId: string;
  coachId: string;
  scope: ClinicalConsentScope;
  grantedAt: string;
  revokedAt?: string;
  /** The acknowledgement text as shown at grant time. */
  acknowledgement: string;
  history: Array<{ at: string; scope: ClinicalConsentScope; actorId: string }>;
};

export type ClinicalRecordStatus = "active" | "under_clinician_review" | "paused" | "closed";

export type ClinicalCoordinationRecord = {
  id: string;
  relationshipId: string;
  athleteId: string;
  /** Athlete-disclosed name exactly as the athlete or clinician stated it. */
  disclosedName: string;
  category: ClinicalCategory;
  clinicianOrPractice?: string;
  prescriptionStatus: "prescribed" | "athlete_disclosed" | "unspecified";
  startDate: string | null;
  reviewDate: string | null;
  /** Athlete-reported schedule/route — stored verbatim, never computed. */
  athleteReportedSchedule?: string;
  athleteReportedRoute?: string;
  documentationStatus: "documented" | "partial" | "pending_athlete";
  monitoringRequirements?: string;
  labReminderDate: string | null;
  followUpDate: string | null;
  supportingDocumentRef?: string;
  status: ClinicalRecordStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Stored acknowledgement — present on every record. */
  acknowledgement: string;
  auditEvents: AuditEvent[];
};

export type ClinicalObservationKind =
  | "energy" | "sleep" | "mood" | "appetite" | "training_performance"
  | "resting_heart_rate" | "blood_pressure" | "digestive" | "skin"
  | "injection_site" | "other";

export type ClinicalObservation = {
  id: string;
  recordId: string;
  athleteId: string;
  authorId: string;
  authorRole: "athlete" | "coach";
  at: string;
  kind: ClinicalObservationKind;
  /** Neutral report text. Reserve never interprets or diagnoses. */
  note: string;
  severity: "routine" | "notable" | "urgent";
};

export type ClinicalAccessLogEntry = {
  id: string;
  recordScopeAthleteId: string;
  accessorId: string;
  at: string;
  action: "viewed" | "created" | "updated" | "observation_added" | "consent_changed";
  detail?: string;
};

/* ─── Nutrition architecture ──────────────────────────────────────────── */

export type DayTargets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  waterLiters?: number;
  sodiumNote?: string;
  mealCount: number;
  feedingWindow?: string; // "8:00–20:00"
};

export type NutritionArchitecture = VersionedRecordBase & {
  name: string;
  trainingDay: DayTargets;
  restDay: DayTargets;
  highOutputDay?: DayTargets;
  travelDayNote?: string;
  refeedNote?: string;
  flexibleMealRules?: string;
  restaurantRules?: string;
  emergencyFallback?: string;
  /** Athlete context the plan is built around — coach-entered. */
  preferences: {
    likedFoods: string[];
    dislikedFoods: string[];
    allergies: string[];
    culturalPreferences?: string;
    digestiveLimitations?: string;
    weeklyBudget?: string;
    cookingSkill: "minimal" | "basic" | "confident" | "advanced";
    appliances: string[];
    groceryFrequency: "weekly" | "twice_weekly" | "as_needed";
    prepAvailability?: string;
    fastingPreference?: string;
    hydrationStrategy?: string;
  };
};

/* ─── Meal plans ──────────────────────────────────────────────────────── */

export type MealType =
  | "exact" | "flexible" | "macro_based" | "restaurant" | "travel" | "emergency";

export type MealIngredient = {
  name: string;
  portion: string; // "180 g", "1 cup"
  groceryCategory: GroceryCategory;
};

export type MealAlternative = {
  kind: "substitution" | "travel" | "restaurant" | "budget";
  description: string;
};

export type Meal = {
  id: string;
  name: string;
  timeWindow: string;
  objective?: string;
  mealType: MealType;
  ingredients: MealIngredient[];
  /** Coach estimates — presented as estimates, never lab-precise. */
  estMacros?: { kcal: number; protein: number; carbs: number; fat: number; fiber?: number };
  prepInstructions?: string;
  alternatives: MealAlternative[];
  allergyNote?: string;
  batchPrepEligible: boolean;
  storageGuidance?: string;
  reheatingGuidance?: string;
  coachNote?: string;
};

export type MealPlanScope =
  | "single_day" | "training_day" | "rest_day" | "seven_day" | "rotating_two_week" | "custom_phase";

export type MealPlanDay = {
  dayLabel: string; // "Monday" | "Training Day"
  mealIds: string[];
};

export type MealPlan = VersionedRecordBase & {
  name: string;
  scope: MealPlanScope;
  architectureId?: string;
  meals: Meal[];
  days: MealPlanDay[];
  coachNote?: string;
};

export type MealCompletionMark = "completed" | "partial" | "replaced" | "missed";

export type MealCompletionEntry = {
  id: string;
  planId: string;
  athleteId: string;
  mealId: string;
  date: string;
  mark: MealCompletionMark;
  note?: string;
  at: string;
};

export type MealFlag = {
  id: string;
  planId: string;
  athleteId: string;
  mealId: string;
  kind: "substitution_requested" | "disliked" | "unavailable";
  note?: string;
  at: string;
  resolved: boolean;
};

/* ─── Meal operations (preparation) ───────────────────────────────────── */

export type PreparedMealState = "planned" | "prepared" | "packed" | "consumed" | "expired";

export type PreparedMeal = {
  id: string;
  sessionId: string;
  mealId: string;
  mealName: string;
  servings: number;
  container?: string;
  storage: "refrigerator" | "freezer";
  state: PreparedMealState;
  expiresOn: string | null;
};

export type MealPrepSession = {
  id: string;
  relationshipId: string;
  athleteId: string;
  coachId: string;
  prepDate: string; // YYYY-MM-DD
  cookingWindow: string; // "14:00–16:30"
  planId: string;
  /** Meal id → servings to prepare. */
  servingsByMeal: Record<string, number>;
  preparedMeals: PreparedMeal[];
  status: "planned" | "in_progress" | "complete" | "disrupted";
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

/** Deterministic preparation sequence step. */
export type PrepStep = {
  order: number;
  phase: "preheat" | "long_cook" | "protein" | "starch" | "vegetable" | "portion" | "cool" | "store" | "clean";
  instruction: string;
};

/* ─── Grocery command ─────────────────────────────────────────────────── */

export type GroceryCategory =
  | "protein" | "produce" | "carbohydrates" | "fats" | "dairy_alternatives"
  | "frozen" | "pantry" | "hydration" | "seasonings" | "supplements" | "prep_supplies";

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  protein: "Protein",
  produce: "Produce",
  carbohydrates: "Carbohydrates",
  fats: "Fats",
  dairy_alternatives: "Dairy & Alternatives",
  frozen: "Frozen",
  pantry: "Pantry",
  hydration: "Hydration",
  seasonings: "Seasonings",
  supplements: "Supplements",
  prep_supplies: "Preparation Supplies",
};

export type StoreProfileKind =
  | "general_grocery" | "warehouse_club" | "organic_market" | "local_butcher" | "online_order" | "custom";

export type StoreProfile = {
  id: string;
  athleteId: string;
  name: string;
  kind: StoreProfileKind;
  note?: string;
};

export type GroceryItemState = "needed" | "purchased" | "unavailable" | "replaced";

export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  /** Which meals need it (names, for the coach/athlete context line). */
  usedIn: string[];
  preferredBrand?: string;
  approvedSubstitutes?: string[];
  addedBy: "plan" | "athlete" | "coach";
  required: boolean;
  state: GroceryItemState;
  replacementNote?: string;
  estimatedCost?: string;
  carryover: boolean;
};

export type PantryItem = {
  id: string;
  athleteId: string;
  name: string;
  quantity: string;
  runningLow: boolean;
  updatedAt: string;
};

export type GroceryPlan = {
  id: string;
  relationshipId: string;
  athleteId: string;
  coachId: string;
  weekOf: string; // Monday YYYY-MM-DD
  sourcePlanId: string | null;
  storeProfileId: string | null;
  budgetTarget?: string;
  estimatedSpend?: string;
  items: GroceryItem[];
  status: "open" | "shopping" | "complete";
  createdAt: string;
  updatedAt: string;
};

/* ─── Lifestyle orchestration ─────────────────────────────────────────── */

export type LifestyleCategory =
  | "wake" | "morning_prep" | "hydration" | "meal" | "work" | "school" | "commute"
  | "training" | "cardio" | "mobility" | "recovery" | "sauna" | "cold_exposure"
  | "walking" | "supplement_window" | "medical_reminder" | "family" | "childcare"
  | "grocery" | "meal_prep" | "reflection" | "meditation" | "reading"
  | "sleep_prep" | "bedtime" | "custom";

export type LifestyleEvent = {
  id: string;
  title: string;
  category: LifestyleCategory;
  day: string; // "Mon".."Sun"
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  location?: string;
  priority: "anchor" | "standard" | "optional";
  flexibility: "fixed" | "movable" | "flexible";
  required: boolean;
  dependsOnEventId?: string;
  prepBufferMinutes?: number;
  travelBufferMinutes?: number;
  coachNote?: string;
  athleteNote?: string;
  reminderEnabled: boolean;
  completed?: boolean;
};

export type LifestyleWeekKind =
  | "standard" | "alternate" | "travel" | "deload" | "competition" | "shift_work";

export type LifestylePlan = VersionedRecordBase & {
  name: string;
  weekKind: LifestyleWeekKind;
  events: LifestyleEvent[];
  /** One-time exceptions keyed by date. */
  exceptions: Array<{ date: string; note: string; eventIdsRemoved: string[]; eventsAdded: LifestyleEvent[] }>;
};

export type ScheduleConstraintKind =
  | "timing_conflict"
  | "insufficient_transition"
  | "compressed_recovery_window"
  | "insufficient_sleep_opportunity"
  | "missing_post_training_nutrition"
  | "schedule_density_elevated"
  | "meal_prep_conflict"
  | "execution_risk";

export type ScheduleConstraint = {
  id: string;
  kind: ScheduleConstraintKind;
  day: string;
  headline: string;
  detail: string;
  severity: "observation" | "attention";
  eventIds: string[];
};

export const CONSTRAINT_LABELS: Record<ScheduleConstraintKind, string> = {
  timing_conflict: "Timing Conflict",
  insufficient_transition: "Insufficient Transition Time",
  compressed_recovery_window: "Compressed Recovery Window",
  insufficient_sleep_opportunity: "Insufficient Sleep Opportunity",
  missing_post_training_nutrition: "Missing Post-Training Nutrition",
  schedule_density_elevated: "Schedule Density Elevated",
  meal_prep_conflict: "Meal-Prep Conflict",
  execution_risk: "Execution Risk",
};

/* ─── Daily Directive ─────────────────────────────────────────────────── */

export type DirectiveTone =
  | "measured" | "stoic" | "direct" | "reassuring" | "competitive" | "reflective" | "high_accountability";

export type DirectiveFocus =
  | "training_execution" | "nutrition_discipline" | "recovery" | "consistency"
  | "confidence" | "schedule_control" | "competition_preparation" | "lifestyle_order";

export type DirectivePreference = {
  relationshipId: string;
  athleteId: string;
  coachId: string;
  enabled: boolean;
  tone: DirectiveTone;
  focus: DirectiveFocus;
  frequency: "daily" | "training_days" | "weekly";
  deliveryWindow: "morning" | "midday" | "evening";
  length: "brief" | "standard";
  athleteSensitivity: "standard" | "gentle";
  includeQuotation: "none" | "quotation" | "scripture";
  privateCoachInstruction?: string;
  updatedAt: string;
};

export type DailyDirective = {
  id: string;
  relationshipId: string;
  athleteId: string;
  coachId: string;
  date: string;
  body: string;
  tone: DirectiveTone;
  focus: DirectiveFocus;
  /** Inputs the composer synthesized — kept for the coach's audit view. */
  basis: string[];
  status: "drafted" | "approved" | "delivered";
  createdAt: string;
  approvedAt?: string;
  /** Set when the athlete confirms they have seen and accepted this as
      today's direction. Awareness only — never treated as adherence proof. */
  acknowledgedAt?: string;
};

/* ─── Coach AI drafts (deterministic, editable, approval-required) ────── */

export type AIDraftKind =
  | "weekly_direction" | "adherence_summary" | "schedule_friction" | "checkin_questions"
  | "meal_adjustment" | "grocery_simplification" | "observation_summary"
  | "planned_vs_actual" | "review_brief" | "daily_directive";

export type CoachAIDraft = {
  id: string;
  coachId: string;
  athleteId: string;
  kind: AIDraftKind;
  title: string;
  body: string;
  basis: string[];
  status: "drafted" | "edited" | "approved" | "discarded";
  createdAt: string;
  updatedAt: string;
};

/* ─── Permission extension keys (implemented in ../types + permissions) ─ */

export type OperationsPermissionCategory =
  | "supplements"
  | "clinicalRecords"
  | "nutritionArchitecture"
  | "mealPlans"
  | "mealPreparation"
  | "grocery"
  | "lifestyleSchedule"
  | "dailyDirective";

export type OperationsPermissions = Record<OperationsPermissionCategory, PermissionLevel>;
