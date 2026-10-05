import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { BURDENS, PROFILE_BURDENS, burdensForCompound } from "../burdens";
import { RISK_PROFILES, buildCompoundRiskBrief, profilesForCompound } from "../risk-profiles";
import { supportAreasForBrief, supportForArea } from "../support-options";

/**
 * A member who logs Masteron should not be told the same thing as a member who
 * logs testosterone. Class profiles cover what every anabolic steroid shares;
 * these cover what one compound does that the class does not.
 */

const named = (name: string) => buildCompoundRiskBrief([{ name }]);
const areasOf = (name: string) => supportAreasForBrief(named(name)).map((entry) => entry.area);

describe("compound-specific profiles", () => {
  it("gives Masteron its own profile on top of the class profile", () => {
    const keys = profilesForCompound({ name: "Masteron" }).map((p) => p.key);
    expect(keys).toEqual(["dht-derived-steroids", "anabolic-steroids"]);
    /* The nickname, the official name and the ester all land in the same place. */
    for (const alias of ["Mast", "Drostanolone", "Masteron Enanthate", "Drostanolone Propionate"]) {
      expect(profilesForCompound({ name: alias }).map((p) => p.key), alias).toContain("dht-derived-steroids");
    }
  });

  it("surfaces areas the class profile alone would not", () => {
    /* Two different steroids no longer read as the same compound. */
    expect([...areasOf("Masteron")].sort()).not.toEqual([...areasOf("Trenbolone")].sort());
    expect(areasOf("Masteron")).toContain("prostate");
    expect(areasOf("Trenbolone")).not.toContain("prostate");
    expect(areasOf("Equipoise")).toContain("blood");
    expect(areasOf("Primobolan")).toContain("prostate");
  });

  it("opens support areas that now hold options", () => {
    const withOptions = areasOf("Masteron").filter((area) => supportForArea(area).options.length > 0);
    expect(withOptions).toContain("prostate");
    expect(withOptions).toContain("skin");
    expect(supportForArea("prostate").options.map((o) => o.option.title)).toContain("Saw palmetto");
  });

  it("names every compound it covers in the catalog, and says nothing banned", () => {
    const added = ["dht-derived-steroids", "boldenone", "methenolone", "trestolone"];
    for (const key of added) {
      const profile = RISK_PROFILES.find((p) => p.key === key);
      expect(profile, key).toBeTruthy();
      expect(profile!.sources.length, key).toBeGreaterThan(0);
      expect(profile!.review.status, key).toBe("pending-clinician-review");
      expect(bannedLanguageIn(profile!.summary), key).toEqual([]);
      for (const system of profile!.systems) expect(bannedLanguageIn(system.note), `${key}/${system.system}`).toEqual([]);
    }
  });
});

describe("body-system burdens for a specific compound", () => {
  const systemsOf = (name: string) => new Set(burdensForCompound({ name }).map(({ burden }) => BURDENS[burden].system));

  it("gives Masteron prostate and skin rows that Trenbolone does not have", () => {
    const masteron = systemsOf("Masteron");
    expect(masteron.has("prostate")).toBe(true);
    expect(masteron.has("skin")).toBe(true);
    expect(systemsOf("Trenbolone").has("prostate")).toBe(false);
  });

  it("files acne and hair loss under skin, where the check-in records them", () => {
    expect(BURDENS.androgenic.system).toBe("skin");
    expect(BURDENS.androgenic.signals).toContain("check-in");
    expect(BURDENS.prostate.markers).toEqual(["psa"]);
  });

  it("links every compound-specific profile to at least one burden", () => {
    for (const key of ["dht-derived-steroids", "boldenone", "methenolone", "trestolone"]) {
      expect(PROFILE_BURDENS[key]?.length, key).toBeGreaterThan(0);
    }
  });
});
