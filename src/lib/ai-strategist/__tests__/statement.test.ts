import { describe, expect, it } from "vitest";

import { rankWatchList, resolveStrategistRead } from "../engine";
import type { HighestRoiAction, StrategistBriefing, StrategistSignal } from "../types";

const roi: HighestRoiAction = {
  title: "Log pre-workout meal",
  reason: "The next meal window opens at 4:00 PM.",
  source: "Nutrition",
  confidence: "moderate",
  buttonLabel: "Open Nutrition Command",
  target: "nutrition",
};

function signal(over: Partial<StrategistSignal> & Pick<StrategistSignal, "id" | "title">): StrategistSignal {
  return { detail: `${over.title} detail`, source: "Recovery", confidence: "moderate", ...over };
}

function briefing(over: Partial<StrategistBriefing> = {}) {
  return { hasData: true, hurting: [], helping: [], highestRoiAction: roi, ...over };
}

describe("rankWatchList", () => {
  it("puts hurting first, most severe first, then helping in the engine's order", () => {
    const list = rankWatchList({
      hurting: [
        signal({ id: "low", title: "Photo consistency limited", severity: "low", source: "Physique" }),
        signal({ id: "mod", title: "Sleep debt building", severity: "moderate" }),
        signal({ id: "high", title: "Recovery debt accumulating", severity: "high" }),
      ],
      helping: [signal({ id: "help-a", title: "Schedule profile complete", source: "Schedule" }), signal({ id: "help-b", title: "Hydration on target" })],
    });
    expect(list.map((item) => item.id)).toEqual(["high", "mod", "low", "help-a", "help-b"]);
    expect(list.map((item) => item.kind)).toEqual(["hurting", "hurting", "hurting", "helping", "helping"]);
  });

  it("keeps the engine's order between items of equal severity", () => {
    const list = rankWatchList({
      hurting: [
        signal({ id: "a", title: "Recovery debt building", severity: "moderate" }),
        signal({ id: "b", title: "Sleep debt building", severity: "moderate" }),
      ],
      helping: [],
    });
    expect(list.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("resolveStrategistRead", () => {
  it("never says nothing is limiting while a moderate debt is listed (the audited contradiction)", () => {
    const read = resolveStrategistRead(
      briefing({
        hurting: [
          signal({ id: "x-debt", title: "Recovery debt building", severity: "moderate" }),
          signal({ id: "x-rec", title: "Sleep debt building", severity: "moderate" }),
        ],
      }),
    );
    expect(read.statement).not.toMatch(/nothing/i);
    expect(read.statement).toBe("Recovery is your limiter: recovery debt building.");
    expect(read.limiter?.id).toBe("x-debt");
  });

  it("sends the gold action to the limiting room, not the highest-ROI room", () => {
    const read = resolveStrategistRead(
      briefing({ hurting: [signal({ id: "x-debt", title: "Recovery debt building", severity: "moderate" })] }),
    );
    expect(read.action).toEqual({
      title: "Recovery debt building",
      reason: "Recovery debt building detail",
      label: "Open Recovery Command",
      target: "recovery",
    });
  });

  it("names the schedule when the schedule is what hurts", () => {
    const read = resolveStrategistRead(
      briefing({
        hurting: [signal({ id: "x-sched", title: "Late training compresses sleep target", severity: "moderate", source: "Schedule" })],
      }),
    );
    expect(read.statement).toBe("Your schedule is your limiter: late training compresses sleep target.");
    expect(read.action.target).toBe("schedule-command");
  });

  it("says nothing is limiting only when the hurting list is empty, and keeps the highest-ROI move", () => {
    const read = resolveStrategistRead(briefing({ helping: [signal({ id: "h", title: "Schedule profile complete" })] }));
    expect(read.statement).toBe("Nothing in your logs is limiting you right now.");
    expect(read.limiter).toBeNull();
    expect(read.action.target).toBe("nutrition");
  });

  it("says nothing is logged when there is no data, whatever the lists hold", () => {
    const read = resolveStrategistRead(briefing({ hasData: false }));
    expect(read.statement).toBe("Reserve has nothing logged to read yet.");
    expect(read.action.label).toBe("Open Nutrition Command");
  });

  it("falls back to the highest-ROI move for a source with no room", () => {
    const read = resolveStrategistRead(
      briefing({ hurting: [signal({ id: "b", title: "Bloodwork gap", severity: "low", source: "Bloodwork" })] }),
    );
    expect(read.statement).toBe("Bloodwork is your limiter: bloodwork gap.");
    expect(read.action.target).toBe("nutrition");
  });
});
