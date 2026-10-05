/* Program Horizon → live session prescription adapter.
   The movement library still authors exercise selection. The active Horizon
   supplies the week-specific volume, effort, and primary-lift posture. */

import type { SessionMovement } from "@/lib/training/session-movement";
import type { TrainingPhase } from "@/lib/training/workout-templates";
import type { PhaseKind } from "@/lib/training/protocol-dna";
import type { ProjectedProgramWeek } from "./types";
import type { ActiveProgramResolution, ActiveProgramSource } from "./active-program";
import { cloneWeek } from "./generate";

export type FrozenHorizonSessionReference = {
  horizonProgramId: string;
  horizonProtocolId: string;
  horizonArchitectureVersion: string;
  horizonWeekNumber: number;
  horizonPhaseId: string;
  horizonDayIndex: number;
  horizonDayTitle: string;
  horizonRevisionIds: string[];
  horizonSource: ActiveProgramSource;
  horizonWeekSnapshot: ProjectedProgramWeek;
};

export function freezeHorizonSessionReference(
  resolution: ActiveProgramResolution | null,
): FrozenHorizonSessionReference | Record<string, never> {
  if (!resolution) return {};
  return {
    horizonProgramId: resolution.programId,
    horizonProtocolId: resolution.protocolId,
    horizonArchitectureVersion: resolution.architectureVersion,
    horizonWeekNumber: resolution.currentWeekNumber,
    horizonPhaseId: resolution.currentPhaseId,
    horizonDayIndex: resolution.selectedDayIndex,
    horizonDayTitle: resolution.selectedDay.title,
    horizonRevisionIds: [...resolution.revisionIds],
    horizonSource: resolution.source,
    horizonWeekSnapshot: cloneWeek(resolution.activeWeek),
  };
}

export function trainingPhaseFromHorizon(kind: PhaseKind, phaseWeek = 1): TrainingPhase {
  switch (kind) {
    case "foundation": return "foundation";
    case "accumulation": return phaseWeek <= 1 ? "foundation" : "progression";
    case "specialization": return "specialization";
    case "intensification": return "intensification";
    case "consolidation": return "refinement";
    case "realization": return "peak";
    case "deload": return "peak";
    case "assessment": return "peak";
    case "taper": return "peak";
    default: return "progression";
  }
}

function firstRelativePercent(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) / 100 : 1;
}

function totalSets(week: ProjectedProgramWeek): number {
  return Object.values(week.volumeTarget.setTargets).reduce((sum, sets) => sum + sets, 0);
}

export function horizonVolumeRatio(
  activeWeek: ProjectedProgramWeek,
  projectedWeek: ProjectedProgramWeek = activeWeek,
): number {
  const originalTotal = totalSets(projectedWeek);
  const revisionRatio = originalTotal > 0 ? totalSets(activeWeek) / originalTotal : 1;
  return Math.max(0.5, Math.min(1.35, firstRelativePercent(activeWeek.volumeTarget.relativeLoad) * revisionRatio));
}

/**
 * Apply only the Horizon-owned levers. Exercise selection, equipment, pain
 * substitutions, readiness gating, and member preferences remain upstream.
 */
export function applyHorizonWeekTargets(
  movements: SessionMovement[],
  activeWeek: ProjectedProgramWeek,
  projectedWeek: ProjectedProgramWeek = activeWeek,
): SessionMovement[] {
  const ratio = horizonVolumeRatio(activeWeek, projectedWeek);
  return movements.map((movement) => {
    const accessory = movement.role === "volume" || movement.role === "stretch" || movement.role === "finisher";
    const primary = movement.role === "primary";
    let setDelta = 0;
    if (ratio >= 1.08 && accessory) setDelta = 1;
    else if (ratio <= 0.82 && !primary) setDelta = -1;
    else if (ratio <= 0.95 && (movement.role === "volume" || movement.role === "finisher")) setDelta = -1;
    if (ratio <= 0.65 && primary) setDelta = -1;

    const sets = Math.max(primary ? 3 : 1, movement.sets + setDelta);
    const effort = activeWeek.intensityTarget.effortRange;
    const primaryExposure = primary ? activeWeek.intensityTarget.primaryLiftExposure : undefined;
    return {
      ...movement,
      sets,
      rirTargets: Array.from({ length: sets }, () => effort),
      intensity: [movement.intensity, effort].filter(Boolean).join(" · "),
      progressionTarget: primaryExposure ?? movement.progressionTarget,
      whyLoad: primaryExposure
        ? `${movement.whyLoad} Horizon target: ${primaryExposure}`
        : movement.whyLoad,
      phaseTags: [...new Set([...(movement.phaseTags ?? []), activeWeek.phaseId, `week-${activeWeek.weekNumber}`])],
    };
  });
}
