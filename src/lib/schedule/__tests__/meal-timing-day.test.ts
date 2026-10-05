import { describe, expect, it } from "vitest";

import { buildDailyFuelPlan, type DailyFuelPlan } from "@/lib/nutrition/fuel-plan";
import { fuelWindowsFromPlan } from "@/lib/nutrition/scheduled-fuel-windows";
import { deriveMealWindows, repairScheduleProfile, scheduleContradictions } from "@/lib/schedule/derive";
import {
  EARLY_SESSION_WINDOW_MIN,
  EVENING_MEAL_LEAD_MIN,
  POST_WORKOUT_HOME_BUFFER_MIN,
  SLEEP_LOCK_MEAL_BUFFER_MIN,
  buildMealPlan,
  buildTodaySchedule,
  timeToMinutes,
  type PlannedMeal,
} from "@/lib/schedule/engine";
import { DEFAULT_SCHEDULE_PROFILE, type MemberScheduleProfile } from "@/lib/schedule/types";

/* ════════════════════════════════════════════════════════════════════════
   MEAL TIMING THAT KNOWS A REAL DAY

   The owner's report: a member who wakes at 4:45 AM and trains fasted at
   5:15 was handed a full breakfast at ~5:00 AM and a last meal at 12:30 PM,
   with a 9:30 PM bedtime. Root cause, in `buildMealPlan`:
     - an early session turned the morning anchor into "light fuel" 20 min
       before lifting, and the fuel plan mapped that window to a breakfast plate;
     - the early session dropped the pre-workout meal from the day's count and
       nothing ever moved a meal into the evening, so the stored 12:30 midday
       meal was the day's last.
   ════════════════════════════════════════════════════════════════════════ */

const TRAINING = { trainingPlanned: true, direction: "unchanged" as const };
const REST = { trainingPlanned: false, direction: "unchanged" as const };

function profile(over: Partial<MemberScheduleProfile>): MemberScheduleProfile {
  return { ...DEFAULT_SCHEDULE_PROFILE, ...over };
}

/** Wake-relative minutes, so a day that runs past midnight stays in order. */
function dayMins(p: MemberScheduleProfile, meal: Pick<PlannedMeal, "minutes">): number {
  const wake = timeToMinutes(p.wakeTime);
  return meal.minutes < wake ? meal.minutes + 1440 : meal.minutes;
}

function sleepDayMins(p: MemberScheduleProfile): number {
  const wake = timeToMinutes(p.wakeTime);
  const sleep = timeToMinutes(p.sleepTarget);
  return sleep <= wake ? sleep + 1440 : sleep;
}

const realMeals = (plan: PlannedMeal[]) => plan.filter((m) => !m.optional);

function fuelPlanFor(p: MemberScheduleProfile, ctx = TRAINING): DailyFuelPlan {
  const scheduled = buildMealPlan(p, ctx);
  return buildDailyFuelPlan({
    goal: "maintenance",
    isTrainingDay: ctx.trainingPlanned,
    sessionName: ctx.trainingPlanned ? "Push" : "Recovery Day",
    mealWindows: fuelWindowsFromPlan(scheduled),
    bodyweightLb: 190,
    sleepTarget: p.sleepTarget,
    wakeTime: p.wakeTime,
  });
}

/* ── The owner's member: wake 4:45, train 5:15–8:15, home 9:00, sleep 9:30 ── */
const EARLY_BASE = {
  wakeTime: "04:45",
  sleepTarget: "21:30",
  trainingWindow: "morning" as const,
  preferredTrainingStart: "05:15",
  preferredTrainingEnd: "08:15",
};
/** A member who set these times in Settings (factory meal windows kept). */
const EARLY = profile(EARLY_BASE);
/** The same member onboarded through the derivation (morning windows). */
const EARLY_DERIVED = profile({ ...EARLY_BASE, mealWindows: deriveMealWindows(EARLY_BASE) });

describe("an early fasted session (wake 4:45 · train 5:15–8:15 · sleep 9:30)", () => {
  for (const [name, p] of [["factory windows", EARLY], ["derived windows", EARLY_DERIVED]] as const) {
    describe(name, () => {
      const plan = buildMealPlan(p, TRAINING);
      const start = timeToMinutes(p.preferredTrainingStart);
      const end = timeToMinutes(p.preferredTrainingEnd);

      it("serves no meal before the session — only an optional shake slot", () => {
        const before = plan.filter((m) => dayMins(p, m) < start);
        expect(before.every((m) => m.optional && m.kind === "shake")).toBe(true);
        expect(before.length).toBe(1);
        expect(before[0].label).toMatch(/optional pre-workout shake/i);
      });

      it("anchors meal #1 — the post-workout breakfast — at the home time", () => {
        const first = realMeals(plan)[0];
        expect(first.id).toBe("post-workout");
        expect(first.label).toBe("Meal 1 · Post-Workout Breakfast");
        expect(first.slot).toBe("breakfast");
        expect(first.time).toBe("09:00");
        expect(timeToMinutes(first.time)).toBe(end + POST_WORKOUT_HOME_BUFFER_MIN);
      });

      it("runs meals into the evening, before the sleep lock", () => {
        const last = realMeals(plan).at(-1)!;
        expect(dayMins(p, last)).toBeGreaterThanOrEqual(18 * 60 + 30);
        expect(dayMins(p, last)).toBeLessThanOrEqual(19 * 60 + 30);
        expect(dayMins(p, last)).toBeLessThanOrEqual(sleepDayMins(p) - SLEEP_LOCK_MEAL_BUFFER_MIN);
        expect(last.slot).toBe("dinner");
      });

      it("keeps real meals at least two hours apart", () => {
        const times = realMeals(plan).map((m) => dayMins(p, m));
        for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(120);
      });

      it("keeps the day's meal count (the fasted session no longer drops one)", () => {
        const enabled = p.mealWindows.filter((w) => w.enabled && w.id !== "pre-workout").length;
        expect(realMeals(plan).length).toBe(enabled);
      });

      it("leaves no fuel gap over five hours once the day's plan is built", () => {
        const fuel = fuelPlanFor(p);
        const real = fuel.meals.filter((m) => !m.optional).map((m) => timeToMinutes(m.time!));
        for (let i = 1; i < real.length; i += 1) expect(real[i] - real[i - 1]).toBeLessThanOrEqual(300);
        expect(fuel.meals.some((m) => m.slot === "breakfast" && timeToMinutes(m.time!) < start)).toBe(false);
      });
    });
  }

  it("treats a session inside the early window as early", () => {
    expect(EARLY_SESSION_WINDOW_MIN).toBe(90);
    const later = profile({ ...EARLY_BASE, preferredTrainingStart: "06:30", preferredTrainingEnd: "07:45" });
    /* 105 min after waking — not early: a real pre-workout window exists. */
    expect(buildMealPlan(later, TRAINING).some((m) => m.kind === "shake")).toBe(false);
  });

  it("uses the member's own travel time for the home time", () => {
    const plan = buildMealPlan(profile({ ...EARLY_BASE, postWorkoutHomeMinutes: 20 }), TRAINING);
    expect(realMeals(plan)[0].time).toBe("08:35");
  });

  it("the timeline marks the shake optional once, not twice", () => {
    const items = buildTodaySchedule(EARLY, TRAINING).filter((i) => i.kind === "meal");
    const shake = items.find((i) => /shake/i.test(i.label))!;
    expect(shake.label).toBe("Optional Pre-Workout Shake");
    expect(items.map((i) => i.time)[0]).toBe("05:00");
  });
});

describe("the member's pre-workout fuel choice", () => {
  it("carb-load is respected even at 5:00 AM", () => {
    const plan = buildMealPlan(profile({ ...EARLY_BASE, preWorkoutFuel: "carb-load" }), TRAINING);
    const pre = plan.find((m) => m.id === "pre-workout")!;
    expect(pre.kind).toBe("meal");
    expect(pre.optional).toBe(false);
    expect(pre.label).toBe("Pre-Workout Meal");
    expect(pre.time).toBe("05:00");
    /* Meal #1 was eaten before training, so the post-session meal is a post-workout meal, not breakfast. */
    const post = plan.find((m) => m.id === "post-workout")!;
    expect(post.label).not.toMatch(/breakfast/i);
    expect(post.time).toBe("09:00");
  });

  it("light keeps the slot a shake — optional, never a plate", () => {
    const plan = buildMealPlan(profile({ ...EARLY_BASE, preWorkoutFuel: "light" }), TRAINING);
    const pre = plan.find((m) => m.id === "pre-workout")!;
    expect(pre.kind).toBe("shake");
    expect(pre.optional).toBe(true);
  });

  it("with the pre-workout slot switched off, nothing is offered before the session", () => {
    const off = profile({ ...EARLY_BASE, mealWindows: EARLY.mealWindows.map((w) => (w.id === "pre-workout" ? { ...w, enabled: false } : w)) });
    const plan = buildMealPlan(off, TRAINING);
    expect(plan.some((m) => m.id === "pre-workout")).toBe(false);
    /* The rest of the day is unchanged: meal 1 at home, dinner in the evening. */
    expect(realMeals(plan).map((m) => m.time)).toEqual(["09:00", "12:30", "19:30"]);
  });

  it("a stated choice is honoured even with the slot switched off", () => {
    const off = profile({ ...EARLY_BASE, preWorkoutFuel: "carb-load", mealWindows: EARLY.mealWindows.map((w) => (w.id === "pre-workout" ? { ...w, enabled: false } : w)) });
    expect(buildMealPlan(off, TRAINING).find((m) => m.id === "pre-workout")?.kind).toBe("meal");
  });

  it("fasted on an evening session replaces the pre-workout meal with the optional shake", () => {
    const plan = buildMealPlan(profile({ ...EVENING_BASE, preWorkoutFuel: "fasted" }), TRAINING);
    expect(plan.find((m) => m.id === "pre-workout")?.kind).toBe("shake");
  });
});

/* ── Evening trainer: wake 7:00, train 5:30–7:00 PM, sleep 11:00 ── */
const EVENING_BASE = {
  wakeTime: "07:00",
  sleepTarget: "23:00",
  trainingWindow: "evening" as const,
  preferredTrainingStart: "17:30",
  preferredTrainingEnd: "19:00",
};

describe("an evening trainer (wake 7:00 · train 5:30–7:00 PM · sleep 11:00)", () => {
  const p = profile(EVENING_BASE);
  const plan = buildMealPlan(p, TRAINING);

  it("keeps a normal breakfast, a pre-workout meal before the session, and the post-workout meal before sleep lock", () => {
    expect(plan.map((m) => [m.id, m.time])).toEqual([
      ["morning-anchor", "07:20"],
      ["midday", "12:30"],
      ["pre-workout", "16:00"],
      ["post-workout", "19:15"],
    ]);
    expect(plan.every((m) => !m.optional)).toBe(true);
    const post = plan.at(-1)!;
    expect(dayMins(p, post)).toBeLessThanOrEqual(sleepDayMins(p) - SLEEP_LOCK_MEAL_BUFFER_MIN);
  });
});

/* ── Midday trainer: wake 6:30, train 12:00–1:15, sleep 10:30 ── */
describe("a midday trainer (wake 6:30 · train 12:00–1:15 PM · sleep 10:30)", () => {
  const p = profile({ wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "midday", preferredTrainingStart: "12:00", preferredTrainingEnd: "13:15" });
  const plan = buildMealPlan(p, TRAINING);

  it("moves the midday meal that collided with the session into the evening", () => {
    expect(plan.map((m) => [m.id, m.time])).toEqual([
      ["morning-anchor", "07:00"],
      ["pre-workout", "10:30"],
      ["post-workout", "13:30"],
      ["midday", "20:30"],
    ]);
    expect(plan.at(-1)!.label).toBe("Dinner");
    expect(plan.at(-1)!.slot).toBe("dinner");
  });

  it("never puts two meals within two hours of each other", () => {
    const times = realMeals(plan).map((m) => dayMins(p, m));
    for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(120);
  });
});

describe("a rest day", () => {
  it("carries no pre- or post-workout labels, and still ends in the evening", () => {
    const p = profile(EARLY_BASE);
    const plan = buildMealPlan(p, REST);
    expect(plan.some((m) => /pre-?workout|post-?workout|shake/i.test(m.label))).toBe(false);
    expect(plan.some((m) => m.kind === "shake")).toBe(false);
    expect(dayMins(p, plan.at(-1)!)).toBe(sleepDayMins(p) - EVENING_MEAL_LEAD_MIN);
  });

  it("names a derived light-fuel anchor for what it is on a day with no session", () => {
    const plan = buildMealPlan(EARLY_DERIVED, REST);
    expect(plan[0].label).toBe("Morning Protein Anchor");
  });
});

/* ── Shift worker: wakes 3:00 PM, sleeps 7:00 AM ── */
describe("a shift worker who sleeps in the morning (wake 3:00 PM · sleep 7:00 AM)", () => {
  const p = profile({ wakeTime: "15:00", sleepTarget: "07:00", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" });

  it("keeps every meal inside the waking day, in order, across midnight", () => {
    const plan = buildMealPlan(p, TRAINING);
    const mins = plan.map((m) => dayMins(p, m));
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    for (const m of mins) {
      expect(m).toBeGreaterThanOrEqual(timeToMinutes(p.wakeTime));
      expect(m).toBeLessThanOrEqual(sleepDayMins(p) - SLEEP_LOCK_MEAL_BUFFER_MIN);
    }
    expect(plan.find((m) => m.id === "pre-workout")!.time).toBe("16:00");
    expect(plan.find((m) => m.id === "post-workout")!.time).toBe("19:15");
    /* The day's last meal lands two hours before the 7:00 AM sleep. */
    expect(plan.at(-1)!.time).toBe("05:00");
  });

  it("survives the fuel plan: no meal is cut as past the sleep target", () => {
    const scheduled = buildMealPlan(p, TRAINING);
    const fuel = fuelPlanFor(p);
    expect(fuel.meals.filter((m) => !m.isSnack).length).toBe(scheduled.length);
  });
});

describe("a member with no schedule set", () => {
  it("keeps the factory plan exactly as it was", () => {
    const plan = buildMealPlan(DEFAULT_SCHEDULE_PROFILE, TRAINING);
    expect(plan.map((m) => [m.id, m.time, m.optional])).toEqual([
      ["morning-anchor", "07:00", false],
      ["midday", "12:30", false],
      ["pre-workout", "19:30", false],
      ["post-workout", "23:15", true],
    ]);
  });

  it("keeps the factory rest day exactly as it was", () => {
    const plan = buildMealPlan(DEFAULT_SCHEDULE_PROFILE, REST);
    expect(plan.map((m) => [m.id, m.time, m.label])).toEqual([
      ["morning-anchor", "07:00", "Morning Protein Anchor"],
      ["midday", "12:30", "Midday Meal"],
      ["post-workout", "20:30", "Recovery Meal"],
    ]);
  });
});

describe("the derived windows for an early member", () => {
  it("keep the pre-session slot on and before the start, with no contradiction to repair", () => {
    const pre = EARLY_DERIVED.mealWindows.find((w) => w.id === "pre-workout")!;
    expect(pre.enabled).toBe(true);
    expect(timeToMinutes(pre.time)).toBeLessThan(timeToMinutes(EARLY_BASE.preferredTrainingStart));
    expect(scheduleContradictions(EARLY_DERIVED)).toEqual([]);
  });

  it("a repair keeps the member's own on/off choice for the slot", () => {
    const off = { ...EARLY_DERIVED, mealWindows: EARLY_DERIVED.mealWindows.map((w) => (w.id === "pre-workout" ? { ...w, enabled: false } : w)) };
    expect(repairScheduleProfile(off).mealWindows.find((w) => w.id === "pre-workout")!.enabled).toBe(false);
  });
});
