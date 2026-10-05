import { NextResponse } from "next/server";

import { captureAttribution } from "@/lib/acquisition/leads";
import { attributionSchema } from "@/lib/schemas/acquisition";
import { resolveRequestUserId } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = attributionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attribution payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const verifiedUserId = await resolveRequestUserId(request);
  const result = await captureAttribution({
    ...parsed.data,
    userId: verifiedUserId ?? undefined,
  });
  return NextResponse.json(result);
}
