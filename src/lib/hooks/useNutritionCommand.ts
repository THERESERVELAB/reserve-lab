"use client";

import { useEffect, useState } from "react";

import { NUTRITION_COMMAND_UNAVAILABLE } from "@/lib/ai/service-unavailable";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { NutritionCommand } from "@/lib/contracts/product";
import { appendBodyweightParam } from "@/lib/profile/bodyweight";

type NutritionCommandState = {
  data: NutritionCommand | null;
  loading: boolean;
  error: string | null;
};

export function useNutritionCommand(): NutritionCommandState {
  const { engagement, profile } = useAthleteDashboardStore();
  const [state, setState] = useState<NutritionCommandState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    /* Only real scores are sent. With none, the service receives none. */
    const params = new URLSearchParams();
    if (engagement.weeklyReadinessScore != null) params.set("readinessScore", String(engagement.weeklyReadinessScore));
    if (engagement.adherenceScore != null) params.set("adherenceScore", String(engagement.adherenceScore));

    appendBodyweightParam(params, profile.bodyFat);

    fetch(`/api/ai/nutrition-command?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ output: NutritionCommand }>;
      })
      .then(({ output }) => {
        if (!cancelled) setState({ data: output, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          /* No sample figures in place of the service — only what is missing. */
          setState({
            data: NUTRITION_COMMAND_UNAVAILABLE,
            loading: false,
            error: err instanceof Error ? err.message : "unavailable",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [engagement.weeklyReadinessScore, engagement.adherenceScore, profile.bodyFat]);

  return state;
}
