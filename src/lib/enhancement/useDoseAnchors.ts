"use client";

/* ════════════════════════════════════════════════════════════════════════
   useDoseAnchors — the member's day that dose rules resolve against.

   Today's meals come from the schedule engine's meal plan, shaped by
   fuelWindowsFromPlan exactly as every fuel plan reads them, and the wake
   time and sleep target from the schedule profile. Compound Command's Today,
   its Day Timeline and Apex all resolve dose times against this, so a dose
   set "1 h before breakfast" lands on the same minute everywhere and moves
   when breakfast moves.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { fuelWindowsFromPlan } from "@/lib/nutrition/scheduled-fuel-windows";
import { buildMealPlan } from "@/lib/schedule/engine";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";

import { doseAnchorsFrom, type DoseAnchors } from "./dose-timing";

export function useDoseAnchors(now?: Date | null): DoseAnchors {
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const { trainingPlanned, trainingContext } = useTodayTrainingDay(now ?? undefined);
  return useMemo(
    () =>
      doseAnchorsFrom(
        scheduleProfile,
        fuelWindowsFromPlan(buildMealPlan(scheduleProfile, { trainingPlanned, direction: trainingContext.direction })),
        trainingPlanned,
      ),
    [scheduleProfile, trainingPlanned, trainingContext.direction],
  );
}
