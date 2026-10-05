import { NextResponse } from "next/server";

import { buildPrivateStorageManifest } from "@/lib/supabase/private-storage";
import { requireRequestUserId } from "@/lib/supabase/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const USER_ID_TABLES = [
  "onboarding_profiles",
  "user_preferences",
  "subscriptions",
  "user_entitlements",
  "digital_twin_snapshots",
  "body_metrics",
  "muscle_scores",
  "weak_points",
  "progress_photos",
  "transformation_snapshots",
  "mesocycles",
  "training_sessions",
  "exercise_logs",
  "nutrition_logs",
  "bloodwork_logs",
  "supplement_logs",
  "retention_snapshots",
  "engagement_events",
  "upgrade_intents",
  "community_memberships",
  "community_messages",
  "community_reactions",
  "community_presence",
  "ai_analysis_outputs",
  "intelligence_outputs",
  "training_prescriptions",
  "todays_commands",
  "active_sessions",
  "session_sets",
  "session_swaps",
  "progression_snapshots",
  "digital_athlete_snapshots",
  "physique_checkins",
  "nutrition_commands",
  "recovery_commands",
  "recovery_logs",
  /* Connected devices and everything they observed. `connected_health_sources`
     carries no secret — the sealed tokens live in connected_health_credentials,
     which is deliberately NOT exported: it is Reserve's key to the vendor, not
     the member's data, and a plaintext export of it would be a credential leak. */
  "connected_health_sources",
  "connected_health_observations",
] as const;

export async function GET(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Account export is not configured.", code: "not_configured" },
      { status: 503 },
    );
  }

  try {
    const [profile, athleteProfile, coachProfile, memberState, relationships, referrals, attributions, storage] =
      await Promise.all([
        admin.from("profiles").select("*").eq("id", auth.userId).maybeSingle(),
        admin.from("athlete_profiles").select("*").eq("user_id", auth.userId).maybeSingle(),
        admin.from("coach_profiles").select("*").eq("user_id", auth.userId).maybeSingle(),
        admin.from("member_state").select("*").eq("user_id", auth.userId).maybeSingle(),
        admin
          .from("coach_client_relationships")
          .select("*")
          .or(`coach_id.eq.${auth.userId},athlete_id.eq.${auth.userId}`),
        admin
          .from("referrals")
          .select("*")
          .or(`referrer_user_id.eq.${auth.userId},converted_user_id.eq.${auth.userId}`),
        admin.from("affiliate_attributions").select("*").eq("user_id", auth.userId),
        buildPrivateStorageManifest(admin, auth.userId),
      ]);

    const primaryResults = [
      profile,
      athleteProfile,
      coachProfile,
      memberState,
      relationships,
      referrals,
      attributions,
    ];
    const primaryError = primaryResults.find((result) => result.error)?.error;
    if (primaryError) throw primaryError;

    const domainEntries = await Promise.all(
      USER_ID_TABLES.map(async (table) => {
        const { data, error } = await admin.from(table).select("*").eq("user_id", auth.userId);
        if (error) throw error;
        return [table, data ?? []] as const;
      }),
    );

    const exportPayload = {
      product: "Reserve Lab",
      exportedAt: new Date().toISOString(),
      userId: auth.userId,
      profile: profile.data,
      athleteProfile: athleteProfile.data,
      coachProfile: coachProfile.data,
      memberState: memberState.data,
      coachClientRelationships: relationships.data ?? [],
      referrals: referrals.data ?? [],
      affiliateAttributions: attributions.data ?? [],
      domain: Object.fromEntries(domainEntries),
      privateFiles: storage,
      privateFileLinksExpireInSeconds: 15 * 60,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="reserve-lab-export-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Account export could not be completed.", code: "export_failed" },
      { status: 500 },
    );
  }
}
