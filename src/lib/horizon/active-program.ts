/* ════════════════════════════════════════════════════════════════════
   ACTIVE PROGRAM RESOLUTION — Program Horizon as live authority.

   Protocol DNA designs the program. Program Horizon stores the athlete's
   complete projection. This resolver is the only bridge from that stored
   projection to the week and day the product executes right now.

   It is pure and deterministic: no store access, no React, no persistence.
   The client hook persists a legacy migration after this resolver returns it.
   ═════════════════════════════════════════════════════════════════════ */

import type { AthleteProgrammingProfile } from "@/lib/athlete/programming-profile";
import type { AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import type { ActiveProtocol } from "@/lib/protocol/library";
import type { BlueprintDay } from "@/lib/training/split-blueprints";
import { memberSplitWeekStructure, type MemberSplit } from "@/lib/training/member-split";
import { getProtocolDNA, type PhaseKind } from "@/lib/training/protocol-dna";
import {
  deriveDayNutritionDemand,
  deriveDayRecoveryContext,
  deriveWeekNutritionDemand,
  deriveWeekRecoveryDemand,
  type DayNutritionDemand,
  type DayRecoveryContext,
  type WeekNutritionDemand,
  type WeekRecoveryDemand,
} from "./demand";
import { currentWeekNumber, generateProgramHorizon, getOriginalWeek, getWeek } from "./generate";
import {
  PROGRAM_HORIZON_VERSION,
  type ProgramHorizon,
  type ProjectedProgramWeek,
  type ProjectedWeekStatus,
} from "./types";

export type ActiveProgramSource =
  | "program-horizon"
  | "legacy-migration"
  | "member-custom"
  | "explicit-fallback";

export type ActiveProgramResolution = {
  programId: string;
  protocolId: string;
  protocolName: string;
  architectureVersion: string;
  architectureName: string;
  horizonVersion: string;

  currentWeekNumber: number;
  currentPhaseId: string;
  currentPhaseName: string;
  currentPhaseKind: PhaseKind;

  /** The immutable activation-time projection. */
  projectedWeek: ProjectedProgramWeek;
  /** The current projection after applicable revisions. */
  activeWeek: ProjectedProgramWeek;

  selectedDayIndex: number;
  selectedDay: BlueprintDay;

  status: ProjectedWeekStatus;
  source: ActiveProgramSource;
  revisionIds: string[];
  assumptions: string[];

  nutritionDemand: WeekNutritionDemand;
  recoveryDemand: WeekRecoveryDemand;
  dayNutritionDemand: DayNutritionDemand;
  dayRecoveryContext: DayRecoveryContext;

  /** Kept for consumers that render the full phase/week horizon. */
  horizon: ProgramHorizon;
};

export type ProgramAuthorityResult = {
  horizon: ProgramHorizon | null;
  resolution: ActiveProgramResolution | null;
  source: ActiveProgramSource;
  /** A newly migrated Horizon that the client boundary must persist once. */
  pendingPersistence: ProgramHorizon | null;
  assumptions: string[];
};

export type ResolveProgramAuthorityInput = {
  storedHorizon: ProgramHorizon | null;
  activeProtocol: ActiveProtocol | null;
  snapshot: AthleteContextSnapshot;
  profile: AthleteProgrammingProfile;
  recommendedProtocolId?: string | null;
  selectedDayIndex?: number;
  resolveExtras?: {
    activityStack?: string | null;
    activitySport?: string | null;
    recoveryPreference?: string | null;
  };
  now?: Date;
};

function mondayIndex(now: Date): number {
  return (now.getDay() + 6) % 7;
}
function normalizedDayIndex(value: number | undefined, now: Date): number {
  const candidate = value ?? mondayIndex(now);
  return Math.max(0, Math.min(6, Math.round(candidate)));
}

function migrationTimestamp(protocol: ActiveProtocol): Date {
  const value = new Date(`${protocol.selectedDate || protocol.startDate}T12:00:00.000Z`);
  return Number.isNaN(value.getTime()) ? new Date(0) : value;
}

/** A stored Horizon is authoritative only for this exact activation and DNA. */
export function isCurrentStoredHorizon(
  horizon: ProgramHorizon | null,
  protocol: ActiveProtocol | null,
): horizon is ProgramHorizon {
  if (!horizon || !protocol) return false;
  const dna = getProtocolDNA(protocol.protocolId);
  return Boolean(
    dna &&
    horizon.protocolId === protocol.protocolId &&
    horizon.architectureVersion === dna.architectureVersion &&
    horizon.horizonVersion === PROGRAM_HORIZON_VERSION &&
    horizon.startDate === protocol.startDate.slice(0, 10) &&
    horizon.totalWeeks === protocol.durationWeeks,
  );
}

function effectiveStatus(
  week: ProjectedProgramWeek,
  revisionIds: string[],
  horizon: ProgramHorizon,
  now: Date,
): ProjectedWeekStatus {
  if (week.status === "completed") return "completed";
  const start = Date.parse(`${horizon.startDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (!Number.isNaN(start) && today >= start + horizon.totalWeeks * 7 * 86_400_000) return "completed";
  if (revisionIds.length > 0 || week.status === "revised") return "revised";
  if (week.status === "deload" || week.status === "assessment") return week.status;
  return "active";
}

/** The horizon with every projected week's days set by the member's split, so
    program screens show the week the member trains. Phases, volume, intensity
    and revisions stay the program's; each week keeps its own Legs lead. */
export function applyMemberSplitToHorizon(horizon: ProgramHorizon, memberSplit: MemberSplit | null): ProgramHorizon {
  if (!memberSplit) return horizon;
  const withSplit = (week: ProjectedProgramWeek): ProjectedProgramWeek => ({
    ...week,
    weeklyStructure: memberSplitWeekStructure(memberSplit, week.weekNumber),
  });
  return {
    ...horizon,
    frequency: memberSplit.architecture.week.filter((day) => !day.recovery).length,
    weeks: horizon.weeks.map(withSplit),
    originalWeeks: horizon.originalWeeks.map(withSplit),
  };
}

export function resolveActiveProgram(
  horizon: ProgramHorizon,
  source: ActiveProgramSource,
  now: Date = new Date(),
  selectedDayIndex?: number,
  /** A split the member chose. It sets the week's days; the program keeps its
      phase, volume, intensity and progression (member-split.ts). */
  memberSplit?: MemberSplit | null,
): ActiveProgramResolution | null {
  const weekNumber = currentWeekNumber(horizon, now);
  const storedWeek = getWeek(horizon, weekNumber);
  const projectedWeek = getOriginalWeek(horizon, weekNumber);
  if (!storedWeek || !projectedWeek || storedWeek.weeklyStructure.length === 0) return null;
  const activeWeek: ProjectedProgramWeek = memberSplit
    ? { ...storedWeek, weeklyStructure: memberSplitWeekStructure(memberSplit, weekNumber) }
    : storedWeek;

  const phase = horizon.phases.find((candidate) => candidate.id === activeWeek.phaseId);
  if (!phase) return null;

  const dayIndex = normalizedDayIndex(selectedDayIndex, now);
  const selectedDay = activeWeek.weeklyStructure[dayIndex];
  if (!selectedDay) return null;

  const revisionIds = horizon.revisions
    .filter((revision) => revision.affectedWeeks.includes(weekNumber))
    .map((revision) => revision.id);
  const dna = getProtocolDNA(horizon.protocolId);

  return {
    programId: horizon.programId,
    protocolId: horizon.protocolId,
    protocolName: horizon.protocolName,
    architectureVersion: horizon.architectureVersion,
    architectureName: dna?.topology.blueprintName ?? horizon.protocolName,
    horizonVersion: horizon.horizonVersion,
    currentWeekNumber: weekNumber,
    currentPhaseId: phase.id,
    currentPhaseName: phase.name,
    currentPhaseKind: phase.kind,
    projectedWeek,
    activeWeek,
    selectedDayIndex: dayIndex,
    selectedDay,
    status: effectiveStatus(activeWeek, revisionIds, horizon, now),
    source,
    revisionIds,
    assumptions: [...horizon.assumptions],
    nutritionDemand: deriveWeekNutritionDemand(horizon, activeWeek, horizon.athleteSnapshot),
    recoveryDemand: deriveWeekRecoveryDemand(horizon, activeWeek, horizon.athleteSnapshot),
    dayNutritionDemand: deriveDayNutritionDemand(horizon, activeWeek, horizon.athleteSnapshot, dayIndex),
    dayRecoveryContext: deriveDayRecoveryContext(horizon, activeWeek, horizon.athleteSnapshot, dayIndex),
    horizon,
  };
}

/**
 * Resolve the stored authority or perform the one supported legacy migration.
 * Unknown/missing protocols return an explicit fallback state; they never
 * manufacture the legacy Chest / Back week.
 */
export function resolveProgramAuthority(input: ResolveProgramAuthorityInput): ProgramAuthorityResult {
  const now = input.now ?? new Date();
  const { activeProtocol } = input;

  if (!activeProtocol) {
    return {
      horizon: null,
      resolution: null,
      source: "explicit-fallback",
      pendingPersistence: null,
      assumptions: ["No active protocol is available, so Reserve cannot resolve an execution week."],
    };
  }

  if (isCurrentStoredHorizon(input.storedHorizon, activeProtocol)) {
    const resolution = resolveActiveProgram(input.storedHorizon, "program-horizon", now, input.selectedDayIndex);
    return {
      horizon: input.storedHorizon,
      resolution,
      source: resolution ? "program-horizon" : "explicit-fallback",
      pendingPersistence: null,
      assumptions: resolution ? resolution.assumptions : ["The stored Program Horizon is incomplete and cannot resolve an active week."],
    };
  }

  const generated = generateProgramHorizon({
    protocolId: activeProtocol.protocolId,
    snapshot: input.snapshot,
    profile: input.profile,
    totalWeeks: activeProtocol.durationWeeks || undefined,
    startDate: activeProtocol.startDate.slice(0, 10),
    athleteChoseManually: Boolean(
      input.recommendedProtocolId && activeProtocol.protocolId !== input.recommendedProtocolId,
    ),
    resolveExtras: input.resolveExtras,
    // The activation date makes first-render migrations identical across every
    // consumer until the persisted Horizon becomes available.
    now: migrationTimestamp(activeProtocol),
  });

  if (!generated) {
    return {
      horizon: null,
      resolution: null,
      source: "explicit-fallback",
      pendingPersistence: null,
      assumptions: [
        `Protocol ${activeProtocol.protocolId} has no Program Horizon generator. Reserve did not substitute a generic schedule.`,
      ],
    };
  }

  const migrated: ProgramHorizon = {
    ...generated,
    assumptions: [
      ...generated.assumptions,
      "Legacy active protocol migrated to a persisted Program Horizon without changing completed session history.",
    ],
  };
  const resolution = resolveActiveProgram(migrated, "legacy-migration", now, input.selectedDayIndex);
  return {
    horizon: migrated,
    resolution,
    source: resolution ? "legacy-migration" : "explicit-fallback",
    pendingPersistence: resolution ? migrated : null,
    assumptions: resolution ? resolution.assumptions : ["The migrated Program Horizon could not resolve an active week."],
  };
}

export type ResolutionIdentity = Pick<
  ActiveProgramResolution,
  | "programId"
  | "protocolId"
  | "architectureVersion"
  | "currentWeekNumber"
  | "currentPhaseId"
  | "selectedDayIndex"
  | "revisionIds"
>;

export type ResolutionComparison = {
  consistent: boolean;
  baseline: ResolutionIdentity | null;
  mismatches: string[];
};

/** Development/test assertion shared by every consumer integrity check. */
export function compareActiveProgramResolutions(
  entries: Record<string, ActiveProgramResolution | null>,
): ResolutionComparison {
  const available = Object.entries(entries).filter(
    (entry): entry is [string, ActiveProgramResolution] => Boolean(entry[1]),
  );
  if (available.length === 0) return { consistent: true, baseline: null, mismatches: [] };

  const [baselineName, baseline] = available[0];
  const identity: ResolutionIdentity = {
    programId: baseline.programId,
    protocolId: baseline.protocolId,
    architectureVersion: baseline.architectureVersion,
    currentWeekNumber: baseline.currentWeekNumber,
    currentPhaseId: baseline.currentPhaseId,
    selectedDayIndex: baseline.selectedDayIndex,
    revisionIds: [...baseline.revisionIds],
  };
  const mismatches: string[] = [];
  for (const [name, candidate] of available.slice(1)) {
    const fields: Array<keyof Omit<ResolutionIdentity, "revisionIds">> = [
      "programId", "protocolId", "architectureVersion", "currentWeekNumber", "currentPhaseId", "selectedDayIndex",
    ];
    for (const field of fields) {
      if (candidate[field] !== identity[field]) {
        mismatches.push(`${name}.${field} differs from ${baselineName}.${field}`);
      }
    }
    if (candidate.revisionIds.join("|") !== identity.revisionIds.join("|")) {
      mismatches.push(`${name}.revisionIds differs from ${baselineName}.revisionIds`);
    }
  }
  return { consistent: mismatches.length === 0, baseline: identity, mismatches };
}
