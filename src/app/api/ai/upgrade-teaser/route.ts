import { NextResponse } from "next/server";

import { generateUpgradePersuasion } from "@/lib/ai/coaching-engine";
import { upgradePersuasionRequestSchema } from "@/lib/schemas/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = upgradePersuasionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upgrade teaser payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    output: generateUpgradePersuasion(parsed.data),
    mode: "safe_fallback",
  });
}
