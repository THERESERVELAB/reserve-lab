import { describe, expect, it } from "vitest";

import { clampMobilityTarget, clampPour, clampWaterTarget, milestoneCrossed, ozOn, remainingLine, waterStreak } from "../water";

describe("water", () => {
  it("keeps the member's own targets inside sane bounds", () => {
    expect(clampWaterTarget(100)).toBe(100);
    expect(clampWaterTarget(5)).toBe(32);
    expect(clampWaterTarget(900)).toBe(256);
    expect(clampWaterTarget(Number.NaN)).toBe(120);
    expect(clampMobilityTarget(0)).toBe(1);
    expect(clampMobilityTarget(3.4)).toBe(3);
    expect(clampMobilityTarget(40)).toBe(14);
    expect(clampPour(0)).toBe(1);
    expect(clampPour(200)).toBe(64);
  });

  it("names the milestone a pour crosses, and only the highest one", () => {
    expect(milestoneCrossed(40, 56, 100)).toBe("Halfway there");
    expect(milestoneCrossed(0, 100, 100)).toBe("Target hit");
    expect(milestoneCrossed(10, 20, 100)).toBeNull();
    expect(milestoneCrossed(110, 126, 100)).toBeNull();
  });

  it("says what is left plainly", () => {
    expect(remainingLine(80, 120)).toBe("40 oz to go");
    expect(remainingLine(120, 120)).toBe("Target hit");
    expect(remainingLine(128, 120)).toBe("Target hit · 8 oz over");
  });

  it("counts days in a row at the member's own target; today under way never breaks it", () => {
    const logs = [
      { date: "2026-09-15", oz: 60 }, { date: "2026-09-15", oz: 60 },
      { date: "2026-09-16", oz: 120 },
      { date: "2026-09-17", oz: 16 },
    ];
    expect(ozOn(logs, "2026-09-15")).toBe(120);
    expect(waterStreak(logs, 120, "2026-09-17")).toBe(2);
    expect(waterStreak([...logs, { date: "2026-09-17", oz: 110 }], 120, "2026-09-17")).toBe(3);
    expect(waterStreak(logs, 120, "2026-09-19")).toBe(0);
  });
});
