import { describe, expect, it } from "vitest";

import { RESERVE } from "@/lib/design/tokens";
import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import {
  HORIZON_ALPHA,
  LIGHT_FLOW_PALETTE,
  LIGHT_FLOW_SURGE_AFTER_MOMENT_MS,
  LIGHT_FLOW_SURGE_LEAD_MS,
  LIGHT_FLOW_TRAVEL_MS,
  SURGE_MIN_RAIL_PX,
  PASS_MAX_SEAM_SHARE,
  passHeadPx,
  PASS_STROKES,
  ROOM_LIGHT_BUDGET,
  budgetForRoom,
  deviceSeamCap,
  horizonGeometry,
  horizonY,
  isLowEnd,
  litSeams,
  paletteForRoom,
  passCycleMs,
  passDelayMs,
  passStrokes,
  pathLength,
  pointAt,
  resolveLightFlow,
  resolveSurge,
  rgba,
  roundPolyline,
  seamPaths,
  surgePath,
  type LightFlowInput,
} from "@/lib/ui/light-flow";
import { LOG_MOMENT_ARRIVAL_MS } from "@/lib/ui/log-moment";

/* The light flow layer is a decision module with a renderer attached. Every
   rule that matters — what silences it, how dense it may be, which hues it
   may use, where its seams run — is decided here and provable here. */

const BASE: LightFlowInput = {
  motion: "full",
  room: "apex",
  daypart: "day",
  liveSession: false,
  logMomentBoom: false,
  settled: true,
  viewportWidth: 1440,
  energy: 1,
  cores: 12,
  saveData: false,
};

describe("the gate", () => {
  it("runs in a settled daytime room under full motion", () => {
    const plan = resolveLightFlow(BASE);
    expect(plan.active).toBe(true);
    expect(plan.reason).toBe("live");
    expect(plan.seams).toBeGreaterThan(0);
    expect(plan.horizon).toBe(true);
  });

  const silenced: Array<[string, Partial<LightFlowInput>, string]> = [
    ["the member paused background motion", { motion: "static" }, "paused"],
    ["the tab is hidden (the gate calls that static too)", { motion: "static" }, "paused"],
    ["the operating system asks for reduced motion", { motion: "reduced" }, "reduced"],
    ["a live session is running", { liveSession: true }, "live-session"],
    ["it is night in the member's own day", { daypart: "night" }, "night"],
    ["the screen has not settled yet", { settled: false }, "settling"],
  ];

  it.each(silenced)("draws nothing at all when %s", (_why, patch, reason) => {
    const plan = resolveLightFlow({ ...BASE, ...patch });
    expect(plan.active).toBe(false);
    expect(plan.seams).toBe(0);
    expect(plan.horizon).toBe(false);
    expect(plan.alpha).toBe(0);
    expect(plan.reason).toBe(reason);
  });

  it("keeps the horizon but stops every traveller while a log moment plays", () => {
    const plan = resolveLightFlow({ ...BASE, logMomentBoom: true });
    expect(plan.active).toBe(true);
    expect(plan.horizon).toBe(true);
    expect(plan.seams).toBe(0);
    expect(plan.reason).toBe("log-moment");
  });

  it("silences in precedence order: a paused member at night in a session is paused", () => {
    expect(resolveLightFlow({ ...BASE, motion: "static", liveSession: true, daypart: "night" }).reason).toBe("paused");
    expect(resolveLightFlow({ ...BASE, motion: "reduced", liveSession: true, daypart: "night" }).reason).toBe("reduced");
    expect(resolveLightFlow({ ...BASE, liveSession: true, daypart: "night" }).reason).toBe("live-session");
  });

  it("never runs under anything but full motion", () => {
    const modes: AmbientMotion[] = ["full", "reduced", "static"];
    const active = modes.filter((motion) => resolveLightFlow({ ...BASE, motion }).active);
    expect(active).toEqual(["full"]);
  });

  it("dawn and day both run; only night rests", () => {
    expect(resolveLightFlow({ ...BASE, daypart: "dawn" }).active).toBe(true);
    expect(resolveLightFlow({ ...BASE, daypart: null }).active).toBe(true);
    expect(resolveLightFlow({ ...BASE, daypart: "night" }).active).toBe(false);
  });
});

describe("density", () => {
  it("caps by viewport: a phone carries one seam, a laptop two, a wide desktop three", () => {
    expect(deviceSeamCap({ viewportWidth: 390, cores: 12, saveData: false })).toBe(1);
    expect(deviceSeamCap({ viewportWidth: 1024, cores: 12, saveData: false })).toBe(2);
    expect(deviceSeamCap({ viewportWidth: 1440, cores: 12, saveData: false })).toBe(3);
  });

  it("holds a low-end device to one seam and a still horizon at any width", () => {
    expect(isLowEnd({ cores: 4, saveData: false })).toBe(true);
    expect(isLowEnd({ cores: 0, saveData: false })).toBe(false);
    expect(isLowEnd({ cores: 16, saveData: true })).toBe(true);
    const plan = resolveLightFlow({ ...BASE, cores: 4, viewportWidth: 1440 });
    expect(plan.seams).toBe(1);
    expect(plan.breath).toBe(false);
    expect(plan.horizon).toBe(true);
  });

  it("never lights more seams than the room's own budget allows", () => {
    for (const [room, budget] of Object.entries(ROOM_LIGHT_BUDGET)) {
      const plan = resolveLightFlow({ ...BASE, room, viewportWidth: 1920 });
      expect(plan.seams, room).toBeLessThanOrEqual(budget.seams);
      expect(plan.seams, room).toBeLessThanOrEqual(3);
    }
  });

  it("at 390 every room carries exactly one seam", () => {
    for (const room of Object.keys(ROOM_LIGHT_BUDGET)) {
      expect(resolveLightFlow({ ...BASE, room, viewportWidth: 390 }).seams, room).toBe(1);
    }
  });

  it("gives Recovery the lowest light in the product and Apex the most", () => {
    const recovery = resolveLightFlow({ ...BASE, room: "recovery" });
    const apex = resolveLightFlow({ ...BASE, room: "apex" });
    expect(recovery.alpha).toBeLessThan(apex.alpha);
    expect(recovery.seams).toBe(1);
    expect(budgetForRoom("recovery").restMs).toBeGreaterThan(budgetForRoom("apex").restMs);
  });

  it("an unknown room falls back to neutral rather than going bright", () => {
    expect(budgetForRoom("nowhere")).toEqual(ROOM_LIGHT_BUDGET.neutral);
    expect(resolveLightFlow({ ...BASE, room: "nowhere" }).seams).toBe(1);
  });

  it("is dimmer when the member is less ready (motion is a readout)", () => {
    const ready = resolveLightFlow({ ...BASE, energy: 1 }).alpha;
    const tired = resolveLightFlow({ ...BASE, energy: 0.55 }).alpha;
    expect(tired).toBeLessThan(ready);
    /* …and never empties the room. */
    expect(resolveLightFlow({ ...BASE, energy: 0 }).alpha).toBeGreaterThan(0);
  });
});

describe("palette", () => {
  const closed = new Set(Object.values(RESERVE));

  it("uses only hues the closed Reserve palette already holds", () => {
    for (const [room, palette] of Object.entries(LIGHT_FLOW_PALETTE)) {
      expect(closed.has(palette.warm as never), `${room} warm`).toBe(true);
      expect(closed.has(palette.cold as never), `${room} cold`).toBe(true);
    }
  });

  it("never uses the alert red as weather", () => {
    for (const palette of Object.values(LIGHT_FLOW_PALETTE)) {
      expect([palette.warm, palette.cold, palette.core]).not.toContain(RESERVE.red);
    }
  });

  it("keeps ivory for the hot core of a head and nothing else", () => {
    for (const palette of Object.values(LIGHT_FLOW_PALETTE)) {
      expect(palette.core).toBe(RESERVE.ivory);
      expect(palette.warm).not.toBe(RESERVE.ivory);
      expect(palette.cold).not.toBe(RESERVE.ivory);
    }
  });

  it("leads each room with the accent that room already owns", () => {
    expect(paletteForRoom("apex").warm).toBe(RESERVE.gold);
    expect(paletteForRoom("training").warm).toBe(RESERVE.gold);
    expect(paletteForRoom("nutrition").warm).toBe(RESERVE.amber);
    expect(paletteForRoom("recovery").warm).toBe(RESERVE.violet);
    expect(paletteForRoom("clinical").warm).toBe(RESERVE.steel);
    expect(paletteForRoom("nowhere").warm).toBe(RESERVE.gold);
  });

  it("writes a stroke colour a browser can read", () => {
    expect(rgba(RESERVE.gold, 0.5)).toBe("rgba(213, 177, 95, 0.5)");
    expect(rgba("#fff", 2)).toBe("rgba(255, 255, 255, 1)");
    expect(rgba(RESERVE.steel, -1)).toBe("rgba(95, 183, 213, 0)");
  });

  it("keeps every persistent alpha under the ambient ceiling", () => {
    /* Shipped ambient washes sit at 0.045–0.13; anything persistent above
       about 0.13 reads as glow rather than architecture. */
    for (const value of Object.values(HORIZON_ALPHA)) expect(value).toBeLessThanOrEqual(0.13);
  });
});

describe("seams", () => {
  const size = { width: 1440, height: 900, phone: false };

  it("runs the hero's own edge, the frame and the horizon rail — and no more", () => {
    const seams = seamPaths({ ...size, hero: { x: 220, y: 140, width: 700, height: 120 } });
    expect(seams.map((seam) => seam.id)).toEqual(["hero", "frame", "base"]);
    expect(seams.length).toBeLessThanOrEqual(3);
  });

  it("keeps the frame and the rail when there is no hero to trace", () => {
    const seams = seamPaths({ ...size, hero: null });
    expect(seams.map((seam) => seam.id)).toEqual(["frame", "base"]);
  });

  it("ignores a hero too small or off the bottom to trace", () => {
    expect(seamPaths({ ...size, hero: { x: 10, y: 10, width: 20, height: 10 } }).map((s) => s.id)).toEqual(["frame", "base"]);
    expect(seamPaths({ ...size, hero: { x: 10, y: 2000, width: 700, height: 120 } }).map((s) => s.id)).toEqual(["frame", "base"]);
  });

  it("lights the hero first, so the one seam a phone carries is the hero's", () => {
    const seams = seamPaths({ width: 390, height: 844, phone: true, hero: { x: 12, y: 120, width: 360, height: 90 } });
    const plan = resolveLightFlow({ ...BASE, viewportWidth: 390 });
    expect(litSeams(seams, plan).map((seam) => seam.id)).toEqual(["hero"]);
  });

  it("draws nothing for an unmeasured viewport", () => {
    expect(seamPaths({ width: 0, height: 0, phone: false, hero: null })).toEqual([]);
  });

  it("keeps every seam inside the viewport", () => {
    const seams = seamPaths({ ...size, hero: { x: 220, y: 140, width: 2000, height: 120 } });
    for (const seam of seams) {
      for (const point of seam.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(size.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("puts the horizon above the fold on a phone and at the middle on desktop", () => {
    expect(horizonY({ height: 844, phone: true })).toBe(388);
    expect(horizonY({ height: 900, phone: false })).toBe(468);
  });
});

describe("geometry", () => {
  it("measures a polyline and walks it", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(pathLength(points)).toBe(200);
    expect(pointAt(points, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(points, 0.25)).toEqual({ x: 50, y: 0 });
    expect(pointAt(points, 0.75)).toEqual({ x: 100, y: 50 });
    expect(pointAt(points, 1)).toEqual({ x: 100, y: 100 });
    expect(pointAt([], 0.5)).toEqual({ x: 0, y: 0 });
  });

  it("turns a corner rather than snapping it", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const rounded = roundPolyline(square, 18, 4);
    expect(rounded.length).toBeGreaterThan(square.length);
    /* The sharp vertex is gone. */
    expect(rounded.some((point) => point.x === 100 && point.y === 0)).toBe(false);
    /* …and the corner is shorter than the two straight legs it replaced. */
    expect(pathLength(rounded)).toBeLessThan(pathLength(square));
  });

  it("leaves a two-point seam alone", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(roundPolyline(line)).toEqual(line);
  });

  it("converges every horizon lane on one vanishing point at the line", () => {
    const geometry = horizonGeometry({ width: 1440, height: 900, phone: false });
    expect(geometry.vanish).toEqual({ x: 720, y: 468 });
    expect(geometry.lanes).toHaveLength(11);
    expect(geometry.rows).toHaveLength(6);
    for (const lane of geometry.lanes) expect(lane.startsWith("M720 468")).toBe(true);
    /* Rows recede: each gap is wider than the last, as perspective requires. */
    const ys = geometry.rows.map((row) => Number(/M0 ([\d.]+)/.exec(row)![1]));
    const gaps = ys.slice(1).map((y, i) => y - ys[i]);
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });

  it("thins the horizon on a phone", () => {
    const phone = horizonGeometry({ width: 390, height: 844, phone: true });
    expect(phone.lanes).toHaveLength(7);
    expect(phone.rows).toHaveLength(4);
  });
});

describe("the pass", () => {
  it("is one bright head, with a bloom around it and a tail falling behind", () => {
    const strokes = passStrokes(1000);
    const roles = strokes.map((stroke) => stroke.role);
    expect(roles[0]).toBe("bloom");
    expect(roles[roles.length - 1]).toBe("core");
    const core = strokes[strokes.length - 1];
    const bloom = strokes[0];
    /* Only the core is bright, and only the bloom is wide. */
    expect(core.alpha).toBeGreaterThan(0.8);
    expect(bloom.alpha).toBeLessThan(0.15);
    expect(bloom.width).toBeGreaterThan(core.width * 3);
    /* Behind the head the light only ever falls away. */
    const behind = strokes.filter((stroke) => stroke.role !== "bloom").sort((a, b) => a.dash - b.dash);
    for (let i = 1; i < behind.length; i += 1) expect(behind[i].alpha).toBeLessThan(behind[i - 1].alpha);
  });

  it("paints the core last, so nothing is drawn over the head", () => {
    expect(PASS_STROKES[PASS_STROKES.length - 1].role).toBe("core");
    expect(PASS_STROKES.filter((stroke) => stroke.role === "core")).toHaveLength(1);
  });

  it("keeps every stroke's leading edge together for the whole pass", () => {
    const strokes = passStrokes(1000);
    /* Leading edge = dash - offset. Equal at the start and at the end means
       equal throughout, because every stroke travels the same distance. */
    const leadingAtStart = strokes.map((stroke) => stroke.dash - stroke.from);
    const leadingAtEnd = strokes.map((stroke) => stroke.dash - stroke.to);
    expect(new Set(leadingAtStart).size).toBe(1);
    expect(new Set(leadingAtEnd).size).toBe(1);
    expect(leadingAtStart[0]).toBe(0);
    expect(leadingAtEnd[0]).toBe(1000 + passHeadPx(1000));
  });

  it("leaves the seam dark: a traveller never covers a quarter of its seam", () => {
    /* Including the shortest seam a phone's hero can produce. */
    for (const length of [120, 300, 414, 900, 1440, 4000]) {
      const longest = Math.max(...passStrokes(length).map((stroke) => stroke.dash));
      expect(longest / length, `${length}px seam`).toBeLessThanOrEqual(PASS_MAX_SEAM_SHARE);
    }
  });

  it("scales the head to its own seam, floored and capped", () => {
    expect(passHeadPx(1000)).toBe(60);
    expect(passHeadPx(6000)).toBe(90);
    /* …and the share cap wins over the floor on a seam too short for it. */
    expect(passHeadPx(100)).toBeLessThan(26);
  });

  it("stays inside the atmosphere band: 9s to 20s, and never faster than 1.6s", () => {
    for (const [room, budget] of Object.entries(ROOM_LIGHT_BUDGET)) {
      const cycle = passCycleMs(budget.restMs);
      expect(cycle, room).toBeGreaterThanOrEqual(9000);
      expect(cycle, room).toBeLessThanOrEqual(20000);
      /* The travel is 16% of the cycle, and is never faster than the floor. */
      expect((cycle * 16) / 100, room).toBeGreaterThan(1600);
    }
    expect(LIGHT_FLOW_TRAVEL_MS).toBeGreaterThan(1600);
  });

  it("gives a room the Bible lights lower a slower pass as well as a dimmer one", () => {
    expect(passCycleMs(budgetForRoom("recovery").restMs)).toBeGreaterThan(passCycleMs(budgetForRoom("apex").restMs));
  });

  it("staggers seams so two are never lit together", () => {
    const rest = 15000;
    const delays = [0, 1, 2].map((index) => passDelayMs(index, rest));
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
    /* Each is separated by more than one pass, so the first is over before
       the next begins. */
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i] - delays[i - 1]).toBeGreaterThan(LIGHT_FLOW_TRAVEL_MS);
    }
  });

  it("never starts a pass before the screen has settled", () => {
    expect(passDelayMs(0, 12000)).toBeGreaterThan(2000);
  });
});

describe("the surge", () => {
  const live = resolveLightFlow(BASE);
  const dark = resolveLightFlow({ ...BASE, motion: "static" });

  it("answers a mark-tier log with its own traveller, at once", () => {
    const decision = resolveSurge({ plan: live, momentFlow: false });
    expect(decision).toEqual({ traveller: true, heroBrighten: true, delayMs: LIGHT_FLOW_SURGE_LEAD_MS });
  });

  it("never doubles a log moment that runs its own light", () => {
    const decision = resolveSurge({ plan: live, momentFlow: true, momentArrivalMs: LOG_MOMENT_ARRIVAL_MS });
    expect(decision.traveller).toBe(false);
    expect(decision.heroBrighten).toBe(true);
    /* …and it waits until the moment has landed. */
    expect(decision.delayMs).toBe(LOG_MOMENT_ARRIVAL_MS + LIGHT_FLOW_SURGE_AFTER_MOMENT_MS);
    expect(decision.delayMs).toBeGreaterThan(LOG_MOMENT_ARRIVAL_MS);
  });

  it("says nothing at all while the layer is dark", () => {
    expect(resolveSurge({ plan: dark, momentFlow: false })).toEqual({ traveller: false, heroBrighten: false, delayMs: 0 });
    expect(resolveSurge({ plan: dark, momentFlow: true })).toEqual({ traveller: false, heroBrighten: false, delayMs: 0 });
  });

  it("builds one turned path from the press to the readout", () => {
    const path = surgePath({ x: 100, y: 600 }, { x: 900, y: 200 });
    expect(path).not.toBeNull();
    expect(path!.points.length).toBeGreaterThan(3);
    expect(path!.length).toBeGreaterThan(0);
    expect(path!.d.startsWith("M100 600")).toBe(true);
  });

  const RAIL = { y: 300, x0: 60, x1: 1240 };
  const railRun = (path: NonNullable<ReturnType<typeof surgePath>>) => {
    const on = path.points.filter((point) => Math.abs(point.y - RAIL.y) < 1);
    return on.length < 2 ? 0 : Math.max(...on.map((p) => p.x)) - Math.min(...on.map((p) => p.x));
  };

  it("climbs into the room's own rail rather than cutting across the panels", () => {
    const path = surgePath({ x: 100, y: 700 }, { x: 900, y: 160 }, RAIL)!;
    expect(path).not.toBeNull();
    expect(railRun(path)).toBeGreaterThan(400);
  });

  it("always travels a stretch of rail, even when the press is under the readout", () => {
    const path = surgePath({ x: 880, y: 700 }, { x: 900, y: 160 }, RAIL)!;
    /* Both corners are rounded at 24px, which eats that much of each end. */
    expect(railRun(path)).toBeGreaterThanOrEqual(SURGE_MIN_RAIL_PX - 2 * 24);
    /* …and it is pushed away from the readout, not through it. */
    expect(Math.min(...path.points.map((point) => point.x))).toBeLessThan(800);
  });

  it("takes one turn instead when the rail is unusable", () => {
    /* The press already sits on it… */
    expect(railRun(surgePath({ x: 100, y: 305 }, { x: 900, y: 160 }, RAIL)!)).toBe(0);
    /* …or there is no rail at all. */
    expect(railRun(surgePath({ x: 100, y: 700 }, { x: 900, y: 160 })!)).toBe(0);
    expect(railRun(surgePath({ x: 100, y: 700 }, { x: 900, y: 160 }, { y: 300, x0: 400, x1: 430 })!)).toBe(0);
  });

  it("has no path when the press and the readout are the same place", () => {
    expect(surgePath({ x: 100, y: 100 }, { x: 105, y: 102 })).toBeNull();
    expect(surgePath(null, { x: 900, y: 200 })).toBeNull();
    expect(surgePath({ x: 100, y: 600 }, null)).toBeNull();
  });
});
