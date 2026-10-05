import { describe, expect, it } from "vitest";

import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { FRIDAY_LOWER_CLASS, fixtureSnapshot } from "@/lib/athlete/fixtures";
import { buildAthleteSnapshot } from "@/lib/athlete/snapshot";
import { generateProgramHorizon, getWeek } from "../generate";
import { applyActivityToHorizon } from "../revise";
import { deriveWeekNutritionDemand, deriveWeekRecoveryDemand } from "../demand";

const NOW = new Date("2026-07-22T08:00:00.000Z");

function build(fixtureId: string, protocolId: string) {
  const snapshot = fixtureSnapshot(fixtureId)!;
  const profile = deriveProgrammingProfile(snapshot);
  const horizon = generateProgramHorizon({
    protocolId, snapshot, profile, totalWeeks: 12, now: NOW, startDate: "2026-07-20",
  })!;
  return { snapshot, profile, horizon };
}

describe("nutrition demand derives from the horizon, not the protocol title", () => {
  it("the same protocol produces different demand in different phases", () => {
    const { snapshot, horizon } = build("grand-touring-with-friday-class", "reserve-grand-touring");
    const early = deriveWeekNutritionDemand(horizon, getWeek(horizon, 1)!, snapshot);
    const hardest = deriveWeekNutritionDemand(horizon, getWeek(horizon, 8)!, snapshot);
    expect(hardest.trainingDayPattern).not.toBe(early.trainingDayPattern);
    expect(hardest.headline).not.toBe(early.headline);
  });

  it("demand accounts for real conditioning volume and session timing", () => {
    const { snapshot, horizon } = build("grand-touring-with-friday-class", "reserve-grand-touring");
    const d = deriveWeekNutritionDemand(horizon, getWeek(horizon, 4)!, snapshot);
    expect(d.cues.join(" ")).toMatch(/conditioning exposure/);
    expect(d.cues.join(" ")).toMatch(/working sets/);
    // This athlete trains at 06:00 — early-session guidance must appear.
    expect(d.cues.join(" ").toLowerCase()).toContain("light and easily digested");
  });

  it("missing intake data produces assumptions rather than invented numbers", () => {
    const { snapshot, horizon } = build("minimal-data", "12-week-physique");
    const d = deriveWeekNutritionDemand(horizon, getWeek(horizon, 1)!, snapshot);
    expect(d.assumptions.length).toBeGreaterThan(0);
    expect(d.assumptions.join(" ")).toMatch(/will not prescribe a number/);
    // No calorie or gram figure is fabricated anywhere in the output.
    const all = [d.headline, d.trainingDayPattern, d.recoveryDayPattern, ...d.cues].join(" ");
    expect(all).not.toMatch(/\d{3,4}\s?(kcal|calories)/i);
    expect(all).not.toMatch(/\d+\s?g protein/i);
  });

  it("a deload week reduces fuel demand", () => {
    const { snapshot, horizon } = build("advanced-physique", "classic-physique-build");
    const deload = horizon.weeks.find((w) => w.status === "deload")!;
    const d = deriveWeekNutritionDemand(horizon, deload, snapshot);
    expect(d.trainingDayPattern.toLowerCase()).toContain("reduced");
  });
});

describe("recovery demand derives from the horizon and real activity", () => {
  it("names the actual fatigue drivers in the week", () => {
    const { snapshot, horizon } = build("grand-touring-with-friday-class", "reserve-grand-touring");
    const r = deriveWeekRecoveryDemand(horizon, getWeek(horizon, 4)!, snapshot);
    expect(r.localFatigue.join(" ")).toMatch(/Lower body is loaded/);
    expect(r.systemicFatigue.join(" ")).toMatch(/training day/);
    expect(r.loadWarnings.join(" ")).toMatch(/distance/i);
  });

  it("flags lower-body interference between lifting and distance", () => {
    const { snapshot, horizon } = build("grand-touring-with-friday-class", "reserve-grand-touring");
    const r = deriveWeekRecoveryDemand(horizon, getWeek(horizon, 4)!, snapshot);
    expect(r.loadWarnings.join(" ")).toMatch(/share the same recovery/);
  });

  it("reflects an added activity after a revision", () => {
    const { snapshot, horizon } = build("grand-touring-with-friday-class", "reserve-grand-touring");
    const applied = applyActivityToHorizon({
      horizon, activity: FRIDAY_LOWER_CLASS, athleteConfirmed: true, now: NOW,
    });
    const week = getWeek(applied.horizon, 4)!;
    const r = deriveWeekRecoveryDemand(applied.horizon, week, snapshot);
    expect(week.status).toBe("revised");
    expect(r.loadWarnings.join(" ")).toMatch(/adjusted|recurring/i);

    const n = deriveWeekNutritionDemand(applied.horizon, week, snapshot);
    expect(n.trainingDayPattern.toLowerCase()).toMatch(/hydration|carbs|protein/);
  });

  it("returns honest unknowns instead of a fabricated recovery score", () => {
    const noRecoveryData = buildAthleteSnapshot({ primaryGoal: "Build muscle", availableDays: 4 });
    const profile = deriveProgrammingProfile(noRecoveryData);
    const horizon = generateProgramHorizon({
      protocolId: "12-week-physique", snapshot: noRecoveryData, profile, totalWeeks: 12, now: NOW,
    })!;
    const r = deriveWeekRecoveryDemand(horizon, getWeek(horizon, 3)!, noRecoveryData);
    expect(r.unknowns.length).toBeGreaterThan(0);
    expect(r.unknowns.join(" ")).toMatch(/not generating one/);
    // No numeric score is invented.
    expect(r.headline).not.toMatch(/\b\d{1,3}\s?\/\s?100\b/);
  });

  it("a deload week carries lower recovery demand than the phase before it", () => {
    const { snapshot, horizon } = build("advanced-physique", "classic-physique-build");
    const deload = horizon.weeks.find((w) => w.status === "deload")!;
    const previous = getWeek(horizon, deload.weekNumber - 1)!;
    const rank = { low: 0, moderate: 1, high: 2, "very-high": 3 } as const;
    expect(rank[deriveWeekRecoveryDemand(horizon, deload, snapshot).demandClass])
      .toBeLessThanOrEqual(rank[deriveWeekRecoveryDemand(horizon, previous, snapshot).demandClass]);
  });
});
