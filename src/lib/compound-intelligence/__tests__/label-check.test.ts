import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { checkLabel, splitIngredients, type LabelCheck } from "../label-check";

/**
 * A member photographs the label of a "morning gut detox and performance"
 * drink they already use. Reserve reads what is in it — never whether to use it.
 */

const DETOX_DRINK = `Supplement Facts
Serving Size 1 Scoop (12 g)
Amount Per Serving   %DV
Biotin 5000 mcg 16667%
Zinc (as zinc citrate) 15 mg 136%
Proprietary Gut Detox Blend 3 g
Dandelion Root, Ginger Root, Turmeric Root Extract (95% curcuminoids), Black Pepper Extract, Green Tea Extract (50% EGCG)
Performance Matrix 1.2 g
Caffeine Anhydrous, L-Citrulline, Taurine
Other ingredients: Natural flavors, citric acid, stevia leaf extract`;

function allText(check: LabelCheck): string[] {
  const findings = [...check.flagged, ...check.hazards, ...check.labNotes, check.proprietaryBlend, check.claim, check.noCertification, check.standing].filter(Boolean);
  return findings.flatMap((f) => [f!.label, ...f!.notes]);
}

/** Copy the label check writes itself, as opposed to the cited risk-profile notes it quotes. */
const OWN_KEYS = new Set(["dmaa", "dmha", "phenibut", "tianeptine", "sarms", "kratom", "yohimbe", "bitter-orange", "caffeine", "biotin-labs", "proprietary-blend", "detox-claim", "no-certification", "not-pre-approved"]);

function ownText(check: LabelCheck): string[] {
  const findings = [...check.flagged, ...check.hazards, ...check.labNotes, check.proprietaryBlend, check.claim, check.noCertification, check.standing].filter(Boolean);
  return findings.filter((f) => OWN_KEYS.has(f!.key)).flatMap((f) => [f!.label, ...f!.notes]);
}

describe("label check", () => {
  const check = checkLabel({ productName: "Morning Gut Detox + Performance", labelText: DETOX_DRINK, planNutrients: { zinc: ["Multivitamin"] } });

  it("reads the ingredients without the amounts or label furniture", () => {
    expect(check.ingredients).toContain("Dandelion Root");
    expect(check.ingredients).toContain("Caffeine Anhydrous");
    expect(check.ingredients.join(" ")).not.toMatch(/\d|Supplement Facts|Serving Size|%DV/);
    expect(splitIngredients("Magnesium 200 mg, Zinc 15 mg")).toEqual(["Magnesium", "Zinc"]);
  });

  it("names the hazards that sit inside a blend", () => {
    const labels = check.hazards.map((h) => h.label);
    expect(labels).toContain("Turmeric or curcumin");
    expect(labels).toContain("Green tea extract");
    expect(labels).toContain("Caffeine");
    for (const hazard of check.hazards) expect(hazard.sources.length, hazard.label).toBeGreaterThan(0);
  });

  it("says biotin changes lab results, and zinc adds up with the plan", () => {
    expect(check.labNotes.map((n) => n.label)).toContain("Biotin");
    expect(check.nutrients.find((n) => n.nutrient === "zinc")?.alsoIn).toEqual(["Multivitamin"]);
  });

  it("grades the ingredients that are in the library", () => {
    const titles = check.library.map((m) => m.title);
    expect(titles).toEqual(expect.arrayContaining(["L-citrulline", "Taurine", "Zinc"]));
    expect(check.library.find((m) => m.title === "Taurine")?.gradeLabel).toBe("Supported");
  });

  it("flags the blend, the detox claim and the missing testing mark", () => {
    expect(check.proprietaryBlend).not.toBeNull();
    expect(check.claim?.notes[0]).toMatch(/no compelling research/);
    expect(check.noCertification).not.toBeNull();
    expect(check.certifications).toEqual([]);
  });

  it("lists what it has no review for instead of dropping it", () => {
    expect(check.unreviewed).toEqual(expect.arrayContaining(["Dandelion Root", "Ginger Root"]));
    expect(check.unreviewed).not.toContain("Taurine");
  });

  it("puts FDA-flagged substances first, under any name they are sold as", () => {
    const pre = checkLabel({ productName: "Pre-workout", labelText: "Energy Blend: Caffeine, Geranium Extract, Yohimbine HCl, Rad-140" });
    expect(pre.flagged.map((f) => f.label)).toEqual(expect.arrayContaining(["DMAA", "A SARM"]));
    expect(pre.hazards.map((f) => f.label)).toEqual(expect.arrayContaining(["Yohimbe or yohimbine", "Caffeine"]));
  });

  it("recognizes an independent testing mark", () => {
    const tested = checkLabel({ productName: "Creatine", labelText: "Creatine Monohydrate. NSF Certified for Sport." });
    expect(tested.certifications.map((c) => c.label)).toEqual(["NSF Certified for Sport"]);
    expect(tested.noCertification).toBeNull();
    expect(tested.labNotes.map((n) => n.label)).toContain("Creatine");
  });

  it("never judges the product, and says nothing the compliance rules forbid", () => {
    for (const label of [check, checkLabel({ productName: "x", labelText: "DMAA, Kratom, Tianeptine, Phenibut, DMHA, Bitter orange, Ashwagandha, Garcinia, Red yeast rice, Niacin, Licorice, DHEA, NAC, Potassium, Garlic" })]) {
      for (const text of allText(label)) {
        expect(bannedLanguageIn(text), text).toEqual([]);
      }
      /* Its own copy never judges; the cited profile notes it quotes are checked by the profile suites. */
      for (const text of ownText(label)) {
        expect(text, text).not.toMatch(/\b(?:safe|unsafe|approved by reserve|best|worst|avoid|should|buy|switch to)\b/i);
      }
    }
  });
});

describe("hazards hiding in sleep and blood-sugar blends", () => {
  it("names kava, cassia cinnamon and high-intake vitamin C with their sources", () => {
    const check = checkLabel({ productName: "Night Calm Blend", labelText: "Kava Root Extract (30% kavalactones), Cassia Cinnamon Bark, Vitamin C (as ascorbic acid)" });
    const byLabel = new Map(check.hazards.map((h) => [h.label, h]));
    expect(byLabel.get("Kava")?.notes.join(" ")).toMatch(/liver transplant/);
    expect(byLabel.get("Cinnamon")?.notes.join(" ")).toMatch(/coumarin/);
    expect(byLabel.get("Vitamin C")?.notes.join(" ")).toMatch(/oxalate/);
    for (const hazard of check.hazards) {
      expect(hazard.sources.length, hazard.label).toBeGreaterThan(0);
      for (const note of hazard.notes) expect(bannedLanguageIn(note), note).toEqual([]);
    }
  });
});
