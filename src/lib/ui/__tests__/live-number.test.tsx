import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import {
  LIVE_NUMBER_MS,
  LIVE_NUMBER_SIGNAL_WINDOW_MS,
  formatLiveNumber,
  planLiveNumber,
  tweenLiveNumber,
} from "@/lib/ui/live-number";

/**
 * Living numerals count from the old value to the new one after a member's
 * log — and never on their first render.
 */
describe("ReserveLiveNumber", () => {
  it("does not animate on mount: the first render has no previous value", () => {
    expect(planLiveNumber({ previous: null, next: 64, motion: "full", msSinceSignal: 0 })).toEqual({ animate: false });
  });

  it("renders the true value on its first paint", () => {
    const html = renderToString(createElement(ReserveLiveNumber, { value: 7.5, decimals: 1 }));
    expect(html).toContain(">7.5<");
    expect(html).toContain("tabular-nums");
  });

  it("counts after a member's log, under full motion", () => {
    expect(planLiveNumber({ previous: 64, next: 80, motion: "full", msSinceSignal: 20 })).toEqual({ animate: true, from: 64, to: 80 });
  });

  it("does not count a change that was not a log, or under reduced / static motion", () => {
    expect(planLiveNumber({ previous: 64, next: 80, motion: "full", msSinceSignal: Number.POSITIVE_INFINITY }).animate).toBe(false);
    expect(planLiveNumber({ previous: 64, next: 80, motion: "full", msSinceSignal: LIVE_NUMBER_SIGNAL_WINDOW_MS + 1 }).animate).toBe(false);
    expect(planLiveNumber({ previous: 64, next: 80, motion: "reduced", msSinceSignal: 0 }).animate).toBe(false);
    expect(planLiveNumber({ previous: 64, next: 80, motion: "static", msSinceSignal: 0 }).animate).toBe(false);
    expect(planLiveNumber({ previous: 80, next: 80, motion: "full", msSinceSignal: 0 }).animate).toBe(false);
  });

  it("a replay counts from the named value, long after the signal, under full motion only", () => {
    expect(planLiveNumber({ previous: 128, next: 128, motion: "full", msSinceSignal: Number.POSITIVE_INFINITY, replayFrom: 90 })).toEqual({ animate: true, from: 90, to: 128 });
    expect(planLiveNumber({ previous: 128, next: 128, motion: "reduced", msSinceSignal: 0, replayFrom: 90 }).animate).toBe(false);
    expect(planLiveNumber({ previous: 128, next: 128, motion: "static", msSinceSignal: 0, replayFrom: 90 }).animate).toBe(false);
    expect(planLiveNumber({ previous: 128, next: 128, motion: "full", msSinceSignal: 0, replayFrom: 128 }).animate).toBe(false);
    /* Never on first render, replay or not. */
    expect(planLiveNumber({ previous: null, next: 128, motion: "full", msSinceSignal: 0, replayFrom: 90 }).animate).toBe(false);
  });

  it("the tween starts at the old value and lands exactly on the new one", () => {
    expect(tweenLiveNumber(64, 80, 0)).toBe(64);
    expect(tweenLiveNumber(64, 80, LIVE_NUMBER_MS)).toBe(80);
    expect(tweenLiveNumber(64, 80, LIVE_NUMBER_MS * 4)).toBe(80);
    const mid = tweenLiveNumber(64, 80, LIVE_NUMBER_MS / 2);
    expect(mid).toBeGreaterThan(64);
    expect(mid).toBeLessThan(80);
    expect(formatLiveNumber(7.46, 1)).toBe("7.5");
  });
});
