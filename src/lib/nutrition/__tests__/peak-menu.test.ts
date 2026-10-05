import { describe, expect, it } from "vitest";

import { clearWeek, menuChoices, menuProgress, pickOne, repeatAcrossWeek, surpriseWeek, MENU_CHOICES, type MenuDay } from "../peak-menu";

/* ════════════════════════════════════════════════════════════════════════
   THE MENU — Reserve brings the shortlist, the member says what they eat.
   ════════════════════════════════════════════════════════════════════════ */

const macros = { calories: 500, proteinG: 40, carbsG: 50, fatG: 15 };
const option = (id: string, name: string, match: number, current = false) => ({ id, name, macros, match, current });

const DAYS = [{ date: "2026-09-22" }, { date: "2026-09-23" }, { date: "2026-09-24" }];

describe("the week's menu", () => {
  it("leads with what is on the plan, then the member's own meals, then the closest matches", () => {
    const choices = menuChoices([
      option("peak-a", "Reserve plate A", 91),
      option("bowl:mine", "My Daily Bowl", 64),
      option("peak-b", "Reserve plate B", 88, true),
      option("peak-c", "Reserve plate C", 80),
    ]);
    expect(choices.map((c) => c.id)).toEqual(["peak-b", "bowl:mine", "peak-a"]);
    expect(choices[0].current).toBe(true);
    expect(choices[1].mine).toBe(true);
  });

  it("offers a short list, never a catalogue, and never the same plate twice", () => {
    const many = Array.from({ length: 9 }, (_, i) => option(`peak-${i}`, `Plate ${i}`, 90 - i));
    expect(menuChoices([...many, ...many])).toHaveLength(MENU_CHOICES);
    expect(new Set(menuChoices(many).map((c) => c.id)).size).toBe(MENU_CHOICES);
  });

  it("saves a pick against its own day, leaving the other days alone", () => {
    const first = pickOne(undefined, "2026-09-22", "lunch", "peak-a");
    const second = pickOne(first, "2026-09-23", "lunch", "peak-b");
    expect(second["2026-09-22"].lunch).toBe("peak-a");
    expect(second["2026-09-23"].lunch).toBe("peak-b");
    /* A second pick on the same day replaces only that meal. */
    const third = pickOne(second, "2026-09-22", "dinner", "peak-c");
    expect(third["2026-09-22"]).toEqual({ lunch: "peak-a", dinner: "peak-c" });
  });

  it("sets the daily rotation across the week in one go, without touching other meals", () => {
    const withDinner = pickOne(undefined, "2026-09-23", "dinner", "peak-keep");
    const week = repeatAcrossWeek(withDinner, DAYS, "breakfast", "bowl:mine");
    for (const day of DAYS) expect(week[day.date].breakfast).toBe("bowl:mine");
    expect(week["2026-09-23"].dinner).toBe("peak-keep");
  });

  it("hands the week back to Reserve without dropping picks from other weeks", () => {
    const swaps = { ...repeatAcrossWeek(undefined, DAYS, "lunch", "peak-a"), "2026-10-05": { lunch: "peak-z" } };
    const cleared = clearWeek(swaps, DAYS);
    expect(Object.keys(cleared)).toEqual(["2026-10-05"]);
  });

  it("counts how much of the week the member chose themselves", () => {
    const days: MenuDay[] = DAYS.map((d) => ({
      ...d,
      weekday: "Tue",
      training: true,
      sessionName: "Push",
      meals: [
        { key: "breakfast", label: "Breakfast", time: "07:30", slot: "breakfast", choices: [] },
        { key: "lunch", label: "Lunch", time: "12:30", slot: "lunch", choices: [] },
      ],
    }));
    expect(menuProgress(days, undefined)).toEqual({ picked: 0, total: 6 });
    expect(menuProgress(days, repeatAcrossWeek(undefined, DAYS, "lunch", "peak-a"))).toEqual({ picked: 3, total: 6 });
  });
});

describe("surprise me", () => {
  const choice = (id: string, match: number) => ({ id, name: id, macros, match, current: false });
  const week = (): MenuDay[] =>
    Array.from({ length: 7 }, (_, i) => ({
      date: `2026-09-${String(22 + i).padStart(2, "0")}`,
      weekday: "Day",
      training: true,
      sessionName: "Push",
      meals: [
        { key: "breakfast", label: "Breakfast", time: "07:30", slot: "breakfast" as const, choices: [choice("a", 95), choice("b", 90), choice("c", 85)].map((c) => ({ ...c, mine: false })) },
        { key: "dinner", label: "Dinner", time: "18:30", slot: "dinner" as const, choices: [choice("x", 92), choice("y", 88), choice("z", 80)].map((c) => ({ ...c, mine: false })) },
      ],
    }));

  it("fills every meal of the week", () => {
    const filled = surpriseWeek(week(), undefined, 0);
    const days = week();
    for (const day of days) for (const meal of day.meals) expect(filled[day.date]?.[meal.key], `${day.date} ${meal.key}`).toBeTruthy();
  });

  it("spreads the variety instead of serving one plate seven times", () => {
    const filled = surpriseWeek(week(), undefined, 0);
    const breakfasts = new Set(week().map((d) => filled[d.date].breakfast));
    expect(breakfasts.size).toBeGreaterThan(1);
  });

  it("never overwrites what the member already chose", () => {
    const mine = pickOne(undefined, "2026-09-24", "dinner", "z");
    const filled = surpriseWeek(week(), mine, 3);
    expect(filled["2026-09-24"].dinner).toBe("z");
  });

  it("is the same week twice for the same seed, and leaves a meal with no options alone", () => {
    expect(surpriseWeek(week(), undefined, 2)).toEqual(surpriseWeek(week(), undefined, 2));
    const bare = week().map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, choices: [] })) }));
    expect(surpriseWeek(bare, undefined, 0)).toEqual({});
  });
});
