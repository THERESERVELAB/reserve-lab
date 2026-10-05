import { describe, expect, it } from "vitest";

import { estimateDailyTargets, FUEL_REFERENCE_BODYWEIGHT_LB } from "@/lib/nutrition/fuel-plan";
import { proteinRead } from "@/lib/nutrition/nutrition-room";
import { clearUntouchedDefaultBodyweight, LEGACY_DEFAULT_BODYWEIGHT_LB, resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { clearUntouchedRetentionSample, DEFAULT_RETENTION_STATE, LEGACY_RETENTION_SAMPLE } from "@/lib/retention-config";
import { EMPTY_WOMENS_EVIDENCE, resolveWomensOverview } from "@/lib/women/primary-actions";
import { clearUntouchedWomensSample, LEGACY_WOMENS_SAMPLE } from "@/lib/women/legacy-sample";
import { DEFAULT_WOMENS_STATE } from "@/lib/women/types";

describe("retention defaults record nothing the member did not provide", () => {
  it("ships no readiness or adherence", () => {
    /* Was 84 / 79 — re-recorded by the Apex check-in and sent to six AI hooks as readinessScore. */
    expect(DEFAULT_RETENTION_STATE.weeklyReadinessScore).toBeNull();
    expect(DEFAULT_RETENTION_STATE.adherenceScore).toBeNull();
  });

  it("clears the shipped 84 / 79 pair from saved engagement, and only that exact pair", () => {
    const saved = { ...DEFAULT_RETENTION_STATE, currentStreak: 4, ...LEGACY_RETENTION_SAMPLE };
    const cleared = clearUntouchedRetentionSample(saved);
    expect(cleared.weeklyReadinessScore).toBeNull();
    expect(cleared.adherenceScore).toBeNull();
    expect(cleared.currentStreak).toBe(4);

    const real = { ...saved, adherenceScore: 80 };
    expect(clearUntouchedRetentionSample(real)).toBe(real);
    expect(clearUntouchedRetentionSample(cleared)).toBe(cleared);
  });
});

describe("the women's slice seeds nothing", () => {
  it("starts with no reserve, scores, habits or adherence", () => {
    expect(DEFAULT_WOMENS_STATE.recovery.reserve).toBeNull();
    expect(DEFAULT_WOMENS_STATE.recovery.recentScores).toEqual([]);
    expect(DEFAULT_WOMENS_STATE.recovery.habits).toEqual([]);
    expect(DEFAULT_WOMENS_STATE.nutrition.recentAdherence).toEqual([]);
  });

  it("says what is missing instead of inventing a readout", () => {
    const overview = resolveWomensOverview(EMPTY_WOMENS_EVIDENCE);
    expect(overview.statement).toBe("Cycle dates not entered");
    expect(overview.requirements.every((r) => r.have === 0)).toBe(true);
    expect(`${overview.statement} ${overview.support}`).not.toMatch(/\d+%/);
  });

  it("clears the shipped sample from saved state only while it is untouched", () => {
    const saved = {
      ...DEFAULT_WOMENS_STATE,
      enabled: true,
      nutrition: { ...DEFAULT_WOMENS_STATE.nutrition, recentAdherence: [...LEGACY_WOMENS_SAMPLE.nutritionRecentAdherence] },
      recovery: {
        reserve: LEGACY_WOMENS_SAMPLE.recoveryReserve,
        recentScores: [...LEGACY_WOMENS_SAMPLE.recoveryRecentScores],
        habits: LEGACY_WOMENS_SAMPLE.recoveryHabits.map((h) => ({ ...h })),
      },
    };
    const cleared = clearUntouchedWomensSample(saved);
    expect(cleared.recovery).toEqual({ reserve: null, recentScores: [], habits: [] });
    expect(cleared.nutrition.recentAdherence).toEqual([]);
    expect(cleared.enabled).toBe(true);

    const touched = { ...saved, recovery: { ...saved.recovery, reserve: 70 } };
    expect(clearUntouchedWomensSample(touched).recovery.reserve).toBe(70);
    expect(clearUntouchedWomensSample(cleared)).toBe(cleared);
  });
});

describe("bodyweight is the member's, or it is disclosed as a reference", () => {
  it("resolves the latest weigh-in, then the baseline, then the setup weight", () => {
    const weighIns = [
      { date: "2026-09-01", bodyWeightLb: 201 },
      { date: "2026-09-10", bodyWeightLb: 198.4 },
    ];
    expect(resolveMemberBodyweight({ weighIns, baselineWeightLb: 205, profileBodyweightLb: 210 })).toEqual({ lb: 198.4, source: "weigh-in" });
    expect(resolveMemberBodyweight({ weighIns: [], baselineWeightLb: 205, profileBodyweightLb: 210 })).toEqual({ lb: 205, source: "baseline" });
    expect(resolveMemberBodyweight({ profileBodyweightLb: 210 })).toEqual({ lb: 210, source: "profile" });
    expect(resolveMemberBodyweight({ profileBodyweightLb: 0 })).toBeNull();
  });

  it("marks targets built without a bodyweight as a reference estimate", () => {
    const known = estimateDailyTargets("maintenance", 200, true);
    expect(known.basis).toBe("member-weight");
    expect(known.proteinG).toBe(190);

    const unknown = estimateDailyTargets("maintenance", null, true);
    expect(unknown.basis).toBe("reference-weight");
    expect(unknown.note).toContain(`${FUEL_REFERENCE_BODYWEIGHT_LB} lb reference`);
  });

  it("says so in the protein read when the target is a reference estimate", () => {
    const meals = [{ id: "m1", macros: { calories: 400, proteinG: 40, carbsG: 30, fatG: 10 } }];
    const reference = proteinRead({ meals, loggedMealIds: [], targetG: 176, targetBasis: "reference-weight" });
    expect(reference?.detail).toContain(`${FUEL_REFERENCE_BODYWEIGHT_LB} lb`);
    expect(proteinRead({ meals, loggedMealIds: [], targetG: 190, targetBasis: "member-weight" })?.detail).toBe("0 of 1 meals logged");
  });

  it("clears the shipped 190 lb only when the member never saved it in setup", () => {
    const untouched = { bodyweightLb: LEGACY_DEFAULT_BODYWEIGHT_LB };
    expect(clearUntouchedDefaultBodyweight(untouched, []).bodyweightLb).toBe(0);
    expect(clearUntouchedDefaultBodyweight(untouched, ["profile"])).toBe(untouched);
    const real = { bodyweightLb: 182 };
    expect(clearUntouchedDefaultBodyweight(real, [])).toBe(real);
  });
});
