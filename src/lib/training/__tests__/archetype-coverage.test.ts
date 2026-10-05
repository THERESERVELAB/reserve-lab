import { describe, expect, it } from "vitest";

import { ACTIVITY_STACKS } from "../activity-stack";
import { PROTOCOL_BLUEPRINTS, resolveWeeklyBlueprint, type SessionArchetype } from "../split-blueprints";
import { getTemplateForArchetype } from "../workout-templates";

/* Members on a pilates or yoga activity stack, on an aggressive recovery
   preference, or on Hybrid Pilates Shape / Glute Crown / Endurance Physique /
   Prenatal were handed a TRAINING day that resolved to no session at all:
   `zone2`, `waistline`, `pilates` and `yoga` mapped to null in the template
   table while real `day()` entries pointed at them.

   A `rest()` day sets recovery:true and never loads a lifting template, so a
   null archetype there is fine. These tests pin the distinction: every
   non-recovery day Reserve can put in a week must resolve to a real session. */

/** Every archetype any blueprint uses on a real (non-recovery) training day. */
function trainingArchetypes(): Set<SessionArchetype> {
  const used = new Set<SessionArchetype>();
  for (const blueprint of Object.values(PROTOCOL_BLUEPRINTS)) {
    for (const day of blueprint.week) {
      if (!day.recovery) used.add(day.archetype);
    }
  }
  return used;
}

describe("every training day resolves to a real session", () => {
  it("no blueprint's training day resolves to null", () => {
    const empty = [...trainingArchetypes()]
      .filter((a) => a !== "logged")
      .filter((a) => getTemplateForArchetype(a) === null);
    expect(empty).toEqual([]);
  });

  it("the six low-impact archetypes all carry a session", () => {
    for (const archetype of ["zone2", "waistline", "core", "pilates", "yoga", "mobility"] as const) {
      const template = getTemplateForArchetype(archetype);
      expect(template, `${archetype} resolves to no session`).not.toBeNull();
      expect(template!.phases.flatMap((p) => p.movements).length, `${archetype} has no movements`).toBeGreaterThan(0);
    }
  });

  /* activityDayFor injects a pilates/yoga TRAINING day into ANY protocol when
     the stack mentions them — 6 of the 8 stacks. Each injected day must load. */
  it("every activity stack leaves a loadable week on every protocol", () => {
    const empty: string[] = [];
    for (const protocolId of Object.keys(PROTOCOL_BLUEPRINTS)) {
      for (const stack of ACTIVITY_STACKS) {
        const { week } = resolveWeeklyBlueprint({ protocolId, activityStack: stack.key, activitySport: "running" });
        for (const day of week) {
          if (day.recovery || day.archetype === "logged") continue;
          if (getTemplateForArchetype(day.archetype) === null) empty.push(`${protocolId} · ${stack.key} · ${day.title} (${day.archetype})`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  /* Recovery preference "aggressive" swaps a rest day for a zone2 TRAINING day. */
  it("an aggressive recovery preference leaves a loadable week on every protocol", () => {
    const empty: string[] = [];
    for (const protocolId of Object.keys(PROTOCOL_BLUEPRINTS)) {
      const { week } = resolveWeeklyBlueprint({ protocolId, recoveryPreference: "aggressive" });
      for (const day of week) {
        if (day.recovery || day.archetype === "logged") continue;
        if (getTemplateForArchetype(day.archetype) === null) empty.push(`${protocolId} · ${day.title} (${day.archetype})`);
      }
    }
    expect(empty).toEqual([]);
  });
});
