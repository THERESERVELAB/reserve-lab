import { describe, expect, it } from "vitest";

import {
  compareCoverage,
  describeRegions,
  orderRegions,
  regionsForSplitKey,
  sanitizeRegions,
  suggestedRegionsFor,
  TRAINING_REGIONS,
  type TrainingRegion,
} from "@/lib/training/activity-coverage";

describe("suggestions", () => {
  it("offers nothing for a group class — its content cannot be guessed", () => {
    /* A studio class might be legs, arms or a full-body circuit. Picking one
       would be wrong most of the time, and this is the case the member is
       actually being asked about. */
    expect(suggestedRegionsFor("group-class")).toEqual([]);
  });

  it("offers the obvious regions where they really are obvious", () => {
    expect(suggestedRegionsFor("run")).toContain("calves");
    expect(suggestedRegionsFor("cycling")).toContain("quads");
    expect(suggestedRegionsFor("swim")).toContain("back");
    expect(suggestedRegionsFor("track")).toContain("glutes");
  });

  it("only ever suggests known regions", () => {
    const known = new Set(TRAINING_REGIONS.map((r) => r.key));
    for (const key of ["run", "track", "swim", "cycling", "yoga", "sport", "conditioning", "group-class"] as const) {
      for (const r of suggestedRegionsFor(key)) expect(known.has(r)).toBe(true);
    }
  });
});

describe("planned-day regions", () => {
  it("maps a leg day to the whole lower body", () => {
    expect(regionsForSplitKey("legs")).toEqual(["quads", "hamstrings", "glutes", "calves"]);
  });

  it("keeps push and pull distinct", () => {
    expect(regionsForSplitKey("push")).not.toContain("back");
    expect(regionsForSplitKey("pull")).toContain("back");
  });

  it("returns nothing for a day with no lifting", () => {
    expect(regionsForSplitKey("conditioning-reserve" as never)).toEqual([]);
    expect(regionsForSplitKey(null)).toEqual([]);
  });
});

describe("compareCoverage", () => {
  const LEG_DAY = regionsForSplitKey("legs");

  it("says a class stands in when it reported everything the day wanted", () => {
    const v = compareCoverage(["quads", "hamstrings", "glutes", "calves", "conditioning"], LEG_DAY);
    expect(v.standsIn).toBe(true);
    expect(v.missed).toEqual([]);
  });

  it("reports what went untouched without judging the session", () => {
    const v = compareCoverage(["quads", "conditioning"], LEG_DAY);
    expect(v.standsIn).toBe(false);
    expect(v.covered).toEqual(["quads"]);
    expect(v.missed).toEqual(["hamstrings", "glutes", "calves"]);
  });

  it("does not call an empty plan 'covered' — there is nothing to compare", () => {
    const v = compareCoverage(["quads"], []);
    expect(v.standsIn).toBe(false);
    expect(v.missed).toEqual([]);
  });

  it("ignores extra regions the planned day never wanted", () => {
    const v = compareCoverage([...LEG_DAY, "chest", "arms"], LEG_DAY);
    expect(v.standsIn).toBe(true);
    expect(v.covered).toEqual(LEG_DAY);
  });

  it("returns regions in a stable order however they were reported", () => {
    const shuffled: TrainingRegion[] = ["calves", "quads", "glutes", "hamstrings"];
    expect(compareCoverage(shuffled, LEG_DAY).covered).toEqual(LEG_DAY);
  });
});

describe("describeRegions", () => {
  it("returns null before the member has said anything", () => {
    expect(describeRegions([])).toBeNull();
  });
  it("reads as a sentence, not a list of keys", () => {
    expect(describeRegions(["quads"])).toBe("Quads");
    expect(describeRegions(["quads", "calves"])).toBe("Quads and calves");
    expect(describeRegions(["quads", "hamstrings", "calves"])).toBe("Quads, hamstrings and calves");
  });
  it("orders consistently regardless of input order", () => {
    expect(describeRegions(["calves", "quads"])).toBe(describeRegions(["quads", "calves"]));
  });
});

describe("sanitizeRegions", () => {
  it("drops anything unknown so stored data cannot drift", () => {
    expect(sanitizeRegions(["quads", "legs", 7, null, "chest"])).toEqual(["quads", "chest"]);
  });
  it("de-duplicates", () => {
    expect(sanitizeRegions(["quads", "quads"])).toEqual(["quads"]);
  });
  it("survives junk", () => {
    expect(sanitizeRegions(null)).toEqual([]);
    expect(sanitizeRegions("quads")).toEqual([]);
  });
});

describe("orderRegions", () => {
  it("follows the declared display order", () => {
    const all = TRAINING_REGIONS.map((r) => r.key);
    expect(orderRegions([...all].reverse())).toEqual(all);
  });
});
