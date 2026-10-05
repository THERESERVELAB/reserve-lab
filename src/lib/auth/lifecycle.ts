import type { SubscriptionTier, UserPersona } from "@/lib/saas-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AuthProvider = "email" | "google" | "apple";

export type ProfileBootstrapInput = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  persona?: UserPersona;
};

export const AUTH_PROVIDERS: Record<AuthProvider, { label: string; enabled: boolean }> = {
  email: { label: "Email and password", enabled: true },
  google: { label: "Google", enabled: true },
  apple: { label: "Apple", enabled: false },
};

export async function ensureUserProfile(input: ProfileBootstrapInput) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Canonical profile persistence is not configured.");
  }

  // Never accept or rewrite subscription state during member bootstrap. Tier
  // changes belong exclusively to the verified billing/admin lifecycle.
  const { error: insertError } = await admin
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        email: input.email ?? null,
        display_name: input.displayName ?? null,
        persona: input.persona ?? "intermediate",
        onboarding_status: "not-started",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (insertError) throw insertError;

  const identityUpdates = {
    ...(input.email ? { email: input.email } : {}),
    ...(input.displayName ? { display_name: input.displayName } : {}),
  };
  if (Object.keys(identityUpdates).length > 0) {
    const { error: updateError } = await admin
      .from("profiles")
      .update(identityUpdates)
      .eq("id", input.userId);
    if (updateError) throw updateError;
  }

  const { error: athleteError } = await admin
    .from("athlete_profiles")
    .upsert({ user_id: input.userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (athleteError) throw athleteError;

  const { data, error } = await admin
    .from("profiles")
    .select()
    .eq("id", input.userId)
    .single();

  if (error) throw error;
  return data;
}

export async function assignSubscriptionTier(userId: string, tier: SubscriptionTier) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      id: userId,
      current_tier: tier,
      updated_at: new Date().toISOString(),
      persisted: false,
      mode: "local_fallback" as const,
    };
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ current_tier: tier })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
