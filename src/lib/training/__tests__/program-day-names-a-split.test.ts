import { describe, expect, it } from "vitest";

import { programSourceLine } from "../training-room";
import { getWorkoutTemplateForSplit, resolveSplitKey } from "../workout-templates";

/* ════════════════════════════════════════════════════════════════════════
   "I STILL DON'T SEE ANY WORKOUTS ON TRAINING COMMAND."

   A member-authored program day with no workout template attached rendered
   nothing, on every such day, forever:

       CHEST DAY.
       Your program · Chest Day · Member created
       No session queue yet            [ Build Today's Session ]
       No workout template for "Chest Day" yet.

   But Reserve knows what "Chest Day" means — `resolveSplitKey` reads the
   member's own title and returns `chest`, and there is a chest session behind
   it. The same three words typed into the 7-day rail loaded a full workout.
   Typed into Build Studio they loaded nothing. One word, one member, two
   answers.

   So a title Reserve can place IS the instruction. A title it cannot place
   still waits, because there Reserve does not know what the member meant and
   must not guess. These tests hold both halves of that line.
   ════════════════════════════════════════════════════════════════════════ */

/** Exactly the test TrainingView makes: a placeable, non-recovery split. */
function namesASession(title: string): boolean {
  const key = resolveSplitKey(title);
  return Boolean(key) && key !== "recovery";
}

describe("every session Reserve offers can actually be loaded", () => {
  /* The hole that "Arm Day" fell down. getWorkoutTemplateForSplit ran every
     argument through the TITLE alias table, and "arms" is a key that is not
     one of its own aliases, so callers passing day.splitKey — which is most of
     them — got null. Both spellings have to work for every session the member
     can pick, or picking one is a dead end. */
  it("resolves from its engine key and from its label", async () => {
    const { SPLIT_SESSIONS } = await import("../split-customization");
    for (const session of SPLIT_SESSIONS) {
      expect(getWorkoutTemplateForSplit(session.key), `${session.label} by key`).toBeTruthy();
      expect(getWorkoutTemplateForSplit(session.label), `${session.label} by label`).toBeTruthy();
    }
  });

  it("still returns nothing for rest and for a title it cannot place", () => {
    expect(getWorkoutTemplateForSplit("recovery")).toBeNull();
    expect(getWorkoutTemplateForSplit("Rest")).toBeNull();
    expect(getWorkoutTemplateForSplit("Workout A")).toBeNull();
    expect(getWorkoutTemplateForSplit(null)).toBeNull();
    expect(getWorkoutTemplateForSplit("")).toBeNull();
  });
});

describe("titles a member types into Build Studio", () => {
  it("builds the session for every title Reserve can place", () => {
    const placeable = [
      "Chest Day", "Chest", "Push", "Push Day", "Pull", "Pull Day",
      "Legs", "Leg Day", "Upper", "Heavy Upper", "Lower",
      "Arm Day", "Back Day", "Shoulders", "Full Body",
    ];
    for (const title of placeable) {
      expect(namesASession(title), `"${title}" should name a session`).toBe(true);
      /* And the key it resolves to must actually have a session behind it —
         a placeable title that loads nothing would be the same dead end. */
      const template = getWorkoutTemplateForSplit(title);
      expect(template, `"${title}" resolved to a split with no template`).toBeTruthy();
      expect(template!.phases.flatMap((p) => p.movements).length).toBeGreaterThan(0);
    }
  });

  it("still refuses a title it cannot place, rather than guessing", () => {
    /* Reserve has no idea what these mean. "Glutes" and "Core" are real body
       parts with no split of their own; "Day 1" and "Workout A" are labels. */
    for (const title of ["Day 1", "Workout A", "Session 3", "Glutes", "Core", "Arms", ""]) {
      expect(namesASession(title), `"${title}" must not name a session`).toBe(false);
    }
  });

  it("does not treat a rest day as a session built from its name", () => {
    /* resolveSplitKey("Rest") returns "recovery", which is truthy. Without the
       recovery exclusion the honesty line announced "session built from the
       day you named" over a mobility runway. */
    for (const title of ["Rest", "Rest Day", "Recovery", "Off"]) {
      expect(resolveSplitKey(title) === "recovery" || resolveSplitKey(title) === null).toBe(true);
      expect(namesASession(title), `"${title}" must not name a lifting session`).toBe(false);
    }
  });
});

describe("what the honesty line says about it", () => {
  const programDay = { title: "Chest Day", ownershipLabel: "Member created" };

  it("says the session came from the day's name when it did", () => {
    const line = programSourceLine({
      generation: null, horizon: null,
      programDay: { ...programDay, builtFromDayName: true },
      memberSplitName: null, memberDayEdit: false,
    });
    expect(line.source).toBe("program-day");
    expect(line.text).toBe("Your program · Chest Day · Member created · session built from the day you named");
  });

  it("claims nothing extra when the member's own template built it", () => {
    const line = programSourceLine({
      generation: null, horizon: null,
      programDay: { ...programDay, builtFromDayName: false },
      memberSplitName: null, memberDayEdit: false,
    });
    expect(line.text).toBe("Your program · Chest Day · Member created");
    expect(line.text).not.toMatch(/built from/i);
  });

  it("is unchanged for a day with no ownership label", () => {
    const line = programSourceLine({
      generation: null, horizon: null,
      programDay: { title: "Pull", ownershipLabel: null },
      memberSplitName: null, memberDayEdit: false,
    });
    expect(line.text).toBe("Your program · Pull");
  });

  it("keeps every other source ahead of the program day", () => {
    expect(programSourceLine({
      generation: { architectureName: "Reserve", splitTitle: "Push" },
      horizon: null, programDay: { ...programDay, builtFromDayName: true },
      memberSplitName: null, memberDayEdit: false,
    }).source).toBe("session");
    expect(programSourceLine({
      generation: null,
      horizon: { protocolName: "P", phaseName: "Base", weekNumber: 2, totalWeeks: 8 },
      programDay: { ...programDay, builtFromDayName: true },
      memberSplitName: null, memberDayEdit: false,
    }).source).toBe("horizon");
  });
});
