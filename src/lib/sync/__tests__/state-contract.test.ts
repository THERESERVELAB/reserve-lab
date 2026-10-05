import { describe, expect, it } from "vitest";

import { hasMeaningfulProgress } from "../state-contract";

describe("member-state progress protection", () => {
  it("treats an active execution ledger record as protected progress", () => {
    expect(hasMeaningfulProgress({ trainingSession: { executionRecord: { id: "active-session" } } })).toBe(true);
  });

  it("treats ledger history and decisions as protected progress", () => {
    expect(hasMeaningfulProgress({ trainingSession: { executionHistory: [{ id: "completed-session" }] } })).toBe(true);
    expect(hasMeaningfulProgress({ trainingSession: { decisionHistory: [{ id: "decision" }] } })).toBe(true);
  });

  it("does not mark an empty training slice as meaningful progress", () => {
    expect(hasMeaningfulProgress({ trainingSession: {} })).toBe(false);
  });
});
