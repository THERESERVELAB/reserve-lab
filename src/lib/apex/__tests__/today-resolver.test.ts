import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";
import type { DayProtocol } from "@/lib/training/weekly-split";
import { resolveApexToday } from "../today-resolver";
import type { ApexLaneId, ApexToday, ApexTodayInput } from "../today-types";

const PROTOCOL: DayProtocol = {
  splitDay: 2,
  cardio: "Cooldown walk · 10 min",
  abs: "Brace · 6 min",
  sauna: "Optional · if hydrated",
  mobility: "Hips · 5 min",
  posing: null,
  nutritionFocus: "Carbs around the session",
  recoveryNote: "Protect the lower body.",
  afterSession: "Walk · abs · mobility",
};

const SCHEDULE: MemberScheduleProfile = {
  ...DEFAULT_SCHEDULE_PROFILE,
  wakeTime: "06:30",
  sleepTarget: "22:30",
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
  mobilityPreference: "pre-session",
  preSessionMobilityMinutes: 8,
};

/** Tuesday 15 September 2026 at a local wall-clock time. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 15, h, m, 0, 0);
}

function input(over: Partial<ApexTodayInput> = {}): ApexTodayInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    trainingContext: { trainingPlanned: true, direction: "unchanged" },
    today: { recovery: false, sessionName: "Legs + Abs", durationMin: 90, protocol: PROTOCOL },
    sessionMode: "pre",
    meals: [
      { id: "m-mid", windowLabel: "Midday Meal", time: "12:30", name: "Chicken rice bowl", isSnack: false },
      { id: "m-pre", windowLabel: "Pre-Workout", time: "16:00", name: "Rice cakes · whey", isSnack: false },
      { id: "m-post", windowLabel: "Post-Workout", time: "19:15", name: "Salmon · potatoes", isSnack: false },
    ],
    loggedMealIds: ["m-mid"],
    intakeSlots: [],
    watchSignals: [],
    ...over,
  };
}

const lane = (t: ApexToday, id: ApexLaneId) => {
  const found = t.lanes.find((l) => l.id === id);
  if (!found) throw new Error(`lane ${id} missing`);
  return found;
};
const allItems = (t: ApexToday) => t.lanes.flatMap((l) => l.items);
const item = (t: ApexToday, id: string) => {
  const found = allItems(t).find((i) => i.id === id);
  if (!found) throw new Error(`item ${id} missing`);
  return found;
};

describe("resolveApexToday — one day, one decision", () => {
  it("lays out training, fuel, recovery and sleep lanes in that order", () => {
    const t = resolveApexToday(input());
    expect(t.lanes.map((l) => l.id)).toEqual(["training", "fuel", "recovery", "sleep"]);
  });

  it("uses the schedule engine for everything except meals and the session", () => {
    const t = resolveApexToday(input());
    const sched = allItems(t).filter((i) => i.id.startsWith("sched-")).map((i) => i.id).sort();
    expect(sched).toEqual([
      "sched-mobility-primer",
      "sched-post-session-handoff",
      "sched-pre-session-command",
      "sched-recovery-downshift",
      "sched-sleep-target",
    ]);
    expect(item(t, "sched-sleep-target")).toMatchObject({ lane: "sleep", label: "Sleep Lock", timeLabel: "10:30 PM" });
    expect(item(t, "sched-pre-session-command").lane).toBe("training");
    expect(item(t, "sched-recovery-downshift").lane).toBe("recovery");
  });

  it("draws the fuel lane from the fuel plan only, skipping untimed meals", () => {
    const t = resolveApexToday(
      input({
        meals: [
          ...input().meals,
          { id: "m-snack", windowLabel: "Mid-Day Smart Snack", time: null, name: "Greek yogurt", isSnack: true },
        ],
      }),
    );
    expect(lane(t, "fuel").items.map((i) => i.id)).toEqual(["meal-m-mid", "meal-m-pre", "meal-m-post"]);
  });

  it("places the session and the after-session protocol on the member's training window", () => {
    const t = resolveApexToday(input());
    expect(item(t, "session")).toMatchObject({ lane: "training", label: "Legs + Abs", sub: "90 min", startMin: 1050, endMin: 1140, timeLabel: "5:30 PM" });
    expect(item(t, "protocol-cardio")).toMatchObject({ lane: "training", label: "Cardio", sub: "Cooldown walk · 10 min", startMin: 1145 });
    expect(item(t, "protocol-abs")).toMatchObject({ lane: "training", startMin: 1160 });
    expect(item(t, "protocol-sauna")).toMatchObject({ lane: "recovery", label: "Sauna", startMin: 1175 });
    expect(item(t, "protocol-mobility")).toMatchObject({ lane: "recovery", startMin: 1190 });
    expect(allItems(t).some((i) => i.id === "protocol-posing")).toBe(false);
  });

  it("makes a due-now meal the next move at 4:12 PM", () => {
    const t = resolveApexToday(input());
    expect(t.nextMove).toEqual({
      title: "Pre-Workout Meal",
      context: "Fuel window · Due now",
      whyNow: "Window closes 4:30 PM · Rice cakes · whey",
      itemId: "meal-m-pre",
      action: { kind: "log-meal", label: "Log Meal", mealId: "m-pre" },
    });
    expect(t.then?.id).toBe("sched-pre-session-command");
  });

  it("marks logged meals completed with an explicit undo, and never chases a missed meal", () => {
    const logged = resolveApexToday(input());
    expect(item(logged, "meal-m-mid")).toMatchObject({ status: "completed", action: { kind: "undo-meal-log", label: "Undo Log", mealId: "m-mid" } });

    const missed = resolveApexToday(input({ loggedMealIds: [] }));
    expect(item(missed, "meal-m-mid")).toMatchObject({ status: "past-due", action: { kind: "log-meal", label: "Log If Eaten", mealId: "m-mid" } });
    expect(missed.nextMove.itemId).toBe("meal-m-pre");
  });

  it("promotes exactly one due-next item across the day lanes", () => {
    const t = resolveApexToday(input());
    const dueNext = allItems(t).filter((i) => i.status === "due-next");
    expect(dueNext.map((i) => i.id)).toEqual(["sched-pre-session-command"]);
  });

  it("puts the session ahead of prep items once its window is due", () => {
    const t = resolveApexToday(input({ now: at("17:25") }));
    expect(item(t, "sched-pre-session-command").status).toBe("due-now");
    expect(t.nextMove).toMatchObject({
      title: "Legs + Abs",
      context: "Training · Due now",
      whyNow: "Session window 5:30 PM–7:00 PM · 90 min planned.",
      itemId: "session",
      action: { kind: "start-session", label: "Start Session" },
    });
  });

  it("always resumes a live session", () => {
    const t = resolveApexToday(input({ now: at("18:00"), sessionMode: "live" }));
    expect(t.nextMove).toMatchObject({ title: "Resume Live Session", itemId: "session", action: { kind: "start-session", label: "Resume Live Session" } });
    expect(item(t, "session").status).toBe("due-now");
  });

  it("offers review once the session is complete", () => {
    const t = resolveApexToday(input({ now: at("19:30"), sessionMode: "complete" }));
    expect(item(t, "session")).toMatchObject({ status: "completed", action: { kind: "review-session", label: "Review Session" } });
  });

  it("never offers training on a recovery day", () => {
    const t = resolveApexToday(input({ today: { recovery: true, sessionName: "Recovery + Posing", durationMin: null, protocol: PROTOCOL } }));
    expect(t.trainingPlanned).toBe(false);
    expect(allItems(t).some((i) => i.action?.kind === "start-session")).toBe(false);
    expect(allItems(t).some((i) => i.id === "session")).toBe(false);
    for (const i of lane(t, "training").items) {
      expect(i.action).toEqual({ kind: "open-view", label: "Open Recovery Command", view: "recovery" });
    }
    expect(t.nextMove.title).not.toBe("Recovery + Posing");
  });

  it("empties the training lane honestly when the session moved or was set aside", () => {
    const moved = resolveApexToday(input({ trainingContext: { trainingPlanned: false, direction: "moved-away" } }));
    expect(moved.trainingPlanned).toBe(false);
    expect(lane(moved, "training")).toMatchObject({
      items: [],
      empty: { message: "Session moved off today", action: { kind: "open-view", label: "Open Training Command", view: "training" } },
    });
    const setAside = resolveApexToday(input({ trainingContext: { trainingPlanned: false, direction: "set-aside" } }));
    expect(lane(setAside, "training").empty?.message).toBe("Session set aside today");
  });

  it("gives an unmapped fuel lane one honest move", () => {
    const t = resolveApexToday(input({ meals: [] }));
    expect(lane(t, "fuel")).toMatchObject({
      items: [],
      empty: { message: "No meal windows mapped", action: { kind: "open-view", label: "Map Meal Windows", view: "schedule-command" } },
    });
  });

  it("shows a log-only logbook lane that never drives the next move or the risk line", () => {
    const slot = { id: "s1", entryId: "e1", plannedTime: "16:10", plannedTimeLabel: "4:10 PM", status: "planned" as const, entry: { name: "Entry", displayName: "Logged item" } };
    const t = resolveApexToday(input({ loggedMealIds: ["m-mid", "m-pre"], intakeSlots: [slot] }));
    expect(t.lanes.map((l) => l.id)).toEqual(["training", "fuel", "recovery", "sleep", "logbook"]);
    expect(lane(t, "logbook").label).toBe("Logbook · user-entered · log-only");
    expect(item(t, "log-s1")).toMatchObject({
      label: "Logged item",
      sub: null,
      status: "due-now",
      logOnly: true,
      action: { kind: "mark-logged", label: "Mark Completed", entryId: "e1", plannedTime: "16:10" },
    });
    expect(t.nextMove.itemId).toBe("sched-pre-session-command");
    expect(t.risk.level).toBe("Low");
  });

  it("ranks risk: sleep compression, then high signals, then any signal", () => {
    const late: MemberScheduleProfile = { ...SCHEDULE, preferredTrainingStart: "20:30", preferredTrainingEnd: "22:00" };
    const high = { title: "Recovery debt building", severity: "high" as const };
    const moderate = { title: "Mobility skipped", severity: "moderate" as const };

    expect(resolveApexToday(input({ schedule: late, watchSignals: [high] })).risk).toEqual({ level: "Sleep compression", detail: "Short window before sleep" });
    expect(resolveApexToday(input({ watchSignals: [moderate, high] })).risk).toEqual({ level: "Elevated", detail: "Recovery debt building" });
    expect(resolveApexToday(input({ watchSignals: [moderate] })).risk).toEqual({ level: "Moderate", detail: "Mobility skipped" });
    expect(resolveApexToday(input()).risk).toEqual({ level: "Low", detail: "Sleep lock 10:30 PM" });
  });

  it("protects sleep before wake and after the sleep target", () => {
    const early = resolveApexToday(input({ now: at("05:00") }));
    expect(early.nextMove).toMatchObject({
      title: "Protect Sleep",
      context: "Overnight",
      whyNow: "It's before your 6:30 AM wake time — rest supports tomorrow's readiness.",
      action: { kind: "open-view", label: "Open Recovery Command", view: "recovery" },
    });
    const late = resolveApexToday(input({ now: at("23:00") }));
    expect(late.nextMove).toMatchObject({ title: "Protect Sleep", context: "Sleep lock", itemId: "sched-sleep-target" });
  });

  it("looks back four hours, never before wake, and ends just after the sleep lock", () => {
    expect(resolveApexToday(input()).window).toEqual({ startMin: 732, endMin: 1380 });
    expect(resolveApexToday(input({ now: at("07:00") })).window.startMin).toBe(390);
    expect(resolveApexToday(input({ now: at("20:30") })).window.startMin).toBe(990);
    expect(resolveApexToday(input()).sleepLock).toEqual({ min: 1350, label: "10:30 PM" });
  });

  it("counts only actionable items that fell before the window", () => {
    const t = resolveApexToday(input({ now: at("20:30") }));
    expect(t.earlier).toEqual({ done: 1, total: 2 });
  });
});
