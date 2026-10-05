import { NextResponse } from "next/server";

import { captureLead } from "@/lib/acquisition/leads";
import { leadCaptureSchema } from "@/lib/schemas/acquisition";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = leadCaptureSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await captureLead(parsed.data);
  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    persisted: lead.persisted,
    mode: lead.mode,
    reason: lead.reason,
  });
}
