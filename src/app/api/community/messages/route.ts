import { NextResponse } from "next/server";

import {
  CommunityAccessError,
  createCommunityMessage,
  listCommunityMessages,
} from "@/lib/community/messages";
import { communityMessageCreateSchema, communityMessagesQuerySchema } from "@/lib/schemas/community";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

function communityErrorResponse(error: unknown) {
  if (error instanceof CommunityAccessError) {
    return NextResponse.json({ error: error.message, code: "community_access" }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Community is unavailable.", code: "community_unavailable" },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const parsed = communityMessagesQuerySchema.safeParse({
    channelId: url.searchParams.get("channelId") ?? undefined,
    channelSlug: url.searchParams.get("channelSlug") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid community message query", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json(await listCommunityMessages(parsed.data, auth.userId));
  } catch (error) {
    return communityErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = communityMessageCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid community message payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createCommunityMessage(parsed.data, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return communityErrorResponse(error);
  }
}
