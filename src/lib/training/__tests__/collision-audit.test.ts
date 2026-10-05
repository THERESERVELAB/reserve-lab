import { describe, expect, it } from "vitest";

import { allProtocolDNA, recommendableProtocolDNA } from "../protocol-dna";
import {
  auditProtocolCollisions,
  compareProtocolStructures,
  structuralSignature,
  unresolvedCollisions,
} from "../structural-signature";

describe("protocol collision audit", () => {
  it("41 · no two independently marketed protocols are functionally duplicated", () => {
    const dupes = auditProtocolCollisions(recommendableProtocolDNA()).filter(
      (p) => p.classification === "FUNCTIONALLY DUPLICATED",
    );
    expect(dupes.map((d) => `${d.a} ≡ ${d.b} (${d.similarityScore})`)).toEqual([]);
  });

  it("41b · every unresolved-similarity pair is justified by family or is absent", () => {
    // Questionably-similar pairs are only acceptable inside one family
    // (e.g. two women's tracks sharing the shape-frequency contract).
    const unjustified = unresolvedCollisions(recommendableProtocolDNA()).filter((p) => {
      const a = allProtocolDNA().find((d) => d.protocolId === p.a)!;
      const b = allProtocolDNA().find((d) => d.protocolId === p.b)!;
      return a.identity.family !== b.identity.family;
    });
    expect(unjustified.map((d) => `${d.a} ~ ${d.b} (${d.similarityScore})`)).toEqual([]);
  });

  it("42 · Powerbuilding differs from Strength", () => {
    const cmp = compareProtocolStructures("reserve-powerbuilding", "reserve-strength");
    expect(cmp.similarityScore).toBeLessThan(0.8);
    expect(cmp.collisionRisk).not.toBe("high");
    // Powerbuilding carries dedicated hypertrophy days; Strength does not.
    const pb = structuralSignature(allProtocolDNA().find((d) => d.protocolId === "reserve-powerbuilding")!);
    const st = structuralSignature(allProtocolDNA().find((d) => d.protocolId === "reserve-strength")!);
    expect(pb.dayArchetypes).toContain("upper-hypertrophy");
    expect(st.dayArchetypes).not.toContain("upper-hypertrophy");
    expect(pb.phaseSequence).not.toEqual(st.phaseSequence);
  });

  it("43 · Performance Hybrid differs from Tactical Hybrid", () => {
    const cmp = compareProtocolStructures("reserve-athlete-hybrid", "reserve-tactical");
    expect(cmp.similarityScore).toBeLessThan(0.8);
    const tactical = allProtocolDNA().find((d) => d.protocolId === "reserve-tactical")!;
    const perf = allProtocolDNA().find((d) => d.protocolId === "reserve-athlete-hybrid")!;
    expect(tactical.fatigue.impactDemand).toBe("high");
    expect(perf.fatigue.impactDemand).toBe("moderate");
    expect(structuralSignature(tactical).outdoorExposures).toBeGreaterThan(0);
    expect(structuralSignature(perf).outdoorExposures).toBe(0);
  });

  it("44 · Grand Touring differs from Endurance–Physique", () => {
    const cmp = compareProtocolStructures("reserve-grand-touring", "reserve-endurance-physique");
    expect(cmp.similarityScore).toBeLessThan(0.8);
    const gt = allProtocolDNA().find((d) => d.protocolId === "reserve-grand-touring")!;
    const ep = allProtocolDNA().find((d) => d.protocolId === "reserve-endurance-physique")!;
    // Grand Touring leads with physique days (priority 1 lifts); Endurance leads with distance.
    const gtPriority1 = gt.topology.canonicalWeek.filter((d) => !d.recovery && d.priority === 1);
    const epPriority1 = ep.topology.canonicalWeek.filter((d) => !d.recovery && d.priority === 1);
    expect(gtPriority1.every((d) => d.archetype !== "outdoor-distance")).toBe(true);
    expect(epPriority1.every((d) => d.archetype === "outdoor-distance")).toBe(true);
    expect(structuralSignature(ep).outdoorExposures).toBeGreaterThan(structuralSignature(gt).outdoorExposures);
  });

  it("45 · Classic Physique differs from Balanced Hypertrophy", () => {
    const cmp = compareProtocolStructures("classic-physique-build", "12-week-physique");
    expect(cmp.similarityScore).toBeLessThan(0.85);
    expect(cmp.meaningfulDifferences.length).toBeGreaterThan(0);
  });

  it("46 · Weak-Point Specialization keeps a credible base architecture", () => {
    const spec = allProtocolDNA().find((d) => d.protocolId === "reserve-specialization")!;
    const training = spec.topology.canonicalWeek.filter((d) => !d.recovery);
    const priorityDays = training.filter((d) => d.emphasis.includes("priority"));
    const baseDays = training.filter((d) => !d.emphasis.includes("priority"));
    // Priority leads, but the base survives — it is not every day renamed.
    expect(priorityDays.length).toBeGreaterThanOrEqual(2);
    expect(baseDays.length).toBeGreaterThanOrEqual(3);
    // The base still covers lower and upper.
    const baseArchetypes = baseDays.map((d) => d.archetype);
    expect(baseArchetypes).toContain("lower-strength");
    expect(baseArchetypes).toContain("upper-strength");
  });

  it("47 · Home Gym differs through progression rules, not only substitutions", () => {
    const home = allProtocolDNA().find((d) => d.protocolId === "at-home-warrior")!;
    const balanced = allProtocolDNA().find((d) => d.protocolId === "12-week-physique")!;
    expect(home.progression.model).not.toBe(balanced.progression.model);
    expect(home.phases.map((p) => p.id)).not.toEqual(balanced.phases.map((p) => p.id));
    expect(home.progression.model.toLowerCase()).toMatch(/rep|tempo|range|density/);
    expect(home.stimulus.proximityToFailurePolicy).not.toBe(balanced.stimulus.proximityToFailurePolicy);
  });

  it("48 · Fat Loss differs from Contest Preparation", () => {
    const cmp = compareProtocolStructures("ultimate-summer-shred", "championship-physique");
    expect(cmp.similarityScore).toBeLessThan(0.8);
    const fat = allProtocolDNA().find((d) => d.protocolId === "ultimate-summer-shred")!;
    const contest = allProtocolDNA().find((d) => d.protocolId === "championship-physique")!;
    expect(fat.eligibility.minExperience).toBeUndefined();
    expect(contest.eligibility.minExperience).toBe("advanced");
    expect(fat.phases.map((p) => p.id)).not.toEqual(contest.phases.map((p) => p.id));
  });

  it("49 · Recovery Constrained reduces systemic demand", () => {
    const restored = allProtocolDNA().find((d) => d.protocolId === "reserve-restored")!;
    expect(restored.fatigue.systemicDemand).toBe("low");
    expect(restored.fatigue.recoveryDemand).toBe("low");
    const others = recommendableProtocolDNA().filter((d) => d.protocolId !== "reserve-restored");
    const rank = { low: 0, moderate: 1, high: 2, "very-high": 3 } as const;
    const median = others.map((d) => rank[d.fatigue.systemicDemand]).sort((a, b) => a - b)[Math.floor(others.length / 2)];
    expect(rank[restored.fatigue.systemicDemand]).toBeLessThan(median);
  });

  it("50 · Women's Performance is not a renamed lower-body specialization plan", () => {
    const womens = allProtocolDNA().find((d) => d.protocolId === "signature-shape")!;
    const spec = allProtocolDNA().find((d) => d.protocolId === "reserve-specialization")!;
    const cmp = compareProtocolStructures(womens, spec);
    expect(cmp.similarityScore).toBeLessThan(0.8);
    // The women's week covers the upper frame and core, not only lower body.
    const muscles = Object.keys(womens.stimulus.muscleFrequency);
    expect(muscles).toEqual(expect.arrayContaining(["core"]));
    const week = womens.topology.canonicalWeek.filter((d) => !d.recovery);
    const upperDays = week.filter((d) => /back|delt|chest|posture|upper/i.test(d.emphasis.join(" ") + d.title));
    expect(upperDays.length).toBeGreaterThanOrEqual(2);
  });

  it("structural signature ignores ids and display names", () => {
    const gt = allProtocolDNA().find((d) => d.protocolId === "reserve-grand-touring")!;
    const renamed = { ...gt, protocolId: "totally-different-id" };
    const cmp = compareProtocolStructures(gt, renamed);
    expect(cmp.similarityScore).toBe(1);
  });
});
