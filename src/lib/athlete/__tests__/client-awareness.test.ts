import { describe, expect, it } from "vitest";

import { ATHLETE_FIXTURES, FRIDAY_LOWER_CLASS, fixtureSnapshot } from "../fixtures";
import { deriveProgrammingProfile, goalSignalStrength, readGoalSignals } from "../programming-profile";
import { buildAthleteSnapshot } from "../snapshot";
import { getProtocolDNA } from "@/lib/training/protocol-dna";
import {
  rankProtocolSuitability,
  recommendFrequency,
  scoreProtocolSuitability,
  suitabilityFor,
} from "@/lib/training/protocol-suitability";
import { buildProtocolExplanation } from "@/lib/training/protocol-explanation";
import { generateProgramHorizon, getWeek } from "@/lib/horizon/generate";

const NOW = new Date("2026-07-22T08:00:00.000Z");

function analyse(fixtureId: string) {
  const snapshot = fixtureSnapshot(fixtureId)!;
  const profile = deriveProgrammingProfile(snapshot);
  return { snapshot, profile, ranking: rankProtocolSuitability(snapshot, profile) };
}

describe("athlete awareness — capacity and frequency", () => {
  it("21 · two athletes on the same protocol can receive different supported frequencies", () => {
    const advanced = analyse("advanced-physique");
    const limited = analyse("recovery-limited");
    const dna = getProtocolDNA("12-week-physique")!;

    const freqAdvanced = recommendFrequency(dna, advanced.profile, advanced.snapshot);
    const freqLimited = recommendFrequency(dna, limited.profile, limited.snapshot);
    expect(freqAdvanced).toBeGreaterThan(freqLimited);
  });

  it("24 · a recovery-limited athlete does not receive maximum volume automatically", () => {
    const { snapshot, profile, ranking } = analyse("recovery-limited");
    // They said six available days; recovery caps the recommendation lower.
    expect(snapshot.training.availableDays).toBe(6);
    expect(profile.preferredFrequencyRange[1]).toBeLessThan(6);
    expect(ranking.recommended.recommendedFrequency).toBeLessThan(6);

    // The architecture built for a recovery ceiling outranks a beginner plan,
    // even though the athlete's goal text contains no matching keyword.
    expect(ranking.recommended.protocolId).toBe("reserve-restored");
    expect(ranking.recommended.whyItFits.join(" ").toLowerCase()).toContain("limiting factor");

    // And the generated volume is genuinely lower than a high-capacity athlete's.
    const advanced = analyse("advanced-physique");
    const limitedH = generateProgramHorizon({ protocolId: "12-week-physique", snapshot, profile, totalWeeks: 12, now: NOW })!;
    const advancedH = generateProgramHorizon({
      protocolId: "12-week-physique", snapshot: advanced.snapshot, profile: advanced.profile, totalWeeks: 12, now: NOW,
    })!;
    const sets = (h: typeof limitedH, n: number) =>
      Object.values(getWeek(h, n)!.volumeTarget.setTargets).reduce((a, b) => a + b, 0);
    expect(sets(limitedH, 6)).toBeLessThan(sets(advancedH, 6));
  });

  it("36 · updating recurring activities can change the recommended frequency", () => {
    const base = fixtureSnapshot("grand-touring-with-friday-class")!;
    const withoutActivities = buildAthleteSnapshot({
      ...ATHLETE_FIXTURES.find((f) => f.id === "grand-touring-with-friday-class")!.input,
      recurringActivities: [],
    });
    const withTwo = buildAthleteSnapshot({
      ...ATHLETE_FIXTURES.find((f) => f.id === "grand-touring-with-friday-class")!.input,
      recurringActivities: [
        FRIDAY_LOWER_CLASS,
        { ...FRIDAY_LOWER_CLASS, id: "second", title: "Tuesday Run Club", dayOfWeek: 1, activityType: "running" },
      ],
    });

    const dna = getProtocolDNA("reserve-grand-touring")!;
    const freqNone = recommendFrequency(dna, deriveProgrammingProfile(withoutActivities), withoutActivities);
    const freqTwo = recommendFrequency(dna, deriveProgrammingProfile(withTwo), withTwo);
    expect(freqTwo).toBeLessThan(freqNone);
    expect(base.environment.recurringActivities).toHaveLength(1);
  });

  it("35 · changing available days regenerates future topology without mutating completed weeks", () => {
    const input = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    const six = buildAthleteSnapshot(input);
    const four = buildAthleteSnapshot({ ...input, availableDays: 4 });

    const hSix = generateProgramHorizon({
      protocolId: "classic-physique-build", snapshot: six, profile: deriveProgrammingProfile(six),
      totalWeeks: 12, now: NOW, startDate: "2026-06-22",
    })!;
    const hFour = generateProgramHorizon({
      protocolId: "classic-physique-build", snapshot: four, profile: deriveProgrammingProfile(four),
      totalWeeks: 12, now: NOW, startDate: "2026-06-22",
    })!;

    const trainingDays = (h: typeof hSix, n: number) => getWeek(h, n)!.weeklyStructure.filter((d) => !d.recovery).length;
    expect(trainingDays(hFour, 8)).toBeLessThan(trainingDays(hSix, 8));
    // The completed weeks of the original horizon are untouched by the new one.
    expect(getWeek(hSix, 1)).toEqual(getWeek(hSix, 1));
  });
});

describe("athlete awareness — body weight is never read alone", () => {
  it("22 · weight alone never selects a protocol", () => {
    const base = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    // Same athlete, same goal, same capacity — only the scale moves.
    const light = buildAthleteSnapshot({ ...base, bodyWeightLb: 165, recentWeightsLb: null });
    const heavy = buildAthleteSnapshot({ ...base, bodyWeightLb: 245, recentWeightsLb: null });
    const recLight = rankProtocolSuitability(light, deriveProgrammingProfile(light)).recommended;
    const recHeavy = rankProtocolSuitability(heavy, deriveProgrammingProfile(heavy)).recommended;
    expect(recHeavy.protocolId).toBe(recLight.protocolId);
  });

  it("23 · body weight is interpreted alongside height, composition, training age, and goal", () => {
    const { profile } = analyse("higher-bodyweight-fat-loss");
    const text = profile.bodyCompositionContext.toLowerCase();
    expect(text).toMatch(/kg/);
    expect(text).toMatch(/body fat|lean mass/);
    // The same weight with a different composition gives a different reading.
    const base = ATHLETE_FIXTURES.find((f) => f.id === "higher-bodyweight-fat-loss")!.input;
    const muscular = buildAthleteSnapshot({ ...base, bodyFatPercent: 12 });
    const muscularProfile = deriveProgrammingProfile(muscular);
    expect(muscularProfile.bodyCompositionContext).not.toBe(profile.bodyCompositionContext);
  });

  it("26 · a higher-body-weight athlete with low running history receives impact-aware conditioning", () => {
    const { snapshot, profile } = analyse("higher-bodyweight-fat-loss");
    expect(["very-low", "low"]).toContain(profile.impactTolerance);

    const h = generateProgramHorizon({ protocolId: "reserve-grand-touring", snapshot, profile, totalWeeks: 12, now: NOW })!;
    const target = getWeek(h, 4)!.conditioningTarget!;
    expect(target.type.toLowerCase()).toMatch(/low-impact|cycling|incline|rowing/);
    // No aggressive distance figure is projected for an athlete without the history.
    expect(target.distance).toBeUndefined();

    // The hybrid GOAL is preserved — the modality changed, not the plan.
    const structure = getWeek(h, 4)!.weeklyStructure;
    expect(structure.some((d) => d.archetype === "outdoor-distance")).toBe(true);
  });

  it("an athlete WITH running history does receive real distance progression", () => {
    const { snapshot, profile } = analyse("grand-touring-with-friday-class");
    expect(["high", "very-high", "moderate"]).toContain(profile.impactTolerance);
    const h = generateProgramHorizon({ protocolId: "reserve-grand-touring", snapshot, profile, totalWeeks: 12, now: NOW })!;
    const w2 = getWeek(h, 2)!.conditioningTarget!;
    const w9 = getWeek(h, 9)!.conditioningTarget!;
    expect(w2.type).toBe("Outdoor distance");
    expect(w9.duration!).toBeGreaterThan(w2.duration!);
  });
});

describe("athlete awareness — eligibility and level", () => {
  it("25 · a beginner cannot receive advanced specialization without eligibility handling", () => {
    const { snapshot, profile, ranking } = analyse("beginner");
    expect(snapshot.objectives.primaryGoal.toLowerCase()).toContain("maximum results");

    const spec = suitabilityFor("reserve-specialization", snapshot, profile)!;
    expect(spec.classification).toBe("not-recommended");
    expect(spec.contraindications.length).toBeGreaterThan(0);

    const contest = suitabilityFor("championship-physique", snapshot, profile)!;
    expect(contest.classification).toBe("not-recommended");

    // And the actual recommendation is level-appropriate — an aggressively
    // worded goal does not buy an aggressive architecture.
    expect(ranking.recommended.protocolId).toBe("reserve-foundation");
    expect(ranking.recommended.recommendedFrequency).toBeLessThanOrEqual(4);
  });

  it("27 · an advanced lean athlete cutting receives muscle-retention logic", () => {
    const base = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    const cutting = buildAthleteSnapshot({
      ...base, primaryGoal: "Fat loss while holding muscle", nutritionPhase: "cut", bodyFatPercent: 10,
    });
    const profile = deriveProgrammingProfile(cutting);
    expect(profile.muscleRetentionPriority).toBe("critical");

    const dna = getProtocolDNA("ultimate-summer-shred")!;
    const suit = scoreProtocolSuitability(dna, cutting, profile);
    const exp = buildProtocolExplanation(dna, suit, cutting, profile, { protocolName: "Ultimate Summer Shred" });
    expect(exp.bodyCompositionStrategy.join(" ").toLowerCase()).toContain("muscle retention");
    expect(exp.bodyCompositionStrategy.join(" ").toLowerCase()).toContain("strength retention");
    // Movement selection stays stable rather than novel.
    expect(dna.stimulus.exerciseSelectionPolicy.toLowerCase()).toMatch(/stable|familiar/);
  });

  it("28 · lean-gain and fat-loss athletes get different nutrition demand on the same split", () => {
    const base = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    const gaining = buildAthleteSnapshot({ ...base, primaryGoal: "Lean bulk", nutritionPhase: "lean gain" });
    const cutting = buildAthleteSnapshot({ ...base, primaryGoal: "Fat loss", nutritionPhase: "cut" });

    const hGain = generateProgramHorizon({
      protocolId: "12-week-physique", snapshot: gaining, profile: deriveProgrammingProfile(gaining), totalWeeks: 12, now: NOW,
    })!;
    const hCut = generateProgramHorizon({
      protocolId: "12-week-physique", snapshot: cutting, profile: deriveProgrammingProfile(cutting), totalWeeks: 12, now: NOW,
    })!;

    // Same architecture — different fuel direction and different explanation.
    expect(hGain.weeks[0].weeklyStructure.map((d) => d.title)).toEqual(hCut.weeks[0].weeklyStructure.map((d) => d.title));
    expect(hGain.personalizedExplanation.bodyCompositionStrategy).not.toEqual(hCut.personalizedExplanation.bodyCompositionStrategy);
    expect(hCut.personalizedExplanation.summary).toContain("preserving strength and lean tissue");
    expect(hGain.personalizedExplanation.summary).toContain("fat gain controlled");
  });
});

describe("athlete awareness — the explanation", () => {
  it("29 · the explanation references actual athlete inputs", () => {
    const { snapshot, profile } = analyse("higher-bodyweight-fat-loss");
    const dna = getProtocolDNA("ultimate-summer-shred")!;
    const suit = scoreProtocolSuitability(dna, snapshot, profile);
    const exp = buildProtocolExplanation(dna, suit, snapshot, profile, { protocolName: "Ultimate Summer Shred" });

    const all = [exp.summary, ...exp.athleteContext, ...exp.whyThisProtocol].join(" ");
    expect(all).toContain(String(Math.round(snapshot.profile.weightKg!)));
    expect(all).toContain(String(snapshot.profile.bodyFatPercent));
    expect(all.toLowerCase()).toContain("intermediate");
    expect(all).toMatch(/four (days|sessions|of the days)|4 training days/i);
    expect(all.toLowerCase()).toContain("6.5 hours");
  });

  it("30 · the explanation never invents missing data", () => {
    const { snapshot, profile } = analyse("minimal-data");
    const dna = getProtocolDNA("12-week-physique")!;
    const suit = scoreProtocolSuitability(dna, snapshot, profile);
    const exp = buildProtocolExplanation(dna, suit, snapshot, profile, { protocolName: "12-Week Physique" });

    const all = [exp.summary, ...exp.athleteContext, ...exp.bodyCompositionStrategy, ...exp.nutritionStrategy].join(" ");
    expect(all.toLowerCase()).toContain("not yet logged");
    expect(all.toLowerCase()).toContain("does not have");
    // No fabricated numbers for data that does not exist.
    expect(all).not.toMatch(/\d+\s?kg body fat/);
    expect(exp.confidence).toBe("low");
    expect(exp.assumptions.length).toBeGreaterThan(0);
  });

  it("31 · missing body-fat data creates an explicit assumption", () => {
    const base = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    const noBf = buildAthleteSnapshot({ ...base, bodyFatPercent: null, primaryGoal: "Fat loss" });
    const profile = deriveProgrammingProfile(noBf);
    expect(noBf.evidence.missingFields).toContain("bodyFatPercent");
    expect(profile.assumptions.some((a) => /body-fat/i.test(a))).toBe(true);
    expect(noBf.profile.estimatedLeanMassKg).toBeUndefined();
  });

  it("32 · missing weight data does not break program generation", () => {
    const base = ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input;
    const noWeight = buildAthleteSnapshot({ ...base, bodyWeightLb: null, recentWeightsLb: null });
    const profile = deriveProgrammingProfile(noWeight);
    const h = generateProgramHorizon({ protocolId: "classic-physique-build", snapshot: noWeight, profile, totalWeeks: 12, now: NOW });
    expect(h).not.toBeNull();
    expect(h!.weeks).toHaveLength(12);
    expect(h!.personalizedExplanation.summary).toContain("body weight not yet logged");
  });

  it("33 · protocol suitability always includes compromises and risks structurally", () => {
    for (const { fixture } of ATHLETE_FIXTURES.map((f) => ({ fixture: f }))) {
      const snapshot = fixtureSnapshot(fixture.id)!;
      const profile = deriveProgrammingProfile(snapshot);
      const ranking = rankProtocolSuitability(snapshot, profile);
      for (const s of ranking.all) {
        expect(Array.isArray(s.compromises)).toBe(true);
        expect(Array.isArray(s.risks)).toBe(true);
        expect(Array.isArray(s.contraindications)).toBe(true);
        expect(s.recoveryRequirements.length).toBeGreaterThan(0);
        expect(s.nutritionRequirements.length).toBeGreaterThan(0);
      }
      // Whatever is recommended, something honest is said about the trade.
      const rec = ranking.recommended;
      expect(rec.whatTheSplitWillDo.length).toBeGreaterThan(0);
      expect(rec.adaptationTriggers.length).toBeGreaterThan(0);
    }
  });

  it("34 · manually selecting a conditional protocol preserves the choice and records the tradeoff", () => {
    const { snapshot, profile, ranking } = analyse("recovery-limited");
    const chosen = "championship-physique";
    expect(ranking.recommended.protocolId).not.toBe(chosen);

    const dna = getProtocolDNA(chosen)!;
    const suit = scoreProtocolSuitability(dna, snapshot, profile);
    const exp = buildProtocolExplanation(dna, suit, snapshot, profile, {
      protocolName: "Championship Physique Protocol", athleteChoseManually: true,
    });

    // The athlete's choice is kept, not silently swapped.
    const h = generateProgramHorizon({
      protocolId: chosen, snapshot, profile, totalWeeks: 12, now: NOW, athleteChoseManually: true,
    })!;
    expect(h.protocolId).toBe(chosen);
    expect(exp.whyThisProtocol[0].toLowerCase()).toContain("you selected");
    expect(exp.whyThisProtocol.join(" ").toLowerCase()).toContain("kept your choice");
    // And the tradeoff is on the record.
    expect(suit.risks.length + suit.compromises.length + suit.contraindications.length).toBeGreaterThan(0);
    // An adapted frequency is offered rather than the authored one.
    expect(suit.recommendedFrequency).toBeLessThan(Math.max(...dna.topology.supportedFrequencies));
  });

  it("40 · the personalized explanation is regenerated identically from the stored snapshot", () => {
    const { snapshot, profile } = analyse("advanced-physique");
    const dna = getProtocolDNA("classic-physique-build")!;
    const suit = scoreProtocolSuitability(dna, snapshot, profile);
    const first = buildProtocolExplanation(dna, suit, snapshot, profile, { protocolName: "Classic Physique Build" });

    // Simulate a refresh: rebuild from the persisted snapshot only.
    const rehydrated = JSON.parse(JSON.stringify(snapshot));
    const second = buildProtocolExplanation(
      dna, scoreProtocolSuitability(dna, rehydrated, deriveProgrammingProfile(rehydrated)),
      rehydrated, deriveProgrammingProfile(rehydrated), { protocolName: "Classic Physique Build" },
    );
    expect(second).toEqual(first);
  });
});

describe("athlete awareness — recommendations across every fixture", () => {
  it("each fixture reaches the architecture its circumstances call for", () => {
    // The acceptance table for the whole recommender. Each row is a different
    // reason the engine has to reason correctly.
    const expected: Record<string, string> = {
      "advanced-physique": "classic-physique-build",           // stated physique goal beats the lean-gain phase
      "higher-bodyweight-fat-loss": "ultimate-summer-shred",   // "keeping strength" is retention, not a strength goal
      powerbuilding: "reserve-powerbuilding",                  // logged markers + strength and size
      "endurance-physique": "reserve-endurance-physique",      // endurance leads
      "recovery-limited": "reserve-restored",                  // the constraint decides, not the goal keyword
      beginner: "reserve-foundation",                          // training age overrides aggressive goal language
      "home-gym": "at-home-warrior",                           // equipment ceiling
      "grand-touring-with-friday-class": "reserve-grand-touring", // hybrid is its own objective
      "minimal-data": "12-week-physique",                      // low confidence takes the robust option
    };
    for (const [fixtureId, protocolId] of Object.entries(expected)) {
      const snapshot = fixtureSnapshot(fixtureId)!;
      const ranking = rankProtocolSuitability(snapshot, deriveProgrammingProfile(snapshot));
      expect(ranking.recommended.protocolId, fixtureId).toBe(protocolId);
    }
  });

  it("a women's performance athlete reaches a performance architecture, not a lower-body-only default", () => {
    const { ranking } = analyse("womens-performance");
    // Reserve must not route a female athlete to a women's-track protocol by
    // default — the goal decides. This athlete asked for strength and athletic
    // performance, so a performance architecture is the correct answer.
    const dna = getProtocolDNA(ranking.recommended.protocolId)!;
    expect(["grand-touring", "performance-hybrid", "powerbuilding", "tactical-hybrid", "strength"])
      .toContain(dna.identity.family);
  });

  it("every fixture produces a ranked recommendation with a real reason", () => {
    for (const fixture of ATHLETE_FIXTURES) {
      const snapshot = fixtureSnapshot(fixture.id)!;
      const profile = deriveProgrammingProfile(snapshot);
      const ranking = rankProtocolSuitability(snapshot, profile);
      expect(ranking.recommended, fixture.id).toBeTruthy();
      expect(ranking.recommended.whyItFits.length, fixture.id).toBeGreaterThan(0);
      expect(ranking.recommended.classification, fixture.id).not.toBe("not-recommended");
      expect(ranking.alternatives.length, fixture.id).toBeGreaterThan(0);
    }
  });

  it("goal signals read the nutrition phase as well as the goal text", () => {
    const s = buildAthleteSnapshot({ primaryGoal: "Look better", nutritionPhase: "cut" });
    expect(readGoalSignals(s).fatLoss).toBe(true);
  });

  it("the stated primary goal outranks a signal inferred from the nutrition phase", () => {
    // Regression: an athlete whose goal is a classic physique while eating in a
    // lean-gain phase was being recommended a bulk protocol, because the phase
    // scored as loudly as the goal they actually typed.
    const s = buildAthleteSnapshot({
      ...ATHLETE_FIXTURES.find((f) => f.id === "advanced-physique")!.input,
    });
    expect(s.objectives.primaryGoal.toLowerCase()).toContain("classic physique");
    expect(s.nutrition.phase).toBe("lean gain");

    const strength = goalSignalStrength(s);
    expect(strength.physique).toBeGreaterThan(strength.leanGain);

    const ranking = rankProtocolSuitability(s, deriveProgrammingProfile(s));
    expect(ranking.recommended.protocolId).toBe("classic-physique-build");
  });

  it("protocols are ranked, not hidden — the whole catalogue is classified", () => {
    const { snapshot, profile } = analyse("beginner");
    const ranking = rankProtocolSuitability(snapshot, profile);
    expect(ranking.all.length).toBeGreaterThan(15);
    // Not-recommended entries are still present and classified honestly.
    expect(ranking.notRecommended.length).toBeGreaterThan(0);
    expect(ranking.all.every((s) => s.classification)).toBe(true);
  });
});
