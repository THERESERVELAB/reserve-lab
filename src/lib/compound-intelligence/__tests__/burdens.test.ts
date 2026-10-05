import { describe, expect, it } from "vitest";

import { isMarkerKey } from "@/lib/labs/markers";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { BURDENS, PROFILE_BURDENS, burdensForCompound, findBurdenOverlaps } from "../burdens";
import { EVIDENCE_GRADE_DETAIL, EVIDENCE_GRADE_LABEL } from "../evidence";
import { RISK_PROFILES } from "../risk-profiles";

describe("burden map integrity", () => {
  it("maps only real, non-supplement risk profiles", () => {
    const profiles = new Map(RISK_PROFILES.map((p) => [p.key, p]));
    for (const key of Object.keys(PROFILE_BURDENS)) {
      expect(profiles.get(key), key).toBeTruthy();
      expect(profiles.get(key)?.regulatory, key).not.toBe("supplement");
    }
  });

  it("uses real markers and compliant copy", () => {
    for (const def of Object.values(BURDENS)) {
      for (const marker of def.markers) expect(isMarkerKey(marker), `${def.key}: ${marker}`).toBe(true);
      expect(bannedLanguageIn(`${def.label} ${def.phrase}`), def.key).toEqual([]);
    }
    for (const text of [...Object.values(EVIDENCE_GRADE_LABEL), ...Object.values(EVIDENCE_GRADE_DETAIL)]) {
      expect(bannedLanguageIn(text), text).toEqual([]);
    }
  });
});

describe("burdensForCompound", () => {
  it("merges class and compound profiles, keeping the strongest evidence", () => {
    const oxandrolone = burdensForCompound({ name: "Oxandrolone" });
    const liver = oxandrolone.find((b) => b.burden === "liver");
    expect(liver?.grade).toBe("well-studied");
    expect(liver?.profileKeys).toEqual(["oral-17aa-steroids", "anabolic-steroids"]);
  });

  it("ignores supplements", () => {
    expect(burdensForCompound({ name: "Fish Oil" })).toEqual([]);
  });
});

describe("findBurdenOverlaps", () => {
  const overlaps = findBurdenOverlaps([
    { id: "t", name: "Testosterone Cypionate" },
    { id: "o", name: "Oxandrolone" },
    { id: "n", name: "Nandrolone Decanoate" },
    { id: "f", name: "Fish Oil" },
  ]);

  it("finds loads shared by two or more compounds, most-shared first", () => {
    const hpta = overlaps.find((o) => o.burden === "hpta-suppression");
    expect(hpta?.compounds.map((c) => c.name)).toEqual(["Testosterone Cypionate", "Oxandrolone", "Nandrolone Decanoate"]);
    expect(overlaps[0].compounds.length).toBe(3);
    expect(overlaps.some((o) => o.compounds.some((c) => c.name === "Fish Oil"))).toBe(false);
  });

  it("never pairs a compound with itself", () => {
    expect(findBurdenOverlaps([{ id: "o", name: "Oxandrolone" }])).toEqual([]);
  });
});
