"use client";

import { useCallback } from "react";

import { markCompoundLogged, markMealLogged } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { ApexAction } from "@/lib/apex/today-types";
import { todayDateString } from "@/lib/enhancement/schedule";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Binds the day resolver's described actions to the store.
 *
 * The resolver says what an item's one action is; this is the only place that
 * decides how it happens. Meal logging is idempotent in both directions — a
 * "log" never un-logs and an "undo" never logs — because `toggleLoggedMeal`
 * flips state, and a stale button must not flip it the wrong way.
 */
export function useApexActions(now: Date | null) {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const toggleLoggedMeal = useAthleteDashboardStore((s) => s.toggleLoggedMeal);
  const requestTrainingLaunch = useAthleteDashboardStore((s) => s.requestTrainingLaunch);
  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  const loggedMealIds = useAthleteDashboardStore((s) => s.nutritionPrefs.loggedMealIds);

  return useCallback(
    (action: ApexAction) => {
      switch (action.kind) {
        case "log-meal":
          if (!loggedMealIds.includes(action.mealId)) {
            toggleLoggedMeal(action.mealId);
            markMealLogged(action.mealId, true);
          }
          return;
        case "undo-meal-log":
          if (loggedMealIds.includes(action.mealId)) {
            toggleLoggedMeal(action.mealId);
            markMealLogged(action.mealId, false);
          }
          return;
        case "start-session":
          requestTrainingLaunch();
          setActiveView("training");
          return;
        case "review-session":
          setActiveView("training");
          return;
        case "mark-logged": {
          const at = now ?? new Date();
          logEnhancementAdherence({
            entryId: action.entryId,
            date: todayDateString(),
            plannedTime: action.plannedTime,
            takenStatus: "taken",
            actualTime: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
          });
          markCompoundLogged();
          return;
        }
        case "open-view":
          setActiveView(action.view);
          return;
      }
    },
    [loggedMealIds, now, toggleLoggedMeal, requestTrainingLaunch, setActiveView, logEnhancementAdherence],
  );
}
