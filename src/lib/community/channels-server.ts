import "server-only";

import { TIER_RANK } from "@/lib/saas-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** List only private channels the caller belongs to; tier channels may appear locked. */
export async function listCommunityChannels(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Community persistence is not configured.");

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      admin.from("profiles").select("current_tier").eq("id", userId).single(),
      admin.from("community_memberships").select("channel_id").eq("user_id", userId),
    ]);

  if (profileError) throw profileError;
  if (membershipError) throw membershipError;

  const { data, error } = await admin
    .from("community_channels")
    .select("id,slug,name,description,visibility,required_tier,kind,created_at")
    .order("required_tier", { ascending: true });
  if (error) throw error;

  const memberChannelIds = new Set((memberships ?? []).map((membership) => membership.channel_id));
  return (data ?? [])
    .filter((channel) => channel.visibility !== "private" || memberChannelIds.has(channel.id))
    .map((channel) => ({
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      visibility: channel.visibility,
      requiredTier: channel.required_tier,
      kind: channel.kind,
      locked: TIER_RANK[profile.current_tier] < TIER_RANK[channel.required_tier],
    }));
}
