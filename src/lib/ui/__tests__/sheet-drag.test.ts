import { describe, expect, it } from "vitest";

import { SHEET_DRAG, releaseVelocity, sheetDismissDistance, shouldDismissSheet } from "../sheet-drag";

describe("sheet drag", () => {
  it("dismisses after a quarter of the sheet's height, capped for tall sheets", () => {
    expect(sheetDismissDistance(400)).toBe(100);
    expect(sheetDismissDistance(1200)).toBe(SHEET_DRAG.maxDistancePx);
    expect(shouldDismissSheet({ offsetPx: 100, velocityPxPerMs: 0, sheetHeightPx: 400 })).toBe(true);
    expect(shouldDismissSheet({ offsetPx: 99, velocityPxPerMs: 0, sheetHeightPx: 400 })).toBe(false);
    expect(shouldDismissSheet({ offsetPx: 140, velocityPxPerMs: 0, sheetHeightPx: 1200 })).toBe(true);
  });

  it("dismisses on a quick flick, but never on jitter", () => {
    expect(shouldDismissSheet({ offsetPx: 30, velocityPxPerMs: 0.8, sheetHeightPx: 600 })).toBe(true);
    expect(shouldDismissSheet({ offsetPx: 10, velocityPxPerMs: 3, sheetHeightPx: 600 })).toBe(false);
    expect(shouldDismissSheet({ offsetPx: 30, velocityPxPerMs: 0.2, sheetHeightPx: 600 })).toBe(false);
  });

  it("springs back from an upward or invalid drag", () => {
    expect(shouldDismissSheet({ offsetPx: -40, velocityPxPerMs: 2, sheetHeightPx: 600 })).toBe(false);
    expect(shouldDismissSheet({ offsetPx: Number.NaN, velocityPxPerMs: 2, sheetHeightPx: 600 })).toBe(false);
  });

  it("measures release speed over the last 100ms only", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ y: 0, t: 0 }])).toBe(0);
    const samples = [
      { y: 0, t: 0 },
      { y: 10, t: 400 },
      { y: 20, t: 450 },
      { y: 60, t: 500 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo((60 - 10) / 100);
  });
});
