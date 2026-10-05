import { describe, expect, it } from "vitest";

import type { CyclePeriod } from "@/lib/cycle/cycle-period";
import { formatDayFull } from "@/lib/physique/record-summary";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import {
  ROOM_COPY,
  resolveEnhancedRoomContext,
  roomContextStrings,
  type EnhancedRoom,
  type RoomContextInput,
} from "../room-context";

/** Wednesday 16 September 2026, noon local. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const ROOMS: EnhancedRoom[] = ["apex", "training", "nutrition", "recovery"];
const STAMP = "2026-08-01T12:00:00.000Z";

const empty: RoomContextInput = { now: NOW, entries: [], cycles: [], labRecords: [], redFlagReports: [], checkIns: [] };

const entries: RoomContextInput["entries"] = [
  { id: "e-test", name: "Test C", displayName: "Testosterone Cypionate", isActive: true },
  { id: "e-mast", name: "Masteron", officialName: "Drostanolone Enanthate", isActive: true },
  { id: "e-paused", name: "Paused Thing", isActive: true, pausedAt: "2026-09-01" },
  { id: "e-old", name: "Old Thing", isActive: false },
];

/** Started Tue Aug 11: Sep 16 is day 37 → week 6 of 12. */
const cycle: CyclePeriod = {
  id: "c-1",
  name: "Autumn block",
  startDate: "2026-08-11",
  plannedWeeks: 12,
  compoundIds: ["e-test", "e-mast"],
  clinicianOversight: true,
  checkpoints: [
    { id: "cp-mid", date: "2026-09-29", label: "Mid-cycle panel", setBy: "clinician" },
    { id: "cp-base", date: "2026-08-01", label: "Baseline panel", setBy: "member" },
  ],
  createdAt: STAMP,
  updatedAt: STAMP,
};

const full: RoomContextInput = {
  now: NOW,
  entries,
  cycles: [cycle],
  labRecords: [
    {
      id: "lab-1",
      testDate: "2026-09-02",
      labName: "Quest",
      markers: [
        { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" },
        { name: "ALT", value: "31", unit: "U/L", referenceRange: "9-46" },
      ],
    },
  ],
  redFlagReports: [{ reportedAt: new Date(2026, 8, 15, 9, 0, 0).toISOString(), flags: ["irregular-heartbeat"] }],
  checkIns: [{ date: "2026-09-14", symptoms: ["insomnia", "acne"] }],
};

describe("resolveEnhancedRoomContext", () => {
  it("returns null in every room when nothing enhanced is logged", () => {
    for (const room of ROOMS) expect(resolveEnhancedRoomContext(room, empty)).toBeNull();
  });

  it("returns null when every logged entry is paused or inactive and no cycle is open", () => {
    const quiet = { ...empty, entries: entries.slice(2) };
    for (const room of ROOMS) expect(resolveEnhancedRoomContext(room, quiet)).toBeNull();
  });

  it("returns null when the only cycle has ended and nothing is active", () => {
    const ended = { ...empty, cycles: [{ ...cycle, endedOn: "2026-09-01", endReason: "completed" as const }] };
    expect(resolveEnhancedRoomContext("training", ended)).toBeNull();
  });

  it("intake only: the live part names active entries as logged, and nothing is derived", () => {
    const intake = { ...empty, entries };
    const context = resolveEnhancedRoomContext("training", intake)!;
    expect(context.live).toEqual({
      entryNames: ["Testosterone Cypionate", "Drostanolone Enanthate"],
      statement: "2 entries active in your log",
      routes: [{ kind: "view", view: "supplements", label: "Open Compound Command" }],
      note: expect.any(String),
    });
    expect(context.gated.statement).toBe("No cycle dates recorded");
    expect(context.gated.facts.find((f) => f.id === "linked")).toBeUndefined();
    expect(context.apexLine.live).toBe("2 entries active in your log · Testosterone Cypionate · Drostanolone Enanthate");
  });

  it("cycle only: there is no live part, so production renders nothing", () => {
    const context = resolveEnhancedRoomContext("apex", { ...empty, cycles: [cycle] })!;
    expect(context.live).toBeNull();
    expect(context.apexLine.live).toBeNull();
  });

  it("an active cycle reads week X of Y by the member's own dates", () => {
    const context = resolveEnhancedRoomContext("training", full)!;
    expect(context.gated.statement).toBe("Autumn block · Week 6 of 12");
    expect(context.gated.detail).toBe("By the dates you entered · started Aug 11, 2026 · planned end Nov 2, 2026");
    expect(context.gated.facts.find((f) => f.id === "linked")?.value).toBe("Testosterone Cypionate · Drostanolone Enanthate");
    expect(resolveEnhancedRoomContext("apex", full)!.apexLine.gated).toBe(
      "Autumn block · Week 6 of 12 · next lab checkpoint Sep 29, 2026",
    );
  });

  it("an upcoming cycle and one past its planned end say so rather than counting a week", () => {
    const upcoming = resolveEnhancedRoomContext("recovery", { ...full, cycles: [{ ...cycle, startDate: "2026-09-21" }] })!;
    expect(upcoming.gated.statement).toBe("Autumn block · Starts soon");
    expect(upcoming.gated.detail).toBe("By the dates you entered · starts Sep 21, 2026 · 12 weeks planned");

    const past = resolveEnhancedRoomContext("training", { ...full, cycles: [{ ...cycle, startDate: "2026-06-01", plannedWeeks: 8 }] })!;
    expect(past.gated.statement).toBe("Autumn block · Past planned end");
    expect(past.gated.pastEndNotice).toBe(
      "Testosterone Cypionate · Drostanolone Enanthate are still marked active in your log, past the end date you entered. Worth getting reviewed.",
    );
  });

  it("nutrition carries the next checkpoint, the overdue one, the latest draw and the lab's own flag and range", () => {
    const context = resolveEnhancedRoomContext("nutrition", full)!;
    const facts = Object.fromEntries(context.gated.facts.map((f) => [f.id, f.value]));
    expect(facts.checkpoint).toBe("Mid-cycle panel · Sep 29, 2026 · in 13 days · set by your clinician");
    expect(facts.overdue).toBe("Baseline panel · Aug 1, 2026");
    expect(facts["latest-draw"]).toBe("Sep 2, 2026 · 14 days ago");
    expect(context.gated.labFlags).toEqual([
      {
        id: "hematocrit",
        marker: "Hematocrit",
        reading: "52.1 % · Sep 2, 2026",
        range: "Range on your report 38.5-50.0 %",
        flag: "The lab flagged this High · Above the range on your report",
        route: "Get this reviewed",
        critical: false,
      },
    ]);
    expect(context.gated.routes).toEqual([{ kind: "view", view: "bloodwork", label: "Open Bloodwork Log" }]);
  });

  it("nutrition says plainly when no checkpoint or draw exists", () => {
    const context = resolveEnhancedRoomContext("nutrition", { ...empty, entries })!;
    expect(context.gated.facts.map((f) => f.value)).toEqual(["None set", "No lab record logged"]);
    expect(context.gated.labFlags).toEqual([]);
  });

  it("training and recovery carry logged symptoms and recent warning signs, with the symptom check route", () => {
    const training = resolveEnhancedRoomContext("training", full)!;
    const facts = Object.fromEntries(training.gated.facts.map((f) => [f.id, f.value]));
    expect(facts["red-flags"]).toBe("Sep 15, 2026 · A racing, pounding or irregular heartbeat that does not settle");
    expect(facts["check-in"]).toBe("Sep 14, 2026 · Trouble sleeping · Acne");
    expect(training.gated.recentRedFlags).toEqual(["irregular-heartbeat"]);
    expect(training.gated.routes.map((r) => r.kind)).toEqual(["symptom-check", "view"]);

    const recovery = resolveEnhancedRoomContext("recovery", full)!;
    expect(recovery.gated.routes.map((r) => r.kind)).toEqual(["sleep-log", "symptom-check", "view"]);
  });

  it("a warning sign older than the recent window no longer escalates", () => {
    const old = { ...full, redFlagReports: [{ reportedAt: new Date(2026, 8, 10).toISOString(), flags: ["chest-pain" as const] }] };
    const context = resolveEnhancedRoomContext("training", old)!;
    expect(context.gated.recentRedFlags).toEqual([]);
    expect(context.gated.facts.find((f) => f.id === "red-flags")).toBeUndefined();
  });

  it("Apex carries no facts — one line and one link", () => {
    const context = resolveEnhancedRoomContext("apex", full)!;
    expect(context.gated.facts).toEqual([]);
    expect(context.gated.labFlags).toEqual([]);
    expect(context.gated.routes).toHaveLength(1);
  });
});

describe("no invention", () => {
  /** Every number the member supplied, or counted from their own dates and records. */
  function allowedNumbers(input: RoomContextInput): Set<string> {
    const allowed = new Set<string>();
    const add = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).forEach((n) => allowed.add(n));
    const dates = [
      ...input.cycles.flatMap((c) => [c.startDate, ...c.checkpoints.map((cp) => cp.date)]),
      "2026-11-02", // planned end: start + planned weeks, both the member's
      ...input.labRecords.map((r) => r.testDate),
      ...input.checkIns.map((c) => c.date),
      ...input.redFlagReports.map((r) => {
        const d = new Date(r.reportedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }),
    ];
    dates.forEach((date) => add(formatDayFull(date)));
    input.labRecords.forEach((r) => r.markers?.forEach((m) => [m.value, m.referenceRange ?? ""].forEach(add)));
    input.cycles.forEach((c) => add(String(c.plannedWeeks)));
    /* Counted from the member's own dates and records. */
    ["6", "13", "14", "2"].forEach((n) => allowed.add(n));
    return allowed;
  }

  it("prints no digit that is not the member's own value, date, week or count", () => {
    const allowed = allowedNumbers(full);
    for (const room of ROOMS) {
      for (const text of roomContextStrings(resolveEnhancedRoomContext(room, full)!)) {
        for (const number of text.match(/\d+(?:\.\d+)?/g) ?? []) {
          expect(allowed.has(number), `"${number}" in "${text}" (${room}) is not the member's own`).toBe(true);
        }
      }
    }
  });

  it("never names an amount, even where the member recorded one", () => {
    for (const room of ROOMS) {
      const text = roomContextStrings(resolveEnhancedRoomContext(room, full)!).join(" ");
      expect(text).not.toMatch(/\b(mg|mcg|iu|ml|units?)\b/i);
      expect(text).not.toMatch(/\b(protect|reverse|safe|cure|treat|diagnos|elevated|deficien|optimal)/i);
      expect(text).not.toMatch(/\b(start|stop|continue|increase|decrease|switch) (taking|using|your)\b/i);
    }
  });

  it("never produces banned safety language (compliance-language suite)", () => {
    const variants: RoomContextInput[] = [
      full,
      { ...empty, entries },
      { ...empty, cycles: [cycle] },
      { ...full, cycles: [{ ...cycle, startDate: "2026-09-21" }] },
      { ...full, cycles: [{ ...cycle, startDate: "2026-06-01", plannedWeeks: 8 }] },
      {
        ...full,
        labRecords: [{ id: "crit", testDate: "2026-09-10", markers: [{ name: "Potassium", value: "6.9", unit: "mmol/L", referenceRange: "3.5-5.3", labFlag: "HH" }] }],
      },
    ];
    for (const input of variants) {
      for (const room of ROOMS) {
        const context = resolveEnhancedRoomContext(room, input);
        if (!context) continue;
        for (const text of roomContextStrings(context)) {
          expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
        }
      }
    }
  });

  it("the section's fixed copy passes the same suite, and keeps its escalation numbers", () => {
    const copy = Object.values(ROOM_COPY).map((value) => (typeof value === "function" ? value(3) : value));
    for (const text of copy) expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
    expect(ROOM_COPY.emergency).toMatch(/911/);
    expect(ROOM_COPY.crisis).toMatch(/988/);
  });

  it("a critical lab flag routes to a clinician today, carrying the lab's own word", () => {
    const context = resolveEnhancedRoomContext("nutrition", {
      ...full,
      labRecords: [{ id: "crit", testDate: "2026-09-10", markers: [{ name: "Potassium", value: "6.9", unit: "mmol/L", referenceRange: "3.5-5.3", labFlag: "HH" }] }],
    })!;
    expect(context.gated.labFlags[0]).toMatchObject({
      flag: "The lab flagged this Critical high · Above the range on your report",
      route: "Get a medical review today",
      critical: true,
    });
  });
});
