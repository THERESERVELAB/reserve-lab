import { describe, expect, it } from "vitest";

import { allergyTags, ingredientsHitAllergy, matchFood, matchFoods } from "../food-matcher";

describe("matchFood — the member's words as a known food", () => {
  it("reads the owner's own entries, typos and all", () => {
    expect(matchFood("gress fed ribeye")).toEqual({ id: "ribeye", role: "protein", qualifiers: ["grass-fed"] });
    expect(matchFood("ground beef (grass-fed)")).toEqual({ id: "ground-beef", role: "protein", qualifiers: ["grass-fed"] });
    expect(matchFood("thilapia")?.id).toBe("tilapia");
    expect(matchFood("tuna")?.id).toBe("tuna");
    expect(matchFood("chicken breast")?.id).toBe("chicken-breast");
    expect(matchFood("NY steak (grass-fed)")).toEqual({ id: "strip", role: "protein", qualifiers: ["grass-fed"] });
    expect(matchFood("pasture-raised eggs")).toEqual({ id: "eggs", role: "protein", qualifiers: ["pasture-raised"] });
    expect(matchFood("lean ground chicken")?.id).toBe("ground-chicken");
    expect(matchFood("jasmine rice")?.id).toBe("jasmine-rice");
    expect(matchFood("gold russet potatoes")?.id).toBe("gold-potato");
  });

  it("prefers the longest name that fits, so a cut beats the bare animal", () => {
    expect(matchFood("chicken thighs")?.id).toBe("chicken-thigh");
    expect(matchFood("chicken")?.id).toBe("chicken-breast");
    expect(matchFood("sweet potatos")?.id).toBe("sweet-potato");
    expect(matchFood("New York strip")?.id).toBe("strip");
  });

  it("narrows by role, and says nothing for words that are not a food", () => {
    expect(matchFood("rice", "protein")).toBeNull();
    expect(matchFood("rice", "carb")?.id).toBe("jasmine-rice");
    expect(matchFood("")).toBeNull();
    expect(matchFood("grass fed")).toBeNull();
    expect(matchFood("motivation")).toBeNull();
  });

  it("keeps the member's order and merges repeats", () => {
    expect(matchFoods(["tilapia", "thilapia", "ribeye", "grass fed ribeye"], "protein")).toEqual([
      { id: "tilapia", role: "protein", qualifiers: [] },
      { id: "ribeye", role: "protein", qualifiers: ["grass-fed"] },
    ]);
  });
});

describe("allergies — by what a food is", () => {
  it('reads "shell fish" as shellfish, never as all fish', () => {
    expect(allergyTags("shell fish")).toEqual(["shellfish"]);
    expect(allergyTags("Shellfish")).toEqual(["shellfish"]);
    expect(allergyTags("fish")).toEqual(["fish"]);
    expect(allergyTags("shrimp and fish")).toEqual(expect.arrayContaining(["shellfish", "fish"]));
    expect(allergyTags("lactose")).toEqual(["dairy"]);
    expect(allergyTags("celiac")).toEqual(["gluten", "oats"]);
    expect(allergyTags("tree nuts")).toEqual(["nuts"]);
  });

  it("catches shrimp and scallops for a shellfish allergy, which a plain word match missed", () => {
    expect(ingredientsHitAllergy(["170g shrimp & scallops", "jasmine rice"], ["shell fish"])).toBe(true);
    expect(ingredientsHitAllergy(["jumbo shrimp"], ["shell fish"])).toBe(true);
    expect(ingredientsHitAllergy(["190g tilapia", "roasted sweet potato"], ["shell fish"])).toBe(false);
    expect(ingredientsHitAllergy(["2% Greek yogurt"], ["dairy"])).toBe(true);
    expect(ingredientsHitAllergy(["almond butter", "banana"], ["dairy"])).toBe(false);
    expect(ingredientsHitAllergy(["wild salmon fillet"], ["salmon"])).toBe(true);
  });
});
