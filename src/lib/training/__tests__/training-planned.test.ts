import { describe, expect, it } from "vitest";

import { isTrainingPlannedToday } from "../training-planned";

describe("isTrainingPlannedToday", () => {
  it("plans a normal training day", () => {
    expect(isTrainingPlannedToday({ trainingPlanned: true, direction: "unchanged" }, false)).toBe(true);
  });

  it("does not plan a recovery day that nothing moved onto", () => {
    expect(isTrainingPlannedToday({ trainingPlanned: true, direction: "unchanged" }, true)).toBe(false);
  });

  it("plans a session moved onto a recovery day", () => {
    /* Apex used to read `trainingPlanned && !recovery`, which dropped this case. */
    expect(isTrainingPlannedToday({ trainingPlanned: true, direction: "moved-here" }, true)).toBe(true);
  });

  it("never plans a session that moved away or was set aside", () => {
    for (const direction of ["moved-away", "set-aside"] as const) {
      expect(isTrainingPlannedToday({ trainingPlanned: false, direction }, false)).toBe(false);
      expect(isTrainingPlannedToday({ trainingPlanned: false, direction }, true)).toBe(false);
    }
  });
});
