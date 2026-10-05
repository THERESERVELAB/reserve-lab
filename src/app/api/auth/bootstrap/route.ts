import { NextResponse } from "next/server";

import { ensureUserProfile } from "@/lib/auth/lifecycle";
import { authBootstrapRequestSchema } from "@/lib/schemas/auth";
import { requireRequestUserId, rejectUserIdMismatch } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  // A member may only bootstrap their OWN profile. The id is taken from the
  // verified session, never the request body.
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = authBootstrapRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auth bootstrap payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mismatch = rejectUserIdMismatch(auth.userId, parsed.data.userId);
  if (mismatch) return mismatch;

  try {
    const profile = await ensureUserProfile({ ...parsed.data, userId: auth.userId });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "bootstrap_failed",
        message: error instanceof Error ? error.message : "Profile bootstrap failed",
      },
      { status: 500 },
    );
  }
}
