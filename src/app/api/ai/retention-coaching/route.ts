import { NextResponse } from "next/server";

import { generateRetentionCoaching } from "@/lib/ai/coaching-engine";
import { retentionCoachingRequestSchema } from "@/lib/schemas/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = retentionCoachingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid retention coaching payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    output: generateRetentionCoaching(parsed.data),
    mode: "safe_fallback",
  });
}
