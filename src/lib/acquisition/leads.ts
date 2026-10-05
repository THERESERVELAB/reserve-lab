import type { AttributionInput, LeadCaptureInput } from "@/lib/schemas/acquisition";
import { PRODUCT_EVENTS, trackServerEvent } from "@/lib/analytics/events";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CapturedLead = {
  id: string;
  persisted: boolean;
  mode: "supabase" | "local_fallback";
  reason?: "not_configured" | "write_failed";
};

export async function captureLead(input: LeadCaptureInput): Promise<CapturedLead> {
  const admin = createSupabaseAdminClient();
  const fallbackLead: CapturedLead = {
    id: crypto.randomUUID(),
    persisted: false,
    mode: "local_fallback",
    reason: "not_configured",
  };

  if (!admin) {
    await trackServerEvent({
      eventName: PRODUCT_EVENTS.leadCaptured,
      metadata: {
        source: input.source,
        leadId: fallbackLead.id,
        persisted: false,
      },
    });

    return fallbackLead;
  }

  const { data, error } = await admin
    .from("lead_captures")
        .insert({
      email: input.email,
      source: input.source,
      referral_code: input.referralCode ?? null,
      affiliate_code: input.affiliateCode ?? null,
      metadata: {
        ...input.metadata,
        campaign: input.campaign ?? null,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Lead capture was queued locally because Supabase write failed.", error.message);
    return { ...fallbackLead, reason: "write_failed" };
  }

  const lead = data as CapturedLead | null;
  if (!lead) return { ...fallbackLead, reason: "write_failed" };

  await trackServerEvent({
    eventName: PRODUCT_EVENTS.leadCaptured,
    metadata: {
      source: input.source,
      leadId: lead.id,
    },
  });

  return { id: lead.id, persisted: true, mode: "supabase" };
}

export async function captureAttribution(input: AttributionInput) {
  const admin = createSupabaseAdminClient();
  const attributionId = crypto.randomUUID();
  const metadata = {
    ...input.metadata,
    referralCode: input.referralCode ?? null,
    affiliateCode: input.affiliateCode ?? null,
    campaign: input.campaign ?? null,
    landingPath: input.landingPath ?? null,
  };

  if (!admin) {
    return {
      ok: true,
      id: attributionId,
      persisted: false,
      mode: "local_fallback" as const,
      reason: "not_configured" as const,
    };
  }

  if (input.affiliateCode) {
    const { error } = await admin.from("affiliate_attributions").insert({
      id: attributionId,
      affiliate_code: input.affiliateCode,
      lead_id: input.leadId ?? null,
      user_id: input.userId ?? null,
      metadata,
    });

    if (error) {
      console.warn("Affiliate attribution was not persisted.", error.message);
      return {
        ok: true,
        id: attributionId,
        persisted: false,
        mode: "local_fallback" as const,
        reason: "write_failed" as const,
      };
    }
  }

  await trackServerEvent({
    userId: input.userId,
    eventName: "attribution_captured",
    metadata,
  });

  return {
    ok: true,
    id: attributionId,
    persisted: Boolean(input.affiliateCode),
    mode: input.affiliateCode ? "supabase" as const : "local_fallback" as const,
    reason: input.affiliateCode ? undefined : "not_configured" as const,
  };
}
