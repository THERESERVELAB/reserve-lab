import { NextResponse } from "next/server";

import { intelligenceQuerySchema, type IntelligenceQuery } from "@/lib/schemas/ai";
import { valueEngineQuerySchema } from "@/lib/schemas/value-engine";
import { resolveRequestUserId } from "@/lib/supabase/route-auth";

export const PREMIUM_FALLBACK_MODE = "premium_fallback" as const;

export type IntelligencePersistenceState =
  | { persisted: true; mode: "supabase" }
  | { persisted: false; mode: "local_fallback"; reason: "anonymous" | "not_configured" | "write_failed" | "not_requested" };

export const NOT_REQUESTED_PERSISTENCE: IntelligencePersistenceState = {
  persisted: false,
  mode: "local_fallback",
  reason: "not_requested",
};

export function parseIntelligenceQuery(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return intelligenceQuerySchema.safeParse(params);
}

export function parseValueEngineQuery(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return valueEngineQuerySchema.safeParse(params);
}

export function invalidIntelligenceQueryResponse(error: { flatten: () => unknown }) {
  return NextResponse.json({ error: "Invalid intelligence query", issues: error.flatten() }, { status: 400 });
}

export function intelligenceEnvelope<TOutput>(
  output: TOutput,
  persistence: IntelligencePersistenceState,
  safetyNote: string,
) {
  return {
    output,
    mode: PREMIUM_FALLBACK_MODE,
    persistence,
    safetyNote,
  };
}

export function shouldPersist(input: IntelligenceQuery) {
  return input.persist === true;
}

/**
 * The ONLY id a route may persist under: the verified session user derived
 * from the caller's bearer token — never the request's own `userId`. Returns
 * null when persistence must be skipped (not requested, or no authenticated
 * caller). This keeps anonymous/local requests as compute-only while making
 * cross-user writes impossible.
 */
export async function resolvePersistUserId(
  request: Request,
  input: { persist?: boolean },
): Promise<string | null> {
  if (input.persist !== true) return null;
  return resolveRequestUserId(request);
}
