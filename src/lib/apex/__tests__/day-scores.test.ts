import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { bannedWordIn } from "@/lib/ui/log-moment";
import { RESERVE_WEIGHTS } from "@/lib/recovery/engine";
import {
  buildDayScores,
  fuelPace,
  fuelRing,
  hydrationState,
  latestNight,
  previousDateKey,
  readinessParts,
  readinessRing,
  recoveryState,
  scheduleState,
  sleepRing,
  trainingState,
  weekdayOf,
  type DayScoresInput,
} from "../day-scores";

const TODAY = "2026-09-15"; // a Tuesday

const ACTIVE: DayScoresInput = {
  readiness: { hasData: true, hasLogs: true, reserve: 68 },
  sleep: { logs: [{ date: "2026-09-14", hours: 7.4 }, { date: "2026-09-13", hours: 7.9 }], targetHours: 8, today: TODAY },
  fuel: {
    meals: [
      { id: "midday", state: "logged" },
      { id: "pre", state: "due" },
      { id: "post", state: "upcoming" },
    ],
    loggedProteinG: 52,
    proteinTargetG: 179,
  },
  session: "staged",
  recovery: { hasData: true, debt: "building" },
  hydration: { todayOz: 64, targetOz: 120 },
  schedule: { sleepCompression: false },
};

const FRESH: DayScoresInput = {
  readiness: { hasData: false, hasLogs: false, reserve: 0 },
  sleep: { logs: [], targetHours: 8, today: TODAY },
  fuel: { meals: [{ id: "a", state: "upcoming" }, { id: "b", state: "upcoming" }], loggedProteinG: 0, proteinTargetG: 176 },
  session: "staged",
  recovery: { hasData: false, debt: "clear" },
  hydration: { todayOz: 0, targetOz: 100 },
  schedule: { sleepCompression: false },
};

describe("readiness dial", () => {
  it("reads the engine's reserve on the Bible §05 bands", () => {
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 82 })).toMatchObject({ word: "Ready", tone: "ready", reading: { value: 82, fraction: 0.82 } });
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 78 }).word).toBe("Ready");
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 77 })).toMatchObject({ word: "Steady", tone: "steady" });
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 62 }).word).toBe("Steady");
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 61 })).toMatchObject({ word: "Restore", tone: "attention" });
    expect(readinessRing({ hasData: true, hasLogs: true, reserve: 12 }).tone).toBe("attention");
  });

  it("is labelled derived and never complete — a readiness is not a target", () => {
    const ring = readinessRing({ hasData: true, hasLogs: true, reserve: 100 });
    expect(ring.provenance).toBe("derived");
    expect(ring.complete).toBe(false);
  });

  it("is empty, not zero, without enough evidence", () => {
    const none = readinessRing({ hasData: false, hasLogs: false, reserve: 0 });
    expect(none.reading).toBeNull();
    expect(none.empty?.prompt).toBe("Check in");
    expect(none.tone).toBe("idle");
    const limited = readinessRing({ hasData: false, hasLogs: true, reserve: 0 });
    expect(limited.reading).toBeNull();
    expect(limited.word).toBe("Limited");
    expect(limited.empty?.prompt).toBe("One more log");
  });
});

describe("sleep dial", () => {
  it("reads today's log as last night", () => {
    const ring = sleepRing({ logs: [{ date: TODAY, hours: 8.2 }], targetHours: 8, today: TODAY });
    expect(ring).toMatchObject({ word: "Met", tone: "ready", complete: true, qualifier: null, reading: { value: 8.2, unit: "h", fraction: 1 } });
  });

  it("shows yesterday's log named by its day, never as last night", () => {
    const ring = sleepRing({ logs: [{ date: "2026-09-14", hours: 7.4 }], targetHours: 8, today: TODAY });
    expect(ring.qualifier).toBe("Mon");
    expect(ring.reading?.value).toBe(7.4);
    expect(ring.word).toBe("Close");
    expect(ring.ariaLabel).toContain("logged Mon");
  });

  it("says Short below 85% of the member's own target", () => {
    expect(sleepRing({ logs: [{ date: TODAY, hours: 6.0 }], targetHours: 8, today: TODAY })).toMatchObject({ word: "Short", tone: "attention", complete: false });
    expect(sleepRing({ logs: [{ date: TODAY, hours: 6.8 }], targetHours: 8, today: TODAY }).word).toBe("Close");
  });

  it("is empty when nothing from last night or the night before is logged", () => {
    const stale = sleepRing({ logs: [{ date: "2026-09-12", hours: 8 }], targetHours: 8, today: TODAY });
    expect(stale.reading).toBeNull();
    expect(stale.empty?.prompt).toBe("Log sleep");
    expect(stale.word).toBe("No log");
    expect(sleepRing({ logs: [], targetHours: 8, today: TODAY }).reading).toBeNull();
    /* A zero-hour row is not a night. */
    expect(sleepRing({ logs: [{ date: TODAY, hours: 0 }], targetHours: 8, today: TODAY }).reading).toBeNull();
  });

  it("reads calendar keys without a time-zone shift", () => {
    expect(previousDateKey("2026-09-01")).toBe("2026-08-31");
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
    expect(weekdayOf("2026-09-15")).toBe("Tue");
    expect(latestNight([{ date: TODAY, hours: 7 }, { date: "2026-09-14", hours: 9 }], TODAY)?.lastNight).toBe(true);
  });
});

describe("fuel dial", () => {
  it("draws the logged protein estimate against today's planning estimate", () => {
    const ring = fuelRing(ACTIVE.fuel);
    expect(ring).toMatchObject({ provenance: "est.", word: "On pace", tone: "ready", complete: false, reading: { value: 52, unit: "g" } });
    expect(ring.reading?.fraction).toBeCloseTo(52 / 179);
  });

  it("is empty — not 0 g — before the first meal is logged", () => {
    const ring = fuelRing(FRESH.fuel);
    expect(ring.reading).toBeNull();
    expect(ring.empty?.prompt).toBe("Log meal");
    expect(ring.word).toBe("No log");
  });

  it("says Behind when a planned meal has passed unlogged, empty or not", () => {
    const behind = fuelRing({ meals: [{ id: "a", state: "past-due" }, { id: "b", state: "due" }], loggedProteinG: 0, proteinTargetG: 180 });
    expect(behind).toMatchObject({ reading: null, word: "Behind", tone: "attention" });
    expect(fuelPace({ meals: [{ id: "a", state: "logged" }, { id: "b", state: "past-due" }] }).word).toBe("Behind");
  });

  it("is complete only when the grams fill it", () => {
    const all = fuelRing({ meals: [{ id: "a", state: "logged" }], loggedProteinG: 150, proteinTargetG: 180 });
    expect(all.word).toBe("Complete");
    expect(all.complete).toBe(false);
    expect(all.reading?.fraction).toBeCloseTo(150 / 180);
    const full = fuelRing({ meals: [{ id: "a", state: "logged" }], loggedProteinG: 190, proteinTargetG: 180 });
    expect(full.complete).toBe(true);
    expect(full.reading?.fraction).toBe(1);
  });

  it("asks for meal windows when none are mapped", () => {
    const ring = fuelRing({ meals: [], loggedProteinG: 0, proteinTargetG: 180 });
    expect(ring.empty?.prompt).toBe("Map meals");
    expect(ring.word).toBe("No plan");
  });
});

describe("system states", () => {
  it("answers every system in one word, green, amber or grey — never red", () => {
    const { systems } = buildDayScores(ACTIVE);
    expect(systems.map((s) => s.id)).toEqual(["training", "fuel", "recovery", "sleep", "hydration", "schedule"]);
    expect(systems.map((s) => `${s.label} ${s.word}`)).toEqual([
      "Training Staged",
      "Fuel On pace",
      "Recovery Building",
      "Sleep Close",
      "Hydration Behind",
      "Schedule Clear",
    ]);
    for (const s of systems) expect(["ready", "attention", "idle"]).toContain(s.tone);
  });

  it("maps each training state", () => {
    expect(trainingState("rest")).toMatchObject({ word: "Rest", tone: "idle" });
    expect(trainingState("live")).toMatchObject({ word: "Live", tone: "ready" });
    expect(trainingState("done")).toMatchObject({ word: "Done", tone: "ready" });
    expect(trainingState("past-due")).toMatchObject({ word: "Past due", tone: "attention" });
  });

  it("keeps recovery, hydration and schedule honest", () => {
    expect(recoveryState({ hasData: false, debt: "clear" })).toMatchObject({ word: "No data", tone: "idle" });
    expect(recoveryState({ hasData: true, debt: "clear" })).toMatchObject({ word: "Clear", tone: "ready" });
    expect(recoveryState({ hasData: true, debt: "accumulating" })).toMatchObject({ word: "Debt", tone: "attention" });
    expect(hydrationState({ todayOz: 0, targetOz: 120 })).toMatchObject({ word: "No log", tone: "idle" });
    expect(hydrationState({ todayOz: 120, targetOz: 120 }).word).toBe("Met");
    expect(hydrationState({ todayOz: 104, targetOz: 120 }).word).toBe("On target");
    expect(scheduleState({ sleepCompression: true })).toMatchObject({ word: "Tight", tone: "attention" });
  });

  it("a fresh member sees empty dials and grey states, never a zero", () => {
    const { rings, systems } = buildDayScores(FRESH);
    expect(rings.every((r) => r.reading === null && r.empty !== null)).toBe(true);
    expect(rings.map((r) => r.empty?.prompt)).toEqual(["Check in", "Log sleep", "Log meal"]);
    expect(systems.find((s) => s.id === "recovery")?.tone).toBe("idle");
    expect(systems.find((s) => s.id === "hydration")?.word).toBe("No log");
  });
});

describe("readiness breakdown", () => {
  it("re-weights over what was logged and leaves the rest out", () => {
    const parts = readinessParts({
      weights: RESERVE_WEIGHTS,
      logged: ["sleep", "check-in"],
      sleepAvg7: 7.4,
      sleepTargetHours: 8,
      hydrationAdherence: 0,
      mobilityThisWeek: 0,
      mobilityWeeklyTarget: 3,
      stressLoadLabel: "Low",
    });
    expect(parts.map((p) => p.sharePct)).toEqual([55, null, null, 45]);
    expect(parts[0].reading).toBe("7.4 h average, 7 nights · 93% of your 8 h target");
    expect(parts[1].reading).toBeNull();
    expect(parts[3].reading).toBe("Stress load · Low");
  });
});

describe("words", () => {
  it("never praise, judge, promise or speak about health", () => {
    const words = [ACTIVE, FRESH].flatMap((input) => {
      const { rings, systems } = buildDayScores(input);
      return [...rings.flatMap((r) => [r.label, r.word, r.empty?.prompt ?? "", r.ariaLabel]), ...systems.flatMap((s) => [s.label, s.word, s.source])];
    });
    for (const text of words) {
      /* "up" is banned in log moments; "Log sleep" etc. are fine, and no word here says "up". */
      expect(bannedWordIn(text), text).toBeNull();
      expect(bannedLanguageIn(text), text).toEqual([]);
    }
  });
});
