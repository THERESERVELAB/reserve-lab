import { NextResponse } from "next/server";

import { AI_SERVICE_SAFETY_NOTE, generateNutritionMission, persistIntelligenceOutput } from "@/lib/ai/coaching-engine";
import {
  intelligenceEnvelope,
  invalidIntelligenceQueryResponse,
  NOT_REQUESTED_PERSISTENCE,
  parseIntelligenceQuery,
  resolvePersistUserId,
} from "@/lib/ai/route-helpers";

export async function GET(request: Request) {
  const parsed = parseIntelligenceQuery(request);

  if (!parsed.success) {
    return invalidIntelligenceQueryResponse(parsed.error);
  }

  const output = generateNutritionMission(parsed.data);
  const persistUserId = await resolvePersistUserId(request, parsed.data);
  const persistence = persistUserId
    ? await persistIntelligenceOutput(persistUserId, "nutrition-mission", output)
    : NOT_REQUESTED_PERSISTENCE;

  return NextResponse.json(intelligenceEnvelope(output, persistence, AI_SERVICE_SAFETY_NOTE));
}
