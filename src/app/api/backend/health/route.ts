import { NextResponse } from "next/server";

import { getIntegrationStatus } from "@/lib/env/server";
import { getStripeWebhookStatus } from "@/lib/stripe/config";
import { getSupabaseAdminStatus, getSupabasePublicStatus } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({
    app: "FINAL BOSS ATHLETE",
    mode: "offline_safe",
    integrations: {
      supabasePublic: getSupabasePublicStatus(),
      supabaseAdmin: getSupabaseAdminStatus(),
      stripeWebhook: getStripeWebhookStatus(),
      stripeCheckoutCore: getIntegrationStatus(["STRIPE_SECRET_KEY", "STRIPE_CORE_PRICE_ID"]),
      stripeCheckoutPro: getIntegrationStatus(["STRIPE_SECRET_KEY", "STRIPE_PRO_PRICE_ID"]),
      stripeCheckoutElite: getIntegrationStatus(["STRIPE_SECRET_KEY", "STRIPE_ELITE_PRICE_ID"]),
      openai: getIntegrationStatus(["OPENAI_API_KEY"]),
    },
  });
}
