import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { getSupabasePublicStatus } from "@/lib/supabase/server";

/**
 * Server-side request authentication for member API routes.
 *
 * The ONLY trustworthy owner of a request is the identity inside a verified
 * Supabase access token — never a `userId` from the body, query string, or
 * URL. Routes call these helpers to derive the acting user from the caller's
 * `Authorization: Bearer <access_token>` header, which is validated against
 * Supabase Auth (`auth.getUser(token)` performs a real verification).
 *
 * Bearer verification (not cookie SSR) is deliberate: Reserve's browser
 * client persists the session in localStorage, so there is no auth cookie to
 * read server-side. A signed-in client attaches the token via
 * `authorizedJsonInit` (lib/supabase/client-auth). Requests without a valid
 * token are treated as unauthenticated — they are never allowed to act on
 * another member's data.
 */

export type VerifiedRequestUser = { id: string; email: string | null };

/** Verify the caller's bearer token and return their identity, or null. Never throws. */
export async function resolveRequestUser(request: Request): Promise<VerifiedRequestUser | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const status = getSupabasePublicStatus();
  if (!status.configured || !serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/** Verify the caller's bearer token and return their user id, or null. Never throws. */
export async function resolveRequestUserId(request: Request): Promise<string | null> {
  return (await resolveRequestUser(request))?.id ?? null;
}

export function unauthorizedResponse(message = "Authentication required.") {
  return NextResponse.json({ error: message, code: "unauthenticated" }, { status: 401 });
}

export function forbiddenResponse(message = "You cannot act on another member's data.") {
  return NextResponse.json({ error: message, code: "forbidden" }, { status: 403 });
}

/**
 * Resolve the authenticated user id or return a 401 response to send back.
 * Usage: `const auth = await requireRequestUserId(request); if ("response" in auth) return auth.response;`
 */
export async function requireRequestUserId(
  request: Request,
): Promise<{ userId: string } | { response: NextResponse }> {
  const userId = await resolveRequestUserId(request);
  if (!userId) return { response: unauthorizedResponse() };
  return { userId };
}

export async function requireRequestUser(
  request: Request,
): Promise<{ user: VerifiedRequestUser } | { response: NextResponse }> {
  const user = await resolveRequestUser(request);
  if (!user) return { response: unauthorizedResponse() };
  return { user };
}

/**
 * If a request carries a `userId` (body/query), it must equal the verified
 * session user. Returns a 403 response when they disagree; otherwise null.
 * Callers should still USE the verified id, never the supplied one.
 */
export function rejectUserIdMismatch(
  verifiedUserId: string,
  suppliedUserId: string | null | undefined,
): NextResponse | null {
  if (suppliedUserId && suppliedUserId !== verifiedUserId) return forbiddenResponse();
  return null;
}
