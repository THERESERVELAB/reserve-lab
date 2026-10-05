import { describe, expect, it } from "vitest";

import {
  reconcileActivity,
  estimateActivityStress,
  focusOverlap,
  type AthleteActivity,
  type PlannedDay,
} from "@/lib/schedule/activity-reconciliation";

/* A Grand Touring-style planned week (Mon…Sun). */
const GT_WEEK: PlannedDay[] = [
  { dayIndex: 0, dayName: "Mon", title: "Outdoor Distance", focusAreas: ["distance", "conditioning", "lower-body"], recovery: false, intent: "conditioning" },
  { dayIndex: 1, dayName: "Tue", title: "Push · Chest · Shoulders · Triceps", focusAreas: ["chest", "delts", "triceps"], recovery: false, intent: "hypertrophy" },
  { dayIndex: 2, dayName: "Wed", title: "Performance Conditioning", focusAreas: ["conditioning", "power", "core"], recovery: false, intent: "conditioning" },
  { dayIndex: 3, dayName: "Thu", title: "Pull · Back · Biceps · Traps", focusAreas: ["back", "biceps", "traps"], recovery: false, intent: "hypertrophy" },
  { dayIndex: 4, dayName: "Fri", title: "Posterior Lower", focusAreas: ["hamstrings", "glutes", "calves"], recovery: false, intent: "strength" },
  { dayIndex: 5, dayName: "Sat", title: "Upper", focusAreas: ["chest", "back", "delts", "arms"], recovery: false, intent: "hypertrophy" },
  { dayIndex: 6, dayName: "Sun", title: "Lower", focusAreas: ["quads", "glutes", "adductors", "calves"], recovery: false, intent: "strength" },
];

/* The exact spec fixture: Friday 5:45 AM lower-body high-intensity studio class. */
const FRIDAY_LOWER_CLASS: AthleteActivity = {
  id: "act-1",
  title: "Lower-Body Group Class",
  source: "athlete-added",
  recurrence: "one-time",
  dayOfWeek: 4, // Fri
  startTime: "05:45",
  durationMinutes: 60,
  location: "studio",
  activityType: "group-fitness",
  focusAreas: ["lower body", "legs"],
  intensity: "high",
  relationship: "reserve-decides",
};

describe("activity reconciliation — Friday lower-body group class (spec fixture)", () => {
  const proposal = reconcileActivity({ activity: FRIDAY_LOWER_CLASS, week: GT_WEEK });

  it("detects significant lower-body overlap with Friday's Posterior Lower", () => {
    expect(proposal.overlapWithPlanned).toBeGreaterThanOrEqual(0.6);
  });

  it("recommends using the class as Friday's lower-body exposure (replace)", () => {
    expect(proposal.resolvedRelationship).toBe("replace");
    expect(proposal.replace.join(" ")).toMatch(/Fri · Posterior Lower/);
    expect(proposal.recommendation.toLowerCase()).toMatch(/lower-body session|friday/);
  });

  it("adjusts the surrounding lower-body days (Sun Lower reduced, Mon distance eased)", () => {
    const reduceText = proposal.reduce.join(" ").toLowerCase();
    expect(reduceText).toMatch(/sun · lower/);
    expect(reduceText).toMatch(/mon · outdoor distance/);
    // High intensity → ~20% reduction language on the lower lift.
    expect(reduceText).toMatch(/~20%/);
  });

  it("preserves the unrelated upper-body sessions (Push / Pull)", () => {
    const preserveText = proposal.preserve.join(" ");
    expect(preserveText).toMatch(/Tue · Push/);
    expect(preserveText).toMatch(/Thu · Pull/);
  });

  it("updates nutrition (early-morning + hydration) and recovery, phase unchanged", () => {
    const nutri = proposal.nutritionChanges.join(" ").toLowerCase();
    expect(nutri).toMatch(/early-morning/);
    expect(nutri).toMatch(/phase is unchanged/);
    expect(proposal.recoveryChanges.join(" ").toLowerCase()).toMatch(/strain|readiness|calf/);
  });

  it("flags high risk and requires athlete confirmation", () => {
    expect(proposal.riskLevel).toBe("high");
    expect(proposal.requiresAthleteConfirmation).toBe(true);
  });

  it("does not rewrite the whole week — only Fri, Sun, Mon are affected", () => {
    expect([...proposal.affectedDays].sort()).toEqual(["Fri", "Mon", "Sun"]);
  });
});

describe("activity reconciliation — relationship inference", () => {
  it("a conditioning-dominant class supplements rather than replaces", () => {
    const spin: AthleteActivity = {
      ...FRIDAY_LOWER_CLASS, id: "act-2", title: "Spin Class",
      activityType: "conditioning", focusAreas: ["conditioning", "cardio"], intensity: "moderate",
    };
    const p = reconcileActivity({ activity: spin, week: GT_WEEK });
    expect(p.resolvedRelationship).toBe("supplement");
    expect(p.preserve.join(" ")).toMatch(/Fri · Posterior Lower/);
  });

  it("distinguishes strength-dominant from conditioning-dominant classes", () => {
    const strengthClass = estimateActivityStress(FRIDAY_LOWER_CLASS);
    const spinClass = estimateActivityStress({ ...FRIDAY_LOWER_CLASS, activityType: "running", focusAreas: ["cardio", "distance"] });
    expect(strengthClass.lowerBody).toBeGreaterThan(strengthClass.cardiovascular);
    expect(spinClass.cardiovascular).toBeGreaterThan(spinClass.lowerBody);
  });

  it("an explicit replace choice is honored", () => {
    const p = reconcileActivity({ activity: { ...FRIDAY_LOWER_CLASS, relationship: "replace" }, week: GT_WEEK });
    expect(p.resolvedRelationship).toBe("replace");
  });
});

describe("activity reconciliation — recurrence", () => {
  it("a one-time low-impact addition on an open day can apply without a hard gate", () => {
    const week: PlannedDay[] = GT_WEEK.map((d) => (d.dayIndex === 2 ? { ...d, title: "Recovery / Mobility", focusAreas: [], recovery: true, intent: "recovery" } : d));
    const mobility: AthleteActivity = {
      id: "act-3", title: "Yoga", source: "athlete-added", recurrence: "one-time",
      dayOfWeek: 2, durationMinutes: 45, location: "studio", activityType: "mobility",
      focusAreas: ["mobility", "core"], intensity: "low", relationship: "supplement",
    };
    const p = reconcileActivity({ activity: mobility, week });
    expect(p.riskLevel).toBe("low");
    expect(p.requiresAthleteConfirmation).toBe(false);
  });

  it("a recurring activity always requires confirmation (it reshapes the week)", () => {
    const p = reconcileActivity({ activity: { ...FRIDAY_LOWER_CLASS, recurrence: "weekly" }, week: GT_WEEK });
    expect(p.requiresAthleteConfirmation).toBe(true);
  });
});

describe("focusOverlap helper", () => {
  it("scores lower-vs-lower high and lower-vs-upper low", () => {
    expect(focusOverlap(["legs", "lower body"], ["hamstrings", "glutes"])).toBeGreaterThanOrEqual(0.6);
    expect(focusOverlap(["legs"], ["chest", "delts"])).toBeLessThan(0.4);
  });
});
