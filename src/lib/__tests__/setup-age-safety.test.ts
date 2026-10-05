import { beforeEach, describe, expect, it } from "vitest";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";
import { safetyAccess } from "@/lib/safety/acknowledgement";

/**
 * Profile age and the adults-only safety tools. Lowering the age under 18
 * withdraws the adult confirmation, so raising it again means confirming again.
 */

const store = () => useAthleteDashboardStore.getState();

beforeEach(() => {
  resetMemberStateToDefaults();
});

describe("profile age and the safety acknowledgement", () => {
  it("keeps the acknowledgement when an adult age is saved", () => {
    store().acknowledgeSafety();
    store().setSetupProfile({ age: 34 });
    expect(safetyAccess(store().safetyAcknowledgement, store().setupProfile.age)).toBe("open");
  });

  it("clears the acknowledgement when an age under 18 is saved", () => {
    store().acknowledgeSafety();
    store().setSetupProfile({ age: 16 });
    expect(store().safetyAcknowledgement).toBeNull();
    expect(safetyAccess(store().safetyAcknowledgement, store().setupProfile.age)).toBe("under-age");
  });

  it("asks for the confirmation again after the age is corrected to 18 or older", () => {
    store().acknowledgeSafety();
    store().setSetupProfile({ age: 16 });
    store().setSetupProfile({ age: 18 });
    expect(safetyAccess(store().safetyAcknowledgement, store().setupProfile.age)).toBe("acknowledge");
  });

  it("leaves the acknowledgement alone when age is cleared or other fields change", () => {
    store().acknowledgeSafety();
    store().setSetupProfile({ age: undefined });
    store().setSetupProfile({ heightIn: 70 });
    expect(store().safetyAcknowledgement).not.toBeNull();
  });
});
