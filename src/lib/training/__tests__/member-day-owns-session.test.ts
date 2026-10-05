import { describe, expect, it } from "vitest";

import { DEFAULT_SPLIT_CUSTOMIZATION, localDateKey, mondayDayIndex, recordSplitDayEdit } from "../split-customization";
import { resolveDailyTrainingContext } from "../daily-context";
import { todaySessionOwner } from "../training-room";
import { getWorkoutTemplateForSplit } from "../workout-templates";

/* ════════════════════════════════════════════════════════════════════════
   "I SELECTED LEGS EVERY FRIDAY AND THERE IS NO WORKOUT TO START."

   The member's change reached the resolver, the week rail and the hero, and
   stopped there. The cockpit kept loading the PROGRAM's day for that date —
   and when that day was a member-authored one with no template yet, the
   screen read:

       LEGS.
       Your program · Chest Day · Member created
       No session queue yet            [ Build Today's Session ]
       No workout template for “Legs” yet.

   Three names for one day, and nothing to start. A change the member made to
   a date is the most specific thing anyone has said about that date, so it
   goes first — above the program that scheduled it.
   ════════════════════════════════════════════════════════════════════════ */

const FRIDAY = new Date(2026, 9, 2, 10, 0); // 2026-10-02
const FRIDAY_INDEX = 4;

function legsEveryFriday() {
  return recordSplitDayEdit(
    DEFAULT_SPLIT_CUSTOMIZATION,
    { dayIndex: FRIDAY_INDEX, dateKey: localDateKey(FRIDAY), scope: "weekly", edit: { kind: "session", session: "legs" } },
    FRIDAY,
  );
}

describe("who owns today's session", () => {
  it("gives the day to the member when they set that date themselves", () => {
    /* Every other plan is present and loud. The member's own change still wins. */
    expect(
      todaySessionOwner({ horizonActive: true, programDayResolved: true, memberDayEdit: true, memberSplitActive: true }),
    ).toBe("member-day");
    expect(
      todaySessionOwner({ horizonActive: false, programDayResolved: true, memberDayEdit: true, memberSplitActive: false }),
    ).toBe("member-day");
  });

  it("leaves every unedited day exactly where it was", () => {
    expect(
      todaySessionOwner({ horizonActive: true, programDayResolved: true, memberDayEdit: false, memberSplitActive: true }),
    ).toBe("horizon");
    expect(
      todaySessionOwner({ horizonActive: false, programDayResolved: true, memberDayEdit: false, memberSplitActive: true }),
    ).toBe("program-day");
    expect(
      todaySessionOwner({ horizonActive: false, programDayResolved: false, memberDayEdit: false, memberSplitActive: true }),
    ).toBe("member-split");
  });

  it("says there is no plan rather than inventing one", () => {
    expect(
      todaySessionOwner({ horizonActive: false, programDayResolved: false, memberDayEdit: false, memberSplitActive: false }),
    ).toBe("none");
  });
});

describe("legs every Friday", () => {
  it("is recorded against Friday", () => {
    expect(mondayDayIndex(FRIDAY)).toBe(FRIDAY_INDEX);
    expect(legsEveryFriday().weekly[String(FRIDAY_INDEX)]).toMatchObject({ kind: "session", session: "legs" });
  });

  it("resolves Friday to a leg session the cockpit can actually load", () => {
    const context = resolveDailyTrainingContext({
      now: FRIDAY,
      focus: undefined,
      weakPoints: undefined,
      protocolName: null,
      protocolArchitectureName: "Reserve",
      womensActive: false,
      requireActiveHorizon: true,
      splitCustomization: legsEveryFriday(),
    });

    const today = context.todaySession;
    expect(today.displayTitle).toBe("Legs");
    expect(today.recovery).toBe(false);
    expect(today.memberEdit).toMatchObject({ scope: "weekly", kind: "session" });

    /* The engine key is what the cockpit loads from — a title alone would let
       the screen name a session it cannot build. */
    expect(today.splitKey).toBe("legs");
    const template = getWorkoutTemplateForSplit(today.splitKey!);
    expect(template).toBeTruthy();
    expect(template!.phases.flatMap((p) => p.movements).length).toBeGreaterThan(0);

    /* And with the edit in place, the program day must not be the one that
       decides — which is the whole failure this file exists for. */
    expect(
      todaySessionOwner({
        horizonActive: false,
        programDayResolved: true,
        memberDayEdit: Boolean(today.memberEdit),
        memberSplitActive: false,
      }),
    ).toBe("member-day");
  });

  it("keeps applying on later Fridays, not just the one it was set on", () => {
    const nextFriday = new Date(2026, 9, 9, 10, 0);
    const context = resolveDailyTrainingContext({
      now: nextFriday,
      focus: undefined,
      weakPoints: undefined,
      protocolName: null,
      protocolArchitectureName: "Reserve",
      womensActive: false,
      requireActiveHorizon: true,
      splitCustomization: legsEveryFriday(),
    });
    expect(context.todaySession.displayTitle).toBe("Legs");
    expect(context.todaySession.splitKey).toBe("legs");
  });
});
