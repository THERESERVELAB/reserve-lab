import { describe, expect, it } from "vitest";

import { DEFAULT_DOUBLE_DAY, doubleDaySummary, morningDaysLabel, morningSessionFor, morningsPerWeek, sanitizeDoubleDay, type DoubleDay } from "../double-day";
import { splitActivity } from "../split-activities";
import { buildWeekGuidance, titleIsHeavyLower, titleIsLower, type GuidanceDay } from "../week-guidance";
import {
  commitmentLoad,
  commitmentSummary,
  deriveActivityStackKey,
  doesActivity,
  heavyLowerAvoidDays,
  isValidCommitment,
  sanitizeCommitments,
  totalSessionsPerWeek,
  type WeeklyCommitment,
} from "../weekly-commitments";

/* ACTIVITY_STACKS asked one question and offered eight preset bundles. It had
   no frequency, so "twice a week" was unsayable; no days, so "Tuesday and
   Thursday" was unsayable; and a single SportType, so "track every week AND
   Pilates twice" could not be expressed at all. The owner's own week — fasted
   cardio four times, Monday, Tuesday, Thursday, Friday — was not expressible
   anywhere in the product. */

const c = (over: Partial<WeeklyCommitment> & Pick<WeeklyCommitment, "activity">): WeeklyCommitment => ({
  id: `c-${over.activity}`,
  timesPerWeek: 1,
  days: [],
  ...over,
});

describe("pilates can finally be named", () => {
  it("exists as an activity, rated low rather than a high-load group class", () => {
    const pilates = splitActivity("pilates");
    expect(pilates).not.toBeNull();
    expect(pilates!.load).toBe("low");
    expect(splitActivity("group-class")!.load).toBe("high");
  });

  it("covers the studio modalities members actually name", () => {
    for (const key of ["pilates", "reformer-pilates", "barre", "walk", "hike", "strength-class"]) {
      expect(splitActivity(key), `${key} missing`).not.toBeNull();
    }
  });
});

describe("a commitment carries a frequency and real days", () => {
  it("expresses Pilates twice a week on Tuesday and Thursday", () => {
    const pilates = c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] });
    expect(isValidCommitment(pilates)).toBe(true);
    expect(commitmentSummary([pilates])).toContain("Pilates 2× on Tue and Thu");
  });

  it("expresses track every week alongside it", () => {
    const stack = [c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] }), c({ activity: "track", timesPerWeek: 1, days: [5] })];
    expect(totalSessionsPerWeek(stack)).toBe(3);
    expect(doesActivity(stack, "track")).toBe(true);
    expect(doesActivity(stack, "pilates")).toBe(true);
  });

  it("refuses more named days than the stated frequency", () => {
    expect(isValidCommitment(c({ activity: "pilates", timesPerWeek: 2, days: [0, 1, 3] }))).toBe(false);
  });

  it("refuses duplicate days and out-of-range days", () => {
    expect(isValidCommitment(c({ activity: "yoga", timesPerWeek: 2, days: [1, 1] }))).toBe(false);
    expect(isValidCommitment(c({ activity: "yoga", timesPerWeek: 2, days: [1, 9 as 0] }))).toBe(false);
  });

  it("drops a malformed row instead of breaking the week", () => {
    const good = c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] });
    expect(sanitizeCommitments([good, { nonsense: true }, null])).toEqual([good]);
  });

  it("weights load by what the activity actually costs", () => {
    /* The preset stacks called both of these a single label. */
    expect(commitmentLoad([c({ activity: "pilates", timesPerWeek: 2, days: [] })])).toBe("light");
    expect(commitmentLoad([c({ activity: "track", timesPerWeek: 2, days: [] }), c({ activity: "sport", timesPerWeek: 2, days: [] })])).toBe("heavy");
  });

  it("derives the legacy stack key so one question replaces two", () => {
    expect(deriveActivityStackKey([])).toBe("gym-only");
    expect(deriveActivityStackKey([c({ activity: "pilates" })])).toBe("gym-pilates");
    expect(deriveActivityStackKey([c({ activity: "pilates" }), c({ activity: "yoga" })])).toBe("gym-pilates-yoga");
    expect(deriveActivityStackKey([c({ activity: "pilates" }), c({ activity: "track" })])).toBe("gym-pilates-sports");
    expect(deriveActivityStackKey([c({ activity: "pilates" }), c({ activity: "yoga" }), c({ activity: "track" })])).toBe("full-hybrid");
  });

  it("flags the day after a high-load leg commitment", () => {
    const avoid = heavyLowerAvoidDays([c({ activity: "track", timesPerWeek: 1, days: [1] })]);
    expect(avoid.has(1)).toBe(true);
    expect(avoid.has(2)).toBe(true);
    expect(avoid.has(4)).toBe(false);
  });

  it("does not flag a low-load commitment as a leg conflict", () => {
    expect(heavyLowerAvoidDays([c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] })]).size).toBe(0);
  });
});

describe("double day is the owner's own week", () => {
  const owner: DoubleDay = {
    enabled: true,
    activity: "zone2",
    days: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
    minutes: 25,
    fasted: true,
    route: "split",
  };

  it("expresses four fasted mornings on named weekdays", () => {
    expect(morningsPerWeek(owner)).toBe(4);
    expect(morningDaysLabel(owner)).toBe("Mon, Tue, Thu and Fri");
  });

  it("states the split route the way it is actually run", () => {
    const m = morningSessionFor(owner, 0)!;
    expect(m.title).toBe("Fasted zone 2 cardio");
    expect(m.shape).toBe("25 min · Zone 2 · Treadmill + stair climber");
    expect(m.detail).toContain("treadmill");
    expect(m.detail).toContain("stair climber");
  });

  it("has no morning on a day she did not pick", () => {
    expect(morningSessionFor(owner, 2)).toBeNull();
    expect(morningSessionFor(owner, 5)).toBeNull();
  });

  it("is off by default and survives a malformed save", () => {
    expect(DEFAULT_DOUBLE_DAY.enabled).toBe(false);
    expect(sanitizeDoubleDay({ enabled: true, days: [99] })).toEqual(DEFAULT_DOUBLE_DAY);
    expect(sanitizeDoubleDay(owner)).toEqual(owner);
  });

  it("describes the arrangement without claiming anything about it", () => {
    const line = doubleDaySummary(owner);
    expect(line).toContain("before food");
    expect(line).not.toMatch(/burn|fat|metabolic|torch|melt|boost/i);
  });
});

describe("the guidance names the collision and the day", () => {
  const week: GuidanceDay[] = [
    { dayIndex: 0, title: "Glute Strength + Hamstrings", recovery: false, heavyLower: true, lower: true },
    { dayIndex: 1, title: "Back Line + Delts", recovery: false, heavyLower: false, lower: false },
    { dayIndex: 2, title: "Glute Shape + Abductors", recovery: false, heavyLower: false, lower: true },
    { dayIndex: 3, title: "Recovery", recovery: true, heavyLower: false, lower: false },
    { dayIndex: 4, title: "Shoulders + Back Width", recovery: false, heavyLower: false, lower: false },
    { dayIndex: 5, title: "Glute Pump + Waistline", recovery: false, heavyLower: false, lower: true },
    { dayIndex: 6, title: "Recovery", recovery: true, heavyLower: false, lower: false },
  ];
  const off = DEFAULT_DOUBLE_DAY;

  it("says nothing when there is nothing to say", () => {
    expect(buildWeekGuidance({ week, commitments: [], doubleDay: off }).notes.filter((n) => n.severity === "conflict")).toEqual([]);
  });

  it("catches a heavy lower day the morning after track", () => {
    const g = buildWeekGuidance({ week, commitments: [c({ activity: "track", timesPerWeek: 1, days: [6] })], doubleDay: off });
    const hit = g.notes.find((n) => n.id.startsWith("leg-collision"));
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("conflict");
    expect(hit!.detail).toContain("Track Session");
  });

  it("catches a morning session in front of the heaviest lower day", () => {
    const dd: DoubleDay = { ...DEFAULT_DOUBLE_DAY, enabled: true, days: [0], minutes: 25 };
    const g = buildWeekGuidance({ week, commitments: [], doubleDay: dd });
    const hit = g.notes.find((n) => n.id === "morning-before-heavy-0");
    expect(hit).toBeDefined();
    expect(hit!.detail).toContain("Glute Strength + Hamstrings");
  });

  it("calls a mobility day redundant when she already does studio work twice", () => {
    const mobilityWeek = [...week.slice(0, 4), { dayIndex: 4, title: "Mobility / Recovery", recovery: false, heavyLower: false, lower: false }, ...week.slice(5)];
    const g = buildWeekGuidance({ week: mobilityWeek, commitments: [c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] })], doubleDay: off });
    expect(g.notes.find((n) => n.id === "redundant-mobility")).toBeDefined();
  });

  it("reports the honest total rather than the planned sessions alone", () => {
    const dd: DoubleDay = { ...DEFAULT_DOUBLE_DAY, enabled: true, days: [0, 1, 3, 4] };
    const g = buildWeekGuidance({ week, commitments: [c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] })], doubleDay: dd });
    expect(g.loadLine).toContain("5 planned sessions");
    expect(g.loadLine).toContain("2 standing sessions");
    expect(g.loadLine).toContain("4 mornings");
    expect(g.loadLine).toContain("11 sessions in the week");
  });

  it("flags a week with nothing clear in it", () => {
    const dd: DoubleDay = { ...DEFAULT_DOUBLE_DAY, enabled: true, days: [3, 6] };
    const g = buildWeekGuidance({ week, commitments: [], doubleDay: dd });
    expect(g.notes.find((n) => n.id === "no-full-rest")).toBeDefined();
  });

  it("sorts conflicts above everything else", () => {
    const g = buildWeekGuidance({
      week,
      commitments: [c({ activity: "track", timesPerWeek: 1, days: [6] })],
      doubleDay: { ...DEFAULT_DOUBLE_DAY, enabled: true, days: [3] },
    });
    expect(g.notes[0].severity).toBe("conflict");
  });

  it("never claims one thing caused another", () => {
    const g = buildWeekGuidance({
      week,
      commitments: [c({ activity: "track", timesPerWeek: 1, days: [6] }), c({ activity: "pilates", timesPerWeek: 2, days: [1, 3] })],
      doubleDay: { ...DEFAULT_DOUBLE_DAY, enabled: true, days: [0, 1, 3, 4], fasted: true },
    });
    for (const n of g.notes) {
      expect(`${n.title} ${n.detail}`).not.toMatch(/\b(cured|caused|fixed|prevents?|guarantee|will make you)\b/i);
    }
  });
});

describe("title classification", () => {
  it("knows a heavy lower day from a pump day", () => {
    expect(titleIsHeavyLower("Glute Strength + Hamstrings")).toBe(true);
    expect(titleIsHeavyLower("Lower Strength + Glutes")).toBe(true);
    expect(titleIsHeavyLower("Legs")).toBe(true);
    expect(titleIsHeavyLower("Glute Pump + Waistline")).toBe(false);
    expect(titleIsHeavyLower("Glute Detail + Calves")).toBe(false);
    expect(titleIsHeavyLower("Back Line + Delts")).toBe(false);
  });

  it("knows a lower day at all", () => {
    expect(titleIsLower("Glute Shape + Abductors")).toBe(true);
    expect(titleIsLower("Quad Shape + Glute Support")).toBe(true);
    expect(titleIsLower("Upper Tone + Core")).toBe(false);
  });
});
