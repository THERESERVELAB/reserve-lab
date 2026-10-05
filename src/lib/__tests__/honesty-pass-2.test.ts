import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateDailyMission,
  generateNutritionMission,
  generatePhysiqueCritique,
  generateProjectionReport,
  generateRecoveryDecision,
} from "@/lib/ai/coaching-engine";
import {
  DIGITAL_ATHLETE_UNAVAILABLE,
  NUTRITION_COMMAND_UNAVAILABLE,
  PROGRESSION_UNAVAILABLE,
  RECOVERY_COMMAND_UNAVAILABLE,
} from "@/lib/ai/service-unavailable";
import {
  buildPhysiqueCheckIn,
  generateDigitalAthleteSnapshot,
  generateNutritionCommand,
  generateProgressionSnapshot,
  generateRecoveryCommand,
  generateTodaysCommand,
} from "@/lib/ai/value-engine";
import { FUEL_REFERENCE_BODYWEIGHT_LB } from "@/lib/nutrition/fuel-plan";
import { computeMacroTargets } from "@/lib/nutrition/macro-engine";
import { buildTodaysMealPlan } from "@/lib/nutrition/meal-plan";
import { buildPhysiqueGuidance, measurementTrends, photoCheckInLog } from "@/lib/physique/engine";
import { DEFAULT_PHYSIQUE_COMMAND, type PhysiqueCommandState } from "@/lib/physique/types";
import {
  digitalAthleteSnapshotSchema,
  progressionSnapshotSchema,
  recoveryCommandSchema,
} from "@/lib/schemas/value-engine";
import {
  nutritionMissionSchema,
  physiqueCritiqueSchema,
  projectionReportSchema,
  recoveryDecisionSchema,
} from "@/lib/schemas/ai";
import { womensTrainingStatus } from "@/lib/women/dashboard";

/** Every string anywhere inside a value. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function withDigits(value: unknown): string[] {
  return strings(value).filter((s) => /\d/.test(s));
}

function source(relativeToSrc: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relativeToSrc}`, import.meta.url)), "utf8");
}

describe("AI services invent nothing the member did not send", () => {
  it("makes no recovery decision without readiness", () => {
    const command = generateRecoveryCommand({});
    expect(command.decision).toBeNull();
    expect(withDigits(command)).toEqual([]);
    expect(recoveryCommandSchema.safeParse(command).success).toBe(true);

    const decision = generateRecoveryDecision({});
    expect(decision.decision).toBeNull();
    expect(decision.jointStress).toBeNull();
    expect(decision.cnsStress).toBeNull();
    expect(withDigits(decision)).toEqual([]);
    expect(recoveryDecisionSchema.safeParse(decision).success).toBe(true);

    /* A real score still produces a decision. */
    expect(generateRecoveryCommand({ readinessScore: 50 }).decision).toBe("recover today");
    expect(generateRecoveryDecision({ readinessScore: 90 }).decision).toBe("train hard");
  });

  it("never claims beaten weeks or added reps — no session history reaches the service", () => {
    const empty = generateProgressionSnapshot({});
    expect(empty.beatLastWeek).toBeNull();
    expect(empty.addedReps).toBeNull();
    expect(empty.plateauDetection).toBeNull();
    expect(withDigits(empty)).toEqual([]);
    expect(progressionSnapshotSchema.safeParse(empty).success).toBe(true);

    const withScores = generateProgressionSnapshot({ readinessScore: 90, adherenceScore: 95 });
    expect(withScores.beatLastWeek).toBeNull();
    expect(withScores.addedReps).toBeNull();
    expect(withScores.plateauDetection).toBe("none");
  });

  it("gives no adherence, protein gap or macros without the member's numbers", () => {
    const command = generateNutritionCommand({});
    expect(command.adherenceScore).toBeNull();
    expect(withDigits([command.proteinGap, command.missedMealWarning, command.hydrationGap, command.coachNote])).toEqual([]);

    const known = generateNutritionCommand({ bodyweight: 200, adherenceScore: 71.6 });
    expect(known.adherenceScore).toBe(72);
    expect(known.proteinGap).toContain("220g");
    expect(known.proteinGap).toContain("200 lb");

    const mission = generateNutritionMission({});
    expect(mission.trainingDayMacros).toBeNull();
    expect(mission.restDayMacros).toBeNull();
    expect(mission.adherenceScore).toBeNull();
    expect(nutritionMissionSchema.safeParse(mission).success).toBe(true);
    expect(generateNutritionMission({ bodyweight: 200 }).trainingDayMacros?.proteinG).toBe(220);
  });

  it("reports no completion percent or protein figure in the daily and today's commands", () => {
    const mission = generateDailyMission({});
    expect(mission.completionPercent).toBeNull();
    expect(mission.proteinTarget).not.toMatch(/\d/);

    const today = generateTodaysCommand({});
    expect(today.completionPercent).toBeNull();
    expect(today.recoveryDecision.decision).toBeNull();
    expect(today.nutritionMission.adherenceScore).toBeNull();
    expect(today.nextBestAction).toContain("Log readiness");
    expect(generateTodaysCommand({ adherenceScore: 64 }).completionPercent).toBe(64);
  });

  it("does not score, rank or judge a physique", () => {
    const snapshot = generateDigitalAthleteSnapshot({});
    expect(snapshot.laggingMuscles).toEqual([]);
    expect(snapshot.dominantMuscles).toEqual([]);
    expect(snapshot.recoveryZones).toEqual([]);
    expect(snapshot.symmetryConcerns).toEqual([]);
    expect(snapshot.musclePriorityScore).toEqual([]);
    expect(snapshot.physiqueStatusSummary).not.toMatch(/\d/);
    expect(digitalAthleteSnapshotSchema.safeParse(snapshot).success).toBe(true);

    const critique = generatePhysiqueCritique({});
    expect(critique.symmetryScore).toBeNull();
    expect(critique.weakPoints).toEqual([]);
    expect(critique.dominantBodyParts).toEqual([]);
    expect(critique.visualBottlenecks).toEqual([]);
    expect(critique.coachNote).not.toContain("Tony");
    expect(physiqueCritiqueSchema.safeParse(critique).success).toBe(true);
    expect(generatePhysiqueCritique({ primaryFocus: "Upper chest, calves" }).weakPoints).toEqual(["Upper chest", "calves"]);

    const checkIn = buildPhysiqueCheckIn({ photos: [] });
    expect(checkIn.laggingBodyParts).toEqual([]);
    expect(checkIn.strengths).toEqual([]);
  });

  it("forecasts no body change or adherence, even with a logged weight", () => {
    const report = generateProjectionReport({ bodyweight: 200, adherenceScore: 90 });
    expect(report.snapshots.map((s) => s.week)).toEqual([4, 8, 12]);
    for (const snapshot of report.snapshots) {
      expect(snapshot.estimatedAdherence).toBeNull();
      expect(snapshot.estimatedBodyweight).not.toMatch(/\d/);
    }
    expect(withDigits(report)).toEqual([]);
    expect(projectionReportSchema.safeParse(report).success).toBe(true);
  });
});

describe("AI hook fallbacks carry no sample numbers", () => {
  it("shows only what is missing when a service fails", () => {
    for (const unavailable of [NUTRITION_COMMAND_UNAVAILABLE, PROGRESSION_UNAVAILABLE, DIGITAL_ATHLETE_UNAVAILABLE, RECOVERY_COMMAND_UNAVAILABLE]) {
      expect(withDigits(unavailable)).toEqual([]);
    }
    expect(NUTRITION_COMMAND_UNAVAILABLE.adherenceScore).toBeNull();
    expect(NUTRITION_COMMAND_UNAVAILABLE.oneClickCombos).toEqual([]);
    expect(PROGRESSION_UNAVAILABLE.beatLastWeek).toBeNull();
    expect(PROGRESSION_UNAVAILABLE.addedReps).toBeNull();
    expect(DIGITAL_ATHLETE_UNAVAILABLE.musclePriorityScore).toEqual([]);
    expect(RECOVERY_COMMAND_UNAVAILABLE.decision).toBeNull();
  });

  it("keeps no sample command objects in the hooks", () => {
    /* useTodaysCommand once returned "Batman Chest/Back B", 225g protein and 88% adherence on failure. */
    const todays = source("lib/hooks/useTodaysCommand.ts");
    expect(todays).not.toMatch(/Batman|FALLBACK/);
    expect(todays).toContain("data: null");
    for (const hook of ["useNutritionCommand", "useDigitalAthlete", "useProgression", "useRecoveryCommand"]) {
      expect(source(`lib/hooks/${hook}.ts`)).not.toContain("const FALLBACK");
    }
  });
});

describe("Nutrition macros use the member's weight or say what they assume", () => {
  const base = { goal: "maintenance" as const, dayType: "training" as const, dietStyle: "standard" as const };

  it("discloses the reference weight instead of a silent 190 lb", () => {
    const unknown = computeMacroTargets({ ...base, bodyweightLb: null });
    expect(unknown.basis).toContain(`assumes ${FUEL_REFERENCE_BODYWEIGHT_LB} lb`);
    expect(unknown.proteinG).toBe(FUEL_REFERENCE_BODYWEIGHT_LB);
    /* 0 is how saved prefs mark "not entered". */
    expect(computeMacroTargets({ ...base, bodyweightLb: 0 }).basis).toContain(`assumes ${FUEL_REFERENCE_BODYWEIGHT_LB} lb`);

    const known = computeMacroTargets({ ...base, bodyweightLb: 200 });
    expect(known.basis).toBe("Estimated nutrition target based on member profile.");
    expect(known.proteinG).toBe(200);
  });

  it("carries the basis into the plan NutritionView builds", () => {
    const plan = buildTodaysMealPlan({ ...base, bodyweightLb: null, schedule: { wakeTime: "06:00", sleepTime: "22:00" } });
    expect(plan.totalMacros.basis).toContain(`assumes ${FUEL_REFERENCE_BODYWEIGHT_LB} lb`);
  });

  it("feeds NutritionView the resolved member weight and the member's own session name", () => {
    const view = source("components/views/NutritionView.tsx");
    expect(view).toContain("resolveMemberBodyweight");
    expect(view).not.toContain("useTodaysCommand");
    expect(view).not.toContain("prefs.bodyweightLb;");
  });
});

describe("Physique shows only what the member logged", () => {
  const state: PhysiqueCommandState = {
    ...DEFAULT_PHYSIQUE_COMMAND,
    entries: [
      { id: "b", date: "2026-09-08", bodyWeightLb: 199, measurements: { waist: 33.4, arms: 16 } },
      { id: "a", date: "2026-09-01", bodyWeightLb: 201, measurements: { waist: 34 } },
      { id: "c", date: "2026-09-15", bodyWeightLb: 198, measurements: { waist: 33 } },
    ],
    photoCheckIns: [
      { id: "p1", date: "2026-09-01", poses: ["front-relaxed"], consistencyScore: 80 },
      { id: "p2", date: "2026-09-15", poses: ["side-relaxed"], consistencyScore: 80 },
    ],
  };

  it("builds trends only for sites measured on two dated check-ins", () => {
    const rows = measurementTrends(state);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ site: "waist", firstDate: "2026-09-01", firstIn: 34, latestDate: "2026-09-15", latestIn: 33, deltaIn: -1, entries: 3 });
    expect(measurementTrends(DEFAULT_PHYSIQUE_COMMAND)).toEqual([]);
  });

  it("lists photo check-ins newest first", () => {
    expect(photoCheckInLog(state).map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("reports no adherence signal when the latest check-in logged none", () => {
    expect(buildPhysiqueGuidance(state, new Date("2026-09-15T12:00:00Z")).adherenceSignal).toBeNull();
  });

  it("has no zone scores, symmetry score, body-fat estimate or projection on the page", () => {
    const view = source("components/views/PhysiqueView.tsx");
    for (const invented of ["ZONE_SCORES", "Symmetry Score", "BF%", "+8–12", "Stage-ready", "Expected Outcome", "3 days ago"]) {
      expect(view).not.toContain(invented);
    }
    /* The momentum dial once showed 82 / 64 / 45 / 30 for a word. */
    expect(source("components/views/physique/PhysiqueCommandV2.tsx")).not.toMatch(/momentum === "improving" \? 82/);
  });
});

describe("Training shows a real last set or none", () => {
  it("authors no last-session loads or reps", () => {
    const view = source("components/views/TrainingView.tsx");
    expect(view).not.toMatch(/Last session \d/);
    expect(view).not.toMatch(/Held \d+ lb last session/);
    expect(view).not.toMatch(/lastLoad: \d/);
    expect(view).not.toMatch(/lastReps: \d/);
  });
});

describe("Women's track states only what is true", () => {
  it("reads training status from the resolved day, never a fixed Active", () => {
    expect(womensTrainingStatus(true)).toBe("Session Today");
    expect(womensTrainingStatus(false)).toBe("No Session Today");
    /* The roll-up room that carried this readout is gone — it duplicated the
       four rooms beneath it. The guard follows the phase panels that replaced
       them: nothing there may print a fixed status either. */
    expect(source("components/women/phase-panels.tsx")).not.toContain('value="Active"');
  });

  it("prints no fixed targets and no sample readouts", () => {
    /* The 130 g / 2.8 L / 28 g "reference targets" were never set from the
       member's data. The room that held them is gone; the guard follows the
       nutrition phase panel that replaced it. */
    const nutrition = source("components/women/phase-panels.tsx");
    expect(nutrition).not.toMatch(/proteinTargetG|hydrationTargetMl|fiberTargetG/);
    expect(nutrition).not.toContain('label="Protein Target"');

    const pregnancy = source("components/views/women/PregnancyCommandView.tsx");
    expect(pregnancy).not.toMatch(/value="89%"|value: 89|>12<|>28</);
    expect(source("components/views/women/FertilityCommandView.tsx")).not.toMatch(/value="7\.9h"|value="On Target"|value="Steady"/);
  });
});
