import { NextResponse } from "next/server";

import { buildQuickNutritionAction } from "@/lib/ai/value-engine";
import { quickNutritionRequestSchema } from "@/lib/schemas/value-engine";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = quickNutritionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quick nutrition payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const output = buildQuickNutritionAction(parsed.data);

  return NextResponse.json({
    ok: true,
    mode: "local_fallback",
    output,
    persistence: { persisted: false, mode: "local_fallback", reason: "client_local_source_of_truth" },
  });
}
