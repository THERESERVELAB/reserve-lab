import { NextResponse } from "next/server";

import { checkoutRequestSchema } from "@/lib/schemas/revenue";
import { createSubscriptionCheckoutSession } from "@/lib/stripe/checkout";
import { requireRequestUser } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const auth = await requireRequestUser(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = checkoutRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const session = await createSubscriptionCheckoutSession({
    ...parsed.data,
    userId: auth.user.id,
    email: auth.user.email,
  });
  if (!session.ok) {
    return NextResponse.json(session, { status: 503 });
  }

  return NextResponse.json({ id: session.id, url: session.url });
}
