import { describe, expect, it } from "vitest";

import { buildSplitRecommendation, type SplitArchitectInput } from "../split-architect";

const base: SplitArchitectInput = {
  goal: "build maximum muscle size",
  advanced: true,
  recoveryStrong: true,
  trainingDaysPerWeek: 6,
  weakPointLabels: [],
  hasDeadline: false,
};

describe("split architect is capacity-aware and explainable", () => {
  it("recommends the high-output rotation only when the days carry it", () => {
    const sixDay = buildSplitRecommendation({ ...base, trainingDaysPerWeek: 6 });
    const threeDay = buildSplitRecommendation({ ...base, trainingDaysPerWeek: 3 });
    expect(sixDay.recommended.key).toBe("advanced-hypertrophy-rotation");
    expect(threeDay.recommended.key).not.toBe("advanced-hypertrophy-rotation");
  });

  it("exposes concise reasons for the alternatives it set aside", () => {
    const rec = buildSplitRecommendation(base);
    expect(rec.rejected.length).toBeGreaterThan(0);
    for (const r of rec.rejected) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
