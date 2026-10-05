import { describe, expect, it } from "vitest";

import {
  allMet,
  firstUnmet,
  isMet,
  metCount,
  progressFraction,
  progressLabel,
  readinessLine,
  requirementStatement,
  type Requirement,
} from "../requirements";

function requirement(id: string, have: number, need: number): Requirement {
  return { id, label: id, have, need, noun: `${id}s`, detail: "", action: `Log ${id}`, view: "physique" };
}

describe("progress", () => {
  it("reports the member's own count against what the cockpit needs", () => {
    expect(progressLabel(requirement("check-in", 1, 3))).toBe("1 of 3 check-ins");
    expect(progressLabel(requirement("check-in", 0, 1))).toBe("0 of 1 check-ins");
  });

  it("never shows more progress than the requirement asks for", () => {
    expect(progressLabel(requirement("check-in", 9, 3))).toBe("3 of 3 check-ins");
    expect(progressFraction(requirement("check-in", 9, 3))).toBe(1);
    expect(progressFraction(requirement("check-in", 1, 4))).toBe(0.25);
    expect(progressFraction(requirement("check-in", 0, 2))).toBe(0);
  });

  it("treats a requirement of zero as already met", () => {
    expect(isMet(requirement("check-in", 0, 0))).toBe(true);
    expect(progressFraction(requirement("check-in", 0, 0))).toBe(1);
  });
});

describe("the one action", () => {
  const list = [requirement("lab", 1, 1), requirement("photo", 1, 3), requirement("measurement", 0, 2)];

  it("points at the first thing still missing, in the order given", () => {
    expect(firstUnmet(list)?.id).toBe("photo");
    expect(firstUnmet([requirement("lab", 0, 1), ...list])?.id).toBe("lab");
  });

  it("has nothing to point at once every requirement is met", () => {
    const done = [requirement("lab", 2, 1), requirement("photo", 3, 3)];
    expect(firstUnmet(done)).toBeNull();
    expect(allMet(done)).toBe(true);
  });

  it("counts what is ready", () => {
    expect(metCount(list)).toBe(1);
    expect(allMet(list)).toBe(false);
    expect(allMet([])).toBe(false);
  });
});

describe("the honest headline", () => {
  it("says nothing is logged rather than pretending the screen is live", () => {
    const none = [requirement("lab", 0, 1), requirement("photo", 0, 3)];
    expect(readinessLine(none)).toBe("Evidence needed · 0 of 2 ready");
    expect(requirementStatement(none, "Reading your trend")).toBe("Nothing logged yet");
  });

  it("names partial progress instead of rounding it up to working", () => {
    const partial = [requirement("lab", 1, 1), requirement("photo", 1, 3)];
    expect(readinessLine(partial)).toBe("1 of 2 ready");
    expect(requirementStatement(partial, "Reading your trend")).toBe("1 of 2 ready");
  });

  it("hands the screen over to its real statement once everything is ready", () => {
    const ready = [requirement("lab", 2, 1), requirement("photo", 4, 3)];
    expect(readinessLine(ready)).toBe("All 2 ready");
    expect(requirementStatement(ready, "Reading your trend")).toBe("Reading your trend");
  });
});
