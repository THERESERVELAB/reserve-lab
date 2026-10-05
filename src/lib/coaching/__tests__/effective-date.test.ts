import { afterEach, describe, expect, it, vi } from "vitest";

import { localDayOf, startsOnLaterDay } from "../effective-date";

describe("plan effective date against the athlete's local day", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a plan effective today or earlier activates on accept", () => {
    const now = new Date(2026, 8, 15, 9, 0, 0);
    expect(startsOnLaterDay("2026-09-15", now)).toBe(false);
    expect(startsOnLaterDay("2026-09-01", now)).toBe(false);
    expect(startsOnLaterDay(null, now)).toBe(false);
    expect(startsOnLaterDay(undefined, now)).toBe(false);
  });

  it("a plan effective tomorrow waits, even late in the evening", () => {
    /* 11:30pm local: in every US zone the UTC day is already the 16th, so the
       old `toISOString().slice(0, 10)` compare called "2026-09-16" today. */
    const lateEvening = new Date(2026, 8, 15, 23, 30, 0);
    expect(startsOnLaterDay("2026-09-16", lateEvening)).toBe(true);
    expect(startsOnLaterDay("2026-09-16", new Date(2026, 8, 16, 0, 5, 0))).toBe(false);
  });

  it("files a timestamp under the local day it happened on", () => {
    const localEvening = new Date(2026, 8, 15, 22, 45, 0);
    expect(localDayOf(localEvening.toISOString())).toBe("2026-09-15");
    expect(localDayOf("not a date")).toBe("not a date");
  });
});
