import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import type { SessionArchetype } from "../split-blueprints";
import {
  CARDIO_VARIANTS,
  cardioVariantCount,
  getArchetypeOnlyTemplate,
  getTemplateForArchetype,
  type WorkoutTemplate,
} from "../workout-templates";

const CARDIO: SessionArchetype[] = ["zone2", "yoga", "mobility"];

/** Every member-facing string in a template, for the compliance sweep. */
function textOf(t: WorkoutTemplate): string {
  const head = [t.displayName, t.focus, t.sessionIntent, t.weakPointPriority, t.warmUpPrimer, t.recoveryHandoff, t.executionStandard];
  const moves = t.phases.flatMap((p) => p.movements).flatMap((m) => [m.name, m.notes, m.targetMuscle, m.equipment, m.roleLabel, m.purpose]);
  return [...head, ...moves].filter(Boolean).join(" \n ");
}

function movementIds(t: WorkoutTemplate): string[] {
  return t.phases.flatMap((p) => p.movements).map((m) => m.id);
}

describe("cardio variety / rotation", () => {
  it("every cardio identity carries multiple authored routes, each a real session", () => {
    for (const a of CARDIO) {
      const variants = CARDIO_VARIANTS[a]!;
      expect(variants, `${a} has no variants`).toBeDefined();
      expect(variants.length, `${a} should rotate through more than one route`).toBeGreaterThanOrEqual(2);
      expect(cardioVariantCount(a)).toBe(variants.length);
      for (const [i, v] of variants.entries()) {
        const moves = v.phases.flatMap((p) => p.movements);
        expect(moves.length, `${a} variant ${i} has no movements`).toBeGreaterThan(0);
      }
    }
  });

  it("variant A is the unchanged ARCHETYPE_TEMPLATES entry — no snapshot-id regression", () => {
    for (const a of CARDIO) {
      const base = getArchetypeOnlyTemplate(a)!;
      expect(CARDIO_VARIANTS[a]![0]).toBe(base); // same object reference
      // No key, and key 0, both resolve to variant A.
      expect(getTemplateForArchetype(a)).toBe(base);
      expect(getTemplateForArchetype(a, 0)).toBe(base);
      // Its movement ids are the original archetype ids (no variant suffix).
      expect(movementIds(base).every((id) => !/-[bc]$/.test(id))).toBe(true);
    }
  });

  it("rotates deterministically through the routes and wraps around", () => {
    for (const a of CARDIO) {
      const n = cardioVariantCount(a);
      for (let k = 0; k < n; k += 1) {
        expect(getTemplateForArchetype(a, k)).toBe(CARDIO_VARIANTS[a]![k]);
        // Same key always gives the same route (stable per day).
        expect(getTemplateForArchetype(a, k)).toBe(getTemplateForArchetype(a, k));
        // Wraps.
        expect(getTemplateForArchetype(a, k + n)).toBe(getTemplateForArchetype(a, k));
      }
    }
  });

  it("consecutive days get different routes", () => {
    for (const a of CARDIO) {
      if (cardioVariantCount(a) < 2) continue;
      expect(getTemplateForArchetype(a, 0)).not.toBe(getTemplateForArchetype(a, 1));
    }
  });

  it("the routes are genuinely distinct sessions, not the same block relabelled", () => {
    for (const a of CARDIO) {
      const sigs = CARDIO_VARIANTS[a]!.map((v) => movementIds(v).join("|"));
      expect(new Set(sigs).size, `${a} routes are not distinct`).toBe(sigs.length);
    }
  });

  it("every variant's ids are unique within the session", () => {
    for (const a of CARDIO) {
      for (const v of CARDIO_VARIANTS[a]!) {
        const ids = movementIds(v);
        expect(new Set(ids).size, `${a} ${v.id} has duplicate movement ids`).toBe(ids.length);
      }
    }
  });

  it("handles negative, large and non-finite keys without throwing", () => {
    for (const a of CARDIO) {
      const n = cardioVariantCount(a);
      expect(getTemplateForArchetype(a, -1)).toBe(CARDIO_VARIANTS[a]![n - 1]);
      expect(getTemplateForArchetype(a, 10_000)).toBe(CARDIO_VARIANTS[a]![10_000 % n]);
      // Non-finite falls back to variant A, never crashes.
      expect(getTemplateForArchetype(a, Number.NaN)).toBe(getArchetypeOnlyTemplate(a));
    }
  });

  it("a non-cardio archetype ignores the rotate key", () => {
    const base = getTemplateForArchetype("glute-strength");
    expect(getTemplateForArchetype("glute-strength", 2)).toBe(base);
    expect(getTemplateForArchetype("glute-strength", 0)).toBe(base);
  });

  it("every route stays within compliant, placement-only language", () => {
    for (const a of CARDIO) {
      for (const v of CARDIO_VARIANTS[a]!) {
        const hits = bannedLanguageIn(textOf(v));
        expect(hits, `${a} ${v.id}: ${hits.join(", ")}`).toEqual([]);
      }
    }
  });
});
