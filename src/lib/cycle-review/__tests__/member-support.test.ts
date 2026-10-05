import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";

import { buildMemberSupportReview, type MemberSupportInput } from "../member-support";

/**
 * The support plan outside a cycle: the member's logged compounds, their full
 * lab history and check-ins — no cycle required.
 */

const now = new Date(2026, 8, 15, 9);
const compounds: MemberSupportInput["compounds"] = [
  { id: "t", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", isActive: true },
  { id: "old", name: "Oxandrolone", officialName: "Oxandrolone", compoundClass: "aas", category: "hormone", isActive: false },
];
const riskBrief = buildCompoundRiskBrief(compounds.filter((c) => c.isActive).map((c) => ({ name: c.name, officialName: c.officialName, compoundClass: c.compoundClass })));
const labBrief = buildLabSafetyBrief({
  records: [
    { id: "a", testDate: "2026-06-01", markers: [{ name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" }] },
    { id: "b", testDate: "2026-09-01", markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" }] },
  ],
  markerLinks: riskBrief.markerLinks,
  now,
});

function input(overrides: Partial<MemberSupportInput> = {}): MemberSupportInput {
  return {
    today: "2026-09-15",
    compounds,
    labBrief,
    checkIns: [],
    sleepLogDates: [],
    medicationsText: "",
    healthContext: [],
    allergies: [],
    needsCare: false,
    plan: [],
    ...overrides,
  };
}

describe("member support review without a cycle", () => {
  it("links library options to the member's active compounds and labs", () => {
    const review = buildMemberSupportReview(input());
    expect(review.library.some((group) => group.options.some((option) => option.personalized))).toBe(true);
    expect(review.coverage.find((row) => row.key === "blood")?.states).toContain("monitored");
    expect(review.notAddressed.join(" ")).toMatch(/Hematocrit/);
  });

  it("ignores inactive compounds and never reports a planned end", () => {
    const review = buildMemberSupportReview(input());
    expect(review.notAddressed.join(" ")).not.toMatch(/planned end/);
    const onlyInactive = buildMemberSupportReview(input({ compounds: [compounds[1]], labBrief: buildLabSafetyBrief({ records: [], markerLinks: {}, now }) }));
    expect(onlyInactive.library.every((group) => group.options.every((option) => !option.personalized))).toBe(true);
  });

  it("carries custom supplements and the member's plan", () => {
    const review = buildMemberSupportReview(
      input({ plan: [{ id: "s1", optionKey: "custom", customTitle: "Tongkat ali", addedAt: "2026-09-01T10:00:00.000Z" }, { id: "s2", optionKey: "vitamin-d3", addedAt: "2026-09-01T10:00:00.000Z" }] }),
    );
    expect(review.counts.selected).toBe(2);
    expect(review.custom.map((c) => c.title)).toEqual(["Tongkat ali"]);
  });

  it("puts warning-sign care first when the member needs it", () => {
    expect(buildMemberSupportReview(input({ needsCare: true })).notAddressed[0]).toMatch(/medical care now/);
  });
});
