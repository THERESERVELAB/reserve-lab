import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import {
  ASSUMED_DAYS_BETWEEN_STARTS,
  CYCLE_PHASE_META,
  CYCLE_PHASE_ORDER,
  cycleBasis,
  estimateCurrentPhase,
  estimatePhaseOn,
  groupByEstimatedPhase,
  localISODate,
  observedIntervals,
  periodStarts,
  phaseSpans,
  planDayLog,
  predictCycle,
} from "@/lib/women/cycle";
import { buildWomensEvidence, type WomensEvidenceInput } from "@/lib/women/evidence";
import { clearUntouchedWomensSample, LEGACY_WOMENS_DEFAULTS } from "@/lib/women/legacy-sample";
import { samePhaseComparison } from "@/lib/women/physique";
import {
  EMPTY_WOMENS_EVIDENCE,
  WOMENS_FIXED_COPY,
  resolveCycleCommand,
  resolveFertility,
  resolvePregnancy,
  resolveWomensNutrition,
  resolveWomensOverview,
  resolveWomensPhysique,
  resolveWomensRecovery,
  resolveWomensTraining,
  type WomensEvidence,
  type WomensResolution,
} from "@/lib/women/primary-actions";
import { dayFacts, phaseDaysRead } from "@/lib/women/summaries";
import { DEFAULT_WOMENS_STATE, type CycleLogEntry, type CycleProfile } from "@/lib/women/types";

/* Tuesday 15 September 2026, local noon. */
const NOW = new Date(2026, 8, 15, 12, 0, 0);
const TODAY = "2026-09-15";

const cycle = (over: Partial<CycleProfile> = {}): CycleProfile => ({ ...DEFAULT_WOMENS_STATE.cycle, ...over });
const log = (date: string, over: Partial<CycleLogEntry> = {}): CycleLogEntry => ({ id: `log-${date}`, date, symptoms: [], ...over });

function input(over: Partial<WomensEvidenceInput> = {}): WomensEvidenceInput {
  return {
    now: NOW,
    cycle: DEFAULT_WOMENS_STATE.cycle,
    cycleLogs: [],
    fertility: DEFAULT_WOMENS_STATE.fertility,
    pregnancy: DEFAULT_WOMENS_STATE.pregnancy,
    sleepLogs: [],
    hydrationLogs: [],
    recoveryLabel: null,
    loggedMealIds: [],
    nutritionLogDate: null,
    nutritionLogHistory: {},
    checkIns: [],
    photoCheckIns: [],
    trainingPlannedToday: false,
    sessionTitle: null,
    ...over,
  };
}

const withCycle = (over: Partial<WomensEvidence> = {}): WomensEvidence => ({
  ...EMPTY_WOMENS_EVIDENCE,
  cycle: { entered: true, dayOfCycle: 9, phase: "follicular", beyondEstimate: false, basisEntered: false, daysBetweenStarts: 28 },
  ...over,
});

/* ─── The calendar estimate ─────────────────────────────────────────────── */

describe("cycle estimate", () => {
  it("estimates nothing without a period start the member entered", () => {
    const e = estimateCurrentPhase(cycle(), NOW);
    expect(e).toMatchObject({ phase: null, dayOfCycle: null, estimated: false });
    expect(predictCycle(cycle(), NOW)).toEqual({ nextPeriodDate: null, daysUntilNextPeriod: null, estimated: false });
  });

  it("names the 28-day figure as an assumption until the member enters her own", () => {
    expect(cycleBasis(cycle({ lastPeriodStart: "2026-09-07" }))).toEqual({ daysBetweenStarts: 28, periodDays: 5, entered: false });
    expect(
      cycleBasis(cycle({ lastPeriodStart: "2026-09-07", averageCycleLengthDays: 32, averagePeriodLengthDays: 4, lengthsEnteredAt: "2026-09-01T00:00:00.000Z" })),
    ).toEqual({ daysBetweenStarts: 32, periodDays: 4, entered: true });
  });

  it("covers every day of the cycle with exactly one phase, at every basis the form accepts", () => {
    for (let n = 21; n <= 45; n += 1) {
      for (let p = 2; p <= 10; p += 1) {
        const spans = phaseSpans({ daysBetweenStarts: n, periodDays: p, entered: true });
        const covered = spans.flatMap((s) => Array.from({ length: s.lastDay - s.firstDay + 1 }, (_, i) => s.firstDay + i));
        expect(covered).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      }
    }
  });

  it("counts day 1 from the start and never projects past the basis", () => {
    const c = cycle({ lastPeriodStart: "2026-09-07" });
    expect(estimateCurrentPhase(c, NOW)).toMatchObject({ dayOfCycle: 9, phase: "follicular", estimated: true });
    const late = estimatePhaseOn("2026-10-10", c, ["2026-09-07"]);
    expect(late).toMatchObject({ dayOfCycle: 34, phase: null, beyondEstimate: true });
    expect(predictCycle(c, new Date(2026, 9, 10))).toMatchObject({ nextPeriodDate: null, estimated: false });
  });

  it("predicts only the next start — there is no fertile window", () => {
    const prediction = predictCycle(cycle({ lastPeriodStart: "2026-09-07" }), NOW);
    expect(prediction).toEqual({ nextPeriodDate: "2026-10-05", daysUntilNextPeriod: 20, estimated: true });
    expect(Object.keys(prediction).join(" ")).not.toMatch(/fertile|ovulat/i);
  });

  it("uses the local calendar day, not UTC", () => {
    expect(localISODate(new Date(2026, 8, 15, 23, 30))).toBe("2026-09-15");
  });

  it("describes phases as definitions of the calendar model, not claims about a body", () => {
    for (const phase of CYCLE_PHASE_ORDER) {
      expect(CYCLE_PHASE_META[phase].definition).not.toMatch(/athletes|energy|recovery|appetite|peak|feel/i);
    }
  });
});

describe("period starts", () => {
  it("merges logged period days into starts and keeps the entered date", () => {
    const logs = [log("2026-08-10", { isPeriodDay: true }), log("2026-08-11", { isPeriodDay: true }), log("2026-09-06", { isPeriodDay: true })];
    const starts = periodStarts(cycle({ lastPeriodStart: "2026-09-07" }), logs);
    expect(starts).toEqual(["2026-08-10", "2026-09-07"]);
    expect(observedIntervals(starts)).toEqual([{ from: "2026-08-10", to: "2026-09-07", days: 28 }]);
  });

  it("a period day logged far from the current start becomes the new start; a day within the period does not", () => {
    const c = cycle({ lastPeriodStart: "2026-08-18" });
    expect(planDayLog({ date: TODAY, isPeriodDay: true, symptoms: [] }, c, []).newPeriodStart).toBe(TODAY);
    expect(planDayLog({ date: "2026-08-20", isPeriodDay: true, symptoms: [] }, c, []).newPeriodStart).toBeNull();
    expect(planDayLog({ date: TODAY, isPeriodDay: false, symptoms: [] }, c, []).newPeriodStart).toBeNull();
  });

  it("one entry per day: logging a date again replaces it", () => {
    const existing = [log(TODAY, { energy: "low" }), log("2026-09-14")];
    expect(planDayLog({ date: TODAY, energy: "high", symptoms: [] }, cycle(), existing).replaceIds).toEqual([`log-${TODAY}`]);
  });

  it("groups the member's own entries by the phase estimated for each date and leaves undated ones out", () => {
    const c = cycle({ lastPeriodStart: "2026-09-01" });
    const groups = groupByEstimatedPhase([log("2026-09-02"), log("2026-09-10"), log("2026-08-01"), log("not-a-date")], c, ["2026-09-01"]);
    expect(groups.find((g) => g.phase === "menstrual")!.items).toHaveLength(1);
    expect(groups.find((g) => g.phase === "follicular")!.items).toHaveLength(1);
    expect(groups.flatMap((g) => g.items)).toHaveLength(2);
  });
});

/* ─── Evidence: only the logs the product actually writes ───────────────── */

describe("evidence", () => {
  it("is empty for a new member", () => {
    expect(buildWomensEvidence(input())).toEqual(EMPTY_WOMENS_EVIDENCE);
  });

  it("ignores the women's recovery, adherence and physique fields nothing writes", () => {
    const evidence = buildWomensEvidence(input());
    const stale = { ...DEFAULT_WOMENS_STATE, recovery: { reserve: 82, recentScores: [78, 80], habits: [] }, nutrition: { ...DEFAULT_WOMENS_STATE.nutrition, recentAdherence: [91] } };
    // The builder takes no women's recovery or adherence input at all.
    expect(Object.keys(input())).not.toContain("recovery");
    expect(stale.recovery.reserve).toBe(82);
    expect(evidence.recoveryLabel).toBeNull();
  });

  it("reads the member's real logs", () => {
    const evidence = buildWomensEvidence(
      input({
        cycle: cycle({ lastPeriodStart: "2026-09-07" }),
        cycleLogs: [log(TODAY, { trainingPerformance: "steady" }), log("2026-09-14", { energy: "high" })],
        sleepLogs: [{ date: TODAY }, { date: "2026-09-14" }],
        hydrationLogs: [{ date: TODAY, oz: 16 }],
        loggedMealIds: ["breakfast", "lunch"],
        nutritionLogDate: TODAY,
        nutritionLogHistory: { "2026-09-13": ["dinner"], "2026-09-12": [] },
        checkIns: [{ date: "2026-09-01" }],
        trainingPlannedToday: true,
        sessionTitle: "Lower Strength",
        fertility: { enabled: true, focusAreas: ["sleep", "environment"] },
      }),
    );
    expect(evidence).toMatchObject({
      loggedDays: 2,
      dayLoggedToday: true,
      trainingFeltToday: true,
      sleepNights: 2,
      sleepLoggedToday: true,
      waterLoggedToday: true,
      mealsToday: 2,
      mealDays: 2,
      checkIns: 1,
      fertilityAreas: 1,
    });
    expect(evidence.cycle).toMatchObject({ entered: true, dayOfCycle: 9, phase: "follicular", basisEntered: false });
  });

  it("counts yesterday's meal ids as zero meals today", () => {
    expect(buildWomensEvidence(input({ loggedMealIds: ["a"], nutritionLogDate: "2026-09-14" })).mealsToday).toBe(0);
  });
});

/* ─── One gold action per screen, starting the first missing thing ──────── */

const RESOLVERS: Record<string, (e: WomensEvidence) => WomensResolution> = {
  overview: resolveWomensOverview,
  cycle: resolveCycleCommand,
  training: resolveWomensTraining,
  recovery: resolveWomensRecovery,
  nutrition: resolveWomensNutrition,
  physique: resolveWomensPhysique,
  fertility: resolveFertility,
  pregnancy: resolvePregnancy,
};

describe("primary actions", () => {
  it("with no data every screen names what it needs, at zero, and offers one way in", () => {
    for (const [name, resolve] of Object.entries(RESOLVERS)) {
      const r = resolve(EMPTY_WOMENS_EVIDENCE);
      expect(r.action.label, name).toBeTruthy();
      expect(r.requirements.length, name).toBeGreaterThanOrEqual(2);
      expect(r.requirements.every((q) => q.have === 0), name).toBe(true);
      expect(`${r.statement} ${r.support}`, name).not.toMatch(/\d+\s?%/);
    }
  });

  it("overview starts the first missing requirement, then today's log, then the session", () => {
    expect(resolveWomensOverview(EMPTY_WOMENS_EVIDENCE).action).toMatchObject({ kind: "open-cycle-dates" });
    expect(resolveWomensOverview(withCycle()).action).toMatchObject({ kind: "open-day-log" });
    const fed = withCycle({ loggedDays: 3, sleepNights: 2, checkIns: 1 });
    expect(resolveWomensOverview(fed).action).toMatchObject({ kind: "open-day-log", label: "Log Today" });
    expect(resolveWomensOverview({ ...fed, dayLoggedToday: true, trainingPlannedToday: true }).action).toMatchObject({ kind: "open-view", view: "training" });
    expect(resolveWomensOverview({ ...fed, dayLoggedToday: true }).action).toMatchObject({ kind: "open-view", view: "womens-cycle" });
  });

  it("overview and cycle label the estimate and the assumed timing", () => {
    expect(resolveWomensOverview(withCycle()).support).toContain("assumed 28 days");
    expect(resolveCycleCommand(withCycle()).statement).toBe("Day 9 of your cycle");
    const entered = withCycle({ cycle: { ...withCycle().cycle, basisEntered: true, daysBetweenStarts: 31 } });
    expect(resolveCycleCommand(entered).support).toContain("31 days between periods you entered");
    const beyond = withCycle({ cycle: { ...withCycle().cycle, dayOfCycle: 40, phase: null, beyondEstimate: true } });
    expect(resolveCycleCommand(beyond).statement).toBe("Day 40 since your last period start");
  });

  it("cycle: start, then today, then usual timing, then edit", () => {
    expect(resolveCycleCommand(EMPTY_WOMENS_EVIDENCE).action.label).toBe("Enter Period Start");
    expect(resolveCycleCommand(withCycle()).action.label).toBe("Log Today");
    expect(resolveCycleCommand(withCycle({ dayLoggedToday: true })).action.label).toBe("Enter Your Usual Timing");
    const done = withCycle({ dayLoggedToday: true, cycle: { ...withCycle().cycle, basisEntered: true } });
    expect(resolveCycleCommand(done).action.label).toBe("Edit Today's Log");
    expect(resolveCycleCommand(done).secondary?.label).toBe("Edit Cycle Dates");
  });

  it("training opens today's session first and never changes it for a phase", () => {
    const r = resolveWomensTraining(withCycle({ trainingPlannedToday: true, sessionTitle: "Glute Strength" }));
    expect(r.statement).toBe("Glute Strength today");
    expect(r.action).toMatchObject({ kind: "open-view", view: "training" });
    expect(r.secondary).toMatchObject({ kind: "open-day-log" });
    expect(r.support).toContain("never changes a session");
    expect(resolveWomensTraining(EMPTY_WOMENS_EVIDENCE).action.kind).toBe("open-cycle-dates");
  });

  it("recovery: sleep, then water, then today's log", () => {
    expect(resolveWomensRecovery(EMPTY_WOMENS_EVIDENCE).action.kind).toBe("open-sleep-log");
    expect(resolveWomensRecovery({ ...EMPTY_WOMENS_EVIDENCE, sleepLoggedToday: true }).action).toMatchObject({ kind: "log-water", oz: 16 });
    expect(resolveWomensRecovery({ ...EMPTY_WOMENS_EVIDENCE, sleepLoggedToday: true, waterLoggedToday: true }).action.kind).toBe("open-day-log");
  });

  it("nutrition and physique land on their real loggers", () => {
    expect(resolveWomensNutrition(EMPTY_WOMENS_EVIDENCE).action).toMatchObject({ view: "nutrition" });
    expect(resolveWomensPhysique(EMPTY_WOMENS_EVIDENCE).action).toMatchObject({ view: "physique" });
    expect(resolveWomensPhysique({ ...EMPTY_WOMENS_EVIDENCE, checkIns: 2 }).action).toMatchObject({ view: "progress-photos" });
  });

  it("fertility is off until turned on, and never offers a window or timing", () => {
    const off = resolveFertility(EMPTY_WOMENS_EVIDENCE);
    expect(off.statement).toBe("Fertility tracking is off");
    expect(off.action.kind).toBe("enable-fertility");
    const on = resolveFertility({ ...withCycle(), fertilityEnabled: true });
    expect(on.action.kind).toBe("choose-areas");
    for (const r of [off, on]) expect(`${r.statement} ${r.support}`).toContain("does not time conception");
  });

  it("pregnancy routes care to a clinician, midwife or OB, and never shows a stage she did not enter", () => {
    expect(resolvePregnancy(EMPTY_WOMENS_EVIDENCE).action.kind).toBe("enable-pregnancy");
    const noStage = resolvePregnancy({ ...EMPTY_WOMENS_EVIDENCE, pregnancyEnabled: true });
    expect(noStage.statement).toBe("Stage not entered");
    expect(noStage.action.kind).toBe("open-stage");
    const staged = resolvePregnancy({ ...EMPTY_WOMENS_EVIDENCE, pregnancyEnabled: true, pregnancyStage: "second-trimester" });
    expect(staged.statement).toBe("Second Trimester");
    expect(staged.action.kind).toBe("open-sleep-log");
    for (const r of [noStage, staged]) expect(r.support).toContain("clinician, midwife or OB");
  });
});

/* ─── Honesty: saved defaults that read as the member's own ─────────────── */

describe("legacy defaults", () => {
  it("new members get no preselected fertility areas and no pregnancy stage", () => {
    expect(DEFAULT_WOMENS_STATE.fertility.focusAreas).toEqual([]);
    expect(DEFAULT_WOMENS_STATE.pregnancy.stage).toBeNull();
    expect(DEFAULT_WOMENS_STATE.cycle.lengthsEnteredAt).toBeNull();
  });

  it("clears the shipped fertility areas and trimester only while the module was never on", () => {
    const saved = {
      fertility: { enabled: false, focusAreas: [...LEGACY_WOMENS_DEFAULTS.fertilityFocusAreas], providerLabsNote: "", signatureMealIds: [] },
      pregnancy: { enabled: false, stage: "first-trimester", referenceDate: null },
    };
    const cleared = clearUntouchedWomensSample(saved);
    expect(cleared.fertility.focusAreas).toEqual([]);
    expect(cleared.pregnancy.stage).toBeNull();

    const chosen = { fertility: { ...saved.fertility, enabled: true }, pregnancy: { ...saved.pregnancy, enabled: true } };
    expect(clearUntouchedWomensSample(chosen)).toBe(chosen);
    expect(clearUntouchedWomensSample(cleared)).toBe(cleared);
  });
});

/* ─── Physique and summaries ────────────────────────────────────────────── */

describe("same-phase check-ins", () => {
  const c = cycle({ lastPeriodStart: "2026-08-10" });
  const starts = ["2026-08-10", "2026-09-07"];

  it("compares the two newest check-ins that share an estimated phase", () => {
    const r = samePhaseComparison(
      [
        { date: "2026-08-12", bodyWeightLb: 150 },
        { date: "2026-08-20", bodyWeightLb: 151 },
        { date: "2026-09-09", bodyWeightLb: 149.4 },
      ],
      c,
      starts,
    );
    expect(r).toMatchObject({ phase: "menstrual", deltaLb: -0.6 });
    expect(r!.from.date).toBe("2026-08-12");
  });

  it("reads nothing without a shared phase", () => {
    expect(samePhaseComparison([{ date: "2026-09-09", bodyWeightLb: 149 }], c, starts)).toBeNull();
    expect(samePhaseComparison([{ date: "2026-09-09", bodyWeightLb: 149 }, { date: "2026-08-20", bodyWeightLb: 151 }], c, starts)).toBeNull();
  });
});

describe("summaries", () => {
  it("describe the member's answers with their counts", () => {
    const days = [log("a", { energy: "low", trainingPerformance: "down", symptoms: ["cramps"] }), log("b", { energy: "low", symptoms: ["cramps", "fatigue"] }), log("c", { energy: "high" })];
    expect(phaseDaysRead(days)).toEqual({ primary: "3 days logged · energy low on 2 of 3", secondary: "Training harder than usual on 1 of 1 · Most noted: cramps (2)" });
    expect(dayFacts(log("d", { isPeriodDay: true, flow: "light", stress: "high" }))).toEqual(["Period · light", "Stress high"]);
  });
});

/* ─── Compliance: the banned-language suite over every fixed line ───────── */

const WOMEN_SPECIFIC_BANS: RegExp[] = [
  /\bfertile (?:window|days?)\b/i,
  /\bbest (?:time|day|days) to\b/i,
  /\b(?:most|least) likely to conceive\b/i,
  /\bsafe (?:to|for)\b/i,
  /\bcleared? (?:to|for)\b/i,
  /\bguarantee/i,
  /\bdiagnos/i,
  /\b(?:treat|treatment|cure)\b/i,
  /\byou should\b/i,
  /\bdue date is\b/i,
  /\b(?:readiness|fertility) score\b/i,
  /\bmomentum\b/i,
  /\b\d{1,3}\s?%/,
];

/**
 * For whole source files. The disclaimers legitimately say what Reserve is
 * NOT ("not medical advice, a diagnosis…"), so the negatable words stay out
 * of this list and are checked on the resolver copy instead.
 */
const SOURCE_BANS: RegExp[] = [
  /\bfertile (?:window|days?)\b/i,
  /\bbest (?:time|day|days) to\b/i,
  /\b(?:most|least) likely to conceive\b/i,
  /\bsafe (?:to|for)\b/i,
  /\bguarantee/i,
  /\byou should\b/i,
  /\bdue date is\b/i,
  /\b(?:readiness|fertility) score\b/i,
];

describe("compliance", () => {
  const texts = (r: WomensResolution) => [r.statement, r.support, r.action.label, r.secondary?.label ?? "", ...r.requirements.flatMap((q) => [q.label, q.detail, q.action.label])];

  const states: WomensEvidence[] = [
    EMPTY_WOMENS_EVIDENCE,
    withCycle(),
    withCycle({ dayLoggedToday: true, trainingPlannedToday: true, sessionTitle: "Upper", recoveryLabel: "Strong", mealsToday: 2, fertilityEnabled: true, fertilityAreas: 2, pregnancyEnabled: true, pregnancyStage: "third-trimester" }),
    withCycle({ cycle: { entered: true, dayOfCycle: 44, phase: null, beyondEstimate: true, basisEntered: true, daysBetweenStarts: 30 } }),
    { ...EMPTY_WOMENS_EVIDENCE, pregnancyEnabled: true },
  ];

  it("resolver copy passes the banned-language suite and the women's bans in every state", () => {
    for (const state of states) {
      for (const [name, resolve] of Object.entries(RESOLVERS)) {
        for (const text of texts(resolve(state))) {
          expect(bannedLanguageIn(text), `${name}: "${text}"`).toEqual([]);
          for (const ban of WOMEN_SPECIFIC_BANS) expect(text, `${name}: ${ban}`).not.toMatch(ban);
        }
      }
    }
    for (const line of WOMENS_FIXED_COPY) expect(bannedLanguageIn(line), line).toEqual([]);
  });

  /* Was eight screens. Four of them — Training, Nutrition, Recovery and
     Physique — only re-sorted data that already had a home, so a woman saw
     "Training Command" twice in her sidebar; they were removed and the phase
     lens they existed for now renders inside the commands that own the data.
     Those new files carry member-facing copy, so the scan follows them. */
  it("every women's screen and the phase lens carry no banned language in their source copy", () => {
    const dirs = ["src/components/views/women", "src/components/women"];
    const files = dirs.flatMap((d) =>
      readdirSync(join(process.cwd(), d))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => join(d, f)),
    );
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) {
      /* Comments document what was removed, so they are stripped before the scan. */
      const source = readFileSync(join(process.cwd(), file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(bannedLanguageIn(source), file).toEqual([]);
      for (const ban of SOURCE_BANS) expect(source, `${file}: ${ban}`).not.toMatch(ban);
    }
  });

  it("never uses the assumed figure without saying it is assumed", () => {
    expect(resolveCycleCommand(withCycle()).support).toMatch(new RegExp(`assumed ${ASSUMED_DAYS_BETWEEN_STARTS} days`));
  });
});
