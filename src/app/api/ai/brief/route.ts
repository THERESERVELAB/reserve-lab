import { NextRequest, NextResponse } from "next/server";

import { generateDailyBrief, persistAiAnalysis } from "@/lib/ai/coaching-engine";
import { PRODUCT_EVENTS, trackServerEvent } from "@/lib/analytics/events";
import { aiBriefRequestSchema } from "@/lib/schemas/ai";
import { resolveRequestUserId } from "@/lib/supabase/route-auth";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = aiBriefRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brief request", details: parsed.error.flatten() }, { status: 400 });
  }

  const brief = await generateDailyBrief(parsed.data);
  // Persist only under the VERIFIED session user — never a body-supplied id.
  const authUserId = await resolveRequestUserId(request);
  const persistence = authUserId
    ? await persistAiAnalysis(authUserId, brief)
    : { persisted: false, mode: "local_fallback" as const, reason: "anonymous" as const };

  await trackServerEvent({
    userId: authUserId ?? undefined,
    eventName: PRODUCT_EVENTS.aiBriefGenerated,
    metadata: {
      tier: parsed.data.tier,
      persona: parsed.data.persona,
      persisted: persistence.persisted,
    },
  });

  return NextResponse.json({ brief, persistence });
}
