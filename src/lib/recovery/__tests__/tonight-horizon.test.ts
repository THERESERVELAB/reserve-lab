import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";
import { RECOVERY_HORIZON, buildRecoveryHorizon, type RecoveryHorizon, type RecoveryHorizonInput } from "../tonight-horizon";
import type { RecoverySuiteTool } from "../types";

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

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const NAMES: Record<string, string> = {
  "sleep-protection": "Sleep Protection",
  breathwork: "Breathwork",
  walking: "Walking",
  hydration: "Hydration",
  "mobility-reset": "Mobility Reset",
  "recovery-nutrition": "Recovery Nutrition",
};

function tool(id: string, over: Partial<RecoverySuiteTool> = {}): RecoverySuiteTool {
  return { id, name: NAMES[id] ?? id, durationLabel: "5–8 min", recommendation: "optional", reason: "", completed: false, ...over };
}

function input(over: Partial<RecoveryHorizonInput> = {}): RecoveryHorizonInput {
  return {
    now: at("16:12"),
    schedule: SCHEDULE,
    trainingContext: { trainingPlanned: true, direction: "unchanged" },
    recoveryDay: false,
    suite: [],
    ...over,
  };
}

function track(horizon: RecoveryHorizon) {
  if (horizon.state !== "track") throw new Error(`expected a track, got ${horizon.state}`);
  return horizon;
}

describe("buildRecoveryHorizon — schedule markers", () => {
  it("reads an evening training day as handoff, downshift, then sleep lock", () => {
    const h = track(buildRecoveryHorizon(input()));

    expect(h.items.map((i) => i.label)).toEqual(["Post-Session Handoff", "Recovery Downshift", "Sleep Lock"]);
    expect(h.lanes.map((l) => l.id)).toEqual(["recovery", "sleep"]);
    expect(h.lanes[0].items.map((i) => i.label)).toEqual(["Post-Session Handoff", "Recovery Downshift"]);
    expect(h.lanes[1].items.map((i) => i.label)).toEqual(["Sleep Lock"]);
    expect(h.sleepLock).toEqual({ min: minutes("22:30"), label: "10:30 PM" });
    expect(h.window).toEqual({
      startMin: minutes("16:12") - RECOVERY_HORIZON.lookBackMin,
      endMin: minutes("22:30") + RECOVERY_HORIZON.tailMin,
    });
  });

  it("marks the first upcoming item due next, and only that one", () => {
    const h = track(buildRecoveryHorizon(input()));
    expect(h.items.map((i) => i.status)).toEqual(["due-next", "upcoming", "upcoming"]);
  });

  it("puts the evening wind-down on the sleep lane on a recovery day, and counts what fell behind the window", () => {
    const h = track(buildRecoveryHorizon(input({ now: at("20:00"), recoveryDay: true })));

    expect(h.items.map((i) => i.label)).toEqual(["Evening Wind-Down", "Sleep Lock"]);
    expect(h.lanes[0].items).toEqual([]);
    expect(h.lanes[1].items.map((i) => i.label)).toEqual(["Evening Wind-Down", "Sleep Lock"]);
    /* The 9:30 AM hydration check is part of today, not tonight. */
    expect(h.earlier).toBe(1);
  });

  it("treats a session moved off today the same as a recovery day", () => {
    const moved = track(buildRecoveryHorizon(input({ now: at("20:00"), trainingContext: { trainingPlanned: false, direction: "moved-away" } })));
    const rest = track(buildRecoveryHorizon(input({ now: at("20:00"), recoveryDay: true })));
    expect(moved.items.map((i) => i.id)).toEqual(rest.items.map((i) => i.id));
  });

  it("carries a sleep lock past midnight on the same minute Apex uses", () => {
    const late = { ...SCHEDULE, sleepTarget: "00:30" };
    const h = track(buildRecoveryHorizon(input({ schedule: late, now: at("23:50") })));

    expect(h.sleepLock).toEqual({ min: 1440 + 30, label: "12:30 AM" });
    expect(h.items[h.items.length - 1]).toMatchObject({ label: "Sleep Lock", startMin: 1470, timeLabel: "12:30 AM" });

    const after = buildRecoveryHorizon(input({ schedule: late, now: at("00:40") }));
    expect(after).toMatchObject({ state: "quiet", reason: "after-sleep-lock" });
  });
});

describe("buildRecoveryHorizon — Recovery Suite", () => {
  it("anchors each flagged tool to the marker it belongs with, and says so", () => {
    const h = track(
      buildRecoveryHorizon(
        input({
          now: at("20:00"),
          recoveryDay: true,
          suite: [
            tool("sleep-protection", { recommendation: "recommended", durationLabel: "tonight" }),
            tool("breathwork", { recommendation: "recommended" }),
          ],
        }),
      ),
    );

    const windDown = h.items.find((i) => i.label === "Evening Wind-Down")!;
    const protection = h.items.find((i) => i.id === "suite-sleep-protection")!;
    const breathwork = h.items.find((i) => i.id === "suite-breathwork")!;

    expect(protection).toMatchObject({ lane: "sleep", startMin: windDown.startMin, sub: "Tonight · with Evening Wind-Down" });
    expect(breathwork).toMatchObject({ lane: "recovery", startMin: windDown.startMin, sub: "5–8 min · with Evening Wind-Down" });
    /* A tie reads the schedule marker first, then the tool anchored to it. */
    expect(h.lanes[1].items.map((i) => i.id)).toEqual(["sched-evening-wind-down", "suite-sleep-protection", "sched-sleep-target"]);
  });

  it("leaves out optional and not-needed tools, and tools that belong to another room", () => {
    const h = track(
      buildRecoveryHorizon(
        input({
          suite: [
            tool("walking"),
            tool("mobility-reset", { recommendation: "not-needed" }),
            tool("recovery-nutrition", { recommendation: "recommended", completed: true }),
          ],
        }),
      ),
    );
    expect(h.items.every((i) => i.source === "schedule")).toBe(true);
  });

  it("keeps a completed tool visible as completed, with a way to take it back", () => {
    const h = track(buildRecoveryHorizon(input({ suite: [tool("walking", { completed: true })] })));
    const walking = h.items.find((i) => i.id === "suite-walking")!;

    expect(walking.status).toBe("completed");
    expect(walking.sub).toBe("5–8 min · with Recovery Downshift");
    expect(walking.actions).toEqual([{ kind: "toggle-suite-tool", label: "Mark Not Done", toolId: "walking" }]);
  });

  it("sits a hydration top-up at the now gate", () => {
    const h = track(buildRecoveryHorizon(input({ suite: [tool("hydration", { recommendation: "recommended", durationLabel: "now" })] })));
    const hydration = h.items.find((i) => i.id === "suite-hydration")!;
    expect(hydration).toMatchObject({ startMin: minutes("16:12"), status: "due-now", sub: "Now" });
  });

  it("falls back to sleep lock when the wind-down has already passed", () => {
    const h = track(
      buildRecoveryHorizon(
        input({ now: at("22:00"), recoveryDay: true, suite: [tool("sleep-protection", { recommendation: "recommended", durationLabel: "tonight" })] }),
      ),
    );
    /* The 9:40 PM wind-down is 20 minutes past: still behind the gate and due now, but no
       longer an anchor. Sleep lock is 30 minutes out, past the 20-minute due-now window, so
       it and the tool anchored to it read ahead of now, and the marker wins the tie for due next. */
    expect(h.items.map((i) => [i.id, i.status])).toEqual([
      ["sched-evening-wind-down", "due-now"],
      ["sched-sleep-target", "due-next"],
      ["suite-sleep-protection", "upcoming"],
    ]);
    expect(h.items.find((i) => i.id === "suite-sleep-protection")).toMatchObject({
      startMin: minutes("22:30"),
      sub: "Tonight · with Sleep Lock",
    });
  });
});

describe("buildRecoveryHorizon — no dead buttons, no empty track", () => {
  it("gives every item at least one real action", () => {
    const suite = [
      tool("sleep-protection", { recommendation: "recommended" }),
      tool("breathwork", { recommendation: "recommended" }),
      tool("hydration", { recommendation: "recommended", durationLabel: "now" }),
      tool("walking", { completed: true }),
    ];
    const cases = [
      input({ suite }),
      input({ now: at("09:00"), recoveryDay: true, suite }),
      input({ now: at("21:00"), recoveryDay: true, suite }),
    ];
    for (const c of cases) {
      for (const item of track(buildRecoveryHorizon(c)).items) {
        expect(item.actions.length, item.id).toBeGreaterThan(0);
        for (const action of item.actions) expect(action.label.trim(), item.id).not.toBe("");
      }
    }
  });

  it("logs the amount a hydration check names", () => {
    const h = track(buildRecoveryHorizon(input({ now: at("09:00"), recoveryDay: true })));
    const check = h.items.find((i) => i.label === "Hydration Check")!;
    expect(check.actions).toEqual([{ kind: "log-hydration", label: "Log 16 oz Water", oz: 16 }]);
  });

  it("is quiet before wake", () => {
    const h = buildRecoveryHorizon(input({ now: at("05:10") }));
    expect(h.state).toBe("quiet");
    if (h.state !== "quiet") return;
    expect(h.reason).toBe("before-wake");
    expect(h.detail).toContain("6:30 AM");
    expect(h.detail).toContain("10:30 PM");
  });

  it("is quiet after sleep lock", () => {
    const h = buildRecoveryHorizon(input({ now: at("22:30") }));
    expect(h).toMatchObject({ state: "quiet", reason: "after-sleep-lock", headline: "Past sleep lock" });
  });

  it("depends only on the clock it is given", () => {
    expect(buildRecoveryHorizon(input())).toEqual(buildRecoveryHorizon(input()));
    const a = track(buildRecoveryHorizon(input({ now: at("18:50") })));
    const b = track(buildRecoveryHorizon(input({ now: at("18:51") })));
    expect(b.nowMin - a.nowMin).toBe(1);
  });
});
