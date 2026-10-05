import type Stripe from "stripe";

import type { SubscriptionStatus, Database } from "@/lib/database/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/saas-config";

type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Insert"];

const STRIPE_TO_APP_STATUS: Record<string, SubscriptionStatus> = {
  trialing: "trial",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "grace_period",
  incomplete_expired: "canceled",
  paused: "grace_period",
};

export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  return STRIPE_TO_APP_STATUS[status] ?? "grace_period";
}

export function parseTierFromStripeSubscription(subscription: Stripe.Subscription): SubscriptionTier {
  const tier = subscription.metadata.tier;
  if (tier === "core" || tier === "pro" || tier === "elite") return tier;
  return "core";
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    throw new Error("Stripe subscription is missing metadata.userId");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      synced: false,
      mode: "local_fallback" as const,
      reason: "not_configured" as const,
      tier: parseTierFromStripeSubscription(subscription),
      status: mapStripeStatus(subscription.status),
    };
  }

  const payload: SubscriptionUpdate = {
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    tier: parseTierFromStripeSubscription(subscription),
    status: mapStripeStatus(subscription.status),
    current_period_end: subscription.items.data[0]?.current_period_end
      ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
      : null,
  };

  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.warn("Subscription entitlement sync failed.", error.message);
    return {
      synced: false,
      mode: "local_fallback" as const,
      reason: "write_failed" as const,
      tier: payload.tier,
      status: payload.status,
    };
  }

  const profileResult = await admin
    .from("profiles")
    .update({ current_tier: payload.tier })
    .eq("id", userId);

  if (profileResult.error) {
    console.warn("Profile tier sync failed.", profileResult.error.message);
  }

  return {
    synced: true,
    mode: "supabase" as const,
    tier: payload.tier,
    status: payload.status,
  };
}
