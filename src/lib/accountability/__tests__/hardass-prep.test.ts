import { describe, expect, it } from "vitest";

import type { CyclePeriod } from "@/lib/cycle/cycle-period";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import {
  HARDASS_COPY,
  hardassFixedCopy,
  hardassPrepStrings,
  resolveHardassPrep,
  type HardassPrepInput,
  type StandardCheckId,
} from "../hardass-prep";

/** Wednesday 16 September 2026, noon local. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = "2026-09-16";
const STAMP = "2026-08-01T12:00:00.000Z";

const noRecords: HardassPrepInput["records"] = { entries: [], cycles: [], labRecords: [], redFlagReports: [], checkIns: [] };

/** Nothing logged today; every target present. */
const base: HardassPrepInput = {
  now: NOW,
  training: { planned: true, sessionName: "Push A", completedSessionDates: [] },
  meals: { plannedMealIds: ["m1", "m2", "m3", "m4"], loggedMealIds: [] },
  protein: { loggedG: 0, targetG: 180 },
  sleep: { logs: [], targetHours: 8, wakeTime: "06:30", sleepTime: "22:30" },
  water: { logs: [], targetOz: 120 },
  checkIns: [],
  records: noRecords,
};

const cycle: CyclePeriod = {
  id: "c-1",
  name: "Autumn block",
  startDate: "2026-08-11",
  plannedWeeks: 12,
  compoundIds: ["e-test"],
  clinicianOversight: true,
  checkpoints: [{ id: "cp-mid", date: "2026-09-29", label: "Mid-cycle panel", setBy: "clinician" }],
  createdAt: STAMP,
  updatedAt: STAMP,
};

const enhancedRecords: HardassPrepInput["records"] = {
  entries: [{ id: "e-test", name: "Test C", displayName: "Testosterone Cypionate", isActive: true }],
  cycles: [cycle],
  labRecords: [],
  redFlagReports: [{ reportedAt: new Date(2026, 8, 15, 9, 0, 0).toISOString(), flags: ["irregular-heartbeat"] }],
  checkIns: [],
};

const check = (standard: ReturnType<typeof resolveHardassPrep>, id: StandardCheckId) => standard.checks.find((c) => c.id === id);

describe("resolveHardassPrep — the standard", () => {
  it("not enhanced: no On a Cycle block, the plain headline, open items still open", () => {
    const standard = resolveHardassPrep(base);
    expect(standard.onCycle).toBeNull();
    expect(standard.headline).toBe(HARDASS_COPY.headline);
    expect(check(standard, "training")).toMatchObject({ status: "open", where: "gym", logger: { kind: "training" } });
    expect(check(standard, "training")!.line).toBe("Push A is planned and not logged yet. Still open.");
    expect(check(standard, "meals")).toMatchObject({ status: "open", line: "0 of 4 planned meals logged. Still open.", logger: { kind: "meal", mealId: "m1" } });
    expect(check(standard, "water")).toMatchObject({ status: "open", logger: { kind: "water" } });
  });

  it("an unlogged night after wake time is a miss, and opens the sleep log", () => {
    const standard = resolveHardassPrep(base);
    expect(check(standard, "sleep")).toMatchObject({ status: "missed", line: "No sleep logged last night. That's a miss.", logger: { kind: "sleep" } });
    expect(standard.verdict).toMatch(/^1 missed\. Every miss is on the record\./);
  });

  it("before wake time the night is still open", () => {
    const early = resolveHardassPrep({ ...base, now: new Date(2026, 8, 16, 5, 0, 0) });
    expect(check(early, "sleep")).toMatchObject({ status: "open", line: "Log last night's sleep when you're up." });
  });

  it("met: everything logged against the member's own targets", () => {
    const standard = resolveHardassPrep({
      ...base,
      training: { ...base.training, completedSessionDates: [new Date(2026, 8, 16, 7, 0, 0).toISOString()] },
      meals: { plannedMealIds: ["m1", "m2"], loggedMealIds: ["m1", "m2"] },
      protein: { loggedG: 184.4, targetG: 180 },
      sleep: { ...base.sleep, logs: [{ date: TODAY, hours: 8.2 }] },
      water: { logs: [{ date: TODAY, oz: 64 }, { date: TODAY, oz: 64 }], targetOz: 120 },
      checkIns: [TODAY],
    });
    expect(standard.checks.every((c) => c.status === "met")).toBe(true);
    expect(standard.checks.every((c) => c.logger === null)).toBe(true);
    expect(check(standard, "sleep")!.line).toBe("8.2 h logged against your 8 h Recovery target.");
    expect(check(standard, "water")!.line).toBe("128 oz logged against your 120 oz Recovery target.");
    expect(check(standard, "protein")!.line).toBe("Est. 184 g logged against today's 180 g planning target.");
    expect(standard.verdict).toBe("Every check met today. Do it again tomorrow.");
  });

  it("short of the member's own sleep target is a miss", () => {
    const standard = resolveHardassPrep({ ...base, sleep: { ...base.sleep, logs: [{ date: TODAY, hours: 6.5 }] } });
    expect(check(standard, "sleep")).toMatchObject({ status: "missed", line: "6.5 h logged. Your Recovery target is 8 h. Short.", logger: null });
  });

  it("after the member's own sleep time, unlogged items are misses", () => {
    const late = resolveHardassPrep({ ...base, now: new Date(2026, 8, 16, 23, 0, 0) });
    expect(check(late, "training")).toMatchObject({ status: "missed", line: "Push A was planned and never logged. That's a miss." });
    expect(check(late, "meals")!.status).toBe("missed");
    expect(check(late, "water")!.status).toBe("missed");
    expect(check(late, "check-in")!.status).toBe("missed");
    expect(late.counts.open).toBe(0);
  });

  it("a sleep time past midnight never closes the day early", () => {
    const standard = resolveHardassPrep({ ...base, now: new Date(2026, 8, 16, 23, 30, 0), sleep: { ...base.sleep, sleepTime: "00:30" } });
    expect(check(standard, "training")!.status).toBe("open");
  });

  it("no session planned is not due", () => {
    const standard = resolveHardassPrep({ ...base, training: { planned: false, sessionName: null, completedSessionDates: [] } });
    expect(check(standard, "training")).toMatchObject({ status: "not-due", line: "No session planned today.", logger: null });
  });

  it("a session logged on another day does not count today", () => {
    const standard = resolveHardassPrep({ ...base, training: { ...base.training, completedSessionDates: ["2026-09-15"] } });
    expect(check(standard, "training")!.status).toBe("open");
  });

  describe("no target: the check is about logging, not a number", () => {
    it("no protein target — no protein check", () => {
      const standard = resolveHardassPrep({ ...base, protein: { loggedG: 90, targetG: null } });
      expect(check(standard, "protein")).toBeUndefined();
    });

    it("no sleep target — logged is met, with the logged hours only", () => {
      const standard = resolveHardassPrep({ ...base, sleep: { ...base.sleep, targetHours: null, logs: [{ date: TODAY, hours: 5 }] } });
      expect(check(standard, "sleep")).toMatchObject({ status: "met", line: "5 h logged last night." });
    });

    it("no water target — any log is met; none is open", () => {
      expect(check(resolveHardassPrep({ ...base, water: { logs: [{ date: TODAY, oz: 20 }], targetOz: null } }), "water")).toMatchObject({
        status: "met",
        line: "20 oz logged today.",
      });
      expect(check(resolveHardassPrep({ ...base, water: { logs: [], targetOz: null } }), "water")).toMatchObject({
        status: "open",
        line: "No water logged today. Still open.",
      });
    });

    it("no meal plan — counts logged meals, and offers no logger it cannot open", () => {
      const standard = resolveHardassPrep({ ...base, meals: { plannedMealIds: [], loggedMealIds: [] } });
      expect(check(standard, "meals")).toMatchObject({ status: "open", logger: null });
    });

    it("no check-in logger — no check-in check", () => {
      expect(check(resolveHardassPrep({ ...base, checkIns: null }), "check-in")).toBeUndefined();
    });

    it("prints no number that is not the member's own", () => {
      const standard = resolveHardassPrep({ ...base, protein: { loggedG: 0, targetG: null }, sleep: { ...base.sleep, targetHours: null }, water: { logs: [], targetOz: null } });
      const numbers = hardassPrepStrings(standard).join(" ").match(/\d+(?:\.\d+)?/g) ?? [];
      /* Only counts of the member's own planned meals and checks. */
      for (const n of numbers) expect(["0", "1", "2", "3", "4", "5"]).toContain(n);
    });
  });
});

describe("resolveHardassPrep — On a cycle", () => {
  it("present only when entries are active in the Logbook (the existing live rule)", () => {
    expect(resolveHardassPrep({ ...base, records: { ...noRecords, cycles: [cycle] } }).onCycle).toBeNull();
    expect(
      resolveHardassPrep({ ...base, records: { ...noRecords, entries: [{ id: "p", name: "Paused", isActive: true, pausedAt: "2026-09-01" }] } }).onCycle,
    ).toBeNull();
    expect(resolveHardassPrep({ ...base, records: enhancedRecords }).onCycle).not.toBeNull();
  });

  it("zero grace: the headline changes and open items are owed today", () => {
    const standard = resolveHardassPrep({ ...base, records: enhancedRecords });
    expect(standard.headline).toBe(HARDASS_COPY.headlineOnCycle);
    expect(check(standard, "training")!.line).toBe("Push A is planned and not logged yet. Owed today.");
    expect(check(standard, "water")!.line).toBe("No water logged today. Owed today.");
    expect(standard.verdict).toMatch(/owed today\.$/);
    expect(standard.onCycle!.live.outside).toBe("Outside the gym counts too: meals, sleep, water and daily check-in are part of the standard.");
  });

  it("gated: the cycle week and the checkpoint the member set, from the existing gated resolver", () => {
    const { gated } = resolveHardassPrep({ ...base, records: enhancedRecords }).onCycle!;
    expect(gated.cycleLine).toBe("Autumn block · Week 6 of 12");
    expect(gated.checkpointLine).toMatch(/^Next lab checkpoint · Mid-cycle panel · .+ · in 13 days · set by your clinician$/);
    expect(gated.clinicianLine).toBe("Anything unusual gets a medical review today.");
    expect(gated.recentRedFlags).toEqual(["irregular-heartbeat"]);
  });

  it("no checkpoint set — no checkpoint line", () => {
    const records = { ...enhancedRecords, cycles: [{ ...cycle, checkpoints: [] }] };
    expect(resolveHardassPrep({ ...base, records }).onCycle!.gated.checkpointLine).toBeNull();
  });

  it("gated fields never appear in the live output", () => {
    const standard = resolveHardassPrep({ ...base, records: enhancedRecords });
    const live = [standard.headline, standard.verdict, ...standard.checks.map((c) => c.line), ...Object.values(standard.onCycle!.live)].join(" ");
    for (const hidden of ["Week 6", "Autumn block", "Mid-cycle panel", "clinician", "checkpoint", "Testosterone"]) {
      expect(live).not.toContain(hidden);
    }
  });
});

describe("compliance", () => {
  const variants: HardassPrepInput[] = [
    base,
    { ...base, records: enhancedRecords },
    { ...base, now: new Date(2026, 8, 16, 23, 0, 0), records: enhancedRecords },
    { ...base, records: { ...enhancedRecords, cycles: [] } },
    { ...base, sleep: { ...base.sleep, logs: [{ date: TODAY, hours: 6 }] }, water: { logs: [{ date: TODAY, oz: 40 }], targetOz: 120 }, records: enhancedRecords },
  ];

  it("never produces banned safety language (compliance-language suite)", () => {
    for (const input of variants) {
      for (const text of hardassPrepStrings(resolveHardassPrep(input))) {
        expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
      }
    }
    for (const text of hardassFixedCopy()) expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
  });

  it("never claims protection, safety, a condition, or tells the member to change a compound", () => {
    const all = [...variants.flatMap((input) => hardassPrepStrings(resolveHardassPrep(input))), ...hardassFixedCopy()].join(" ");
    expect(all).not.toMatch(/\b(protect|reverse|safe|safer|offset|side effects?|cure|treat|diagnos|elevated|deficien|optimal)/i);
    expect(all).not.toMatch(/\b(start|stop|continue|increase|decrease|switch|change) (taking|using|your)\b/i);
    expect(all).not.toMatch(/\byour cycle requires\b/i);
    expect(all).not.toMatch(/\b(mg|mcg|iu|ml|units?)\b/i);
    expect(HARDASS_COPY.emergency).toMatch(/911/);
    expect(HARDASS_COPY.crisis).toMatch(/988/);
  });
});
