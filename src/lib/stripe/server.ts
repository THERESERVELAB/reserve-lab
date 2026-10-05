import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/lib/env/server";

export function createStripeClient() {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(serverEnv.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
    appInfo: {
      name: "THE RESERVE METHOD",
      version: "0.1.0",
    },
  });
}
