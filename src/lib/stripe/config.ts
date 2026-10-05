import type { SubscriptionTier } from "@/lib/saas-config";
import { getIntegrationStatus, serverEnv } from "@/lib/env/server";

export const STRIPE_PRICE_ENV_KEYS: Record<SubscriptionTier, keyof typeof serverEnv> = {
  core: "STRIPE_CORE_PRICE_ID",
  pro: "STRIPE_PRO_PRICE_ID",
  elite: "STRIPE_ELITE_PRICE_ID",
};

export function getStripePriceId(tier: SubscriptionTier): string {
  const value = serverEnv[STRIPE_PRICE_ENV_KEYS[tier]];
  if (!value) {
    throw new Error(`Missing Stripe price id for ${tier}`);
  }
  return value;
}

export function getStripeCheckoutStatus(tier: SubscriptionTier) {
  return getIntegrationStatus(["STRIPE_SECRET_KEY", STRIPE_PRICE_ENV_KEYS[tier]]);
}

export function getStripeWebhookStatus() {
  return getIntegrationStatus(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
}
