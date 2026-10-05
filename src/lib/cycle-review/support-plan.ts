/* ════════════════════════════════════════════════════════════════════════
   SUPPORT PLAN — the supplements the member chooses to track beside their
   plan, and everything that keeps that choice honest.

   Built on the one support options library. For each option it answers:
     · why you're seeing this — the exact member data that surfaced it
     · what the evidence shows, and what it does NOT address
     · the member's own markers that relate to it
     · a check against what the member entered: compounds, medications,
       conditions, allergies, labs, check-ins and duplicate ingredients

   For the plan as a whole it shows evidence strength, alerts, coverage by
   body system — including where no supplement has proven support — and the
   gaps no supplement can close.

   It never adds anything, never ranks, never proposes an amount or timing,
   and never calls a plan safe. More supplements never reads as better.
   ════════════════════════════════════════════════════════════════════════ */

import { daysBetween, isDateKey } from "@/lib/cycle/cycle-period";
import { buildEvidenceMap, type EvidenceMap } from "./evidence-map";
import type { EvidenceGrade } from "@/lib/compound-intelligence/evidence";
import { profilesForCompound, type CompoundIdentity } from "@/lib/compound-intelligence/risk-profiles";
import {
  CATALOG_INGREDIENTS,
  DUPLICATE_WATCH,
  NUTRIENT_LABEL,
  PERFORMANCE_OPTIONS,
  PURPOSE_GROUPS,
  SUPPORT_AREA_NOTES,
  SUPPORT_OPTIONS,
  bestGrade,
  overlapsForOption,
  OPTION_MARKERS,
  supportAreasForBrief,
  supportOptionByKey,
  type NutrientKey,
  type PurposeGroupKey,
  type SupportArea,
  type SupportFinding,
  type SupportOption,
} from "@/lib/compound-intelligence/support-options";
import type { CompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { findCatalogEntry } from "@/lib/enhancement/catalog";
import type { MarkerKey } from "@/lib/labs/markers";

import { SYSTEM_STATUS_LABEL, type SystemRow } from "./body-systems";
import type { CheckInComparison } from "./check-in";
import { formatLabValue, MARKER_TREND_STATUS_LABEL, type MarkerTrend } from "./lab-trends";
import { inSentence, listNames } from "./text";
import {
  CYCLE_PRIORITY_LABEL,
  type CycleCheckIn,
  type CycleGoalSetup,
  type CyclePrimaryGoal,
  type CyclePriority,
  type SupportPlanItem,
} from "./types";

/* ─── Context ─────────────────────────────────────────────────────────── */

export type LoggedEntry = CompoundIdentity & { category: string; route?: string; isActive: boolean };

export type SupportContext = {
  today: string;
  /** Risk brief for the compounds in the current cycle. */
  brief: CompoundRiskBrief;
  /** Every entry in the member's log — compounds, medications and supplements. */
  logged: LoggedEntry[];
  /** Free text from the member's profile, exactly as entered. */
  medicationsText: string;
  /** Onboarding health context values, e.g. "diabetes", "high-blood-pressure". */
  healthContext: string[];
  allergies: string[];
  goalSetup: CycleGoalSetup | null;
  trends: MarkerTrend[];
  checkIns: CycleCheckIn[];
  comparison: CheckInComparison | null;
  systems: SystemRow[];
  untestedLabels: string[];
  needsCare: boolean;
  stillActivePastEnd: boolean;
  plan: SupportPlanItem[];
};

/* ─── Why you're seeing this ──────────────────────────────────────────── */

const AREA_PHRASE: Partial<Record<SupportArea, string>> = {
  cardiovascular: "cardiovascular effects",
  lipids: "unfavorable cholesterol changes",
  liver: "liver strain",
  metabolic: "blood sugar changes",
  bone: "bone and joint effects",
  digestive: "digestive effects",
  /* Without a phrase an area produces no reason, so its options never surface
     as linked to the member and the whole purpose group stays hidden. */
  blood: "changes in red blood cell counts",
  kidney: "kidney effects",
  hormonal: "hormonal changes",
  fertility: "effects on fertility",
  prostate: "effects on the prostate",
  skin: "skin and hair effects",
  mood: "mood changes",
  thyroid: "thyroid effects",
};

/* ─── Goals → the areas they make relevant ────────────────────────────
   A goal says what the member is training for, so it says which areas of
   the library are worth them reading. It never says an option delivers the
   goal: the reason states the member's own goal and a plain fact about the
   area, the options stay alphabetical with their grades — "not shown"
   included — and the area note still says what nothing here has been shown
   to do. Nothing is ever added for them.

   Clinician-managed therapy and "other" map to nothing: the first is led by
   a clinician, and the second says nothing to reason from. */
const GOAL_AREAS: Record<CyclePrimaryGoal, Partial<Record<SupportArea, string>>> = {
  "fat-loss": {
    general: "Your goal is fat loss, and a restricted diet can leave nutrition gaps.",
    recovery: "Your goal is fat loss, trained while calories are restricted.",
  },
  "lean-mass": {
    general: "Your goal is lean mass, which rests on reaching your daily protein from food.",
    recovery: "Your goal is lean mass.",
  },
  recomposition: {
    general: "Your goal is recomposition, which holds a protein target while calories are controlled.",
    recovery: "Your goal is recomposition.",
  },
  strength: {
    recovery: "Your goal is strength.",
    hydration: "Your goal is strength.",
  },
  performance: {
    recovery: "Your goal is performance.",
    hydration: "Your goal is performance.",
  },
  recovery: {
    recovery: "Your goal is recovery.",
    sleep: "Your goal is recovery, and your own sleep record is part of that picture.",
  },
  "clinician-managed-therapy": {},
  other: {},
};

const PRIORITY_AREAS: Partial<Record<CyclePriority, SupportArea[]>> = {
  "minimize-cardiovascular-risk": ["cardiovascular", "lipids"],
  "maintain-insulin-sensitivity": ["metabolic"],
  "maintain-mental-wellbeing": ["sleep"],
  "maintain-endurance": ["hydration"],
};

const MOVING: ReadonlySet<MarkerTrend["status"]> = new Set(["trend", "changed"]);
const OUTSIDE: ReadonlySet<MarkerTrend["status"]> = new Set(["outside-range", "clinician-review"]);

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function recentSymptoms(ctx: SupportContext): Set<string> {
  return new Set(ctx.checkIns.filter((c) => isDateKey(c.date) && daysBetween(c.date, ctx.today) <= 14).flatMap((c) => c.symptoms));
}

/**
 * Every reason points at real member data. No data, no reason. Pass `areas`
 * to keep only reasons for those purposes — magnesium listed under Sleep must
 * not borrow its cardiovascular reason.
 */
export function reasonsFor(option: SupportOption, ctx: SupportContext, areas?: SupportArea[]): string[] {
  const reasons: string[] = [];
  const compoundAreas = new Map(supportAreasForBrief(ctx.brief).map((entry) => [entry.area, entry.compoundNames]));
  const trendByKey = new Map(ctx.trends.map((t) => [t.key, t]));
  const symptoms = recentSymptoms(ctx);
  const goal = ctx.goalSetup?.primaryGoal;

  for (const finding of option.findings.filter((f) => !areas || areas.includes(f.area))) {
    const names = compoundAreas.get(finding.area);
    const phrase = AREA_PHRASE[finding.area];
    if (names && phrase) {
      reasons.push(`Your current plan includes compounds commonly associated with ${phrase}: ${listNames(names)}.`);
    }
    for (const key of finding.markers) {
      const trend = trendByKey.get(key);
      if (!trend?.current) continue;
      const value = formatLabValue(trend.current.valueText, trend.unit);
      if (OUTSIDE.has(trend.status)) {
        reasons.push(`Your latest ${trend.label} (${value}, ${formatDay(trend.current.date)}) is outside the range on your report.`);
      } else if (MOVING.has(trend.status)) {
        const from = trend.baseline ?? trend.points[0];
        if (from && from !== trend.current) reasons.push(`Your ${trend.label} changed from ${formatLabValue(from.valueText, trend.unit)} to ${value}.`);
      }
    }
    for (const priority of ctx.goalSetup?.priorities ?? []) {
      if (PRIORITY_AREAS[priority]?.includes(finding.area)) {
        reasons.push(`You set "${CYCLE_PRIORITY_LABEL[priority]}" as a priority.`);
      }
    }
    if (finding.area === "sleep") {
      if (symptoms.has("insomnia")) reasons.push("Your latest check-in includes trouble sleeping.");
      if (ctx.healthContext.includes("sleep-issues")) reasons.push("You noted sleep issues in your profile.");
    }
    const goalReason = goal ? GOAL_AREAS[goal][finding.area] : undefined;
    if (goalReason) reasons.push(goalReason);
  }
  return [...new Set(reasons)];
}

/* ─── Relevant markers ────────────────────────────────────────────────── */

export type LabLink = {
  key: MarkerKey;
  label: string;
  value: string;
  date: string;
  direction: "up" | "down" | "steady" | null;
  statusLabel: string;
  moving: boolean;
};

export function labLinksFor(option: SupportOption, trends: MarkerTrend[]): LabLink[] {
  const keys = [...new Set(option.findings.flatMap((f) => f.markers))];
  const trendByKey = new Map(trends.map((t) => [t.key, t]));
  return keys.flatMap((key): LabLink[] => {
    const trend = trendByKey.get(key);
    if (!trend?.current) return [];
    const from = trend.baseline ?? trend.points.at(-2);
    let direction: LabLink["direction"] = null;
    if (from && from !== trend.current && from.value != null && trend.current.value != null && from.value !== 0) {
      const pct = ((trend.current.value - from.value) / Math.abs(from.value)) * 100;
      direction = pct >= 3 ? "up" : pct <= -3 ? "down" : "steady";
    }
    return [{
      key,
      label: trend.label,
      value: formatLabValue(trend.current.valueText, trend.unit),
      date: trend.current.date,
      direction,
      statusLabel: MARKER_TREND_STATUS_LABEL[trend.status],
      moving: MOVING.has(trend.status) || OUTSIDE.has(trend.status),
    }];
  });
}

/* ─── Duplicate ingredients ───────────────────────────────────────────── */

export type IntakeSource = { catalogName: string; name: string; inPlan: boolean };

export type DuplicateNutrient = {
  nutrient: NutrientKey;
  label: string;
  sources: Array<{ name: string; certainty: "contains" | "commonly"; inPlan: boolean }>;
  text: string;
};

/** Plan items plus active supplements logged elsewhere, one entry per product. */
export function intakeSources(ctx: Pick<SupportContext, "plan" | "logged">): IntakeSource[] {
  const byName = new Map<string, IntakeSource>();
  for (const item of ctx.plan) {
    const option = supportOptionByKey(item.optionKey);
    if (option) byName.set(option.catalogName, { catalogName: option.catalogName, name: option.title, inPlan: true });
  }
  for (const entry of ctx.logged) {
    if (!entry.isActive) continue;
    const catalog = findCatalogEntry(entry.officialName ?? "") ?? findCatalogEntry(entry.name);
    if (!catalog || !CATALOG_INGREDIENTS[catalog.officialName] || byName.has(catalog.officialName)) continue;
    byName.set(catalog.officialName, { catalogName: catalog.officialName, name: entry.name, inPlan: false });
  }
  return [...byName.values()];
}

export function findDuplicates(sources: IntakeSource[]): DuplicateNutrient[] {
  const out: DuplicateNutrient[] = [];
  for (const nutrient of DUPLICATE_WATCH) {
    const hits = sources.flatMap((source) => {
      const ingredient = CATALOG_INGREDIENTS[source.catalogName]?.find((i) => i.nutrient === nutrient);
      return ingredient ? [{ name: source.name, certainty: ingredient.certainty, inPlan: source.inPlan }] : [];
    });
    if (hits.length < 2) continue;
    const label = NUTRIENT_LABEL[nutrient];
    out.push({
      nutrient,
      label,
      sources: hits,
      text: `Possible duplicate intake of ${inSentence(label)}: ${hits
        .map((h) => {
          const notes = [h.inPlan ? null : "in your log", h.certainty === "commonly" ? "usually contains it — check the label" : null].filter(Boolean);
          return `${h.name}${notes.length ? ` (${notes.join("; ")})` : ""}`;
        })
        .join(", ")}.`,
    });
  }
  return out;
}

/* ─── Safety check ────────────────────────────────────────────────────── */

export type SafetyLevel = "no-known-issue" | "review" | "ask";

export const SAFETY_LEVEL_LABEL: Record<SafetyLevel, string> = {
  "no-known-issue": "No known issue detected from information entered",
  review: "Review before using",
  ask: "Ask a clinician or pharmacist first",
};

export const BASED_ON_ENTERED = "Based on the information currently entered.";

export type SafetyReason = { kind: "interaction" | "lab" | "condition" | "allergy" | "duplicate" | "symptom"; level: Exclude<SafetyLevel, "no-known-issue">; text: string };

export type SafetyCheck = { level: SafetyLevel; reasons: SafetyReason[]; caveats: string[] };

const BLOOD_THINNERS = /\b(warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|clopidogrel|plavix|aspirin)\b/i;
const NITRATES = /\b(nitroglycerin|isosorbide|nitrate)\b/i;
const POTASSIUM_RAISERS = /\b(lisinopril|enalapril|ramipril|losartan|valsartan|telmisartan|spironolactone|eplerenone)\b/i;
const SEDATIVES = /\b(zolpidem|ambien|alprazolam|xanax|lorazepam|clonazepam|diazepam|trazodone|gabapentin|oxycodone|hydrocodone)\b/i;
const GLUCOSE_LOWERING_PROFILES = ["insulin", "metformin", "glp-1-agonists"];
/* Minerals and bile acids change how these are absorbed — from each supplement's own cited profile. */
const ABSORPTION_ANTIBIOTICS = /(doxycycline|minocycline|tetracycline|ciprofloxacin|levofloxacin|moxifloxacin|norfloxacin)/i;
const BONE_MEDICINES = /(alendronate|fosamax|risedronate|actonel|ibandronate|boniva|zoledronic)/i;
const THYROID_MEDICINES = /(levothyroxine|synthroid|levoxyl|liothyronine|cytomel|armour thyroid)/i;
const BILE_BINDERS = /(cholestyramine|questran|colestipol|colestid|colesevelam|welchol|aluminum hydroxide|maalox|mylanta|amphojel)/i;

type Derived = {
  profileKeys: Set<string>;
  medicationText: string;
  medicationNames: string[];
  oralNames: string[];
  statusOf: (key: MarkerKey) => MarkerTrend["status"] | undefined;
  symptoms: Set<string>;
};

function derive(ctx: SupportContext): Derived {
  const profileKeys = new Set<string>();
  const medicationNames: string[] = [];
  const oralNames: string[] = [];
  for (const entry of ctx.logged) {
    if (!entry.isActive) continue;
    const profiles = profilesForCompound(entry);
    for (const profile of profiles) profileKeys.add(profile.key);
    const supplementOnly = profiles.length > 0 && profiles.every((p) => p.regulatory === "supplement");
    if (entry.category === "medication") medicationNames.push(entry.name);
    /* The member's route when entered; otherwise only when the catalog knows the compound exclusively as an oral product. */
    const catalogRoutes = (findCatalogEntry(entry.officialName ?? "") ?? findCatalogEntry(entry.name))?.routes;
    const oral = entry.route ? entry.route === "oral" : catalogRoutes?.length === 1 && catalogRoutes[0] === "oral";
    if (oral && !supplementOnly) oralNames.push(entry.name);
  }
  const trendByKey = new Map(ctx.trends.map((t) => [t.key, t]));
  return {
    profileKeys,
    medicationText: [ctx.medicationsText, ...medicationNames].join(" "),
    medicationNames,
    oralNames,
    statusOf: (key) => trendByKey.get(key)?.status,
    symptoms: recentSymptoms(ctx),
  };
}

function glucoseLoweringNames(ctx: SupportContext): string[] {
  return ctx.logged
    .filter((e) => e.isActive && profilesForCompound(e).some((p) => GLUCOSE_LOWERING_PROFILES.includes(p.key)))
    .map((e) => e.name);
}

export function checkSafety(option: SupportOption, ctx: SupportContext, duplicates: DuplicateNutrient[]): SafetyCheck {
  const d = derive(ctx);
  const reasons: SafetyReason[] = [];
  const push = (kind: SafetyReason["kind"], level: SafetyReason["level"], text: string) => reasons.push({ kind, level, text });
  const outside = (key: MarkerKey) => OUTSIDE.has(d.statusOf(key) ?? "no-data");
  const glucoseMeds = glucoseLoweringNames(ctx);
  const insulin = ctx.logged.filter((e) => e.isActive && profilesForCompound(e).some((p) => p.key === "insulin")).map((e) => e.name);
  const thinner = d.medicationText.match(BLOOD_THINNERS)?.[0];
  const diabetes = ctx.healthContext.includes("diabetes");

  switch (option.key) {
    case "fish-oil":
      if (thinner) push("interaction", "ask", `You entered ${thinner}. Fish oil adds to bleeding risk with blood thinners.`);
      if (ctx.allergies.some((a) => /fish|shellfish/i.test(a))) push("allergy", "review", "Your allergy list includes fish or shellfish. Many fish oil products are made from them.");
      break;
    case "coq10":
      if (/\b(warfarin|coumadin)\b/i.test(d.medicationText)) push("interaction", "ask", "You entered warfarin. Coenzyme Q10 may weaken its effect.");
      break;
    case "berberine":
      if (insulin.length) push("interaction", "ask", `${listNames(insulin)} ${insulin.length === 1 ? "is" : "are"} in your log. Berberine lowers blood sugar, adding to insulin's effect. Low blood sugar is an emergency.`);
      else if (glucoseMeds.length) push("interaction", "review", `${listNames(glucoseMeds)} ${glucoseMeds.length === 1 ? "is" : "are"} in your log. Berberine adds to glucose-lowering medicines.`);
      if (d.medicationNames.length || ctx.medicationsText.trim()) push("interaction", "review", "Berberine changes how the liver processes many prescription medicines, and you have medications entered.");
      if (diabetes) push("condition", "review", "You noted diabetes in your profile. Berberine lowers blood sugar.");
      break;
    case "milk-thistle":
      if (glucoseMeds.length) push("interaction", "review", `${listNames(glucoseMeds)} ${glucoseMeds.length === 1 ? "is" : "are"} in your log. Milk thistle may add to glucose-lowering medicines.`);
      if (ctx.allergies.some((a) => /ragweed|daisy|marigold|chrysanthemum/i.test(a))) push("allergy", "review", "Your allergy list includes a plant related to milk thistle.");
      break;
    case "psyllium":
      if (d.oralNames.length) push("interaction", "review", `Swallowed at the same time, psyllium can reduce absorption of oral medicines and compounds such as ${listNames(d.oralNames)}.`);
      if (glucoseMeds.length) push("interaction", "review", `${listNames(glucoseMeds)} ${glucoseMeds.length === 1 ? "is" : "are"} in your log. Psyllium may add to glucose-lowering medicines.`);
      break;
    case "n-acetyl-cysteine": {
      const nitrate = d.medicationText.match(NITRATES)?.[0];
      if (nitrate) push("interaction", "ask", `You entered ${nitrate}. NAC can strengthen its effect, causing low blood pressure and headache.`);
      break;
    }
    case "magnesium": {
      if (outside("egfr") || outside("creatinine")) push("lab", "ask", "A kidney result is outside the range on your report. Kidneys clear magnesium.");
      if (outside("magnesium")) push("lab", "ask", "Your magnesium result is outside the range on your report.");
      const spaced = d.medicationText.match(ABSORPTION_ANTIBIOTICS)?.[0] ?? d.medicationText.match(BONE_MEDICINES)?.[0];
      if (spaced) push("interaction", "review", `You entered ${spaced}. Magnesium reduces absorption of it when they are swallowed at the same time.`);
      break;
    }
    case "electrolytes": {
      const raiser = d.medicationText.match(POTASSIUM_RAISERS)?.[0] ?? (d.profileKeys.has("telmisartan") ? "telmisartan" : undefined);
      if (raiser) push("interaction", "ask", `You entered ${raiser}. Potassium in electrolyte products adds to medicines that raise potassium.`);
      if (outside("potassium") || outside("sodium")) push("lab", "ask", "A sodium or potassium result is outside the range on your report.");
      if (ctx.healthContext.includes("chf")) push("condition", "ask", "You noted chronic heart failure in your profile. Added sodium and potassium matter there.");
      const bpUp = ctx.comparison?.changes.find((c) => c.id === "blood-pressure" && c.bucket !== "stable");
      if (bpUp || ctx.healthContext.includes("high-blood-pressure")) push("condition", "review", "Added sodium can work against blood pressure, and your check-ins or profile mention blood pressure.");
      break;
    }
    case "vitamin-d3":
      if (outside("calcium")) push("lab", "ask", "Your calcium result is outside the range on your report.");
      break;
    case "tudca": {
      if (outside("alt") || outside("ast") || outside("bilirubin")) push("lab", "ask", "A liver result is outside the range on your report.");
      const binder = d.medicationText.match(BILE_BINDERS)?.[0];
      if (binder) push("interaction", "review", `You entered ${binder}. Bile acid binders and aluminum-based antacids reduce absorption of ursodiol, the prescription relative of TUDCA.`);
      break;
    }
    case "multivitamin":
      if (/\b(warfarin|coumadin)\b/i.test(d.medicationText)) push("interaction", "ask", "You entered warfarin. Vitamin K in many multivitamins can change its effect.");
      if (["hematocrit", "hemoglobin"].some((k) => OUTSIDE.has(d.statusOf(k as MarkerKey) ?? "no-data") || MOVING.has(d.statusOf(k as MarkerKey) ?? "no-data"))) {
        push("lab", "review", "Your hematocrit or hemoglobin has moved, and many multivitamins contain iron. Check the label.");
      }
      {
        const spaced = d.medicationText.match(THYROID_MEDICINES)?.[0] ?? d.medicationText.match(ABSORPTION_ANTIBIOTICS)?.[0];
        if (spaced) push("interaction", "review", `You entered ${spaced}. Iron and zinc in many multivitamins reduce absorption of it when they are swallowed at the same time.`);
      }
      break;
    case "melatonin": {
      const sedative = d.medicationText.match(SEDATIVES)?.[0];
      if (sedative) push("interaction", "review", `You entered ${sedative}. Melatonin adds to drowsiness from sedating medicines.`);
      if (d.symptoms.has("snoring-breathing-pauses")) push("symptom", "review", "Your check-in includes loud snoring or pauses in breathing. Those need clinician review, and melatonin does not address them.");
      break;
    }
    default:
      break;
  }

  /* The option's own risks landing on an area the member's compounds already load */
  for (const overlap of overlapsForOption(option, ctx.brief).overlaps) {
    push("interaction", "review", `${option.title}: ${overlap.note} Your ${listNames(overlap.compoundNames)} also ${overlap.compoundNames.length === 1 ? "affects" : "affect"} this area.`);
  }

  for (const duplicate of duplicates.filter((dup) => dup.sources.some((s) => s.name === option.title))) {
    push("duplicate", "review", duplicate.text);
  }

  const caveats: string[] = [BASED_ON_ENTERED];
  if (!ctx.medicationsText.trim() && d.medicationNames.length === 0) caveats.push("No medications are entered in Reserve.");
  if (ctx.allergies.length === 0) caveats.push("No allergies are entered in Reserve.");

  const unique = reasons.filter((r, i) => reasons.findIndex((x) => x.text === r.text) === i);
  const level: SafetyLevel = unique.some((r) => r.level === "ask") ? "ask" : unique.length ? "review" : "no-known-issue";
  return { level, reasons: unique, caveats };
}

/* ─── Library ─────────────────────────────────────────────────────────── */

export type LibraryOption = {
  option: SupportOption;
  /** Findings in this purpose group. */
  findings: SupportFinding[];
  /** Reasons for this purpose group only. */
  reasons: string[];
  /** Every reason across the option's purposes, for its detail view. */
  allReasons: string[];
  personalized: boolean;
  inPlan: boolean;
  inLog: boolean;
  check: SafetyCheck;
  labLinks: LabLink[];
};

export type LibraryGroup = { key: PurposeGroupKey | "performance"; label: string; notes: string[]; options: LibraryOption[] };

function inLog(option: SupportOption, logged: LoggedEntry[]): boolean {
  return logged.some((entry) => {
    const catalog = findCatalogEntry(entry.officialName ?? "") ?? findCatalogEntry(entry.name);
    return entry.isActive && catalog?.officialName === option.catalogName;
  });
}

/** Build one library row for an option. `findings` is the slice shown in this
    group (all of the option's findings for the performance lens, or the ones in
    a purpose group's areas). Reasons are scoped the same way. */
function libraryOptionFor(
  option: SupportOption,
  ctx: SupportContext,
  planKeys: Set<string>,
  findings: SupportFinding[],
  areas?: SupportArea[],
): LibraryOption {
  const inPlan = planKeys.has(option.key);
  /* Check as if added, so duplicates the option would create show before adding. */
  const sources = intakeSources({ plan: inPlan ? ctx.plan : [...ctx.plan, { id: "preview", optionKey: option.key, addedAt: "" }], logged: ctx.logged });
  const check = checkSafety(option, ctx, findDuplicates(sources));
  const reasons = reasonsFor(option, ctx, areas);
  return {
    option,
    findings,
    reasons,
    allReasons: reasonsFor(option, ctx),
    personalized: reasons.length > 0,
    inPlan,
    inLog: inLog(option, ctx.logged),
    check,
    labLinks: labLinksFor(option, ctx.trends),
  };
}

/* The one honest line for the performance lens — evidence is what trials show,
   and Reserve never sets amounts or timing. */
const PERFORMANCE_GROUP_NOTE =
  "Listed alphabetically, never ranked. Each grade is what trials show, including where nothing is shown. Reserve sets no amounts or timing — you choose when and log it. Supplements cannot make a cycle risk-free or replace labs and medical care.";

export function buildSupportLibrary(ctx: SupportContext): LibraryGroup[] {
  const planKeys = new Set(ctx.plan.map((p) => p.optionKey));

  const purposeGroups: LibraryGroup[] = PURPOSE_GROUPS.map((group) => {
    const options = SUPPORT_OPTIONS.flatMap((option): LibraryOption[] => {
      const findings = option.findings.filter((f) => group.areas.includes(f.area));
      if (findings.length === 0) return [];
      return [libraryOptionFor(option, ctx, planKeys, findings, group.areas)];
    });
    const notes = [...new Set(group.areas.map((area) => SUPPORT_AREA_NOTES[area]).filter((n): n is string => Boolean(n)))];
    return { key: group.key, label: group.label, notes, options };
  });

  /* Training & performance — a lens over the same library so the training
     add-ons (creatine, EAAs, whey, beta-alanine, caffeine, citrulline…) are
     easy to find in one place. Each keeps all of its own findings, so the
     honest cautions travel with the benefit. */
  const performanceGroup: LibraryGroup = {
    key: "performance",
    label: "Training & performance",
    notes: [PERFORMANCE_GROUP_NOTE],
    options: PERFORMANCE_OPTIONS.map((option) => libraryOptionFor(option, ctx, planKeys, option.findings)),
  };

  return [performanceGroup, ...purposeGroups];
}

/* ─── The member's plan ───────────────────────────────────────────────── */

export type PlanEntry = {
  item: SupportPlanItem;
  option: SupportOption;
  grade: EvidenceGrade;
  groups: PurposeGroupKey[];
  check: SafetyCheck;
  labLinks: LabLink[];
  /** Before and after the member added it — timing only. */
  timing: string[];
};

export type CoverageKey = "cardiovascular" | "blood" | "liver" | "glucose" | "kidney" | "hormonal" | "fertility" | "prostate" | "skin" | "bone" | "sleep" | "general";
export type CoverageState = "monitored" | "support-selected" | "monitoring-missing" | "no-proven-support";

export const COVERAGE_STATE_LABEL: Record<CoverageState, string> = {
  monitored: "Monitored",
  "support-selected": "Support selected",
  "monitoring-missing": "Monitoring missing",
  "no-proven-support": "No proven supplement support",
};

/** `alwaysNote`: an area where options exist but none address what the member's compounds do there. */
const COVERAGE: Array<{ key: CoverageKey; label: string; areas: SupportArea[]; system?: SystemRow["system"]; alwaysNote?: boolean }> = [
  { key: "cardiovascular", label: "Cardiovascular", areas: ["cardiovascular", "lipids"], system: "cardiovascular" },
  { key: "blood", label: "Blood", areas: ["blood"], system: "blood" },
  { key: "liver", label: "Liver", areas: ["liver"], system: "liver" },
  { key: "glucose", label: "Glucose", areas: ["metabolic"], system: "glucose" },
  { key: "kidney", label: "Kidney", areas: ["kidney"], system: "kidney" },
  { key: "hormonal", label: "Hormonal", areas: ["hormonal"], system: "hormonal" },
  { key: "fertility", label: "Fertility", areas: ["fertility"], system: "fertility" },
  { key: "prostate", label: "Prostate", areas: ["prostate"], system: "prostate" },
  /* Zinc and collagen have skin findings, but none for acne or hair loss driven by androgens. */
  { key: "skin", label: "Skin & hair", areas: ["skin"], system: "skin", alwaysNote: true },
  { key: "bone", label: "Bone", areas: ["bone"] },
  { key: "sleep", label: "Sleep", areas: ["sleep"], system: "sleep" },
  { key: "general", label: "General nutrition", areas: ["general"] },
];

export const NO_PROVEN_SUPPORT = "No supplement has been demonstrated to reliably prevent this risk.";

export type CoverageRow = { key: CoverageKey; label: string; states: CoverageState[]; detail: string };

/** What Reserve says about a supplement the member named that is not in the library. */
export const CUSTOM_SUPPLEMENT_LINES: readonly string[] = [
  "Entered by you · not in Reserve's library.",
  "No evidence grade: Reserve has no reviewed evidence for it.",
  "Reserve can't check its ingredients against your records. Ask a pharmacist about interactions.",
];

export type CustomPlanEntry = { item: SupportPlanItem; title: string; lines: readonly string[] };

export type SupportPlanReview = {
  entries: PlanEntry[];
  /** Member-named supplements that are not in the library — tracked, never graded or checked. */
  custom: CustomPlanEntry[];
  groups: Array<{ key: PurposeGroupKey; label: string; entries: PlanEntry[] }>;
  counts: {
    selected: number;
    stronger: number;
    limited: number;
    notShown: number;
    interactionAlerts: number;
    duplicateAlerts: number;
    monitoringAreas: number;
  };
  duplicates: DuplicateNutrient[];
  coverage: CoverageRow[];
  covers: string[];
  notAddressed: string[];
  sizeNote: string | null;
  library: LibraryGroup[];
  /** Every area the member's compounds affect, and what the library shows for it. Null with no compounds logged. */
  evidenceMap: EvidenceMap | null;
};

function timingFor(item: SupportPlanItem, option: SupportOption, trends: MarkerTrend[]): string[] {
  const start = item.startDate && isDateKey(item.startDate) ? item.startDate : item.addedAt.slice(0, 10);
  if (!isDateKey(start)) return [];
  const keys = [...new Set(option.findings.flatMap((f) => f.markers))];
  const trendByKey = new Map(trends.map((t) => [t.key, t]));
  const lines: string[] = [];
  for (const key of keys) {
    const trend = trendByKey.get(key);
    if (!trend) continue;
    const before = [...trend.points].reverse().find((p) => p.date <= start);
    const after = [...trend.points].reverse().find((p) => p.date > start);
    if (before && after && before.value != null && after.value != null && before.value !== 0) {
      const pct = ((after.value - before.value) / Math.abs(before.value)) * 100;
      const word = pct >= 3 ? "increased" : pct <= -3 ? "decreased" : "held steady";
      lines.push(`${trend.label} ${word} after ${option.title} was added (${formatLabValue(before.valueText, trend.unit)} → ${formatLabValue(after.valueText, trend.unit)}). Timing only — many things change at once.`);
    }
  }
  return lines.slice(0, 3);
}

export function buildSupportPlanReview(ctx: SupportContext): SupportPlanReview {
  const sources = intakeSources(ctx);
  const duplicates = findDuplicates(sources);

  const entries: PlanEntry[] = ctx.plan.flatMap((item): PlanEntry[] => {
    const option = supportOptionByKey(item.optionKey);
    if (!option) return [];
    const groups = PURPOSE_GROUPS.filter((g) => option.findings.some((f) => g.areas.includes(f.area))).map((g) => g.key);
    return [{
      item,
      option,
      grade: bestGrade(option),
      groups,
      check: checkSafety(option, ctx, duplicates),
      labLinks: labLinksFor(option, ctx.trends),
      timing: timingFor(item, option, ctx.trends),
    }];
  });

  const custom: CustomPlanEntry[] = ctx.plan
    .filter((item) => item.optionKey === "custom" && item.customTitle?.trim())
    .map((item) => ({ item, title: item.customTitle!.trim(), lines: CUSTOM_SUPPLEMENT_LINES }));
  const selected = entries.length + custom.length;

  const groups = PURPOSE_GROUPS.map((g) => ({ key: g.key, label: g.label, entries: entries.filter((e) => e.groups[0] === g.key) })).filter((g) => g.entries.length > 0);

  const systemByKey = new Map(ctx.systems.map((s) => [s.system, s]));
  const coverage: CoverageRow[] = COVERAGE.map((row) => {
    const states: CoverageState[] = [];
    const details: string[] = [];
    const system = row.system ? systemByKey.get(row.system) : undefined;
    if (system && (system.status === "monitored" || system.status === "trend" || system.status === "clinician-review")) {
      states.push("monitored");
      /* "Monitored" must never hide a result that is moving or routed to a clinician. */
      if (system.status !== "monitored") details.push(`${SYSTEM_STATUS_LABEL[system.status]}: ${system.detail}`);
    }
    if (system && (system.status === "monitoring-due" || system.status === "incomplete")) {
      states.push("monitoring-missing");
      details.push(system.detail);
    }
    const selected = entries.filter((e) => e.option.findings.some((f) => row.areas.includes(f.area)));
    if (selected.length) {
      states.push("support-selected");
      details.push(`Selected: ${listNames(selected.map((e) => e.option.title))}.`);
    }
    const proven = SUPPORT_OPTIONS.some((o) => o.findings.some((f) => row.areas.includes(f.area) && (f.grade === "well-studied" || f.grade === "some")));
    if (!proven) {
      states.push("no-proven-support");
      details.push(SUPPORT_AREA_NOTES[row.areas[0]] ?? NO_PROVEN_SUPPORT);
    } else if (row.alwaysNote && SUPPORT_AREA_NOTES[row.areas[0]]) {
      details.push(SUPPORT_AREA_NOTES[row.areas[0]]!);
    }
    return { key: row.key, label: row.label, states, detail: details.join(" ") };
  });

  /* What supplements cannot solve — pointed at monitoring or a clinician, never another product */
  const notAddressed: string[] = [];
  const trendByKey = new Map(ctx.trends.map((t) => [t.key, t]));
  const moved = (keys: MarkerKey[]) => keys.map((k) => trendByKey.get(k)).filter((t): t is MarkerTrend => Boolean(t && (MOVING.has(t.status) || OUTSIDE.has(t.status))));
  if (ctx.needsCare) notAddressed.push("Warning-sign symptoms. They need medical care now, not a supplement.");
  const bp = ctx.comparison?.changes.find((c) => c.id === "blood-pressure" && c.bucket !== "stable");
  if (bp) notAddressed.push(`Blood pressure changes. ${bp.text} Keep logging readings and review them with your clinician.`);
  const hct = moved(["hematocrit", "hemoglobin"]);
  if (hct.length) notAddressed.push(`${listNames(hct.map((t) => t.label))} changes. No supplement lowers them — review with your clinician.`);
  const lipids = moved(["apob", "ldl", "hdl"]);
  if (lipids.length) notAddressed.push(`${listNames(lipids.map((t) => t.label))} changes during this cycle. A support plan does not replace clinician review of cardiovascular risk.`);
  const liver = moved(["alt", "ast", "bilirubin"]);
  if (liver.length) notAddressed.push(`${listNames(liver.map((t) => t.label))} changes. No supplement has been shown to prevent liver injury — review with your clinician.`);
  const loads = new Set(ctx.systems.filter((s) => s.status !== "no-load").map((s) => s.system));
  if (loads.has("hormonal") || loads.has("fertility")) notAddressed.push("Hormone and fertility effects of your plan. No supplement has proven support here; they are worth reviewing with a clinician or a telehealth visit.");
  /* A result no option watches still gets an answer, never silence. */
  const SPOKEN_FOR: MarkerKey[] = ["hematocrit", "hemoglobin", "apob", "ldl", "hdl", "alt", "ast", "bilirubin"];
  const unanswered = ctx.trends.filter(
    (t) => (MOVING.has(t.status) || OUTSIDE.has(t.status)) && !OPTION_MARKERS.has(t.key) && !SPOKEN_FOR.includes(t.key),
  );
  if (unanswered.length) {
    const many = unanswered.length > 1;
    notAddressed.push(
      `${listNames(unanswered.map((t) => t.label))} changes on your own report. Reserve's library has no supplement with reviewed evidence for ${many ? "them" : "it"} — review with your clinician.`,
    );
  }
  if (ctx.untestedLabels.length) notAddressed.push(`Missing labs: ${listNames(ctx.untestedLabels.slice(0, 5))}. No supplement replaces testing.`);
  if (ctx.stillActivePastEnd) notAddressed.push("Compounds still active past your planned end. Review the plan with your clinician.");

  const stronger = entries.filter((e) => e.grade === "well-studied" || e.grade === "some").length;
  const limited = entries.filter((e) => e.grade === "limited").length;

  return {
    entries,
    custom,
    groups,
    counts: {
      selected,
      stronger,
      limited,
      notShown: entries.length - stronger - limited,
      interactionAlerts: entries.filter((e) => e.check.reasons.some((r) => r.kind !== "duplicate")).length,
      duplicateAlerts: duplicates.length,
      monitoringAreas: ctx.systems.filter((s) => s.status === "monitoring-due" || s.status === "incomplete" || s.status === "trend" || s.status === "clinician-review").length,
    },
    duplicates,
    coverage,
    covers: [...new Set(entries.map((e) => e.option.coverageLabel))],
    notAddressed,
    sizeNote: selected >= 6 ? `Your support plan has ${selected} items. Each one adds interaction and duplicate-intake checks; none of them adds monitoring.` : null,
    library: buildSupportLibrary(ctx),
    evidenceMap: buildEvidenceMap(ctx.brief),
  };
}
