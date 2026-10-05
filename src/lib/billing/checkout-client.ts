import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SubscriptionTier } from "@/lib/saas-config";

/* ════════════════════════════════════════════════════════════════════════
   BILLING — the member's route to actually paying.

   Before this module, the in-app upgrade buttons called
   `setSubscriptionTier(tier)`, a plain local store write. That granted the
   tier for free, persisted it, and — because `subscriptionTier` is in
   MEMBER_STATE_KEYS — synced it to `public.member_state` so it followed the
   member across devices. Nothing anywhere reached `/api/stripe/checkout`.

   The Stripe backend was already correct; only the wiring was missing.

   TIER MAPPING is not decided here. `saas-config.PUBLIC_PRICING` already
   binds signature → core ($24) and black → elite ($79); `pro` is a legacy
   internal rank that is not sold, so no `STRIPE_PRO_PRICE_ID` is required.

   ACQUISITION LIVES ON THE SEPARATE LANDING PAGE. These calls are for a
   member who is already signed in and is upgrading or managing billing — not
   a pricing or marketing surface.
   ════════════════════════════════════════════════════════════════════════ */

export type BillingResult =
  | { ok: true; url: string }
  | { ok: false; code: "unauthenticated" | "not_configured" | "no_account" | "failed"; message: string };

/** The one place a member's access token is attached to a billing call. */
async function authorizedPost(path: string, body: unknown): Promise<Response | null> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  return fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Start a real Stripe Checkout session and hand back the hosted URL.
 *
 * Deliberately returns the URL rather than redirecting itself, so a caller
 * can surface a failure in place instead of the member clicking Upgrade and
 * watching nothing happen. `redirectToCheckout` does the navigation once the
 * caller has decided to commit.
 */
export async function createCheckoutUrl(tier: SubscriptionTier): Promise<BillingResult> {
  const response = await authorizedPost("/api/stripe/checkout", { tier });

  if (!response) {
    return { ok: false, code: "unauthenticated", message: "Sign in to change your plan." };
  }

  if (response.status === 401) {
    return { ok: false, code: "unauthenticated", message: "Sign in to change your plan." };
  }

  const payload = (await response.json().catch(() => null)) as
    | { url?: string | null; message?: string; code?: string }
    | null;

  if (!response.ok || !payload?.url) {
    /* 503 is the honest "Stripe keys or price ids are not set yet" path from
       createSubscriptionCheckoutSession — surfaced as-is rather than as a
       generic failure, because the two need different fixes. */
    if (response.status === 503) {
      return {
        ok: false,
        code: "not_configured",
        message: payload?.message ?? "Billing is not available yet.",
      };
    }
    return { ok: false, code: "failed", message: payload?.message ?? "Checkout could not start." };
  }

  return { ok: true, url: payload.url };
}

/** Stripe's hosted billing portal, for a member who already has a subscription. */
export async function createPortalUrl(): Promise<BillingResult> {
  const response = await authorizedPost("/api/stripe/portal", {});

  if (!response || response.status === 401) {
    return { ok: false, code: "unauthenticated", message: "Sign in to manage billing." };
  }

  const payload = (await response.json().catch(() => null)) as
    | { url?: string | null; message?: string }
    | null;

  if (response.status === 404) {
    return { ok: false, code: "no_account", message: "No billing account was found." };
  }

  if (!response.ok || !payload?.url) {
    if (response.status === 503) {
      return { ok: false, code: "not_configured", message: payload?.message ?? "Billing is not available yet." };
    }
    return { ok: false, code: "failed", message: payload?.message ?? "Billing portal could not open." };
  }

  return { ok: true, url: payload.url };
}

/** Navigate to a Stripe-hosted page. Full navigation, not a new tab — the
    member is leaving the app to transact and comes back via success_url. */
export function redirectToBilling(url: string): void {
  window.location.href = url;
}
