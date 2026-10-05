"use client";

import { useCallback, useState } from "react";

import { createCheckoutUrl, createPortalUrl, redirectToBilling } from "@/lib/billing/checkout-client";
import type { SubscriptionTier } from "@/lib/saas-config";

/* ════════════════════════════════════════════════════════════════════════
   ONE upgrade behaviour, shared by every CTA in the product.

   The upgrade button appeared in five places and each one called
   `setSubscriptionTier(tier)` — granting the tier for free. Centralising the
   real behaviour here means a new CTA cannot reintroduce that by copying a
   neighbour: there is now exactly one thing to copy, and it charges.

   `pending` and `error` exist so the button can be honest. A member who
   clicks Upgrade when Stripe is not configured must see why, not a dead
   control (CLAUDE.md: no dead CTAs).
   ════════════════════════════════════════════════════════════════════════ */

export type UpgradeCheckout = {
  /** Begin checkout for a tier. Navigates to Stripe on success. */
  startCheckout: (tier: SubscriptionTier) => Promise<void>;
  /** Open Stripe's hosted portal for an existing subscriber. */
  openPortal: () => Promise<void>;
  /** True while a billing call is in flight — disable the control. */
  pending: boolean;
  /** Member-facing reason the last attempt did not proceed. */
  error: string | null;
  clearError: () => void;
};

export function useUpgradeCheckout(): UpgradeCheckout {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<Awaited<ReturnType<typeof createCheckoutUrl>>>) => {
    setPending(true);
    setError(null);
    try {
      const result = await fn();
      if (result.ok) {
        redirectToBilling(result.url);
        // Navigation is underway; leave `pending` true so the control stays
        // disabled and cannot be double-submitted during the handoff.
        return;
      }
      setError(result.message);
    } catch {
      setError("Billing is unavailable right now.");
    } finally {
      setPending(false);
    }
  }, []);

  const startCheckout = useCallback(
    async (tier: SubscriptionTier) => {
      await run(() => createCheckoutUrl(tier));
    },
    [run],
  );

  const openPortal = useCallback(async () => {
    await run(() => createPortalUrl());
  }, [run]);

  return { startCheckout, openPortal, pending, error, clearError: () => setError(null) };
}
