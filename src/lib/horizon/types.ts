/* ════════════════════════════════════════════════════════════════════════
   PROGRAM HORIZON — the complete projected program.

   At activation Reserve generates EVERY week of the block, not just the
   current one. Week 8 exists the moment Week 1 begins.

   Future weeks are projections, not promises. They carry an explicit
   `projected` status and are revised — with a recorded reason and a
   preserved original — when readiness, performance, schedule, activity,
   or body-composition evidence says they should be.

   Completed weeks never mutate. Logged sessions stay frozen.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import type { BlueprintDay } from "@/lib/training/split-blueprints";
import type { PhaseKind } from "@/lib/training/protocol-dna";
import type { PersonalizedProtocolExplanation } from "@/lib/training/protocol-explanation";
import type { ProtocolSuitability } from "@/lib/training/protocol-suitability";

export const PROGRAM_HORIZON_VERSION = "program-horizon-1";

export type ProjectedWeekStatus =
  | "projected"
  | "active"
  | "revised"
  | "completed"
  | "deload"
  | "assessment";

export type ProgramPhase = {
  id: string;
  name: string;
  kind: PhaseKind;
  objective: string;
  weekStart: number;
  weekEnd: number;
  expectedAdaptation: string[];
  entryCriteria: string[];
  exitCriteria: string[];
};

export type ProjectedProgramWeek = {
  weekNumber: number;
  phaseId: string;
  phaseName: string;
  /** 1-based week within the phase. */
  phaseWeek: number;

  objective: string;
  expectedAdaptation: string[];

  /** The real 7-day structure for this week, Mon…Sun. */
  weeklyStructure: BlueprintDay[];

  volumeTarget: {
    /** e.g. "105% of baseline". */
    relativeLoad: string;
    /** Weekly working sets per region for this specific week. */
    setTargets: Record<string, number>;
  };

  intensityTarget: {
    effortRange: string;
    primaryLiftExposure?: string;
  };

  conditioningTarget?: {
    type: string;
    frequency: number;
    duration?: number;
    distance?: number;
    intensity?: string;
  };

  recoveryTarget: string[];
  nutritionDemand: string;

  athleteRationale: {
    whyThisWeekFitsNow: string[];
    whatThisWeekShouldDo: string[];
    watchItems: string[];
  };

  entryCriteria: string[];
  exitCriteria: string[];

  status: ProjectedWeekStatus;
  revisionReason?: string;
  /** Set when this week has been revised — the original is kept for inspection. */
  originalWeekNumber?: number;
};

export type ProgramRevisionSource = "reserve" | "athlete" | "coach";

export type ProgramRevision = {
  id: string;
  createdAt: string;
  effectiveWeek: number;

  source: ProgramRevisionSource;
  reason: string;
  affectedWeeks: number[];

  athleteContextChange?: string[];
  before: ProjectedProgramWeek[];
  after: ProjectedProgramWeek[];

  athleteConfirmed: boolean;

  /** Immutable activity snapshot when activity reconciliation caused this
      revision. Older persisted revisions legitimately omit it. */
  activity?: import("@/lib/schedule/activity-reconciliation").AthleteActivity;

  /** Present when this revision came from the Response Model, so the athlete
      can trace a change back to the insight and evidence behind it. */
  responseMetadata?: {
    recommendationId: string;
    insightIds: string[];
    evidenceIds: string[];
    responseModelVersion: string;
    approvedBy: "athlete" | "coach" | "reserve-low-risk-policy";
    approvedAt: string;
  };
};

export type ProgramHorizon = {
  programId: string;
  athleteId: string;
  protocolId: string;
  protocolName: string;
  architectureVersion: string;
  horizonVersion: string;
  athleteSnapshotVersion: string;

  /** The snapshot that CAUSED this recommendation. Never overwritten. */
  athleteSnapshot: AthleteContextSnapshot;

  totalWeeks: number;
  frequency: number;
  phases: ProgramPhase[];
  weeks: ProjectedProgramWeek[];

  /** The projection exactly as first generated — preserved through revisions. */
  originalWeeks: ProjectedProgramWeek[];
  revisions: ProgramRevision[];

  protocolSuitability: ProtocolSuitability;
  personalizedExplanation: PersonalizedProtocolExplanation;

  assumptions: string[];
  generatedAt: string;
  /** ISO date the block starts — drives which week is active. */
  startDate: string;
};
