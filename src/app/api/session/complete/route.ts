import { NextResponse } from "next/server";

import { completeWorkoutSession, persistSessionCompletion } from "@/lib/ai/value-engine";
import { sessionCompleteRequestSchema } from "@/lib/schemas/value-engine";
import { requireRequestUserId, rejectUserIdMismatch } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  // Authenticate first — an unauthenticated caller is rejected regardless of payload.
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = sessionCompleteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session completion payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mismatch = rejectUserIdMismatch(auth.userId, parsed.data.userId);
  if (mismatch) return mismatch;

  const output = completeWorkoutSession(parsed.data);
  const persistence = await persistSessionCompletion(auth.userId, output);

  return NextResponse.json({
    ok: true,
    mode: persistence.persisted ? "supabase" : "local_fallback",
    output,
    persistence,
  });
}
