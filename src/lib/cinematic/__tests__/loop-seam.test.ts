import { describe, expect, it } from "vitest";

import { LOOP_SEAM_MS, isLoopRestart, loopSeamDelayMs } from "../loop-seam";

describe("loop seam", () => {
  it("starts the fade out one seam before the end", () => {
    expect(loopSeamDelayMs(8, 0)).toBe(8000 - LOOP_SEAM_MS);
    expect(loopSeamDelayMs(8, 6)).toBe(2000 - LOOP_SEAM_MS);
  });

  it("fades at once when already inside the seam", () => {
    expect(loopSeamDelayMs(8, 7.9)).toBe(0);
  });

  it("follows the playback rate", () => {
    expect(loopSeamDelayMs(8, 0, 2)).toBe(4000 - LOOP_SEAM_MS);
  });

  it("schedules nothing without a usable clock", () => {
    expect(loopSeamDelayMs(Number.NaN, 0)).toBeNull();
    expect(loopSeamDelayMs(Number.POSITIVE_INFINITY, 0)).toBeNull();
    expect(loopSeamDelayMs(0.6, 0)).toBeNull();
    expect(loopSeamDelayMs(8, 0, 0)).toBeNull();
  });

  it("recognises a wrap, not jitter", () => {
    expect(isLoopRestart(7.95, 0.02)).toBe(true);
    expect(isLoopRestart(3.2, 3.1)).toBe(false);
    expect(isLoopRestart(1, 1.25)).toBe(false);
  });
});
