"use client";

/* ════════════════════════════════════════════════════════════════════════
   useProtocolWeek — Protocol Architecture 2.0 shared week source.
   ------------------------------------------------------------------------
   One place that turns the active protocol + member profile into the adapted
   weekly plan, so every surface (Apex, Training, Nutrition, Mobility) renders
   the SAME protocol-specific week. No medical / dosing content.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { getProtocol } from "@/lib/protocol/library";
import {
  buildProtocolWeek,
  type TrainingWeekDay,
} from "@/lib/training/weekly-split";
import {
  protocolIntensityTier,
  type IntensityTier,
} from "@/lib/training/workout-templates";
import type { BlueprintResolveInput } from "@/lib/training/split-blueprints";

export function useProtocolWeek(now?: Date): {
  week: TrainingWeekDay[];
  tier: IntensityTier;
  resolve: BlueprintResolveInput;
} {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const recoveryAggression = useAthleteDashboardStore((s) => s.profile.recoveryAggression);
  const weakPoints = useAthleteDashboardStore((s) => s.physiqueCommand.weakPoints);
  const goal = useAthleteDashboardStore((s) => s.profile.goal);
  const userTrainingProfile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);

  const tier = useMemo<IntensityTier>(() => {
    if (!activeProtocol) return "standard";
    const def = getProtocol(activeProtocol.protocolId);
    return protocolIntensityTier({ category: activeProtocol.category, difficulty: def?.difficulty, logOnly: def?.logOnly });
  }, [activeProtocol]);

  const resolve = useMemo<BlueprintResolveInput>(
    () => ({
      protocolId: activeProtocol?.protocolId ?? null,
      category: activeProtocol?.category ?? null,
      trainingDaysTarget: setupProfile.trainingDaysPerWeek ?? null,
      activityStack,
      activitySport,
      recoveryPreference:
        recoveryAggression === "conservative"
          ? "Protective"
          : recoveryAggression === "aggressive"
            ? "Aggressive"
            : "Balanced",
      musclePriority: weakPoints ?? [],
      // No active protocol → the profile selects a differentiated architecture
      // instead of the chest/back default.
      profileForFallback: {
        goal: goal ?? "",
        daysToDeadline: setupProfile.targetTimelineWeeks ? setupProfile.targetTimelineWeeks * 7 : null,
        gymEnvironment: userTrainingProfile.gymEnvironment,
        trainingLevel: userTrainingProfile.trainingLevel,
        womensPath: womensEnabled,
        genderIdentity: womensEnabled ? "female" : undefined,
        hasWeakPoints: (weakPoints?.length ?? 0) > 0,
        weakPointFocus: (weakPoints?.length ?? 0) > 0,
        trainingDaysPerWeek: setupProfile.trainingDaysPerWeek ?? null,
        sessionDurationMin: userTrainingProfile.sessionDurationMin ?? setupProfile.sessionDurationMin ?? null,
        recoveryCapacity:
          recoveryAggression === "aggressive" ? "high" : recoveryAggression === "conservative" ? "low" : "moderate",
        occupationLoad: setupProfile.occupationLoad ?? null,
        injuryRegions: userTrainingProfile.movementLimitations ?? null,
      },
    }),
    [activeProtocol?.protocolId, activeProtocol?.category, setupProfile.trainingDaysPerWeek, setupProfile.targetTimelineWeeks, setupProfile.sessionDurationMin, setupProfile.occupationLoad, activityStack, activitySport, recoveryAggression, weakPoints, goal, userTrainingProfile, womensEnabled],
  );

  const week = useMemo(
    () => buildProtocolWeek({ tier, now, resolve }),
    [tier, now, resolve],
  );

  return { week, tier, resolve };
}
