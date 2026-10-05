import { NextResponse } from "next/server";

import { billingPortalRequestSchema } from "@/lib/schemas/revenue";
import { createBillingPortalSession } from "@/lib/stripe/checkout";
import { requireRequestUserId } from "@/lib/supabase/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = billingPortalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid billing portal payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Billing is not configured." },
      { status: 503 },
    );
  }
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !subscription?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, code: "customer_missing", message: "No billing account was found." },
      { status: 404 },
    );
  }

  const session = await createBillingPortalSession({
    ...parsed.data,
    customerId: subscription.stripe_customer_id,
  });
  if (!session.ok) {
    return NextResponse.json(session, { status: session.code === "not_configured" ? 503 : 502 });
  }

  return NextResponse.json({ id: session.id, url: session.url });
}
