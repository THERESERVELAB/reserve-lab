import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";
import { FUEL_HORIZON, buildFuelHorizon, type FuelHorizon, type FuelHorizonInput } from "../fuel-horizon";

const SCHEDULE: MemberScheduleProfile = {
  ...DEFAULT_SCHEDULE_PROFILE,
  wakeTime: "06:30",
  sleepTarget: "22:30",
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
};

/** Tuesday 15 September 2026 at a local wall-clock time. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const MEALS: FuelHorizonInput["meals"] = [
  { id: "fuel-morning-anchor-eggs", windowLabel: "Morning Protein Anchor", name: "Eggs + oats", time: "07:00" },
  { id: "fuel-midday-bowl", windowLabel: "Midday Meal", name: "Chicken rice bowl", time: "12:30" },
  { id: "fuel-pre-workout-rice", windowLabel: "Pre-Workout Meal", name: "Rice + turkey", time: "16:00" },
  { id: "fuel-post-workout-salmon", windowLabel: "Post-Workout Meal", name: "Salmon + potatoes", time: "19:15" },
];

function input(over: Partial<FuelHorizonInput> = {}): FuelHorizonInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    trainingPlanned: true,
    sessionLabel: "Pull",
    sessionMode: "idle",
    meals: MEALS,
    loggedMealIds: [],
    ...over,
  };
}

function track(horizon: FuelHorizon) {
  if (horizon.state !== "track") throw new Error(`expected a track, got ${horizon.state}`);
  return horizon;
}

describe("buildFuelHorizon — the track", () => {
  it("reads the fuel plan's meals, the training window and sleep lock, from a short look back to sleep lock", () => {
    const h = track(buildFuelHorizon(input()));

    expect(h.items.map((i) => i.label)).toEqual(["Pre-Workout Meal", "Pull", "Post-Workout Meal", "Sleep Lock"]);
    expect(h.lanes.map((l) => l.id)).toEqual(["fuel", "training"]);
    expect(h.lanes[0].items.map((i) => i.label)).toEqual(["Pre-Workout Meal", "Post-Workout Meal", "Sleep Lock"]);
    expect(h.lanes[1].items).toMatchObject([{ label: "Pull", startMin: minutes("17:30"), endMin: minutes("19:00"), sub: "Until 7:00 PM" }]);
    expect(h.window).toEqual({ startMin: minutes("16:12") - FUEL_HORIZON.lookBackMin, endMin: minutes("22:30") + FUEL_HORIZON.tailMin });
    expect(h.sleepLock).toEqual({ min: minutes("22:30"), label: "10:30 PM" });
    /* Breakfast and lunch are part of today, behind the window. */
    expect(h.earlier).toBe(2);
  });

  it("uses the canonical status set and promotes only the first upcoming item", () => {
    const h = track(buildFuelHorizon(input()));
    expect(h.items.map((i) => [i.label, i.status])).toEqual([
      ["Pre-Workout Meal", "due-now"],
      ["Pull", "due-next"],
      ["Post-Workout Meal", "upcoming"],
      ["Sleep Lock", "upcoming"],
    ]);
  });

  it("marks a logged meal completed, with a way to take it back, and never logs one itself", () => {
    const h = track(buildFuelHorizon(input({ loggedMealIds: ["fuel-pre-workout-rice"] })));
    const pre = h.items.find((i) => i.id === "meal-fuel-pre-workout-rice")!;
    expect(pre.status).toBe("completed");
    expect(pre.actions).toEqual([{ kind: "undo-meal-log", label: "Undo Log", mealId: "fuel-pre-workout-rice" }]);

    const post = h.items.find((i) => i.id === "meal-fuel-post-workout-salmon")!;
    expect(post.actions).toEqual([{ kind: "open-meal-log", label: "Log Post-Workout Meal", mealId: "fuel-post-workout-salmon" }]);
  });

  it("asks for a passed, unlogged meal only if it was eaten", () => {
    const h = track(buildFuelHorizon(input({ now: at("20:10") })));
    const post = h.items.find((i) => i.label === "Post-Workout Meal")!;
    expect(post.status).toBe("past-due");
    expect(post.actions[0]).toMatchObject({ kind: "open-meal-log", label: "Log Post-Workout Meal If Eaten" });
  });

  it("drops the training lane on a day with no session", () => {
    const h = track(buildFuelHorizon(input({ trainingPlanned: false, now: at("11:00") })));
    expect(h.lanes.map((l) => l.id)).toEqual(["fuel"]);
    expect(h.items.some((i) => i.source === "training")).toBe(false);
  });

  it("reads a live session as due now and a finished one as completed", () => {
    const live = track(buildFuelHorizon(input({ now: at("15:00"), sessionMode: "live" })));
    expect(live.items.find((i) => i.source === "training")!.status).toBe("due-now");
    const done = track(buildFuelHorizon(input({ now: at("19:30"), sessionMode: "complete" })));
    expect(done.items.find((i) => i.source === "training")!.status).toBe("completed");
  });

  it("carries a sleep lock past midnight on the same minute Apex uses", () => {
    const late = { ...SCHEDULE, sleepTarget: "00:30" };
    const h = track(buildFuelHorizon(input({ schedule: late, now: at("23:50") })));
    expect(h.sleepLock).toEqual({ min: 1440 + 30, label: "12:30 AM" });
    expect(h.items[h.items.length - 1]).toMatchObject({ label: "Sleep Lock", startMin: 1470 });
    expect(buildFuelHorizon(input({ schedule: late, now: at("00:40") }))).toMatchObject({ state: "quiet", reason: "after-sleep-lock" });
  });

  it("leaves untimed meals off the horizon", () => {
    const h = track(buildFuelHorizon(input({ meals: [...MEALS, { id: "fuel-snack", windowLabel: "Snack", name: "Yogurt", time: null }] })));
    expect(h.items.some((i) => i.label === "Snack")).toBe(false);
  });
});

describe("buildFuelHorizon — no dead buttons, no empty track", () => {
  it("gives every item at least one real action with a flat label", () => {
    for (const now of ["07:10", "12:00", "16:12", "21:00"]) {
      for (const item of track(buildFuelHorizon(input({ now: at(now), loggedMealIds: ["fuel-midday-bowl"] }))).items) {
        expect(item.actions.length, item.id).toBeGreaterThan(0);
        for (const action of item.actions) expect(action.label.trim(), item.id).not.toBe("");
      }
    }
    const sleep = track(buildFuelHorizon(input())).items.find((i) => i.source === "sleep")!;
    expect(sleep.actions).toEqual([{ kind: "open-view", label: "Adjust Sleep Target", view: "schedule-command" }]);
  });

  it("is quiet before wake and after sleep lock", () => {
    const before = buildFuelHorizon(input({ now: at("05:10") }));
    expect(before).toMatchObject({ state: "quiet", reason: "before-wake", headline: "Before wake" });
    const after = buildFuelHorizon(input({ now: at("22:30") }));
    expect(after).toMatchObject({ state: "quiet", reason: "after-sleep-lock", headline: "Past sleep lock" });
    if (after.state === "quiet") expect(after.detail).toContain("10:30 PM");
  });

  it("depends only on the clock it is given", () => {
    expect(buildFuelHorizon(input())).toEqual(buildFuelHorizon(input()));
    const a = track(buildFuelHorizon(input({ now: at("18:50") })));
    const b = track(buildFuelHorizon(input({ now: at("18:51") })));
    expect(b.nowMin - a.nowMin).toBe(1);
  });
});
