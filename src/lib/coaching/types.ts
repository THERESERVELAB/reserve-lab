/* ════════════════════════════════════════════════════════════════════════
   RESERVE COACHING OS — DOMAIN TYPES

   The coaching workspace is a separate domain from the athlete store: it
   has its own entities, its own repositories, and its own persistence
   namespace. Nothing in here writes to the athlete member-state contract.

   NOTE ON IMPORTS: this domain intentionally uses RELATIVE imports only so
   the pure-domain layer (types, engine, repositories) can be compiled and
   tested standalone by tsc/node without bundler path aliases.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Identity ────────────────────────────────────────────────────────── */

export type ReserveTier = "core" | "premium_personal" | "premium_coach";

export type MemberRole = "athlete" | "coach";

export type ReserveMember = {
  id: string;
  name: string;
  email: string;
  /** Optional — never the primary identity. Future SMS/verification only. */
  phone?: string;
  tier: ReserveTier;
  /** Short public handle a coach may share, e.g. "@marcushale". */
  handle?: string;
  createdAt: string;
  /** Synthetic fixture members are flagged so demo data is never mistaken for real records. */
  isDemo?: boolean;
};

export type CoachProfile = {
  memberId: string;
  displayName: string;
  headline: string;
  /** Invitation/connection code athletes can enter, e.g. "HALE-2291". */
  coachCode: string;
  specialties: string[];
  acceptingClients: boolean;
};

export type AthleteProfile = {
  memberId: string;
  goal: string;
  phase: string;
  phaseWeek: number;
  phaseTotalWeeks: number;
  currentProgramName: string | null;
  heightLabel?: string;
  startingWeightLb?: number;
};

/* ─── Permissions ─────────────────────────────────────────────────────── */

export type PermissionLevel = "none" | "view" | "suggest" | "manage";

export type PhotoAccessLevel = "none" | "view" | "annotate" | "full";

export type PhysiquePhotoPermissions = {
  access: PhotoAccessLevel;
  mayRequestUploads: boolean;
  mayDownloadOriginals: boolean;
};

export type PermissionCategory =
  | "training"
  | "nutrition"
  | "schedule"
  | "recovery"
  | "checkIns"
  | "weightTrends"
  | "measurements"
  | "biomarkers"
  | "messaging"
  | "liveDayOverrides"
  /* Performance Operations */
  | "supplements"
  | "clinicalRecords"
  | "nutritionArchitecture"
  | "mealPlans"
  | "mealPreparation"
  | "grocery"
  | "lifestyleSchedule"
  | "dailyDirective";

export type CoachingPermissions = {
  training: PermissionLevel;
  nutrition: PermissionLevel;
  schedule: PermissionLevel;
  recovery: PermissionLevel;
  checkIns: PermissionLevel;
  weightTrends: PermissionLevel;
  measurements: PermissionLevel;
  biomarkers: PermissionLevel;
  messaging: PermissionLevel;
  liveDayOverrides: PermissionLevel;
  /* Performance Operations. clinicalRecords additionally requires an active
     ClinicalConsent — the permission level alone never opens clinical data,
     and full coaching access never includes it. */
  supplements: PermissionLevel;
  clinicalRecords: PermissionLevel;
  nutritionArchitecture: PermissionLevel;
  mealPlans: PermissionLevel;
  mealPreparation: PermissionLevel;
  grocery: PermissionLevel;
  lifestyleSchedule: PermissionLevel;
  dailyDirective: PermissionLevel;
  physiquePhotos: PhysiquePhotoPermissions;
};

/** Immutable record of every grant/change/revoke on a relationship. */
export type PermissionAuditRecord = {
  id: string;
  relationshipId: string;
  grantedByMemberId: string;
  grantedToMemberId: string;
  at: string;
  action: "granted" | "updated" | "revoked";
  snapshot: CoachingPermissions;
  note?: string;
};

/* ─── Relationship + invitation ───────────────────────────────────────── */

export type RelationshipStatus = "pending" | "active" | "paused" | "archived" | "revoked";

export type DayOverrideAuthority =
  | "athlete_only"
  | "coach_suggests"
  | "coach_can_apply"
  | "reserve_suggests"
  | "reserve_auto_with_approval";

export type CoachingRelationship = {
  id: string;
  coachId: string;
  athleteId: string;
  status: RelationshipStatus;
  permissions: CoachingPermissions;
  overrideAuthority: DayOverrideAuthority;
  startedAt: string;
  updatedAt: string;
  pausedAt?: string;
  revokedAt?: string;
  /** Which side initiated the connection. */
  initiatedBy: "coach" | "athlete";
  sourceInvitationId?: string;
};

export type InvitationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export type CoachingInvitation = {
  id: string;
  coachId: string;
  /** Set once an existing member matches; email invitations start unmatched. */
  athleteMemberId?: string;
  athleteName: string;
  athleteEmail: string;
  athletePhone?: string;
  requestedPermissions: CoachingPermissions;
  welcomeNote?: string;
  /** Human-enterable connection code, e.g. "RSV-8F2K". */
  connectionCode: string;
  /** Copyable deep link (simulated locally — no email is actually sent). */
  invitationLink: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
  /** Athlete-initiated requests point the other way. */
  direction: "coach_to_athlete" | "athlete_to_coach";
  /** Preserved when an athlete request returns to the athlete for final consent. */
  initiatedBy?: "coach" | "athlete";
};

/* ─── Client surfaces ─────────────────────────────────────────────────── */

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export type ClientSummary = {
  relationshipId: string;
  athleteId: string;
  name: string;
  goal: string;
  phase: string;
  phaseWeek: number;
  phaseTotalWeeks: number;
  programName: string | null;
  status: RelationshipStatus;
  lastCheckInAt: string | null;
  weightTrend: { direction: TrendDirection; weeklyDeltaLb: number | null };
  adherencePct: number | null;
  recoveryPosture: "stable" | "declining" | "improving" | "unknown";
  unreadMessages: number;
  newPhotoSets: number;
  permissionSummary: "full" | "custom" | "view-only" | "minimal";
  liveDayState: "original" | "adapted" | "awaiting_review" | "conflict" | "none";
};

export type AlertSeverity = "info" | "attention" | "priority" | "urgent";

export type AlertStatus = "open" | "reviewed" | "snoozed" | "resolved" | "dismissed";

export type ClientAlertKind =
  | "checkin_overdue"
  | "missed_sessions"
  | "training_adherence_decline"
  | "nutrition_adherence_decline"
  | "recovery_decline"
  | "weight_rate_out_of_range"
  | "live_day_awaiting_review"
  | "program_expiring"
  | "athlete_requested_help"
  | "new_photos"
  | "permission_change"
  | "unread_messages";

export type ClientAlert = {
  id: string;
  athleteId: string;
  relationshipId: string;
  kind: ClientAlertKind;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  headline: string;
  /** Evidence lines — factual observations only, never diagnoses. */
  evidence: string[];
  recommendedAction: { label: string; target: "client" | "checkin" | "live_day" | "messages" };
};

export type CoachNoteCategory =
  | "general"
  | "weight"
  | "training"
  | "nutrition"
  | "recovery"
  | "check-in"
  | "photos"
  | "live-day";

export type CoachNote = {
  id: string;
  coachId: string;
  athleteId: string;
  createdAt: string;
  updatedAt: string;
  category: CoachNoteCategory;
  body: string;
  visibility: "private" | "athlete_visible";
  linkedCheckInId?: string;
  linkedPrescriptionId?: string;
  linkedPhotoSetId?: string;
  linkedOverrideId?: string;
};

/* ─── Messaging ───────────────────────────────────────────────────────── */

export type StructuredActionKind =
  | "training_plan"
  | "nutrition_adjustment"
  | "schedule_adjustment"
  | "live_day_override"
  | "checkin_request"
  | "photo_request"
  | "weight_update_request"
  | "readiness_request"
  | "recovery_assignment"
  | "cardio_prescription"
  | "program_revision"
  | "live_day_detected";

export type StructuredMessageAction = {
  kind: StructuredActionKind;
  title: string;
  /** Label/value rows rendered on the action card. */
  rows: Array<{ label: string; value: string }>;
  ctaLabel: string;
  /** What the CTA opens on the receiving side. */
  ctaTarget: "prescription" | "live_day" | "checkin" | "photos" | "none";
  linkedPrescriptionId?: string;
  linkedOverrideId?: string;
  linkedCheckInId?: string;
  status?: "pending" | "reviewed" | "actioned";
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  sentAt: string;
  body: string;
  action?: StructuredMessageAction;
};

export type Conversation = {
  id: string;
  relationshipId: string;
  coachId: string;
  athleteId: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /** Per-member id → ISO timestamp of last read. */
  lastReadAt: Record<string, string>;
};

/* ─── Prescriptions ───────────────────────────────────────────────────── */

export type PrescriptionCategory = "training" | "nutrition" | "schedule";

export type PrescriptionStatus =
  | "draft"
  | "ready_for_review"
  | "sent"
  | "accepted"
  | "active"
  | "rejected"
  | "revision_requested"
  | "replaced"
  | "archived";

export type PrescriptionAuditEntry = {
  at: string;
  actorId: string;
  event: string;
  detail?: string;
};

export type TrainingPrescriptionDay = {
  dayLabel: string; // "Monday" | "Day 1"
  title: string;
  focus: string;
  demand: "recovery" | "standard" | "high" | "elite";
  exercises: Array<{
    name: string;
    sets: number;
    reps: string; // "8-10"
    rir?: string; // "1-2 RIR" | "RPE 8"
    tempo?: string;
    restSeconds?: number;
    substitution?: string;
    note?: string;
  }>;
  cardio?: string;
  isRest?: boolean;
};

export type TrainingPrescription = {
  programName: string;
  durationWeeks: number;
  splitName: string;
  daysPerWeek: number;
  days: TrainingPrescriptionDay[];
  progressionStrategy: string;
  deloadWeek: number | null;
  coachingNotes?: string;
};

export type NutritionMode = "macro" | "exact_meals" | "meal_template" | "hybrid";

export type PrescribedMeal = {
  name: string;
  timeWindow: string; // "7:00–7:45 AM"
  foods: Array<{ food: string; portion: string }>;
  estMacros?: { kcal: number; protein: number; carbs: number; fat: number };
  substitutions?: string[];
  prepNotes?: string;
  tags?: Array<"pre-training" | "post-training" | "flexible">;
};

export type NutritionTargets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  waterLiters?: number;
  sodiumNote?: string;
  mealCount: number;
};

export type NutritionPrescription = {
  planName: string;
  mode: NutritionMode;
  trainingDay: NutritionTargets;
  restDay: NutritionTargets;
  meals: PrescribedMeal[];
  coachingNotes?: string;
};

export type ScheduleBlock = {
  id: string;
  label: string;
  kind:
    | "wake"
    | "meal"
    | "training"
    | "cardio"
    | "work"
    | "steps"
    | "mobility"
    | "recovery"
    | "check-in"
    | "photos"
    | "travel"
    | "activity"
    | "appointment"
    | "bed";
  time: string; // "HH:MM" 24h
  durationMinutes?: number;
  detail?: string;
};

export type SchedulePrescription = {
  planName: string;
  wakeTarget: string;
  bedTarget: string;
  trainingTime: string;
  trainingDays: string[]; // ["Mon","Tue",...]
  checkInDay: string;
  photoDay: string | null;
  blocks: ScheduleBlock[];
  stepsTarget?: number;
  cardioNote?: string;
  coachingNotes?: string;
};

export type PrescriptionPayload =
  | { category: "training"; training: TrainingPrescription }
  | { category: "nutrition"; nutrition: NutritionPrescription }
  | { category: "schedule"; schedule: SchedulePrescription };

export type CoachPrescription = {
  id: string;
  /** Stable across versions; each revision is a new record sharing lineageId. */
  lineageId: string;
  version: number;
  coachId: string;
  athleteId: string;
  category: PrescriptionCategory;
  title: string;
  summaryOfChanges: string[];
  reason: string;
  status: PrescriptionStatus;
  payload: PrescriptionPayload;
  createdAt: string;
  updatedAt: string;
  effectiveDate: string | null;
  sentAt?: string;
  respondedAt?: string;
  athleteResponseNote?: string;
  previousVersionId?: string;
  audit: PrescriptionAuditEntry[];
};

/* ─── Live day ────────────────────────────────────────────────────────── */

export type DayTimelineEntryKind = ScheduleBlock["kind"];

export type DayTimelineEntry = {
  id: string;
  kind: DayTimelineEntryKind;
  label: string;
  time: string; // "HH:MM"
  durationMinutes?: number;
  detail?: string;
  /** Marks entries the athlete has already completed — never rescheduled. */
  completed?: boolean;
};

export type DayPlanVersion = {
  id: string;
  createdAt: string;
  createdBy: "athlete" | "coach" | "reserve";
  wakeTime: string;
  bedTime: string;
  trainingTime: string | null;
  sessionTitle: string | null;
  sessionDemand: "recovery" | "standard" | "high" | "elite" | null;
  entries: DayTimelineEntry[];
};

export type LiveDayReason =
  | "late_wake"
  | "training_time_change"
  | "missed_meal"
  | "poor_sleep"
  | "low_readiness"
  | "pain_observation"
  | "work_change"
  | "travel_delay"
  | "equipment_change"
  /* Performance Operations disruptions */
  | "training_canceled"
  | "grocery_incomplete"
  | "meal_prep_unavailable"
  | "family_commitment"
  | "sleep_interrupted"
  | "stress_elevated"
  | "restaurant_meal"
  | "custom";

export type LiveDayOverrideStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "rejected"
  | "superseded";

export type LiveDayOverride = {
  id: string;
  athleteId: string;
  date: string; // "YYYY-MM-DD"
  source: "athlete" | "coach" | "reserve";
  createdBy: string; // member id ("reserve" for engine)
  reason: LiveDayReason;
  originalSnapshot: DayPlanVersion;
  proposedSnapshot: DayPlanVersion;
  finalSnapshot?: DayPlanVersion;
  status: LiveDayOverrideStatus;
  /** Plain-language rationale lines shown to both sides. */
  explanation: string[];
  impactSummary: string[];
  warnings: string[];
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
  responseNote?: string;
};

export type ActiveDayPlanStatus =
  | "original"
  | "adapted"
  | "coach_override"
  | "awaiting_approval"
  | "conflict";

export type ActiveDayPlan = {
  id: string;
  athleteId: string;
  date: string;
  originalVersion: DayPlanVersion;
  liveVersion: DayPlanVersion;
  status: ActiveDayPlanStatus;
  lastUpdatedAt: string;
  lastUpdatedBy: "athlete" | "coach" | "reserve";
  activeOverrideId?: string;
  /** Ids of overrides currently in conflict (both proposed, unresolved). */
  conflictOverrideIds?: string[];
};

export type LiveDayTimelineEvent = {
  id: string;
  athleteId: string;
  date: string;
  at: string;
  actor: "athlete" | "coach" | "reserve";
  actorId: string;
  summary: string;
};

/* ─── Check-ins, reviews, tracking ────────────────────────────────────── */

export type CheckInScale = 1 | 2 | 3 | 4 | 5;

export type WeeklyCheckIn = {
  id: string;
  athleteId: string;
  relationshipId: string;
  weekOf: string; // "YYYY-MM-DD" (Monday)
  submittedAt: string;
  weightLb: number | null;
  weeklyAvgWeightLb: number | null;
  trainingAdherencePct: number;
  nutritionAdherencePct: number;
  /* 1–5 scales. Null = the athlete left it unanswered; never shown as a number. */
  sleepQuality: CheckInScale | null;
  energy: CheckInScale | null;
  recovery: CheckInScale | null;
  stress: CheckInScale | null;
  hunger: CheckInScale | null;
  digestion: CheckInScale | null;
  painObservations: string;
  cardioCompleted: string;
  stepsAvg: number | null;
  update: string;
  questionsForCoach: string;
  photoSetId?: string;
  reviewId?: string;
};

export type CoachReviewDecision =
  | "keep_plan"
  | "adjust_training"
  | "adjust_nutrition"
  | "adjust_schedule"
  | "request_info";

export type CoachReview = {
  id: string;
  checkInId: string;
  coachId: string;
  athleteId: string;
  createdAt: string;
  completedAt: string | null;
  decisions: CoachReviewDecision[];
  summary: string;
  athleteVisibleNote: string;
  linkedPrescriptionIds: string[];
};

export type WeightEntry = {
  id: string;
  athleteId: string;
  date: string; // "YYYY-MM-DD"
  weightLb: number;
  note?: string;
};

export type PhotoPose =
  | "front_relaxed"
  | "side_relaxed"
  | "back_relaxed"
  | "front_double_biceps"
  | "side_chest"
  | "back_double_biceps"
  | "custom";

export type PhysiquePhotoRecord = {
  id: string;
  setId: string;
  athleteId: string;
  date: string;
  checkInWeek: string | null;
  pose: PhotoPose;
  bodyweightLb: number | null;
  phase: string;
  lighting: "consistent" | "inconsistent" | "unknown";
  /** Local demo assets are synthetic placeholders — never real member photos. */
  src: string;
  athleteNote?: string;
  coachVisibleNote?: string;
  retakeRequested?: boolean;
};

/* ─── Templates ───────────────────────────────────────────────────────── */

export type TemplateCategory =
  | "training_program"
  | "workout"
  | "nutrition_plan"
  | "meal"
  | "weekly_schedule"
  | "checkin_form"
  | "cardio_plan"
  | "recovery_routine";

export type CoachTemplate = {
  id: string;
  coachId: string;
  category: TemplateCategory;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  /** Category-specific payload; training/nutrition/schedule reuse prescription shapes. */
  payload:
    | { category: "training_program"; training: TrainingPrescription }
    | { category: "nutrition_plan"; nutrition: NutritionPrescription }
    | { category: "weekly_schedule"; schedule: SchedulePrescription }
    | { category: "workout"; day: TrainingPrescriptionDay }
    | { category: "meal"; meal: PrescribedMeal }
    | { category: "checkin_form"; fields: string[] }
    | { category: "cardio_plan"; description: string; sessionsPerWeek: number }
    | { category: "recovery_routine"; description: string; tasks: string[] };
};

export type CoachTemplateAssignment = {
  id: string;
  templateId: string;
  coachId: string;
  athleteId: string;
  assignedAt: string;
};

/* ─── Activity feed ───────────────────────────────────────────────────── */

export type CoachActivityEvent = {
  id: string;
  coachId: string;
  athleteId: string | null;
  at: string;
  kind:
    | "invitation_sent"
    | "invitation_accepted"
    | "program_published"
    | "schedule_accepted"
    | "checkin_submitted"
    | "photos_uploaded"
    | "override_applied"
    | "permission_changed"
    | "note_added"
    | "review_completed";
  summary: string;
};
