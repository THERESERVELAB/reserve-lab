import { describe, expect, it } from "vitest";

import {
  HORIZON,
  SPINE_FADE_FLOOR,
  chipMetrics,
  horizonDepthFor,
  horizonFrame,
  horizonTicks,
  laneShiftPx,
  laneYPx,
  layoutHorizonLane,
  projectMinute,
  spineFade,
  spineInk,
} from "../horizon-projection";
import type { ApexItemStatus, ApexLaneItem } from "../today-types";

/* 4:12 PM, window noon → 11 PM, the day the Pit Wall e2e seeds. */
const WINDOW = { startMin: 12 * 60 + 12, endMin: 23 * 60 };
const NOW = 16 * 60 + 12;

function item(id: string, startMin: number, endMin: number | null = null, status: ApexItemStatus = "upcoming"): ApexLaneItem {
  return { id, lane: "training", label: id, sub: null, startMin, endMin, timeLabel: "", status, action: null, logOnly: false };
}

/* WCAG relative luminance of an sRGB channel triple. */
function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg: number[], alpha: number, bg: number[]): number {
  const mixed = fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
  const [hi, lo] = [luminance(mixed), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

describe("horizon frame", () => {
  it("puts the gate near the viewer and compresses depth on narrow tracks", () => {
    expect(horizonDepthFor(430)).toBeLessThan(horizonDepthFor(540));
    expect(horizonDepthFor(540)).toBeLessThan(horizonDepthFor(700));
    expect(horizonDepthFor(2000)).toBe(2.6);
    expect(horizonDepthFor(200)).toBe(1);
    // An unmeasured (hidden) track falls back to the default instead of dividing by zero.
    expect(horizonFrame(WINDOW, NOW, 0).trackPx).toBe(HORIZON.defaultTrackPx);

    const frame = horizonFrame(WINDOW, NOW, 700);
    expect(frame.gate).toBeCloseTo(0.2, 3);
    expect(frame.anchorMin).toBe(NOW);
  });

  it("eases the gate out from the start of the window, and handles now outside it", () => {
    expect(horizonFrame(WINDOW, WINDOW.startMin, 700).gate).toBe(0);
    expect(horizonFrame(WINDOW, WINDOW.startMin + 45, 700).gate).toBeCloseTo(0.1, 3);
    // Before wake: no past, the whole track is ahead.
    expect(horizonFrame(WINDOW, 300, 700)).toMatchObject({ anchorMin: WINDOW.startMin, gate: 0 });
    // After the sleep lock: the whole window is behind.
    expect(horizonFrame(WINDOW, 1430, 700)).toMatchObject({ anchorMin: WINDOW.endMin, gate: 1 });
  });
});

describe("projectMinute", () => {
  const frame = horizonFrame(WINDOW, NOW, 700);

  it("maps now to the gate at full depth and the end of the window to the far edge", () => {
    expect(projectMinute(NOW, frame)).toEqual({ x: frame.gate, depth: 1, behind: false });
    expect(projectMinute(WINDOW.endMin, frame)).toEqual({ x: 1, depth: 0, behind: false });
    expect(projectMinute(WINDOW.startMin, frame)).toEqual({ x: 0, depth: 1, behind: true });
    // Out-of-window minutes clamp rather than escaping the track.
    expect(projectMinute(0, frame).x).toBe(0);
    expect(projectMinute(3000, frame).x).toBe(1);
  });

  it("is monotonic, and near hours take more track than far hours", () => {
    let last = -1;
    for (let t = WINDOW.startMin; t <= WINDOW.endMin; t += 5) {
      const { x, depth } = projectMinute(t, frame);
      expect(x).toBeGreaterThanOrEqual(last);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
      last = x;
    }
    const nextHour = projectMinute(NOW + 60, frame).x - projectMinute(NOW, frame).x;
    const lastHour = projectMinute(WINDOW.endMin, frame).x - projectMinute(WINDOW.endMin - 60, frame).x;
    expect(nextHour).toBeGreaterThan(lastHour * 3);
    // Behind the gate time is flat: equal minutes, equal track.
    const a = projectMinute(NOW - 120, frame).x - projectMinute(NOW - 180, frame).x;
    const b = projectMinute(NOW - 60, frame).x - projectMinute(NOW - 120, frame).x;
    expect(a).toBeCloseTo(b, 3);
  });

  it("keeps each lane a straight line, since x and height are both linear in depth", () => {
    const pts = [NOW + 30, NOW + 150, NOW + 330].map((t) => projectMinute(t, frame));
    const ys = pts.map((p) => laneYPx(2.5, p.depth));
    const slope1 = (ys[1] - ys[0]) / (pts[1].x - pts[0].x);
    const slope2 = (ys[2] - ys[1]) / (pts[2].x - pts[1].x);
    expect(slope1).toBeCloseTo(slope2, 0);
  });
});

describe("lanes and type stay usable at every depth", () => {
  it("converges lanes no tighter than a hit area", () => {
    for (const depth of [1, 0.5, 0]) {
      for (let lane = 0; lane < 3; lane += 1) {
        expect(laneYPx(lane + 1.5, depth) - laneYPx(lane + 0.5, depth)).toBeGreaterThanOrEqual(HORIZON.hitPx);
      }
    }
    expect(laneShiftPx(0, 1)).toBe(0);
    expect(laneShiftPx(3, 0)).toBeLessThan(laneShiftPx(0, 0));
  });

  it("keeps text at 11px or more and chips inside the 44px hit area", () => {
    for (const depth of [0, 0.25, 0.5, 1]) {
      const m = chipMetrics(depth);
      expect(m.fontPx).toBeGreaterThanOrEqual(11);
      expect(m.heightPx).toBeLessThanOrEqual(HORIZON.hitPx);
    }
    expect(chipMetrics(1).fontPx).toBeGreaterThan(chipMetrics(0).fontPx);
  });

  it("labels ticks only where they have room", () => {
    for (const width of [430, 540, 700]) {
      const labelled = horizonTicks(horizonFrame(WINDOW, NOW, width)).filter((t) => t.labelled);
      expect(labelled.length).toBeGreaterThan(0);
      for (let i = 1; i < labelled.length; i += 1) {
        expect((labelled[i].x - labelled[i - 1].x) * width).toBeGreaterThanOrEqual(HORIZON.tickLabelGapPx);
      }
    }
  });
});

describe("layoutHorizonLane", () => {
  const day = [
    item("midday", 12 * 60 + 30, null, "completed"),
    item("pre", 16 * 60, null, "due-now"),
    item("primer", 17 * 60 + 17),
    item("session", 17 * 60 + 30, 19 * 60),
    item("cardio", 19 * 60 + 5),
    item("abs", 19 * 60 + 20),
    item("wind", 21 * 60 + 30),
    item("sleep", 22 * 60 + 30),
  ];

  for (const width of [430, 540, 700, 860]) {
    it(`never overlaps two hit areas and never loses an item at ${width}px`, () => {
      const chips = layoutHorizonLane(day, 0, horizonFrame(WINDOW, NOW, width));
      expect(chips.flatMap((c) => c.items.map((i) => i.id))).toEqual(day.map((i) => i.id));
      for (const chip of chips) {
        expect(chip.occupies[1] - chip.occupies[0]).toBeGreaterThanOrEqual(HORIZON.hitPx);
      }
      for (let i = 1; i < chips.length; i += 1) {
        expect(chips[i].occupies[0]).toBeGreaterThanOrEqual(chips[i - 1].occupies[1]);
      }
    });
  }

  it("collapses items closer than a hit area, and keeps near items apart", () => {
    const chips = layoutHorizonLane(day, 0, horizonFrame(WINDOW, NOW, 540));
    const far = chips[chips.length - 1];
    const near = chips.find((c) => c.key === "pre");
    expect(near?.items).toHaveLength(1);
    expect(chips.length).toBeLessThan(day.length);
    expect(far.depth).toBeLessThan(near?.depth ?? 0);
  });

  it("drops items that ended before the window, and draws a ranged item as a range", () => {
    const chips = layoutHorizonLane([item("early", 480), item("session", 1050, 1140)], 1, horizonFrame(WINDOW, NOW, 700));
    expect(chips.map((c) => c.key)).toEqual(["session"]);
    expect(chips[0].mode).toBe("range");
    expect(chips[0].widthPx).toBeGreaterThanOrEqual(HORIZON.hitPx);
  });

  it("lets a lone last item near the end read backward from its minute", () => {
    const chips = layoutHorizonLane([item("sleep", 22 * 60 + 50)], 3, horizonFrame(WINDOW, NOW, 700));
    expect(chips[0].mode).toBe("end");
    expect(chips[0].occupies[1]).toBeLessThanOrEqual(chips[0].x * 700);
  });
});

describe("Now Spine depth fade", () => {
  it("is full at now and recedes to a floor", () => {
    expect(spineFade(-2)).toBe(1);
    expect(spineFade(0)).toBe(1);
    expect(spineFade(2)).toBeCloseTo(0.8, 5);
    expect(spineFade(40)).toBe(SPINE_FADE_FLOOR);
    expect(spineFade(Number.NaN)).toBe(1);
  });

  it("keeps every line of text at AA contrast, even on a lit glass panel", () => {
    const IVORY = [242, 238, 230];
    const WHITE = [255, 255, 255];
    const LIT_GLASS = [34, 35, 44];
    for (const fade of [1, 0.8, SPINE_FADE_FLOOR, 0]) {
      for (const settled of [false, true]) {
        const ink = spineInk(fade, settled);
        expect(contrast(IVORY, ink.label, LIT_GLASS)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(WHITE, ink.meta, LIT_GLASS)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(spineInk(SPINE_FADE_FLOOR, false).marker).toBeLessThan(spineInk(1, false).marker);
  });
});
