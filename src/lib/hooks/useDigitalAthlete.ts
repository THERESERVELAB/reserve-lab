"use client";

import { useEffect, useState } from "react";

import { DIGITAL_ATHLETE_UNAVAILABLE } from "@/lib/ai/service-unavailable";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { DigitalAthleteSnapshot } from "@/lib/contracts/product";
import { appendBodyweightParam } from "@/lib/profile/bodyweight";

type DigitalAthleteState = {
  data: DigitalAthleteSnapshot | null;
  loading: boolean;
  error: string | null;
};

export function useDigitalAthlete(): DigitalAthleteState {
  const { engagement, profile } = useAthleteDashboardStore();
  const [state, setState] = useState<DigitalAthleteState>({
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

    fetch(`/api/ai/digital-athlete?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ output: DigitalAthleteSnapshot }>;
      })
      .then(({ output }) => {
        if (!cancelled) setState({ data: output, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          /* No sample muscle scores in place of the service — only what is missing. */
          setState({
            data: DIGITAL_ATHLETE_UNAVAILABLE,
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
