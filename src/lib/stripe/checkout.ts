import { serverEnv } from "@/lib/env/server";
import type { CheckoutRequest } from "@/lib/schemas/revenue";
import { getStripeCheckoutStatus, getStripePriceId } from "@/lib/stripe/config";
import { createStripeClient } from "@/lib/stripe/server";

type AuthenticatedCheckoutRequest = CheckoutRequest & {
  userId: string;
  email: string | null;
};

type AuthenticatedBillingPortalRequest = {
  customerId: string;
};

export type CheckoutSessionResult =
  | {
      ok: true;
      configured: true;
      id: string;
      url: string | null;
    }
  | {
      ok: false;
      configured: false;
      code: "not_configured";
      missing: string[];
      message: string;
    };

export async function createSubscriptionCheckoutSession(request: AuthenticatedCheckoutRequest) {
  const status = getStripeCheckoutStatus(request.tier);
  const stripe = createStripeClient();

  if (!stripe || !status.configured) {
    return {
      ok: false,
      configured: false,
      code: "not_configured",
      missing: status.missing,
      message: "Stripe checkout is not configured yet. Add Stripe keys and tier price IDs to enable live checkout.",
    } satisfies CheckoutSessionResult;
  }

  const appUrl = serverEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: request.email ?? undefined,
      line_items: [
        {
          price: getStripePriceId(request.tier),
          quantity: 1,
        },
      ],
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          userId: request.userId,
          tier: request.tier,
        },
      },
      metadata: {
        userId: request.userId,
        tier: request.tier,
      },
    });

    return {
      ok: true,
      configured: true,
      id: session.id,
      url: session.url,
    } satisfies CheckoutSessionResult;
  } catch (error) {
    console.warn("Stripe checkout session creation failed.", error instanceof Error ? error.message : error);
    return {
      ok: false,
      configured: false,
      code: "not_configured",
      missing: [],
      message: "Stripe checkout could not create a session. Verify test keys and price IDs.",
    } satisfies CheckoutSessionResult;
  }
}

export async function createBillingPortalSession(request: AuthenticatedBillingPortalRequest) {
  const stripe = createStripeClient();
  const appUrl = serverEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!stripe || !serverEnv.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      configured: false,
      code: "not_configured",
      missing: ["STRIPE_SECRET_KEY"],
      message: "Stripe billing portal is not configured yet.",
    } as const;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: request.customerId,
      return_url: `${appUrl}?billing=return`,
    });

    return {
      ok: true,
      configured: true,
      id: session.id,
      url: session.url,
    } as const;
  } catch (error) {
    console.warn("Stripe billing portal creation failed.", error instanceof Error ? error.message : error);
    return {
      ok: false,
      configured: false,
      code: "portal_failed",
      missing: [],
      message: "Stripe billing portal could not create a session. Verify customer id and test configuration.",
    } as const;
  }
}
