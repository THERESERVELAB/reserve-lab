import { z } from "zod";

export const analyticsEventNameSchema = z.enum([
  "page_view",
  "page_viewed",
  "landing_visit",
  "lead_capture_viewed",
  "onboarding_start",
  "onboarding_started",
  "onboarding_complete",
  "onboarding_completed",
  "tier_selected",
  "checkout_clicked",
  "checkout_started",
  "checkout_completed",
  "locked_feature_viewed",
  "upgrade_intent",
  "upgrade_clicked",
  "daily_active_use",
  "weekly_active_use",
  "retention_dropoff",
  "attribution_captured",
  "lead_captured",
  "community_viewed",
  "community_message_created",
  "ai_brief_generated",
  "retention_milestone_achieved",
  "daily_check_in_completed",
  "weekly_review_opened",
]);

export const analyticsEventSchema = z.object({
  userId: z.string().uuid().optional(),
  eventName: z.union([analyticsEventNameSchema, z.string().min(2).max(120)]),
  featureKey: z.string().min(2).max(120).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
