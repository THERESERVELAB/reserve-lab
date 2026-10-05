import { z } from "zod";

export const checkoutRequestSchema = z.object({
  tier: z.enum(["core", "pro", "elite"]),
});

export const billingPortalRequestSchema = z.object({});

export const subscriptionStatusSchema = z.enum([
  "trial",
  "active",
  "past_due",
  "canceled",
  "grace_period",
]);

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type BillingPortalRequest = z.infer<typeof billingPortalRequestSchema>;
