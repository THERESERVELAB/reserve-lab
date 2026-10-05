import type { RetentionMilestoneKey } from "@/lib/retention-config";
import { calculateActivationScore } from "@/lib/retention-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type RetentionSnapshotInput = {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  weeklyReadinessScore: number;
  adherenceScore: number;
  completedMilestones: RetentionMilestoneKey[];
  lastCheckInAt?: string | null;
};

export function calculateChurnRiskScore(input: Pick<RetentionSnapshotInput, "currentStreak" | "weeklyReadinessScore" | "adherenceScore" | "completedMilestones">) {
  const activationScore = calculateActivationScore(input.completedMilestones);
  const streakPenalty = input.currentStreak === 0 ? 22 : Math.max(0, 12 - input.currentStreak * 2);
  const readinessPenalty = Math.max(0, 75 - input.weeklyReadinessScore) * 0.35;
  const adherencePenalty = Math.max(0, 80 - input.adherenceScore) * 0.4;
  const activationPenalty = Math.max(0, 65 - activationScore) * 0.45;

  return Math.min(100, Math.round(streakPenalty + readinessPenalty + adherencePenalty + activationPenalty));
}

export async function upsertRetentionSnapshot(input: RetentionSnapshotInput) {
  const admin = createSupabaseAdminClient();
  const activationScore = calculateActivationScore(input.completedMilestones);
  const churnRiskScore = calculateChurnRiskScore(input);
  const snapshot = {
    user_id: input.userId,
    current_streak: input.currentStreak,
    best_streak: input.bestStreak,
    weekly_readiness_score: input.weeklyReadinessScore,
    adherence_score: input.adherenceScore,
    activation_score: activationScore,
    churn_risk_score: churnRiskScore,
    completed_milestones: input.completedMilestones,
    last_check_in_at: input.lastCheckInAt ?? null,
  };

  if (!admin) {
    return {
      ...snapshot,
      updated_at: new Date().toISOString(),
      persisted: false,
      mode: "local_fallback" as const,
      reason: "not_configured" as const,
    };
  }

  const { data, error } = await admin
    .from("retention_snapshots")
    .upsert(snapshot, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.warn("Retention snapshot was not persisted.", error.message);
    return {
      ...snapshot,
      updated_at: new Date().toISOString(),
      persisted: false,
      mode: "local_fallback" as const,
      reason: "write_failed" as const,
    };
  }

  return data;
}
