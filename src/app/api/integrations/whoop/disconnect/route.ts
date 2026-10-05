/**
 * POST /api/integrations/whoop/disconnect
 *
 * Revoke Reserve's access at WHOOP, then drop the connection and its sealed
 * credentials. Revocation is attempted first: dropping the row locally while
 * WHOOP still believes the grant is live would leave a standing key to the
 * member's health record that nothing in Reserve can see.
 *
 * Readings already gathered stay. They are the member's record, not WHOOP's,
 * and disconnecting a device is not a request to delete history. Removing
 * them is what account deletion and the data export are for.
 */

import { NextResponse } from "next/server";

import { revokeAccess } from "@/lib/devices/whoop";
import { getWhoopConfig } from "@/lib/devices/whoop-config";
import { deleteConnection, ensureFreshAccessToken, findSource } from "@/lib/devices/whoop-connection";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Reserve cannot reach its own database on this deployment.", code: "database_unavailable" },
      { status: 503 },
    );
  }

  const source = await findSource(admin, auth.userId);
  if (!source) {
    return NextResponse.json({ ok: true, alreadyDisconnected: true });
  }

  let revoked = false;
  const config = getWhoopConfig();
  if (config.configured) {
    const token = await ensureFreshAccessToken(admin, source, config.config);
    if (token.ok) {
      try {
        revoked = await revokeAccess(token.accessToken);
      } catch {
        // WHOOP being unreachable must not trap the member in a connection
        // they have asked to end. The local grant goes either way.
        revoked = false;
      }
    }
  }

  await deleteConnection(admin, source.id);

  return NextResponse.json({
    ok: true,
    revokedAtWhoop: revoked,
    note: revoked
      ? null
      : "Reserve's access was removed here. If WHOOP still lists Reserve, remove it in the WHOOP app under Settings, then Apps.",
  });
}
