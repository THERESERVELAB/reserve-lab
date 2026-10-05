import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { getStripeWebhookStatus } from "@/lib/stripe/config";
import { createStripeClient } from "@/lib/stripe/server";
import { upsertSubscriptionFromStripe } from "@/lib/stripe/subscriptions";

export async function POST(request: Request) {
  const status = getStripeWebhookStatus();
  const stripe = createStripeClient();

  if (!stripe || !status.configured || !serverEnv.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        received: false,
        code: "not_configured",
        missing: status.missing,
        message: "Stripe webhook verification is not configured yet.",
      },
      { status: 503 },
    );
  }

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid Stripe webhook signature",
        details: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 400 },
    );
  }

  let entitlementSync: Awaited<ReturnType<typeof upsertSubscriptionFromStripe>> | null = null;
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    entitlementSync = await upsertSubscriptionFromStripe(event.data.object);
  }

  return NextResponse.json({ received: true, entitlementSync });
}
