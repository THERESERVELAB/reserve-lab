"use client";

import { useEffect, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { TodaysCommand } from "@/lib/contracts/product";

type TodaysCommandState = {
  data: TodaysCommand | null;
  loading: boolean;
  error: string | null;
};

/**
 * Today's command from the AI service. When the call fails there is no sample
 * command in its place (DESIGN_BIBLE §12): data stays null and `error` says
 * why. The member's real session and meals live in Training and the fuel log.
 */
export function useTodaysCommand(): TodaysCommandState {
  const { engagement } = useAthleteDashboardStore();
  const [state, setState] = useState<TodaysCommandState>({
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

    fetch(`/api/ai/todays-command?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ output: TodaysCommand }>;
      })
      .then(({ output }) => {
        if (!cancelled) setState({ data: output, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "unavailable",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [engagement.weeklyReadinessScore, engagement.adherenceScore]);

  return state;
}
