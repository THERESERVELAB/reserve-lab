import { NextResponse } from "next/server";

import { AUTH_PROVIDERS } from "@/lib/auth/lifecycle";

export async function GET() {
  return NextResponse.json({
    providers: AUTH_PROVIDERS,
    lifecycle: ["signup", "onboarding", "subscription-assignment", "session-persistence"],
  });
}
