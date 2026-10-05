/**
 * GET /api/integrations/whoop/status
 *
 * What this deployment can honestly offer the member, and where their
 * connection stands. The Settings row is drawn entirely from this: when the
 * deployment has no WHOOP credentials, the answer says so by variable name and
 * the button stays disabled rather than failing on click.
 *
 * Never returns a token, sealed or otherwise.
 */

import { NextResponse } from "next/server";

import { PROVIDER_LABELS } from "@/lib/devices/health-sources";
import { getWhoopConfig } from "@/lib/devices/whoop-config";
import { findSource, toConnectionView } from "@/lib/devices/whoop-connection";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Authenticate before answering: which credentials a deployment holds is
  // configuration, not public information.
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const config = getWhoopConfig();
  if (!config.configured) {
    return NextResponse.json({
      provider: "whoop",
      label: PROVIDER_LABELS.whoop,
      available: false,
      reason: config.reason,
      missing: config.missing,
      connection: null,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        provider: "whoop",
        label: PROVIDER_LABELS.whoop,
        available: false,
        reason: "Reserve cannot reach its own database on this deployment.",
        missing: ["SUPABASE_SERVICE_ROLE_KEY"],
        connection: null,
      },
      { status: 503 },
    );
  }

  const source = await findSource(admin, auth.userId);

  return NextResponse.json({
    provider: "whoop",
    label: PROVIDER_LABELS.whoop,
    available: true,
    reason: null,
    missing: [],
    connection: source ? toConnectionView(source) : null,
  });
}
