import { describe, expect, it } from "vitest";

import { buildArchitectureResolvedWeek, resolveDailyTrainingContext } from "../daily-context";
import { SPLIT_SYSTEMS, buildSplitRecommendation } from "../split-architect";
import { SPLIT_ARCHITECTURES, getArchitectureForSystem } from "../split-architectures";
import { SPLIT_ACTIVITIES } from "../split-activities";
import {
  DEFAULT_SPLIT_CUSTOMIZATION,
  SPLIT_SESSIONS,
  applySplitCustomization,
  recordSplitDayEdit,
  suggestRecurringEdits,
  weekDateKeys,
  type SplitCustomization,
} from "../split-customization";
import { resolveSplitKey } from "../workout-templates";

/* Wednesday 16 September 2026, noon. Its Monday-first week runs Sep 14–20,
   so Friday of this week is 2026-09-18. */
const WED = new Date(2026, 8, 16, 12);
const NO_CHEST = { active: false, upperChest: false };

/* ─── Library integrity ───────────────────────────────────────────────── */

describe("split library — every day resolves to something real", () => {
  it("every lifting day in every architecture loads a real template", () => {
    for (const arch of Object.values(SPLIT_ARCHITECTURES)) {
      for (const day of arch.week) {
        if (day.recovery) {
          expect(resolveSplitKey(day.title), `${arch.key}: "${day.title}"`).toBe("recovery");
        } else if (day.activity) {
          // An activity must never accidentally alias to a gym session.
          expect(resolveSplitKey(day.title), `${arch.key}: activity "${day.title}"`).toBeNull();
        } else if (!day.archetype) {
          expect(resolveSplitKey(day.title), `${arch.key}: "${day.title}" resolves to no template`).not.toBeNull();
        }
      }
    }
  });

  it("every architecture is a 7-day week whose training-day count matches daysPerWeek", () => {
    for (const arch of Object.values(SPLIT_ARCHITECTURES)) {
      expect(arch.week, arch.key).toHaveLength(7);
      expect(arch.week.filter((d) => !d.recovery).length, arch.key).toBe(arch.daysPerWeek);
    }
  });

  it("ships Push / Pull / Legs / Arms / Upper / Lower in that order", () => {
    const keys = SPLIT_ARCHITECTURES.pplula.week.filter((d) => !d.recovery).map((d) => resolveSplitKey(d.title));
    expect(keys).toEqual(["push", "pull", "legs", "arms", "upper", "lower"]);
  });

  it("every new split is selectable and resolves to its architecture", () => {
    for (const key of ["pplula", "bro-split", "full-body-3", "hybrid-bodybuilder", "hybrid-runner"]) {
      expect(SPLIT_SYSTEMS.some((s) => s.key === key), `${key} missing from the catalog`).toBe(true);
      expect(getArchitectureForSystem(key)?.key).toBe(key);
    }
  });

  it("pairs chest with back only in the splits whose identity calls for it", () => {
    const pairing = Object.values(SPLIT_ARCHITECTURES)
      .filter((arch) => arch.week.some((d) => !d.recovery && resolveSplitKey(d.title) === "chest-back"))
      .map((arch) => arch.key)
      .sort();
    expect(pairing).toEqual(["arnold", "contest-prep", "elite-six"]);
  });

  it("the hybrid bodybuilder carries a real track day, not a gym session", () => {
    const week = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES["hybrid-bodybuilder"], NO_CHEST, 1);
    const track = week.find((d) => d.activity?.key === "track");
    expect(track).toBeTruthy();
    expect(track!.splitKey).toBeNull();
    expect(track!.recovery).toBe(false);
  });
});

describe("split recommendation — reads hybrid and bodybuilding goals", () => {
  const base = { advanced: true, recoveryStrong: true, weakPointLabels: [], hasDeadline: false };
  const pick = (goal: string, trainingDaysPerWeek = 6) =>
    buildSplitRecommendation({ ...base, goal, trainingDaysPerWeek }).recommended.key;

  it("routes runners to the hybrid runner split", () => {
    expect(pick("Run a half marathon and keep my strength", 5)).toBe("hybrid-runner");
  });

  it("routes sprint / track athletes to the hybrid bodybuilder split", () => {
    expect(pick("Bodybuilding with track days")).toBe("hybrid-bodybuilder");
  });

  it("routes a six-day bodybuilder to Push / Pull / Legs / Upper / Lower / Arms", () => {
    expect(pick("Classic PPL bodybuilding")).toBe("pplula");
  });

  it("steps a five-day week down to a structure that matches the same identity", () => {
    expect(pick("PPL bodybuilding", 5)).toBe("bro-split");
    expect(pick("Hybrid athlete", 4)).toBe("hybrid-runner");
  });

  it("does not read 'trackable' or 'conditioning' as a hybrid goal", () => {
    expect(pick("Trackable progress")).not.toMatch(/hybrid/);
    expect(pick("Fat loss and conditioning")).toBe("recomp-performance");
  });

  it("never offers the recommendation again as its own alternative", () => {
    for (const goal of ["Run a marathon", "Hybrid athlete", "PPL bodybuilding"]) {
      const rec = buildSplitRecommendation({ ...base, goal, trainingDaysPerWeek: 6 });
      expect(rec.alternatives.map((a) => a.key)).not.toContain(rec.recommended.key);
      expect(rec.alternatives).toHaveLength(2);
    }
  });
});

describe("customization options — every choice is real", () => {
  it("every lifting option resolves to exactly its own template key", () => {
    for (const s of SPLIT_SESSIONS) {
      expect(resolveSplitKey(s.label), `"${s.label}"`).toBe(s.key);
    }
  });

  it("no activity label resolves to a lifting template", () => {
    for (const a of SPLIT_ACTIVITIES) {
      expect(resolveSplitKey(a.label), `"${a.label}"`).toBeNull();
    }
  });
});

/* ─── Applying edits ──────────────────────────────────────────────────── */

describe("applySplitCustomization", () => {
  const base = buildArchitectureResolvedWeek(SPLIT_ARCHITECTURES.arnold, NO_CHEST, 1);
  const dates = weekDateKeys(WED);
  const FRIDAY = 4;

  it("resolves the Monday-first week for a mid-week date", () => {
    expect(dates[0]).toBe("2026-09-14");
    expect(dates[FRIDAY]).toBe("2026-09-18");
    expect(dates[6]).toBe("2026-09-20");
  });

  it("an 'every Friday' change moves Friday to legs and clears the old archetype", () => {
    const c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: FRIDAY, dateKey: dates[FRIDAY], scope: "weekly", edit: { kind: "session", session: "legs" },
    }, WED);
    const week = applySplitCustomization(base, c, dates);
    expect(week[FRIDAY].splitKey).toBe("legs");
    expect(week[FRIDAY].displayTitle).toBe("Legs");
    expect(week[FRIDAY].archetype).toBeUndefined();
    expect(week[FRIDAY].memberEdit).toEqual({ scope: "weekly", kind: "session" });
    // Every other day is untouched.
    expect(week[0]).toEqual(base[0]);
  });

  it("'just this Friday' beats 'every Friday' for that date only", () => {
    let c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: FRIDAY, dateKey: dates[FRIDAY], scope: "weekly", edit: { kind: "session", session: "legs" },
    }, WED);
    c = recordSplitDayEdit(c, {
      dayIndex: FRIDAY, dateKey: dates[FRIDAY], scope: "once", edit: { kind: "rest" },
    }, WED);
    const thisWeek = applySplitCustomization(base, c, dates);
    expect(thisWeek[FRIDAY].recovery).toBe(true);
    expect(thisWeek[FRIDAY].memberEdit?.scope).toBe("once");

    const nextWeek = applySplitCustomization(base, c, weekDateKeys(new Date(2026, 8, 23, 12)));
    expect(nextWeek[FRIDAY].splitKey).toBe("legs");
  });

  it("a 5:45 AM group class stands in for the day as an activity, not a workout", () => {
    const c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: FRIDAY, dateKey: dates[FRIDAY], scope: "weekly",
      edit: { kind: "activity", activity: "group-class", startTime: "05:45" },
    }, WED);
    const day = applySplitCustomization(base, c, dates)[FRIDAY];
    expect(day.splitKey).toBeNull();
    expect(day.recovery).toBe(false);
    expect(day.activity).toMatchObject({ key: "group-class", startTime: "05:45", durationMinutes: 60 });
  });

  it("ignores stale or unknown edits instead of breaking the week", () => {
    const c = {
      weekly: { "4": { kind: "session", session: "not-a-session", updatedAt: "x" } },
      dated: {},
      history: [],
    } as unknown as SplitCustomization;
    expect(applySplitCustomization(base, c, dates)).toEqual(base);
  });
});

describe("recordSplitDayEdit", () => {
  const dates = weekDateKeys(WED);

  it("setting a weekly rule removes a one-off change on that date", () => {
    let c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: 4, dateKey: dates[4], scope: "once", edit: { kind: "rest" },
    }, WED);
    expect(c.dated[dates[4]]).toBeTruthy();
    c = recordSplitDayEdit(c, {
      dayIndex: 4, dateKey: dates[4], scope: "weekly", edit: { kind: "session", session: "legs" },
    }, WED);
    expect(c.dated[dates[4]]).toBeUndefined();
    expect(c.weekly["4"]).toMatchObject({ kind: "session", session: "legs" });
  });

  it("clearing returns the day to the plan", () => {
    let c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: 4, dateKey: dates[4], scope: "weekly", edit: { kind: "rest" },
    }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: dates[4], scope: "weekly", edit: null }, WED);
    expect(c.weekly["4"]).toBeUndefined();
  });

  it("keeps history bounded", () => {
    let c: SplitCustomization = DEFAULT_SPLIT_CUSTOMIZATION;
    for (let i = 0; i < 200; i += 1) {
      c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: dates[4], scope: "once", edit: { kind: "rest" } }, WED);
    }
    expect(c.history.length).toBeLessThanOrEqual(120);
  });
});

/* ─── Learning ────────────────────────────────────────────────────────── */

describe("suggestRecurringEdits", () => {
  const legs = { kind: "session", session: "legs" } as const;

  it("suggests a weekly change after the same Friday change in two recent weeks", () => {
    let c: SplitCustomization = DEFAULT_SPLIT_CUSTOMIZATION;
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-04", scope: "once", edit: legs }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-11", scope: "once", edit: legs }, WED);
    const [s] = suggestRecurringEdits(c, WED);
    expect(s).toMatchObject({ dayIndex: 4, weeks: 2, edit: { kind: "session", session: "legs" } });
  });

  it("a change the member took back is not evidence", () => {
    let c: SplitCustomization = DEFAULT_SPLIT_CUSTOMIZATION;
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-04", scope: "once", edit: legs }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-11", scope: "once", edit: legs }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-11", scope: "once", edit: null }, WED);
    expect(suggestRecurringEdits(c, WED)).toEqual([]);
  });

  it("a single change is not a pattern", () => {
    const c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: 4, dateKey: "2026-09-11", scope: "once", edit: legs,
    }, WED);
    expect(suggestRecurringEdits(c, WED)).toEqual([]);
  });

  it("does not suggest what is already the weekly rule", () => {
    let c: SplitCustomization = DEFAULT_SPLIT_CUSTOMIZATION;
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-04", scope: "once", edit: legs }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-11", scope: "once", edit: legs }, WED);
    c = recordSplitDayEdit(c, { dayIndex: 4, dateKey: "2026-09-18", scope: "weekly", edit: legs }, WED);
    expect(suggestRecurringEdits(c, WED)).toEqual([]);
  });
});

/* ─── The resolver honours the member ─────────────────────────────────── */

function resolve(over: Partial<Parameters<typeof resolveDailyTrainingContext>[0]> = {}) {
  return resolveDailyTrainingContext({
    now: WED,
    focus: undefined,
    weakPoints: [],
    protocolName: null,
    protocolArchitectureName: "",
    womensActive: false,
    ...over,
  });
}

describe("resolveDailyTrainingContext — the member's choice wins", () => {
  it("a chosen split shows with no protocol, instead of 'No session'", () => {
    const ctx = resolve({ requireActiveHorizon: true, splitSystemChosen: true, splitSystemKey: "pplula" });
    const titles = ctx.weeklyPlan.map((d) => d.displayTitle);
    expect(titles).not.toContain("No session");
    expect(titles.slice(0, 3)).toEqual(["Push", "Pull", "Legs"]);
    expect(ctx.programUnconfirmed).toBe(false);
    expect(ctx.memberArchitectureActive).toBe(true);
  });

  it("with no plan and no choice, the honest no-program state is unchanged", () => {
    const ctx = resolve({ requireActiveHorizon: true });
    expect(ctx.programUnconfirmed).toBe(true);
    expect(ctx.memberArchitectureActive).toBe(false);
  });

  it("today's change reaches the session the cockpit loads", () => {
    const dates = weekDateKeys(WED);
    const c = recordSplitDayEdit(DEFAULT_SPLIT_CUSTOMIZATION, {
      dayIndex: 2, dateKey: dates[2], scope: "once", edit: { kind: "session", session: "full-body" },
    }, WED);
    const ctx = resolve({
      requireActiveHorizon: true, splitSystemChosen: true, splitSystemKey: "pplula", splitCustomization: c,
    });
    expect(ctx.todayDisplayTitle).toBe("Full Body");
    expect(ctx.todaySplitKey).toBe("full-body");
  });
});
