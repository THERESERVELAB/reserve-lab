import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMemberStateToDefaults, useAthleteDashboardStore } from "@/lib/athlete-store";
import { toISODate } from "@/lib/women/cycle";
import { getDateKey } from "@/lib/retention-config";

import { localDateKey, localDateKeyOffset } from "../local-day";

/**
 * Evening logs belong to the evening. The UTC day rolls over at 8pm on the US
 * East Coast, which reset meal checkmarks and filed late logs under tomorrow.
 */

const store = () => useAthleteDashboardStore.getState();
const ninePm = new Date(2026, 8, 16, 21, 0);
const nextMorning = new Date(2026, 8, 17, 7, 0);

beforeEach(() => {
  resetMemberStateToDefaults();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("local day keys", () => {
  it("keep late evening on its own day, across month and year ends", () => {
    expect(localDateKey(ninePm)).toBe("2026-09-16");
    expect(localDateKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(localDateKeyOffset(new Date(2026, 11, 31, 23, 0), 1)).toBe("2027-01-01");
    expect(localDateKeyOffset(new Date(2026, 2, 1, 22, 0), -1)).toBe("2026-02-28");
  });

  it("drive the nutrition day and the women's cycle dates", () => {
    expect(getDateKey(ninePm)).toBe("2026-09-16");
    expect(toISODate(new Date(2026, 8, 16, 0, 0))).toBe("2026-09-16");
  });
});

describe("the nutrition day", () => {
  it("keeps meals logged at 9pm on that day, and starts fresh the next morning", () => {
    vi.setSystemTime(ninePm);
    store().rolloverNutritionDay(getDateKey());
    store().confirmMealLog({ mealId: "dinner", loggedAt: ninePm.toISOString() } as unknown as Parameters<ReturnType<typeof store>["confirmMealLog"]>[0]);
    expect(store().nutritionPrefs.loggedMealIds).toContain("dinner");

    /* Opening the app again later that evening is still the same day. */
    store().rolloverNutritionDay(getDateKey());
    expect(store().nutritionPrefs.loggedMealIds).toContain("dinner");

    vi.setSystemTime(nextMorning);
    store().rolloverNutritionDay(getDateKey());
    expect(store().nutritionPrefs.loggedMealIds).toEqual([]);
    expect(store().nutritionPrefs.nutritionLogHistory["2026-09-16"]).toContain("dinner");
  });

  it("does not wipe tonight's log when the saved date is the old UTC key for this evening", () => {
    vi.setSystemTime(ninePm);
    useAthleteDashboardStore.setState((s) => ({
      nutritionPrefs: { ...s.nutritionPrefs, nutritionLogDate: "2026-09-17", loggedMealIds: ["lunch", "dinner"] },
    }));
    store().rolloverNutritionDay(getDateKey());
    expect(store().nutritionPrefs.nutritionLogDate).toBe("2026-09-16");
    expect(store().nutritionPrefs.loggedMealIds).toEqual(["lunch", "dinner"]);
  });
});
