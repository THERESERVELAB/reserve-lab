/* ════════════════════════════════════════════════════════════════════════
   LAB SAFETY — flag, trend and connect a member's own lab results.

   What it does:
     · compares each result to the reference range printed on the member's
       report, and carries the lab's own flag
     · follows each marker across draws
     · connects a flagged marker to the logged compounds it is commonly
       watched for
     · notices markers commonly watched for those compounds that are missing
       from recent labs

   What it never does: diagnose, name a condition, say what caused a result,
   or say what to change. Every finding routes to the member's clinician.

   Tiers are deliberately conservative prompts, not a clinical assessment:
     urgent  — the lab itself marked the result critical
     discuss — outside the report's range, or flagged by the lab
     watch   — inside the range, near a limit, and moving toward it
   ════════════════════════════════════════════════════════════════════════ */

import { daysBetween, dateKeyOf, isDateKey } from "@/lib/cycle/cycle-period";

import { isMarkerKey, markerDef, matchMarker, normalizeMarkerName, type MarkerKey } from "./markers";
import {
  nearLimit,
  parseLabValue,
  parseReferenceRange,
  positionInRange,
  type ParsedRange,
  type ParsedValue,
  type RangePosition,
} from "./reference-range";
import { isCriticalLabFlag, LAB_FLAG_LABEL, type LabFlag } from "./types";

export type LabRecordInput = {
  id: string;
  testDate: string;
  labName?: string;
  createdAt?: string;
  markers?: Array<{
    name: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    labFlag?: LabFlag;
    markerKey?: string;
  }>;
};

export type MarkerReading = {
  recordId: string;
  date: string;
  name: string;
  markerKey?: MarkerKey;
  valueText: string;
  value: ParsedValue | null;
  unit?: string;
  rangeText?: string;
  range: ParsedRange | null;
  labFlag?: LabFlag;
  position: RangePosition;
  labName?: string;
};

export type FindingTier = "urgent" | "discuss" | "watch";

export type LabFinding = {
  id: string;
  markerKey?: MarkerKey;
  label: string;
  tier: FindingTier;
  latest: MarkerReading;
  previous?: MarkerReading;
  changePct?: number;
  reasons: string[];
  linkedCompounds: string[];
};

export type UntestedMarker = {
  markerKey: MarkerKey;
  label: string;
  compounds: string[];
  lastTestedOn?: string;
};

export type LabSafetyBrief = {
  findings: LabFinding[];
  /** Latest readings with nothing to flag. */
  clearCount: number;
  latestLabDate?: string;
  untested: UntestedMarker[];
  /** Every reading for each marker, newest first — for trend views. */
  history: Record<string, MarkerReading[]>;
};

/** Markers not seen in this many days count as missing from recent labs. */
export const RECENT_LAB_WINDOW_DAYS = 180;
/** A within-range move of at least this much toward a limit earns "watch". */
export const WATCH_CHANGE_PCT = 10;

const TIER_ORDER: Record<FindingTier, number> = { urgent: 0, discuss: 1, watch: 2 };

function readingId(key: MarkerKey | undefined, name: string): string {
  return key ?? `name:${normalizeMarkerName(name)}`;
}

function sameUnit(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function rangeWithUnit(reading: MarkerReading): string {
  return `${reading.rangeText}${reading.unit ? ` ${reading.unit}` : ""}`;
}

function toReadings(records: LabRecordInput[]): MarkerReading[] {
  const readings: MarkerReading[] = [];
  for (const record of records) {
    if (!isDateKey(record.testDate)) continue;
    for (const marker of record.markers ?? []) {
      if (!marker.name?.trim() || !marker.value?.trim()) continue;
      const markerKey = isMarkerKey(marker.markerKey) ? marker.markerKey : matchMarker(marker.name)?.key;
      const value = parseLabValue(marker.value);
      const range = parseReferenceRange(marker.referenceRange);
      readings.push({
        recordId: record.id,
        date: record.testDate,
        name: marker.name.trim(),
        markerKey,
        valueText: marker.value.trim(),
        value,
        unit: marker.unit?.trim() || undefined,
        rangeText: marker.referenceRange?.trim() || undefined,
        range,
        labFlag: marker.labFlag,
        position: positionInRange(value, range),
        labName: record.labName,
      });
    }
  }
  return readings;
}

function evaluate(
  readings: MarkerReading[],
  linkedCompounds: string[],
): Omit<LabFinding, "id" | "label" | "markerKey" | "linkedCompounds"> | null {
  const [latest, ...older] = readings;
  const previous = older.find((reading) => sameUnit(reading.unit, latest.unit) && reading.value && !reading.value.comparator);
  const changePct =
    previous?.value && latest.value && !latest.value.comparator && previous.value.value !== 0
      ? ((latest.value.value - previous.value.value) / Math.abs(previous.value.value)) * 100
      : undefined;
  const reasons: string[] = [];
  const lab = latest.labName ? `your ${latest.labName} report` : "your report";

  let tier: FindingTier | null = null;
  if (isCriticalLabFlag(latest.labFlag)) {
    tier = "urgent";
    reasons.push(`The lab marked this result ${LAB_FLAG_LABEL[latest.labFlag!].toLowerCase()}.`);
  }
  if (latest.position === "above" || latest.position === "below") {
    tier = tier ?? "discuss";
    reasons.push(`${latest.position === "above" ? "Above" : "Below"} the reference range on ${lab} (${rangeWithUnit(latest)}).`);
  } else if (!tier && latest.labFlag && latest.position === "unknown") {
    tier = "discuss";
    reasons.push(`The lab flagged this result as ${LAB_FLAG_LABEL[latest.labFlag].toLowerCase()}.`);
  } else if (!tier && latest.position === "within" && previous && changePct !== undefined) {
    const limit = nearLimit(latest.value, latest.range);
    const towardLimit = (limit === "high" && changePct >= WATCH_CHANGE_PCT) || (limit === "low" && changePct <= -WATCH_CHANGE_PCT);
    if (towardLimit) {
      tier = "watch";
      reasons.push(
        `${changePct > 0 ? "Up" : "Down"} ${Math.round(Math.abs(changePct))}% since ${formatDate(previous.date)}, now near the ${limit === "high" ? "top" : "bottom"} of your lab's range.`,
      );
    }
  }
  if (!tier) return null;

  if (linkedCompounds.length > 0) {
    reasons.push(`Commonly watched for ${linkedCompounds.join(", ")}, which you logged.`);
  }
  return { tier, latest, previous, changePct, reasons };
}

export function buildLabSafetyBrief(input: {
  records: LabRecordInput[];
  markerLinks?: Partial<Record<MarkerKey, string[]>>;
  now: Date;
}): LabSafetyBrief {
  const links = input.markerLinks ?? {};
  const readings = toReadings(input.records);

  const history: Record<string, MarkerReading[]> = {};
  for (const reading of readings) {
    const id = readingId(reading.markerKey, reading.name);
    (history[id] ??= []).push(reading);
  }
  for (const list of Object.values(history)) {
    list.sort((a, b) => b.date.localeCompare(a.date));
  }

  const findings: LabFinding[] = [];
  let clearCount = 0;
  for (const [id, list] of Object.entries(history)) {
    const markerKey = list[0].markerKey;
    const linkedCompounds = markerKey ? links[markerKey] ?? [] : [];
    const result = evaluate(list, linkedCompounds);
    if (!result) {
      clearCount += 1;
      continue;
    }
    findings.push({
      id,
      markerKey,
      label: markerKey ? markerDef(markerKey).label : list[0].name,
      linkedCompounds,
      ...result,
    });
  }
  findings.sort(
    (a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      Number(b.linkedCompounds.length > 0) - Number(a.linkedCompounds.length > 0) ||
      a.label.localeCompare(b.label),
  );

  const today = dateKeyOf(input.now);
  const untested: UntestedMarker[] = [];
  for (const [key, compounds] of Object.entries(links) as Array<[MarkerKey, string[]]>) {
    if (!compounds?.length) continue;
    const lastTestedOn = history[key]?.[0]?.date;
    if (lastTestedOn && daysBetween(lastTestedOn, today) <= RECENT_LAB_WINDOW_DAYS) continue;
    untested.push({ markerKey: key, label: markerDef(key).label, compounds, lastTestedOn });
  }
  untested.sort((a, b) => b.compounds.length - a.compounds.length || a.label.localeCompare(b.label));

  const latestLabDate = readings.map((r) => r.date).sort().at(-1);
  return { findings, clearCount, latestLabDate, untested, history };
}
