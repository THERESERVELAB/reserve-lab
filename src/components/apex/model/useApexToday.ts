"use client";

import { useMemo } from "react";

import { resolveApexToday } from "@/lib/apex/today-resolver";
import type { ApexToday } from "@/lib/apex/today-types";
import type { ApexModel } from "./useApexModel";

/**
 * Today, resolved once per minute: the model's engine output handed to the
 * pure day resolver. The Pit Wall reads only this — never the engines.
 */
export function useApexToday(model: ApexModel): ApexToday {
  const { clock, schedule, trainingContext, todayResolved, trainingSessionMode, nutritionPlan, loggedMealIds, intakeSlots, briefing } = model;

  return useMemo(
    () =>
      resolveApexToday({
        now: clock,
        schedule,
        trainingContext,
        today: todayResolved,
        sessionMode: trainingSessionMode,
        meals: nutritionPlan.meals,
        loggedMealIds,
        intakeSlots,
        watchSignals: briefing.hurting,
      }),
    [clock, schedule, trainingContext, todayResolved, trainingSessionMode, nutritionPlan.meals, loggedMealIds, intakeSlots, briefing.hurting],
  );
}
