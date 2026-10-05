/* ════════════════════════════════════════════════════════════════════════
   CLINICAL RECORDS — what Bloodwork, Biomarker Cockpit and Enhanced Monitor
   say, reduced to rows.

   The audit (2026-09-16) found about 70% of these three screens was the same
   four enhanced blocks repeated: "Get this reviewed", the cycle context,
   "Commonly watched" (every row repeating the compound name) and a
   17-checkbox symptom check. Each becomes one row here, and the detail moves
   into a sheet. What never moves behind a tap: a flagged result's route to a
   human, red-flag escalations, and 911 / 988.

   THE HARD WALL (CLAUDE.md · constitution clinical-data.md): timing and
   placement only; the range and flag printed on the member's own report;
   trends between the member's own values. Never a condition, a cause, an
   amount, a start / stop / change, "safe", or a protective claim. Every
   fixed string below is scanned by the banned-language suite in
   `__tests__/clinical-records.test.ts`.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { CYCLE_PHASE_LABEL, type CycleState } from "@/lib/cycle/cycle-period";
import { RED_FLAGS } from "@/lib/compound-intelligence/risk-profiles";
import { isOutsideOwnRange, type MarkerTrend } from "@/lib/labs/record-summary";
import { LAB_FLAG_LABEL, isCriticalLabFlag } from "@/lib/labs/types";
import { formatDay } from "@/lib/physique/record-summary";
import { ESCALATION_LABEL } from "@/lib/safety/escalation";

/* ─── Fixed copy ──────────────────────────────────────────────────────── */

export const CLINICAL_COPY = {
  /* Shared rows */
  cycleLabel: "Your cycle",
  watchedLabel: "Commonly watched",
  symptomLabel: "Symptom check",
  symptomQuestion: "Are you having any of these right now?",
  symptomAction: "Check",
  cycleSheetAction: "Details",
  watchedSheetAction: "View",
  openCompoundCommand: "Open Compound Command",
  openBloodwork: "Open Bloodwork Log",
  noProfileLabel: "No profile on file",
  timingNote:
    "These are the dates you entered, shown beside the labs you logged. Reserve describes timing only, never a cause, an amount or a change to make.",
  pastEndNote: "Still marked active in your log past the end date you entered. Worth getting reviewed.",
  sourcesSummary: "Sources · pending clinician review",
  sourcesBody:
    "From published risk profiles for the compounds you logged; sources are listed in Compound Command. A clinician, a telehealth visit or a pharmacist can say whether any of this testing applies to you.",
  noProfileBody:
    "Reserve has no published risk profile to show for these. Nothing is implied by that; a clinician or pharmacist is the source to ask.",
  endsHere: "Every line here is a prompt to talk to a human.",
  emergency: "In an emergency, call 911",
  crisis: "For crisis support, call or text 988",
  contactsLabel: "Emergency contacts",

  /* Bloodwork */
  intakeTitle: "New lab record",
  intakeExplain:
    "Add a PDF, photograph the pages, or paste the rows from your patient portal. You confirm every row, and only those are saved, with the range and flag your report printed.",
  readOnDeviceTitle: "Read on this device",
  readOnDeviceBody: "Lab reports and photos are read here in your browser and never uploaded. Only the results you confirm are saved.",
  labRecordLogged: "Lab record logged",
  labSafetyLead: "Compared with the ranges printed on your reports. A flag is a prompt to get the result reviewed, not a diagnosis.",
  otherResults: "Other results",

  /* Biomarker Cockpit */
  markersLabel: "Your markers",
  markersEmptyHeadline: "No results logged yet",
  markersEmptyBody:
    "Import a lab report or paste your results in the Bloodwork Log. Only the rows you confirm are saved, and those are what appear here, grouped by body system.",
  recordSupport: "Values, ranges and flags come from your own reports. A flag is a prompt to get a result reviewed, never a finding.",
  criticalLine: "If a result was marked critical, or something feels wrong, get care today.",

  /* Enhanced Monitor */
  trackingLine: "Tracking only · Reserve organizes your records and never advises on them.",
  handlesSummary: "How Reserve handles this",
  handlesBody:
    "Entries here are your own records. Reserve does not design a plan, state an amount or a schedule, tell you to start, stop or change anything, or judge a result.",
  handlesLabs:
    "Lab results are compared only with the range printed on your own report. Anything you want explained is a conversation for a clinician, a telehealth visit or a pharmacist.",
} as const;

/** How many warning signs the symptom check lists. */
export const WARNING_SIGN_COUNT = Object.keys(RED_FLAGS).length;

/* ─── Primary actions ─────────────────────────────────────────────────── */

export type ClinicalView = "bloodwork" | "biomarker-intelligence" | "enhanced-monitor";

export type ClinicalPrimary =
  | { label: string; kind: "open-intake" }
  | { label: string; kind: "view"; view: "bloodwork" | "supplements" };

/**
 * The one gold action on each clinical screen. Bloodwork opens its own intake;
 * the Biomarker Cockpit reads what Bloodwork holds, so its way in is there.
 * Enhanced Monitor's comes from `monitorSummary` (lib/enhanced), which picks
 * the log that is actually empty — see `monitorRows`.
 */
export function clinicalPrimary(view: Exclude<ClinicalView, "enhanced-monitor">): ClinicalPrimary {
  return view === "bloodwork"
    ? { label: "New Lab Record", kind: "open-intake" }
    : { label: "Add Lab Record", kind: "view", view: "bloodwork" };
}

/**
 * Index rows for Enhanced Monitor. A row whose control would repeat the gold
 * action exactly (same words, same destination) shows no control of its own:
 * the audit counted "Open Compound Log" three times on one screen.
 */
export function monitorRows<T extends { action: string; destination: string }>(
  lines: readonly T[],
  primary: { label: string; destination: string },
): Array<T & { showAction: boolean }> {
  return lines.map((line) => ({
    ...line,
    showAction: !(line.action === primary.label && line.destination === primary.destination),
  }));
}

/* ─── Biomarker statement ─────────────────────────────────────────────── */

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Latest value sits outside the range the member's own report printed. */
export function trendOutsideRange(trend: MarkerTrend): boolean {
  return isOutsideOwnRange({ name: trend.label, value: trend.latest.value, referenceRange: trend.latest.referenceRange });
}

/**
 * "2 lab records over 67 days · 1 outside your lab's range". A row the lab
 * flagged while its value sat inside the printed range is counted apart, so
 * the statement never calls a flag something the range did not show.
 */
export function biomarkerStatement(input: { recordCount: number; spanDays: number | null; trends: readonly MarkerTrend[] }): string {
  if (input.recordCount === 0) return "No lab records yet";
  const records = plural(input.recordCount, "lab record", "lab records");
  const span = input.spanDays !== null && input.spanDays > 0 ? ` over ${plural(input.spanDays, "day", "days")}` : "";
  const outside = input.trends.filter(trendOutsideRange).length;
  const flagOnly = input.trends.filter((trend) => trend.flagged && !trendOutsideRange(trend)).length;
  const flagged = flagOnly > 0 ? ` · ${flagOnly} flagged by your lab` : "";
  return `${records}${span} · ${outside} outside your lab's range${flagged}`;
}

/* ─── Marker rows ─────────────────────────────────────────────────────── */

function withUnit(value: string, unit?: string): string {
  return unit ? `${value} ${unit}` : value;
}

/** "45 → 52.1 %" — previous to latest, the member's own two numbers. */
export function trendReading(trend: MarkerTrend): string {
  if (!trend.previous) return withUnit(trend.latest.value, trend.latest.unit);
  const sameUnit = (trend.previous.unit ?? "").trim().toLowerCase() === (trend.latest.unit ?? "").trim().toLowerCase();
  const from = sameUnit ? trend.previous.value : withUnit(trend.previous.value, trend.previous.unit);
  return `${from} → ${withUnit(trend.latest.value, trend.latest.unit)}`;
}

/** "Jun 26 → Sep 1", or the one date. */
export function trendDates(trend: MarkerTrend): string {
  return trend.previous ? `${formatDay(trend.previous.date)} → ${formatDay(trend.latest.date)}` : formatDay(trend.latest.date);
}

/** The range as the report printed it. Reserve supplies none. */
export function trendRange(trend: MarkerTrend): string {
  return trend.latest.referenceRange ? `Range on your report ${trend.latest.referenceRange}` : "No range printed on your report";
}

/** The lab's own flag, or the report's range, in the report's own terms. Null when neither raised it. */
export function trendFlag(trend: MarkerTrend): string | null {
  if (trend.latest.labFlag) return `Your lab flagged this ${LAB_FLAG_LABEL[trend.latest.labFlag]}`;
  if (trendOutsideRange(trend)) return "Outside the range on your report";
  return null;
}

/** Where a flagged result goes. Critical carries today's route; the rest, a review. */
export function trendRoute(trend: MarkerTrend): string | null {
  if (!trend.flagged) return null;
  return isCriticalLabFlag(trend.latest.labFlag) ? ESCALATION_LABEL["contact-clinician-today"] : ESCALATION_LABEL["discuss-with-clinician"];
}

/* ─── Cycle row ───────────────────────────────────────────────────────── */

/** "Autumn block · week 6 of 12 · checkpoint Sep 25" — the member's own dates. */
export function cycleRowLine(state: CycleState): string {
  const name = state.cycle.name;
  const phase =
    state.phase === "on-cycle"
      ? `week ${state.weekNumber} of ${state.totalWeeks}`
      : state.phase === "upcoming"
        ? `starts ${formatDay(state.cycle.startDate)}`
        : CYCLE_PHASE_LABEL[state.phase].toLowerCase();
  const checkpoint = state.nextCheckpoint ? ` · checkpoint ${formatDay(state.nextCheckpoint.date)}` : "";
  return `${name} · ${phase}${checkpoint}`;
}

export function noCycleLine(activeCompoundCount: number): string {
  return activeCompoundCount > 0
    ? `${plural(activeCompoundCount, "compound", "compounds")} marked active · no cycle dates recorded`
    : "No cycle dates recorded";
}

/* ─── Commonly watched ────────────────────────────────────────────────── */

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type WatchedGroup = {
  /** Names the compounds once. */
  heading: string;
  markers: Array<{ key: string; label: string; lastTestedOn?: string }>;
};

/**
 * Markers commonly watched for the compounds the member logged, grouped so
 * each compound set is named once as a heading rather than on every row.
 */
export function watchedGroups(
  untested: ReadonlyArray<{ markerKey: string; label: string; compounds: string[]; lastTestedOn?: string }>,
): WatchedGroup[] {
  const groups = new Map<string, WatchedGroup>();
  for (const marker of untested) {
    const names = [...marker.compounds].sort((a, b) => a.localeCompare(b));
    const id = names.join("|");
    if (!groups.has(id)) groups.set(id, { heading: `Commonly watched for ${listNames(names)}`, markers: [] });
    groups.get(id)!.markers.push({ key: marker.markerKey, label: marker.label, lastTestedOn: marker.lastTestedOn });
  }
  return [...groups.values()];
}

export function watchedRowLine(count: number): string {
  return `${plural(count, "marker", "markers")} not in your recent labs`;
}

export function watchedMarkerStatus(marker: { lastTestedOn?: string }): string {
  return marker.lastTestedOn ? `last tested ${formatDay(marker.lastTestedOn)}` : "not found in your labs";
}

/* ─── Symptom row ─────────────────────────────────────────────────────── */

export function symptomRowLine(linkedCount: number, total = WARNING_SIGN_COUNT): string {
  const signs = plural(total, "warning sign", "warning signs");
  return linkedCount > 0 ? `${signs} · ${linkedCount} linked to what you logged` : signs;
}

/* ─── Lab safety ──────────────────────────────────────────────────────── */

/** The lab safety heading. Counts only; no verdict when nothing is flagged. */
export function labSafetyHeading(count: number): string {
  return count === 0 ? "Nothing outside your lab's ranges" : `${plural(count, "result", "results")} to have reviewed`;
}

/**
 * Splits findings so the compounds a group of results is commonly watched for
 * are named once, as a heading. Unlinked findings come last.
 */
export function findingGroups<F extends { linkedCompounds: string[] }>(findings: readonly F[]): Array<{ heading: string; findings: F[] }> {
  const groups = new Map<string, { heading: string; findings: F[] }>();
  for (const finding of findings) {
    const names = [...finding.linkedCompounds].sort((a, b) => a.localeCompare(b));
    const id = names.join("|");
    const heading = names.length > 0 ? `Commonly watched for ${listNames(names)}` : CLINICAL_COPY.otherResults;
    if (!groups.has(id)) groups.set(id, { heading, findings: [] });
    groups.get(id)!.findings.push(finding);
  }
  return [...groups.entries()].sort(([a], [b]) => Number(a === "") - Number(b === "")).map(([, group]) => group);
}

/**
 * The finding reasons a row still needs. Drops the "Commonly watched for …"
 * line the group heading now carries, and the "Above / Below the reference
 * range on your report (…)" line the row's own range and flag already state.
 */
export function findingReasons(reasons: readonly string[]): string[] {
  return reasons.filter((reason) => !reason.startsWith("Commonly watched for ") && !/^(Above|Below) the reference range on /.test(reason));
}

/**
 * 911 / 988 must be on screen whenever a warning sign was reported or a lab
 * marked a result critical. Callers may show it more often; never less.
 */
export function needsEmergencyLine(input: { criticalLabCount: number; recentRedFlagCount: number }): boolean {
  return input.criticalLabCount > 0 || input.recentRedFlagCount > 0;
}
