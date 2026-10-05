import { describe, expect, it } from "vitest";

import { resolveWeeklyBlueprint } from "../split-blueprints";

const trainingDays = (week: { recovery?: boolean }[]) => week.filter((d) => !d.recovery).length;

describe("weak-point specialization is structural", () => {
  it("inserts a dedicated specialization day for a mappable weak point", () => {
    const { week } = resolveWeeklyBlueprint({ protocolId: "lean-bulk-command", trainingDaysTarget: 5, musclePriority: ["delts"] });
    const spec = week.find((d) => /Specialization/.test(d.title));
    expect(spec).toBeTruthy();
    expect(spec!.archetype).toBe("delts-arms");
    expect(spec!.emphasis).toContain("priority");
  });

  it("preserves the training-day count when specializing (replaces, never adds)", () => {
    const base = resolveWeeklyBlueprint({ protocolId: "lean-bulk-command", trainingDaysTarget: 5 }).week;
    const spec = resolveWeeklyBlueprint({ protocolId: "lean-bulk-command", trainingDaysTarget: 5, musclePriority: ["quads"] }).week;
    expect(trainingDays(spec)).toBe(trainingDays(base));
    expect(spec.some((d) => d.archetype === "quad-focus" && /Specialization/.test(d.title))).toBe(true);
  });

  it("does not carve a whole day for a general core weak point (emphasis only)", () => {
    const { week } = resolveWeeklyBlueprint({ protocolId: "lean-bulk-command", trainingDaysTarget: 5, musclePriority: ["core"] });
    expect(week.some((d) => /Specialization/.test(d.title))).toBe(false);
  });

  it("does not specialize when capacity is too low (< 4 training days)", () => {
    const { week } = resolveWeeklyBlueprint({ protocolId: "lifestyle-reset", trainingDaysTarget: 3, musclePriority: ["delts"] });
    expect(week.some((d) => /Specialization/.test(d.title))).toBe(false);
  });
});
