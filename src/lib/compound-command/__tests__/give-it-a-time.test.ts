import { describe, expect, it } from "vitest";

import { TIME_CHOICES, choiceLabel, needsATime, timePatch, validTime } from "../give-it-a-time";

/* ════════════════════════════════════════════════════════════════════════
   GIVE IT A TIME — an add-on the member chose joins their day when, and
   only when, they say when they take it.
   ════════════════════════════════════════════════════════════════════════ */

describe("putting an add-on in the day", () => {
  it("knows an entry that has nowhere to land", () => {
    /* The shape the supplement library creates: in the log, no time. */
    expect(needsATime({ timeOfDayPreference: "unspecified", scheduleReviewReason: "Added from your support plan." })).toBe(true);
    expect(needsATime({ timeOfDayPreference: "unspecified" })).toBe(true);
    expect(needsATime({ timeOfDayPreference: "custom" })).toBe(true);
    expect(needsATime({ timeOfDayPreference: "custom", customTime: "08:00" })).toBe(false);
    expect(needsATime({ timeOfDayPreference: "morning" })).toBe(false);
  });

  it("only offers times the schedule engine can actually resolve", () => {
    for (const choice of TIME_CHOICES) {
      expect(["morning", "pre_training", "post_training", "evening", "bedtime", "custom"]).toContain(choice.key);
    }
  });

  it("writes the member's answer as a daily entry and clears the setup flag", () => {
    const patch = timePatch("morning");
    expect(patch).toEqual({ timeOfDayPreference: "morning", scheduleRule: { type: "daily" }, scheduleReviewReason: undefined });
  });

  it("keeps a clock time exactly as given, padded", () => {
    expect(timePatch("custom", "7:05")?.customTime).toBe("07:05");
    expect(timePatch("custom", "23:59")?.customTime).toBe("23:59");
  });

  it("refuses a time that is not a time, rather than inventing one", () => {
    expect(timePatch("custom", "")).toBeNull();
    expect(timePatch("custom", "24:00")).toBeNull();
    expect(timePatch("custom", "8pm")).toBeNull();
    expect(validTime("12:60")).toBeNull();
  });

  it("says the answer back in the member's own words", () => {
    expect(choiceLabel("morning")).toBe("morning");
    expect(choiceLabel("pre_training")).toBe("before training");
    expect(choiceLabel("bedtime")).toBe("before bed");
    expect(choiceLabel("custom", "16:00")).toBe("4:00 PM");
    expect(choiceLabel("custom", "00:05")).toBe("12:05 AM");
    expect(choiceLabel("custom", "12:00")).toBe("12:00 PM");
    /* Never a time it could not save. */
    expect(choiceLabel("custom", "nope")).toBe("a set time");
  });
});
