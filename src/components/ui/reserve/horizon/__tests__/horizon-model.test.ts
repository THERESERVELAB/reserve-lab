import { describe, expect, it } from "vitest";

import { horizonFrame, layoutHorizonLane, type HorizonChip } from "@/lib/apex/horizon-projection";
import type { ApexItemStatus } from "@/lib/apex/today-types";

import {
  chipFace,
  describeHorizonItems,
  horizonTrackHeightPx,
  isLiveStatus,
  isSettledStatus,
  labelFits,
  spineWindow,
  type HorizonItem,
} from "../horizon-model";

function item(id: string, status: ApexItemStatus = "upcoming", label = id, timeLabel = "4:00 PM"): HorizonItem {
  return { id, label, sub: null, startMin: 0, endMin: null, timeLabel, status };
}

function chip(overrides: Partial<HorizonChip<HorizonItem>>): HorizonChip<HorizonItem> {
  return {
    key: "c",
    items: [item("Pre-Workout Meal", "upcoming")],
    mode: "chip",
    x: 0.4,
    depth: 1,
    shiftPx: 0,
    widthPx: null,
    maxWidthPx: 200,
    hitShiftPx: 0,
    occupies: [0, 200],
    ...overrides,
  };
}

describe("labelFits", () => {
  it("fits anything when there is no width limit", () => {
    expect(labelFits("A very long label indeed", 13, null)).toBe(true);
  });

  it("budgets an upper-bound character width plus padding", () => {
    /* 11 chars × 13px × 0.62 + 22 = 110.66 */
    expect(labelFits("Pre-workout", 13, 111)).toBe(true);
    expect(labelFits("Pre-workout", 13, 110)).toBe(false);
  });
});

describe("status groups", () => {
  it("splits the canonical status set into still-ahead and settled, with no overlap", () => {
    const all: ApexItemStatus[] = ["due-now", "due-next", "upcoming", "past-due", "completed", "skipped"];
    expect(all.filter(isLiveStatus)).toEqual(["due-now", "due-next", "upcoming"]);
    expect(all.filter(isSettledStatus)).toEqual(["past-due", "completed", "skipped"]);
  });
});

describe("spineWindow", () => {
  const day: HorizonItem[] = [
    item("a", "completed"),
    item("b", "completed"),
    item("c", "past-due"),
    item("d", "due-now"),
    item("e", "due-next"),
    item("f"),
    item("g"),
    item("h"),
  ];

  it("starts one row before the first item still ahead, five rows long", () => {
    const win = spineWindow(day, false);
    expect(win.shown.map((i) => i.id)).toEqual(["c", "d", "e", "f", "g"]);
    expect(win.hiddenBefore).toBe(2);
    expect(win.hiddenAfter).toBe(1);
    expect(win.liveIndex).toBe(1);
  });

  it("shows everything when expanded", () => {
    const win = spineWindow(day, true);
    expect(win.shown).toHaveLength(day.length);
    expect(win.hiddenBefore + win.hiddenAfter).toBe(0);
    expect(win.liveIndex).toBe(3);
  });

  it("with nothing ahead, shows the last rows and no live row", () => {
    const done = day.map((i) => ({ ...i, status: "completed" as const }));
    const win = spineWindow(done, false);
    expect(win.shown.map((i) => i.id)).toEqual(["d", "e", "f", "g", "h"]);
    expect(win.hiddenBefore).toBe(3);
    expect(win.liveIndex).toBe(-1);
  });

  it("never hides rows from a short day", () => {
    const win = spineWindow(day.slice(3, 6), false);
    expect(win.shown).toHaveLength(3);
    expect(win.hiddenBefore + win.hiddenAfter).toBe(0);
  });
});

describe("describeHorizonItems", () => {
  it("names each item, its time and its status word", () => {
    expect(describeHorizonItems([item("Cardio", "due-now", "Cardio", "7:05 PM"), item("Abs", "completed", "Abs", "7:20 PM")])).toBe(
      "Cardio, 7:05 PM, Due now; Abs, 7:20 PM, Completed",
    );
  });
});

describe("horizonTrackHeightPx", () => {
  it("is the tick band plus 56px per lane at the gate", () => {
    expect(horizonTrackHeightPx(2)).toBe(136);
    expect(horizonTrackHeightPx(3)).toBe(192);
  });
});

describe("chipFace", () => {
  it("keeps a chip's short name when it fits its room", () => {
    const face = chipFace(chip({}), 13, true);
    expect(face).toMatchObject({ label: "Pre-Workout", dot: false, tick: false, dotShiftPx: null });
    expect(face.position).toEqual({ left: "40%", maxWidth: 200 });
  });

  it("draws a dot, never a cut-off label, when fitting labels", () => {
    const face = chipFace(chip({ maxWidthPx: 60 }), 13, true);
    expect(face.dot).toBe(true);
    expect(face.position).toEqual({ left: "calc(40% + 22px)" });
    expect(face.dotShiftPx).toBe(-22);
  });

  it("keeps the label (for its container to truncate) when not fitting labels", () => {
    const face = chipFace(chip({ maxWidthPx: 60 }), 13, false);
    expect(face.dot).toBe(false);
    expect(face.label).toBe("Pre-Workout");
  });

  it("reads a last item backward with its time, or with its name alone when the time does not fit", () => {
    const sleep = [item("Sleep Lock", "upcoming", "Sleep Lock", "10:30 PM")];
    const roomy = chipFace(chip({ mode: "end", x: 0.9, items: sleep, maxWidthPx: 220 }), 11, true);
    expect(roomy.label).toBe("Sleep lock · 10:30 PM");
    expect(roomy.position).toEqual({ right: "calc(10% + 6px)", maxWidth: 220 });

    const tight = chipFace(chip({ mode: "end", x: 0.9, items: sleep, maxWidthPx: 150 }), 11, true);
    expect(tight.label).toBe("Sleep lock");
    expect(tight.dot).toBe(false);
  });

  it("keeps a stepped-aside dot on its minute", () => {
    const face = chipFace(chip({ mode: "dot", maxWidthPx: null, hitShiftPx: -6 }), 11, true);
    expect(face.dot).toBe(true);
    expect(face.position).toEqual({ left: "calc(40% + -6px)" });
    expect(face.dotShiftPx).toBe(6);
  });

  it("names a cluster by its first item and ticks a completed single item", () => {
    expect(chipFace(chip({ items: [item("Cardio"), item("Abs")] }), 13, true).label).toBe("Cardio +1");
    expect(chipFace(chip({ items: [item("Cardio", "completed")] }), 13, true).tick).toBe(true);
  });

  it("on a real lane, a fitted label never needs more room than its chip has", () => {
    const frame = horizonFrame({ startMin: 12 * 60, endMin: 23 * 60 }, 16 * 60, 540);
    const lane: HorizonItem[] = [
      { ...item("Pre-Workout Meal", "due-now"), startMin: 16 * 60 },
      { ...item("Mobility Primer"), startMin: 17 * 60 + 17 },
      { ...item("Evening Wind-Down"), startMin: 21 * 60 + 30 },
      { ...item("Hydration Check"), startMin: 21 * 60 + 45 },
      { ...item("Sleep Lock", "upcoming", "Sleep Lock", "10:30 PM"), startMin: 22 * 60 + 30 },
    ];
    for (const laid of layoutHorizonLane(lane, 0, frame)) {
      const face = chipFace(laid, 13, true);
      if (!face.dot && laid.maxWidthPx !== null) expect(labelFits(face.label, 13, laid.maxWidthPx)).toBe(true);
    }
  });
});
