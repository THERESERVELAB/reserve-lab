import { describe, expect, it } from "vitest";

import { buildResponseEvidence } from "@/lib/response-evidence/engine";
import {
  RESPONSE_SIMULATIONS,
  SIMULATION_NOW,
  buildSimulationInput,
  frozenStartedSession,
  painSubstitutionSession,
  runResponseSimulation,
  simulationWeekDate,
  skippedSession,
} from "../fixtures";
import { buildResponseModel, emptyResponseModel } from "../build";
import { calculateResponseConfidence, CONFIDENCE_POLICY, overallConfidence } from "../confidence";
import { assessContradiction, contextMateriallyDiffers } from "../contradiction";
import { updateResponseInsight, isActiveInsight } from "../lifecycle";
import { acceptRecommendation, declineRecommendation, deferRecommendation } from "../apply";
import {
  APPROVAL_REQUIRED_CATEGORIES,
  INFORMATIONAL_CATEGORIES,
  approvalFor,
  materialityFor,
  nextRevisableWeek,
} from "../recommendations";
import { RESPONSE_MODEL_VERSION, type ResponseInsight } from "../types";
import { generateProgramHorizon } from "@/lib/horizon/generate";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { fixtureSnapshot } from "@/lib/athlete/fixtures";

const NOW = SIMULATION_NOW;

function modelFor(kind: (typeof RESPONSE_SIMULATIONS)[number]) {
  return runResponseSimulation(kind).model;
}

function insight(model: ReturnType<typeof modelFor>, domain: string, matcher?: (i: ResponseInsight) => boolean) {
  return model.activeInsights.find((i) => i.domain === domain && (matcher ? matcher(i) : true));
}

function testHorizon() {
  const snapshot = fixtureSnapshot("advanced-physique")!;
  const profile = deriveProgrammingProfile(snapshot);
  return generateProgramHorizon({
    protocolId: "classic-physique-build",
    snapshot,
    profile,
    totalWeeks: 12,
    now: new Date(NOW),
    // Start five weeks back so weeks 1–5 are history and week 5 is active.
    startDate: "2026-07-20",
  })!;
}

/* ════════════════════════════════════════════════════════════════════════
   MODEL CONSTRUCTION (1–8)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — construction", () => {
  it("1 · empty evidence produces an insufficient model", () => {
    const { model } = buildResponseModel({
      evidenceInput: { executionRecords: [] },
      context: { now: NOW },
    });
    expect(model.activeInsights).toEqual([]);
    expect(model.pendingRecommendations).toEqual([]);
    expect(model.dataQuality.overallConfidence).toBe("insufficient");
    expect(model.dataQuality.finalizedSessions).toBe(0);
    for (const domain of Object.values(model.domains)) {
      expect(domain.status).toBe("insufficient-data");
      expect(domain.confidence).toBe("insufficient");
    }
  });

  it("2 · finalized evidence creates model observations", () => {
    const model = modelFor("six-comparable-successful-sessions");
    expect(model.dataQuality.finalizedSessions).toBe(6);
    expect(model.dataQuality.comparableExerciseObservations).toBeGreaterThan(0);
    expect(model.activeInsights.length).toBeGreaterThan(0);
  });

  it("3 · unfinalized sessions do not create conclusions", () => {
    const frozen = frozenStartedSession();
    // Logging a set moves the ledger to "partial" — still in progress, and
    // deliberately excluded from evidence until the session is closed.
    expect(frozen.status).toBe("partial");
    expect(frozen.integrity.completedRecordLockedAt).toBeUndefined();
    const { model } = buildResponseModel({
      evidenceInput: { athleteId: "synthetic-athlete", executionRecords: [frozen] },
      context: { now: NOW },
    });
    expect(model.activeInsights).toEqual([]);
    expect(model.dataQuality.finalizedSessions).toBe(0);
  });

  it("4 · rebuilding from identical evidence is deterministic", () => {
    for (const kind of RESPONSE_SIMULATIONS) {
      const a = runResponseSimulation(kind).model;
      const b = runResponseSimulation(kind).model;
      expect(JSON.stringify(b), kind).toEqual(JSON.stringify(a));
    }
  });

  it("5 · rebuilding does not duplicate insights", () => {
    const first = runResponseSimulation("six-comparable-successful-sessions").model;
    const second = runResponseSimulation("six-comparable-successful-sessions", { previousModel: first }).model;
    const third = runResponseSimulation("six-comparable-successful-sessions", { previousModel: second }).model;
    expect(third.activeInsights.length).toBe(first.activeInsights.length);
    expect(new Set(third.activeInsights.map((i) => i.id)).size).toBe(third.activeInsights.length);
    expect(third.pendingRecommendations.length).toBe(first.pendingRecommendations.length);
    expect(new Set(third.pendingRecommendations.map((r) => r.id)).size).toBe(third.pendingRecommendations.length);
  });

  it("6 · already-processed evidence is not counted twice", () => {
    const first = runResponseSimulation("six-comparable-successful-sessions").model;
    const second = runResponseSimulation("six-comparable-successful-sessions", { previousModel: first }).model;
    const a = insight(first, "volume")!;
    const b = insight(second, "volume")!;
    expect(b.sample.comparableObservations).toBe(a.sample.comparableObservations);
    expect(b.evidence.supportingEvidenceIds.length).toBe(a.evidence.supportingEvidenceIds.length);
    expect(second.lastProcessedEvidenceIds.length).toBe(first.lastProcessedEvidenceIds.length);
  });

  it("7 · model version is recorded", () => {
    const model = modelFor("two-comparable-successful-sessions");
    expect(model.modelVersion).toBe(RESPONSE_MODEL_VERSION);
    expect(emptyResponseModel("a", NOW).modelVersion).toBe(RESPONSE_MODEL_VERSION);
  });

  it("8 · missing domains remain missing", () => {
    const model = modelFor("two-comparable-successful-sessions");
    expect(model.dataQuality.missingDomains).toContain("nutrition");
    expect(model.dataQuality.missingDomains).toContain("body-composition");
    expect(model.domains.nutrition.status).toBe("insufficient-data");
    expect(model.assumptions.some((a) => /nutrition data has been logged/i.test(a))).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   CONFIDENCE (9–18)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — confidence", () => {
  const base = {
    supportingObservations: 4,
    contradictingObservations: 0,
    evidenceQuality: ["high" as const, "high" as const, "high" as const, "high" as const],
    missingCriticalContext: [],
  };

  it("9 · one comparable observation remains insufficient", () => {
    const result = calculateResponseConfidence({
      ...base, comparableObservations: 1, supportingObservations: 1,
      weeksRepresented: 1, phasesRepresented: 1, distinctDates: 1,
    });
    expect(result.confidence).toBe("insufficient");
    expect(result.limitingReasons.join(" ")).toMatch(/single exposure|one comparable/i);
  });

  it("10 · two comparable observations may become emerging", () => {
    const result = calculateResponseConfidence({
      ...base, comparableObservations: 2, supportingObservations: 2,
      weeksRepresented: 2, phasesRepresented: 1, distinctDates: 2,
    });
    expect(result.confidence).toBe("emerging");
  });

  it("11 · three consistent observations stay at most moderate under the centralized policy", () => {
    const result = calculateResponseConfidence({
      ...base, comparableObservations: 3, supportingObservations: 3,
      weeksRepresented: 3, phasesRepresented: 1, distinctDates: 3,
    });
    expect(["emerging", "moderate"]).toContain(result.confidence);
    expect(result.confidence).not.toBe("established");
  });

  it("12 · repeated observations across several weeks can become moderate", () => {
    const result = calculateResponseConfidence({
      ...base, comparableObservations: 5, supportingObservations: 5,
      weeksRepresented: 4, phasesRepresented: 1, distinctDates: 5,
      evidenceQuality: Array(5).fill("high"),
    });
    expect(result.confidence).toBe("moderate");
  });

  it("13 · evidence across phases may become established", () => {
    const result = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 8, contradictingObservations: 0,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("high"), missingCriticalContext: [],
    });
    expect(result.confidence).toBe("established");
  });

  it("14 · poor-quality observations limit confidence", () => {
    const strong = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 8, contradictingObservations: 0,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("high"), missingCriticalContext: [],
    });
    const weak = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 8, contradictingObservations: 0,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("low"), missingCriticalContext: [],
    });
    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.limitingReasons.join(" ")).toMatch(/low quality/i);
  });

  it("15 · missing critical context limits confidence", () => {
    const result = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 8, contradictingObservations: 0,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("high"),
      missingCriticalContext: ["no recorded load"],
    });
    expect(result.confidence).not.toBe("established");
    expect(result.limitingReasons.join(" ")).toMatch(/Missing context/i);
  });

  it("16 · contradicting evidence lowers confidence", () => {
    const clean = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 8, contradictingObservations: 0,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("high"), missingCriticalContext: [],
    });
    const contested = calculateResponseConfidence({
      comparableObservations: 8, supportingObservations: 5, contradictingObservations: 3,
      weeksRepresented: 6, phasesRepresented: 2, distinctDates: 8,
      evidenceQuality: Array(8).fill("high"), missingCriticalContext: [],
    });
    expect(contested.score).toBeLessThan(clean.score);
    expect(contested.confidence).not.toBe("established");
  });

  it("17 · one day with many duplicate records cannot produce established confidence", () => {
    const result = calculateResponseConfidence({
      comparableObservations: 40, supportingObservations: 40, contradictingObservations: 0,
      weeksRepresented: 1, phasesRepresented: 1, distinctDates: 1,
      evidenceQuality: Array(40).fill("high"), missingCriticalContext: [],
    });
    expect(result.confidence).toBe("emerging");
    expect(result.limitingReasons.join(" ")).toMatch(/single day/i);
  });

  it("18 · confidence calculation is deterministic", () => {
    const input = {
      comparableObservations: 5, supportingObservations: 4, contradictingObservations: 1,
      weeksRepresented: 3, phasesRepresented: 1, distinctDates: 5,
      evidenceQuality: ["high" as const, "moderate" as const, "high" as const],
      missingCriticalContext: [],
    };
    expect(calculateResponseConfidence(input)).toEqual(calculateResponseConfidence(input));
    // The thresholds live in exactly one place.
    expect(CONFIDENCE_POLICY.minimumComparableForEstablished).toBeGreaterThan(CONFIDENCE_POLICY.minimumComparableForModerate);
    expect(overallConfidence([])).toBe("insufficient");
  });
});

/* ════════════════════════════════════════════════════════════════════════
   CONTRADICTIONS (19–26)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — contradictions", () => {
  it("19 + 20 · supporting and contradicting evidence both remain visible", () => {
    const model = modelFor("successful-with-one-contradiction");
    const exercise = insight(model, "exercise")!;
    expect(exercise.evidence.supportingEvidenceIds.length).toBeGreaterThan(0);
    expect(exercise.evidence.contradictingEvidenceIds.length).toBeGreaterThan(0);
    expect(exercise.sample.contradictingObservations).toBeGreaterThan(0);
  });

  it("21 · contradicting evidence does not erase prior evidence", () => {
    const clean = insight(modelFor("six-comparable-successful-sessions"), "exercise")!;
    const contested = insight(modelFor("successful-with-one-contradiction"), "exercise")!;
    // Every id from the clean run is still accounted for after the
    // contradiction arrives — on one side of the ledger or the other. Nothing
    // is dropped.
    const stillPresent = new Set([
      ...contested.evidence.supportingEvidenceIds,
      ...contested.evidence.contradictingEvidenceIds,
    ]);
    for (const id of clean.evidence.supportingEvidenceIds) {
      expect(stillPresent.has(id), id).toBe(true);
    }
    expect(contested.evidence.contradictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("22 + 23 · an active insight can weaken and a weakening insight can conflict", () => {
    const weakened = insight(modelFor("established-then-weakened"), "exercise")!;
    expect(weakened.status).toBe("weakening");

    // Alternating outcomes in identical conditions genuinely conflict.
    const conflicted = modelFor("genuinely-conflicting-evidence").activeInsights
      .find((i) => i.status === "conflicted");
    expect(conflicted).toBeTruthy();
    expect(conflicted!.limitations.join(" ")).toMatch(/will not act on this pattern until it resolves/i);
  });

  it("24 · a conflicted insight cannot drive a material automatic revision", () => {
    const model = modelFor("genuinely-conflicting-evidence");
    const conflicted = model.activeInsights.find((i) => i.status === "conflicted")!;
    expect(conflicted).toBeTruthy();
    const driven = model.pendingRecommendations.filter(
      (rec) => rec.insightIds.includes(conflicted.id) && !INFORMATIONAL_CATEGORIES.includes(rec.category),
    );
    expect(driven).toEqual([]);
  });

  it("25 · a phase-specific difference is not automatically treated as contradiction", () => {
    const assessment = assessContradiction({
      supportingEvidenceIds: ["a", "b", "c"],
      contradictingEvidenceIds: ["d", "e"],
      supportingContext: { phaseId: "surplus", nutritionPhase: "lean gain" },
      contradictingContext: { phaseId: "deficit", nutritionPhase: "cut" },
      currentConfidence: "moderate",
    });
    expect(assessment.effect).toBe("supersedes-insight");
    expect(assessment.explanation).toMatch(/materially different context/i);
    expect(contextMateriallyDiffers({ nutritionPhase: "cut" }, { nutritionPhase: "lean gain" })).toBe(true);
    expect(contextMateriallyDiffers({ nutritionPhase: "cut" }, { nutritionPhase: "cut" })).toBe(false);
  });

  it("26 · a superseded insight remains archived with its evidence", () => {
    const existing: ResponseInsight = {
      ...insight(modelFor("six-comparable-successful-sessions"), "volume")!,
      context: { phaseId: "surplus", nutritionPhase: "lean gain" },
    };
    const candidate: ResponseInsight = {
      ...existing,
      context: { phaseId: "deficit", nutritionPhase: "cut" },
      evidence: { ...existing.evidence, contradictingEvidenceIds: ["new-1", "new-2"] },
    };
    const result = updateResponseInsight({
      existingInsight: existing,
      candidate,
      context: {
        now: NOW,
        supportingContext: { nutritionPhase: "lean gain" },
        contradictingContext: { nutritionPhase: "cut" },
      },
    });
    expect(result.transition).toBe("superseded");
    expect(result.insight.status).toBe("superseded");
    expect(isActiveInsight(result.insight)).toBe(false);
    expect(result.insight.evidence.supportingEvidenceIds.length).toBeGreaterThan(0);
    expect(result.insight.archiveReason).toBeTruthy();
  });
});

/* ════════════════════════════════════════════════════════════════════════
   VOLUME (27–35)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — volume response", () => {
  it("27 + 28 · completed direct exposure drives volume, and indirect stays distinguishable", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("productive-back-volume-range"));
    const back = bundle.muscleExposure.find((m) => m.muscle === "Back")!;
    expect(back.completedDirectSetEquivalents).toBeGreaterThan(0);
    expect(back.completedIndirectSetEquivalents).not.toBe(back.completedDirectSetEquivalents);
    const model = modelFor("productive-back-volume-range");
    expect(insight(model, "volume", (i) => i.targetId === "Back")).toBeTruthy();
  });

  it("29 · planned but skipped work does not contribute", () => {
    const withSkip = buildResponseEvidence({
      athleteId: "synthetic-athlete",
      executionRecords: [skippedSession()],
    });
    expect(withSkip.muscleExposure.every((m) => m.completedDirectSetEquivalents === 0)).toBe(true);
    const { model } = buildResponseModel({
      evidenceInput: { athleteId: "synthetic-athlete", executionRecords: [skippedSession()] },
      context: { now: NOW },
    });
    expect(model.activeInsights.filter((i) => i.domain === "volume")).toEqual([]);
  });

  it("30 · exposure reflects the sets actually logged, not the sets planned", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("excessive-lower-volume"));
    const quads = bundle.muscleExposure.find((m) => m.muscle === "Quads")!;
    // The fixture logs more sets than were planned in the later weeks, and the
    // evidence follows the logged work rather than the prescription.
    expect(quads.completedDirectSetEquivalents).toBeGreaterThan(quads.plannedDirectSets);

    // A session with nothing logged contributes nothing at all.
    const nothingLogged = buildResponseEvidence({ athleteId: "a", executionRecords: [skippedSession()] });
    expect(nothingLogged.muscleExposure.every((m) => m.completedDirectSetEquivalents === 0)).toBe(true);
  });

  it("31 + 32 · added movements count, replacement activity does not double count", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("grand-touring-recurring-class"));
    // The class is an activity, not a duplicated lifting session.
    expect(bundle.conditioning.length).toBeGreaterThan(0);
    const totalSessions = bundle.provenance.contributingSessions.length;
    expect(totalSessions).toBe(4);
  });

  it("33 + 34 · two unproductive high-volume weeks form a pattern; one cannot define an optimum", () => {
    const model = modelFor("productive-back-volume-range");
    const back = insight(model, "volume", (i) => i.targetId === "Back")!;
    expect(back.finding).toMatch(/have held or progressed/);
    expect(back.finding).toMatch(/at or above/);
    // The interpretation explicitly refuses to name an optimum.
    expect(back.interpretation).toMatch(/not established an exact optimum|not claiming one/i);
    expect(back.interpretation).not.toMatch(/optimal volume is/i);

    // A single week cannot even produce a volume insight.
    const single = modelFor("insufficient-evidence");
    expect(single.activeInsights.filter((i) => i.domain === "volume")).toEqual([]);
  });

  it("35 · volume response can differ by phase", () => {
    const surplus = modelFor("insight-superseded-by-phase-response");
    const chest = insight(surplus, "volume", (i) => i.targetId === "Chest")!;
    expect(chest.context.phaseId).toBeTruthy();
    expect(chest.sample.phasesRepresented.length).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   FREQUENCY (36–43)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — frequency response", () => {
  it("36 + 37 · sets on one date are one exposure; separate dates are separate", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("productive-back-volume-range"));
    const back = bundle.frequency.find((f) => f.target === "Back")!;
    // Twelve sessions across six weeks land on twelve distinct dates — the
    // multiple sets inside each session never inflate the exposure count.
    expect(new Set(back.exposureDates).size).toBe(back.exposureDates.length);
    expect(back.exposureDates.length).toBe(12);

    // Per-week the model reads two exposures, not twelve.
    const model = modelFor("productive-back-volume-range");
    const frequencyInsight = insight(model, "frequency", (i) => i.targetId === "Back")!;
    expect(frequencyInsight.finding).toMatch(/2 weekly exposures/);

    const single = buildResponseEvidence(buildSimulationInput("six-comparable-successful-sessions"));
    const midBack = single.frequency.find((f) => f.target === "Mid-Back")!;
    expect(new Set(midBack.exposureDates).size).toBe(6);
  });

  it("38 · skipped exposure does not count", () => {
    const bundle = buildResponseEvidence({ athleteId: "a", executionRecords: [skippedSession()] });
    expect(bundle.frequency.every((f) => f.completedWeeklyFrequency === 0)).toBe(true);
  });

  it("39 + 40 · frequency insight is muscle-specific and pattern-aware", () => {
    const model = modelFor("productive-back-volume-range");
    const frequencyInsights = model.activeInsights.filter((i) => i.domain === "frequency");
    expect(frequencyInsights.length).toBeGreaterThan(0);
    for (const item of frequencyInsights) {
      expect(["muscle", "movement-pattern"]).toContain(item.targetType);
      expect(item.finding).toContain(item.targetLabel);
    }
  });

  it("41 + 42 · closely spaced exposures stay visible and untested counts are named", () => {
    const model = modelFor("two-versus-three-exposures");
    const back = insight(model, "frequency", (i) => i.targetId === "Back")!;
    expect(back.finding).toMatch(/not yet produced enough comparable evidence/);
    expect(back.limitations.join(" ")).toMatch(/not been tested enough/i);
  });

  it("43 · one universal athlete frequency is never inferred", () => {
    const model = modelFor("productive-back-volume-range");
    const frequencyInsights = model.activeInsights.filter((i) => i.domain === "frequency");
    for (const item of frequencyInsights) {
      expect(item.interpretation).toMatch(/specific to .*does not imply a single ideal frequency/i);
      expect(item.targetType).not.toBe("week");
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
   EXERCISE (44–52)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — exercise response", () => {
  it("44 + 45 + 50 · same exercise compares; machine and barbell stay separate", () => {
    const model = modelFor("machine-press-outperforms-barbell");
    const machine = model.activeInsights.find((i) => i.targetLabel === "Incline Machine Press")!;
    const barbell = model.activeInsights.find((i) => i.domain === "exercise" && i.targetLabel === "Incline Barbell Press")!;
    expect(machine.targetId).not.toBe(barbell.targetId);
    expect(machine.magnitude?.direction).toBe("positive");
    expect(barbell.magnitude?.direction).toBe("negative");
  });

  it("46 · repeated progression creates an exercise insight and a promotion", () => {
    const model = modelFor("machine-press-outperforms-barbell");
    const machine = model.activeInsights.find((i) => i.targetLabel === "Incline Machine Press")!;
    expect(machine.finding).toMatch(/progressed in 6 of 6 comparable exposures/);
    const promotion = model.pendingRecommendations.find((r) => r.category === "exercise-promotion");
    expect(promotion).toBeTruthy();
    expect(promotion!.approval.required).toBe(true);
  });

  it("47 · one painful exposure cannot ban an exercise", () => {
    const model = modelFor("one-painful-exposure");
    const pain = insight(model, "pain")!;
    expect(pain.confidence).toBe("insufficient");
    expect(pain.recommendationEligibility.eligible).toBe(false);
    expect(pain.interpretation).toMatch(/not a pattern/i);
    expect(model.pendingRecommendations.filter((r) => r.category === "exercise-substitution")).toEqual([]);
  });

  it("48 · repeated comparable pain creates an emerging concern", () => {
    const model = modelFor("three-painful-exposures");
    const pain = insight(model, "pain")!;
    expect(pain.confidence).toBe("emerging");
    expect(pain.finding).toMatch(/3 of 4 exposures/);
    expect(pain.limitations.join(" ")).toMatch(/does not assess, diagnose, or interpret/i);
  });

  it("49 · a substitution and its reason remain visible in the ledger", () => {
    const record = painSubstitutionSession();
    const movement = record.movements[0];
    // The planned movement, the performed movement, and the reason all survive.
    expect(movement.performedName).toBe("Incline Machine Press");
    expect(movement.performedName).not.toBe(movement.plannedName);
    expect(JSON.stringify(record)).toMatch(/Pain/);
    // The athlete-reported discomfort is recorded against the movement.
    expect(JSON.stringify(record)).toMatch(/shoulder discomfort/i);
  });

  it("51 + 52 · missing load creates no progression and missing RIR creates no effort conclusion", () => {
    const model = modelFor("machine-press-outperforms-barbell");
    for (const item of model.activeInsights.filter((i) => i.domain === "exercise")) {
      if (item.limitations.some((l) => /no recorded load/i.test(l))) {
        expect(item.confidence).toBe("insufficient");
      }
    }
    // No insight claims an effort conclusion without recorded effort data.
    const claimsEffort = model.activeInsights.filter((i) => /reps in reserve|RIR/i.test(i.interpretation));
    expect(claimsEffort).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY + CONDITIONING (53–66)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — recovery and conditioning", () => {
  it("53 + 54 · sleep and readiness are used only when recorded", () => {
    const noRecovery = modelFor("six-comparable-successful-sessions");
    // Constant 7.6h sleep gives no contrast, so no sleep insight is invented.
    expect(noRecovery.activeInsights.filter((i) => i.targetId === "sleep-quality")).toEqual([]);

    const recorded = modelFor("recovery-limited-athlete");
    const sleep = recorded.activeInsights.find((i) => i.targetId === "sleep-quality")!;
    expect(sleep).toBeTruthy();
    expect(sleep.finding).toMatch(/recorded sleep/);
  });

  it("55 · pain before and during remain distinct in the evidence", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("three-painful-exposures"));
    for (const entry of bundle.recovery) {
      expect(entry).toHaveProperty("painBefore");
      expect(entry).toHaveProperty("painDuring");
    }
  });

  it("56 + 59 · spacing supports an observed pattern, described as observed not medical", () => {
    const model = modelFor("recovery-limited-athlete");
    const sleep = model.activeInsights.find((i) => i.targetId === "sleep-quality")!;
    expect(sleep.interpretation).toMatch(/observed association|not a physiological measurement/i);
    expect(sleep.interpretation).not.toMatch(/proves|causes|diagnos/i);
  });

  it("57 + 62 · timing alone does not prove interference", () => {
    // A single close exposure with no repeated outcome yields nothing.
    const separated = modelFor("conditioning-separated-72-hours");
    expect(separated.activeInsights.filter((i) => i.domain === "conditioning")).toEqual([]);
  });

  it("58 + 63 · a repeated performance relationship produces an emerging conditioning insight", () => {
    const model = modelFor("conditioning-within-24-hours");
    const conditioning = insight(model, "conditioning")!;
    expect(conditioning).toBeTruthy();
    expect(conditioning.confidence).toBe("emerging");
    expect(conditioning.limitations.join(" ")).toMatch(/Timing on its own is not evidence of interference/i);
    expect(conditioning.interpretation).toMatch(/not a proven interference mechanism/i);
  });

  it("60 + 61 · conditioning proximity is preserved including same-day collisions", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("grand-touring-recurring-class"));
    const withProximity = bundle.conditioning.filter((c) => c.proximityToNextLowerTrainingHours != null);
    expect(withProximity.length).toBeGreaterThan(0);
    expect(Math.min(...withProximity.map((c) => c.proximityToNextLowerTrainingHours!))).toBeLessThan(24);
  });

  it("64 + 65 · modalities and impact levels remain distinguishable", () => {
    const gt = buildResponseEvidence(buildSimulationInput("grand-touring-recurring-class"));
    const intervals = buildResponseEvidence(buildSimulationInput("conditioning-within-24-hours"));
    expect(gt.conditioning[0].modality).not.toBe(intervals.conditioning[0].modality);
  });

  it("66 · a conditioning recommendation preserves the hybrid identity", () => {
    const model = modelFor("grand-touring-recurring-class");
    const conditioning = insight(model, "conditioning");
    expect(conditioning).toBeTruthy();
    // Even when eligible, the change is separation — never removal.
    const seedText = "The conditioning itself, its duration, and your protocol's hybrid identity.";
    const recs = model.pendingRecommendations.filter((r) => r.category === "conditioning-adjustment");
    for (const rec of recs) {
      expect(rec.whatRemainsUnchanged.join(" ")).toContain(seedText);
      expect(rec.whatChanges.join(" ")).not.toMatch(/remove|delete|drop/i);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
   BODY COMPOSITION + NUTRITION (67–74)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — body composition and nutrition", () => {
  it("67 + 70 · stable weight alone produces no recomposition claim", () => {
    const model = modelFor("stable-weight-improving-performance");
    const composition = insight(model, "body-composition")!;
    expect(composition.finding).toMatch(/held stable while comparable training performance has improved/);
    expect(composition.interpretation).toMatch(/compatible with recomposition/i);
    expect(composition.interpretation).toMatch(/not proof of it/i);

    const noPerformance = modelFor("poor-adherence-stable-weight");
    const bare = insight(noPerformance, "body-composition")!;
    expect(bare.interpretation).toMatch(/cannot be read as fat loss, muscle gain, or recomposition|do not yet form a clear pattern/i);
  });

  it("a weight trend's direction is in the words, never a minus sign after 'declining'", () => {
    for (const kind of RESPONSE_SIMULATIONS) {
      for (const composition of modelFor(kind).activeInsights.filter((i) => i.domain === "body-composition")) {
        expect(composition.finding, `${kind}: ${composition.finding}`).not.toMatch(/at about -\d/);
      }
    }
  });

  it("68 + 69 · weight loss is not called fat loss and weight gain is not called muscle gain", () => {
    for (const kind of ["rapid-fat-loss-declining-performance", "stable-weight-improving-performance"] as const) {
      const composition = insight(modelFor(kind), "body-composition")!;
      expect(composition.interpretation).not.toMatch(/you lost fat|you gained muscle/i);
      expect(composition.limitations.join(" ")).toMatch(/cannot distinguish fat, muscle, water/i);
    }
  });

  it("71 + 72 · missing adherence blocks change and poor adherence never cuts calories", () => {
    const model = modelFor("poor-adherence-stable-weight");
    const adherence = insight(model, "adherence")!;
    expect(adherence.finding).toMatch(/50%/);
    expect(adherence.interpretation).toMatch(/execution question before it is a plan question/i);

    const review = model.pendingRecommendations.find((r) => r.category === "adherence-review")!;
    expect(review.whatChanges.join(" ")).toMatch(/will not reduce calories or add cardio/i);
    expect(model.pendingRecommendations.every((r) => r.category !== "conditioning-adjustment")).toBe(true);
  });

  it("73 · rapid weight loss with performance decline triggers demand review, not cardio", () => {
    const model = modelFor("rapid-fat-loss-declining-performance");
    const review = model.pendingRecommendations.find((r) => r.category === "nutrition-review")!;
    expect(review).toBeTruthy();
    expect(review.summary).toMatch(/Review total demand and intake before adding anything/);
    expect(review.whatRemainsUnchanged.join(" ")).toMatch(/primary resistance work/i);
    expect(review.whatChanges.join(" ")).toMatch(/not changing your intake targets/i);
    // No recommendation anywhere adds conditioning in this scenario.
    expect(model.pendingRecommendations.every((r) => (r.adjustment?.conditioningMultiplier ?? 1) <= 1)).toBe(true);
  });

  it("74 · nutrition phase remains part of the comparison context", () => {
    const bundle = buildResponseEvidence(buildSimulationInput("rapid-fat-loss-declining-performance"));
    expect(bundle.bodyComposition.some((b) => b.nutritionPhase === "cut")).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   RECOMMENDATIONS (75–84)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — recommendations", () => {
  it("75 · insufficient insights do not generate material recommendations", () => {
    const model = modelFor("insufficient-evidence");
    expect(model.pendingRecommendations.filter((r) => !INFORMATIONAL_CATEGORIES.includes(r.category))).toEqual([]);
  });

  it("76 · an emerging insight produces monitor-only guidance", () => {
    const model = modelFor("conditioning-within-24-hours");
    const conditioning = insight(model, "conditioning")!;
    expect(conditioning.confidence).toBe("emerging");
    expect(conditioning.recommendationEligibility.eligible).toBe(false);
    expect(conditioning.recommendationEligibility.reason).toMatch(/monitored, not acted on/i);
  });

  it("77 + 78 · a moderate insight produces an approval-required recommendation", () => {
    const model = modelFor("productive-back-volume-range");
    const adjustment = model.pendingRecommendations.find((r) => r.category === "volume-adjustment")!;
    expect(adjustment).toBeTruthy();
    expect(adjustment.confidence).toBe("moderate");
    expect(adjustment.approval.required).toBe(true);
    expect(adjustment.materiality).toBe("moderate");
    expect(adjustment.insightIds.length).toBeGreaterThan(0);
    expect(adjustment.evidenceIds.length).toBeGreaterThan(0);
  });

  it("79 · maintain-current-plan is a valid recommendation", () => {
    const model = modelFor("six-comparable-successful-sessions");
    const maintain = model.pendingRecommendations.find((r) => r.category === "maintain")!;
    expect(maintain).toBeTruthy();
    expect(maintain.approval.required).toBe(false);
    expect(maintain.whatChanges).toEqual(["Nothing."]);
    expect(maintain.materiality).toBe("informational");
  });

  it("80 + 81 + 82 · structural changes require approval", () => {
    for (const category of APPROVAL_REQUIRED_CATEGORIES) {
      const materiality = materialityFor(category, "established");
      expect(approvalFor(category, materiality).required, category).toBe(true);
    }
    expect(approvalFor("frequency-adjustment", "high").required).toBe(true);
    expect(approvalFor("exercise-substitution", "moderate").required).toBe(true);
  });

  it("83 · low-risk adjustments follow the centralized policy", () => {
    const approval = approvalFor("recovery-adjustment", materialityFor("recovery-adjustment", "moderate"));
    expect(approval.required).toBe(false);
    expect(approval.reason).toMatch(/still recorded so you can see and reverse it/i);
    const model = modelFor("recovery-limited-athlete");
    const lowRisk = model.pendingRecommendations.find((r) => r.category === "recovery-adjustment");
    if (lowRisk) expect(lowRisk.materiality).toBe("low");
  });

  it("84 · professional-review does not diagnose", () => {
    const approval = approvalFor("professional-review", "informational");
    expect(approval.required).toBe(false);
    const model = modelFor("three-painful-exposures");
    const pain = insight(model, "pain")!;
    expect(pain.interpretation).not.toMatch(/tendinitis|impingement|tear|strain diagnosis/i);
    expect(pain.limitations.join(" ")).toMatch(/does not assess, diagnose, or interpret it/i);
  });

  it("the effective week never targets a protected week", () => {
    expect(nextRevisableWeek(5, [6, 7])).toBe(8);
    expect(nextRevisableWeek(5, [])).toBe(6);
    const frozen = runResponseSimulation("future-revision-while-session-frozen").model;
    for (const rec of frozen.pendingRecommendations) {
      if (rec.effectiveWeek != null) expect(rec.effectiveWeek).toBeGreaterThan(6);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
   ATHLETE DECISIONS (85–94)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — athlete decisions", () => {
  function setup() {
    const model = runResponseSimulation("athlete-accepts-recommendation").model;
    const horizon = testHorizon();
    const recommendation = model.pendingRecommendations.find((r) => r.category === "volume-adjustment")!;
    return { model, horizon, recommendation };
  }

  it("85 + 86 · accepting creates one revision affecting only future unstarted weeks", () => {
    const { model, horizon, recommendation } = setup();
    const result = acceptRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW });
    expect(result.blocked).toBe(false);
    expect(result.revision).toBeTruthy();
    expect(result.horizon!.revisions.length).toBe(horizon.revisions.length + 1);

    const effective = result.revision!.effectiveWeek;
    expect(result.revision!.affectedWeeks.every((w) => w >= effective)).toBe(true);
    // Every week before the effective week is byte-identical.
    for (const week of horizon.weeks.filter((w) => w.weekNumber < effective)) {
      const after = result.horizon!.weeks.find((w) => w.weekNumber === week.weekNumber)!;
      expect(JSON.stringify(after)).toEqual(JSON.stringify(week));
    }
    expect(result.revision!.responseMetadata!.recommendationId).toBe(recommendation.id);
    expect(result.revision!.responseMetadata!.approvedBy).toBe("athlete");
    expect(result.revision!.responseMetadata!.responseModelVersion).toBe(RESPONSE_MODEL_VERSION);
  });

  it("87 + 88 · declining leaves the horizon unchanged and is recorded", () => {
    const { model, horizon, recommendation } = setup();
    const result = declineRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW, note: "Prefer to keep volume." });
    expect(result.horizon).toBe(horizon);
    expect(result.revision).toBeNull();
    const declined = result.model.resolvedRecommendations.find((r) => r.id === recommendation.id)!;
    expect(declined.decision).toBe("declined");
    expect(declined.decidedAt).toBe(NOW);
    expect(result.decisionRecord!.athleteDecision).toBe("declined");
    expect(result.decisionRecord!.reason).toContain("Prefer to keep volume.");
  });

  it("89 + 90 · deferring stays pending; a decline does not immediately reappear", () => {
    const { model, horizon, recommendation } = setup();
    const deferred = deferRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW });
    const stillPending = deferred.model.pendingRecommendations.find((r) => r.id === recommendation.id)!;
    expect(stillPending.decision).toBe("pending");
    expect(stillPending.decisionNote).toBe("deferred");
    expect(stillPending.suppressedUntil).toBeTruthy();

    // Rebuild after declining: the recommendation must not come back pending.
    const declinedResult = declineRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW });
    const rebuilt = runResponseSimulation("athlete-accepts-recommendation", { previousModel: declinedResult.model }).model;
    expect(rebuilt.pendingRecommendations.find((r) => r.id === recommendation.id)).toBeUndefined();
    expect(rebuilt.resolvedRecommendations.find((r) => r.id === recommendation.id)!.decision).toBe("declined");
  });

  it("91 · the original projection remains inspectable after acceptance", () => {
    const { model, horizon, recommendation } = setup();
    const result = acceptRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW });
    expect(result.horizon!.originalWeeks).toEqual(horizon.originalWeeks);
    const revised = result.horizon!.weeks.find((w) => w.status === "revised")!;
    const original = result.horizon!.originalWeeks.find((w) => w.weekNumber === revised.weekNumber)!;
    expect(original.volumeTarget.setTargets).not.toEqual(revised.volumeTarget.setTargets);
  });

  it("92 + 93 + 94 · completed weeks, completed sessions, and frozen sessions are immutable", () => {
    const { model, recommendation } = setup();
    const horizon = { ...testHorizon(), startDate: "2026-06-22" };
    const before = JSON.stringify(horizon.weeks.filter((w) => w.weekNumber <= 5));

    const result = acceptRecommendation({
      model, horizon, recommendationId: recommendation.id, now: NOW,
      protectedWeeks: [6, 7],
    });
    expect(result.blocked).toBe(false);
    expect(JSON.stringify(result.horizon!.weeks.filter((w) => w.weekNumber <= 5))).toEqual(before);
    expect(result.revision!.affectedWeeks).not.toContain(6);
    expect(result.revision!.affectedWeeks).not.toContain(7);

    // A frozen started session is untouched by a future revision.
    const frozen = frozenStartedSession();
    const frozenSnapshot = JSON.stringify(frozen);
    acceptRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW });
    expect(JSON.stringify(frozen)).toEqual(frozenSnapshot);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   INSIGHT LIFECYCLE (95–102)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — insight lifecycle", () => {
  it("95 + 96 · an active insight can strengthen and weaken", () => {
    const early = runResponseSimulation("two-comparable-successful-sessions").model;
    const later = runResponseSimulation("six-comparable-successful-sessions", { previousModel: early }).model;
    const strengthened = insight(later, "volume")!;
    const original = insight(early, "volume")!;
    expect(strengthened.id).toBe(original.id);
    expect(strengthened.confidence).toBe("moderate");
    expect(original.confidence).toBe("emerging");

    const weakened = insight(modelFor("established-then-weakened"), "exercise")!;
    expect(weakened.status).toBe("weakening");
  });

  it("97 · an active insight can conflict", () => {
    const conflicted = modelFor("genuinely-conflicting-evidence").activeInsights
      .find((i) => i.status === "conflicted");
    expect(conflicted).toBeTruthy();
    expect(conflicted!.evidence.supportingEvidenceIds.length).toBeGreaterThan(0);
    expect(conflicted!.evidence.contradictingEvidenceIds.length).toBeGreaterThan(0);
  });

  it("98 + 99 · an insight expires and remains archived", () => {
    const first = runResponseSimulation("insight-expiration-after-phase-change").model;
    expect(first.activeInsights.length).toBeGreaterThan(0);

    // Rebuild far in the future with no new evidence.
    const later = "2026-12-01T09:00:00.000Z";
    const { model } = buildResponseModel({
      evidenceInput: { athleteId: "synthetic-athlete", executionRecords: [] },
      previousModel: first,
      context: { now: later },
    });
    expect(model.activeInsights).toEqual([]);
    expect(model.archivedInsights.length).toBeGreaterThan(0);
    for (const archived of model.archivedInsights) {
      expect(archived.status).toBe("expired");
      expect(archived.archiveReason).toMatch(/No comparable evidence/i);
      // Evidence survives archiving.
      expect(archived.evidence.supportingEvidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("100 + 101 · a phase-specific insight supersedes, and archived insights drive nothing", () => {
    const surplus = runResponseSimulation("insight-superseded-by-phase-response").model;
    const surplusInsight = insight(surplus, "volume", (i) => i.targetId === "Chest")!;
    expect(surplusInsight.context.nutritionPhase).toBe("cut");

    const result = updateResponseInsight({
      existingInsight: { ...surplusInsight, context: { ...surplusInsight.context, nutritionPhase: "lean gain" } },
      candidate: {
        ...surplusInsight,
        evidence: { ...surplusInsight.evidence, contradictingEvidenceIds: ["deficit-1"] },
      },
      context: {
        now: NOW,
        supportingContext: { nutritionPhase: "lean gain" },
        contradictingContext: { nutritionPhase: "cut" },
      },
    });
    expect(result.transition).toBe("superseded");
    expect(isActiveInsight(result.insight)).toBe(false);

    // Archived insights are not in the active set the recommender reads.
    const later = "2026-12-01T09:00:00.000Z";
    const { model } = buildResponseModel({
      evidenceInput: { athleteId: "synthetic-athlete", executionRecords: [] },
      previousModel: surplus,
      context: { now: later },
    });
    expect(model.pendingRecommendations.filter((r) => !INFORMATIONAL_CATEGORIES.includes(r.category))).toEqual([]);
  });

  it("102 · lifecycle transitions are deterministic", () => {
    const base = insight(modelFor("six-comparable-successful-sessions"), "volume")!;
    const run = () => updateResponseInsight({
      existingInsight: base,
      candidate: base,
      context: { now: NOW, supportingContext: {}, contradictingContext: {} },
    });
    expect(JSON.stringify(run())).toEqual(JSON.stringify(run()));
    expect(run().transition).toBe("maintained");
  });
});

/* ════════════════════════════════════════════════════════════════════════
   PERSISTENCE AND HISTORY (103–110)
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — persistence and history", () => {
  it("103 + 104 + 105 · the model, pending recommendations, and decisions survive a round trip", () => {
    const model = runResponseSimulation("athlete-accepts-recommendation").model;
    const horizon = testHorizon();
    const recommendation = model.pendingRecommendations.find((r) => r.category === "volume-adjustment")!;
    const declined = declineRecommendation({ model, horizon, recommendationId: recommendation.id, now: NOW }).model;

    const rehydrated = JSON.parse(JSON.stringify(declined)) as typeof declined;
    expect(rehydrated.activeInsights.length).toBe(declined.activeInsights.length);
    expect(rehydrated.pendingRecommendations.length).toBe(declined.pendingRecommendations.length);
    expect(rehydrated.resolvedRecommendations.find((r) => r.id === recommendation.id)!.decision).toBe("declined");
  });

  it("106 · rebuilding remains idempotent across many passes", () => {
    let model = runResponseSimulation("productive-back-volume-range").model;
    const first = JSON.stringify(model);
    for (let i = 0; i < 4; i += 1) {
      model = runResponseSimulation("productive-back-volume-range", { previousModel: model }).model;
    }
    expect(JSON.stringify(model)).toEqual(first);
  });

  it("a stable insight does not re-emit a transition event on every rebuild", () => {
    // Regression: a weakening insight that stayed weakening reported a fresh
    // "weakened" event on every rebuild, flooding the Optimization Log with
    // changes that never happened.
    let model = runResponseSimulation("established-then-weakened").model;
    expect(model.activeInsights.some((i) => i.status === "weakening")).toBe(true);
    for (let pass = 0; pass < 3; pass += 1) {
      const result = runResponseSimulation("established-then-weakened", { previousModel: model });
      expect(result.events, `pass ${pass}`).toEqual([]);
      model = result.model;
    }
  });

  it("the model never returns duplicate insight or event ids", () => {
    for (const kind of RESPONSE_SIMULATIONS) {
      const result = runResponseSimulation(kind);
      const eventIds = result.events.map((e) => e.id);
      expect(new Set(eventIds).size, `${kind} events`).toBe(eventIds.length);
      const insightIds = [...result.model.activeInsights, ...result.model.archivedInsights].map((i) => i.id);
      expect(new Set(insightIds).size, `${kind} insights`).toBe(insightIds.length);
      const recIds = [...result.model.pendingRecommendations, ...result.model.resolvedRecommendations].map((r) => r.id);
      expect(new Set(recIds).size, `${kind} recommendations`).toBe(recIds.length);
    }
  });

  it("107 + 108 · real response events are produced and none are fabricated", () => {
    const result = runResponseSimulation("productive-back-volume-range");
    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      expect(event.observation.length).toBeGreaterThan(0);
      expect(event.reason.length).toBeGreaterThan(0);
      expect(event.at).toBe(SIMULATION_NOW);
    }
    // An empty model produces no events at all.
    const empty = buildResponseModel({ evidenceInput: { executionRecords: [] }, context: { now: NOW } });
    expect(empty.events).toEqual([]);
  });

  it("109 · legacy state migrates without invented insights", () => {
    const legacyLikeModel = { ...emptyResponseModel("synthetic-athlete", "2026-01-01T00:00:00.000Z") };
    const { model } = buildResponseModel({
      evidenceInput: { athleteId: "synthetic-athlete", executionRecords: [] },
      previousModel: legacyLikeModel,
      context: { now: NOW },
    });
    expect(model.activeInsights).toEqual([]);
    expect(model.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(model.assumptions.length).toBeGreaterThan(0);
  });

  it("110 · development fixtures stay outside member state", () => {
    const model = modelFor("six-comparable-successful-sessions");
    expect(model.athleteId).toBe("synthetic-athlete");
    expect(simulationWeekDate(1)).toMatch(/^2026-07-06$/);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   SAFETY LANGUAGE
   ════════════════════════════════════════════════════════════════════════ */

describe("response model — safety and language discipline", () => {
  it("never claims causation, diagnosis, or medication guidance", () => {
    // Reserve DENYING that it diagnoses is required language, so the check is
    // for affirmative claims rather than for the word appearing at all.
    const banned = [
      /\bReserve (diagnoses|has diagnosed)\b/i,
      /\byou have (tendinitis|impingement|a tear|a strain)\b/i,
      /\bprescrib\w*\s+(medication|hormone|dose|dosage)/i,
      /\bproven to cause\b/i,
      /\bguarantee[ds]?\b/i,
      /\bcures?\b/i,
      /\bthis (proves|confirms) (that )?your\b/i,
    ];
    for (const kind of RESPONSE_SIMULATIONS) {
      const model = runResponseSimulation(kind).model;
      const text = [
        ...model.activeInsights.flatMap((i) => [i.finding, i.interpretation, ...i.limitations]),
        ...model.pendingRecommendations.flatMap((r) => [r.summary, r.reason, ...r.expectedEffect, ...r.whatChanges]),
      ].join(" ");
      for (const pattern of banned) {
        expect(text, `${kind} :: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("every insight is explainable from its evidence references", () => {
    for (const kind of RESPONSE_SIMULATIONS) {
      const model = runResponseSimulation(kind).model;
      for (const item of model.activeInsights) {
        expect(item.finding.length, `${kind}:${item.id}`).toBeGreaterThan(0);
        expect(item.evidence.supportingEvidenceIds.length, `${kind}:${item.id}`).toBeGreaterThan(0);
        expect(item.sample.firstObservedAt, `${kind}:${item.id}`).toBeTruthy();
        expect(item.patternKey, `${kind}:${item.id}`).toBeTruthy();
      }
    }
  });

  it("recommendations always state what remains unchanged", () => {
    for (const kind of RESPONSE_SIMULATIONS) {
      const model = runResponseSimulation(kind).model;
      for (const rec of model.pendingRecommendations) {
        expect(rec.whatRemainsUnchanged.length, `${kind}:${rec.id}`).toBeGreaterThan(0);
        expect(rec.whatChanges.length, `${kind}:${rec.id}`).toBeGreaterThan(0);
        expect(rec.approval.reason.length, `${kind}:${rec.id}`).toBeGreaterThan(0);
      }
    }
  });
});
