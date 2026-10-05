/* ════════════════════════════════════════════════════════════════════════
   RESERVE RESPONSE MODEL — contracts.

   The Response Evidence Engine answers "what happened".
   The Response Model answers "what repeated pattern may this represent,
   how confident is Reserve, and what should Reserve recommend".

   The separation is deliberate and must be preserved:

     Response Evidence Engine  → immutable normalized facts
     Response Model            → repeated athlete-specific patterns
     Recommendation Engine     → proposed coaching changes
     Program Revision Engine   → applies approved changes to future weeks
     Decision History          → what was proposed and what was decided

   Nothing here diagnoses, prescribes medication, or claims causation.
   ════════════════════════════════════════════════════════════════════════ */

import type { EvidenceQuality } from "@/lib/response-evidence/types";

export const RESPONSE_MODEL_VERSION = "response-model-1";

/* ─── Shared vocabulary ───────────────────────────────────────────────── */

export type ResponseConfidence = "insufficient" | "emerging" | "moderate" | "established";

export type ResponseDomainName =
  | "volume"
  | "frequency"
  | "exercise"
  | "performance"
  | "recovery"
  | "conditioning"
  | "body-composition"
  | "nutrition"
  | "adherence"
  | "pain";

export const RESPONSE_DOMAIN_NAMES: ResponseDomainName[] = [
  "volume", "frequency", "exercise", "performance", "recovery",
  "conditioning", "body-composition", "nutrition", "adherence", "pain",
];

export const DOMAIN_LABEL: Record<ResponseDomainName, string> = {
  volume: "Volume",
  frequency: "Frequency",
  exercise: "Exercise",
  performance: "Performance",
  recovery: "Recovery",
  conditioning: "Conditioning",
  "body-composition": "Body composition",
  nutrition: "Nutrition",
  adherence: "Adherence",
  pain: "Pain",
};

export type ResponseDomainStatus =
  | "insufficient-data"
  | "learning"
  | "pattern-detected"
  | "stable"
  | "conflicted";

export type ResponseInsightStatus =
  | "insufficient"
  | "emerging"
  | "active"
  | "established"
  | "conflicted"
  | "weakening"
  | "superseded"
  | "expired"
  | "archived";

/** Statuses that no longer live in the active set. */
export const ARCHIVED_INSIGHT_STATUSES: ResponseInsightStatus[] = ["superseded", "expired", "archived"];

export type ResponseTargetType =
  | "muscle"
  | "movement-pattern"
  | "exercise"
  | "session"
  | "week"
  | "conditioning-modality"
  | "body-composition-phase"
  | "nutrition-pattern"
  | "schedule-pattern";

/* ─── Domain model ────────────────────────────────────────────────────── */

export type ResponseDomainModel = {
  status: ResponseDomainStatus;
  activeInsightIds: string[];
  archivedInsightIds: string[];
  evidenceCount: number;
  comparableEvidenceCount: number;
  contradictingEvidenceCount: number;
  confidence: ResponseConfidence;
  lastUpdatedAt?: string;
};

/* ─── Insight ─────────────────────────────────────────────────────────── */

export type ResponseInsightDirection = "positive" | "negative" | "mixed" | "neutral" | "unknown";

export type ResponseInsight = {
  id: string;
  athleteId: string;

  domain: ResponseDomainName;
  targetType: ResponseTargetType;
  targetId: string;
  targetLabel: string;

  /** Stable identity for "the same persistent pattern" across rebuilds. */
  patternKey: string;

  /** What was observed, stated as fact. */
  finding: string;
  /** What it may represent, stated with appropriate hedging. */
  interpretation: string;

  status: ResponseInsightStatus;
  confidence: ResponseConfidence;

  sample: {
    totalObservations: number;
    comparableObservations: number;
    supportingObservations: number;
    contradictingObservations: number;
    firstObservedAt: string;
    lastObservedAt: string;
    phasesRepresented: string[];
    weeksRepresented: number[];
  };

  evidence: {
    supportingEvidenceIds: string[];
    contradictingEvidenceIds: string[];
    excludedEvidenceIds: string[];
    exclusionReasons: Record<string, string>;
  };

  magnitude?: {
    direction: ResponseInsightDirection;
    description: string;
  };

  recommendationEligibility: {
    eligible: boolean;
    reason: string;
  };

  limitations: string[];

  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  supersededByInsightId?: string;
  /** Why an archived insight left the active set. */
  archiveReason?: string;

  /** Context the insight was formed in — used for supersession and expiry. */
  context: {
    phaseId?: string;
    nutritionPhase?: string;
    programId?: string;
  };
};

/* ─── Confidence ──────────────────────────────────────────────────────── */

export type ResponseConfidenceInput = {
  comparableObservations: number;
  supportingObservations: number;
  contradictingObservations: number;
  weeksRepresented: number;
  phasesRepresented: number;
  evidenceQuality: EvidenceQuality[];
  missingCriticalContext: string[];
  /** Distinct calendar dates the observations fall on. Many records on one
      day must never read as a repeated pattern. */
  distinctDates?: number;
};

export type ResponseConfidenceResult = {
  confidence: ResponseConfidence;
  score: number;
  supportingReasons: string[];
  limitingReasons: string[];
};

/* ─── Contradiction ───────────────────────────────────────────────────── */

export type ContradictionEffect =
  | "none"
  | "limits-confidence"
  | "weakens-insight"
  | "conflicts-insight"
  | "supersedes-insight";

export type ResponseContradictionAssessment = {
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  contradictionRatio: number;
  effect: ContradictionEffect;
  explanation: string;
};

/* ─── Recommendation ──────────────────────────────────────────────────── */

export type RecommendationCategory =
  | "maintain"
  | "volume-adjustment"
  | "frequency-adjustment"
  | "exercise-promotion"
  | "exercise-substitution"
  | "exercise-regression"
  | "conditioning-adjustment"
  | "recovery-adjustment"
  | "schedule-adjustment"
  | "deload"
  | "nutrition-review"
  | "adherence-review"
  | "professional-review";

export type RecommendationScope =
  | "current-session"
  | "next-session"
  | "current-week"
  | "future-weeks"
  | "next-phase";

export type RecommendationMateriality = "informational" | "low" | "moderate" | "high";

export type RecommendationDecision =
  | "pending"
  | "accepted"
  | "declined"
  | "deferred"
  | "expired"
  | "applied";

export type ResponseRecommendation = {
  id: string;
  athleteId: string;
  programId: string;

  insightIds: string[];
  evidenceIds: string[];

  category: RecommendationCategory;
  scope: RecommendationScope;

  summary: string;
  reason: string;

  expectedEffect: string[];
  tradeoffs: string[];

  whatChanges: string[];
  whatRemainsUnchanged: string[];

  confidence: ResponseConfidence;
  materiality: RecommendationMateriality;

  approval: {
    required: boolean;
    reason: string;
  };

  decision: RecommendationDecision;
  /** Recorded when the athlete decides. */
  decidedAt?: string;
  decisionNote?: string;
  /** Set when accepted and applied — links to the ProgramRevision. */
  appliedRevisionId?: string;

  /** Structured change the revision engine applies. Never free text. */
  adjustment?: ResponseAdjustment;

  createdAt: string;
  effectiveWeek?: number;
  expiresAt?: string;
  /** After a decline, the same recommendation must not resurface until this. */
  suppressedUntil?: string;
};

/** The structured, machine-applicable part of a recommendation. */
export type ResponseAdjustment = {
  kind:
    | "weekly-volume"
    | "conditioning-duration"
    | "conditioning-separation"
    | "exercise-preference"
    | "frequency"
    | "deload"
    | "none";
  /** Multiplier applied to future weekly set targets, when relevant. */
  volumeMultiplier?: number;
  /** Multiplier applied to future conditioning duration, when relevant. */
  conditioningMultiplier?: number;
  /** Region or target the change applies to, when scoped. */
  targetId?: string;
  /** Preferred exercise id when promoting a variation. */
  preferredExerciseId?: string;
  /** Deprioritised exercise id when substituting. */
  deprioritisedExerciseId?: string;
  /** Minimum hours Reserve wants between conditioning and lower training. */
  minimumSeparationHours?: number;
};

/* ─── Revision metadata ───────────────────────────────────────────────── */

export type ResponseDrivenRevisionMetadata = {
  recommendationId: string;
  insightIds: string[];
  evidenceIds: string[];
  responseModelVersion: string;
  approvedBy: "athlete" | "coach" | "reserve-low-risk-policy";
  approvedAt: string;
};

/* ─── The model ───────────────────────────────────────────────────────── */

export type ResponseDataQuality = {
  finalizedSessions: number;
  completedWeeks: number;
  comparableExerciseObservations: number;
  activityObservations: number;
  readinessObservations: number;
  sleepObservations: number;
  painObservations: number;
  bodyWeightObservations: number;
  nutritionObservations: number;
  overallConfidence: ResponseConfidence;
  missingDomains: ResponseDomainName[];
};

export type AthleteResponseModel = {
  athleteId: string;
  modelVersion: string;

  createdAt: string;
  updatedAt: string;

  dataQuality: ResponseDataQuality;

  domains: Record<ResponseDomainName, ResponseDomainModel>;

  activeInsights: ResponseInsight[];
  archivedInsights: ResponseInsight[];
  pendingRecommendations: ResponseRecommendation[];
  resolvedRecommendations: ResponseRecommendation[];

  lastProcessedEvidenceAt?: string;
  lastProcessedEvidenceIds: string[];

  assumptions: string[];
};

/* ─── Weekly review ───────────────────────────────────────────────────── */

export type WeeklyResponseReview = {
  programId: string;
  weekNumber: number;
  completedAt?: string;

  evidenceSummary: {
    completedSessions: number;
    partialSessions: number;
    skippedSessions: number;
    replacementActivities: number;
    comparableObservations: number;
  };

  stablePatterns: string[];
  emergingPatterns: string[];
  contradictedPatterns: string[];

  maintainDecisions: string[];
  recommendations: string[];

  missingData: string[];

  confidence: ResponseConfidence;
};

/* ─── Optimization log events ─────────────────────────────────────────── */

export type ResponseEventType =
  | "insight-emerged"
  | "insight-strengthened"
  | "insight-weakened"
  | "insight-conflicted"
  | "insight-superseded"
  | "insight-expired"
  | "insight-archived"
  | "recommendation-created"
  | "recommendation-accepted"
  | "recommendation-declined"
  | "recommendation-deferred"
  | "program-revised";

export const RESPONSE_EVENT_LABEL: Record<ResponseEventType, string> = {
  "insight-emerged": "Insight emerged",
  "insight-strengthened": "Insight strengthened",
  "insight-weakened": "Insight weakened",
  "insight-conflicted": "Insight conflicted",
  "insight-superseded": "Insight superseded",
  "insight-expired": "Insight expired",
  "insight-archived": "Insight archived",
  "recommendation-created": "Recommendation created",
  "recommendation-accepted": "Recommendation accepted",
  "recommendation-declined": "Recommendation declined",
  "recommendation-deferred": "Recommendation deferred",
  "program-revised": "Program revised",
};

export type ResponseEvent = {
  id: string;
  type: ResponseEventType;
  at: string;
  domain?: ResponseDomainName;
  targetLabel?: string;
  observation: string;
  decision: string;
  reason: string;
  confidence: ResponseConfidence;
  affectedWeeks: number[];
  athleteDecision?: "accepted" | "declined" | "deferred" | "not-required";
};
