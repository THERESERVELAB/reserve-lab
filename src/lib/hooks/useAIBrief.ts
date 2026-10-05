"use client";

import { useEffect, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";

export type AiBriefResponse = {
  title: string;
  summary: string;
  watchItems: string[];
  trainingFocus: string;
  retentionNote: string;
  upgradeTeaser: string;
  safetyNote: string;
};

type BriefState = {
  brief: AiBriefResponse | null;
  loading: boolean;
  error: string | null;
};

export function useAIBrief(): BriefState {
  const { profile, subscriptionTier, engagement } = useAthleteDashboardStore();
  const [state, setState] = useState<BriefState>({ brief: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    const body = {
      persona: profile.persona,
      tier: subscriptionTier,
      readinessScore: engagement.weeklyReadinessScore ?? undefined,
      adherenceScore: engagement.adherenceScore ?? undefined,
      focus: profile.primaryFocus ? profile.primaryFocus.slice(0, 160) : undefined,
    };

    fetch("/api/ai/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`AI brief request failed: ${res.status}`);
        return res.json() as Promise<{ brief: AiBriefResponse }>;
      })
      .then(({ brief }) => {
        if (!cancelled) setState({ brief, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "AI brief unavailable",
        }));
      });

    return () => { cancelled = true; };
  }, [profile.persona, subscriptionTier, engagement.weeklyReadinessScore, engagement.adherenceScore, profile.primaryFocus]);

  return state;
}
