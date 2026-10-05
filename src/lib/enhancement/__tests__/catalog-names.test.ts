import { describe, expect, it } from "vitest";

import { COMPOUND_CATALOG, findCatalogEntry } from "@/lib/enhancement/catalog";
import { profilesForCompound } from "@/lib/compound-intelligence/risk-profiles";

/**
 * A member types the name they use, not the chemical name. If Reserve does not
 * recognise it, no risk profile attaches and every safety surface goes quiet
 * for that compound — so the names people actually use have to resolve.
 */

const profileKeys = (name: string) => profilesForCompound({ name }).map((p) => p.key);

describe("the names people actually type", () => {
  it.each([
    ["Masteron", "Drostanolone"],
    ["Mast", "Drostanolone"],
    ["Tren", "Trenbolone"],
    ["Test", "Testosterone"],
    ["Sustanon", "Sustanon 250"],
    ["Sust 250", "Sustanon 250"],
    ["Deca", "Nandrolone Decanoate"],
    ["Deca Durabolin", "Nandrolone Decanoate"],
    ["Primo", "Methenolone"],
    ["Var", "Oxandrolone"],
    ["Dbol", "Methandienone"],
    ["Anadrol", "Oxymetholone"],
    ["Winny", "Stanozolol"],
    ["EQ", "Boldenone Undecylenate"],
    ["Turinabol", "Chlorodehydromethyltestosterone"],
    ["Tbol", "Chlorodehydromethyltestosterone"],
    ["Superdrol", "Methasterone"],
    ["Halo", "Fluoxymesterone"],
    ["Proviron", "Mesterolone"],
    ["MENT", "Trestolone Acetate"],
    ["DHB", "Dihydroboldenone"],
    ["MK-677", "Ibutamoren"],
    ["Ostarine", "Enobosarm"],
  ])("resolves %s to %s", (typed, official) => {
    expect(findCatalogEntry(typed)?.officialName).toBe(official);
  });

  it("ignores case, spacing and punctuation", () => {
    for (const typed of ["masteron", "  Tren-A  ", "tren a", "MK 677", "t-bol", "test cyp", "TESTC"]) {
      expect(findCatalogEntry(typed), typed).not.toBeNull();
    }
  });

  it("returns nothing rather than guessing at an unknown name", () => {
    for (const typed of ["", "   ", "mystery blend", "xyz-9000"]) {
      expect(findCatalogEntry(typed), typed).toBeNull();
    }
  });
});

describe("a recognised name carries its risk profile", () => {
  it("gives every anabolic steroid the steroid profile", () => {
    for (const typed of ["Masteron", "Tren", "Turinabol", "Superdrol", "Proviron", "MENT", "DHB"]) {
      expect(profileKeys(typed), typed).toContain("anabolic-steroids");
    }
  });

  it("gives the oral 17-alpha-alkylated compounds their liver profile", () => {
    for (const typed of ["Turinabol", "Superdrol", "Halotestin", "Anadrol", "Dbol", "Winstrol", "Anavar"]) {
      expect(profileKeys(typed), typed).toContain("oral-17aa-steroids");
    }
  });

  it("does not put a non-17-alpha-alkylated compound in the liver profile", () => {
    expect(profileKeys("Proviron")).not.toContain("oral-17aa-steroids");
    expect(profileKeys("Masteron")).not.toContain("oral-17aa-steroids");
  });

  it("carries the compound profile through a generic name", () => {
    expect(profileKeys("Tren")).toContain("trenbolone");
    expect(profileKeys("Nandrolone")).toContain("nandrolone");
    expect(profileKeys("Sustanon")).toContain("testosterone");
  });
});

describe("catalog integrity", () => {
  it("never lets two compounds collapse to the same typed name", () => {
    const squash = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const entry of COMPOUND_CATALOG) {
      for (const name of [entry.officialName, ...entry.aliases]) {
        const key = squash(name);
        const owner = seen.get(key);
        if (owner && owner !== entry.officialName) clashes.push(`${name}: ${owner} vs ${entry.officialName}`);
        else seen.set(key, entry.officialName);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("keeps every catalog compound class known to the risk profiles", () => {
    for (const entry of COMPOUND_CATALOG) {
      expect(profilesForCompound({ name: entry.officialName }).length, entry.officialName).toBeGreaterThan(0);
    }
  });
});
