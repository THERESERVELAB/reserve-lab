import { describe, expect, it } from "vitest";

import { findCatalogEntry } from "@/lib/enhancement/catalog";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { profilesForCompound } from "../risk-profiles";
import { SUPPORT_OPTIONS, supportForArea, supportOptionByKey } from "../support-options";

/* ════════════════════════════════════════════════════════════════════════
   THE PERFORMANCE SHELF — the training staples members actually use, listed
   with what the research shows and what each one does not do. Reserve never
   says anyone should take any of them.
   ════════════════════════════════════════════════════════════════════════ */

const ADDED = ["ashwagandha", "beta-alanine", "caffeine", "hmb", "l-theanine", "sodium-bicarbonate", "tart-cherry"] as const;

describe("performance options", () => {
  it("are in the library, addable from the member's own catalog, and pending review", () => {
    for (const key of ADDED) {
      const option = supportOptionByKey(key);
      expect(option, key).toBeTruthy();
      expect(findCatalogEntry(option!.catalogName)?.officialName, key).toBe(option!.catalogName);
      expect(option!.review.status, key).toBe("pending-clinician-review");
      expect(option!.sources.length, key).toBeGreaterThan(0);
      expect(option!.doesNotAddress.length, key).toBeGreaterThan(0);
      /* Every one of them is a supplement, never a prescription medicine. */
      for (const profile of profilesForCompound({ name: option!.catalogName })) expect(profile.regulatory, key).toBe("supplement");
    }
  });

  it("say what each one is actually studied for", () => {
    expect(supportOptionByKey("caffeine")!.findings.map((f) => f.area)).toEqual(["recovery"]);
    expect(supportOptionByKey("beta-alanine")!.findings[0].grade).toBe("some");
    expect(supportOptionByKey("ashwagandha")!.findings.map((f) => f.area)).toEqual(["sleep"]);
    expect(supportOptionByKey("l-theanine")!.findings[0].grade).toBe("limited");
    expect(supportOptionByKey("sodium-bicarbonate")!.findings.map((f) => f.area)).toEqual(["recovery"]);
    expect(supportOptionByKey("hmb")!.findings[0].grade).toBe("limited");
    expect(supportOptionByKey("tart-cherry")!.findings.map((f) => f.area)).toEqual(["recovery", "sleep"]);
  });

  it("carry the cautions that matter, where a member will read them", () => {
    /* Caffeine's heart and sleep effects are not reasons to add it, so they are
       stated as limits rather than as evidence for it. */
    const caffeine = supportOptionByKey("caffeine")!;
    expect(caffeine.doesNotAddress).toMatch(/blood pressure/i);
    expect(caffeine.doesNotAddress).toMatch(/sleep/i);
    expect(supportOptionByKey("ashwagandha")!.doesNotAddress).toMatch(/liver injury/i);
    expect(supportOptionByKey("ashwagandha")!.doesNotAddress).toMatch(/testosterone/i);
    /* The sodium load and the stomach upset are the two things people get caught by. */
    expect(supportOptionByKey("sodium-bicarbonate")!.doesNotAddress).toMatch(/sodium/i);
    expect(supportOptionByKey("sodium-bicarbonate")!.doesNotAddress).toMatch(/stomach|diarrhoea/i);
    /* Cherries carry melatonin, so it stacks with a melatonin supplement. */
    expect(supportOptionByKey("tart-cherry")!.findings.find((f) => f.area === "sleep")!.finding).toMatch(/melatonin/i);
  });

  it("never turn up as an answer for an area where nothing has evidence", () => {
    for (const area of ["hormonal", "fertility", "blood"] as const) {
      expect(supportForArea(area).options.map((o) => o.option.key)).toEqual([]);
    }
  });

  it("read as information, never as instruction", () => {
    for (const key of ADDED) {
      const option = supportOptionByKey(key)!;
      const copy = [option.title, option.doesNotAddress, option.whereYouSeeIt ?? "", ...option.findings.map((f) => f.finding)].join(" ");
      expect(bannedLanguageIn(copy), key).toEqual([]);
      expect(copy, key).not.toMatch(/\bbest\b|\bshould take\b|\brecommend/i);
    }
  });

  it("leave the shelf alphabetical, so nothing reads as a ranking", () => {
    const titles = SUPPORT_OPTIONS.map((o) => o.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });
});
