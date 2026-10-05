import type { ChannelVisibility } from "@/lib/database/types";
import type { SubscriptionTier } from "@/lib/saas-config";
import { TIER_RANK } from "@/lib/saas-config";

export type CommunityChannelDefinition = {
  slug: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  requiredTier: SubscriptionTier;
  kind?: "discussion" | "challenge" | "check-in";
  pinned?: boolean;
};

export const COMMUNITY_CHANNELS: CommunityChannelDefinition[] = [
  { slug: "bodybuilding", name: "Bodybuilding", description: "Physique training discussion and progress logs.", visibility: "core", requiredTier: "core" },
  { slug: "fat-loss", name: "Fat Loss", description: "Cutting phases, adherence, and behavior support.", visibility: "core", requiredTier: "core" },
  { slug: "women-performance", name: "Women Performance", description: "Training, recovery, and performance discussion for women.", visibility: "core", requiredTier: "core" },
  { slug: "hybrid-athletes", name: "Hybrid Athletes", description: "Strength, conditioning, endurance, and recovery coordination.", visibility: "pro", requiredTier: "pro" },
  { slug: "progress-check-ins", name: "Progress Check-ins", description: "Weekly transformations, wins, and accountability.", visibility: "core", requiredTier: "core" },
  { slug: "bloodwork-discussion", name: "Bloodwork Discussion", description: "Lab result organization and clinician-review preparation.", visibility: "pro", requiredTier: "pro" },
  { slug: "supplement-discussion", name: "Supplement Discussion", description: "Support stack tracking and experience notes without dosage guidance.", visibility: "pro", requiredTier: "pro" },
  { slug: "challenges", name: "Challenges", description: "Community milestones and adherence competitions.", visibility: "core", requiredTier: "core" },
  { slug: "elite-war-room", name: "Elite War Room", description: "Private Elite accountability and advanced trend observation.", visibility: "elite", requiredTier: "elite" },
];

export function canViewChannel(tier: SubscriptionTier, channel: CommunityChannelDefinition) {
  return TIER_RANK[tier] >= TIER_RANK[channel.requiredTier];
}
