import { describe, expect, it } from "vitest";

import { resolveDailyTrainingContext } from "@/lib/training/daily-context";
import {
  DEFAULT_SPLIT_CUSTOMIZATION,
  localDateKey,
  recordSplitDayEdit,
  weekDateKeys,
} from "@/lib/training/split-customization";

import { buildProgramResolvedWeek } from "../resolved-week";
import type { ProgramDayDefinition, ProgramDaySessionType, ProgramDefinition } from "../types";

/* ════════════════════════════════════════════════════════════════════════
   ONE TUESDAY.

   A program the member authored decided every day of the week, and only the
   cockpit knew: the day was resolved for ONE date inside TrainingView. So the
   rail, Apex and Nutrition rendered the split resolver's week and a single
   screen carried two:

       7-DAY SPLIT   TUE  Pull   TODAY
       hero          CHEST DAY.

   These tests hold the week and the cockpit to the same answer, and hold the
   line that Reserve never substitutes a session for a day the member authored.
   ════════════════════════════════════════════════════════════════════════ */

const TUESDAY = new Date(2026, 8, 29, 12, 0); // 2026-09-29
const WEEK = weekDateKeys(TUESDAY);

const TITLES = ["Upper", "Chest Day", "Rest", "Pull", "Push", "Legs", "Rest"];

function day(i: number, overrides: Partial<ProgramDayDefinition> = {}): ProgramDayDefinition {
  const type: ProgramDaySessionType = i === 2 || i === 6 ? "rest" : "hypertrophy";
  return {
    id: `d${i}`,
    lineageId: `l${i}`,
    programId: "p1",
    programVersion: 1,
    dayIndex: i,
    title: TITLES[i],
    sessionType: type,
    sessionObjective: "",
    primaryTargets: [],
    secondaryTargets: [],
    ownership: "member-created",
    version: 1,
    locked: false,
    preserveFromAiOverwrite: false,
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function program(days: ProgramDayDefinition[] = [0, 1, 2, 3, 4, 5, 6].map((i) => day(i))): ProgramDefinition {
  return {
    id: "p1",
    lineageId: "pl1",
    version: 1,
    name: "My Plan",
    status: "active",
    source: "member",
    operatingMode: "member-managed",
    rotationLengthDays: 7,
    weekAnchor: 0,
    days,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function build(programs: ProgramDefinition[], activeProgramId: string | null = "p1") {
  return buildProgramResolvedWeek({ programs, activeProgramId, assignments: [], overrides: [], weekDates: WEEK });
}

describe("the member's program as a week", () => {
  it("names all seven days from the program, in the program's own words", () => {
    const week = build([program()])!;
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.displayTitle)).toEqual(TITLES);
  });

  it("gives each lifting day the engine key its own title matches", () => {
    const week = build([program()])!;
    expect(week[0].splitKey).toBe("upper");
    expect(week[1].splitKey).toBe("chest");
    expect(week[3].splitKey).toBe("pull");
    expect(week[5].splitKey).toBe("legs");
  });

  it("keeps a title Reserve has no template for, rather than loading something else", () => {
    const week = build([program([...[0, 1, 2, 3, 4, 6].map((i) => day(i)), day(5, { title: "Anthony's Finisher Day" })])])!;
    expect(week[5].displayTitle).toBe("Anthony's Finisher Day");
    expect(week[5].splitKey).toBeNull();
    expect(week[5].recovery).toBe(false);
  });

  it("treats rest and recovery days as rest, with no lifting key", () => {
    const week = build([program()])!;
    for (const i of [2, 6]) {
      expect(week[i].recovery).toBe(true);
      expect(week[i].splitKey).toBe("recovery");
    }
  });

  it("renders a non-lifting session as an activity, never a gym session", () => {
    const week = build([
      program([...[0, 2, 3, 4, 5, 6].map((i) => day(i)), day(1, { title: "Track", sessionType: "track", expectedDurationMinutes: 75 })]),
    ])!;
    expect(week[1].activity?.key).toBe("track");
    expect(week[1].activity?.durationMinutes).toBe(75);
    /* The decisive one: a title that WOULD match a split must not load it. */
    expect(week[1].splitKey).toBeNull();
    expect(week[1].recovery).toBe(false);
  });

  it("says nothing when no program governs the week", () => {
    expect(build([], null)).toBeNull();
    expect(build([program()], null)).toBeNull();
  });

  it("is honest about a position the program has no day for", () => {
    const week = build([program([day(0), day(1)])])!;
    expect(week[3].unprogrammed).toBe(true);
    expect(week[3].displayTitle).toBe("No session");
    expect(week[3].reason).toMatch(/did not substitute/i);
  });
});

describe("one week, everywhere", () => {
  const base = {
    focus: undefined,
    weakPoints: undefined,
    protocolName: null,
    protocolArchitectureName: "Reserve",
    womensActive: false,
  } as const;

  it("makes the rail name the day the cockpit will load", () => {
    const programWeek = build([program()]);
    const context = resolveDailyTrainingContext({ ...base, now: TUESDAY, requireActiveHorizon: true, programWeek });
    /* Tuesday is index 1 — "Chest Day" in the program. Before this the week
       came from the split resolver and the cockpit came from the program. */
    expect(context.todaySession.displayTitle).toBe("Chest Day");
    expect(context.weeklyPlan.map((d) => d.displayTitle)).toEqual(TITLES);
    expect(context.sourceReason).toMatch(/your program/i);
  });

  it("stops calling a member with a program 'unconfirmed'", () => {
    const programWeek = build([program()]);
    expect(resolveDailyTrainingContext({ ...base, now: TUESDAY, requireActiveHorizon: true, programWeek }).programUnconfirmed).toBe(false);
    expect(resolveDailyTrainingContext({ ...base, now: TUESDAY, requireActiveHorizon: true }).programUnconfirmed).toBe(true);
  });

  it("still lets the member's own change to a date win", () => {
    const programWeek = build([program()]);
    const customization = recordSplitDayEdit(
      DEFAULT_SPLIT_CUSTOMIZATION,
      { dayIndex: 1, dateKey: localDateKey(TUESDAY), scope: "weekly", edit: { kind: "session", session: "legs" } },
      TUESDAY,
    );
    const context = resolveDailyTrainingContext({
      ...base, now: TUESDAY, requireActiveHorizon: true, programWeek, splitCustomization: customization,
    });
    expect(context.todaySession.displayTitle).toBe("Legs");
    expect(context.todaySession.splitKey).toBe("legs");
    expect(context.todaySession.memberEdit).toBeTruthy();
    /* And only that day: Wednesday is still the program's. */
    expect(context.weeklyPlan[2].displayTitle).toBe("Rest");
  });

  it("leaves a member with no program exactly where they were", () => {
    const withNull = resolveDailyTrainingContext({ ...base, now: TUESDAY, requireActiveHorizon: true, programWeek: null });
    const without = resolveDailyTrainingContext({ ...base, now: TUESDAY, requireActiveHorizon: true });
    expect(withNull.weeklyPlan.map((d) => d.displayTitle)).toEqual(without.weeklyPlan.map((d) => d.displayTitle));
  });

  it("ignores a partial week rather than rendering half a program", () => {
    const context = resolveDailyTrainingContext({
      ...base, now: TUESDAY, requireActiveHorizon: true,
      programWeek: build([program()])!.slice(0, 4),
    });
    expect(context.weeklyPlan.map((d) => d.displayTitle)).not.toEqual(TITLES);
  });
});
