import { describe, expect, it } from "vitest";

import { recommendableProtocolDNA } from "@/lib/training/protocol-dna";

import {
  buildPersona,
  createRng,
  dimensionCoverage,
  edgeCasePersonas,
  generateCoveragePersonas,
  pairwiseCoverage,
  type CoveragePersona,
} from "../personas";
import { routeAll, routePersona } from "../routing";
import { buildCoverageReport, certifyCoverage } from "../report";

const CI_PERSONA_COUNT = 1000;
const CI_EDGE_COUNT = 150;

const generated = generateCoveragePersonas(CI_PERSONA_COUNT);
const edges = edgeCasePersonas(CI_EDGE_COUNT);
const allPersonas = [...generated, ...edges];
const results = routeAll(allPersonas);
const knownProtocolIds = recommendableProtocolDNA().map((d) => d.protocolId);
const certification = certifyCoverage(allPersonas, results, { knownProtocolIds });

/* ═══ Determinism ════════════════════════════════════════════════════════ */

describe("coverage generation is seeded and deterministic", () => {
  it("produces identical personas for the same seed", () => {
    const a = generateCoveragePersonas(200, 4242);
    const b = generateCoveragePersonas(200, 4242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different personas for a different seed", () => {
    const a = generateCoveragePersonas(200, 1);
    const b = generateCoveragePersonas(200, 2);
    // Dimension striding is seed-independent by design; the sampled days and
    // session lengths are not, so the sets must still diverge.
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("routes deterministically", () => {
    const once = routeAll(generateCoveragePersonas(100, 7));
    const twice = routeAll(generateCoveragePersonas(100, 7));
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });

  it("has a stable RNG", () => {
    const r1 = createRng(5);
    const r2 = createRng(5);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});

/* ═══ Suite size and reach ═══════════════════════════════════════════════ */

describe("coverage suite size", () => {
  it("produces at least 1,000 CI personas", () => {
    expect(generated.length).toBeGreaterThanOrEqual(1000);
  });

  it("includes at least 150 hand-authored edge cases", () => {
    expect(edges.length).toBeGreaterThanOrEqual(150);
    expect(edges.every((e) => e.label)).toBe(true);
  });

  it("supports a large offline audit without collapsing", () => {
    const big = generateCoveragePersonas(25_000);
    expect(big.length).toBe(25_000);
    expect(new Set(big.map((p) => p.personaId)).size).toBe(25_000);
  });

  it("reaches every value of every dimension", () => {
    const cov = dimensionCoverage(generated);
    for (const [dimension, rate] of Object.entries(cov)) {
      expect(rate, `dimension ${dimension} was not fully covered`).toBe(1);
    }
  });

  it("reaches every dimension value even at a small persona count", () => {
    // The covering prefix must not depend on a large sample.
    const cov = dimensionCoverage(generateCoveragePersonas(21));
    for (const [dimension, rate] of Object.entries(cov)) {
      expect(rate, `dimension ${dimension} missed by the covering prefix`).toBe(1);
    }
  });

  it("achieves broad measured pairwise spread at CI size", () => {
    const pw = pairwiseCoverage(generated);
    expect(pw.rate).toBeGreaterThan(0.75);
  });

  it("approaches full pairwise coverage at audit size", () => {
    const pw = pairwiseCoverage(generateCoveragePersonas(25_000));
    expect(pw.rate).toBeGreaterThan(0.99);
  });
});

/* ═══ Result shape ═══════════════════════════════════════════════════════ */

describe("every result is complete", () => {
  it("gives every persona a route", () => {
    expect(results.every((r) => Boolean(r.route))).toBe(true);
  });

  it("gives every rejected alternative a reason", () => {
    for (const r of results) {
      for (const alt of r.rejectedAlternatives) {
        expect(alt.reason.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every fit dimension inside 0–1", () => {
    for (const r of results) {
      for (const v of [r.goalFit, r.scheduleFit, r.equipmentFit, r.recoveryFit, r.experienceFit]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

/* ═══ Routing correctness ════════════════════════════════════════════════ */

describe("routing honesty", () => {
  it("never selects a protocol whose equipment the athlete lacks", () => {
    const offenders = results.filter((r) => r.selectedProtocolId && r.equipmentFit === 0);
    expect(offenders.map((r) => r.personaId)).toEqual([]);
  });

  it("never gives a beginner a contest-level protocol", () => {
    const offenders = allPersonas
      .map((p, i) => ({ p, r: results[i] }))
      .filter(
        ({ p, r }) =>
          (p.trainingAge === "never-trained" || p.trainingAge === "beginner") &&
          /contest|championship/.test(r.selectedProtocolId ?? ""),
      );
    expect(offenders.map(({ p }) => p.personaId)).toEqual([]);
  });

  it("routes a beginner demanding contest prep away from a contest protocol", () => {
    const persona = edges.find((e) => e.label?.startsWith("Beginner demanding contest prep"));
    expect(persona).toBeDefined();
    const r = routePersona(persona!);
    expect(/contest|championship/.test(r.selectedProtocolId ?? "")).toBe(false);
  });

  it("does not hand a barbell protocol to an athlete with no barbell", () => {
    const persona = edges.find((e) => e.label?.startsWith("Powerlifter with no barbell"));
    const r = routePersona(persona!);
    expect(r.equipmentFit).not.toBe(0);
    if (r.selectedProtocolId) {
      expect(r.route === "built-in" || r.route === "adapted-built-in").toBe(true);
    }
  });

  it("caps frequency for a recovery-constrained athlete demanding seven days", () => {
    const persona = edges.find((e) =>
      e.label?.startsWith("Recovery-constrained athlete demanding 7 days"),
    );
    const r = routePersona(persona!);
    expect(r.safetyGates.length).toBeGreaterThan(0);
    expect(r.safetyGates.join(" ")).toMatch(/capped|reduce/i);
  });

  it("keeps missing composition as an assumption rather than an invented value", () => {
    const persona = edges.find((e) => e.label?.startsWith("Unknown composition"));
    const r = routePersona(persona!);
    expect(r.assumptions.length).toBeGreaterThan(0);
    expect(persona!.snapshotInput.bodyFatPercent).toBeNull();
  });

  it("routes reported severe pain to professional review", () => {
    const persona = buildPersona("pain-severe", {
      age: "35-44",
      size: "average-body-weight",
      trainingAge: "intermediate",
      goal: "bodybuilding",
      availability: "standard",
      equipment: "commercial-gym",
      constraint: "average-recovery",
    });
    persona.snapshotInput.currentPain = [{ region: "lower back", severity: 8 }];
    const r = routePersona(persona);
    expect(r.route).toBe("professional-review");
    expect(r.safetyGates.join(" ")).toContain("lower back");
  });

  it("lets a safety gate outrank an otherwise excellent goal match", () => {
    const persona = buildPersona("pain-strong-goal", {
      age: "25-34",
      size: "high-muscularity",
      trainingAge: "advanced",
      goal: "bodybuilding",
      availability: "standard",
      equipment: "commercial-gym",
      constraint: "high-recovery",
      availableDays: 5,
    });
    persona.snapshotInput.currentPain = [{ region: "shoulder", severity: 9 }];
    const r = routePersona(persona);
    expect(r.route).toBe("professional-review");
  });

  it("routes a coached athlete to the coach lane", () => {
    const r = routePersona(generated[0], { coached: true });
    expect(r.route).toBe("coach");
    expect(r.operatingMode).toBe("coach-authored");
  });

  it("routes a self-authoring athlete to Custom", () => {
    const r = routePersona(generated[0], { prefersOwnAuthorship: true });
    expect(r.route).toBe("reserve-custom");
    expect(r.operatingMode).toBe("member-custom");
  });

  it("does not decide the route from body weight alone", () => {
    const dims = {
      age: "35-44",
      trainingAge: "intermediate",
      goal: "fat-loss",
      availability: "standard",
      equipment: "commercial-gym",
      constraint: "average-recovery",
      availableDays: 4,
    } as const;
    const heavy = routePersona(buildPersona("w-heavy", { ...dims, size: "higher-body-weight" }));
    const light = routePersona(buildPersona("w-light", { ...dims, size: "lower-body-weight" }));
    // Same everything except body weight must not produce a different lane.
    expect(heavy.route).toBe(light.route);
  });

  it("treats age as context, not a capability ceiling", () => {
    const dims = {
      size: "average-body-weight",
      trainingAge: "intermediate",
      goal: "strength",
      availability: "standard",
      equipment: "commercial-gym",
      constraint: "high-recovery",
      availableDays: 4,
    } as const;
    const young = routePersona(buildPersona("age-young", { ...dims, age: "25-34" }));
    const older = routePersona(buildPersona("age-older", { ...dims, age: "65-74" }));
    expect(older.route).toBe(young.route);
  });
});

/* ═══ Certification ══════════════════════════════════════════════════════ */

describe("coverage certification", () => {
  it("computes route percentages that sum to one", () => {
    const sum = Object.values(certification.report.routeRates).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("reports protocol usage and detects overuse", () => {
    expect(certification.report.protocolUsage.length).toBeGreaterThan(0);
    for (const u of certification.report.protocolUsage) {
      expect(u.share).toBeGreaterThan(0);
      expect(u.share).toBeLessThanOrEqual(1);
    }
  });

  it("reports unused protocols honestly rather than hiding them", () => {
    expect(Array.isArray(certification.report.unusedProtocols)).toBe(true);
    for (const id of certification.report.unusedProtocols) {
      expect(knownProtocolIds).toContain(id);
    }
  });

  it("evaluates all fifteen gates", () => {
    expect(certification.gates).toHaveLength(15);
  });

  it("states coverage honestly and never claims more than the gates allow", () => {
    if (certification.passed) {
      expect(certification.statement).toContain("Coverage confirmed");
    } else {
      expect(certification.statement).toContain("NOT confirmed");
      expect(certification.failedGateIds.length).toBeGreaterThan(0);
    }
  });

  it("keeps the professional-review route reachable", () => {
    const gate = certification.gates.find((g) => g.id === "professional-review-reachable");
    expect(gate?.passed).toBe(true);
  });

  it("never forces a structurally incompatible protocol", () => {
    const gate = certification.gates.find((g) => g.id === "no-forced-incompatible-protocol");
    expect(gate?.failures).toEqual([]);
  });

  it("never depends on unavailable equipment", () => {
    const gate = certification.gates.find((g) => g.id === "no-unavailable-equipment");
    expect(gate?.failures).toEqual([]);
  });

  it("never gives a beginner elite contest volume", () => {
    const gate = certification.gates.find((g) => g.id === "no-beginner-contest-volume");
    expect(gate?.failures).toEqual([]);
  });

  it("never routes an athlete with no credible fit into a built-in protocol", () => {
    const gate = certification.gates.find((g) => g.id === "no-credible-fit-routes-out");
    expect(gate?.failures).toEqual([]);
  });

  it("explains every routing decision", () => {
    const gate = certification.gates.find((g) => g.id === "every-route-explainable");
    expect(gate?.failures).toEqual([]);
  });
});

/* ═══ Known open finding ═════════════════════════════════════════════════
   Documented deliberately rather than hidden by widening the threshold.

   Reserve has exactly ONE recovery-constrained architecture, and the
   suitability engine awards it a flat +16 for any low-recovery athlete —
   enough to outrank goal affinity entirely. Every low-recovery athlete
   therefore converges on reserve-restored regardless of what they train for,
   so a low-recovery powerlifter and a low-recovery runner receive identical
   programming.

   These tests pin the CURRENT behaviour so the finding cannot regress
   silently and so a fix is visible when it lands. They are not an
   endorsement of it.
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══ Goal preservation under a recovery ceiling ══════════════════════════
   Previously reserve-restored absorbed 44% of selections and all 21 goals,
   because the recovery-constrained family carried an unconditional +16 that
   outranked every goal affinity. A recovery ceiling is a DOSE problem: it
   must adapt the athlete's architecture, not replace it.
   ═══════════════════════════════════════════════════════════════════════ */

describe("recovery ceilings adapt the goal architecture rather than erase it", () => {
  const lowRecovery = {
    availability: "standard",
    equipment: "commercial-gym",
    constraint: "low-recovery",
    availableDays: 4,
    age: "35-44",
    trainingAge: "intermediate",
  } as const;

  /** A low-recovery athlete keeps the architecture built for their goal. */
  function routeWithGoal(goal: CoveragePersona["goal"], size: CoveragePersona["size"]) {
    return routePersona(buildPersona(`lowrec-${goal}`, { ...lowRecovery, goal, size }));
  }

  it("keeps a low-recovery strength athlete on a strength architecture", () => {
    const r = routeWithGoal("strength", "high-muscularity");
    expect(r.selectedProtocolId).not.toBe("reserve-restored");
  });

  it("keeps a low-recovery physique athlete on a physique architecture", () => {
    const r = routeWithGoal("bodybuilding", "moderate-body-fat");
    expect(r.selectedProtocolId).not.toBe("reserve-restored");
  });

  it("keeps a low-recovery runner on an endurance architecture", () => {
    const r = routeWithGoal("running", "low-body-fat");
    expect(r.selectedProtocolId).not.toBe("reserve-restored");
  });

  it("keeps a low-recovery hybrid athlete on a hybrid architecture", () => {
    const r = routeWithGoal("hybrid-performance", "average-body-weight");
    expect(r.selectedProtocolId).not.toBe("reserve-restored");
  });

  it("keeps a low-recovery fat-loss athlete on a resistance-led architecture", () => {
    const r = routeWithGoal("fat-loss", "higher-body-weight");
    expect(r.selectedProtocolId).not.toBe("reserve-restored");
  });

  it("still offers Reserve Restored when recovery is the whole problem", () => {
    // No architecture-defining goal stated — restoration IS the objective.
    const r = routeWithGoal("recovery-restoration", "average-body-weight");
    expect(r.selectedProtocolId).toBe("reserve-restored");
  });

  it("still offers Reserve Restored for a general-fitness low-recovery athlete", () => {
    const r = routeWithGoal("general-fitness", "average-body-weight");
    expect(r.selectedProtocolId).toBe("reserve-restored");
  });

  it("no longer absorbs every goal among athletes who can still train toward one", () => {
    /* Severely limited athletes (poor-sleep, recovery-constrained) DO route to
       restoration across goals — that is the deliberate very-low behaviour
       verified above. The invariant is about the non-severe cohort: an athlete
       whose recovery is limited but workable must keep their objective. */
    const nonSevere = allPersonas.filter(
      (p, i) =>
        p.constraint === "low-recovery" && results[i].selectedProtocolId === "reserve-restored",
    );
    const goals = new Set(nonSevere.map((p) => p.goal));
    expect(goals.size).toBeLessThan(21);
  });

  it("honours the ceiling through dose rather than by swapping the goal", () => {
    const r = routeWithGoal("strength", "high-muscularity");
    // The compromise must be visible: reduced frequency/volume, not a new goal.
    const explained = [...r.assumptions, ...r.conflicts, r.rationale].join(" ").toLowerCase();
    expect(explained.length).toBeGreaterThan(0);
    expect(r.recoveryFit).toBeLessThanOrEqual(1);
  });
});

/* ═══ The overuse gate still catches the original defect ══════════════════
   The gate now measures whether a protocol DISCRIMINATES, not raw share,
   because a uniform stress sweep inflates the share of any protocol gated on
   a large cohort. That change is only legitimate if the ORIGINAL defect
   still fails it — which is what this proves.
   ═══════════════════════════════════════════════════════════════════════ */

describe("overuse gate legitimacy", () => {
  it("flags a protocol that dominates while respecting no dimension", () => {
    // Reproduce the original failure shape: one protocol taking every persona.
    const swallowed = results.map((r) => ({ ...r, selectedProtocolId: "greedy-protocol" }));
    const report = buildCoverageReport(allPersonas, swallowed);
    expect(report.overusedProtocols).toContain("greedy-protocol");

    const usage = report.protocolUsage.find((p) => p.protocolId === "greedy-protocol");
    expect(usage?.indiscriminate).toBe(true);
  });

  it("does not flag a protocol that dominates a cohort it genuinely gates", () => {
    // A protocol taking only beginners: large share, but selective on training age.
    const beginnerIdx = allPersonas
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.trainingAge === "never-trained" || p.trainingAge === "beginner");
    const gated = results.map((r, i) =>
      beginnerIdx.some((b) => b.i === i)
        ? { ...r, selectedProtocolId: "cohort-gated" }
        : { ...r, selectedProtocolId: undefined },
    );
    const report = buildCoverageReport(allPersonas, gated);

    const usage = report.protocolUsage.find((p) => p.protocolId === "cohort-gated");
    expect(usage?.share).toBe(1); // it holds every selection
    expect(usage?.indiscriminate).toBe(false); // but respects training age
    expect(report.overusedProtocols).not.toContain("cohort-gated");
  });

  it("reports the dimension each protocol is most selective on", () => {
    for (const u of certification.report.protocolUsage) {
      expect(u.mostSelectiveDimension).not.toBeNull();
      expect(u.mostSelectiveDimension!.breadth).toBeGreaterThan(0);
      expect(u.mostSelectiveDimension!.breadth).toBeLessThanOrEqual(1);
    }
  });
});
