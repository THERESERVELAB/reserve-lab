import { NextResponse } from "next/server";

import { AI_SERVICE_SAFETY_NOTE } from "@/lib/ai/coaching-engine";
import { intelligenceEnvelope, invalidIntelligenceQueryResponse, NOT_REQUESTED_PERSISTENCE, parseValueEngineQuery, resolvePersistUserId } from "@/lib/ai/route-helpers";
import { generateProgressionSnapshot, persistProgressionSnapshot } from "@/lib/ai/value-engine";

export async function GET(request: Request) {
  const parsed = parseValueEngineQuery(request);

  if (!parsed.success) {
    return invalidIntelligenceQueryResponse(parsed.error);
  }

  const output = generateProgressionSnapshot(parsed.data);
  const persistUserId = await resolvePersistUserId(request, parsed.data);
  const persistence = persistUserId
    ? await persistProgressionSnapshot(persistUserId, output)
    : NOT_REQUESTED_PERSISTENCE;

  return NextResponse.json(intelligenceEnvelope(output, persistence, AI_SERVICE_SAFETY_NOTE));
}
