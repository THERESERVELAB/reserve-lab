import { describe, expect, it } from "vitest";

import { buildDayTimeline, hhmm, inWords, minutesOf, type TimelineInput } from "../day-timeline";

const base: TimelineInput = {
  nowMin: 13 * 60,
  compounds: [
    { id: "c1", slotId: "c1", label: "Masteron", at: "08:00", state: "done" },
    { id: "c2", slotId: "c2", label: "Testosterone", at: "12:30", state: "due", detail: "Midday" },
    { id: "c3", slotId: "c3", label: "Creatine", at: "19:00", state: "ahead" },
  ],
  meals: [
    { id: "m1", label: "Breakfast", at: "07:00" },
    { id: "m2", label: "Dinner", at: "20:00" },
  ],
  training: { label: "Training", at: "17:30" },
  wakeTime: "06:30",
  windDownTime: "21:30",
  sleepTime: "22:30",
};

describe("day timeline", () => {
  it("places everything with a time in order, across a window that holds the whole day", () => {
    const t = buildDayTimeline(base);
    expect(t.marks.map((m) => m.label)).toEqual(["Wake", "Breakfast", "Masteron", "Testosterone", "Training", "Creatine", "Dinner", "Wind down", "Lights out"]);
    expect(t.startMin).toBe(6 * 60); // wake 06:30 less the window's half hour
    expect(t.endMin).toBe(23 * 60); // lights out 22:30 plus it
    const marks = Object.fromEntries(t.marks.map((m) => [m.label, m.pct]));
    expect(marks.Wake).toBeCloseTo(0.029, 2);
    expect(marks["Lights out"]).toBeCloseTo(0.971, 2);
    for (const m of t.marks) expect(m.pct).toBeGreaterThanOrEqual(0);
  });

  it("marks now where it actually is, and names what is next", () => {
    const t = buildDayTimeline(base);
    expect(t.now.label).toBe("13:00");
    expect(t.now.pct).toBeCloseTo((13 * 60 - 6 * 60) / (23 * 60 - 6 * 60), 3);
    /* A compound already due outranks the next thing on the clock. */
    expect(t.next?.mark.label).toBe("Testosterone");
    expect(t.next?.inMinutes).toBe(0);
    const later = buildDayTimeline({ ...base, nowMin: 18 * 60, compounds: base.compounds.map((c) => ({ ...c, state: c.id === "c2" ? "done" : c.state })) });
    expect(later.next?.mark.label).toBe("Creatine");
    expect(later.next?.inMinutes).toBe(60);
  });

  it("counts compounds logged, and never guesses a time for one that has none", () => {
    const t = buildDayTimeline({
      ...base,
      compounds: [...base.compounds, { id: "c4", slotId: "c4", label: "Vitamin D", at: null, state: "ahead" }],
    });
    expect(t.unplaced).toEqual([{ id: "c4", label: "Vitamin D", slotId: "c4" }]);
    expect(t.marks.some((m) => m.label === "Vitamin D")).toBe(false);
    expect(t.logged).toEqual({ done: 1, total: 4 });
  });

  it("an anchor that has passed reads as passed; only a compound can be missed", () => {
    const t = buildDayTimeline(base);
    const state = (label: string) => t.marks.find((m) => m.label === label)!.state;
    expect(state("Breakfast")).toBe("passed");
    expect(state("Dinner")).toBe("ahead");
    expect(state("Masteron")).toBe("done");
    expect(t.marks.filter((m) => m.state === "missed")).toEqual([]);
    const missed = buildDayTimeline({ ...base, compounds: [{ id: "c1", slotId: "c1", label: "Masteron", at: "08:00", state: "missed" }] });
    expect(missed.marks.find((m) => m.label === "Masteron")!.state).toBe("missed");
  });

  it("an empty day still reads, and times convert both ways", () => {
    const empty = buildDayTimeline({ nowMin: 600, compounds: [], meals: [], training: null });
    expect(empty.marks).toEqual([]);
    expect(empty.next).toBeNull();
    expect(empty.now.pct).toBeGreaterThanOrEqual(0);
    expect(minutesOf("07:45")).toBe(465);
    expect(minutesOf("25:00")).toBeNull();
    expect(minutesOf(null)).toBeNull();
    expect(hhmm(465)).toBe("07:45");
    expect(inWords(0)).toBe("now");
    expect(inWords(40)).toBe("in 40 min");
    expect(inWords(120)).toBe("in 2 h");
    expect(inWords(150)).toBe("in 2 h 30");
  });
});
