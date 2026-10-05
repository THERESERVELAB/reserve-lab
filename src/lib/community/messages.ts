import "server-only";

import type { CommunityMessage } from "@/lib/contracts/product";
import type { Json } from "@/lib/database/types";
import type { SubscriptionTier } from "@/lib/saas-config";
import { TIER_RANK } from "@/lib/saas-config";
import type { CommunityMessageCreate, CommunityMessagesQuery } from "@/lib/schemas/community";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export class CommunityAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 503,
  ) {
    super(message);
  }
}

async function requireAccessibleChannel(userId: string, query: CommunityMessagesQuery) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new CommunityAccessError("Community persistence is not configured.", 503);

  let channelQuery = admin
    .from("community_channels")
    .select("id,visibility,required_tier")
    .limit(1);
  channelQuery = query.channelId
    ? channelQuery.eq("id", query.channelId)
    : channelQuery.eq("slug", query.channelSlug!);

  const { data: channel, error: channelError } = await channelQuery.maybeSingle();
  if (channelError) throw channelError;
  if (!channel) throw new CommunityAccessError("Channel not found.", 404);

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] =
    await Promise.all([
      admin.from("profiles").select("current_tier").eq("id", userId).single(),
      admin
        .from("community_memberships")
        .select("id")
        .eq("channel_id", channel.id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  if (profileError) throw profileError;
  if (membershipError) throw membershipError;

  const tierAllowed =
    TIER_RANK[profile.current_tier as SubscriptionTier] >=
    TIER_RANK[channel.required_tier as SubscriptionTier];
  const allowed = channel.visibility === "private" ? Boolean(membership) : tierAllowed;
  if (!allowed) throw new CommunityAccessError("You do not have access to this channel.", 403);

  return { admin, channelId: channel.id };
}

export async function listCommunityMessages(query: CommunityMessagesQuery, userId: string) {
  const { admin, channelId } = await requireAccessibleChannel(userId, query);
  const { data, error } = await admin
    .from("community_messages")
    .select("id,channel_id,user_id,parent_id,body,is_pinned,check_in_type,created_at,deleted_at")
    .eq("channel_id", channelId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(query.limit);
  if (error) throw error;

  return {
    messages: (data ?? []).map((message) => ({
      id: message.id,
      channelId: message.channel_id,
      userId: message.user_id,
      parentId: message.parent_id,
      body: message.body,
      isPinned: message.is_pinned,
      checkInType: message.check_in_type as CommunityMessage["checkInType"],
      reactionCounts: {},
      createdAt: message.created_at,
      deletedAt: message.deleted_at,
    })) satisfies CommunityMessage[],
    mode: "supabase" as const,
  };
}

export async function createCommunityMessage(input: CommunityMessageCreate, userId: string) {
  const { admin, channelId } = await requireAccessibleChannel(userId, {
    channelId: input.channelId,
    limit: 1,
  });
  const { data, error } = await admin
    .from("community_messages")
    .insert({
      channel_id: channelId,
      user_id: userId,
      parent_id: input.parentId ?? null,
      body: input.body,
      check_in_type: input.checkInType ?? null,
      metadata: input.metadata as Json,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { ok: true, id: data.id, mode: "supabase" as const };
}
