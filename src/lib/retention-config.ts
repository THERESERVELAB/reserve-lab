import type { FeatureKey, SubscriptionTier } from "@/lib/saas-config";
import { localDateKey } from "@/lib/dates/local-day";

export type EngagementEventType =
  | "app-opened"
  | "daily-check-in"
  | "module-viewed"
  | "weekly-review"
  | "missed-session"
  | "milestone-completed"
  | "locked-feature-viewed"
  | "upgrade-intent";

export type RetentionMilestoneKey =
  | "first-command-center"
  | "first-daily-check-in"
  | "three-day-streak"
  | "first-weekly-review"
  | "first-measurement-log"
  | "first-photo-log"
  | "first-bloodwork-log"
  | "first-upgrade-intent";

export type EngagementPromptKind =
  | "daily-brief"
  | "check-in"
  | "weekly-review"
  | "re-engagement"
  | "upgrade-teaser";

export type EngagementEvent = {
  id: string;
  type: EngagementEventType;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
};

export type EngagementPrompt = {
  id: string;
  kind: EngagementPromptKind;
  title: string;
  body: string;
  priority: "low" | "medium" | "high";
  feature?: FeatureKey;
  createdAt: string;
  dismissedAt?: string;
};

export type UpgradeIntent = {
  feature: FeatureKey;
  requiredTier: SubscriptionTier;
  source: "locked-module" | "sidebar" | "dashboard-teaser" | "settings";
  count: number;
  lastSeenAt: string;
};

export type RetentionMilestone = {
  key: RetentionMilestoneKey;
  label: string;
  activationWeight: number;
  description: string;
};

export type RetentionState = {
  currentStreak: number;
  bestStreak: number;
  lastCheckInDate: string | null;
  /** Null until a real readiness is recorded. Nothing in the app sets one today. */
  weeklyReadinessScore: number | null;
  /** Null until a real adherence is recorded. Nothing in the app sets one today. */
  adherenceScore: number | null;
  activationScore: number;
  completedMilestones: RetentionMilestoneKey[];
  prompts: EngagementPrompt[];
  upgradeIntents: UpgradeIntent[];
  events: EngagementEvent[];
};

export const RETENTION_MILESTONES: Record<RetentionMilestoneKey, RetentionMilestone> = {
  "first-command-center": {
    key: "first-command-center",
    label: "Command Center Opened",
    activationWeight: 12,
    description: "User reaches the personalized dashboard.",
  },
  "first-daily-check-in": {
    key: "first-daily-check-in",
    label: "First Daily Check-in",
    activationWeight: 18,
    description: "User completes the first habit loop.",
  },
  "three-day-streak": {
    key: "three-day-streak",
    label: "Three Day Streak",
    activationWeight: 20,
    description: "User returns for three consecutive daily check-ins.",
  },
  "first-weekly-review": {
    key: "first-weekly-review",
    label: "Weekly Review",
    activationWeight: 16,
    description: "User sees the product as a weekly operating ritual.",
  },
  "first-measurement-log": {
    key: "first-measurement-log",
    label: "Measurement Logged",
    activationWeight: 10,
    description: "User records a physique progress signal.",
  },
  "first-photo-log": {
    key: "first-photo-log",
    label: "Progress Photo Logged",
    activationWeight: 12,
    description: "User creates a visual transformation artifact.",
  },
  "first-bloodwork-log": {
    key: "first-bloodwork-log",
    label: "Bloodwork Logged",
    activationWeight: 12,
    description: "User records a high-trust health-awareness signal.",
  },
  "first-upgrade-intent": {
    key: "first-upgrade-intent",
    label: "Upgrade Intent",
    activationWeight: 8,
    description: "User interacts with an upgrade-gated product surface.",
  },
};

export const DEFAULT_ENGAGEMENT_PROMPTS: EngagementPrompt[] = [
  {
    id: "daily-brief",
    kind: "daily-brief",
    title: "Daily command brief",
    body: "Review readiness, training focus, and one log action for today.",
    priority: "high",
    createdAt: "system",
  },
  {
    id: "weekly-review",
    kind: "weekly-review",
    title: "Weekly review ritual",
    body: "Summarize training, recovery, measurements, and consistency trends.",
    priority: "medium",
    createdAt: "system",
  },
];

export const DEFAULT_RETENTION_STATE: RetentionState = {
  currentStreak: 0,
  bestStreak: 0,
  lastCheckInDate: null,
  weeklyReadinessScore: null,
  adherenceScore: null,
  activationScore: 0,
  completedMilestones: [],
  prompts: DEFAULT_ENGAGEMENT_PROMPTS,
  upgradeIntents: [],
  events: [],
};

/** The readiness and adherence DEFAULT_RETENTION_STATE used to ship. Recorded
    by nothing but the Apex check-in button, which re-saved them as member data. */
export const LEGACY_RETENTION_SAMPLE = { weeklyReadinessScore: 84, adherenceScore: 79 } as const;

/** Clears the shipped 84 / 79 pair from saved engagement, only while BOTH still
    equal it. Pure and idempotent; returns the same object when nothing matched. */
export function clearUntouchedRetentionSample<T extends { weeklyReadinessScore?: number | null; adherenceScore?: number | null }>(engagement: T): T {
  if (
    engagement.weeklyReadinessScore === LEGACY_RETENTION_SAMPLE.weeklyReadinessScore &&
    engagement.adherenceScore === LEGACY_RETENTION_SAMPLE.adherenceScore
  ) {
    return { ...engagement, weeklyReadinessScore: null, adherenceScore: null };
  }
  return engagement;
}

/** The member's local calendar day. Drives the nutrition day rollover and the daily check-in streak. */
export function getDateKey(date = new Date()): string {
  return localDateKey(date);
}

export function isYesterday(previousDateKey: string, currentDateKey: string): boolean {
  const previous = new Date(`${previousDateKey}T00:00:00.000Z`);
  const current = new Date(`${currentDateKey}T00:00:00.000Z`);
  const diff = current.getTime() - previous.getTime();
  return diff === 86_400_000;
}

export function calculateActivationScore(completedMilestones: RetentionMilestoneKey[]): number {
  const score = completedMilestones.reduce(
    (total, key) => total + RETENTION_MILESTONES[key].activationWeight,
    0,
  );
  return Math.min(score, 100);
}

export function createEngagementEvent(
  type: EngagementEventType,
  metadata?: EngagementEvent["metadata"],
): EngagementEvent {
  const createdAt = new Date().toISOString();
  return {
    id: `${type}-${createdAt}`,
    type,
    createdAt,
    metadata,
  };
}
