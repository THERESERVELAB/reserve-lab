import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { analyticsEventSchema } from "@/lib/schemas/analytics";
import { resolveRequestUserId } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyticsEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const verifiedUserId = await resolveRequestUserId(request);
  const result = await trackServerEvent({
    ...parsed.data,
    userId: verifiedUserId ?? undefined,
  });
  return NextResponse.json(result);
}
