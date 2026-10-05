import type { FeatureKey, SubscriptionTier, UserPersona } from "@/lib/saas-config";
import type { ChannelVisibility, CommunityRole } from "@/lib/database/types";

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

export type MuscleScore = {
  muscleGroup: string;
  score: number;
  previousScore?: number | null;
  trend: "up" | "flat" | "down" | "unknown";
  observedAt: string;
};

export type WeakPoint = {
  muscleGroup: string;
  severity: "low" | "moderate" | "high";
  notes?: string | null;
  detectedAt: string;
};

export type DigitalTwinProfile = {
  userId: string;
  persona: UserPersona;
  archetype: PhysiqueArchetype;
  goalState: string;
  bodyMetrics: Record<string, number | null>;
  muscleScores: MuscleScore[];
  weakPoints: WeakPoint[];
  symmetryScore: number | null;
  projectionSummary?: string | null;
  capturedAt: string;
};

export type MuscleTarget = {
  bodyGroup: string;
  exactMuscle: string;
  role: "priority" | "secondary" | "abs" | "cardio" | "mobility";
  targetSets?: number;
  note?: string | null;
};

export type RIRTarget = {
  min: number;
  max: number;
  label: string;
};

export type TempoPrescription = {
  notation: string;
  eccentric: string;
  pause: string;
  concentric: string;
};

export type RestPrescription = {
  seconds: number;
  range: string;
  note: string;
};

export type ProgressionRule = {
  model: "double-progression" | "load-progression" | "rep-quality" | "volume-hold" | "recovery-gated";
  trigger: string;
  nextAction: string;
  deloadSignal?: string | null;
};

export type SubstitutionOption = {
  name: string;
  reason: string;
  equipment: string;
  preservesStimulus: string;
};

export type FatigueAdjustment = {
  readinessFloor: number;
  adjustment: string;
  notes: string;
};

export type StimulusFatigueProfile = {
  stimulusType: string;
  localFatigue: number;
  systemicFatigue: number;
  jointStress: "low" | "moderate" | "high";
  recoveryDemand: "low" | "moderate" | "high";
};

export type RecoveryGate = {
  status: "green" | "yellow" | "red";
  readinessScore: number | null;
  decision: string;
  adjustments: string[];
};

export type ExercisePrescription = {
  exerciseId?: string;
  name: string;
  bodyGroup?: string;
  exactMuscle?: string;
  stimulusType?: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  sets: number;
  repRange: string;
  reps?: string;
  rir?: RIRTarget;
  tempo?: TempoPrescription;
  rest?: RestPrescription;
  executionCue?: string;
  progressionRule?: ProgressionRule;
  substitutionOptions?: SubstitutionOption[];
  fatigueNotes?: string;
  stimulusFatigueProfile?: StimulusFatigueProfile;
  intensityTarget?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
};

export type SessionBlock = {
  id: string;
  title: string;
  intent: string;
  bodyGroups: string[];
  estimatedMinutes: number;
  exercises: ExercisePrescription[];
};

export type MesocycleState = {
  week: number;
  phase: "accumulation" | "intensification" | "specialization" | "deload" | "recovery";
  volumeBias: "low" | "moderate" | "high";
  intensityBias: "moderate" | "high";
  fatigueTrend: "low" | "stable" | "watch" | "high";
};

export type TrainingSessionPlan = {
  id: string;
  userId?: string;
  title: string;
  focus: string;
  athleteName?: string;
  goal?: string;
  experienceLevel?: UserPersona;
  splitName?: string;
  splitDay?: number;
  scheduledDay?: string;
  equipment?: string;
  estimatedDurationMinutes?: number;
  muscleTargets?: MuscleTarget[];
  blocks?: SessionBlock[];
  cardioMinutes?: number;
  saunaMinutes?: number;
  recoveryGate?: RecoveryGate;
  mesocycleState?: MesocycleState;
  scheduledFor?: string | null;
  readinessContext?: number | null;
  bodyGroups?: string[];
  exercises: ExercisePrescription[];
};

export type DailyMission = {
  title: string;
  trainingMission: TrainingSessionPlan;
  bodyGroups: string[];
  proteinTarget: string;
  hydrationTarget: string;
  steps: number;
  cardioMinutes: number;
  saunaMinutes: number;
  sleepTarget: string;
  completionPercent: number | null;
  priorityWarning: string;
  missionIntensity: "recovery" | "moderate" | "high" | "elite";
  coachNote: string;
  safetyNote: string;
};

export type NutritionMission = {
  title: string;
  /** null when no bodyweight was sent — no macro figures are invented. */
  trainingDayMacros: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  restDayMacros: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  highDay: string;
  lowDay: string;
  preWorkoutTiming: string;
  postWorkoutPriority: string;
  hydration: string;
  sodiumStrategyPlaceholder: string;
  bodyweightTrendAdjustment: string;
  adherenceScore: number | null;
  digestionNotes: string;
  coachNote: string;
  safetyNote: string;
};

export type RecoveryDecision = {
  title: string;
  /** null when no readiness was logged — no decision is made from missing data. */
  decision: "train hard" | "train moderate" | "recovery priority" | null;
  failurePermission: string;
  jointStress: "low" | "moderate" | "high" | null;
  cnsStress: "low" | "moderate" | "high" | null;
  volumeAdjustment: string;
  cardioRecommendation: string;
  saunaRecommendation: string;
  coachNote: string;
  safetyNote: string;
};

export type PhysiqueCritique = {
  title: string;
  weakPoints: string[];
  dominantBodyParts: string[];
  visualBottlenecks: string[];
  specializationRecommendation: string;
  /** Always null: Reserve does not score symmetry (DESIGN_BIBLE §02). Kept for response-shape compatibility. */
  symmetryScore: number | null;
  nextFocusBlock: string;
  coachNote: string;
  safetyNote: string;
};

export type ProjectionSnapshot = {
  week: 4 | 8 | 12;
  estimatedBodyweight: string;
  /** Always null: adherence is never forecast. */
  estimatedAdherence: number | null;
  visualSummary: string;
  riskNote: string;
  coachNote: string;
};

export type ProjectionReport = {
  title: string;
  snapshots: ProjectionSnapshot[];
  safetyNote: string;
};

export type CardioMission = {
  minutes: number;
  intensity: "easy" | "moderate" | "hard";
  modality: string;
  note: string;
};

export type SaunaMission = {
  minutes: number;
  hydrationReminder: string;
  note: string;
};

export type AbsMission = {
  movements: ExercisePrescription[];
  priority: "mandatory" | "optional";
  note: string;
};

export type TodaysCommand = {
  title: string;
  trainingMission: TrainingSessionPlan;
  nutritionMission: NutritionMission;
  recoveryDecision: RecoveryCommand;
  cardioMission: CardioMission;
  saunaMission: SaunaMission;
  absMission: AbsMission;
  completionPercent: number | null;
  topWarning: string;
  nextBestAction: string;
  startSessionCta: string;
  logMealCta: string;
  recoveryCheckCta: string;
  safetyNote: string;
};

export type ExerciseExecutionState = {
  exerciseId: string;
  exerciseName: string;
  prescribedSets: number;
  completedSets: number;
  currentSet: number;
  targetReps: string;
  targetRir: string;
  loadAdjustment: string;
  swapOptions: SubstitutionOption[];
  status: "pending" | "active" | "completed" | "swapped";
};

export type ActiveWorkoutSession = {
  sessionId: string;
  userId?: string;
  planId: string;
  title: string;
  startedAt: string;
  status: "active" | "completed" | "abandoned";
  currentExerciseId: string | null;
  exercises: ExerciseExecutionState[];
  restTimer: RestTimerMetadata | null;
  offlineSafe: boolean;
};

export type RestTimerMetadata = {
  startedAt: string;
  prescribedSeconds: number;
  remainingSeconds: number;
  nextAction: string;
};

export type SetCompletion = {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  load: number | null;
  reps: number;
  rir: number | null;
  completedAt: string;
  loadAdjustment: string;
  restTimer: RestTimerMetadata;
};

export type MovementSwap = {
  sessionId: string;
  exerciseId: string;
  originalExercise: string;
  replacementExercise: string;
  reason: string;
  preservesStimulus: string;
  swappedAt: string;
};

export type SessionCompletion = {
  sessionId: string;
  completedAt: string;
  completedExercises: number;
  completedSets: number;
  estimatedVolume: number;
  status: "completed" | "partial";
  coachNote: string;
};

export type ProgressionSnapshot = {
  title: string;
  /** null unless session history backs it — the AI service receives none. */
  beatLastWeek: boolean | null;
  addedReps: number | null;
  addedLoad: string;
  volumeProgression: string;
  bodyweightTrend: string;
  recoveryTrend: string;
  plateauDetection: "none" | "watch" | "plateau" | null;
  nextOverloadTarget: string;
  coachNote: string;
  safetyNote: string;
};

export type DigitalAthleteSnapshot = {
  title: string;
  todaysHighlightedMuscles: string[];
  laggingMuscles: string[];
  dominantMuscles: string[];
  recoveryZones: Array<{ zone: string; status: "fresh" | "trained" | "watch" | "recovering"; note: string }>;
  symmetryConcerns: string[];
  musclePriorityScore: Array<{ muscle: string; score: number; reason: string }>;
  physiqueStatusSummary: string;
  safetyNote: string;
};

export type PhysiqueCheckInPhotoMetadata = {
  angle: "front" | "side" | "back";
  storagePath?: string | null;
  fileName?: string | null;
  capturedAt?: string | null;
  lightingNotes?: string | null;
};

export type PhysiqueCheckIn = {
  id: string;
  userId?: string;
  checkInDate: string;
  photos: PhysiqueCheckInPhotoMetadata[];
  aiCritiquePlaceholder: string;
  laggingBodyParts: string[];
  strengths: string[];
  posingFeedback: string;
  nextFocusBlock: string;
  transformationNote: string;
  safetyNote: string;
};

export type NutritionCommand = {
  title: string;
  repeatYesterday: string;
  copyTrainingDay: string;
  copyRestDay: string;
  oneClickCombos: string[];
  restaurantEstimate: string;
  adherenceScore: number | null;
  missedMealWarning: string;
  proteinGap: string;
  hydrationGap: string;
  coachNote: string;
  safetyNote: string;
};

export type RecoveryCommand = {
  title: string;
  /** null when no readiness was logged — no decision is made from missing data. */
  decision: "train hard" | "train modified" | "recover today" | null;
  nervousSystemReadiness: string;
  jointWarning: string;
  sleepDebt: string;
  failurePermission: string;
  cardioIntensityRecommendation: string;
  saunaRecommendation: string;
  coachNote: string;
  safetyNote: string;
};

export type SimpleLanguageTerm = {
  key: string;
  plainLabel: string;
  shortDefinition: string;
};

export type MesocycleBlock = {
  id: string;
  userId?: string;
  name: string;
  style: string;
  goal: string;
  startsOn: string;
  endsOn: string;
  emphasisMuscles: string[];
  deloadPlanned: boolean;
  notes?: string | null;
};

export type RetentionSnapshot = {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  weeklyReadinessScore: number;
  adherenceScore: number;
  activationScore: number;
  churnRiskScore: number;
  completedMilestones: string[];
  lastCheckInAt?: string | null;
  updatedAt: string;
};

export type CommunityChannel = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  requiredTier: SubscriptionTier;
  kind: "discussion" | "challenge" | "check-in";
  pinnedMessageId?: string | null;
};

export type CommunityMessage = {
  id: string;
  channelId: string;
  userId: string;
  memberRole?: CommunityRole;
  memberRank?: string | null;
  parentId?: string | null;
  body: string;
  isPinned: boolean;
  checkInType?: "transformation" | "training" | "nutrition" | "recovery" | null;
  reactionCounts: Record<string, number>;
  createdAt: string;
  deletedAt?: string | null;
};

export type AICommandBrief = {
  title: string;
  summary: string;
  watchItems: string[];
  trainingFocus: string;
  retentionNote: string;
  upgradeTeaser: string;
  safetyNote: string;
};

export type UpgradeIntent = {
  userId?: string;
  feature: FeatureKey;
  requiredTier: SubscriptionTier;
  source: "locked-module" | "sidebar" | "dashboard-teaser" | "settings" | "checkout";
  count: number;
  lastSeenAt: string;
};

export type LeadMagnet =
  | "free-ai-body-assessment"
  | "free-training-split-generator"
  | "free-bloodwork-upload-preview"
  | "free-12-week-physique-projection";

export type LeadCapture = {
  id?: string;
  email: string;
  source: LeadMagnet;
  referralCode?: string | null;
  affiliateCode?: string | null;
  capturedAt?: string;
  metadata: Record<string, string | number | boolean | null>;
};
