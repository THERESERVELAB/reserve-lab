import { NextResponse } from "next/server";

import { persistActiveSession, startWorkoutSession } from "@/lib/ai/value-engine";
import { requireRequestUserId, rejectUserIdMismatch } from "@/lib/supabase/route-auth";
import { sessionStartRequestSchema } from "@/lib/schemas/value-engine";

export async function POST(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = sessionStartRequestSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session start payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mismatch = rejectUserIdMismatch(auth.userId, parsed.data.userId);
  if (mismatch) return mismatch;

  const output = startWorkoutSession(parsed.data);
  const persistence = await persistActiveSession(auth.userId, output);

  return NextResponse.json({
    ok: true,
    mode: persistence.persisted ? "supabase" : "local_fallback",
    output,
    persistence,
  });
}
