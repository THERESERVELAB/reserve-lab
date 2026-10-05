import { NextResponse } from "next/server";

import { listCommunityChannels } from "@/lib/community/channels-server";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

export async function GET(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  try {
    const channels = await listCommunityChannels(auth.userId);
    return NextResponse.json({ channels, mode: "supabase" });
  } catch {
    return NextResponse.json(
      { error: "Community channels are unavailable.", code: "community_unavailable" },
      { status: 503 },
    );
  }
}
