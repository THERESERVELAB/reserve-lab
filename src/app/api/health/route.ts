import { NextResponse } from "next/server";

import { getSupabasePublicStatus } from "@/lib/supabase/server";

/**
 * Public production health endpoint.
 *
 * Reports ONLY non-sensitive readiness booleans — never URLs, keys, tokens,
 * user data, or stack traces. Used by uptime checks and deploy verification
 * to confirm the deployment is configured for authenticated cloud mode.
 *
 * `supabaseConfigured` reflects the public browser pair
 * (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY). When it is
 * false in production, the app runs in the "configuration required" gate —
 * it does NOT silently fall back to a device-local member experience.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const supabase = getSupabasePublicStatus();

  return NextResponse.json(
    {
      status: "ok",
      environment: process.env.NODE_ENV ?? "unknown",
      // Auth and cloud member-state both require the public Supabase pair.
      supabaseConfigured: supabase.configured,
      authConfigured: supabase.configured,
      // Commit SHA when the platform provides one (Vercel sets this); never a secret.
      build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
