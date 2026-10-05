import { NextResponse } from "next/server";

import { resolveRequestAccess } from "@/lib/authz/access.server";

// Access depends on the caller's verified token — never served from a cache.
export const dynamic = "force-dynamic";

/** This account's role and capabilities. Member access for anyone not verified as the owner. */
export async function GET(request: Request) {
  const access = await resolveRequestAccess(request);
  return NextResponse.json(
    { role: access.role, capabilities: access.capabilities, source: access.source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
