import { NextResponse } from "next/server";

import { removePrivateStorageForUser } from "@/lib/supabase/private-storage";
import { requireRequestUserId } from "@/lib/supabase/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "DELETE MY RESERVE ACCOUNT") {
    return NextResponse.json(
      { error: "Account deletion confirmation did not match.", code: "confirmation_required" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Account deletion is not configured.", code: "not_configured" },
      { status: 503 },
    );
  }

  try {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(auth.userId);
    if (userError) throw userError;

    // Storage objects are not owned by the public-schema foreign-key cascade.
    await removePrivateStorageForUser(admin, auth.userId);

    const cleanupResults = await Promise.all([
      admin.from("engagement_events").delete().eq("user_id", auth.userId),
      admin.from("upgrade_intents").delete().eq("user_id", auth.userId),
      admin.from("affiliate_attributions").delete().eq("user_id", auth.userId),
      admin
        .from("referrals")
        .delete()
        .or(`referrer_user_id.eq.${auth.userId},converted_user_id.eq.${auth.userId}`),
      userData.user.email
        ? admin.from("lead_captures").delete().eq("email", userData.user.email)
        : Promise.resolve({ error: null }),
    ]);
    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) throw cleanupError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(auth.userId);
    if (deleteError) throw deleteError;

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Account deletion could not be completed.", code: "delete_failed" },
      { status: 500 },
    );
  }
}
