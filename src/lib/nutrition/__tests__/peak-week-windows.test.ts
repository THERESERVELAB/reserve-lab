import { describe, expect, it } from "vitest";

import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";

import { dayPlanFor, shoppingList } from "../peak-kitchen";
import { defaultDayTargets, peakMeals } from "../peak-mode";
import { PEAK_SIGNATURES } from "../peak-signatures";
import { PRE_WORKOUT_SHAKES } from "../pre-workout-shake";

/* ════════════════════════════════════════════════════════════════════════
   PEAK MODE'S WEEK READS THE SAME DAY THE SCHEDULE ENGINE BUILDS

   The early riser (wake 4:45 · train 5:15–8:15 · sleep 9:30): the schedule
   engine trains them fasted with an optional food-only shake, lands meal 1
   after the session, and moves the displaced meal to the evening as dinner.
   The week's plan used to re-read the stored windows, so a moved meal kept
   its old plate and the shake dropped out.
   ════════════════════════════════════════════════════════════════════════ */

const EARLY: MemberScheduleProfile = {
  ...DEFAULT_SCHEDULE_PROFILE,
  wakeTime: "04:45",
  sleepTarget: "21:30",
  trainingWindow: "morning",
  preferredTrainingStart: "05:15",
  preferredTrainingEnd: "08:15",
};

const inputs = { goal: "maintenance" as const, scheduleProfile: EARLY, bodyweightLb: 190, favorites: [], personalization: {} };
const SHAKE_NAMES = new Set(PRE_WORKOUT_SHAKES.map((s) => s.name));
const plateSlot = (id: string | null) => PEAK_SIGNATURES.find((s) => s.id === id)?.slot ?? null;

describe("Peak Mode's week for an early fasted session", () => {
  const plan = dayPlanFor(true, "Push", inputs);
  const meals = peakMeals(plan, { look: "lean-hard", dayIndex: 0 });

  it("keeps the optional shake, food only, and never turns it into a plate", () => {
    const shakes = meals.filter((m) => m.optional);
    expect(shakes).toHaveLength(1);
    expect(SHAKE_NAMES.has(shakes[0].name)).toBe(true);
    expect(shakes[0].plate).toBeNull();
    expect(shakes[0].match).toBeNull();
    expect(meals[0].optional).toBe(true); // before the session, first on the day
  });

  it("gives each meal the plate for the slot it moved to", () => {
    const real = meals.filter((m) => !m.optional);
    expect(real[0].time).toBe("09:00");
    expect(real[0].slot).toBe("breakfast");
    const last = real.at(-1)!;
    expect(last.slot).toBe("dinner");
    for (const m of real) if (m.plateId) expect(plateSlot(m.plateId)).toBe(m.slot === "snack" ? "snack" : m.slot);
  });

  it("the shake takes no share of the day: the plates still add up to its targets", () => {
    const day = defaultDayTargets(plan);
    const total = meals.filter((m) => !m.optional).reduce((s, m) => s + m.target.calories, 0);
    expect(Math.abs(total - day.calories)).toBeLessThan(day.calories * 0.03);
  });

  it("puts the shake's foods on the shopping list — food only, water and salt left off", () => {
    const shake = meals.find((m) => m.optional)!;
    const list = shoppingList([], [shake.ingredientsDetailed ?? [], shake.ingredientsDetailed ?? []]);
    const names = list.aisles.flatMap((a) => a.items.map((i) => i.name));
    expect(names.some((n) => /water$/i.test(n) && !/coconut/i.test(n))).toBe(false);
    expect(names.some((n) => /salt/i.test(n))).toBe(false);
    for (const n of names) expect(n).not.toMatch(/whey|creatine|caffeine|powder|pre-?workout/i);
    const items = list.aisles.flatMap((a) => a.items).filter((i) => i.key.startsWith("shake:"));
    for (const item of items) expect(item.label).toMatch(/× 2 · shake$/);
  });

  it("a rest day has no shake and no pre-workout plate", () => {
    const rest = peakMeals(dayPlanFor(false, "", inputs), { look: "lean-hard", dayIndex: 1 });
    expect(rest.some((m) => m.optional)).toBe(false);
    expect(rest.some((m) => plateSlot(m.plateId) === "pre-workout")).toBe(false);
  });
});
