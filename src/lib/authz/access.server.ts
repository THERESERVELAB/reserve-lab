import "server-only";

import { getSupabasePublicStatus } from "@/lib/supabase/server";
import { resolveRequestUser } from "@/lib/supabase/route-auth";

import type { AccessContext } from "./capabilities";
import { resolveAccess } from "./resolve-access";

/**
 * The acting account's access. Identity comes only from the verified bearer
 * token; owner status only from server-only settings read at request time.
 * The request body, query, cookies and other headers are never consulted.
 */
export async function resolveRequestAccess(request: Request): Promise<AccessContext> {
  const supabaseConfigured = getSupabasePublicStatus().configured;
  const user = supabaseConfigured ? await resolveRequestUser(request) : null;
  return resolveAccess({
    verifiedUserId: user?.id ?? null,
    ownerAllowlist: process.env.RESERVE_OWNER_USER_IDS,
    devOwnerFlag: process.env.RESERVE_DEV_OWNER,
    nodeEnv: process.env.NODE_ENV,
    supabaseConfigured,
  });
}
