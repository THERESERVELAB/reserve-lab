import { describe, expect, it } from "vitest";

import { fixtureSnapshot } from "@/lib/athlete/fixtures";
import { deriveProgrammingProfile } from "@/lib/athlete/programming-profile";
import { applyMemberSplitToHorizon, resolveActiveProgram } from "@/lib/horizon/active-program";
import { generateProgramHorizon, getWeek } from "@/lib/horizon/generate";
import { getProtocol } from "@/lib/protocol/library";
import { buildArchitectureResolvedWeek, resolveDailyTrainingContext } from "../daily-context";
import { authoredRestDayIndex, memberSplitWeekStructure, splitPreviewWeek } from "../member-split";
import { programKeepsMemberSplit } from "../split-program-fit";
import { SPLIT_ARCHITECTURES } from "../split-architectures";
import { getTemplateForDay } from "../weekly-split";
import { getTemplateForArchetype } from "../workout-templates";

/* A member who picks a split trains that split's days, around the rest day
   they chose. An active program keeps its phase, volume, intensity and
   progression — it no longer overrules the days themselves. */

/* Wednesday 22 July 2026, local noon — week 1 of a program started Monday. */
const NOW = new Date(2026, 6, 22, 12);
const START = new Date(2026, 6, 20, 12);
const NO_CHEST = { active: false, upperChest: false };
const OWNER_WEEK = ["Upper", "Lower", "Recovery", "Push", "Pull", "Legs", "Arm Day"];
const PPLULA_REST_WEDNESDAY = { architecture: SPLIT_ARCHITECTURES.pplula, restDayIndex: 2, musclePriority: [] };

function programHorizon(protocolId = "classic-physique-build") {
  const snapshot = fixtureSnapshot("advanced-physique")!;
  return generateProgramHorizon({
    protocolId,
    snapshot,
    profile: deriveProgrammingProfile(snapshot),
    totalWeeks: 12,
    startDate: "2026-07-20",
    now: START,
  })!;
}

describe("a chosen split sets an active program's days", () => {
  it("the program week follows the split and the rest day; progression stays the program's", () => {
    const horizon = programHorizon();
    const own = resolveActiveProgram(horizon, "program-horizon", NOW)!;
    const split = resolveActiveProgram(horizon, "program-horizon", NOW, undefined, PPLULA_REST_WEDNESDAY)!;

    expect(split.activeWeek.weeklyStructure.map((d) => d.title)).toEqual(OWNER_WEEK);
    // Wednesday is the member's rest day, and the day's demand reads it.
    expect(split.selectedDay.recovery).toBe(true);

    expect(split.currentPhaseName).toBe(own.currentPhaseName);
    expect(split.activeWeek.volumeTarget).toEqual(own.activeWeek.volumeTarget);
    expect(split.activeWeek.intensityTarget).toEqual(own.activeWeek.intensityTarget);
  });

  it("without a chosen split, the program keeps its own week", () => {
    const horizon = programHorizon();
    const own = resolveActiveProgram(horizon, "program-horizon", NOW)!;
    expect(own.activeWeek.weeklyStructure).toEqual(getWeek(horizon, own.currentWeekNumber)!.weeklyStructure);
  });

  it("expresses split days in the program's session types, activities included", () => {
    const hybrid = memberSplitWeekStructure(
      { architecture: SPLIT_ARCHITECTURES["hybrid-bodybuilder"], restDayIndex: 6, musclePriority: [] },
      1,
    );
    expect(hybrid.map((d) => d.archetype)).toEqual([
      "push", "pull", "sprint-power", "legs", "upper-strength", "full-body-athletic", "recovery",
    ]);
    expect(hybrid[2].intent).toBe("conditioning");
    expect(hybrid[6].recovery).toBe(true);

    // Week 1 of the rotation: Legs leads with the front of the legs.
    expect(memberSplitWeekStructure(PPLULA_REST_WEDNESDAY, 1)[5].archetype).toBe("quad-focus");
  });

  it("every surface on the daily context gets the split, not the program's days", () => {
    const horizon = programHorizon();
    const programWeek = resolveActiveProgram(horizon, "program-horizon", NOW)!.activeWeek.weeklyStructure;
    const ctx = resolveDailyTrainingContext({
      now: NOW,
      focus: undefined,
      weakPoints: [],
      protocolName: horizon.protocolName,
      protocolArchitectureName: horizon.protocolName,
      womensActive: false,
      activeHorizonWeek: programWeek,
      splitSystemChosen: true,
      splitSystemKey: "hybrid-bodybuilder",
      splitRestDayIndex: 6,
    });
    expect(ctx.weeklyPlan.map((d) => d.displayTitle)).toEqual(["Push", "Pull", "Track Session", "Legs", "Upper", "Full Body", "Recovery"]);
    expect(ctx.weeklyPlan[2].activity?.key).toBe("track");
    expect(ctx.memberArchitectureActive).toBe(true);
  });
});

describe("program screens show the split's days", () => {
  it("every projected week, planned and revised, carries the split around the rest day", () => {
    const horizon = programHorizon();
    const shown = applyMemberSplitToHorizon(horizon, PPLULA_REST_WEDNESDAY);

    expect(shown.weeks).toHaveLength(horizon.weeks.length);
    for (const week of [...shown.weeks, ...shown.originalWeeks]) {
      expect(week.weeklyStructure.map((d) => d.title)).toEqual(OWNER_WEEK);
    }
    // Legs alternates its lead week to week, as the rail does.
    expect(shown.weeks[0].weeklyStructure[5].archetype).toBe("quad-focus");
    expect(shown.weeks[1].weeklyStructure[5].archetype).toBe("hamstring-glute");
    // Phases, volume and progression stay the program's.
    expect(shown.phases).toEqual(horizon.phases);
    // The block's frequency is the split's six training days, not the program's five.
    expect(horizon.frequency).toBe(5);
    expect(shown.frequency).toBe(6);
    expect(shown.weeks.map((w) => w.volumeTarget)).toEqual(horizon.weeks.map((w) => w.volumeTarget));
  });

  it("matches the week Training resolves", () => {
    const horizon = programHorizon();
    const shown = applyMemberSplitToHorizon(horizon, PPLULA_REST_WEDNESDAY);
    const live = resolveActiveProgram(horizon, "program-horizon", NOW, undefined, PPLULA_REST_WEDNESDAY)!;
    expect(getWeek(shown, live.currentWeekNumber)!.weeklyStructure).toEqual(live.activeWeek.weeklyStructure);
  });

  it("without a chosen split, the horizon is untouched", () => {
    const horizon = programHorizon();
    expect(applyMemberSplitToHorizon(horizon, null)).toBe(horizon);
  });
});

describe("switching programs keeps a chosen split where the split still fits", () => {
  it("physique programs keep it; programs built around a different kind of week replace it", () => {
    for (const id of ["classic-physique-build", "12-week-physique", "lean-bulk-command", "recomp-protocol", "championship-physique"]) {
      expect(programKeepsMemberSplit(getProtocol(id)!), id).toBe(true);
    }
    for (const id of ["reserve-grand-touring", "reserve-endurance-physique", "reserve-restored", "reserve-strength", "reserve-foundation", "at-home-warrior", "glute-ascend"]) {
      expect(programKeepsMemberSplit(getProtocol(id)!), id).toBe(false);
    }
  });
});

describe("the split preview shows the week the member will train", () => {
  it("previews the split around the chosen rest day", () => {
    expect(splitPreviewWeek(PPLULA_REST_WEDNESDAY, { now: NOW }).map((d) => d.sessionName)).toEqual(OWNER_WEEK);
  });

  it("knows which day each split rests on before the member moves it", () => {
    expect(authoredRestDayIndex(SPLIT_ARCHITECTURES.pplula)).toBe(6);
    expect(authoredRestDayIndex(SPLIT_ARCHITECTURES["upper-lower"])).toBe(6);
  });
});

describe("today's workout follows the resolved day, not the weekday", () => {
  it("a Thursday Push day loads Push, a rest day loads nothing, front-led Legs loads the quad session", () => {
    const week = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.pplula, NO_CHEST, 1, { restDayIndex: 2 });
    expect(getTemplateForDay(week[3], "standard")?.splitKey).toBe("push");
    expect(getTemplateForDay(week[2], "standard")).toBeNull();
    expect(getTemplateForDay(week[5], "standard")).toEqual(getTemplateForArchetype("quad-focus"));
  });
});
