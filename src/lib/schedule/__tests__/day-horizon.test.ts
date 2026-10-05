import { describe, expect, it } from "vitest";

import { DAY_HORIZON, buildDayHorizon, type DayHorizon, type DayHorizonInput } from "../day-horizon";

const SCHEDULE: DayHorizonInput["schedule"] = {
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

const MEALS: DayHorizonInput["meals"] = [
  { id: "fuel-morning-anchor-eggs", windowLabel: "Morning Protein Anchor", name: "Eggs + oats", time: "07:00" },
  { id: "fuel-midday-bowl", windowLabel: "Midday Meal", name: "Chicken rice bowl", time: "12:30" },
  { id: "fuel-pre-workout-rice", windowLabel: "Pre-Workout Meal", name: "Rice + turkey", time: "16:00" },
  { id: "fuel-post-workout-salmon", windowLabel: "Post-Workout Meal", name: "Salmon + potatoes", time: "19:15" },
];

function input(over: Partial<DayHorizonInput> = {}): DayHorizonInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    scheduleSet: true,
    trainingPlanned: true,
    direction: "unchanged",
    sessionLabel: "Pull",
    sessionMode: "idle",
    meals: MEALS,
    loggedMealIds: [],
    sleepLoggedToday: false,
    ...over,
  };
}

function track(horizon: DayHorizon) {
  if (horizon.state !== "track") throw new Error(`expected a track, got ${horizon.state}`);
  return horizon;
}

describe("buildDayHorizon — the track", () => {
  it("runs wake → meals → training window → sleep lock, in time order", () => {
    const h = track(buildDayHorizon(input({ now: at("06:40") })));
    expect(h.items.map((i) => i.label)).toEqual([
      "Wake",
      "Morning Protein Anchor",
      "Midday Meal",
      "Pre-Workout Meal",
      "Pull",
      "Post-Workout Meal",
      "Sleep Lock",
    ]);
    expect(h.lanes.map((l) => l.id)).toEqual(["training", "fuel", "sleep"]);
    expect(h.lanes[0].items).toMatchObject([{ label: "Pull", startMin: minutes("17:30"), endMin: minutes("19:00"), sub: "Until 7:00 PM" }]);
    expect(h.lanes[2].items.map((i) => i.label)).toEqual(["Wake", "Sleep Lock"]);
    expect(h.sleepLock).toEqual({ min: minutes("22:30"), label: "10:30 PM" });
    expect(h.earlier).toBe(0);
  });

  it("keeps a short look back behind now and counts what fell before it", () => {
    const h = track(buildDayHorizon(input()));
    expect(h.window).toEqual({ startMin: minutes("16:12") - DAY_HORIZON.lookBackMin, endMin: minutes("22:30") + DAY_HORIZON.tailMin });
    expect(h.items.map((i) => i.label)).toEqual(["Pre-Workout Meal", "Pull", "Post-Workout Meal", "Sleep Lock"]);
    /* Wake, breakfast and lunch are part of today, behind the window. */
    expect(h.earlier).toBe(3);
  });

  it("uses the canonical status set and promotes only the first upcoming item", () => {
    const h = track(buildDayHorizon(input()));
    expect(h.items.map((i) => [i.label, i.status])).toEqual([
      ["Pre-Workout Meal", "due-now"],
      ["Pull", "due-next"],
      ["Post-Workout Meal", "upcoming"],
      ["Sleep Lock", "upcoming"],
    ]);
  });

  it("honours training moved onto today, and says so", () => {
    const h = track(buildDayHorizon(input({ direction: "moved-here" })));
    const session = h.items.find((i) => i.source === "training")!;
    expect(session.sub).toBe("Until 7:00 PM · moved here");
    expect(session.actions[0]).toEqual({ kind: "start-session", label: "Start Session" });
  });

  it("draws no session when training moved away, and the lane says why", () => {
    const h = track(buildDayHorizon(input({ trainingPlanned: false, direction: "moved-away" })));
    expect(h.items.some((i) => i.source === "training")).toBe(false);
    expect(h.lanes[0]).toEqual({ id: "training", label: "Training", items: [], empty: "Session moved off today" });

    const setAside = track(buildDayHorizon(input({ trainingPlanned: false, direction: "set-aside" })));
    expect(setAside.lanes[0].empty).toBe("Session set aside today");
  });

  it("drops the training lane on a recovery day", () => {
    const h = track(buildDayHorizon(input({ trainingPlanned: false, now: at("11:00") })));
    expect(h.lanes.map((l) => l.id)).toEqual(["fuel", "sleep"]);
  });

  it("never places a meal at or past sleep lock", () => {
    const late = [...MEALS, { id: "fuel-night-late", windowLabel: "Night Recovery Meal", name: "Casein", time: "22:40" }];
    const h = track(buildDayHorizon(input({ now: at("21:00"), meals: late })));
    expect(h.items.some((i) => i.label === "Night Recovery Meal")).toBe(false);
    expect(h.items[h.items.length - 1].label).toBe("Sleep Lock");
    for (const item of h.items) expect(item.startMin).toBeLessThanOrEqual(h.sleepLock.min);
  });

  it("reads the live session as due now, a finished one as completed, and a passed one as past due", () => {
    const live = track(buildDayHorizon(input({ now: at("18:00"), sessionMode: "live" }))).items.find((i) => i.source === "training")!;
    expect(live).toMatchObject({ status: "due-now", actions: [{ kind: "start-session", label: "Resume Live Session" }] });

    const done = track(buildDayHorizon(input({ now: at("19:30"), sessionMode: "complete" }))).items.find((i) => i.source === "training")!;
    expect(done.status).toBe("completed");
    expect(done.actions[0]).toEqual({ kind: "review-session", label: "Review Session" });

    const passed = track(buildDayHorizon(input({ now: at("19:30") }))).items.find((i) => i.source === "training")!;
    expect(passed.status).toBe("past-due");
    expect(passed.actions[0]).toEqual({ kind: "review-session", label: "Review Session" });
  });

  it("marks wake done only once last night's sleep is logged", () => {
    const open = track(buildDayHorizon(input({ now: at("06:40") }))).items.find((i) => i.source === "wake")!;
    expect(open.status).toBe("due-now");
    expect(open.actions.map((a) => a.label)).toEqual(["Log Last Night's Sleep", "Adjust Wake Time"]);

    const logged = track(buildDayHorizon(input({ now: at("06:40"), sleepLoggedToday: true }))).items.find((i) => i.source === "wake")!;
    expect(logged.status).toBe("completed");
    expect(logged.actions).toEqual([{ kind: "edit-time", label: "Adjust Wake Time", field: "wakeTime" }]);
  });

  it("marks a logged meal completed, with a way to take it back, and asks for a passed one only if eaten", () => {
    const early = track(buildDayHorizon(input({ loggedMealIds: ["fuel-pre-workout-rice"] })));
    const pre = early.items.find((i) => i.id === "meal-fuel-pre-workout-rice")!;
    expect(pre).toMatchObject({ status: "completed", actions: [{ kind: "undo-meal-log", label: "Undo Log", mealId: "fuel-pre-workout-rice" }] });

    const h = track(buildDayHorizon(input({ now: at("20:10"), loggedMealIds: ["fuel-pre-workout-rice"] })));
    const post = h.items.find((i) => i.id === "meal-fuel-post-workout-salmon")!;
    expect(post.status).toBe("past-due");
    expect(post.actions[0]).toEqual({ kind: "open-meal-log", label: "Log Post-Workout Meal If Eaten", mealId: "fuel-post-workout-salmon" });
  });

  it("carries a sleep lock past midnight on the same minute Apex uses", () => {
    const late = { ...SCHEDULE, sleepTarget: "00:30" };
    const h = track(buildDayHorizon(input({ schedule: late, now: at("23:50") })));
    expect(h.sleepLock).toEqual({ min: 1440 + 30, label: "12:30 AM" });
    expect(h.items[h.items.length - 1]).toMatchObject({ label: "Sleep Lock", startMin: 1470 });
    expect(buildDayHorizon(input({ schedule: late, now: at("00:40") }))).toMatchObject({ state: "quiet", reason: "after-sleep-lock" });
  });
});

describe("buildDayHorizon — no dead buttons, no empty track", () => {
  it("gives every item at least one real action with a flat label", () => {
    for (const now of ["06:40", "12:00", "16:12", "21:00"]) {
      for (const trainingPlanned of [true, false]) {
        for (const item of track(buildDayHorizon(input({ now: at(now), trainingPlanned, loggedMealIds: ["fuel-midday-bowl"] }))).items) {
          expect(item.actions.length, item.id).toBeGreaterThan(0);
          for (const action of item.actions) expect(action.label.trim(), item.id).not.toBe("");
        }
      }
    }
    const sleep = track(buildDayHorizon(input())).items.find((i) => i.source === "sleep")!;
    expect(sleep.actions).toEqual([{ kind: "edit-time", label: "Adjust Sleep Target", field: "sleepTarget" }]);
  });

  it("is quiet until the member sets their day, whatever the hour", () => {
    for (const now of ["05:10", "12:00", "23:00"]) {
      expect(buildDayHorizon(input({ now: at(now), scheduleSet: false }))).toMatchObject({ state: "quiet", reason: "not-set", headline: "No plan drawn yet" });
    }
  });

  it("is quiet before wake and after sleep lock", () => {
    expect(buildDayHorizon(input({ now: at("05:10") }))).toMatchObject({ state: "quiet", reason: "before-wake", headline: "Before wake" });
    const after = buildDayHorizon(input({ now: at("22:30") }));
    expect(after).toMatchObject({ state: "quiet", reason: "after-sleep-lock", headline: "Past sleep lock" });
    if (after.state === "quiet") expect(after.detail).toContain("10:30 PM");
  });

  it("depends only on the clock it is given", () => {
    expect(buildDayHorizon(input())).toEqual(buildDayHorizon(input()));
    const a = track(buildDayHorizon(input({ now: at("18:50") })));
    const b = track(buildDayHorizon(input({ now: at("18:51") })));
    expect(b.nowMin - a.nowMin).toBe(1);
  });
});
