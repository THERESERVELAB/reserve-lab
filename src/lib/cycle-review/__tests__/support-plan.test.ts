import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief, profilesForCompound } from "@/lib/compound-intelligence/risk-profiles";
import { NUTRIENT_LABEL, SUPPORT_AREA_NOTES, SUPPORT_OPTIONS, supportOptionByKey } from "@/lib/compound-intelligence/support-options";
import { findCatalogEntry } from "@/lib/enhancement/catalog";
import { buildLabSafetyBrief, type LabRecordInput } from "@/lib/labs/lab-safety";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";

import { buildSystemRows } from "../body-systems";
import { compareCheckIns } from "../check-in";
import { buildMarkerTrends } from "../lab-trends";
import {
  BASED_ON_ENTERED,
  COVERAGE_STATE_LABEL,
  SAFETY_LEVEL_LABEL,
  buildSupportLibrary,
  buildSupportPlanReview,
  checkSafety,
  findDuplicates,
  intakeSources,
  labLinksFor,
  reasonsFor,
  type LoggedEntry,
  type SupportContext,
} from "../support-plan";
import { CYCLE_PRIMARY_GOALS } from "../types";
import type { SupportPlanItem } from "../types";

const now = new Date(2026, 8, 14, 9);
const today = "2026-09-14";

const cycleCompounds = [
  { id: "t", name: "Testosterone Cypionate" },
  { id: "o", name: "Oxandrolone" },
  { id: "i", name: "Humalog", compoundClass: "insulin" },
];

const logged: LoggedEntry[] = [
  { name: "Testosterone Cypionate", category: "hormone", route: "injectable", isActive: true },
  { name: "Oxandrolone", category: "hormone", route: "oral", isActive: true },
  { name: "Humalog", compoundClass: "insulin", category: "medication", route: "injectable", isActive: true },
  { name: "Electrolytes", category: "supplement", route: "oral", isActive: true },
];

const records: LabRecordInput[] = [
  { id: "a", testDate: "2026-06-20", markers: [
    { name: "ApoB", value: "92", unit: "mg/dL", referenceRange: "40-130" },
    { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
  ] },
  { id: "b", testDate: "2026-08-01", markers: [
    { name: "ApoB", value: "108", unit: "mg/dL", referenceRange: "40-130" },
    { name: "HDL Cholesterol", value: "39", unit: "mg/dL", referenceRange: "> OR = 40", labFlag: "L" },
    { name: "Hematocrit", value: "49.5", unit: "%", referenceRange: "38.5-50.0" },
  ] },
  { id: "c", testDate: "2026-09-01", markers: [{ name: "ApoB", value: "124", unit: "mg/dL", referenceRange: "40-130" }] },
];

function makeContext(overrides: Partial<SupportContext> = {}): SupportContext {
  const brief = buildCompoundRiskBrief(cycleCompounds);
  const labBrief = buildLabSafetyBrief({ records, markerLinks: brief.markerLinks, now });
  const trends = buildMarkerTrends({ labBrief, cycle: { startDate: "2026-07-01" }, markerLinks: brief.markerLinks });
  const checkIns = [
    { id: "w1", cycleId: "c1", date: "2026-09-05", createdAt: "", systolic: 124, diastolic: 80, ratings: {}, symptoms: [] },
    { id: "w2", cycleId: "c1", date: "2026-09-12", createdAt: "", systolic: 134, diastolic: 86, ratings: {}, symptoms: ["insomnia" as const] },
  ];
  const comparison = compareCheckIns(checkIns);
  return {
    today,
    brief,
    logged,
    medicationsText: "",
    healthContext: [],
    allergies: [],
    goalSetup: { primaryGoal: "fat-loss", priorities: ["minimize-cardiovascular-risk"], compoundPurposes: {}, updatedAt: "" },
    trends,
    checkIns,
    comparison,
    systems: buildSystemRows({ compounds: cycleCompounds, trends, checkIns, comparison, sleepLogDates: [], today }),
    untestedLabels: labBrief.untested.map((u) => u.label),
    needsCare: false,
    stillActivePastEnd: false,
    plan: [],
    ...overrides,
  };
}

const item = (optionKey: string, extra: Partial<SupportPlanItem> = {}): SupportPlanItem => ({ id: `p-${optionKey}`, optionKey, addedAt: "2026-08-10T12:00:00.000Z", ...extra });

describe("support library — supplements only", () => {
  it("never contains a prescription medicine", () => {
    for (const option of SUPPORT_OPTIONS) {
      const catalog = findCatalogEntry(option.catalogName);
      expect(["supplement", "vitamin", "recovery", "nootropic"], option.key).toContain(catalog?.category);
      expect(profilesForCompound({ name: option.catalogName }).every((p) => p.regulatory === "supplement"), option.key).toBe(true);
    }
    const names = buildSupportLibrary(makeContext()).flatMap((g) => g.options.map((o) => o.option.catalogName));
    for (const drug of ["Metformin", "Anastrozole", "Tamoxifen", "Clomiphene", "Tadalafil", "Telmisartan", "Cabergoline", "HCG"]) {
      expect(names).not.toContain(drug);
    }
  });

  it("organizes by purpose and carries the honest note for every area", () => {
    const library = buildSupportLibrary(makeContext());
    expect(library.map((g) => g.key)).toEqual(["performance", "cardiovascular", "liver", "kidney", "glucose", "hormonal", "prostate", "skin", "blood", "mood", "thyroid", "general", "recovery", "sleep", "hydration", "bone", "gi"]);
    const recovery = library.find((g) => g.key === "recovery")!;
    /* The note stands whether or not the area has options: nothing here has
       been studied in people using anabolic steroids. */
    expect(recovery.options.map((o) => o.option.title)).toEqual(["Beta-alanine", "Boswellia", "Caffeine", "Collagen peptides", "Creatine", "HMB", "Sodium bicarbonate", "Tart cherry"]);
    expect(recovery.notes[0]).toBe(SUPPORT_AREA_NOTES.recovery);
    const cardio = library.find((g) => g.key === "cardiovascular")!.options.map((o) => o.option.title);
    expect(cardio).toEqual([...cardio].sort((a, b) => a.localeCompare(b)));
  });
});

describe("training & performance lens", () => {
  const perf = () => buildSupportLibrary(makeContext()).find((g) => g.key === "performance")!;

  it("leads the library as its own group", () => {
    const library = buildSupportLibrary(makeContext());
    expect(library[0].key).toBe("performance");
    expect(library[0].label).toBe("Training & performance");
  });

  it("gathers the training add-ons, alphabetically and never ranked", () => {
    const titles = perf().options.map((o) => o.option.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    expect(titles).toEqual(expect.arrayContaining(["Creatine", "Essential amino acids (EAAs)", "Electrolytes", "Beta-alanine", "Caffeine", "L-citrulline"]));
  });

  it("is a lens over the one library — not lab-only or vitamin options", () => {
    const keys = perf().options.map((o) => o.option.key);
    for (const notPerformance of ["milk-thistle", "saw-palmetto", "vitamin-d3", "multivitamin", "red-yeast-rice"]) {
      expect(keys).not.toContain(notPerformance);
    }
  });

  it("carries every option's full findings, sources and pending-review — the cautions travel with the benefit", () => {
    for (const entry of perf().options) {
      expect(entry.findings.length, entry.option.key).toBe(entry.option.findings.length);
      expect(entry.option.doesNotAddress.length, entry.option.key).toBeGreaterThan(0);
      expect(entry.option.sources.length, entry.option.key).toBeGreaterThan(0);
      expect(entry.option.review.status, entry.option.key).toBe("pending-clinician-review");
    }
  });
});

describe("why you're seeing this", () => {
  it("names the exact member data behind each option", () => {
    const reasons = reasonsFor(supportOptionByKey("psyllium")!, makeContext());
    expect(reasons).toContain("Your current plan includes compounds commonly associated with unfavorable cholesterol changes: Oxandrolone.");
    expect(reasons).toContain("Your ApoB changed from 92 mg/dL to 124 mg/dL.");
    expect(reasons).toContain('You set "Minimize cardiovascular risk" as a priority.');
    expect(reasonsFor(supportOptionByKey("melatonin")!, makeContext())).toContain("Your latest check-in includes trouble sleeping.");
  });

  it("keeps reasons inside the purpose they are listed under", () => {
    const ctx = makeContext({ checkIns: [], comparison: null });
    const library = buildSupportLibrary(ctx);
    const inGroup = (group: string) => library.find((g) => g.key === group)!.options.find((o) => o.option.key === "magnesium")!;
    expect(inGroup("cardiovascular").personalized).toBe(true);
    expect(inGroup("sleep").reasons).toEqual([]);
    expect(inGroup("sleep").personalized).toBe(false);
    expect(inGroup("sleep").allReasons.length).toBeGreaterThan(0);
  });

  it("gives no reason at all when there is no data", () => {
    const empty = makeContext({ brief: buildCompoundRiskBrief([]), trends: [], checkIns: [], comparison: null, goalSetup: null, logged: [] });
    for (const option of SUPPORT_OPTIONS) expect(reasonsFor(option, empty), option.key).toEqual([]);
    expect(buildSupportLibrary(empty).flatMap((g) => g.options).every((o) => !o.personalized)).toBe(true);
  });

  it("never uses blood pressure as a reason to show a supplement", () => {
    const all = SUPPORT_OPTIONS.flatMap((o) => reasonsFor(o, makeContext())).join(" ");
    expect(all).not.toMatch(/blood pressure/i);
  });
});

describe("safety check before adding", () => {
  it("warns about interactions with what the member entered", () => {
    const ctx = makeContext();
    expect(checkSafety(supportOptionByKey("berberine")!, ctx, []).level).toBe("ask");
    const psyllium = checkSafety(supportOptionByKey("psyllium")!, ctx, []);
    expect(psyllium.level).toBe("review");
    expect(psyllium.reasons.map((r) => r.text).join(" ")).toMatch(/oral medicines and compounds such as Oxandrolone/);
    const noRoute = makeContext({ logged: logged.map((e) => (e.name === "Oxandrolone" ? { ...e, route: undefined } : e)) });
    expect(checkSafety(supportOptionByKey("psyllium")!, noRoute, []).reasons.map((r) => r.text).join(" ")).toMatch(/such as Oxandrolone/);
    const injectedTest = makeContext({ logged: [{ name: "Testosterone Cypionate", category: "hormone", isActive: true }] });
    expect(checkSafety(supportOptionByKey("psyllium")!, injectedTest, []).reasons.some((r) => /oral medicines/.test(r.text))).toBe(false);
    expect(checkSafety(supportOptionByKey("fish-oil")!, makeContext({ medicationsText: "Warfarin 5" }), []).level).toBe("ask");
    expect(checkSafety(supportOptionByKey("electrolytes")!, makeContext({ healthContext: ["chf"] }), []).level).toBe("ask");
    expect(checkSafety(supportOptionByKey("fish-oil")!, makeContext({ allergies: ["Shellfish"] }), []).reasons[0].kind).toBe("allergy");
  });

  it("qualifies every result with what was entered, and names what is missing", () => {
    const check = checkSafety(supportOptionByKey("tudca")!, makeContext(), []);
    expect(check.level).toBe("no-known-issue");
    expect(SAFETY_LEVEL_LABEL[check.level]).toBe("No known issue detected from information entered");
    expect(check.caveats).toEqual([BASED_ON_ENTERED, "No allergies are entered in Reserve."]);
    const bare = checkSafety(supportOptionByKey("tudca")!, makeContext({ logged: [] }), []);
    expect(bare.caveats).toContain("No medications are entered in Reserve.");
  });
});

describe("duplicate ingredients", () => {
  it("shows where each overlapping nutrient comes from", () => {
    const sources = intakeSources({ plan: [item("multivitamin"), item("vitamin-d3"), item("magnesium")], logged });
    const duplicates = findDuplicates(sources);
    const vitaminD = duplicates.find((d) => d.nutrient === "vitamin-d")!;
    expect(vitaminD.sources.map((s) => s.name)).toEqual(["Multivitamin", "Vitamin D3"]);
    expect(vitaminD.text).toMatch(/Multivitamin \(usually contains it — check the label\), Vitamin D3/);
    const magnesium = duplicates.find((d) => d.nutrient === "magnesium")!;
    expect(magnesium.sources.map((s) => s.name)).toEqual(["Multivitamin", "Magnesium", "Electrolytes"]);
    expect(magnesium.text).toMatch(/Electrolytes \(in your log; usually contains it — check the label\)/);
    expect(NUTRIENT_LABEL[magnesium.nutrient]).toBe("Magnesium");
  });

  it("flags a duplicate before the option is added", () => {
    const ctx = makeContext({ plan: [item("multivitamin")] });
    const vitaminD = buildSupportLibrary(ctx).flatMap((g) => g.options).find((o) => o.option.key === "vitamin-d3")!;
    expect(vitaminD.check.reasons.some((r) => r.kind === "duplicate")).toBe(true);
  });
});

describe("the member's plan", () => {
  const ctx = makeContext({ plan: [item("psyllium", { startDate: "2026-08-10" }), item("fish-oil"), item("milk-thistle"), item("multivitamin"), item("vitamin-d3")] });
  const review = buildSupportPlanReview(ctx);

  it("counts evidence strength and alerts without scoring the plan", () => {
    // Vitamin D (multivitamin + D3) and magnesium (multivitamin + logged electrolytes).
    expect(review.counts).toMatchObject({ selected: 5, stronger: 3, limited: 1, notShown: 1, duplicateAlerts: 2 });
    expect(review.sizeNote).toBeNull();
    const big = buildSupportPlanReview(makeContext({ plan: ["psyllium", "fish-oil", "milk-thistle", "multivitamin", "vitamin-d3", "coq10"].map((k) => item(k)) }));
    expect(big.sizeNote).toMatch(/none of them adds monitoring/);
  });

  it("links options to the member's own markers, and describes timing only", () => {
    const psyllium = review.entries.find((e) => e.option.key === "psyllium")!;
    expect(labLinksFor(psyllium.option, ctx.trends).find((l) => l.key === "apob")).toMatchObject({ value: "124 mg/dL", direction: "up" });
    expect(psyllium.timing[0]).toBe("ApoB increased after Psyllium husk was added (108 mg/dL → 124 mg/dL). Timing only — many things change at once.");
    expect(review.entries.flatMap((e) => e.timing).join(" ")).not.toMatch(/caus|lowered your|raised your/i);
  });

  it("marks systems with no proven supplement support", () => {
    const state = (key: string) => review.coverage.find((c) => c.key === key)!.states;
    for (const key of ["blood", "hormonal", "fertility", "kidney", "liver"]) expect(state(key), key).toContain("no-proven-support");
    expect(state("cardiovascular")).toContain("support-selected");
    expect(state("cardiovascular")).not.toContain("no-proven-support");
    expect(review.coverage.find((c) => c.key === "hormonal")!.detail).toContain(SUPPORT_AREA_NOTES.hormonal!);
  });

  it("knows when the answer is not another supplement", () => {
    const gaps = review.notAddressed.join("\n");
    expect(gaps).toMatch(/Blood pressure changes/);
    expect(gaps).toMatch(/Hematocrit changes\. No supplement lowers them/);
    expect(gaps).toMatch(/Hormone and fertility effects of your plan/);
    for (const option of SUPPORT_OPTIONS) expect(gaps).not.toContain(option.title);
    expect(review.covers).toContain("Soluble fiber intake");
  });

  it("never invents details the member did not enter", () => {
    for (const entry of review.entries) {
      expect(entry.item.amount).toBeUndefined();
      expect(entry.item.frequency).toBeUndefined();
    }
  });

  it("keeps every word of the builder free of safety claims and instructions", () => {
    const copy = [
      ...SUPPORT_OPTIONS.flatMap((o) => [o.title, o.doesNotAddress, o.coverageLabel, ...o.findings.map((f) => f.finding)]),
      ...Object.values(SUPPORT_AREA_NOTES),
      ...Object.values(SAFETY_LEVEL_LABEL),
      ...Object.values(COVERAGE_STATE_LABEL),
      BASED_ON_ENTERED,
      ...review.notAddressed,
      ...review.coverage.map((c) => c.detail),
      ...review.duplicates.map((d) => d.text),
      ...review.entries.flatMap((e) => [...e.check.reasons.map((r) => r.text), ...e.check.caveats, ...e.timing]),
      ...review.library.flatMap((g) => g.options.flatMap((o) => [...o.reasons, ...o.check.reasons.map((r) => r.text)])),
    ];
    const violations = copy.flatMap((text) => bannedLanguageIn(text.replace(/mg\/dL/gi, "mgdl")).map((p) => `${p} in "${text}"`));
    expect(violations).toEqual([]);
    const joined = copy.join("\n");
    /* "essential" is banned as hype ("essential for your cycle"), not as the
       chemical class name - "essential amino acid" and "essential fatty acid"
       are what those nutrients are called, and mangling them to dodge a regex
       would make the library less accurate, not safer. */
    expect(joined).not.toMatch(/\b(safe cycle|is safe|are safe|fully protected|protection complete|best|must have|essential(?! (amino|fatty) acid)|game changer|cycle protector|mandatory)\b/i);
    expect(joined).not.toMatch(/\byou should (take|use|add)\b/i);
  });
});

describe("persistence", () => {
  it("syncs the support plan with the member's state", () => {
    expect(MEMBER_STATE_KEYS).toContain("supportPlan");
  });
});

describe("goals feed support areas", () => {
  it("gives every goal but clinician-led and other a reason in the areas it touches", () => {
    const covered = CYCLE_PRIMARY_GOALS.filter((g) => {
      const ctx = makeContext({ goalSetup: { primaryGoal: g, priorities: [], compoundPurposes: {}, updatedAt: "" } });
      return SUPPORT_OPTIONS.some((o) => reasonsFor(o, ctx).some((r) => r.startsWith("Your goal is")));
    });
    expect(covered.sort()).toEqual(
      CYCLE_PRIMARY_GOALS.filter((g) => g !== "clinician-managed-therapy" && g !== "other").sort(),
    );
  });

  it("keeps a goal's reason to its own area — lean mass never explains a liver option", () => {
    const ctx = makeContext({ goalSetup: { primaryGoal: "lean-mass", priorities: [], compoundPurposes: {}, updatedAt: "" } });
    const tudca = SUPPORT_OPTIONS.find((o) => o.key === "tudca")!;
    expect(reasonsFor(tudca, ctx).filter((r) => r.startsWith("Your goal is"))).toEqual([]);
    const whey = SUPPORT_OPTIONS.find((o) => o.key === "whey-protein")!;
    expect(reasonsFor(whey, ctx).some((r) => r.startsWith("Your goal is lean mass"))).toBe(true);
  });

  it("never claims an option delivers the goal", () => {
    const text = CYCLE_PRIMARY_GOALS.flatMap((g) => {
      const ctx = makeContext({ goalSetup: { primaryGoal: g, priorities: [], compoundPurposes: {}, updatedAt: "" } });
      /* Goal reasons only. Lab-value reasons from the fixture carry real
         units ("108 mg/dL") and are checked by their own test. */
      return SUPPORT_OPTIONS.flatMap((o) => reasonsFor(o, ctx)).filter((r) => r.startsWith("Your goal is"));
    }).join("\n");
    expect(bannedLanguageIn(text)).toEqual([]);
    expect(text).not.toMatch(/\b(helps? you|will (help|get|build)|so take|to reach|boosts?|maximi[sz]e)\b/i);
  });
});
