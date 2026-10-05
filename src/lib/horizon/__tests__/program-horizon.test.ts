import { describe, expect, it } from "vitest";

import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { buildAthleteSnapshot } from "@/lib/athlete/snapshot";
import { FRIDAY_LOWER_CLASS, fixtureSnapshot } from "@/lib/athlete/fixtures";
import {
  currentWeekNumber,
  distributePhases,
  generateProgramHorizon,
  getOriginalWeek,
  getWeek,
  withLiveStatus,
} from "../generate";
import { applyActivityToHorizon, previewActivity, recommendRevisions, reviseHorizon } from "../revise";
import { getProtocolDNA } from "@/lib/training/protocol-dna";
import type { ProgramHorizon } from "../types";

const NOW = new Date("2026-07-22T08:00:00.000Z");

function horizonFor(fixtureId: string, protocolId: string, totalWeeks?: number): ProgramHorizon {
  const snapshot = fixtureSnapshot(fixtureId)!;
  const profile = deriveProgrammingProfile(snapshot);
  const h = generateProgramHorizon({ protocolId, snapshot, profile, totalWeeks, now: NOW, startDate: "2026-07-20" });
  expect(h).not.toBeNull();
  return h!;
}

/** Total weekly sets — the honest comparison unit between two weeks. */
function totalSets(week: { volumeTarget: { setTargets: Record<string, number> } }): number {
  return Object.values(week.volumeTarget.setTargets).reduce((a, b) => a + b, 0);
}

describe("program horizon — generation", () => {
  it("1 · a twelve-week program produces twelve weeks", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    expect(h.totalWeeks).toBe(12);
    expect(h.weeks).toHaveLength(12);
    expect(h.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("2 · a sixteen-week program produces sixteen weeks", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 16);
    expect(h.weeks).toHaveLength(16);
    expect(h.weeks[15].weekNumber).toBe(16);
  });

  it("3 · week 8 exists at activation", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    expect(h.generatedAt).toBeTruthy();
    const week8 = getWeek(h, 8);
    expect(week8).not.toBeNull();
    expect(week8!.weeklyStructure).toHaveLength(7);
  });

  it("4 · week 8 has a valid phase", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const week8 = getWeek(h, 8)!;
    const phase = h.phases.find((p) => p.id === week8.phaseId);
    expect(phase).toBeTruthy();
    expect(week8.weekNumber).toBeGreaterThanOrEqual(phase!.weekStart);
    expect(week8.weekNumber).toBeLessThanOrEqual(phase!.weekEnd);
    expect(week8.phaseName).toBe(phase!.name);
    expect(week8.phaseWeek).toBeGreaterThanOrEqual(1);
  });

  it("5 · week 8 materially differs from week 1", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const w1 = getWeek(h, 1)!;
    const w8 = getWeek(h, 8)!;
    expect(w8.phaseId).not.toBe(w1.phaseId);
    expect(totalSets(w8)).not.toBe(totalSets(w1));
    expect(w8.intensityTarget.effortRange).not.toBe(w1.intensityTarget.effortRange);
    expect(w8.objective).not.toBe(w1.objective);
  });

  it("6 · deload weeks reduce demand below the surrounding weeks", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const deload = h.weeks.find((w) => w.status === "deload");
    expect(deload).toBeTruthy();
    const previous = getWeek(h, deload!.weekNumber - 1)!;
    expect(totalSets(deload!)).toBeLessThan(totalSets(previous));
    expect(deload!.nutritionDemand.toLowerCase()).toContain("reduced");
  });

  it("7 · assessment weeks differ from accumulation weeks", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const assessment = h.weeks.find((w) => w.status === "assessment")!;
    const accumulation = h.weeks.find((w) => w.phaseId === "accumulation")!;
    expect(assessment.phaseId).not.toBe(accumulation.phaseId);
    expect(assessment.objective).not.toBe(accumulation.objective);
    expect(totalSets(assessment)).toBeLessThan(totalSets(accumulation));
  });

  it("8 · Grand Touring week 8 differs from Powerbuilding week 8", () => {
    const gt = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const pb = horizonFor("powerbuilding", "reserve-powerbuilding", 12);
    const gt8 = getWeek(gt, 8)!;
    const pb8 = getWeek(pb, 8)!;
    expect(gt8.weeklyStructure.map((d) => d.title)).not.toEqual(pb8.weeklyStructure.map((d) => d.title));
    expect(gt8.phaseName).not.toBe(pb8.phaseName);
    expect(gt8.conditioningTarget).toBeTruthy();
    expect(pb8.conditioningTarget).toBeFalsy();
  });

  it("9 · Fat Loss week 8 differs from Lean Gain week 8", () => {
    const snapshot = fixtureSnapshot("higher-bodyweight-fat-loss")!;
    const profile = deriveProgrammingProfile(snapshot);
    const fat = generateProgramHorizon({ protocolId: "ultimate-summer-shred", snapshot, profile, totalWeeks: 12, now: NOW })!;
    const lean = generateProgramHorizon({ protocolId: "lean-bulk-command", snapshot, profile, totalWeeks: 12, now: NOW })!;
    const f8 = getWeek(fat, 8)!;
    const l8 = getWeek(lean, 8)!;
    expect(f8.phaseName).not.toBe(l8.phaseName);
    expect(f8.nutritionDemand).not.toBe(l8.nutritionDemand);
    expect(f8.weeklyStructure.map((d) => d.archetype)).not.toEqual(l8.weeklyStructure.map((d) => d.archetype));
  });

  it("10 · Beginner week 8 stays beginner-appropriate", () => {
    const h = horizonFor("beginner", "reserve-foundation", 12);
    const w8 = getWeek(h, 8)!;
    const trainingDays = w8.weeklyStructure.filter((d) => !d.recovery);
    // Never balloons into a six-day advanced plan.
    expect(trainingDays.length).toBeLessThanOrEqual(4);
    // Still conservative on effort.
    expect(w8.intensityTarget.effortRange).toMatch(/[2-5]/);
    // No specialization phase exists in the beginner sequence at all.
    expect(h.phases.map((p) => p.kind)).not.toContain("specialization");
    // Volume is still modest relative to an advanced physique block.
    const advanced = horizonFor("advanced-physique", "classic-physique-build", 12);
    expect(totalSets(w8)).toBeLessThan(totalSets(getWeek(advanced, 8)!));
  });

  it("17 · architecture and horizon versions are recorded", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    expect(h.architectureVersion).toBe("protocol-dna-1");
    expect(h.horizonVersion).toBe("program-horizon-1");
    expect(h.athleteSnapshotVersion).toBe("athlete-snapshot-1");
  });

  it("18 · a refresh preserves the horizon — regeneration is deterministic", () => {
    const a = horizonFor("advanced-physique", "classic-physique-build", 12);
    const b = horizonFor("advanced-physique", "classic-physique-build", 12);
    expect(b.weeks.map((w) => [w.weekNumber, w.phaseId, totalSets(w)])).toEqual(
      a.weeks.map((w) => [w.weekNumber, w.phaseId, totalSets(w)]),
    );
  });

  it("20 · missing information creates explicit assumptions rather than invented values", () => {
    const h = horizonFor("minimal-data", "12-week-physique", 12);
    expect(h.assumptions.length).toBeGreaterThan(0);
    expect(h.athleteSnapshot.evidence.confidence).toBe("low");
    expect(h.athleteSnapshot.profile.weightKg).toBeUndefined();
    expect(h.athleteSnapshot.profile.bodyFatPercent).toBeUndefined();
    // The program still generates completely.
    expect(h.weeks).toHaveLength(12);
    expect(h.assumptions.some((a) => /availability|4 days|four days/i.test(a))).toBe(true);
  });

  it("phase distribution always covers the whole block with no gaps", () => {
    for (const total of [8, 10, 12, 14, 16, 20, 24]) {
      const dna = getProtocolDNA("classic-physique-build")!;
      const phases = distributePhases(dna.phases, total);
      expect(phases[0].weekStart).toBe(1);
      expect(phases[phases.length - 1].weekEnd).toBe(total);
      for (let i = 1; i < phases.length; i += 1) {
        expect(phases[i].weekStart).toBe(phases[i - 1].weekEnd + 1);
      }
    }
  });

  it("every protocol generates a complete horizon at a range of block lengths", () => {
    const snapshot = fixtureSnapshot("advanced-physique")!;
    const profile = deriveProgrammingProfile(snapshot);
    const ids = ["reserve-grand-touring", "reserve-powerbuilding", "reserve-strength", "reserve-tactical",
      "reserve-endurance-physique", "reserve-foundation", "reserve-restored", "reserve-specialization",
      "classic-physique-build", "12-week-physique", "ultimate-summer-shred", "at-home-warrior",
      "championship-physique", "lean-bulk-command", "recomp-protocol", "signature-shape"];
    for (const id of ids) {
      for (const weeks of [8, 12, 16]) {
        const h = generateProgramHorizon({ protocolId: id, snapshot, profile, totalWeeks: weeks, now: NOW });
        expect(h, `${id} @ ${weeks}w`).not.toBeNull();
        expect(h!.weeks, `${id} @ ${weeks}w`).toHaveLength(weeks);
        expect(h!.weeks.every((w) => w.weeklyStructure.length === 7)).toBe(true);
      }
    }
  });
});

describe("program horizon — revision", () => {
  it("11 · the original projection survives adaptation", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const originalWeek5 = getOriginalWeek(h, 5)!;
    const applied = applyActivityToHorizon({
      horizon: h, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW,
    });
    expect(applied.blocked).toBe(false);
    // The stored original is untouched.
    expect(getOriginalWeek(applied.horizon, 5)).toEqual(originalWeek5);
    // And the revision keeps a full before/after record.
    expect(applied.revision!.before.length).toBeGreaterThan(0);
    expect(applied.revision!.after.length).toBe(applied.revision!.before.length);
  });

  it("12 · recurring activities revise future weeks", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const applied = applyActivityToHorizon({
      horizon: h, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW,
    });
    const current = currentWeekNumber(h, NOW);
    const revisedFuture = applied.horizon.weeks.filter((w) => w.weekNumber > current && w.status === "revised");
    expect(revisedFuture.length).toBeGreaterThan(0);
    expect(applied.revision!.effectiveWeek).toBe(current);
    // Week 8 with the recurring class is inspectable and genuinely changed.
    const week8 = getWeek(applied.horizon, 8)!;
    expect(week8.status).toBe("revised");
    expect(week8.weeklyStructure[4].title).toContain("Friday Lower-Body Group Class");
    expect(getOriginalWeek(applied.horizon, 8)!.weeklyStructure[4].title).not.toContain("Group Class");
  });

  it("13 · one-time activities do not rewrite the horizon", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const oneTime = { ...FRIDAY_LOWER_CLASS, id: "one-time-class", recurrence: "one-time" as const };
    const applied = applyActivityToHorizon({ horizon: h, activity: oneTime, athleteConfirmed: true, now: NOW });
    const current = currentWeekNumber(h, NOW);

    const futureRevised = applied.horizon.weeks.filter((w) => w.weekNumber > current && w.status === "revised");
    expect(futureRevised).toHaveLength(0);
    // The current week did change.
    expect(getWeek(applied.horizon, current)!.status).toBe("revised");
    // And the original Friday plan is preserved for every future week.
    const futureWeek = getWeek(applied.horizon, current + 3)!;
    expect(futureWeek.weeklyStructure[4].title).toBe(getOriginalWeek(h, current + 3)!.weeklyStructure[4].title);
  });

  it("14 · completed weeks never mutate", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    // Start the block four weeks ago so weeks 1–4 are history.
    const started: ProgramHorizon = { ...h, startDate: "2026-06-22" };
    const current = currentWeekNumber(started, NOW);
    expect(current).toBeGreaterThan(1);

    const completedBefore = started.weeks.filter((w) => w.weekNumber < current).map((w) => JSON.stringify(w));
    const applied = applyActivityToHorizon({
      horizon: started, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW,
    });
    const completedAfter = applied.horizon.weeks.filter((w) => w.weekNumber < current).map((w) => JSON.stringify(w));
    expect(completedAfter).toEqual(completedBefore);

    const revised = reviseHorizon({ horizon: started, reason: "test", volumeMultiplier: 0.5, now: NOW });
    expect(revised.horizon.weeks.filter((w) => w.weekNumber < current).map((w) => JSON.stringify(w))).toEqual(completedBefore);
  });

  it("15 · a week already completed is not offered for revision", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const started: ProgramHorizon = { ...h, startDate: "2026-06-22" };
    const live = withLiveStatus(started, NOW);
    const current = currentWeekNumber(started, NOW);
    expect(live.weeks.filter((w) => w.weekNumber < current).every((w) => w.status === "completed")).toBe(true);
    expect(live.weeks.find((w) => w.weekNumber === current)!.status).toBe("active");
    // Reserve revisions only ever target the current week onward.
    const revised = reviseHorizon({ horizon: started, reason: "reduce", volumeMultiplier: 0.8, now: NOW });
    expect(revised.revision!.affectedWeeks.every((n) => n >= current)).toBe(true);
  });

  it("16 · future weeks can revise", () => {
    const h = horizonFor("advanced-physique", "classic-physique-build", 12);
    const revised = reviseHorizon({
      horizon: h, reason: "Readiness declining", fromWeek: 5, volumeMultiplier: 0.8, now: NOW,
    });
    expect(revised.revision).not.toBeNull();
    expect(getWeek(revised.horizon, 5)!.status).toBe("revised");
    expect(totalSets(getWeek(revised.horizon, 5)!)).toBeLessThan(totalSets(getWeek(h, 5)!));
    // Weeks before the effective week are untouched.
    expect(getWeek(revised.horizon, 4)).toEqual(getWeek(h, 4));
  });

  it("meaningful changes require athlete confirmation", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const applied = applyActivityToHorizon({
      horizon: h, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: false, now: NOW,
    });
    expect(applied.blocked).toBe(true);
    expect(applied.horizon).toBe(h);
    expect(applied.revision).toBeNull();
  });

  it("the Friday class proposal reasons about lower-body overlap and upcoming distance", () => {
    const h = horizonFor("grand-touring-with-friday-class", "reserve-grand-touring", 12);
    const { proposal } = previewActivity(h, FRIDAY_LOWER_CLASS, NOW);
    expect(proposal.affectedDays).toContain("Fri");
    // Grand Touring's Monday is outdoor distance — the class must reach it.
    expect(proposal.reduce.some((r) => r.startsWith("Mon"))).toBe(true);
    expect(proposal.riskLevel === "moderate" || proposal.riskLevel === "high").toBe(true);
    expect(proposal.nutritionChanges.some((n) => /early-morning/i.test(n))).toBe(true);
    expect(proposal.recoveryChanges.length).toBeGreaterThan(0);
  });
});

describe("program horizon — evidence-driven recommendations", () => {
  const h = () => horizonFor("higher-bodyweight-fat-loss", "ultimate-summer-shred", 12);

  it("39 · rapid weight loss plus performance decline reduces demand rather than adding conditioning", () => {
    const recs = recommendRevisions(h(), {
      weightTrendKgPerWeek: -1.6, bodyWeightKg: 121, strengthDeclining: true,
    });
    const reduce = recs.find((r) => r.id === "reduce-demand-rapid-loss");
    expect(reduce).toBeTruthy();
    expect(reduce!.conditioningMultiplier).toBeLessThan(1);
    expect(reduce!.volumeMultiplier).toBeLessThan(1);
    expect(recs.every((r) => (r.conditioningMultiplier ?? 1) <= 1)).toBe(true);
  });

  it("37 · poor sleep and declining performance trigger a deload recommendation", () => {
    const recs = recommendRevisions(h(), { averageSleepHours: 5.2, strengthDeclining: true });
    expect(recs.some((r) => r.id === "deload-recommendation")).toBe(true);
  });

  it("38 · a stable scale with improving composition is not treated as failure", () => {
    const recs = recommendRevisions(h(), { weightTrendKgPerWeek: 0.05, compositionImproving: true });
    const rec = recs.find((r) => r.id === "recomposition-holding");
    expect(rec).toBeTruthy();
    expect(rec!.volumeMultiplier).toBeUndefined();
    expect(rec!.conditioningMultiplier).toBeUndefined();
    expect(recs.some((r) => r.id === "reduce-demand-rapid-loss")).toBe(false);
  });

  it("stable weight with high adherence advances exactly one lever", () => {
    const recs = recommendRevisions(h(), {
      weightTrendKgPerWeek: 0.02, adherence: 0.92, compositionImproving: false,
      averageSleepHours: 7.5, readinessScore: 70,
    });
    const rec = recs.find((r) => r.id === "single-lever-progression")!;
    expect(rec).toBeTruthy();
    const levers = [rec.volumeMultiplier, rec.conditioningMultiplier].filter((v) => v != null);
    expect(levers).toHaveLength(1);
  });

  it("low adherence shrinks the plan rather than restating it", () => {
    const recs = recommendRevisions(h(), { adherence: 0.4 });
    const rec = recs.find((r) => r.id === "adherence-reduction")!;
    expect(rec.volumeMultiplier).toBeLessThan(1);
  });
});

describe("program horizon — legacy and edge cases", () => {
  it("19 · a legacy athlete with no profile data still migrates to a complete horizon", () => {
    const snapshot = buildAthleteSnapshot({ primaryGoal: "" });
    const profile = deriveProgrammingProfile(snapshot);
    const h = generateProgramHorizon({ protocolId: "12-week-physique", snapshot, profile, totalWeeks: 12, now: NOW });
    expect(h).not.toBeNull();
    expect(h!.weeks).toHaveLength(12);
    expect(h!.assumptions.length).toBeGreaterThan(0);
    expect(h!.athleteSnapshot.objectives.primaryGoal).toBe("General physique development");
  });

  it("a short block still produces every week and a valid phase map", () => {
    const h = horizonFor("beginner", "reserve-foundation", 4);
    expect(h.weeks).toHaveLength(4);
    expect(h.phases[h.phases.length - 1].weekEnd).toBe(4);
    expect(h.weeks.every((w) => h.phases.some((p) => p.id === w.phaseId))).toBe(true);
  });

  it("an unknown protocol id returns null rather than a fabricated program", () => {
    const snapshot = fixtureSnapshot("advanced-physique")!;
    const profile = deriveProgrammingProfile(snapshot);
    expect(generateProgramHorizon({ protocolId: "does-not-exist", snapshot, profile, now: NOW })).toBeNull();
  });
});
