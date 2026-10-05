import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { resolveCycleState, type CyclePeriod } from "@/lib/cycle/cycle-period";
import { buildLabSafetyBrief, type LabRecordInput } from "@/lib/labs/lab-safety";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { buildEscalation } from "@/lib/safety/escalation";
import type { SessionExecutionRecord } from "@/lib/training/session-execution";

import { compareCheckIns } from "../check-in";
import { buildCycleTimeline } from "../lab-trends";
import { weeklyWeightRate } from "../nutrition-phase";
import { buildCycleReview, buildCycleReviewSummary, NOT_ENTERED, type CycleReviewInput, type PlanCompound } from "../report";
import { buildTrainingRecovery } from "../training-recovery";
import { escalatingSymptoms, type CycleCheckIn, type CycleGoalSetup } from "../types";

/* ─── Fixture: a 16-week cycle, week 11, three compounds ─── */

const now = new Date(2026, 8, 14, 9);
const today = "2026-09-14";

const cycle: CyclePeriod = {
  id: "c1",
  name: "Summer cycle",
  startDate: "2026-07-01",
  plannedWeeks: 16,
  compoundIds: ["t", "o", "n"],
  clinicianOversight: false,
  checkpoints: [],
  createdAt: "",
  updatedAt: "",
};

const compounds: PlanCompound[] = [
  { id: "t", name: "Testosterone Cypionate", isActive: true, startDate: "2026-07-01" },
  { id: "o", name: "Oxandrolone", amount: "200", unit: "mg", frequency: "weekly", isActive: true, startDate: "2026-07-01" },
  { id: "n", name: "Nandrolone Decanoate", isActive: true, startDate: "2026-08-10" },
];

const records: LabRecordInput[] = [
  {
    id: "baseline",
    testDate: "2026-06-20",
    markers: [
      { name: "ApoB", value: "92", unit: "mg/dL", referenceRange: "40-130" },
      { name: "HDL Cholesterol", value: "48", unit: "mg/dL", referenceRange: "> OR = 40" },
      { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
    ],
  },
  {
    id: "mid",
    testDate: "2026-08-01",
    markers: [
      { name: "ApoB", value: "108", unit: "mg/dL", referenceRange: "40-130" },
      { name: "HDL Cholesterol", value: "39", unit: "mg/dL", referenceRange: "> OR = 40", labFlag: "L" },
      { name: "Hematocrit", value: "49.5", unit: "%", referenceRange: "38.5-50.0" },
    ],
  },
  {
    id: "latest",
    testDate: "2026-09-01",
    markers: [{ name: "ApoB", value: "124", unit: "mg/dL", referenceRange: "40-130" }],
  },
];

const checkIns: CycleCheckIn[] = [
  { id: "w1", cycleId: "c1", date: "2026-09-05", createdAt: "", systolic: 124, diastolic: 80, restingHr: 58, sleepHours: 7.5, bodyweightLb: 201, ratings: { recovery: 4, mood: 4 }, symptoms: [] },
  { id: "w2", cycleId: "c1", date: "2026-09-12", createdAt: "", systolic: 132, diastolic: 86, restingHr: 64, sleepHours: 6.5, bodyweightLb: 199, ratings: { recovery: 3, mood: 4 }, symptoms: ["acne", "insomnia"] },
];

const goalSetup: CycleGoalSetup = {
  primaryGoal: "fat-loss",
  priorities: ["maintain-fertility", "minimize-cardiovascular-risk"],
  compoundPurposes: { t: { kind: "lean-mass" }, o: { kind: "fat-loss" } },
  updatedAt: "",
};

function makeInput(overrides: Partial<CycleReviewInput> = {}): CycleReviewInput {
  const brief = buildCompoundRiskBrief(compounds.map((c) => ({ name: c.name })));
  const labBrief = buildLabSafetyBrief({ records, markerLinks: brief.markerLinks, now });
  const cycleState = resolveCycleState(cycle, { now, compounds: compounds.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive })), labDates: records.map((r) => r.testDate) });
  return {
    today,
    member: { age: 34, sex: "male", weightLb: 199 },
    cycleState,
    goalSetup,
    compounds,
    labBrief,
    markerLinks: brief.markerLinks,
    escalation: buildEscalation({ labBrief, cycleState }),
    recentRedFlagCount: 0,
    checkIns,
    sleepLogs: [],
    weights: [
      { date: "2026-08-20", weightLb: 204 },
      { date: "2026-08-30", weightLb: 202 },
    ],
    nutritionPhase: "lean-gain",
    todayMacros: { calories: 2900, proteinG: 200, carbsG: 320, fatG: 80, fiberG: 40, hydrationMl: 4500, basis: "est." },
    training: buildTrainingRecovery({ sessions: [], sleepLogs: [], checkIns, restingHrEntries: [], cycleStart: cycle.startDate, today }),
    ...overrides,
  };
}

/** Lab concentrations ("mg/dL") are not amounts; everything else is held to the banned-language suite. */
function violations(texts: string[]): string[] {
  return texts.flatMap((text) => bannedLanguageIn(text.replace(/mg\/dL/gi, "mgdl")).map((p) => `${p} in "${text}"`));
}

describe("cycle review — lab trends against the cycle", () => {
  const review = buildCycleReview(makeInput());
  const trend = (key: string) => review.trends.find((t) => t.key === key)!;

  it("uses the pre-cycle draw as baseline and follows the marker across the cycle", () => {
    expect(trend("apob").baseline?.date).toBe("2026-06-20");
    expect(trend("apob").current?.valueText).toBe("124");
    expect(trend("apob").points.map((p) => p.value)).toEqual([92, 108, 124]);
    expect(trend("apob").status).toBe("trend");
  });

  it("carries the lab's own range and flag, and never claims a cause", () => {
    expect(trend("hdl").status).toBe("outside-range");
    const reasons = review.trends.map((t) => t.reason).join(" ");
    expect(reasons).toMatch(/during the same period/);
    expect(reasons).not.toMatch(/caus/i);
  });

  it("leaves untested markers visibly missing", () => {
    expect(trend("psa").status).toBe("no-data");
    expect(trend("psa").reason).toBe("No result logged yet.");
  });

  it("puts compound additions on the timeline", () => {
    const events = buildCycleTimeline(cycle, compounds);
    expect(events.map((e) => e.kind)).toEqual(["cycle-start", "compound-added", "planned-end"]);
    expect(events[1].label).toBe("Nandrolone Decanoate added");
  });
});

describe("cycle review — complexity and redundancy", () => {
  const { complexity } = buildCycleReview(makeInput());

  it("finds loads several compounds share", () => {
    const hpta = complexity.overlaps.find((o) => o.burden === "hpta-suppression");
    expect(hpta?.compounds.map((c) => c.name)).toEqual(["Testosterone Cypionate", "Oxandrolone", "Nandrolone Decanoate"]);
    const hematocrit = complexity.overlaps.find((o) => o.burden === "hematocrit");
    expect(hematocrit?.movingMarkers.map((t) => t.key)).toContain("hematocrit");
  });

  it("bands complexity with stated reasons, never a percentage", () => {
    expect(complexity.level).toBe("very-high");
    expect(complexity.reasons[0]).toBe("Three compounds in the current plan.");
    expect(complexity.reasons.join(" ")).not.toMatch(/%/);
  });

  it("challenges kitchen-sink design without naming a compound to remove", () => {
    expect(complexity.review.state).toBe("review-soon");
    const reasons = complexity.review.reasons.join(" ");
    expect(reasons).toMatch(/No purpose is recorded for Nandrolone Decanoate\./);
    expect(reasons).toMatch(/Testosterone Cypionate is recorded for lean mass, but your current goal is fat loss\./);
    expect(reasons).not.toMatch(/remove|stop|drop|discontinue/i);
  });

  it("flags priorities the plan works against", () => {
    const fertility = complexity.priorityConflicts.find((p) => p.priority === "maintain-fertility");
    expect(fertility?.compoundNames).toEqual(["Testosterone Cypionate", "Oxandrolone", "Nandrolone Decanoate"]);
  });
});

describe("cycle review — report", () => {
  const input = makeInput();
  const review = buildCycleReview(input);

  it("routes systems to the clinician only when the lab's own range says so", () => {
    expect(review.systems.find((s) => s.system === "cardiovascular")?.status).toBe("clinician-review");
    expect(review.systems.find((s) => s.system === "blood")?.status).toBe("trend");
    expect(review.systems.find((s) => s.system === "kidney")?.status).toBe("no-load");
  });

  it("ranks attention by severity", () => {
    const order = { high: 0, moderate: 1, low: 2 } as const;
    const ranks = review.attention.map((a) => order[a.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(review.attention[0].severity).toBe("high");
  });

  it("asks the clinician real questions from the member's own numbers", () => {
    expect(review.questions.join("\n")).toMatch(/My ApoB went from 92 mg\/dL to 124 mg\/dL between Jun 20, 2026 and Sep 1, 2026, during this cycle\./);
    expect(review.questions.length).toBeLessThanOrEqual(8);
  });

  it("keeps missing inputs visibly missing and never invents an amount", () => {
    expect(review.gaps).toContain(`Amount for Testosterone Cypionate: ${NOT_ENTERED}.`);
    expect(review.gaps.some((g) => g.startsWith("Amount for Oxandrolone"))).toBe(false);
    const summary = buildCycleReviewSummary(review, input, now);
    expect(summary).toMatch(/Oxandrolone — amount: 200 mg/);
    expect(summary).toMatch(/Testosterone Cypionate — amount: Unknown \/ not entered/);
    expect(summary).toMatch(/Height: Unknown \/ not entered/);
  });

  it("notices a fuel strategy pointing away from the goal", () => {
    expect(review.nutrition?.phaseMatch).toBe("mismatch");
    expect(review.attention.some((a) => a.id === "nutrition-mismatch")).toBe(true);
  });

  it("never gives compound instructions anywhere in generated copy", () => {
    const copy = [
      ...review.aligned,
      ...review.attention.flatMap((a) => [a.title, a.detail]),
      ...review.gaps,
      ...review.questions,
      ...review.complexity.reasons,
      ...review.complexity.review.reasons,
      ...review.complexity.overlaps.map((o) => o.text),
      ...review.complexity.priorityConflicts.map((p) => p.text),
      ...review.systems.map((s) => s.detail),
      ...review.trends.map((t) => t.reason),
      ...(review.nutrition ? [review.nutrition.phaseNote, review.nutrition.velocity.text, ...review.nutrition.focus] : []),
      ...(review.checkIn?.changes.map((c) => c.text) ?? []),
    ];
    expect(violations(copy)).toEqual([]);
    expect(copy.join(" ")).not.toMatch(/\b(increase|add|start|stop|discontinue|switch)\b[^.]*\b(compound|dose|drug|injection)/i);
  });

  it("steps aside for care when a check-in includes a warning sign", () => {
    const urgent = buildCycleReview(
      makeInput({ checkIns: [...checkIns, { ...checkIns[1], id: "w3", date: "2026-09-14", symptoms: ["chest-discomfort"] }] }),
    );
    expect(urgent.needsCare).toBe(true);
    expect(urgent.attention[0].severity).toBe("high");
    expect(escalatingSymptoms(["chest-discomfort", "acne"])).toEqual(["chest-pain"]);
  });
});

describe("weekly check-in", () => {
  const comparison = compareCheckIns(checkIns)!;

  it("reads vitals as direction, never as better", () => {
    expect(comparison.changes.find((c) => c.id === "blood-pressure")).toMatchObject({ bucket: "worth-watching", text: "Average blood pressure higher: 124/80 → 132/86." });
    const lower = compareCheckIns([checkIns[1], { ...checkIns[0], id: "w0", date: "2026-09-19", systolic: 120, diastolic: 78 }])!;
    expect(lower.changes.find((c) => c.id === "blood-pressure")?.bucket).toBe("stable");
  });

  it("buckets member ratings and new symptoms", () => {
    expect(comparison.changes.find((c) => c.id === "recovery")?.bucket).toBe("worth-watching");
    expect(comparison.changes.find((c) => c.id === "new-symptoms")?.text).toBe("New since last week: acne, trouble sleeping.");
  });
});

describe("phase nutrition", () => {
  it("measures weekly bodyweight change only with enough weigh-ins", () => {
    expect(weeklyWeightRate([{ date: "2026-09-10", weightLb: 200 }], today)).toBeNull();
    const rate = weeklyWeightRate(
      [
        { date: "2026-08-20", weightLb: 204 },
        { date: "2026-08-30", weightLb: 202 },
        { date: "2026-09-12", weightLb: 199 },
      ],
      today,
    );
    expect(rate!.lbPerWeek).toBeLessThan(0);
  });
});

describe("training and recovery", () => {
  const session = (date: string, sets: number, load: number): SessionExecutionRecord =>
    ({
      calendarDate: date,
      status: "completed",
      sessionMetrics: {},
      addedMovements: [],
      movements: [
        { exerciseId: "bench", performedName: "Bench press", completedSets: Array.from({ length: sets }, () => ({ completed: true, completedReps: 5, completedLoad: load, loadUnit: "lb" })) },
        { exerciseId: "squat", performedName: "Squat", completedSets: [{ completed: true, completedReps: 5, completedLoad: load + 50, loadUnit: "lb" }] },
      ],
    }) as unknown as SessionExecutionRecord;

  it("surfaces volume climbing while recovery falls", () => {
    const result = buildTrainingRecovery({
      sessions: [session("2026-06-10", 4, 200), session("2026-06-20", 4, 200), session("2026-09-01", 8, 215), session("2026-09-10", 8, 215)],
      sleepLogs: [
        { date: "2026-06-15", hours: 7.8 },
        { date: "2026-09-05", hours: 6.6 },
      ],
      checkIns: [],
      restingHrEntries: [],
      cycleStart: "2026-07-01",
      today,
    });
    expect(result.signals.find((s) => s.id === "volume-recovery")?.text).toMatch(/Completed sets rose \d+% while sleep fell 1\.2 h/);
    expect(result.rows.find((r) => r.id === "strength")?.direction).toBe("up");
  });

  it("waits until the cycle has run two weeks", () => {
    expect(buildTrainingRecovery({ sessions: [], sleepLogs: [], checkIns: [], restingHrEntries: [], cycleStart: "2026-09-10", today }).available).toBe(false);
  });
});
