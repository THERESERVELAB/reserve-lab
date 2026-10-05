/**
 * POST /api/integrations/whoop/start
 *
 * Begin an authorization. Returns the WHOOP consent URL for the browser to
 * open; it does not redirect, because the caller is a signed-in fetch and the
 * bearer token cannot survive a redirect chain.
 *
 * The returned URL carries a SIGNED state (src/lib/devices/oauth-state) that
 * names the verified member. That signature is the only thing tying the code
 * WHOOP sends back to an account, so it is created here and nowhere else.
 */

import { NextResponse } from "next/server";

import { createOAuthState, STATE_TTL_SECONDS } from "@/lib/devices/oauth-state";
import { buildAuthorizeUrl, WHOOP_SCOPES } from "@/lib/devices/whoop";
import { getWhoopConfig } from "@/lib/devices/whoop-config";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getWhoopConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: config.reason, code: "not_configured", missing: config.missing },
      { status: 503 },
    );
  }

  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { returnTo?: unknown } | null;
  // Only a same-site path may be honoured, or this becomes an open redirect.
  const returnTo =
    typeof body?.returnTo === "string" && body.returnTo.startsWith("/") && !body.returnTo.startsWith("//")
      ? body.returnTo
      : undefined;

  const state = createOAuthState({
    userId: auth.userId,
    secret: config.config.stateSecret,
    returnTo,
  });

  return NextResponse.json({
    authorizeUrl: buildAuthorizeUrl({
      clientId: config.config.clientId,
      redirectUri: config.config.redirectUri,
      state,
    }),
    scopes: WHOOP_SCOPES,
    expiresInSeconds: STATE_TTL_SECONDS,
  });
}
