import { describe, expect, it } from "vitest";

import {
  CROSSFADE_IDLE,
  LOOP_CROSSFADE_LEAD_MS,
  LOOP_CROSSFADE_MS,
  LOOP_PLAYBACK_RATE,
  canCrossfade,
  crossfadeLayer,
  crossfadeStartSeconds,
  loopDualLayerAllowed,
  loopPlaybackRate,
  otherLoopLayer,
  settleCrossfade,
  shouldStartCrossfade,
  startCrossfade,
} from "../loop-crossfade";

/** The shipped defaults, at the shipped rate. */
const DEFAULTS = { fadeMs: LOOP_CROSSFADE_MS, leadMs: LOOP_CROSSFADE_LEAD_MS, playbackRate: LOOP_PLAYBACK_RATE };

describe("crossfade timing", () => {
  it("starts the dissolve a fade and a lead before the end, in media seconds", () => {
    /* 0.8s + 0.5s of wall clock is 0.78s of an 8s clip at 0.6x. */
    expect(crossfadeStartSeconds(8, DEFAULTS)).toBeCloseTo(8 - 0.78, 6);
  });

  it("converts the fade by the rate it will actually play at", () => {
    expect(crossfadeStartSeconds(8, { ...DEFAULTS, playbackRate: 1 })).toBeCloseTo(8 - 1.3, 6);
    expect(crossfadeStartSeconds(8, { ...DEFAULTS, playbackRate: 0.3 })).toBeCloseTo(8 - 0.39, 6);
  });

  it("leaves the outgoing layer a margin after the dissolve", () => {
    const start = crossfadeStartSeconds(8, DEFAULTS) as number;
    const dissolveSeconds = (LOOP_CROSSFADE_MS / 1000) * LOOP_PLAYBACK_RATE;
    expect(8 - (start + dissolveSeconds)).toBeGreaterThan(0);
  });

  it("refuses a clock it cannot trust, or a clip too short to hide a dissolve in", () => {
    expect(crossfadeStartSeconds(Number.NaN, DEFAULTS)).toBeNull();
    expect(crossfadeStartSeconds(Number.POSITIVE_INFINITY, DEFAULTS)).toBeNull();
    expect(crossfadeStartSeconds(0, DEFAULTS)).toBeNull();
    expect(crossfadeStartSeconds(8, { ...DEFAULTS, playbackRate: 0 })).toBeNull();
    expect(crossfadeStartSeconds(1.5, DEFAULTS)).toBeNull();
  });

  it("triggers from the start point onward, so a late reading still lands", () => {
    const start = crossfadeStartSeconds(8, DEFAULTS) as number;
    expect(shouldStartCrossfade(8, start - 0.01, DEFAULTS)).toBe(false);
    expect(shouldStartCrossfade(8, start, DEFAULTS)).toBe(true);
    expect(shouldStartCrossfade(8, 7.99, DEFAULTS)).toBe(true);
  });

  it("never triggers without a usable clip", () => {
    expect(shouldStartCrossfade(Number.NaN, 4, DEFAULTS)).toBe(false);
    expect(shouldStartCrossfade(8, Number.NaN, DEFAULTS)).toBe(false);
  });
});

describe("crossfade state", () => {
  it("hands over to the other layer, which leads and fades in", () => {
    const first = startCrossfade(CROSSFADE_IDLE);
    expect(first).toEqual({ primary: "b", incoming: "b" });
    const settled = settleCrossfade(first);
    expect(settled).toEqual({ primary: "b", incoming: null });
    expect(startCrossfade(settled)).toEqual({ primary: "a", incoming: "a" });
  });

  it("only hands over when the other layer is ready and nothing is mid-dissolve", () => {
    expect(canCrossfade(CROSSFADE_IDLE, true)).toBe(true);
    expect(canCrossfade(CROSSFADE_IDLE, false)).toBe(false);
    expect(canCrossfade(startCrossfade(CROSSFADE_IDLE), true)).toBe(false);
  });

  it("names the other layer", () => {
    expect(otherLoopLayer("a")).toBe("b");
    expect(otherLoopLayer("b")).toBe("a");
  });
});

describe("crossfade opacities", () => {
  it("runs one layer at rest: the other is transparent, parked and paused", () => {
    expect(crossfadeLayer(CROSSFADE_IDLE, "a")).toEqual({ opacity: 1, zIndex: 2, playing: true, fading: false, role: "primary" });
    expect(crossfadeLayer(CROSSFADE_IDLE, "b")).toEqual({ opacity: 0, zIndex: 1, playing: false, fading: false, role: "parked" });
  });

  it("thins the outgoing layer away OVER an opaque incoming one", () => {
    const fading = startCrossfade(CROSSFADE_IDLE);
    const incoming = crossfadeLayer(fading, "b");
    const outgoing = crossfadeLayer(fading, "a");
    expect(incoming).toEqual({ opacity: 1, zIndex: 1, playing: true, fading: false, role: "incoming" });
    expect(outgoing).toEqual({ opacity: 0, zIndex: 2, playing: true, fading: true, role: "outgoing" });
    /* Exactly one layer is ever part-way, and it is the one that has been on
       screen all along, so the composite is a·A + (1−a)·B: no dip in
       brightness, no double exposure, and no fade waiting to be painted. */
    expect(incoming.opacity).toBe(1);
    expect(outgoing.zIndex).toBeGreaterThan(incoming.zIndex);
    expect([incoming, outgoing].filter((view) => view.fading)).toHaveLength(1);
  });

  it("parks the layer it left once the dissolve settles", () => {
    const settled = settleCrossfade(startCrossfade(CROSSFADE_IDLE));
    expect(crossfadeLayer(settled, "a")).toEqual({ opacity: 0, zIndex: 1, playing: false, fading: false, role: "parked" });
    expect(crossfadeLayer(settled, "b")).toEqual({ opacity: 1, zIndex: 2, playing: true, fading: false, role: "primary" });
  });

  it("keeps exactly one layer decoding at rest", () => {
    const running = (state: Parameters<typeof crossfadeLayer>[0]) =>
      (["a", "b"] as const).filter((id) => crossfadeLayer(state, id).playing).length;
    expect(running(CROSSFADE_IDLE)).toBe(1);
    expect(running(startCrossfade(CROSSFADE_IDLE))).toBe(2);
    expect(running(settleCrossfade(startCrossfade(CROSSFADE_IDLE)))).toBe(1);
  });
});

describe("calm playback", () => {
  it("slows every room by default", () => {
    expect(LOOP_PLAYBACK_RATE).toBeLessThan(1);
    expect(loopPlaybackRate(undefined)).toBe(LOOP_PLAYBACK_RATE);
  });

  it("lets a room declare its own rate", () => {
    expect(loopPlaybackRate(0.45)).toBe(0.45);
    expect(loopPlaybackRate(1)).toBe(1);
  });

  it("refuses a rate that would stop the room", () => {
    expect(loopPlaybackRate(0)).toBe(LOOP_PLAYBACK_RATE);
    expect(loopPlaybackRate(-1)).toBe(LOOP_PLAYBACK_RATE);
    expect(loopPlaybackRate(Number.NaN)).toBe(LOOP_PLAYBACK_RATE);
  });
});

describe("two decoders, or one", () => {
  it("keeps a small device on one layer", () => {
    expect(loopDualLayerAllowed(2)).toBe(false);
    expect(loopDualLayerAllowed(4)).toBe(false);
  });

  it("allows two on a device with cores to spare", () => {
    expect(loopDualLayerAllowed(8)).toBe(true);
    expect(loopDualLayerAllowed(6)).toBe(true);
  });

  it("does not assume a browser that reports nothing is small", () => {
    expect(loopDualLayerAllowed(undefined)).toBe(true);
    expect(loopDualLayerAllowed(Number.NaN)).toBe(true);
  });
});
