import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { CUSTOM_SUPPLEMENT_LINES, buildSupportPlanReview, intakeSources, type SupportContext } from "../support-plan";
import type { SupportPlanItem } from "../types";

function context(plan: SupportPlanItem[]): SupportContext {
  return {
    today: "2026-09-15",
    brief: buildCompoundRiskBrief([]),
    logged: [],
    medicationsText: "",
    healthContext: [],
    allergies: [],
    goalSetup: null,
    trends: [],
    checkIns: [],
    comparison: null,
    systems: [],
    untestedLabels: [],
    needsCare: false,
    stillActivePastEnd: false,
    plan,
  };
}

const custom: SupportPlanItem = { id: "s1", optionKey: "custom", customTitle: "Tongkat ali", addedAt: "2026-09-01T10:00:00.000Z", amount: "400", unit: "mg" };
const library: SupportPlanItem = { id: "s2", optionKey: "vitamin-d3", addedAt: "2026-09-01T10:00:00.000Z" };

describe("custom supplements in the support plan", () => {
  it("keeps a member-named supplement beside library options, counted but never graded", () => {
    const review = buildSupportPlanReview(context([custom, library]));
    expect(review.entries.map((e) => e.item.id)).toEqual(["s2"]);
    expect(review.custom).toEqual([{ item: custom, title: "Tongkat ali", lines: CUSTOM_SUPPLEMENT_LINES }]);
    expect(review.counts.selected).toBe(2);
    expect(review.counts.stronger + review.counts.limited + review.counts.notShown).toBe(1);
  });

  it("never runs ingredient checks on a product Reserve does not know", () => {
    expect(intakeSources({ plan: [custom], logged: [] })).toEqual([]);
    expect(buildSupportPlanReview(context([custom])).duplicates).toEqual([]);
  });

  it("says honestly what Reserve can and cannot tell about it", () => {
    expect(CUSTOM_SUPPLEMENT_LINES.join(" ")).toMatch(/not in Reserve's library/);
    expect(CUSTOM_SUPPLEMENT_LINES.join(" ")).toMatch(/can't check its ingredients/);
    for (const line of CUSTOM_SUPPLEMENT_LINES) expect(bannedLanguageIn(line), line).toEqual([]);
  });
});
