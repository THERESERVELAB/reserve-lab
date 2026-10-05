"use client";

import { useEffect, useState } from "react";

import { RECOVERY_COMMAND_UNAVAILABLE } from "@/lib/ai/service-unavailable";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { RecoveryCommand } from "@/lib/contracts/product";

type RecoveryCommandState = {
  data: RecoveryCommand | null;
  loading: boolean;
  error: string | null;
};

export function useRecoveryCommand(): RecoveryCommandState {
  const { engagement } = useAthleteDashboardStore();
  const [state, setState] = useState<RecoveryCommandState>({
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

    fetch(`/api/ai/recovery-command?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ output: RecoveryCommand }>;
      })
      .then(({ output }) => {
        if (!cancelled) setState({ data: output, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          /* No decision is invented while the service is down. */
          setState({
            data: RECOVERY_COMMAND_UNAVAILABLE,
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
