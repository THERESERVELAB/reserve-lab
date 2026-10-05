import { describe, expect, it } from "vitest";

import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { FRIDAY_LOWER_CLASS, fixtureSnapshot } from "@/lib/athlete/fixtures";
import { activateProtocol, getProtocol, type ActiveProtocol } from "@/lib/protocol/library";
import { buildProjectedWeekResolvedWeek } from "@/lib/training/daily-context";
import { buildExplicitFallbackWeek } from "@/lib/training/weekly-split";
import type { SessionMovement } from "@/lib/training/session-movement";
import {
  compareActiveProgramResolutions,
  resolveActiveProgram,
  resolveProgramAuthority,
} from "../active-program";
import {
  deriveDayNutritionDemand,
  deriveDayRecoveryContext,
  deriveWeekNutritionDemand,
  deriveWeekRecoveryDemand,
} from "../demand";
import { generateProgramHorizon, getOriginalWeek, getWeek } from "../generate";
import { applyActivityToHorizon, reviseHorizon } from "../revise";
import {
  applyHorizonWeekTargets,
  freezeHorizonSessionReference,
  trainingPhaseFromHorizon,
} from "../training-adapter";
import type { ProgramHorizon } from "../types";

const NOW = new Date("2026-07-22T12:00:00.000Z");
const START = new Date("2026-07-20T12:00:00.000Z");

function setup(fixtureId = "advanced-physique", protocolId = "classic-physique-build", totalWeeks = 12) {
  const snapshot = fixtureSnapshot(fixtureId)!;
  const profile = deriveProgrammingProfile(snapshot);
  const definition = getProtocol(protocolId)!;
  const activeProtocol = activateProtocol(definition, { durationWeeks: totalWeeks, now: START });
  const horizon = generateProgramHorizon({
    protocolId,
    snapshot,
    profile,
    totalWeeks,
    startDate: activeProtocol.startDate,
    now: START,
  })!;
  return { snapshot, profile, activeProtocol, horizon };
}

function movement(role: SessionMovement["role"], id: string): SessionMovement {
  return {
    id,
    name: id,
    purpose: "Test movement",
    target: "Chest",
    region: "upper",
    sets: role === "primary" ? 4 : 3,
    reps: "8-10",
    suggestedLoad: 0,
    mode: "machine",
    equipmentKind: "machine",
    equipmentName: "Machine",
    setupNote: "",
    rirTargets: ["2 RIR", "2 RIR", "1 RIR"],
    rest: "90 sec",
    restSeconds: 90,
    role,
    cue: "Control the rep.",
    physiqueImpact: "",
    whyLoad: "Baseline load.",
    primaryMuscles: ["Chest"],
    secondaryMuscles: [],
    stabilizers: [],
    education: { whyHere: "", whatToFeel: "", goalConnection: "", commonError: "", stretchFocus: "", contractionFocus: "" },
    substitutions: [],
  };
}

describe("active Program Horizon authority", () => {
  it("resolves a stored Horizon as program-horizon", () => {
    const { snapshot, profile, activeProtocol, horizon } = setup();
    const authority = resolveProgramAuthority({ storedHorizon: horizon, activeProtocol, snapshot, profile, now: NOW });
    expect(authority.source).toBe("program-horizon");
    expect(authority.pendingPersistence).toBeNull();
    expect(authority.resolution?.programId).toBe(horizon.programId);
  });

  it("resolves the calendar week, phase, and selected day from the Horizon", () => {
    const { snapshot, profile, activeProtocol, horizon } = setup();
    const weekEightHorizon = { ...horizon, startDate: "2026-06-01" };
    const matchingProtocol = { ...activeProtocol, startDate: "2026-06-01" };
    const authority = resolveProgramAuthority({ storedHorizon: weekEightHorizon, activeProtocol: matchingProtocol, snapshot, profile, selectedDayIndex: 4, now: NOW });
    expect(authority.resolution?.currentWeekNumber).toBe(8);
    expect(authority.resolution?.currentPhaseId).toBe(getWeek(weekEightHorizon, 8)?.phaseId);
    expect(authority.resolution?.selectedDay).toEqual(getWeek(weekEightHorizon, 8)?.weeklyStructure[4]);
  });

  it("resolves a revised current week while preserving the original projection", () => {
    const { horizon } = setup("advanced-physique", "classic-physique-build");
    const revised = reviseHorizon({ horizon, reason: "Test revision", fromWeek: 1, volumeMultiplier: 0.8, now: NOW }).horizon;
    const resolution = resolveActiveProgram(revised, "program-horizon", NOW, 0)!;
    expect(resolution.status).toBe("revised");
    expect(resolution.revisionIds).toHaveLength(1);
    expect(resolution.activeWeek.volumeTarget.setTargets).not.toEqual(resolution.projectedWeek.volumeTarget.setTargets);
    expect(resolution.projectedWeek).toEqual(getOriginalWeek(horizon, 1));
  });

  it("migrates a legacy active protocol explicitly and deterministically", () => {
    const { snapshot, profile, activeProtocol } = setup();
    const a = resolveProgramAuthority({ storedHorizon: null, activeProtocol, snapshot, profile, now: NOW });
    const b = resolveProgramAuthority({ storedHorizon: null, activeProtocol, snapshot, profile, now: NOW });
    expect(a.source).toBe("legacy-migration");
    expect(a.pendingPersistence?.programId).toBe(a.horizon?.programId);
    expect(b.horizon?.programId).toBe(a.horizon?.programId);
    expect(a.assumptions.join(" ")).toMatch(/migrated/i);
  });

  it("does not create duplicate Horizons after the migration is persisted", () => {
    const { snapshot, profile, activeProtocol } = setup();
    const migration = resolveProgramAuthority({ storedHorizon: null, activeProtocol, snapshot, profile, now: NOW });
    const refresh = resolveProgramAuthority({ storedHorizon: migration.pendingPersistence, activeProtocol, snapshot, profile, now: NOW });
    expect(refresh.source).toBe("program-horizon");
    expect(refresh.horizon?.programId).toBe(migration.horizon?.programId);
    expect(refresh.pendingPersistence).toBeNull();
  });

  it("uses an explicit fallback for an unknown protocol and never Chest / Back", () => {
    const { snapshot, profile, activeProtocol } = setup();
    const unknown = { ...activeProtocol, protocolId: "unknown-protocol" } as ActiveProtocol;
    const authority = resolveProgramAuthority({ storedHorizon: null, activeProtocol: unknown, snapshot, profile, now: NOW });
    expect(authority.source).toBe("explicit-fallback");
    expect(authority.resolution).toBeNull();
    expect(authority.assumptions.join(" ")).not.toMatch(/Chest \/ Back/);
    expect(buildExplicitFallbackWeek(NOW).map((day) => day.sessionName).join(" ")).not.toMatch(/Chest \/ Back/);
  });

  it("rejects a stale Horizon from a previous activation", () => {
    const { snapshot, profile, activeProtocol, horizon } = setup();
    const reactivated = { ...activeProtocol, startDate: "2026-07-21", selectedDate: "2026-07-21" };
    const authority = resolveProgramAuthority({ storedHorizon: horizon, activeProtocol: reactivated, snapshot, profile, now: NOW });
    expect(authority.source).toBe("legacy-migration");
    expect(authority.horizon?.programId).not.toBe(horizon.programId);
  });
});

describe("live training prescription and frozen-session protection", () => {
  it.each([
    ["Grand Touring", "grand-touring-with-friday-class", "reserve-grand-touring"],
    ["Powerbuilding", "powerbuilding", "reserve-powerbuilding"],
    ["Fat Loss", "higher-bodyweight-fat-loss", "ultimate-summer-shred"],
    ["Foundation", "beginner", "reserve-foundation"],
  ])("Week 1 and Week 8 produce materially different %s targets", (_label, fixtureId, protocolId) => {
    const { horizon } = setup(fixtureId, protocolId, 12);
    const week1 = getWeek(horizon, 1)!;
    const week8 = getWeek(horizon, 8)!;
    const queue = [movement("primary", "primary"), movement("volume", "volume")];
    const p1 = applyHorizonWeekTargets(queue, week1, getOriginalWeek(horizon, 1)!);
    const p8 = applyHorizonWeekTargets(queue, week8, getOriginalWeek(horizon, 8)!);
    expect({
      sets: p1.map((entry) => entry.sets),
      effort: p1[0].rirTargets[0],
      primary: p1[0].progressionTarget,
      conditioning: week1.conditioningTarget,
    }).not.toEqual({
      sets: p8.map((entry) => entry.sets),
      effort: p8[0].rirTargets[0],
      primary: p8[0].progressionTarget,
      conditioning: week8.conditioningTarget,
    });
  });

  it("maps the real Horizon phase into the live template progression layer", () => {
    expect(trainingPhaseFromHorizon("foundation")).toBe("foundation");
    expect(trainingPhaseFromHorizon("intensification")).toBe("intensification");
    expect(trainingPhaseFromHorizon("deload")).toBe("peak");
  });

  it("Grand Touring keeps its authored topology", () => {
    const { horizon } = setup("grand-touring-with-friday-class", "reserve-grand-touring");
    const week = getWeek(horizon, 1)!;
    const titles = week.weeklyStructure.map((day) => day.title).join(" ");
    const liveCopy = buildProjectedWeekResolvedWeek(week.weeklyStructure)
      .flatMap((day) => [day.title, day.reason, day.protect])
      .join(" ");
    expect(titles).toMatch(/distance|outdoor/i);
    expect(titles).not.toMatch(/Chest \/ Back A/);
    expect(liveCopy).not.toMatch(/Chest \/ Back/);
  });

  it("freezes complete Horizon provenance and survives JSON refresh", () => {
    const { horizon } = setup();
    const resolution = resolveActiveProgram(horizon, "program-horizon", NOW, 2)!;
    const frozen = freezeHorizonSessionReference(resolution);
    const refreshed = JSON.parse(JSON.stringify(frozen));
    expect(refreshed).toEqual(frozen);
    expect(refreshed.horizonProgramId).toBe(horizon.programId);
    expect(refreshed.horizonWeekNumber).toBe(1);
    expect(refreshed.horizonDayTitle).toBe(horizon.weeks[0].weeklyStructure[2].title);
  });

  it("a later Horizon revision cannot mutate a frozen session", () => {
    const { horizon } = setup();
    const resolution = resolveActiveProgram(horizon, "program-horizon", NOW, 0)!;
    const frozen = freezeHorizonSessionReference(resolution);
    const before = JSON.stringify(frozen);
    const revised = reviseHorizon({ horizon, reason: "Future change", fromWeek: 1, volumeMultiplier: 0.6, now: NOW }).horizon;
    expect(revised.weeks[0].volumeTarget.setTargets).not.toEqual(horizon.weeks[0].volumeTarget.setTargets);
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

describe("cross-module Horizon integrity", () => {
  it("all consumers compare equal on program, week, phase, day, and revision", () => {
    const { horizon } = setup();
    const revised = reviseHorizon({ horizon, reason: "Current revision", fromWeek: 1, volumeMultiplier: 0.9, now: NOW }).horizon;
    const resolution = resolveActiveProgram(revised, "program-horizon", NOW, 3)!;
    const comparison = compareActiveProgramResolutions({
      programHorizon: resolution,
      training: resolution,
      apex: resolution,
      core: resolution,
      mesocycle: resolution,
      nutrition: resolution,
      recovery: resolution,
    });
    expect(comparison.consistent).toBe(true);
    expect(comparison.mismatches).toEqual([]);
  });

  it("detects a consumer that drifts from the active week", () => {
    const { horizon } = setup();
    const resolution = resolveActiveProgram(horizon, "program-horizon", NOW, 0)!;
    const drifted = { ...resolution, currentWeekNumber: resolution.currentWeekNumber + 1 };
    const comparison = compareActiveProgramResolutions({ training: resolution, apex: drifted });
    expect(comparison.consistent).toBe(false);
    expect(comparison.mismatches.join(" ")).toMatch(/currentWeekNumber/);
  });

  it("one-time activity changes only the current week", () => {
    const { horizon } = setup("grand-touring-with-friday-class", "reserve-grand-touring");
    const oneTime = { ...FRIDAY_LOWER_CLASS, recurrence: "one-time" as const };
    const applied = applyActivityToHorizon({ horizon, activity: oneTime, athleteConfirmed: true, now: NOW });
    expect(applied.revision?.affectedWeeks).toEqual([1]);
    expect(getWeek(applied.horizon, 2)).toEqual(getWeek(horizon, 2));
  });

  it("recurring activity revises only uncompleted weeks", () => {
    const { horizon } = setup("grand-touring-with-friday-class", "reserve-grand-touring");
    const started: ProgramHorizon = { ...horizon, startDate: "2026-07-06" };
    const week1 = JSON.stringify(getWeek(started, 1));
    const applied = applyActivityToHorizon({ horizon: started, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW });
    expect(JSON.stringify(getWeek(applied.horizon, 1))).toBe(week1);
    expect(applied.revision?.affectedWeeks.every((week) => week >= 3)).toBe(true);
  });

  it("Nutrition and Recovery derive from the same revised active week", () => {
    const { snapshot, horizon } = setup("grand-touring-with-friday-class", "reserve-grand-touring");
    const applied = applyActivityToHorizon({ horizon, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW });
    const resolution = resolveActiveProgram(applied.horizon, "program-horizon", NOW, 4)!;
    const nutrition = deriveWeekNutritionDemand(applied.horizon, resolution.activeWeek, snapshot);
    const recovery = deriveWeekRecoveryDemand(applied.horizon, resolution.activeWeek, snapshot);
    expect(nutrition.weekNumber).toBe(resolution.currentWeekNumber);
    expect(recovery.weekNumber).toBe(resolution.currentWeekNumber);
    expect(resolution.activeWeek.status).toBe("revised");
    expect(recovery.loadWarnings.join(" ")).toMatch(/adjusted|recurring/i);
  });

  it("future demand revisions do not change completed-week demand", () => {
    const { snapshot, horizon } = setup("advanced-physique", "classic-physique-build");
    const started: ProgramHorizon = { ...horizon, startDate: "2026-07-06" };
    const completedWeek = getWeek(started, 1)!;
    const before = deriveWeekNutritionDemand(started, completedWeek, snapshot);
    const revised = reviseHorizon({ horizon: started, reason: "Future only", fromWeek: 3, conditioningMultiplier: 0.7, now: NOW }).horizon;
    expect(getWeek(revised, 1)).toEqual(completedWeek);
    expect(deriveWeekNutritionDemand(revised, getWeek(revised, 1)!, snapshot)).toEqual(before);
  });

  it("derives distinct demand evidence for every Grand Touring day type", () => {
    const { snapshot, horizon } = setup("grand-touring-with-friday-class", "reserve-grand-touring");
    const applied = applyActivityToHorizon({ horizon, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW });
    const week = getWeek(applied.horizon, 1)!;

    const resistance = deriveDayNutritionDemand(applied.horizon, week, snapshot, 1);
    const hybrid = deriveDayNutritionDemand(applied.horizon, week, snapshot, 2);
    const outdoor = deriveDayNutritionDemand(applied.horizon, week, snapshot, 0);
    const fridayClass = deriveDayNutritionDemand(applied.horizon, week, snapshot, 4);
    const recovery = deriveDayNutritionDemand(applied.horizon, week, snapshot, 6);

    expect(resistance.hydrationPriority).toMatch(/^Moderate:/);
    expect(resistance.conditioningSupport).toMatch(/No separate conditioning/);
    expect(hybrid.hydrationPriority).toMatch(/^Elevated:/);
    expect(hybrid.conditioningSupport).toMatch(/Carbohydrate availability and hydration/);
    expect(outdoor.hydrationPriority).toMatch(/^High:/);
    expect(fridayClass.dayTitle).toMatch(/Friday Lower-Body Group Class/);
    expect(fridayClass.postTrainingSupport).toMatch(/Prioritize/);
    expect(recovery.demandClass).toBe("low");
    expect(recovery.preTrainingSupport).toMatch(/No training window/);

    const outdoorRecovery = deriveDayRecoveryContext(applied.horizon, week, snapshot, 0);
    const classRecovery = deriveDayRecoveryContext(applied.horizon, week, snapshot, 4);
    const recoveryContext = deriveDayRecoveryContext(applied.horizon, week, snapshot, 6);
    expect(outdoorRecovery.impactAccumulation).not.toBeNull();
    expect(classRecovery.lowerBodyInterference).not.toBeNull();
    expect(recoveryContext.localFatigueEmphasis).toEqual(["No local training emphasis is scheduled today."]);
  });
});
