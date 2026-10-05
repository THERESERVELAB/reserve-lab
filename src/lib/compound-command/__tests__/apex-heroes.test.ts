import { describe, expect, it } from "vitest";

import type { CyclePeriod } from "@/lib/cycle/cycle-period";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import {
  APEX_HERO_COPY,
  CYCLE_START_COPY,
  apexCycleLine,
  apexHeroTiles,
  nextDayLabel,
  shortDate,
  type ApexHeroSource,
} from "../apex-heroes";

const today = (slotId: string, name: string, plannedTime: string, label: string, extra: Partial<Extract<ApexHeroSource, { kind: "today" }>> = {}): ApexHeroSource => ({
  kind: "today",
  slotId,
  entryId: slotId.split("@")[0],
  name,
  tier: "hero",
  plannedTime,
  plannedTimeLabel: label,
  state: "upcoming",
  upNext: false,
  siteNeeded: false,
  ...extra,
});

describe("nextDayLabel", () => {
  it("says tomorrow, a weekday inside the week, else a date", () => {
    /* Friday 18 September 2026. */
    expect(nextDayLabel("2026-09-19", "2026-09-18")).toEqual({ short: "Tomorrow", long: "tomorrow" });
    expect(nextDayLabel("2026-09-22", "2026-09-18")).toEqual({ short: "Tue", long: "Tuesday" });
    expect(nextDayLabel("2026-09-24", "2026-09-18")).toEqual({ short: "Thu", long: "Thursday" });
    expect(nextDayLabel("2026-09-25", "2026-09-18")).toEqual({ short: "Sep 25", long: "Friday, Sep 25" });
    expect(nextDayLabel("2026-09-18", "2026-09-18")?.short).toBe("Today");
  });

  it("returns null for the past or a malformed date", () => {
    expect(nextDayLabel("2026-09-17", "2026-09-18")).toBeNull();
    expect(nextDayLabel("2026-13-01", "2026-09-18")).toBeNull();
  });

  it("formats a date key without a timezone shift", () => {
    expect(shortDate("2026-09-16")).toBe("Sep 16");
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});

describe("apexHeroTiles", () => {
  it("shows main compounds only — add-ons never reach Apex", () => {
    const tiles = apexHeroTiles(
      [
        today("test@16:00", "Testosterone Enanthate", "16:00", "4:00 PM", { state: "due" }),
        today("fish@08:00", "Fish Oil", "08:00", "8:00 AM", { tier: "add-on", state: "due" }),
        { kind: "off-day", entryId: "d3", name: "Vitamin D3", tier: "add-on", nextDate: "2026-09-19" },
      ],
      "2026-09-18",
    );
    expect(tiles.map((t) => t.name)).toEqual(["Testosterone Enanthate"]);
  });

  it("orders today's heroes by the member's time then name, and off-days after by name — never by importance", () => {
    const tiles = apexHeroTiles(
      [
        { kind: "off-day", entryId: "mast", name: "Drostanolone Enanthate", tier: "hero", nextDate: "2026-09-21" },
        today("gh@22:00", "Somatropin", "22:00", "10:00 PM"),
        today("bpc@08:00", "BPC-157", "08:00", "8:00 AM"),
        today("aaa@08:00", "Anastrozole", "08:00", "8:00 AM"),
        { kind: "off-day", entryId: "test", name: "Boldenone", tier: "hero", nextDate: null },
      ],
      "2026-09-18",
    );
    expect(tiles.map((t) => t.name)).toEqual(["Anastrozole", "BPC-157", "Somatropin", "Boldenone", "Drostanolone Enanthate"]);
  });

  it("uses Compound Command's state words with the member's own time", () => {
    const [due, logged, missed, upNext, later, skipped] = apexHeroTiles(
      [
        today("a@09:00", "A", "09:00", "9:00 AM", { state: "due" }),
        today("b@10:00", "B", "10:00", "10:00 AM", { state: "logged", siteNeeded: true }),
        today("c@11:00", "C", "11:00", "11:00 AM", { state: "missed" }),
        today("d@12:00", "D", "12:00", "12:00 PM", { state: "due", upNext: true }),
        today("e@21:00", "E", "21:00", "9:00 PM", { state: "upcoming" }),
        today("f@22:00", "F", "22:00", "10:00 PM", { state: "skipped" }),
      ],
      "2026-09-18",
    );
    expect([due.word, due.when]).toEqual(["Due", "9:00 AM"]);
    expect([logged.word, logged.when, logged.siteNeeded]).toEqual(["Logged", null, true]);
    expect(logged.label).toBe("B · Logged · Site log needed");
    expect([missed.word, missed.when]).toEqual(["Missed", "11:00 AM"]);
    /* "Up next" rides in the gold outline and the accessible name; the tile keeps the state word and time. */
    expect([upNext.word, upNext.when, upNext.upNext]).toEqual(["Due", "12:00 PM", true]);
    expect(upNext.label).toBe("D · Up next · Due · 12:00 PM");
    expect([later.word, later.when]).toEqual(["Ready", "9:00 PM"]);
    expect([skipped.word, skipped.when]).toEqual(["Skipped", null]);
  });

  it("gives a hero with nothing today its next scheduled day instead of hiding it", () => {
    const [tile, unset] = apexHeroTiles(
      [
        { kind: "off-day", entryId: "test", name: "Testosterone Enanthate", tier: "hero", nextDate: "2026-09-22" },
        { kind: "off-day", entryId: "x", name: "Zeta", tier: "hero", nextDate: null },
      ],
      "2026-09-18",
    );
    expect([tile.word, tile.when, tile.state]).toEqual(["Next", "Tue", "not-today"]);
    expect(tile.label).toBe("Testosterone Enanthate · Not today · next Tuesday");
    expect([unset.word, unset.when]).toEqual([APEX_HERO_COPY.notToday, null]);
  });

  it("returns nothing when no main compound is logged", () => {
    expect(apexHeroTiles([], "2026-09-18")).toEqual([]);
  });
});

/* ─── Cycle ──────────────────────────────────────────────────────────── */

const cycle = (extra: Partial<CyclePeriod> = {}): CyclePeriod => ({
  id: "cyc-1",
  name: "Winter Recomp Blast",
  startDate: "2026-09-22",
  plannedWeeks: 12,
  compoundIds: ["test", "gh", "mast"],
  clinicianOversight: false,
  checkpoints: [],
  notes: "TEST + MAST + HGH 12 WEEKS",
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-10T12:00:00.000Z",
  ...extra,
});

/** Friday 18 September 2026, 9:00 AM local. */
const NOW = new Date(2026, 8, 18, 9, 0, 0);

describe("apexCycleLine — the member chooses when it starts", () => {
  it("a start the member set in the future reads 'Starts … · in N days'", () => {
    expect(apexCycleLine({ cycles: [cycle()], now: NOW })).toEqual({
      kind: "upcoming",
      cycleId: "cyc-1",
      startDate: "2026-09-22",
      line: "Starts Sep 22 · in 4 days",
    });
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-19" })], now: NOW })?.line).toBe("Starts Sep 19 · in 1 day");
  });

  it("the week number follows only the member-set start date", () => {
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-16" })], now: NOW })).toEqual({
      kind: "week",
      cycleId: "cyc-1",
      startDate: "2026-09-16",
      line: "Week 1 of 12 · started Sep 16",
    });
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-18" })], now: NOW })?.line).toBe("Week 1 of 12 · started Sep 18");
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-11" })], now: NOW })?.line).toBe("Week 2 of 12 · started Sep 11");
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-01" })], now: NOW })?.line).toBe("Week 3 of 12 · started Sep 1");
  });

  it("never reads a compound's start date or logs — the cycle's own date is the only input", () => {
    /* The owner's Testosterone Enanthate started Sep 16; the cycle says Sep 22. The line follows the cycle. */
    const line = apexCycleLine({ cycles: [cycle()], now: NOW });
    expect(line?.line).not.toMatch(/Sep 16|Testosterone/);
    expect(apexCycleLine.length, "takes one input object: cycles and the clock").toBe(1);
  });

  it("past the planned end, and ended or absent cycles", () => {
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-06-01" })], now: NOW })?.line).toBe("Past planned end Aug 23 · started Jun 1");
    expect(apexCycleLine({ cycles: [cycle({ startDate: "2026-09-01", endedOn: "2026-09-10" })], now: NOW })).toBeNull();
    expect(apexCycleLine({ cycles: [], now: NOW })).toBeNull();
  });

  it("every line and label passes the banned-language suite and never ranks or proposes", () => {
    const lines = [cycle(), cycle({ startDate: "2026-09-16" }), cycle({ startDate: "2026-06-01" })]
      .map((c) => apexCycleLine({ cycles: [c], now: NOW })?.line ?? "");
    const tiles = apexHeroTiles(
      [today("a@09:00", "A", "09:00", "9:00 AM", { state: "due", upNext: true }), { kind: "off-day", entryId: "b", name: "B", tier: "hero", nextDate: "2026-09-22" }],
      "2026-09-18",
    ).flatMap((t) => [t.word, t.label]);
    const text = [...lines, ...tiles, ...Object.values(APEX_HERO_COPY), ...Object.values(CYCLE_START_COPY)].join(" | ");
    expect(bannedLanguageIn(text)).toEqual([]);
    expect(text).not.toMatch(/\b(safe|important|priority|essential|best|must|critical|streak|great|nice|suggest|recommend|should)\b/i);
  });
});
