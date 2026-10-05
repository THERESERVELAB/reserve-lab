/* ════════════════════════════════════════════════════════════════════════
   CYCLE REVIEW REPORT — one deterministic reading of the member's cycle.

   Assembles goal, phase, what looks aligned, what needs attention (ranked),
   monitoring gaps, lab trends, body systems, complexity, nutrition, training
   and recovery, and questions for the member's clinician — from records the
   member entered or imported. Nothing is invented: an amount that was never
   entered is "Unknown / not entered", a lab never drawn is "Evidence needed".

   The report never says to increase, add, start, stop or change a compound.
   Its only moves are: monitor, log, review, and ask a clinician.
   ════════════════════════════════════════════════════════════════════════ */

import { BURDENS } from "@/lib/compound-intelligence/burdens";
import { EVIDENCE_GRADE_LABEL } from "@/lib/compound-intelligence/evidence";
import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { CYCLE_PHASE_LABEL, daysBetween, type CycleState } from "@/lib/cycle/cycle-period";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";
import type { MarkerKey } from "@/lib/labs/markers";
import type { NutritionPhase } from "@/lib/nutrition/protocol-alignment";
import type { MacroTargets } from "@/lib/nutrition/types";
import type { EscalationItem } from "@/lib/safety/escalation";
import { renderSummaryText, type SummaryDocument, type SummaryLine, type SummarySection } from "@/lib/safety/summary-document";

import { buildSystemRows, SYSTEM_STATUS_LABEL, type SystemRow } from "./body-systems";
import { CHECK_IN_INTERVAL_DAYS, compareCheckIns, type CheckInComparison } from "./check-in";
import { buildCycleComplexity, COMPLEXITY_LEVEL_LABEL, COMPLEXITY_REVIEW_LABEL, type CycleComplexity, type ReviewCompound } from "./complexity";
import { buildCycleTimeline, buildMarkerTrends, formatLabValue, MARKER_TREND_STATUS_LABEL, type MarkerTrend, type TimelineEvent } from "./lab-trends";
import { markerDef } from "@/lib/labs/markers";
import { buildPhaseNutrition, type PhaseNutrition, type WeightPoint } from "./nutrition-phase";
import { buildSupportPlanReview, SAFETY_LEVEL_LABEL, type LoggedEntry, type SupportPlanReview } from "./support-plan";
import type { TrainingRecovery } from "./training-recovery";
import {
  CHECK_IN_SYMPTOMS,
  COMPOUND_PURPOSE_LABEL,
  CYCLE_GOAL_LABEL,
  CYCLE_PRIORITY_LABEL,
  type CycleCheckIn,
  type CycleGoalSetup,
  type SupportPlanItem,
} from "./types";

export const NOT_ENTERED = "Unknown / not entered";

export type MemberSnapshot = {
  age?: number;
  sex?: string;
  heightIn?: number;
  weightLb?: number;
  bodyFatPct?: number;
  experienceLevel?: string;
  trainingDaysPerWeek?: number;
};

export type PlanCompound = ReviewCompound & {
  /** Exactly as entered; blank when never entered. */
  amount?: string;
  unit?: string;
  frequency?: string;
  route?: string;
  sourceType?: string;
  isActive: boolean;
  pausedAt?: string;
};

export type CycleReviewInput = {
  today: string;
  member: MemberSnapshot;
  cycleState: CycleState;
  goalSetup: CycleGoalSetup | null;
  compounds: PlanCompound[];
  labBrief: LabSafetyBrief;
  markerLinks: Partial<Record<MarkerKey, string[]>>;
  escalation: EscalationItem[];
  recentRedFlagCount: number;
  checkIns: CycleCheckIn[];
  sleepLogs: Array<{ date: string; hours: number }>;
  weights: WeightPoint[];
  nutritionPhase: NutritionPhase | null;
  todayMacros: MacroTargets | null;
  training: TrainingRecovery;
  /** Supplements the member chose to track. */
  supportPlan?: SupportPlanItem[];
  /** Every entry in the member's log, for interaction and duplicate checks. Defaults to the plan compounds. */
  logged?: LoggedEntry[];
  /** Free text from the member's profile, exactly as entered. */
  medicationsText?: string;
  healthContext?: string[];
  allergies?: string[];
};

export type AttentionSeverity = "high" | "moderate" | "low";

export const ATTENTION_SEVERITY_LABEL: Record<AttentionSeverity, string> = { high: "High", moderate: "Moderate", low: "Low" };

export type AttentionItem = { id: string; severity: AttentionSeverity; title: string; detail: string };

export type CycleReview = {
  today: string;
  goalLabel: string | null;
  priorityLabels: string[];
  phaseLabel: string;
  weekLine: string;
  lastLabDate?: string;
  lastCheckInDate?: string;
  checkInDue: boolean;
  /** A symptom or lab needs care now — the review steps aside for it. */
  needsCare: boolean;
  careItems: EscalationItem[];
  aligned: string[];
  attention: AttentionItem[];
  gaps: string[];
  trends: MarkerTrend[];
  timeline: TimelineEvent[];
  systems: SystemRow[];
  complexity: CycleComplexity;
  nutrition: PhaseNutrition | null;
  training: TrainingRecovery;
  checkIn: CheckInComparison | null;
  questions: string[];
  support: SupportPlanReview;
};

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { high: 0, moderate: 1, low: 2 };

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const valueWithUnit = formatLabValue;

export function buildCycleReview(input: CycleReviewInput): CycleReview {
  const { cycleState: state, goalSetup, today } = input;
  const compounds: ReviewCompound[] = input.compounds.map((c) => ({ ...c, purpose: goalSetup?.compoundPurposes[c.id] }));

  const trends = buildMarkerTrends({ labBrief: input.labBrief, cycle: state.cycle, markerLinks: input.markerLinks });
  const checkIns = input.checkIns.filter((c) => !c.cycleId || c.cycleId === state.cycle.id);
  const comparison = compareCheckIns(checkIns);
  const recentSymptoms = checkIns
    .filter((c) => daysBetween(c.date, today) <= 14)
    .flatMap((c) => c.symptoms);

  const complexity = buildCycleComplexity({
    compounds,
    cycleState: state,
    primaryGoal: goalSetup?.primaryGoal,
    priorities: goalSetup?.priorities ?? [],
    trends,
    untested: input.labBrief.untested,
    recentSymptoms,
    recentRedFlagCount: input.recentRedFlagCount,
    today,
  });

  const systems = buildSystemRows({
    compounds,
    trends,
    checkIns,
    comparison,
    sleepLogDates: input.sleepLogs.map((s) => s.date),
    today,
  });

  const glucoseCompounds = input.compounds
    .filter((c) => complexity.overlaps.some((o) => o.burden === "glucose" && o.compounds.some((x) => x.id === c.id)) || systems.find((s) => s.system === "glucose")?.compoundNames.includes(c.name))
    .map((c) => c.name);
  const nutrition = goalSetup
    ? buildPhaseNutrition({
        goal: goalSetup.primaryGoal,
        nutritionPhase: input.nutritionPhase,
        todayMacros: input.todayMacros,
        weights: [...input.weights, ...checkIns.filter((c) => c.bodyweightLb).map((c) => ({ date: c.date, weightLb: c.bodyweightLb! }))],
        today,
        glucoseCompounds: [...new Set(glucoseCompounds)],
        trends,
      })
    : null;

  const timeline = buildCycleTimeline(
    state.cycle,
    input.compounds.map((c) => ({ id: c.id, name: c.name, startDate: c.startDate, pausedAt: c.pausedAt })),
  );

  const careItems = input.escalation.filter((e) => e.level === "crisis" || e.level === "emergency" || e.level === "contact-clinician-today");
  const needsCare = careItems.length > 0 || Boolean(comparison?.needsCare);

  const planNames = new Set(input.compounds.map((c) => c.name));
  const planUntested = input.labBrief.untested.filter((u) => u.compounds.some((n) => planNames.has(n)));
  const support = buildSupportPlanReview({
    today,
    brief: buildCompoundRiskBrief(input.compounds.map((c) => ({ name: c.name, officialName: c.officialName, compoundClass: c.compoundClass }))),
    logged:
      input.logged ??
      input.compounds.map((c) => ({ name: c.name, officialName: c.officialName, compoundClass: c.compoundClass, category: "compound", route: c.route, isActive: c.isActive })),
    medicationsText: input.medicationsText ?? "",
    healthContext: input.healthContext ?? [],
    allergies: input.allergies ?? [],
    goalSetup,
    trends,
    checkIns,
    comparison,
    systems,
    untestedLabels: planUntested.map((u) => u.label),
    needsCare,
    stillActivePastEnd: state.stillActivePastEnd,
    plan: input.supportPlan ?? [],
  });

  const sortedCheckIns = [...checkIns].sort((a, b) => b.date.localeCompare(a.date));
  const lastCheckInDate = sortedCheckIns[0]?.date;
  const checkInDue = !lastCheckInDate || daysBetween(lastCheckInDate, today) >= CHECK_IN_INTERVAL_DAYS;

  /* ─── What looks aligned ─── */
  const aligned: string[] = [];
  if (state.cycle.clinicianOversight) aligned.push("A clinician is marked as overseeing this cycle.");
  if (compounds.length > 0 && compounds.every((c) => c.purpose)) aligned.push("Every compound in the plan has a recorded purpose.");
  if (nutrition?.phaseMatch === "aligned") aligned.push(nutrition.phaseNote);
  if (nutrition?.velocity.status === "within") aligned.push(nutrition.velocity.text);
  for (const signal of input.training.signals.filter((s) => s.kind === "aligned")) aligned.push(signal.text);
  const monitored = systems.filter((s) => s.status === "monitored");
  if (monitored.length > 0) aligned.push(`Monitoring is current for ${listNames(monitored.map((s) => s.label.toLowerCase()))}.`);
  if (comparison && !checkInDue && comparison.latest.symptoms.length === 0) aligned.push("No symptoms entered in your latest check-in.");

  /* ─── What needs attention ─── */
  const attention: AttentionItem[] = [];
  for (const item of careItems) attention.push({ id: `care-${item.id}`, severity: "high", title: item.title, detail: item.body });
  if (comparison?.needsCare && careItems.length === 0) {
    attention.push({ id: "care-check-in", severity: "high", title: "Symptoms in your check-in need care", detail: "Get medical care today — your clinician, urgent care or a telehealth visit — or call 911 if symptoms are severe." });
  }
  for (const row of systems.filter((s) => s.status === "clinician-review")) {
    attention.push({ id: `system-${row.system}`, severity: "high", title: `${row.label}: ${SYSTEM_STATUS_LABEL[row.status].toLowerCase()}`, detail: row.detail });
  }
  if (complexity.review.state === "review-soon") {
    attention.push({ id: "complexity-review", severity: "high", title: COMPLEXITY_REVIEW_LABEL["review-soon"], detail: complexity.review.reasons.join(" ") });
  }
  if (state.stillActivePastEnd) {
    attention.push({ id: "past-end", severity: "moderate", title: "Past your planned end", detail: `${listNames(state.activePastEndNames)} ${state.activePastEndNames.length === 1 ? "is" : "are"} still active ${state.daysPastPlannedEnd} days after ${formatDate(state.plannedEnd)}.` });
  }
  for (const row of systems.filter((s) => s.status === "trend")) {
    attention.push({ id: `system-${row.system}`, severity: "moderate", title: `${row.label}: trend worth reviewing`, detail: row.detail });
  }
  for (const conflict of complexity.priorityConflicts) {
    attention.push({ id: `priority-${conflict.priority}`, severity: "moderate", title: `May conflict with "${CYCLE_PRIORITY_LABEL[conflict.priority]}"`, detail: conflict.text });
  }
  if (complexity.review.state === "worth-reviewing") {
    attention.push({ id: "complexity-review", severity: "moderate", title: "Plan complexity worth reviewing", detail: complexity.review.reasons.join(" ") });
  }
  if (nutrition?.phaseMatch === "mismatch") {
    attention.push({ id: "nutrition-mismatch", severity: "moderate", title: "Fuel strategy doesn't match your goal", detail: nutrition.phaseNote });
  }
  if (nutrition && (nutrition.velocity.status === "faster" || nutrition.velocity.status === "slower")) {
    attention.push({ id: "nutrition-velocity", severity: "low", title: "Bodyweight trend outside the coaching range", detail: nutrition.velocity.text });
  }
  for (const entry of support.entries.filter((e) => e.check.level === "ask")) {
    attention.push({
      id: `support-${entry.option.key}`,
      severity: "moderate",
      title: `Support plan: ask a clinician or pharmacist about ${entry.option.title}`,
      detail: entry.check.reasons.filter((r) => r.level === "ask").map((r) => r.text).join(" "),
    });
  }
  if (support.duplicates.length > 0) {
    attention.push({ id: "support-duplicates", severity: "low", title: "Possible duplicate intake", detail: support.duplicates.map((d) => d.text).join(" ") });
  }
  for (const signal of input.training.signals.filter((s) => s.kind === "worth-watching")) {
    attention.push({ id: `training-${signal.id}`, severity: "moderate", title: "Recovery worth watching", detail: signal.text });
  }
  for (const row of systems.filter((s) => s.status === "monitoring-due" || s.status === "incomplete")) {
    attention.push({ id: `system-${row.system}`, severity: "low", title: `${row.label}: ${SYSTEM_STATUS_LABEL[row.status].toLowerCase()}`, detail: row.detail });
  }
  if (!state.cycle.clinicianOversight && state.phase !== "upcoming") {
    attention.push({ id: "no-clinician", severity: "low", title: "No clinician on this cycle", detail: "Bring the summary below to urgent care, a telehealth visit or a pharmacist, or any clinician who can review your plan and labs. In most states you can also order lab tests yourself." });
  }
  if (checkInDue) {
    attention.push({ id: "check-in-due", severity: "low", title: "Weekly check-in due", detail: lastCheckInDate ? `Last check-in ${formatDate(lastCheckInDate)}.` : "No check-in logged for this cycle yet." });
  }
  const seen = new Set<string>();
  const rankedAttention = attention
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  /* ─── Monitoring gaps ─── */
  const gaps: string[] = [];
  if (!goalSetup) gaps.push("No goal set for this cycle.");
  for (const c of input.compounds) {
    if (!c.amount?.trim()) gaps.push(`Amount for ${c.name}: ${NOT_ENTERED}.`);
    if (!c.frequency?.trim()) gaps.push(`Frequency for ${c.name}: ${NOT_ENTERED}.`);
  }
  const cycleNames = new Set(input.compounds.map((c) => c.name));
  const untested = input.labBrief.untested.filter((u) => u.compounds.some((n) => cycleNames.has(n)));
  if (untested.length > 0) gaps.push(`Not in labs from the last 6 months: ${listNames(untested.map((u) => u.label))}.`);
  if (!checkIns.some((c) => c.systolic && c.diastolic)) gaps.push("No blood pressure logged in a check-in.");
  if (!checkIns.some((c) => c.restingHr)) gaps.push("No resting heart rate logged in a check-in.");
  if (input.sleepLogs.length === 0 && !checkIns.some((c) => c.sleepHours)) gaps.push("No sleep logged.");
  if (nutrition?.velocity.status === "unknown" && !nutrition.velocity.pctPerWeek) gaps.push("Not enough bodyweight entries for a weekly trend.");
  if (input.member.age === undefined) gaps.push(`Age: ${NOT_ENTERED}.`);
  if (!input.member.heightIn) gaps.push(`Height: ${NOT_ENTERED}.`);
  gaps.push(...input.training.gaps);
  gaps.push("Steps and cardio minutes are not tracked in Reserve yet.");

  /* ─── Questions for your clinician ─── */
  const questions: string[] = [];
  for (const trend of trends) {
    const from = trend.baseline ?? trend.points[0];
    const to = trend.current;
    if (!to) continue;
    if (trend.status === "clinician-review" || trend.status === "outside-range") {
      questions.push(`${trend.label} was ${valueWithUnit(to.valueText, trend.unit)} on ${formatDate(to.date)}${to.rangeText ? `, outside the range on your report (${to.rangeText})` : ""}. What follow-up do you want?`);
    } else if (trend.status === "trend" && from && from !== to) {
      const during = to.date >= state.cycle.startDate ? ", during this cycle" : "";
      questions.push(
        `My ${trend.label} went from ${valueWithUnit(from.valueText, trend.unit)} to ${valueWithUnit(to.valueText, trend.unit)} between ${formatDate(from.date)} and ${formatDate(to.date)}${during}. Should the risk profile of my current plan be reconsidered?`,
      );
    }
  }
  /* One monitoring question, naming the markers — never one per shared load. */
  const unmonitored = complexity.overlaps.filter(
    (o) => BURDENS[o.burden].markers.length > 0 && (o.latestResultAgeDays === undefined || o.latestResultAgeDays > 56),
  );
  const monitoringLabels = [
    ...new Set([...unmonitored.flatMap((o) => BURDENS[o.burden].markers.map((m) => markerDef(m).label)), ...untested.map((u) => u.label)]),
  ].slice(0, 8);
  if (monitoringLabels.length > 0) {
    questions.push(`My plan's compounds are commonly watched with ${listNames(monitoringLabels)}, and my recent labs don't include them. Which should be checked, and how often?`);
  }
  for (const conflict of complexity.priorityConflicts) {
    questions.push(`${conflict.text} How does my current plan fit that priority?`);
  }
  if (complexity.review.state !== "no-concern") questions.push("Does each compound in my plan still have a clear, documented role?");
  const bpChange = comparison?.changes.find((c) => c.id === "blood-pressure" && c.bucket !== "stable");
  if (bpChange) questions.push(`${bpChange.text} Should my blood pressure be checked in clinic?`);
  if (nutrition?.glucose && nutrition.glucose.markers.every((m) => !m.current)) questions.push("Does glucose or A1c monitoring apply to me with my current plan?");
  if (state.stillActivePastEnd) questions.push(`I am ${state.daysPastPlannedEnd} days past my planned end date. How should we review the plan from here?`);
  const uniqueQuestions = [...new Set(questions)].slice(0, 8);

  return {
    today,
    goalLabel: goalSetup ? CYCLE_GOAL_LABEL[goalSetup.primaryGoal] : null,
    priorityLabels: (goalSetup?.priorities ?? []).map((p) => CYCLE_PRIORITY_LABEL[p]),
    phaseLabel: CYCLE_PHASE_LABEL[state.phase],
    weekLine: state.phase === "upcoming" ? `Starts ${formatDate(state.cycle.startDate)}` : `Week ${state.weekNumber} of ${state.totalWeeks}`,
    lastLabDate: input.labBrief.latestLabDate,
    lastCheckInDate,
    checkInDue,
    needsCare,
    careItems,
    aligned,
    attention: rankedAttention,
    gaps: [...new Set(gaps)],
    trends,
    timeline,
    systems,
    complexity,
    nutrition,
    training: input.training,
    checkIn: comparison,
    questions: uniqueQuestions,
    support,
  };
}

/* ─── Bring this to your clinician ────────────────────────────────────── */

export function buildCycleReviewSummaryDocument(review: CycleReview, input: CycleReviewInput, generatedAt: Date): SummaryDocument {
  const m = input.member;
  const state = input.cycleState;
  const sections: SummarySection[] = [];
  const text = (value: string): SummaryLine => ({ kind: "text", text: value });
  const note = (value: string): SummaryLine => ({ kind: "note", text: value });
  const item = (value: string): SummaryLine => ({ kind: "item", text: value });

  sections.push({
    heading: "MEMBER (as entered)",
    lines: [
      text(`Age: ${m.age ?? NOT_ENTERED} · Sex: ${m.sex ?? NOT_ENTERED} · Height: ${m.heightIn ? `${m.heightIn} in` : NOT_ENTERED} · Weight: ${m.weightLb ? `${m.weightLb} lb` : NOT_ENTERED}${m.bodyFatPct ? ` · Body fat: ${m.bodyFatPct}% (member estimate)` : ""}`),
    ],
  });
  sections.push({
    heading: "GOAL",
    lines: [text(review.goalLabel ? `${review.goalLabel}${review.priorityLabels.length ? ` · Priorities: ${review.priorityLabels.join("; ")}` : ""}` : `Goal: ${NOT_ENTERED}`)],
  });
  sections.push({
    heading: "CYCLE (member-stated)",
    lines: [
      text(`${state.cycle.name}: ${state.cycle.startDate} to ${state.plannedEnd} · ${review.phaseLabel} · ${review.weekLine}`),
      text(`Clinician oversight marked by member: ${state.cycle.clinicianOversight ? "yes" : "no"}`),
    ],
  });

  const compoundLines: SummaryLine[] = input.compounds.length === 0 ? [note("None linked to this cycle.")] : [];
  for (const c of input.compounds) {
    const purpose = input.goalSetup?.compoundPurposes[c.id];
    compoundLines.push(
      item(
        `${c.name} — amount: ${c.amount?.trim() ? `${c.amount}${c.unit ? ` ${c.unit}` : ""}` : NOT_ENTERED} · frequency: ${c.frequency?.trim() || NOT_ENTERED} · route: ${c.route || NOT_ENTERED} · started: ${c.startDate || NOT_ENTERED} · source: ${c.sourceType ? c.sourceType.replace(/_/g, " ") : NOT_ENTERED} · purpose: ${purpose ? COMPOUND_PURPOSE_LABEL[purpose.kind] : NOT_ENTERED}${c.isActive ? "" : " · inactive"}`,
      ),
    );
  }
  sections.push({ heading: "COMPOUNDS (exactly as entered by the member)", lines: compoundLines });

  const supportLines: SummaryLine[] =
    review.support.entries.length === 0 && review.support.custom.length === 0 ? [note("No supplements selected.")] : [];
  for (const entry of review.support.entries) {
    const i = entry.item;
    supportLines.push(
      item(
        `${entry.option.title} — amount: ${i.amount ? `${i.amount}${i.unit ? ` ${i.unit}` : ""}` : NOT_ENTERED} · frequency: ${i.frequency || NOT_ENTERED} · product: ${i.brand || NOT_ENTERED} · started: ${i.startDate || NOT_ENTERED} · evidence: ${EVIDENCE_GRADE_LABEL[entry.grade]} · check: ${SAFETY_LEVEL_LABEL[entry.check.level]}`,
      ),
    );
    for (const reason of entry.check.reasons) supportLines.push({ kind: "detail", text: reason.text });
  }
  /* Supplements the member named themselves belong in front of a clinician too,
     marked for what Reserve does not know about them. */
  for (const entry of review.support.custom) {
    const i = entry.item;
    supportLines.push(
      item(
        `${entry.title} — entered by the member, not in Reserve's library · amount: ${i.amount ? `${i.amount}${i.unit ? ` ${i.unit}` : ""}` : NOT_ENTERED} · frequency: ${i.frequency || NOT_ENTERED} · product: ${i.brand || NOT_ENTERED} · started: ${i.startDate || NOT_ENTERED} · evidence: none reviewed by Reserve · check: ingredients not checked against the member's records`,
      ),
    );
  }
  sections.push({ heading: "SUPPORT PLAN (selected by the member; details exactly as entered)", lines: supportLines });

  const latest = review.checkIn?.latest;
  sections.push({
    heading: "VITALS AND SYMPTOMS (latest check-in)",
    lines: !latest
      ? [note("No check-in logged.")]
      : [
          note(`${latest.date} · BP: ${latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : NOT_ENTERED} · Resting HR: ${latest.restingHr ? `${latest.restingHr} bpm` : NOT_ENTERED} · Sleep: ${latest.sleepHours ? `${latest.sleepHours} h` : NOT_ENTERED}`),
          note(`Symptoms: ${latest.symptoms.length ? latest.symptoms.map((s) => CHECK_IN_SYMPTOMS[s].label).join("; ") : "none entered"}`),
        ],
  });

  const withData = review.trends.filter((t) => t.current);
  const labLines: SummaryLine[] = withData.length === 0 ? [note("No lab results logged.")] : [];
  for (const t of withData) {
    const c = t.current!;
    const flag = c.labFlag ? ` [lab flag: ${LAB_FLAG_LABEL[c.labFlag]}]` : "";
    const baseline = t.baseline && t.baseline !== c ? ` · baseline ${valueWithUnit(t.baseline.valueText, t.unit)} on ${t.baseline.date}` : "";
    labLines.push(item(`${t.label}: ${valueWithUnit(c.valueText, t.unit)}${c.rangeText ? ` (ref ${c.rangeText})` : ""}${flag} on ${c.date}${baseline} — ${MARKER_TREND_STATUS_LABEL[t.status]}`));
  }
  sections.push({ heading: `KEY LABS${review.lastLabDate ? ` (latest draw ${review.lastLabDate})` : ""}`, lines: labLines });

  const moving = review.trends.filter((t) => t.status === "trend" || t.status === "changed" || t.status === "outside-range" || t.status === "clinician-review");
  if (moving.length) {
    sections.push({ heading: "SIGNIFICANT TRENDS (timing only — no cause is implied)", lines: moving.map((t) => item(`${t.label}: ${t.reason}`)) });
  }
  sections.push({
    heading: `PLAN COMPLEXITY: ${COMPLEXITY_LEVEL_LABEL[review.complexity.level]} · ${COMPLEXITY_REVIEW_LABEL[review.complexity.review.state]}`,
    lines: review.complexity.reasons.map(item),
  });
  if (review.gaps.length) sections.push({ heading: "MONITORING GAPS", lines: review.gaps.map(item) });
  if (review.questions.length) {
    sections.push({ heading: "MEMBER QUESTIONS", lines: review.questions.map((q, i) => ({ kind: "numbered" as const, n: i + 1, text: q })) });
  }

  return {
    title: "CYCLE REVIEW — FOR CLINICIAN",
    intro: [`Prepared ${generatedAt.toLocaleString("en-US")} from member-entered records in Reserve. Not a clinical assessment.`],
    sections,
    footer: ["Lab ranges and flags are those printed on the member's own reports. Trends describe timing only; no cause is implied."],
  };
}

export function buildCycleReviewSummary(review: CycleReview, input: CycleReviewInput, generatedAt: Date): string {
  return renderSummaryText(buildCycleReviewSummaryDocument(review, input, generatedAt));
}
