import { describe, expect, it } from "vitest";

import {
  resolveHorizonPrimaryAction,
  resolveMesocyclePrimaryAction,
  type HorizonPrimaryInput,
} from "../primary-action";

function input(over: Partial<HorizonPrimaryInput> = {}): HorizonPrimaryInput {
  return {
    hasHorizon: true,
    protocolName: "Recomposition Block",
    totalWeeks: 12,
    currentWeek: 3,
    viewingWeek: 3,
    phaseName: "Accumulation",
    ...over,
  };
}

describe("resolveHorizonPrimaryAction", () => {
  it("says no program is active and offers the protocol choice", () => {
    const plan = resolveHorizonPrimaryAction(input({ hasHorizon: false }));
    expect(plan.statement).toBe("No program is active yet.");
    expect(plan.primary).toEqual({ kind: "choose-protocol", label: "Choose Your Protocol" });
  });

  it("states the live week, its block and its phase", () => {
    expect(resolveHorizonPrimaryAction(input()).statement).toBe(
      "Week 3 of 12 on Recomposition Block · Accumulation.",
    );
  });

  it("brings the member back when they are reading another week", () => {
    const plan = resolveHorizonPrimaryAction(input({ viewingWeek: 8 }));
    expect(plan.title).toBe("You are reading week 8");
    expect(plan.primary).toEqual({ kind: "return-to-current-week", label: "Return to This Week" });
    /* The statement still reports the LIVE week, never the one being read. */
    expect(plan.statement).toContain("Week 3 of 12");
  });

  it("returns from a past week too, not only a future one", () => {
    expect(resolveHorizonPrimaryAction(input({ viewingWeek: 1 })).primary.kind).toBe("return-to-current-week");
  });

  it("offers the real change on the live week", () => {
    expect(resolveHorizonPrimaryAction(input()).primary).toEqual({
      kind: "adjust-day",
      label: "Adjust This Week",
    });
  });

  it("drops the parts of the statement it does not have, rather than guessing", () => {
    const plan = resolveHorizonPrimaryAction(input({ protocolName: null, phaseName: null, totalWeeks: 0 }));
    expect(plan.statement).toBe("Week 3.");
  });
});

describe("resolveMesocyclePrimaryAction", () => {
  it("shares the no-program and wrong-week states with the Horizon", () => {
    expect(resolveMesocyclePrimaryAction(input({ hasHorizon: false })).primary.kind).toBe("choose-protocol");
    expect(resolveMesocyclePrimaryAction(input({ viewingWeek: 11 })).primary.kind).toBe("return-to-current-week");
  });

  it("routes the live week to the screen that can change it", () => {
    expect(resolveMesocyclePrimaryAction(input()).primary).toEqual({
      kind: "open-program-horizon",
      label: "Open Program Horizon",
    });
  });

  it("never offers to change a week from a reading surface", () => {
    for (const viewingWeek of [1, 3, 9]) {
      expect(resolveMesocyclePrimaryAction(input({ viewingWeek })).primary.kind).not.toBe("adjust-day");
    }
  });
});
