import { describe, expect, it } from "vitest";

import {
  WORKOUT_DEMAND_META,
  WORKOUT_DEMAND_ORDER,
  defaultWorkoutDemand,
  gateWorkoutDemand,
  type WorkoutDemandLevel,
} from "../workout-demand";
import { applyWorkoutDemand, getWorkoutTemplateForSplit, type WorkoutTemplate } from "../workout-templates";

/* ════════════════════════════════════════════════════════════════════════
   THE TIER YOU PICK IS THE SESSION YOU GET.

   WORKOUT_DEMAND_META advertised a set multiplier, a rest bias, an exercise
   delta and a technique ceiling. applyWorkoutDemand read none of them — it
   added one set to two roles and stopped. Elite Volume promised "added
   angles" and built 34 sets where High Output built 31.

   These tests hold the meta and the engine together: the numbers in the
   table are the contract, and every tier is checked against its own row
   rather than against a hand-copied expectation.
   ════════════════════════════════════════════════════════════════════════ */

const legs = getWorkoutTemplateForSplit("legs")!;

function setsOf(template: WorkoutTemplate): number {
  return template.phases.reduce((sum, p) => sum + p.movements.reduce((s, m) => s + m.sets, 0), 0);
}

function movementsOf(template: WorkoutTemplate): string[] {
  return template.phases.flatMap((p) => p.movements.map((m) => m.name));
}

function built(level: WorkoutDemandLevel): WorkoutTemplate {
  return applyWorkoutDemand(legs, level);
}

describe("the demand tiers deliver what they advertise", () => {
  it("has a real session to scale in the first place", () => {
    expect(legs).toBeTruthy();
    expect(setsOf(legs)).toBeGreaterThan(20);
  });

  it("orders strictly by depth — each tier is more work than the one below", () => {
    const sets = WORKOUT_DEMAND_ORDER.map((level) => setsOf(built(level)));
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i]).toBeGreaterThan(sets[i - 1]);
    }
  });

  it("leaves High Output as the authored baseline", () => {
    expect(setsOf(built("high-output"))).toBe(setsOf(legs));
    expect(movementsOf(built("high-output"))).toEqual(movementsOf(legs));
  });

  it("scales working sets by the multiplier in the table", () => {
    /* Measured on the movements the authored session already had — the added
       angles are a separate promise, checked below, and folding them in here
       would hide the multiplier rather than test it. Rounding on small set
       counts keeps this a band, but a 1.25 tier landing near 1.0 is the old
       bug and this band excludes it. */
    const authored = new Map(
      legs.phases.flatMap((p) => p.movements).map((m) => [m.name, m.sets] as const),
    );
    for (const level of WORKOUT_DEMAND_ORDER) {
      const target = WORKOUT_DEMAND_META[level].setMultiplier;
      const shared = built(level)
        .phases.flatMap((p) => p.movements)
        .filter((m) => authored.has(m.name) && m.role !== "primary");
      expect(shared.length).toBeGreaterThan(3);
      const ratio =
        shared.reduce((s, m) => s + m.sets, 0) / shared.reduce((s, m) => s + authored.get(m.name)!, 0);
      expect(Math.abs(ratio - target)).toBeLessThan(0.15);
    }
  });

  it("adds the angles it names, from the split's own pool, without duplicating", () => {
    for (const level of WORKOUT_DEMAND_ORDER) {
      const delta = WORKOUT_DEMAND_META[level].exerciseDelta;
      const names = movementsOf(built(level));
      expect(new Set(names).size).toBe(names.length);
      if (delta > 0) expect(names.length).toBe(movementsOf(legs).length + delta);
      if (delta < 0) expect(names.length).toBeLessThan(movementsOf(legs).length);
    }
  });

  it("compresses rest when it says compressed and extends it when it says full", () => {
    const restOf = (t: WorkoutTemplate) => t.phases[0].movements[0].rest;
    expect(restOf(built("high-output"))).toBe(restOf(legs));
    expect(restOf(built("precision"))).not.toBe(restOf(legs));
    expect(restOf(built("elite-volume"))).not.toBe(restOf(legs));
  });

  it("never carries more intensity techniques than the tier allows", () => {
    for (const level of WORKOUT_DEMAND_ORDER) {
      const carried = built(level)
        .phases.flatMap((p) => p.movements)
        .filter((m) => m.finishingTechnique).length;
      expect(carried).toBeLessThanOrEqual(WORKOUT_DEMAND_META[level].intensityTechniques);
    }
    /* Precision means immaculate essentials — no drop-sets, ever. */
    expect(built("precision").phases.flatMap((p) => p.movements).some((m) => m.finishingTechnique)).toBe(false);
  });

  it("re-times the session it just rebuilt", () => {
    /* The estimate is the number the hero prints. Demand ran last and never
       touched it, so a 45-set session advertised the 31-set session's 76
       minutes while the horizon underneath laid it out across 129.

       Note what this does NOT assert: that Precision is the shortest. It
       extends rest by design, so fewer, cleaner sets can still take as long.
       The claim is only that the number follows the session. */
    const deeper = ["elite-volume", "contest-prep"] as const;
    for (const level of deeper) {
      expect(built(level).estimatedDurationMin).toBeGreaterThan(built("high-output").estimatedDurationMin);
    }
    expect(built("contest-prep").estimatedDurationMin).toBeGreaterThan(built("elite-volume").estimatedDurationMin);
    /* And it is the queue's own number, not the authored one carried through. */
    expect(built("precision").estimatedDurationMin).not.toBe(built("high-output").estimatedDurationMin);
  });

  it("keeps the heavy lead intact on the way down", () => {
    const leadSets = (t: WorkoutTemplate) =>
      t.phases.flatMap((p) => p.movements).filter((m) => m.role === "primary").reduce((s, m) => s + m.sets, 0);
    expect(leadSets(built("precision"))).toBe(leadSets(legs));
  });
});

describe("where a member starts", () => {
  it("opens an advanced member on Elite Volume rather than the middle tier", () => {
    expect(defaultWorkoutDemand("advanced")).toBe("elite-volume");
    expect(defaultWorkoutDemand("intermediate")).toBe("high-output");
    expect(defaultWorkoutDemand("beginner")).toBe("precision");
  });

  it("still lets the day pull that default down, with a reason", () => {
    const opened = defaultWorkoutDemand("advanced");
    const tired = gateWorkoutDemand(opened, { trainingAge: "advanced", readiness: 41, activePainFlags: 0, deload: false });
    expect(tired.effective).toBe("high-output");
    expect(tired.limited).toBe(true);
    expect(tired.reason).toBeTruthy();

    const deload = gateWorkoutDemand(opened, { trainingAge: "advanced", readiness: null, activePainFlags: 0, deload: true });
    expect(deload.effective).toBe("precision");

    const sore = gateWorkoutDemand(opened, { trainingAge: "advanced", readiness: null, activePainFlags: 1, deload: false });
    expect(sore.effective).toBe("high-output");
  });

  it("does not hand a beginner a deep session by default or by request", () => {
    expect(gateWorkoutDemand(defaultWorkoutDemand("beginner"), {
      trainingAge: "beginner", readiness: 95, activePainFlags: 0, deload: false,
    }).effective).toBe("precision");
    expect(gateWorkoutDemand("contest-prep", {
      trainingAge: "beginner", readiness: 95, activePainFlags: 0, deload: false,
    }).effective).toBe("high-output");
  });
});
