import { describe, expect, it } from "vitest";

import { prescribeMovement } from "../prescription-engine";
import { DEFAULT_USER_TRAINING_PROFILE, type UserTrainingProfile } from "../gym-environment";

const STRESS_RANK = { low: 0, moderate: 1, high: 2 } as const;

function profile(over: Partial<UserTrainingProfile>): UserTrainingProfile {
  return {
    ...DEFAULT_USER_TRAINING_PROFILE,
    equipment: ["barbell", "incline-press", "dumbbells", "cables", "bench"],
    premiumBrands: [],
    trainingLevel: "advanced",
    sessionDurationMin: 90,
    preferredStyle: "free-weights",
    movementLimitations: [],
    ...over,
  };
}

describe("exercise selection respects injuries and mobility", () => {
  it("a member with movement limitations is steered to lower joint-stress movements", () => {
    const healthy = prescribeMovement({ pattern: "Incline Press", profile: profile({}), goal: "lean-bulk", recoveryLimited: false, weakPointRelevant: false });
    const limited = prescribeMovement({ pattern: "Incline Press", profile: profile({ movementLimitations: ["shoulder"] }), goal: "lean-bulk", recoveryLimited: false, weakPointRelevant: false });

    expect(healthy.primary).toBeTruthy();
    expect(limited.primary).toBeTruthy();
    expect(limited.primary!.jointStress).not.toBe("high");
    expect(STRESS_RANK[limited.primary!.jointStress]).toBeLessThanOrEqual(STRESS_RANK[healthy.primary!.jointStress]);
  });

  it("equipment still governs availability (home dumbbell member never gets a barbell lift)", () => {
    const home = prescribeMovement({
      pattern: "Incline Press",
      profile: profile({ equipment: ["dumbbells", "bench"], gymEnvironment: "dumbbell-home", premiumBrands: [] }),
      goal: "lean-bulk", recoveryLimited: false, weakPointRelevant: false,
    });
    expect(home.primary!.equipment).not.toBe("barbell");
  });
});
