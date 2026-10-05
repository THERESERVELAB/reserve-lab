"use client";

import { useEffect, useState } from "react";

import type { SubscriptionTier } from "@/lib/saas-config";
import { COMMUNITY_CHANNELS, type CommunityChannelDefinition } from "@/lib/community/channels";
import { authorizedFetch } from "@/lib/supabase/client-auth";

type UseCommunityChannelsResult = {
  channels: CommunityChannelDefinition[];
  loading: boolean;
  error: string | null;
};

export function useCommunityChannels(): UseCommunityChannelsResult {
  const [channels, setChannels] = useState<CommunityChannelDefinition[]>(COMMUNITY_CHANNELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    authorizedFetch("/api/community/channels")
      .then((res) => {
        if (!res.ok) throw new Error(`Community channels fetch failed: ${res.status}`);
        return res.json() as Promise<{ channels: CommunityChannelDefinition[] }>;
      })
      .then(({ channels: data }) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setChannels(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Channels unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { channels, loading, error };
}

export type { CommunityChannelDefinition, SubscriptionTier };
