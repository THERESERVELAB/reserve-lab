/* ════════════════════════════════════════════════════════════════════════
   COMMUNITY STATUS — what the Community screen can honestly say.

   The product has community tables and routes (channels, messages,
   memberships) but no member-facing reading or posting surface, no author
   display, and no moderation or reporting. Until those exist there is no
   conversation to show, so this screen shows none: no sample posts, no
   member counts, no ranks, no "online now".

   What IS real, and what this module describes:
     · the channel list (from the server when it answers, else the shipped
       definitions the server is seeded from)
     · which of those channels the member's own plan includes

   Public tier names are Reserve Signature and Reserve Black only, so an
   internal tier word inside a channel's stored name or description is
   rewritten for display rather than leaked.

   Pure: no React, no store, no network.
   ════════════════════════════════════════════════════════════════════════ */

import { TIER_RANK, publicTierFor, type SubscriptionTier } from "@/lib/saas-config";

import type { CommunityChannelDefinition } from "./channels";

export type CommunityChannelRow = {
  slug: string;
  name: string;
  description: string;
  /** "Included in your plan", or the public plan that includes it. */
  access: string;
  included: boolean;
};

export type CommunityStatus = {
  statement: string;
  support: string;
  channelsTotal: number;
  channelsIncluded: number;
  /** The plan that would include every channel, when the member's plan does not. */
  fullAccessPlan: string | null;
  rows: CommunityChannelRow[];
};

/** Internal tier words never reach the member: "Elite" is Reserve Black in public. */
export function publicChannelText(text: string): string {
  return text.replace(/\bElite\b/g, "Reserve Black");
}

export function describeCommunity(input: {
  channels: CommunityChannelDefinition[];
  tier: SubscriptionTier;
}): CommunityStatus {
  const { channels, tier } = input;
  const rank = TIER_RANK[tier];

  const rows: CommunityChannelRow[] = channels.map((channel) => {
    const included = rank >= TIER_RANK[channel.requiredTier];
    return {
      slug: channel.slug,
      name: publicChannelText(channel.name),
      description: publicChannelText(channel.description),
      access: included ? "Included in your plan" : publicTierFor(channel.requiredTier).label,
      included,
    };
  });

  const channelsIncluded = rows.filter((row) => row.included).length;
  const highest = channels.reduce<SubscriptionTier | null>(
    (top, channel) => (top === null || TIER_RANK[channel.requiredTier] > TIER_RANK[top] ? channel.requiredTier : top),
    null,
  );
  const fullAccessPlan = highest && TIER_RANK[highest] > rank ? publicTierFor(highest).label : null;

  return {
    statement: "Community is not open yet.",
    support:
      channels.length === 0
        ? "No channels are set up. Nothing is posted, and no one can read or write here yet."
        : "The channels below are planned. Reading and posting are not built, so there are no conversations to show.",
    channelsTotal: channels.length,
    channelsIncluded,
    fullAccessPlan,
    rows,
  };
}
