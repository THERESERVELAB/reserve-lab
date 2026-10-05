import { describe, expect, it } from "vitest";

import { computeMacroTargets, type TrainingLoad } from "../macro-engine";

const HYPER: TrainingLoad = { intentMix: { strength: 0.2, hypertrophy: 0.7, conditioning: 0.1 }, trainingDaysPerWeek: 6 };
const STRENGTH: TrainingLoad = { intentMix: { strength: 0.6, hypertrophy: 0.3, conditioning: 0.1 }, trainingDaysPerWeek: 4 };
const CONDITIONING: TrainingLoad = { intentMix: { strength: 0.2, hypertrophy: 0.3, conditioning: 0.5 }, trainingDaysPerWeek: 5 };

const base = { goal: "lean-bulk" as const, bodyweightLb: 190, dayType: "training" as const, dietStyle: "standard" as const };

describe("nutrition derives from training architecture", () => {
  it("hypertrophy-heavy load carries more training-day carbs than strength-led", () => {
    const hyper = computeMacroTargets({ ...base, trainingLoad: HYPER });
    const strength = computeMacroTargets({ ...base, trainingLoad: STRENGTH });
    expect(hyper.carbsG).toBeGreaterThan(strength.carbsG);
  });

  it("strength-led load biases protein up", () => {
    const hyper = computeMacroTargets({ ...base, trainingLoad: HYPER });
    const strength = computeMacroTargets({ ...base, trainingLoad: STRENGTH });
    expect(strength.proteinG).toBeGreaterThan(hyper.proteinG);
  });

  it("conditioning-heavy training days raise hydration", () => {
    const conditioning = computeMacroTargets({ ...base, trainingLoad: CONDITIONING });
    const strength = computeMacroTargets({ ...base, trainingLoad: STRENGTH });
    expect(conditioning.hydrationMl).toBeGreaterThan(strength.hydrationMl);
  });

  it("is unchanged when no training load is supplied (back-compat)", () => {
    const withNone = computeMacroTargets({ ...base });
    const withNull = computeMacroTargets({ ...base, trainingLoad: null });
    expect(withNull).toEqual(withNone);
    // And the load genuinely moved carbs vs the neutral baseline.
    const hyper = computeMacroTargets({ ...base, trainingLoad: HYPER });
    expect(hyper.carbsG).not.toBe(withNone.carbsG);
  });
});
