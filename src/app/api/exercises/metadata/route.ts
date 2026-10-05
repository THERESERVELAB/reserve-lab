/**
 * GET /api/exercises/metadata
 *
 * Returns exercise education metadata: form tips, muscle targets,
 * machine setup notes, substitutions, safety notes, common errors.
 *
 * Query params:
 *   ?name=<exercise-name>         — exact or alias match
 *   ?bodyGroup=<group>            — all exercises for a body group
 *   ?q=<query>                   — fuzzy search across name/muscle/group
 *   ?shorthand=<RIR|MEV|...>     — resolve a terminology shorthand
 *   (no params)                  — returns full library
 *
 * Always returns 200 — 404-style cases return { ok: true, found: false }.
 * Client can always render a fallback without crashing.
 */

import { NextResponse } from "next/server";

import {
  EXERCISE_METADATA,
  getExerciseMetadata,
  getExercisesByBodyGroup,
  searchExerciseMetadata,
} from "@/lib/logging/exercise-metadata";

import {
  getTerm,
  getTermsByCategory,
  searchTerms,
  TERMINOLOGY,
} from "@/lib/logging/terminology";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const name = url.searchParams.get("name");
  const bodyGroup = url.searchParams.get("bodyGroup");
  const query = url.searchParams.get("q");
  const shorthand = url.searchParams.get("shorthand");
  const termCategory = url.searchParams.get("termCategory");
  const termQuery = url.searchParams.get("termQ");

  /* ── Terminology lookup ── */
  if (shorthand) {
    const entry = getTerm(shorthand);
    if (!entry) {
      return NextResponse.json({ ok: true, found: false, shorthand });
    }
    return NextResponse.json({ ok: true, found: true, term: entry });
  }

  if (termCategory) {
    const valid = ["training", "nutrition", "recovery", "physique", "science"] as const;
    type ValidCategory = typeof valid[number];
    const cat = valid.includes(termCategory as ValidCategory) ? (termCategory as ValidCategory) : null;
    if (!cat) {
      return NextResponse.json({ error: "Invalid termCategory.", valid }, { status: 400 });
    }
    return NextResponse.json({ ok: true, terms: getTermsByCategory(cat) });
  }

  if (termQuery) {
    return NextResponse.json({ ok: true, terms: searchTerms(termQuery) });
  }

  // Return full glossary if ?glossary=1
  if (url.searchParams.get("glossary")) {
    return NextResponse.json({ ok: true, terms: TERMINOLOGY });
  }

  /* ── Exercise metadata lookup ── */
  if (name) {
    const meta = getExerciseMetadata(name);
    if (!meta) {
      return NextResponse.json({ ok: true, found: false, name });
    }
    return NextResponse.json({ ok: true, found: true, exercise: meta });
  }

  if (bodyGroup) {
    const exercises = getExercisesByBodyGroup(bodyGroup);
    return NextResponse.json({ ok: true, bodyGroup, exercises, count: exercises.length });
  }

  if (query) {
    const results = searchExerciseMetadata(query);
    return NextResponse.json({ ok: true, query, exercises: results, count: results.length });
  }

  // No params: return full library
  return NextResponse.json({
    ok: true,
    exercises: EXERCISE_METADATA,
    count: EXERCISE_METADATA.length,
    terms: TERMINOLOGY,
    termCount: TERMINOLOGY.length,
  });
}
