"use client";

/* ════════════════════════════════════════════════════════════════════════
   useTodayTrainingDay — today's training day, resolved one way.

   The same resolver Apex and Training Command read (resolveDailyTrainingContext),
   fed the same member inputs: the Program Horizon week, a member-saved split,
   the member's own day edits, the active protocol's blueprint, and the honest
   no-program state. Nutrition's header, hero, fuel horizon and fuel log all read
   this, so no two surfaces name a different day.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { localScheduleDateKey, resolveTrainingScheduleContext } from "@/lib/schedule/engine";
import { useProgramWeek } from "@/lib/program/useProgramWeek";
import { resolveDailyTrainingContext } from "@/lib/training/daily-context";
import { resolveGamePlanWeek } from "@/lib/training/game-plan";
import { isTrainingPlannedToday } from "@/lib/training/training-planned";

export function useTodayTrainingDay(now?: Date) {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const recoveryAggression = useAthleteDashboardStore((s) => s.profile.recoveryAggression);
  const onboardingCompletedAt = useAthleteDashboardStore((s) => s.onboarding.completedAt);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const splitCustomization = useAthleteDashboardStore((s) => s.splitCustomization);
  const trainingOverrides = useAthleteDashboardStore((s) => s.trainingOverrides);
  const activeResolution = useActiveProgram({ now }).resolution;
  /* The member's program week — the same one Training Command renders, so
     Nutrition never names a different session than the one they will train. */
  const programWeek = useProgramWeek(now);

  /* Without a screen clock this reads the wall clock, re-resolving when the date changes. */
  const dateKey = localScheduleDateKey(now);

  const dailyContext = useMemo(() => {
    const clock = now ?? new Date();
    return resolveDailyTrainingContext({
      now: clock,
      focus: physique.focus,
      weakPoints: physique.weakPoints,
      protocolName: activeResolution?.protocolName ?? activeProtocol?.protocolName ?? null,
      protocolArchitectureName: activeResolution?.architectureName ?? activeProtocol?.protocolName ?? "Reserve",
      womensActive: womensEnabled,
      protocolId: activeProtocol?.protocolId ?? null,
      protocolCategory: activeProtocol?.category ?? null,
      trainingDaysTarget: setupProfile.trainingDaysPerWeek ?? null,
      activityStack,
      activitySport,
      recoveryPreference:
        recoveryAggression === "conservative" ? "Protective" : recoveryAggression === "aggressive" ? "Aggressive" : "Balanced",
      weekNumber: activeResolution?.currentWeekNumber ?? resolveGamePlanWeek(activeProtocol, onboardingCompletedAt, clock).week,
      activeHorizonWeek: activeResolution?.activeWeek.weeklyStructure,
      requireActiveHorizon: !activeResolution && !activeProtocol,
      splitSystemKey: splitSystem.key,
      splitSystemChosen: Boolean(splitSystem.selectedAt),
      splitRestDayIndex: splitSystem.restDayIndex,
      splitCustomization,
      programWeek,
    });
    // dateKey re-resolves the wall-clock day at midnight when no `now` is passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programWeek, now, dateKey, physique.focus, physique.weakPoints, activeResolution, activeProtocol, womensEnabled, setupProfile.trainingDaysPerWeek, activityStack, activitySport, recoveryAggression, onboardingCompletedAt, splitSystem.key, splitSystem.selectedAt, splitSystem.restDayIndex, splitCustomization]);

  const trainingContext = useMemo(
    () => resolveTrainingScheduleContext(trainingOverrides, dateKey),
    [trainingOverrides, dateKey],
  );

  const today = dailyContext.todaySession;
  return {
    dailyContext,
    today,
    trainingContext,
    /** A session is planned today: training moved here, or a non-recovery day that was not moved away. */
    trainingPlanned: isTrainingPlannedToday(trainingContext, today.recovery),
  };
}
