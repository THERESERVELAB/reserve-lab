import "server-only";

/* ════════════════════════════════════════════════════════════════════════
   WHOOP CONFIGURATION — whether this deployment can actually reach WHOOP.

   Four things have to be true before a Connect button is honest:

     WHOOP_CLIENT_ID                  the registered app
     WHOOP_CLIENT_SECRET              its secret, server-side only
     redirect URI                     WHOOP_REDIRECT_URI, or derived from
                                      NEXT_PUBLIC_APP_URL
     RESERVE_TOKEN_ENCRYPTION_KEY     somewhere safe to keep the tokens

   When any is missing this module says so, by NAME, and the connect surface
   stays disabled with that reason. It never degrades into a pretend
   connection, and it never stores a token in the clear.
   ════════════════════════════════════════════════════════════════════════ */

import { createHmac } from "node:crypto";

import { serverEnv } from "@/lib/env/server";

export const WHOOP_CALLBACK_PATH = "/api/integrations/whoop/callback";

export type WhoopConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Derived from the vault key, so there is one secret to rotate, not two. */
  stateSecret: string;
};

export type WhoopConfigStatus =
  | { configured: true; config: WhoopConfig }
  | { configured: false; missing: string[]; reason: string };

function resolveRedirectUri(): string | null {
  if (serverEnv.WHOOP_REDIRECT_URI) return serverEnv.WHOOP_REDIRECT_URI;
  if (serverEnv.NEXT_PUBLIC_APP_URL) {
    return new URL(WHOOP_CALLBACK_PATH, serverEnv.NEXT_PUBLIC_APP_URL).toString();
  }
  return null;
}

export function getWhoopConfig(): WhoopConfigStatus {
  const missing: string[] = [];

  const clientId = serverEnv.WHOOP_CLIENT_ID;
  const clientSecret = serverEnv.WHOOP_CLIENT_SECRET;
  const vaultKey = serverEnv.RESERVE_TOKEN_ENCRYPTION_KEY;
  const redirectUri = resolveRedirectUri();

  if (!clientId) missing.push("WHOOP_CLIENT_ID");
  if (!clientSecret) missing.push("WHOOP_CLIENT_SECRET");
  if (!vaultKey) missing.push("RESERVE_TOKEN_ENCRYPTION_KEY");
  if (!redirectUri) missing.push("WHOOP_REDIRECT_URI (or NEXT_PUBLIC_APP_URL)");

  if (!clientId || !clientSecret || !vaultKey || !redirectUri) {
    return {
      configured: false,
      missing,
      reason:
        "WHOOP needs a registered developer app on this deployment. Until its credentials are set, Reserve cannot open a connection and will not pretend to.",
    };
  }

  return {
    configured: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      stateSecret: createHmac("sha256", vaultKey).update("whoop:oauth:state").digest("base64"),
    },
  };
}

/** The member-facing origin, used for post-callback redirects. */
export function appOrigin(request: Request): string {
  if (serverEnv.NEXT_PUBLIC_APP_URL) return serverEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return new URL(request.url).origin;
}
