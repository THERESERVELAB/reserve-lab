import { describe, expect, it } from "vitest";

import { resolveWeeklyBlueprint } from "../split-blueprints";
import { buildExplicitFallbackWeek, buildProtocolWeek, getTodaySplitDay } from "../weekly-split";
import { buildExplicitFallbackResolvedWeek, toApexWeekDays } from "../daily-context";
import type { ProtocolRecoInput } from "@/lib/protocol/library";

function profile(over: Partial<ProtocolRecoInput> & Pick<ProtocolRecoInput, "goal">): ProtocolRecoInput {
  return {
    daysToDeadline: null,
    gymEnvironment: "commercial-standard",
    trainingLevel: "intermediate",
    hasWeakPoints: false,
    womensPath: false,
    trainingDaysPerWeek: 4,
    sessionDurationMin: 60,
    recoveryCapacity: "moderate",
    ...over,
  };
}

const HOME = profile({ goal: "build muscle at home", gymEnvironment: "dumbbell-home", trainingDaysPerWeek: 4 });
const FEMALE = profile({ goal: "glute development and shape", womensPath: true, trainingDaysPerWeek: 5 });
const EXEC = profile({ goal: "stay lean and healthy", trainingDaysPerWeek: 3, sessionDurationMin: 40, recoveryCapacity: "low" });

describe("profile-derived fallback replaces the chest/back default", () => {
  it("a no-protocol member never resolves to the reserve-physique default blueprint", () => {
    const { blueprint } = resolveWeeklyBlueprint({ profileForFallback: HOME });
    expect(blueprint.id).not.toBe("reserve-physique");
  });

  it("a female no-protocol member opens on lower/glute identity, not chest/back", () => {
    const { blueprint, week } = resolveWeeklyBlueprint({ profileForFallback: FEMALE, trainingDaysTarget: 5 });
    expect(["glutes", "lower"]).toContain(blueprint.focusRegion);
    expect(week[0].title.toLowerCase()).not.toContain("chest");
  });

  it("different no-protocol profiles resolve to different architectures", () => {
    const a = resolveWeeklyBlueprint({ profileForFallback: HOME }).blueprint.id;
    const b = resolveWeeklyBlueprint({ profileForFallback: FEMALE }).blueprint.id;
    const c = resolveWeeklyBlueprint({ profileForFallback: EXEC }).blueprint.id;
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
  });

  it("Core Command week (buildProtocolWeek) uses the fallback architecture, not chest/back", () => {
    const week = buildProtocolWeek({ resolve: { profileForFallback: FEMALE, trainingDaysTarget: 5 } });
    expect(week[0].sessionName.toLowerCase()).not.toContain("chest");
  });
});

describe("legacy behaviour preserved", () => {
  it("no resolve context at all yields the canonical Push / Pull / Legs / Arms / Upper / Lower week", () => {
    const week = buildProtocolWeek({});
    expect(week.map((d) => d.sessionName)).toEqual(["Push", "Pull", "Legs", "Arm Day", "Upper", "Lower", "Recovery"]);
  });

  it("an explicit protocol still drives its own blueprint", () => {
    const { blueprint } = resolveWeeklyBlueprint({ protocolId: "glute-crown" });
    expect(blueprint.id).toBe("glute-crown");
  });
});

/* ─── The no-program rail says nothing happened ───────────────────────────── */

describe("a member with no program is never told a session is done", () => {
  /* Wednesday 16 September 2026 — Monday and Tuesday are in the past. */
  const NOW = new Date(2026, 8, 16, 12);

  it("past days read as no session, not Done, and none of them count", () => {
    const week = buildExplicitFallbackWeek(NOW);
    const past = week.filter((d) => d.splitDay < getTodaySplitDay(NOW));
    expect(past.length).toBeGreaterThan(0);
    for (const day of past) {
      expect(day.status, day.day).toBe("none");
    }
    expect(week.filter((d) => d.status === "complete")).toHaveLength(0);
    expect(week.find((d) => d.isToday)?.status).toBe("today");
  });

  it("carries no support stack — there is no session to support", () => {
    for (const day of buildExplicitFallbackWeek(NOW)) {
      expect(day.protocol.sauna, day.day).toBeNull();
      expect(day.protocol.cardio, day.day).toBeFalsy();
      expect(day.protocol.abs, day.day).toBeNull();
    }
  });
});

describe("the no-program week the rooms actually render", () => {
  const NOW = new Date(2026, 8, 16, 12);

  it("carries no Done days and no support stack", () => {
    const week = toApexWeekDays(buildExplicitFallbackResolvedWeek(), NOW);
    expect(week.filter((d) => d.status === "complete")).toHaveLength(0);
    expect(week.filter((d) => d.status === "missed")).toHaveLength(0);
    expect(week.filter((d) => d.status === "none").length).toBe(6);
    for (const day of week) expect(day.protocol.sauna, day.day).toBeNull();
  });
});
