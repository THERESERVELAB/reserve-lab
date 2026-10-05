import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { bannedWordIn } from "@/lib/ui/log-moment";
import { STANDARD_LINES, dayIndex, pickMotivation, runOfDays, type MotivationInput } from "../motivation";

const TODAY = "2026-09-15";

const EMPTY: MotivationInput = {
  today: TODAY,
  checkIn: { currentStreak: 0, lastCheckInDate: null },
  sessions: { done: 0, planned: 5 },
  sleepLogs: [],
  sleepTargetHours: 8,
  hydrationLogs: [],
  hydrationTargetOz: 120,
};

const key = (offset: number) => {
  const d = new Date(Date.UTC(2026, 8, 15 + offset));
  return d.toISOString().slice(0, 10);
};

describe("the day's line", () => {
  it("falls back to the standing set when the record has nothing to say", () => {
    const line = pickMotivation(EMPTY);
    expect(line.source).toBe("standard");
    expect(STANDARD_LINES).toContain(line.text);
  });

  it("is the same line all day, and moves with the calendar", () => {
    const a = pickMotivation(EMPTY);
    expect(pickMotivation({ ...EMPTY })).toEqual(a);
    const tomorrow = pickMotivation({ ...EMPTY, today: key(1) });
    expect(tomorrow.text).not.toBe(a.text);
    /* Over the set's length every standing line shows once. */
    const seen = new Set(Array.from({ length: STANDARD_LINES.length }, (_, i) => pickMotivation({ ...EMPTY, today: key(i) }).text));
    expect(seen.size).toBe(STANDARD_LINES.length);
  });

  it("prefers a line from the member's own record", () => {
    const line = pickMotivation({ ...EMPTY, sessions: { done: 2, planned: 5 } });
    expect(line).toMatchObject({ source: "record", id: "sessions-week", text: "2 of 5 sessions closed this week." });
  });

  it("counts a check-in run only while it is current", () => {
    const current = pickMotivation({ ...EMPTY, checkIn: { currentStreak: 6, lastCheckInDate: key(-1) } });
    expect(current.text).toBe("6 days checked in, no gaps.");
    const lapsed = pickMotivation({ ...EMPTY, checkIn: { currentStreak: 6, lastCheckInDate: key(-3) } });
    expect(lapsed.source).toBe("standard");
  });

  it("counts nights logged in a row and the member's own target met", () => {
    const hours = [8.1, 7.2, 8.4, 8.0, 7.9, 8.2, 8.3];
    const at = (offset: number) => ({ ...EMPTY, today: key(offset), sleepLogs: hours.map((h, i) => ({ date: key(offset + i - 6), hours: h })) });
    const lines = [0, 1, 2, 3, 4].map((offset) => pickMotivation(at(offset)));
    expect(lines.every((l) => l.id === "sleep-run" || l.id === "sleep-target")).toBe(true);
    expect(lines.map((l) => l.text)).toEqual(expect.arrayContaining(["7 nights logged in a row.", "8 h sleep target met 5 of 7 nights."]));
  });

  it("rotates across the record lines that are true, one per day", () => {
    const at = (offset: number): MotivationInput => ({
      ...EMPTY,
      today: key(offset),
      checkIn: { currentStreak: 4, lastCheckInDate: key(offset) },
      sessions: { done: 1, planned: 4 },
      sleepLogs: [8, 8, 8].map((hours, i) => ({ date: key(offset + i - 2), hours })),
    });
    expect(pickMotivation(at(0))).toEqual(pickMotivation(at(0)));
    const week = new Set([0, 1, 2, 3, 4].map((offset) => pickMotivation(at(offset)).id));
    expect(week).toEqual(new Set(["check-in-run", "sessions-week", "sleep-run"]));
  });

  it("counts a water target from the member's own logs", () => {
    const at = (offset: number): MotivationInput => ({
      ...EMPTY,
      today: key(offset),
      hydrationLogs: [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [
        { date: key(offset - i), oz: 70 },
        { date: key(offset - i), oz: i < 4 ? 60 : 10 },
      ]),
    });
    const lines = [0, 1, 2, 3, 4].map((offset) => pickMotivation(at(offset)));
    expect(lines.every((l) => l.text === "Water target met 4 of 7 days.")).toBe(true);
  });

  it("never praises, promises, or speaks about health", () => {
    const texts = [...STANDARD_LINES];
    texts.push(
      pickMotivation({ ...EMPTY, sessions: { done: 3, planned: 5 } }).text,
      pickMotivation({ ...EMPTY, checkIn: { currentStreak: 9, lastCheckInDate: TODAY } }).text,
    );
    for (const text of texts) {
      expect(bannedWordIn(text), text).toBeNull();
      expect(bannedLanguageIn(text), text).toEqual([]);
      expect(text.length).toBeLessThanOrEqual(60);
    }
  });

  it("reads calendar days", () => {
    expect(dayIndex("1970-01-02")).toBe(1);
    expect(runOfDays(new Set([key(-1), key(-2), key(-3)]), TODAY)).toBe(3);
    expect(runOfDays(new Set([TODAY, key(-2)]), TODAY)).toBe(1);
    expect(runOfDays(new Set(), TODAY)).toBe(0);
  });
});
