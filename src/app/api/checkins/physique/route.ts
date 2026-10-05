import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPhysiqueCheckIn, persistPhysiqueCheckIn } from "@/lib/ai/value-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRequestUserId, rejectUserIdMismatch } from "@/lib/supabase/route-auth";
import { physiqueCheckInRequestSchema } from "@/lib/schemas/value-engine";

const physiqueCheckInQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export async function POST(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = physiqueCheckInRequestSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid physique check-in payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mismatch = rejectUserIdMismatch(auth.userId, parsed.data.userId);
  if (mismatch) return mismatch;

  const output = buildPhysiqueCheckIn(parsed.data);
  const persistence = await persistPhysiqueCheckIn(auth.userId, output);

  return NextResponse.json({
    ok: true,
    mode: persistence.persisted ? "supabase" : "local_fallback",
    output,
    persistence,
  });
}

export async function GET(request: Request) {
  // Read only the VERIFIED caller's check-ins — never a userId from the query.
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = physiqueCheckInQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid physique check-in query", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mismatch = rejectUserIdMismatch(auth.userId, parsed.data.userId);
  if (mismatch) return mismatch;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({
      ok: true,
      mode: "local_fallback",
      checkIns: [],
      count: 0,
      message: "Supabase is not configured. Read local check-ins from the client cache.",
    });
  }

  const { data, error } = await admin
    .from("physique_checkins")
    .select("*")
    .eq("user_id", auth.userId)
    .order("check_in_date", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json({
      ok: true,
      mode: "local_fallback",
      checkIns: [],
      count: 0,
      message: "Remote check-ins unavailable. Read local check-ins from the client cache.",
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    checkIns: data,
    count: data.length,
  });
}
