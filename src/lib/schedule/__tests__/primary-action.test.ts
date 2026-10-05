import { describe, expect, it } from "vitest";

import type { ScheduleAction } from "../day-horizon";
import { SCHEDULE_WATER_OZ, resolveSchedulePrimaryAction, type SchedulePrimaryInput } from "../primary-action";

const SCHEDULE: SchedulePrimaryInput["schedule"] = {
  wakeTime: "06:30",
  sleepTarget: "22:30",
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
};

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

const MEALS: SchedulePrimaryInput["meals"] = [
  { id: "breakfast", windowLabel: "Morning Protein Anchor", name: "Eggs + oats", time: "07:00" },
  { id: "lunch", windowLabel: "Midday Meal", name: "Chicken rice bowl", time: "12:30" },
  { id: "pre", windowLabel: "Pre-Workout Meal", name: "Rice + turkey", time: "16:00" },
  { id: "post", windowLabel: "Post-Workout Meal", name: "Salmon + potatoes", time: "19:15" },
];
const ALL = MEALS.map((m) => m.id);

function input(over: Partial<SchedulePrimaryInput> = {}): SchedulePrimaryInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    scheduleSet: true,
    trainingPlanned: true,
    direction: "unchanged",
    sessionLabel: "Pull",
    sessionMode: "idle",
    meals: MEALS,
    loggedMealIds: ["breakfast", "lunch"],
    sleepLoggedToday: true,
    sleepConflict: "none",
    hydration: { todayOz: 64, targetOz: 120 },
    ...over,
  };
}

const primary = (over: Partial<SchedulePrimaryInput> = {}) => resolveSchedulePrimaryAction(input(over));

describe("resolveSchedulePrimaryAction", () => {
  it("asks the member to set their day before anything is timed, at any hour", () => {
    for (const now of ["05:00", "16:12", "23:30"]) {
      const plan = primary({ now: at(now), scheduleSet: false });
      expect(plan.primary).toEqual({ kind: "set-day", label: "Set Your Day" });
      expect(plan.title).toBe("Your day is not set yet");
    }
  });

  it("opens the meal confirmation for the window open now, and never logs it", () => {
    const plan = primary();
    expect(plan.primary).toEqual({ kind: "open-meal-log", label: "Log Pre-Workout Meal", mealId: "pre" });
    expect(plan.title).toBe("Pre-Workout Meal is due · 4:00 PM");
    expect(plan.reason).toContain("Nothing counts until you confirm it.");
  });

  it("starts the session through Training's launch path while the window is open", () => {
    const plan = primary({ now: at("17:20"), loggedMealIds: ["breakfast", "lunch", "pre"] });
    expect(plan.primary).toEqual({ kind: "start-session", label: "Start Session" });
    expect(plan.title).toBe("Pull · 5:30 PM to 7:00 PM");
  });

  it("resumes a live session before anything else", () => {
    expect(primary({ now: at("18:10"), sessionMode: "live", sleepConflict: "conflict" }).primary).toEqual({
      kind: "start-session",
      label: "Resume Live Session",
    });
  });

  it("points at the sleep conflict while there is time to move the window, then lets the session start", () => {
    const late = { ...SCHEDULE, preferredTrainingStart: "21:00", preferredTrainingEnd: "23:00" };
    const early = primary({ now: at("14:00"), schedule: late, sleepConflict: "conflict", loggedMealIds: ALL });
    expect(early.primary).toEqual({ kind: "edit-time", label: "Adjust Training Window", field: "preferredTrainingStart" });
    expect(early.title).toBe("Training ends at 11:00 PM, at or after sleep lock");

    const inWindow = primary({ now: at("21:05"), schedule: late, sleepConflict: "conflict", loggedMealIds: ALL });
    expect(inWindow.primary).toEqual({ kind: "start-session", label: "Start Session" });
  });

  it("never raises a sleep conflict or a session on a recovery day or with training moved away", () => {
    for (const now of ["06:45", "09:00", "14:00", "17:40", "20:00", "23:00"]) {
      for (const direction of ["unchanged", "moved-away", "set-aside"] as const) {
        const plan = primary({ now: at(now), trainingPlanned: false, direction, sleepConflict: "none", loggedMealIds: [] });
        expect(["start-session", "review-session"]).not.toContain(plan.primary.kind);
        expect(plan.primary.label).not.toMatch(/training window/i);
      }
    }
  });

  it("leads the morning with last night's sleep once no meal window is open", () => {
    const plan = primary({ now: at("09:10"), loggedMealIds: ["breakfast"], sleepLoggedToday: false });
    expect(plan.primary).toEqual({ kind: "open-sleep-log", label: "Log Last Night's Sleep" });

    const logged = primary({ now: at("09:10"), loggedMealIds: ["breakfast"], sleepLoggedToday: true });
    expect(logged.primary).toEqual({ kind: "open-meal-log", label: "Log Midday Meal", mealId: "lunch" });
    expect(logged.title).toBe("Next · Midday Meal at 12:30 PM");
  });

  it("names the session when it is the next block, including one moved here", () => {
    const plan = primary({ now: at("16:45"), direction: "moved-here", loggedMealIds: ["breakfast", "lunch", "pre"] });
    expect(plan.primary).toEqual({ kind: "start-session", label: "Start Session" });
    expect(plan.title).toBe("Next · Pull at 5:30 PM");
  });

  it("reviews a passed session, and asks for a passed meal only if it was eaten", () => {
    expect(primary({ now: at("21:00"), loggedMealIds: ALL }).primary).toEqual({ kind: "review-session", label: "Review Session" });
    /* 21:00 is still inside the 7:15 PM meal's open window; by 21:30 it has passed. */
    expect(primary({ now: at("21:00"), sessionMode: "complete", loggedMealIds: ["breakfast", "lunch", "pre"] }).primary).toMatchObject({
      label: "Log Post-Workout Meal",
    });
    expect(primary({ now: at("21:30"), sessionMode: "complete", loggedMealIds: ["breakfast", "lunch", "pre"] }).primary).toEqual({
      kind: "open-meal-log",
      label: "Log Post-Workout Meal If Eaten",
      mealId: "post",
    });
  });

  it("once every block is handled, offers water, then last night's sleep, then the sleep target", () => {
    const done = { now: at("21:00"), sessionMode: "complete", loggedMealIds: ALL };
    expect(primary({ ...done, hydration: { todayOz: 64, targetOz: 120 } }).primary).toEqual({
      kind: "log-water",
      label: `Log ${SCHEDULE_WATER_OZ} oz Water`,
      oz: SCHEDULE_WATER_OZ,
    });
    expect(primary({ ...done, hydration: { todayOz: 120, targetOz: 120 }, sleepLoggedToday: false }).primary.kind).toBe("open-sleep-log");
    expect(primary({ ...done, hydration: { todayOz: 120, targetOz: 120 } }).primary).toEqual({
      kind: "edit-time",
      label: "Adjust Sleep Target",
      field: "sleepTarget",
    });
  });

  it("closes the day honestly after sleep lock", () => {
    const open = primary({ now: at("23:05"), loggedMealIds: ["breakfast", "lunch", "pre"] });
    expect(open.title).toBe("Close today's plan");
    expect(open.primary).toMatchObject({ kind: "open-meal-log", label: "Log Post-Workout Meal If Eaten" });

    const closed = primary({ now: at("23:05"), loggedMealIds: ALL });
    expect(closed.title).toBe("Today's plan is closed");
    expect(closed.primary).toEqual({ kind: "edit-time", label: "Adjust Wake Time", field: "wakeTime" });
  });

  it("prints every amount it records and never returns an empty label, at every hour", () => {
    const hours = ["05:00", "06:45", "09:00", "12:40", "15:50", "17:40", "19:30", "21:00", "22:40"];
    const logs = [[], ["breakfast"], ALL];
    for (const h of hours) {
      for (const loggedMealIds of logs) {
        for (const trainingPlanned of [true, false]) {
          for (const sessionMode of ["idle", "live", "complete"]) {
            for (const todayOz of [0, 120]) {
              const plan = primary({ now: at(h), loggedMealIds, trainingPlanned, sessionMode, sleepLoggedToday: todayOz > 0, hydration: { todayOz, targetOz: 120 } });
              const action: ScheduleAction = plan.primary;
              expect(action.label.trim()).not.toBe("");
              if (action.kind === "log-water") expect(action.label).toContain(`${action.oz} oz`);
              expect(plan.title.trim()).not.toBe("");
            }
          }
        }
      }
    }
  });
});
