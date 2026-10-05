import { describe, expect, it } from "vitest";

import {
  MIN_MEMBER_AGE,
  SAFETY_ACK_CONFIRM_ADULT,
  SAFETY_ACK_CONFIRM_UNDERSTOOD,
  SAFETY_ACK_POINTS,
  SAFETY_ACK_VERSION,
  hasCurrentSafetyAcknowledgement,
  safetyAccess,
} from "../acknowledgement";

import { bannedLanguageIn } from "./compliance-language";

const stamp = "2026-09-14T12:00:00.000Z";
const current = { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp };

describe("safety acknowledgement — adults only", () => {
  it("opens only for the current version with the adult confirmation", () => {
    expect(safetyAccess(current)).toBe("open");
    expect(safetyAccess({ acknowledgedAt: stamp, version: SAFETY_ACK_VERSION })).toBe("acknowledge");
    expect(safetyAccess({ acknowledgedAt: stamp, version: "2026.09.13" })).toBe("acknowledge");
    expect(safetyAccess(null)).toBe("acknowledge");
  });

  it("closes for a profile age under 18, even after an earlier acknowledgement", () => {
    expect(safetyAccess(current, MIN_MEMBER_AGE - 1)).toBe("under-age");
    expect(safetyAccess(null, 15)).toBe("under-age");
    expect(hasCurrentSafetyAcknowledgement(current, 17)).toBe(false);
  });

  it("does not guess from a missing or unusable age", () => {
    expect(safetyAccess(current, MIN_MEMBER_AGE)).toBe("open");
    expect(safetyAccess(current, undefined)).toBe("open");
    expect(safetyAccess(current, null)).toBe("open");
    expect(safetyAccess(current, 0)).toBe("open");
    expect(safetyAccess(current, Number.NaN)).toBe("open");
  });

  it("says the tools are for adults, in plain language", () => {
    expect(SAFETY_ACK_POINTS).toContain("Cycle monitoring, compound risk information and lab flags are for adults 18 and older.");
    expect(SAFETY_ACK_CONFIRM_ADULT).toBe("I am 18 or older.");
    for (const text of [...SAFETY_ACK_POINTS, SAFETY_ACK_CONFIRM_UNDERSTOOD, SAFETY_ACK_CONFIRM_ADULT]) {
      expect(bannedLanguageIn(text), text).toEqual([]);
    }
  });
});
