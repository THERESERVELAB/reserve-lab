/**
 * GET /api/integrations/whoop/callback
 *
 * Where WHOOP sends the member back. This request is a plain browser redirect:
 * it carries no Supabase session and no bearer token, so the ONLY thing that
 * says whose connection this is, is the signed `state` issued by /start. If
 * that signature does not verify, nothing is written.
 *
 * Ends in a redirect back into the app with a result the Settings row can read,
 * never in a JSON page — the member is in a browser, not in a fetch.
 */

import { NextResponse } from "next/server";

import { verifyOAuthState } from "@/lib/devices/oauth-state";
import { exchangeCodeForTokens, WHOOP_API_BASE } from "@/lib/devices/whoop";
import { appOrigin, getWhoopConfig } from "@/lib/devices/whoop-config";
import { saveConnection } from "@/lib/devices/whoop-connection";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function back(request: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, appOrigin(request));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

/** Best effort: a name to show on the row. A failure here must not fail the connection. */
async function readVendorIdentity(accessToken: string) {
  try {
    const response = await fetch(`${WHOOP_API_BASE}/v2/user/profile/basic`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return {};
    const profile = (await response.json()) as {
      user_id?: number;
      first_name?: string;
      last_name?: string;
    };
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    return {
      userId: profile.user_id != null ? String(profile.user_id) : null,
      displayName: name || null,
    };
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnPath = "/";

  const denied = url.searchParams.get("error");
  if (denied) {
    // The member declined on WHOOP's screen, or WHOOP refused the request.
    return back(request, returnPath, { whoop: "cancelled" });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return back(request, returnPath, { whoop: "error", reason: "incomplete" });
  }

  const config = getWhoopConfig();
  if (!config.configured) {
    return back(request, returnPath, { whoop: "error", reason: "not_configured" });
  }

  const verified = verifyOAuthState(state, config.config.stateSecret);
  if (!verified.ok) {
    // A forged or stale state is the one failure that must never write a row.
    return back(request, returnPath, { whoop: "error", reason: verified.reason });
  }

  const destination = verified.returnTo ?? returnPath;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return back(request, destination, { whoop: "error", reason: "database_unavailable" });
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId: config.config.clientId,
      clientSecret: config.config.clientSecret,
      redirectUri: config.config.redirectUri,
    });

    const identity = await readVendorIdentity(tokens.accessToken);
    const source = await saveConnection(admin, verified.userId, tokens, identity);

    if (!source) {
      // Reached when there is no vault key: the tokens are discarded rather
      // than written in the clear, and the member is told the truth.
      return back(request, destination, { whoop: "error", reason: "cannot_store_credentials" });
    }

    if (!tokens.refreshToken) {
      // Without `offline`, this connection dies in an hour. Say so now.
      return back(request, destination, { whoop: "connected", limited: "no_offline_scope" });
    }

    return back(request, destination, { whoop: "connected" });
  } catch {
    return back(request, destination, { whoop: "error", reason: "exchange_failed" });
  }
}
