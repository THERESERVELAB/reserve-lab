import { describe, expect, it } from "vitest";

import {
  ARCHETYPE_TEMPLATES,
  allTemplateMovements,
  applyExperienceScaling,
  applyWorkoutDemand,
  getTemplateForArchetype,
} from "../workout-templates";

/* Three defects sat behind "seven of the nine stations should be supersets with
   zero rest":

   1. A pair was cosmetic. Pairing set A1/A2 labels and left the first half with
      its full role rest, so a superset read as "do A1, rest ninety seconds, do
      A2" — which is not a superset.
   2. applyWorkoutDemand's rest bias was dead. It looked for "45s" while every
      authored rest is "m:ss", so the member's chosen session depth never moved
      a single rest value.
   3. Rest was not authorable at all. Every rest came from the role, so a
      fifteen-second circuit could not be written even on purpose. */

/** First number in a rest range, in seconds. */
function restSeconds(rest: string): number {
  const first = rest.split("-")[0]?.trim() ?? "";
  const m = first.match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

describe("a superset has no rest inside it", () => {
  it("the first half of every pair goes straight into its partner", () => {
    for (const [archetype, base] of Object.entries(ARCHETYPE_TEMPLATES)) {
      if (!base) continue;
      const scaled = applyExperienceScaling(base, "advanced");
      for (const m of allTemplateMovements(scaled)) {
        if (/1$/.test(m.superset ?? "")) {
          expect(m.rest, `${archetype} · ${m.name} is paired but still rests`).toBe("0:00");
        }
      }
    }
  });

  it("the second half closes the round on a shortened rest", () => {
    for (const base of Object.values(ARCHETYPE_TEMPLATES)) {
      if (!base) continue;
      const scaled = applyExperienceScaling(base, "advanced");
      for (const m of allTemplateMovements(scaled)) {
        if (/2$/.test(m.superset ?? "")) {
          const secs = restSeconds(m.rest);
          expect(secs).toBeGreaterThanOrEqual(15);
          expect(secs).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it("every pair names its partner on both halves", () => {
    const scaled = applyExperienceScaling(ARCHETYPE_TEMPLATES["glute-pump"]!, "advanced");
    const paired = allTemplateMovements(scaled).filter((m) => m.superset);
    expect(paired.length).toBeGreaterThan(0);
    for (const m of paired) expect(m.supersetPartner, `${m.name} has no named partner`).toBeTruthy();
  });
});

describe("the glute circuit is actually a circuit", () => {
  const pump = ARCHETYPE_TEMPLATES["glute-pump"]!;

  it("runs nine stations", () => {
    expect(allTemplateMovements(pump)).toHaveLength(9);
  });

  it("declares itself a circuit so same-muscle rounds may pair", () => {
    expect(pump.circuitStyle).toBe(true);
  });

  it("rests fifteen seconds everywhere except the one loaded lead", () => {
    for (const m of allTemplateMovements(pump)) {
      if (m.role === "primary") {
        expect(restSeconds(m.rest), "the loaded lead keeps a real rest").toBeGreaterThan(15);
      } else {
        expect(restSeconds(m.rest), `${m.name} is a circuit station`).toBe(15);
      }
    }
  });

  it("pairs the glute stations a non-circuit session would refuse", () => {
    const scaled = applyExperienceScaling(pump, "advanced");
    const paired = allTemplateMovements(scaled).filter((m) => m.superset);
    /* Every station targets the glutes, so the complementary-muscle rule alone
       would have paired none of them. */
    expect(paired.length).toBeGreaterThanOrEqual(4);
  });

  it("carries free-weight stations, not only cables and machines", () => {
    const equipment = allTemplateMovements(pump).map((m) => m.equipment).join(" | ");
    for (const kit of ["Kettlebell", "Dumbbells", "Landmine", "Barbell"]) {
      expect(equipment, `${kit} is missing from the circuit`).toContain(kit);
    }
  });
});

describe("session depth actually moves rest", () => {
  const base = ARCHETYPE_TEMPLATES["glute-strength"]!;
  const lead = (t: typeof base) => allTemplateMovements(t).find((m) => m.role === "primary")!;

  it("precision extends the rest on the lead", () => {
    const before = restSeconds(lead(base).rest);
    const after = restSeconds(lead(applyWorkoutDemand(base, "precision")).rest);
    expect(after).toBeGreaterThan(before);
  });

  it("elite volume compresses it", () => {
    const before = restSeconds(lead(base).rest);
    const after = restSeconds(lead(applyWorkoutDemand(base, "elite-volume")).rest);
    expect(after).toBeLessThan(before);
  });

  it("never stretches a zero rest into a pause", () => {
    const paired = applyExperienceScaling(base, "advanced");
    const deepened = applyWorkoutDemand(paired, "precision");
    for (const m of allTemplateMovements(deepened)) {
      if (/1$/.test(m.superset ?? "")) expect(m.rest).toBe("0:00");
    }
  });
});

describe("the hybrid stations the owner asked for exist", () => {
  const named = (archetype: Parameters<typeof getTemplateForArchetype>[0], movement: string) =>
    allTemplateMovements(getTemplateForArchetype(archetype)!).some((m) => m.name === movement);

  it("sled work covers both the push and the pull", () => {
    expect(named("sprint-power", "Sled Push")).toBe(true);
    expect(named("sprint-power", "Sled Pull")).toBe(true);
    expect(named("full-body-athletic", "Sled Push")).toBe(true);
  });

  it("box jumps lead the power day", () => {
    expect(named("lower-power", "Box Jump")).toBe(true);
  });

  it("the quad day is no longer machines alone", () => {
    const movements = allTemplateMovements(getTemplateForArchetype("quad-focus")!);
    const freeWeight = movements.filter((m) => /Dumbbells|Kettlebell|Landmine|Barbell|Bodyweight/.test(m.equipment));
    expect(freeWeight.length).toBeGreaterThanOrEqual(4);
    expect(movements.some((m) => m.name === "Landmine Squat")).toBe(true);
  });

  it("the hamstring day carries a free-weight hinge and a ballistic close", () => {
    expect(named("hamstring-glute", "Single-Leg Romanian Deadlift")).toBe(true);
    expect(named("hamstring-glute", "Kettlebell Swing")).toBe(true);
  });
});
