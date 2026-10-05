import { describe, expect, it } from "vitest";

import { phoneLoopDataAllowed } from "../loop-network";

describe("phone loop data rules", () => {
  it("allows a loop on a fast connection, or when the browser reports nothing", () => {
    expect(phoneLoopDataAllowed({ effectiveType: "4g", saveData: false })).toBe(true);
    expect(phoneLoopDataAllowed({})).toBe(true);
    expect(phoneLoopDataAllowed(undefined)).toBe(true);
    expect(phoneLoopDataAllowed(null)).toBe(true);
  });

  it("refuses a loop under Save-Data, whatever the speed", () => {
    expect(phoneLoopDataAllowed({ saveData: true })).toBe(false);
    expect(phoneLoopDataAllowed({ saveData: true, effectiveType: "4g" })).toBe(false);
  });

  it("refuses a loop on slow-2g, 2g and 3g", () => {
    for (const effectiveType of ["slow-2g", "2g", "3g"]) {
      expect(phoneLoopDataAllowed({ effectiveType })).toBe(false);
    }
  });
});
