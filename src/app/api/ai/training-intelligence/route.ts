import { NextResponse } from "next/server";

import { AI_SERVICE_SAFETY_NOTE, generatePremiumTrainingPlan, generateTrainingIntelligence, persistTrainingPrescription } from "@/lib/ai/coaching-engine";
import {
  intelligenceEnvelope,
  invalidIntelligenceQueryResponse,
  NOT_REQUESTED_PERSISTENCE,
  parseIntelligenceQuery,
  resolvePersistUserId,
} from "@/lib/ai/route-helpers";
import { trainingIntelligenceRequestSchema } from "@/lib/schemas/ai";

export async function GET(request: Request) {
  const parsed = parseIntelligenceQuery(request);

  if (!parsed.success) {
    return invalidIntelligenceQueryResponse(parsed.error);
  }

  const output = generatePremiumTrainingPlan(parsed.data);
  const persistUserId = await resolvePersistUserId(request, parsed.data);
  const persistence = persistUserId
    ? await persistTrainingPrescription(persistUserId, output)
    : NOT_REQUESTED_PERSISTENCE;

  return NextResponse.json(intelligenceEnvelope(output, persistence, AI_SERVICE_SAFETY_NOTE));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = trainingIntelligenceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid training intelligence payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    output: generateTrainingIntelligence(parsed.data),
    mode: "safe_fallback",
  });
}
