import { describe, expect, it } from "vitest";

import { getMovementVisual, selectMediaVariant } from "../movement-visuals";

/**
 * A woman's demo can reach the dashboard.
 *
 * The media model carried `maleReady` / `malePosterExt` but nothing for the
 * other half of the membership: the female variant was built with `ready`
 * hard-coded to false and no poster path, so a female still could never be
 * marked shipped however good it was. A woman opening a glute movement fell
 * back to the male demo, or to the pending state, every time.
 *
 * These tests hold the two halves symmetrical.
 */

describe("movement visuals — female posters", () => {
  it("gives every movement a female variant, so there is always something to fill", () => {
    const visual = getMovementVisual({ name: "Romanian Deadlift" });
    const female = visual.variants.find((v) => v.gender === "female");
    expect(female, "a female variant exists").toBeDefined();
    expect(female?.image?.desktop).toContain("/female/");
  });

  it("points a female variant at its own gender's folder, never the male one", () => {
    const visual = getMovementVisual({ name: "Hip Thrust" });
    const female = visual.variants.find((v) => v.gender === "female");
    const male = visual.variants.find((v) => v.gender === "male");
    expect(female?.image?.desktop).not.toEqual(male?.image?.desktop);
    expect(female?.image?.desktop).toContain("/movements/hip-thrust/female");
  });

  it("serves a woman the female variant when it is ready, without falling back", () => {
    const visual = getMovementVisual({ name: "Romanian Deadlift" });
    const ready = {
      ...visual,
      variants: visual.variants.map((v) => (v.gender === "female" ? { ...v, ready: true } : v)),
    };
    const picked = selectMediaVariant(ready, "female");
    expect(picked.resolvedGender).toBe("female");
    expect(picked.fellBack, "a ready female poster is not a fallback").toBe(false);
  });

  it("describes the athlete in the alt text as female, so the demo is announced honestly", () => {
    const visual = getMovementVisual({ name: "Romanian Deadlift" });
    const female = visual.variants.find((v) => v.gender === "female");
    expect(female?.image?.alt).toContain("female athlete");
  });
});
