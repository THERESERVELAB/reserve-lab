import type { FeatureKey, SubscriptionTier } from "@/lib/saas-config";
import { isFeatureEnabled, tierRequiredFor } from "@/lib/saas-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type EntitlementDecision = {
  allowed: boolean;
  tier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  reason: "feature-enabled" | "tier-required" | "subscription-inactive";
};

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const admin = createSupabaseAdminClient();
  if (!admin) return "core";

  const { data, error } = await admin
    .from("profiles")
    .select("current_tier")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.current_tier ?? "core";
}

export async function canAccessFeature(
  userId: string,
  featureKey: FeatureKey,
): Promise<EntitlementDecision> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    const tier = "core";
    const requiredTier = tierRequiredFor(featureKey);
    const allowed = isFeatureEnabled(tier, featureKey);
    return {
      allowed,
      tier,
      requiredTier,
      reason: allowed ? "feature-enabled" : "tier-required",
    };
  }

  const { data, error } = await admin
    .from("subscriptions")
    .select("tier,status")
    .eq("user_id", userId)
    .in("status", ["trial", "active", "grace_period"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const tier = data?.tier ?? (await getUserTier(userId));
  const requiredTier = tierRequiredFor(featureKey);
  const subscriptionIsUsable = !data || ["trial", "active", "grace_period"].includes(data.status);

  if (!subscriptionIsUsable) {
    return { allowed: false, tier, requiredTier, reason: "subscription-inactive" };
  }

  const allowed = isFeatureEnabled(tier, featureKey);
  return {
    allowed,
    tier,
    requiredTier,
    reason: allowed ? "feature-enabled" : "tier-required",
  };
}
