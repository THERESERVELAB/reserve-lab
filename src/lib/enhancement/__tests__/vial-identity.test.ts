import { describe, expect, it } from "vitest";

import {
  categoryDrawsVial,
  vialIdentity,
  vialMeniscusOpacity,
  vialTintHex,
  vialTintOpacity,
} from "../vial-identity";

/**
 * A vial's colour is a claim about what the member will see in their hand, so
 * it has to be right for the compounds that actually have a colour, and honest
 * (clear) for everything else.
 */

describe("vial identity — tint", () => {
  it("gives GHK-Cu the blue it actually is", () => {
    const id = vialIdentity({ name: "GHK-Cu", compoundClass: "peptides_healing", route: "injectable" });
    expect(id.tint).toBe("steel");
    expect(id.appearance).toContain("blue");
  });

  it("recognises the copper peptide however the member wrote it", () => {
    for (const name of ["GHK-Cu", "ghk cu", "GHK Cu", "Copper Peptide"]) {
      expect(vialIdentity({ name }).tint, name).toBe("steel");
    }
  });

  it("carries oil-based compounds as pale gold, not clear", () => {
    const test = vialIdentity({ name: "Testosterone Cypionate", compoundClass: "hormones_testosterone" });
    expect(test.tint).toBe("amber");
    expect(test.appearance).toContain("oil");
  });

  it("gives trenbolone the darker carrier it is known for", () => {
    expect(vialIdentity({ name: "Trenbolone Acetate", compoundClass: "aas" }).tint).toBe("gold");
  });

  it("leaves a water-clear peptide clear rather than inventing a colour", () => {
    expect(vialIdentity({ name: "BPC-157", compoundClass: "peptides_healing" }).tint).toBe("clear");
  });

  /* A member logging GLOW or KLOW never types "GHK-Cu", but the copper is in
     the vial and the vial is blue, so the blend name has to carry it. */
  it("carries the copper through the blends that contain it", () => {
    expect(vialIdentity({ name: "GLOW" }).tint).toBe("steel");
    expect(vialIdentity({ name: "KLOW" }).tint).toBe("steel");
    expect(vialIdentity({ name: "Klow Blend" }).tint).toBe("steel");
  });

  it("leaves a blend with no copper in it clear", () => {
    expect(vialIdentity({ name: "BPC-157 / TB-500", compoundClass: "peptides_healing" }).tint).toBe("clear");
  });

  it("treats a compound it has never seen as clear, so unknown never bluffs", () => {
    expect(vialIdentity({ name: "Something Custom The Member Typed" }).tint).toBe("clear");
  });
});

describe("vial identity — form", () => {
  it("draws an injectable as a vial", () => {
    expect(vialIdentity({ name: "Semaglutide", route: "injectable" }).form).toBe("vial");
  });

  it("draws an oral as a capsule, because a tablet is not a vial", () => {
    expect(vialIdentity({ name: "Oxandrolone", route: "oral" }).form).toBe("capsule");
  });

  it("draws a topical or nasal as a pump", () => {
    expect(vialIdentity({ name: "Testosterone Gel", route: "topical" }).form).toBe("pump");
    expect(vialIdentity({ name: "Some Spray", route: "nasal" }).form).toBe("pump");
  });

  it("prefers the member's chosen route over the catalog's list", () => {
    /* BPC-157 is catalogued injectable AND oral. If the member says they take
       it orally, the picture has to agree with them. */
    const id = vialIdentity({ name: "BPC-157", routes: ["injectable", "oral"], route: "oral" });
    expect(id.form).toBe("capsule");
  });

  it("falls back to the catalog's first usable route when the member has not chosen", () => {
    expect(vialIdentity({ name: "BPC-157", routes: ["injectable", "oral"] }).form).toBe("vial");
  });
});

describe("vial identity — palette", () => {
  it("only ever returns colours from the closed Reserve palette", () => {
    const allowed = new Set(["#5fb7d5", "#e8c87a", "#d5b15f", "#ece8df"]);
    for (const tint of ["clear", "steel", "amber", "gold"] as const) {
      expect(allowed.has(vialTintHex(tint)), tint).toBe(true);
    }
  });

  it("keeps a clear solution faint so it reads as glass, not as liquid", () => {
    expect(vialTintOpacity("clear")).toBeLessThan(vialTintOpacity("steel"));
  });

  /* A clear column is announced by its surface, not its body. Rendered at a
     body opacity anywhere near a tinted one it stops looking like fluid and
     starts looking like grey paint, which would be the majority of a member's
     shelf, since most peptides reconstitute clear. */
  it("carries a clear solution on its meniscus rather than its body", () => {
    expect(vialMeniscusOpacity("clear")).toBeGreaterThan(vialTintOpacity("clear") * 4);
  });

  it("keeps every meniscus brighter than the liquid under it", () => {
    for (const tint of ["clear", "steel", "amber", "gold"] as const) {
      expect(vialMeniscusOpacity(tint), tint).toBeGreaterThan(vialTintOpacity(tint));
    }
  });
});

describe("vial identity — the vial is for compounds, not add-ons", () => {
  it("draws the vial for peptides and compounds", () => {
    for (const cat of ["peptide", "hormone", "medication", "recovery", "other"]) {
      expect(categoryDrawsVial(cat), cat).toBe(true);
    }
  });

  it("does not draw the vial for add-ons like vitamins and supplements", () => {
    for (const cat of ["supplement", "vitamin", "nootropic"]) {
      expect(categoryDrawsVial(cat), cat).toBe(false);
    }
  });

  it("keeps the vial for an unknown / legacy category rather than dropping it silently", () => {
    expect(categoryDrawsVial(null)).toBe(true);
    expect(categoryDrawsVial(undefined)).toBe(true);
  });
});
