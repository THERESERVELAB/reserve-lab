import { describe, expect, it } from "vitest";

import type { EnhancementAdherenceRecord, EnhancementEntry } from "@/lib/athlete-store";
import { fuelWindowsFromPlan } from "@/lib/nutrition/scheduled-fuel-windows";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { buildMealPlan } from "@/lib/schedule/engine";
import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";

import { DOSE_TIMING_COPY } from "@/components/enhancement/command/DoseTimingEditor";

import { describeDose, doseAnchorsFrom, doseRuleLabel, MEAL_OFFSET_CHOICES, type DoseAnchors } from "../dose-timing";
import { getEnhancementDailySchedule, isEntryDueOnDate, isOnOffCycleDay, computeEntryScheduleState } from "../schedule";

const STAMP = "2026-09-01T00:00:00.000Z";

function entry(extra: Partial<EnhancementEntry>): EnhancementEntry {
  return {
    id: "hgh",
    name: "Somatropin",
    category: "peptide",
    doseAmount: "",
    doseUnit: "",
    frequency: "",
    timingPreference: "",
    timeOfDayPreference: "unspecified",
    customTime: "",
    goalAssociation: [],
    trainingDayUse: true,
    restDayUse: true,
    clinicianOversight: false,
    sourceOfDose: "member_entered",
    notes: "",
    toleranceNotes: "",
    sideEffectNotes: "",
    symptomNotes: "",
    labMarkersToDiscuss: [],
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  } as EnhancementEntry;
}

const ANCHORS: DoseAnchors = {
  wakeTime: "06:30",
  sleepTime: "22:30",
  meals: [
    { id: "morning-anchor", label: "Morning Protein Anchor", slot: "breakfast", time: "09:00" },
    { id: "midday", label: "Midday Meal", slot: "lunch", time: "12:30" },
    { id: "post-workout", label: "Post-Workout Meal", slot: "dinner", time: "19:00" },
  ],
};

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("2 days on, 1 day off", () => {
  const cycle = entry({ startDate: "2026-09-29", scheduleRule: { type: "on_off_cycle", daysOn: 2, daysOff: 1 } });

  it("repeats on, on, off from the start date, across a month boundary", () => {
    const days = [29, 30, 1, 2, 3, 4, 5, 6].map((d, i) => (i < 2 ? local(2026, 9, d) : local(2026, 10, d)));
    expect(days.map((d) => isEntryDueOnDate(cycle, d))).toEqual([true, true, false, true, true, false, true, true]);
  });

  it("is not scheduled before its anchor", () => {
    expect(isEntryDueOnDate(cycle, local(2026, 9, 28))).toBe(false);
  });

  it("holds its rhythm across both DST changes (calendar days, not hours)", () => {
    /* US: clocks go forward 8 Mar 2026, back 1 Nov 2026. */
    const spring = Array.from({ length: 6 }, (_, i) => isOnOffCycleDay(2, 1, "2026-03-06", `2026-03-${String(6 + i).padStart(2, "0")}`));
    expect(spring).toEqual([true, true, false, true, true, false]);
    const fall = Array.from({ length: 6 }, (_, i) => isEntryDueOnDate(entry({ startDate: "2026-10-30", scheduleRule: { type: "on_off_cycle", daysOn: 2, daysOff: 1 } }), local(2026, 10, 30 + i)));
    expect(fall).toEqual([true, true, false, true, true, false]);
  });

  it("prefers the rule's own anchor date over the start date", () => {
    const anchored = entry({ startDate: "2026-09-01", scheduleRule: { type: "on_off_cycle", daysOn: 2, daysOff: 1, anchorDate: "2026-09-02" } });
    expect([1, 2, 3, 4].map((d) => isEntryDueOnDate(anchored, local(2026, 9, d)))).toEqual([false, true, true, false]);
  });

  it("asks for review, never guesses, when days on or an anchor is missing", () => {
    const slots = getEnhancementDailySchedule({ entries: [entry({ scheduleRule: { type: "on_off_cycle", daysOn: 2, daysOff: 1 } })], adherence: [], date: "2026-09-29" });
    expect(slots).toHaveLength(1);
    expect(slots[0].entry.scheduleReviewReason).toMatch(/needs days on and a start date/);
  });

  it("finds the next scheduled day", () => {
    const state = computeEntryScheduleState(cycle, { now: local(2026, 10, 1) });
    expect(state.isDueToday).toBe(false);
    expect(state.nextDueDate?.getDate()).toBe(2);
  });
});

describe("several times on a scheduled day", () => {
  const twice = entry({
    scheduleRule: {
      type: "daily",
      doses: [
        { anchor: "meal", meal: "breakfast", offsetMin: -60 },
        { anchor: "bed", offsetMin: 0 },
      ],
    },
  });

  it("makes one slot per dose, each with its own key and resolved time", () => {
    const slots = getEnhancementDailySchedule({ entries: [twice], adherence: [], date: "2026-09-18", anchors: ANCHORS });
    expect(slots.map((s) => [s.plannedTime, s.timingLabel])).toEqual([
      ["08:00", "1 h before breakfast"],
      ["22:30", "Before bed"],
    ]);
    expect(new Set(slots.map((s) => s.id)).size).toBe(2);
    expect(slots.map((s) => s.doseIndex)).toEqual([0, 1]);
  });

  it("logs and skips each dose on its own (adherence keys by entry, day and planned time)", () => {
    const adherence: EnhancementAdherenceRecord[] = [
      { id: "a1", entryId: "hgh", date: "2026-09-18", plannedTime: "08:00", takenStatus: "taken", createdAt: STAMP },
      { id: "a2", entryId: "hgh", date: "2026-09-18", plannedTime: "22:30", takenStatus: "skipped", createdAt: STAMP },
    ];
    const slots = getEnhancementDailySchedule({ entries: [twice], adherence, date: "2026-09-18", anchors: ANCHORS });
    expect(slots.map((s) => s.status)).toEqual(["taken", "skipped"]);
  });

  it("follows a meal that moves", () => {
    const moved: DoseAnchors = { ...ANCHORS, meals: ANCHORS.meals.map((m) => (m.slot === "breakfast" ? { ...m, time: "10:15" } : m)) };
    const [first] = getEnhancementDailySchedule({ entries: [twice], adherence: [], date: "2026-09-18", anchors: moved });
    expect(first.plannedTime).toBe("09:15");
  });

  it("resolves against the schedule engine's real meal plan and moves with it", () => {
    const withMeal = entry({ scheduleRule: { type: "daily", doses: [{ anchor: "meal", meal: "window:midday", offsetMin: 30 }] } });
    const plan = (p: MemberScheduleProfile) => doseAnchorsFrom(p, fuelWindowsFromPlan(buildMealPlan(p, { trainingPlanned: true, direction: "unchanged" })));
    const before = plan(DEFAULT_SCHEDULE_PROFILE);
    const midday = before.meals.find((m) => m.id === "midday");
    expect(midday).toBeTruthy();
    const [slot] = getEnhancementDailySchedule({ entries: [withMeal], adherence: [], date: "2026-09-18", anchors: before });
    const [h, m] = midday!.time.split(":").map(Number);
    const expected = h * 60 + m + 30;
    expect(slot.plannedTime).toBe(`${String(Math.floor(expected / 60)).padStart(2, "0")}:${String(expected % 60).padStart(2, "0")}`);

    const later = plan({ ...DEFAULT_SCHEDULE_PROFILE, mealWindows: DEFAULT_SCHEDULE_PROFILE.mealWindows.map((w) => (w.id === "midday" ? { ...w, time: "13:30" } : w)) });
    const [movedSlot] = getEnhancementDailySchedule({ entries: [withMeal], adherence: [], date: "2026-09-18", anchors: later });
    expect(movedSlot.plannedTime).not.toBe(slot.plannedTime);
  });

  it("places on waking and before bed from the schedule, with the member's offsets", () => {
    const e = entry({ scheduleRule: { type: "daily", doses: [{ anchor: "wake", offsetMin: 0 }, { anchor: "wake", offsetMin: 20 }, { anchor: "bed", offsetMin: 30 }] } });
    const slots = getEnhancementDailySchedule({ entries: [e], adherence: [], date: "2026-09-18", anchors: ANCHORS });
    expect(slots.map((s) => [s.plannedTime, s.timingLabel])).toEqual([
      ["06:30", "On waking"],
      ["06:50", "20 min after waking"],
      ["22:00", "30 min before bed"],
    ]);
  });

  it("wraps past midnight, and leaves a meal that is not on today's plan unscheduled", () => {
    const e = entry({ scheduleRule: { type: "daily", doses: [{ anchor: "bed", offsetMin: 0 }, { anchor: "meal", meal: "lunch", offsetMin: 0 }] } });
    const late: DoseAnchors = { wakeTime: "09:00", sleepTime: "00:30", meals: [] };
    const slots = getEnhancementDailySchedule({ entries: [e], adherence: [], date: "2026-09-18", anchors: late });
    expect(slots.find((s) => s.timingLabel === "Before bed")?.plannedTime).toBe("00:30");
    expect(slots.find((s) => s.timingLabel === "With lunch")?.plannedTime).toBe("—");
    expect(describeDose({ anchor: "meal", meal: "lunch", offsetMin: 0 }, late)).toBe("With lunch · Lunch is not on today's plan");
  });

  it("shows the rule beside the resolved time", () => {
    expect(describeDose({ anchor: "meal", meal: "breakfast", offsetMin: -60 }, ANCHORS)).toMatch(/^1 h before breakfast · 8:00\sAM$/);
    expect(doseRuleLabel({ anchor: "meal", meal: "window:post-workout", offsetMin: 30 }, ANCHORS)).toBe("30 min after Post-Workout Meal");
  });
});

describe("old rules are unchanged", () => {
  it("a daily custom-time entry keeps its single slot, id and key", () => {
    const old = entry({ id: "fish", timeOfDayPreference: "custom", customTime: "08:00", scheduleRule: { type: "daily" } });
    const slots = getEnhancementDailySchedule({ entries: [old], adherence: [], date: "2026-09-18", anchors: ANCHORS });
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe("fish-08:00");
    expect(slots[0].plannedTime).toBe("08:00");
    expect(slots[0].doseIndex).toBeUndefined();
  });

  it("weekday and every-x-days rules still decide the day", () => {
    const weekdays = entry({ scheduleRule: { type: "specific_weekdays", weekdays: [5] } });
    expect(isEntryDueOnDate(weekdays, local(2026, 9, 18))).toBe(true);
    expect(isEntryDueOnDate(weekdays, local(2026, 9, 17))).toBe(false);
    const interval = entry({ scheduleRule: { type: "every_x_days", intervalDays: 3, anchorDate: "2026-09-15" } });
    expect(isEntryDueOnDate(interval, local(2026, 9, 18))).toBe(true);
    expect(isEntryDueOnDate(interval, local(2026, 9, 17))).toBe(false);
  });

  it("a morning preference still reads wake + 15", () => {
    const morning = entry({ id: "d3", timeOfDayPreference: "morning", scheduleRule: { type: "daily" } });
    const [slot] = getEnhancementDailySchedule({ entries: [morning], adherence: [], date: "2026-09-18", wakeTime: "06:30" });
    expect(slot.plannedTime).toBe("06:45");
  });
});

describe("editor copy is neutral", () => {
  it("never suggests, ranks or comments on a timing", () => {
    const text = [
      ...Object.values(DOSE_TIMING_COPY).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "function" ? [v(1)] : Object.values(v))),
      ...MEAL_OFFSET_CHOICES.map((c) => c.label),
    ].join(" · ");
    expect(bannedLanguageIn(text)).toEqual([]);
    expect(text).not.toMatch(/\b(best|optimal|ideal|recommend\w*|should|better|worse|absorb\w*|effective|peak|spike|release)\b/i);
  });
});
