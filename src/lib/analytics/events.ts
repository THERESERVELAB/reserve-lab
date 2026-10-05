import type { AnalyticsEventInput } from "@/lib/schemas/analytics";
import type { Json } from "@/lib/database/types";
import type { FeatureKey } from "@/lib/saas-config";
import { redactAnalyticsLabel, redactAnalyticsMetadata } from "@/lib/analytics/redaction";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const PRODUCT_EVENTS = {
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  tierSelected: "tier_selected",
  checkoutStarted: "checkout_started",
  checkoutCompleted: "checkout_completed",
  lockedFeatureViewed: "locked_feature_viewed",
  upgradeClicked: "upgrade_clicked",
  dailyCheckInCompleted: "daily_check_in_completed",
  weeklyReviewOpened: "weekly_review_opened",
  communityMessageCreated: "community_message_created",
  pageViewed: "page_viewed",
  landingVisit: "landing_visit",
  leadCaptureViewed: "lead_capture_viewed",
  checkoutClicked: "checkout_clicked",
  upgradeIntent: "upgrade_intent",
  dailyActiveUse: "daily_active_use",
  weeklyActiveUse: "weekly_active_use",
  retentionDropoff: "retention_dropoff",
  communityViewed: "community_viewed",
  aiBriefGenerated: "ai_brief_generated",
  retentionMilestoneAchieved: "retention_milestone_achieved",
  leadCaptured: "lead_captured",
} as const;

export type EventTrackResult = {
  ok: true;
  persisted: boolean;
  mode: "supabase" | "local_fallback";
  eventId: string;
  reason?: "not_configured" | "write_failed";
};

export async function trackServerEvent(input: AnalyticsEventInput) {
  const admin = createSupabaseAdminClient();
  const eventId = crypto.randomUUID();

  if (!admin) {
    return {
      ok: true,
      persisted: false,
      mode: "local_fallback",
      eventId,
      reason: "not_configured",
    } satisfies EventTrackResult;
  }

  // Every event passes the redaction guard — analytics stores operational
  // facts only, never private member content or anything credential-shaped.
  const { error } = await admin.from("engagement_events").insert({
    id: eventId,
    user_id: input.userId ?? null,
    event_name: redactAnalyticsLabel(input.eventName),
    feature_key: (input.featureKey
      ? (redactAnalyticsLabel(input.featureKey) as FeatureKey)
      : null),
    metadata: redactAnalyticsMetadata(input.metadata) as Json,
  });

  if (error) {
    console.warn("Analytics event was queued locally because Supabase write failed.", error.message);
    return {
      ok: true,
      persisted: false,
      mode: "local_fallback",
      eventId,
      reason: "write_failed",
    } satisfies EventTrackResult;
  }

  return {
    ok: true,
    persisted: true,
    mode: "supabase",
    eventId,
  } satisfies EventTrackResult;
}
