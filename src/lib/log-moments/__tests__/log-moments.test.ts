import { describe, expect, it } from "vitest";

import type { PhotoCheckIn, PhysiqueEntry } from "@/lib/physique/types";
import { announcementText, bannedWordIn, detailText, planLogMoment, type LogMomentContent } from "@/lib/ui/log-moment";
import { cycleCheckInMoment, labPanelMoment } from "@/lib/log-moments/records";

import { resolveBodyMoment, type BodyLogState } from "../body";
import {
  activityDayMoment,
  compoundMarkMoment,
  customSessionMoment,
  doneMarkMoment,
  drinkMoment,
  observationMoment,
  resolveDailyCheckInMoment,
  stepsMoment,
  timelineNoteMoment,
} from "../marks";
import { resolveCheckInMoment, resolveMobilityMoment, resolveSleepMoment, resolveWaterMoment, type RecoveryLogState } from "../recovery";
import { dayStreak, reachedMark, shiftDay, weekStartKey, weekStreak } from "../streaks";
import { resolveCloseOutMoment, type TrainingCloseState } from "../training";

const TODAY = "2026-09-17"; // a Thursday

const recovery = (over: Partial<RecoveryLogState> = {}): RecoveryLogState => ({
  sleepLogs: [],
  hydrationLogs: [],
  mobilityLogs: [],
  stressCheckIns: [],
  sleepTargetHours: 8,
  hydrationTargetOz: 120,
  mobilityWeeklyTarget: 4,
  ...over,
});

const nights = (count: number, endingDaysAgo = 0) =>
  Array.from({ length: count }, (_, i) => ({ date: shiftDay(TODAY, -(endingDaysAgo + count - 1 - i)), hours: 7 }));

/** Every line a moment can say, for the compliance scan. */
const allWords = (m: LogMomentContent) => [m.lead, detailText(m), m.milestone?.headline ?? "", announcementText(m)];

const produced: LogMomentContent[] = [];
const keep = <T extends LogMomentContent | null>(m: T): T => {
  if (m) produced.push(m);
  return m;
};

describe("streaks", () => {
  it("counts days and Monday weeks ending now, and stops at a gap", () => {
    expect(dayStreak(["2026-09-15", "2026-09-16", "2026-09-17"], TODAY)).toBe(3);
    expect(dayStreak(["2026-09-15", "2026-09-16"], TODAY)).toBe(0);
    expect(weekStartKey(TODAY)).toBe("2026-09-14");
    expect(weekStartKey("2026-09-13")).toBe("2026-09-07");
    expect(weekStreak(["2026-09-01", "2026-09-09", "2026-09-17"], TODAY)).toBe(3);
    expect(weekStreak(["2026-08-20", "2026-09-17"], TODAY)).toBe(1);
  });

  it("reaches a mark only on the log that lands on it", () => {
    expect(reachedMark(6, 7, [3, 7])).toBe(7);
    expect(reachedMark(7, 8, [3, 7])).toBeNull();
    expect(reachedMark(7, 7, [3, 7])).toBeNull();
  });
});

describe("sleep", () => {
  it("states the hours and the nights in a row, full tier", () => {
    const before = recovery({ sleepLogs: nights(4, 1) });
    const after = recovery({ sleepLogs: [...before.sleepLogs, { date: TODAY, hours: 7.4 }] });
    const m = keep(resolveSleepMoment(before, after, TODAY))!;
    expect(m.tier).toBe("full");
    expect(m.lead).toBe("Sleep logged");
    expect(detailText(m)).toBe("7.4 h · 5 nights in a row");
    expect(m.milestone).toBeNull();
  });

  it("a streak reaching 7 is the milestone", () => {
    const before = recovery({ sleepLogs: nights(6, 1), mobilityLogs: [] });
    /* Keep the recovery rank steady so the streak is what shows. */
    const withDays = { ...before, hydrationLogs: nights(10, 1).map((n) => ({ date: n.date, oz: 10 })) };
    const after = { ...withDays, sleepLogs: [...withDays.sleepLogs, { date: TODAY, hours: 6.5 }] };
    const m = keep(resolveSleepMoment(withDays, after, TODAY))!;
    expect(m.milestone?.key).toBe("streak-7");
    expect(m.milestone?.headline).toBe("7 nights in a row.");
    expect(detailText(m)).toBe("6.5 h");
  });

  it("the member's own sleep target is a milestone when nothing stronger is", () => {
    const base = recovery({ hydrationLogs: nights(10, 1).map((n) => ({ date: n.date, oz: 10 })) });
    const after = { ...base, sleepLogs: [{ date: TODAY, hours: 8.2 }] };
    expect(keep(resolveSleepMoment(base, after, TODAY))?.milestone?.key).toBe("sleep-target");
  });

  it("the recovery record's rank up outranks every other milestone", () => {
    const before = recovery({ hydrationLogs: [{ date: shiftDay(TODAY, -2), oz: 10 }, { date: shiftDay(TODAY, -1), oz: 10 }] });
    const after = { ...before, sleepLogs: [{ date: TODAY, hours: 9 }] };
    const m = keep(resolveSleepMoment(before, after, TODAY))!;
    expect(m.milestone?.key).toBe("rank-operator");
    expect(m.milestone?.headline).toBe("Operator rank.");
  });

  it("saving the same night again is a quiet mark with no milestone", () => {
    const before = recovery({ sleepLogs: [{ date: TODAY, hours: 6 }] });
    const after = recovery({ sleepLogs: [{ date: TODAY, hours: 8.5 }] });
    const m = keep(resolveSleepMoment(before, after, TODAY))!;
    expect(m.tier).toBe("mark");
    expect(m.lead).toBe("Sleep updated");
    expect(m.milestone).toBeNull();
  });
});

describe("water", () => {
  const history = nights(10, 1).map((n) => ({ date: n.date, oz: 10 }));

  it("a glass is a mark that counts today's total", () => {
    const before = recovery({ hydrationLogs: [...history, { date: TODAY, oz: 48 }] });
    const after = { ...before, hydrationLogs: [...before.hydrationLogs, { date: TODAY, oz: 16 }] };
    const m = keep(resolveWaterMoment(before, after, TODAY))!;
    expect(m.tier).toBe("mark");
    expect(detailText(m)).toBe("+16 oz · 64 of 120 oz today");
    expect(m.detail.find((p) => typeof p !== "string")).toEqual({ value: 64, from: 48, decimals: 0 });
    expect(m.milestone).toBeNull();
  });

  it("the glass that reaches the member's target is the full moment", () => {
    const before = recovery({ hydrationLogs: [...history, { date: TODAY, oz: 110 }] });
    const after = { ...before, hydrationLogs: [...before.hydrationLogs, { date: TODAY, oz: 16 }] };
    const m = keep(resolveWaterMoment(before, after, TODAY))!;
    expect(m.tier).toBe("full");
    expect(m.milestone?.headline).toBe("Hydration target reached.");
    /* Past the target, the next glass is a mark again. */
    const more = { ...after, hydrationLogs: [...after.hydrationLogs, { date: TODAY, oz: 16 }] };
    expect(keep(resolveWaterMoment(after, more, TODAY))?.milestone).toBeNull();
  });

  it("nothing added is no moment", () => {
    const state = recovery({ hydrationLogs: history });
    expect(resolveWaterMoment(state, state, TODAY)).toBeNull();
  });
});

describe("mobility and the recovery check-in", () => {
  const history = nights(10, 1).map((n) => ({ date: n.date, oz: 10 }));

  it("mobility is a mark with this week's count, full at the weekly target", () => {
    const before = recovery({ hydrationLogs: history, mobilityLogs: [{ date: shiftDay(TODAY, -3), kind: "recovery", minutes: 8 }] });
    const after = { ...before, mobilityLogs: [...before.mobilityLogs, { date: TODAY, kind: "recovery" as const, minutes: 8 }] };
    const m = keep(resolveMobilityMoment(before, after, TODAY))!;
    expect(m.tier).toBe("mark");
    expect(detailText(m)).toBe("8 min · 2 of 4 this week");
    const full = recovery({ hydrationLogs: history, mobilityLogs: [0, 1, 2].map((d) => ({ date: shiftDay(TODAY, -d - 1), kind: "recovery" as const, minutes: 8 })) });
    const reached = { ...full, mobilityLogs: [...full.mobilityLogs, { date: TODAY, kind: "walk" as const, minutes: 20 }] };
    const r = keep(resolveMobilityMoment(full, reached, TODAY))!;
    expect(r.tier).toBe("full");
    expect(r.lead).toBe("Walk logged");
    expect(r.milestone?.key).toBe("mobility-target");
  });

  it("a check-in states the days in a row", () => {
    const before = recovery({ hydrationLogs: history, stressCheckIns: [{ date: shiftDay(TODAY, -1), stress: 2 }] });
    const after = { ...before, stressCheckIns: [...before.stressCheckIns, { date: TODAY, stress: 3 }] };
    const m = keep(resolveCheckInMoment(before, after, TODAY))!;
    expect(m.tier).toBe("full");
    expect(m.lead).toBe("Check-in logged");
    expect(detailText(m)).toBe("2 days in a row");
  });
});

describe("body", () => {
  const entry = (id: string, date: string, weight: number, measurements: PhysiqueEntry["measurements"] = {}): PhysiqueEntry => ({ id, date, bodyWeightLb: weight, measurements });
  const photo = (id: string, date: string): PhotoCheckIn => ({ id, date, poses: ["front-relaxed", "side-relaxed"], consistencyScore: 80 });
  const state = (entries: PhysiqueEntry[] = [], photos: PhotoCheckIn[] = []): BodyLogState => ({ entries, photoCheckIns: photos });

  it("weight words are neutral: the value only, never the change, never counted from the last weigh-in", () => {
    const before = state([entry("a", "2026-09-10", 191.4)]);
    const lighter = state([...before.entries, entry("b", TODAY, 188.1)]);
    const heavier = state([...before.entries, entry("c", TODAY, 194.6)]);
    const down = keep(resolveBodyMoment(before, lighter, TODAY))!;
    const up = keep(resolveBodyMoment(before, heavier, TODAY))!;
    expect(down.lead).toBe("Weight logged");
    expect(detailText(down)).toBe("188.1 lb · 2 weeks in a row");
    expect(detailText(up)).toBe("194.6 lb · 2 weeks in a row");
    /* The two moments are the same shape whichever way the number went. */
    expect(down.milestone).toEqual(up.milestone);
    for (const m of [down, up]) {
      const weight = m.detail.find((p) => typeof p !== "string");
      expect(weight && typeof weight !== "string" && weight.from).toBe(weight && typeof weight !== "string" && weight.value);
    }
  });

  it("names sites and poses, and the first check-in is the milestone", () => {
    const after = state([entry("a", TODAY, 180, { waist: 32, chest: 42 })], [photo("p", TODAY)]);
    const m = keep(resolveBodyMoment(state(), after, TODAY))!;
    expect(m.lead).toBe("Check-in saved");
    expect(detailText(m)).toBe("180.0 lb · 2 sites · 2 poses");
    expect(m.milestone?.key).toBe("first-check-in");
    const photoOnly = keep(resolveBodyMoment(state([entry("a", "2026-09-01", 180)]), state([entry("a", "2026-09-01", 180)], [photo("p", TODAY)]), TODAY))!;
    expect(photoOnly.kind).toBe("photo");
    expect(photoOnly.lead).toBe("Photo check-in saved");
  });

  it("four weeks of check-ins in a row is the milestone", () => {
    const weeks = [21, 14, 7].map((d, i) => entry(`w${i}`, shiftDay(TODAY, -d), 185));
    const m = keep(resolveBodyMoment(state(weeks), state([...weeks, entry("now", TODAY, 185)]), TODAY))!;
    expect(m.milestone?.key).toBe("weeks-4");
  });
});

describe("training close-out", () => {
  const record = (id: string, date: string) => ({ id, calendarDate: date, status: "completed" as const, completedAt: `${date}T18:00:00.000Z` });
  const training = (mode: string, count: number): TrainingCloseState => ({
    sessionMode: mode,
    executionHistory: Array.from({ length: count }, (_, i) => record(`s${i}`, shiftDay(TODAY, -(count - 1 - i)))),
  });

  it("states the sets and the last seven days", () => {
    const m = keep(resolveCloseOutMoment({ before: training("live", 2), after: training("closed", 3), today: TODAY, setsLogged: 18 }))!;
    expect(m.lead).toBe("Session saved");
    expect(detailText(m)).toBe("18 sets · 3 in the last 7 days");
    expect(m.milestone).toBeNull();
  });

  it("the tenth session on the record is the milestone; a session already closed is no moment", () => {
    expect(keep(resolveCloseOutMoment({ before: training("live", 9), after: training("closed", 10), today: TODAY, setsLogged: 0 }))?.milestone?.key).toBe("sessions-10");
    expect(resolveCloseOutMoment({ before: training("closed", 3), after: training("closed", 3), today: TODAY, setsLogged: 4 })).toBeNull();
  });
});

describe("everyday marks", () => {
  it("a compound or supplement mark is only ever a neutral mark: Logged, nothing else", () => {
    const m = keep(compoundMarkMoment());
    expect(m).toEqual({ kind: "compound", tier: "mark", tone: "log", lead: "Logged", detail: [], milestone: null });
    const plan = planLogMoment(m, "full");
    expect(plan.boom).toBe(false);
    expect(plan.flow).toBe(false);
  });

  it("the day's check-in counts the run and marks 7 days", () => {
    const m = keep(resolveDailyCheckInMoment({ currentStreak: 6, lastCheckInDate: shiftDay(TODAY, -1) }, { currentStreak: 7, lastCheckInDate: TODAY }, TODAY));
    expect(m.lead).toBe("Checked in");
    /* The headline names the run, so the detail does not repeat it. */
    expect(detailText(m)).toBe("");
    expect(m.milestone?.headline).toBe("7 days in a row.");
    expect(detailText(keep(resolveDailyCheckInMoment({ currentStreak: 4, lastCheckInDate: shiftDay(TODAY, -1) }, { currentStreak: 5, lastCheckInDate: TODAY }, TODAY)))).toBe("Day 5 in a row");
    const again = keep(resolveDailyCheckInMoment({ currentStreak: 7, lastCheckInDate: TODAY }, { currentStreak: 7, lastCheckInDate: TODAY }, TODAY));
    expect(again.tier).toBe("mark");
    expect(again.milestone).toBeNull();
    expect(detailText(keep(resolveDailyCheckInMoment({ currentStreak: 4, lastCheckInDate: "2026-09-01" }, { currentStreak: 1, lastCheckInDate: TODAY }, TODAY)))).toBe("Day 1");
  });

  it("notes, observations and done marks are calm and carry no milestone", () => {
    const note = keep(timelineNoteMoment({ date: TODAY, total: 4 }));
    expect(announcementText(note)).toBe("Note saved. Timeline · Sep 17 · 4 notes.");
    expect(note.milestone).toBeNull();
    for (const m of [
      observationMoment(),
      doneMarkMoment({ label: "Walk", done: true }),
      doneMarkMoment({ label: "Walk", done: false }),
      activityDayMoment({ label: "Tuesday", status: "skipped" }),
      stepsMoment({ before: 2000, after: 8400 }),
      drinkMoment({ name: "Electrolytes" }),
      customSessionMoment({ dayName: "Upper A" }),
    ]) {
      keep(m);
      expect(m.milestone).toBeNull();
      expect(m.tier).toBe("mark");
    }
  });
});

describe("lab and cycle records", () => {
  it("a logged panel counts what was recorded, and never reads the values", () => {
    const m = keep(labPanelMoment({ markerCount: 6, fileCount: 0, testDate: "2026-03-12" }));
    expect(m.tier).toBe("mark");
    expect(m.lead).toBe("Panel logged");
    expect(detailText(m)).toBe("6 markers · Mar 12, 2026");
    expect(m.milestone).toBeNull();
  });

  it("counts photos when a panel is filed as an image, and says so when it is only a note", () => {
    expect(detailText(keep(labPanelMoment({ markerCount: 0, fileCount: 2, testDate: "2026-03-12" })))).toBe("2 files · Mar 12, 2026");
    expect(detailText(keep(labPanelMoment({ markerCount: 1, fileCount: 1, testDate: null })))).toBe("1 marker · 1 file");
    expect(detailText(keep(labPanelMoment({ markerCount: 0, fileCount: 0, testDate: null })))).toBe("Notes only");
  });

  it("a cycle check-in records the day, never a judgement of it", () => {
    const m = keep(cycleCheckInMoment({ symptomCount: 3 }));
    expect(m.tier).toBe("mark");
    expect(m.lead).toBe("Check-in logged");
    expect(detailText(m)).toBe("3 symptoms recorded");
    expect(detailText(keep(cycleCheckInMoment({ symptomCount: 0 })))).toBe("No symptoms recorded");
    expect(detailText(keep(cycleCheckInMoment({ symptomCount: 1 })))).toBe("1 symptom recorded");
  });
});

describe("compliance", () => {
  it("no line any moment above can produce praises, judges or makes a health claim", () => {
    expect(produced.length).toBeGreaterThan(20);
    for (const m of produced) {
      for (const line of allWords(m)) {
        expect(bannedWordIn(line), `"${line}"`).toBeNull();
      }
    }
  });
});
