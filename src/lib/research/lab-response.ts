/* ════════════════════════════════════════════════════════════════════════
   LAB RESPONSE — one marker's results over time, with the member's plan
   changes, cycles and check-ins placed on the same dates.

   Placement only: no correlation, no windows, no "since". The one number
   Reserve works out is the change from the previous result.
   ════════════════════════════════════════════════════════════════════════ */

import { daysBetween, isDateKey, type CyclePeriod } from "@/lib/cycle/cycle-period";
import type { CycleCheckIn } from "@/lib/cycle-review/types";
import type { ChangeEvent } from "@/lib/history/change-events";
import { changeEventDetails, changeEventTitle } from "@/lib/history/summaries";
import type { LabFinding, LabSafetyBrief, MarkerReading } from "@/lib/labs/lab-safety";
import { isMarkerKey, markerDef } from "@/lib/labs/markers";

/** Events this many days either side of the first and last result still show. */
export const EVENT_PADDING_DAYS = 30;

export type LabMarkerOption = { id: string; label: string; readings: number; latestDate: string };

export type ResponsePoint = {
  recordId: string;
  date: string;
  /** Null when the result is not a plain number ("<5", "negative"). */
  value: number | null;
  valueText: string;
  unit?: string;
  rangeText?: string;
  low?: number;
  high?: number;
  labFlag?: MarkerReading["labFlag"];
  position: MarkerReading["position"];
  labName?: string;
};

export type ResponseEventKind = "change" | "cycle-start" | "cycle-end" | "check-in";

export type ResponseEvent = { id: string; date: string; kind: ResponseEventKind; label: string; details: string[] };

export type LabResponse = {
  id: string;
  label: string;
  unit?: string;
  /** Results in the latest unit, oldest first — the ones drawn. */
  points: ResponsePoint[];
  /** Results in any other unit, oldest first — listed, never drawn. */
  otherUnit: ResponsePoint[];
  /** The range printed on the latest report. */
  range?: { low?: number; high?: number; text: string };
  changeFromPrevious?: { from: ResponsePoint; to: ResponsePoint; delta: number; pct?: number };
  /** Oldest first. */
  events: ResponseEvent[];
  findings: LabFinding[];
};

function labelFor(id: string, readings: MarkerReading[]): string {
  return isMarkerKey(id) ? markerDef(id).label : readings[0]?.name ?? id;
}

function sameUnit(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function toPoint(reading: MarkerReading): ResponsePoint {
  return {
    recordId: reading.recordId,
    date: reading.date,
    value: reading.value && !reading.value.comparator ? reading.value.value : null,
    valueText: reading.valueText,
    unit: reading.unit,
    rangeText: reading.rangeText,
    low: reading.range?.low,
    high: reading.range?.high,
    labFlag: reading.labFlag,
    position: reading.position,
    labName: reading.labName,
  };
}

/** Every marker the member has logged, alphabetical. */
export function listLabMarkers(labBrief: LabSafetyBrief): LabMarkerOption[] {
  return Object.entries(labBrief.history)
    .filter(([, readings]) => readings.length > 0)
    .map(([id, readings]) => ({ id, label: labelFor(id, readings), readings: readings.length, latestDate: readings[0].date }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function checkInDetails(checkIn: CycleCheckIn): string[] {
  const details: string[] = [];
  if (checkIn.systolic && checkIn.diastolic) details.push(`Blood pressure ${checkIn.systolic}/${checkIn.diastolic}`);
  if (checkIn.restingHr) details.push(`Resting heart rate ${checkIn.restingHr} bpm`);
  if (checkIn.bodyweightLb) details.push(`Weight ${checkIn.bodyweightLb} lb`);
  return details;
}

export function buildLabResponse(input: {
  labBrief: LabSafetyBrief;
  markerId: string;
  changeHistory: ChangeEvent[];
  cycles: CyclePeriod[];
  checkIns: CycleCheckIn[];
}): LabResponse | null {
  const history = input.labBrief.history[input.markerId] ?? [];
  if (history.length === 0) return null;

  const latest = history[0];
  const points = history.filter((r) => sameUnit(r.unit, latest.unit)).map(toPoint).reverse();
  const otherUnit = history.filter((r) => !sameUnit(r.unit, latest.unit)).map(toPoint).reverse();

  const current = points.at(-1)!;
  const numeric = points.filter((p) => p.value != null);
  let changeFromPrevious: LabResponse["changeFromPrevious"];
  if (current.value != null && numeric.length >= 2) {
    const from = numeric.at(-2)!;
    const delta = current.value - from.value!;
    changeFromPrevious = { from, to: current, delta, pct: from.value !== 0 ? (delta / Math.abs(from.value!)) * 100 : undefined };
  }

  const first = history.at(-1)!.date;
  const last = latest.date;
  const inWindow = (date: string) =>
    isDateKey(date) && daysBetween(date, first) <= EVENT_PADDING_DAYS && daysBetween(last, date) <= EVENT_PADDING_DAYS;

  const events: ResponseEvent[] = [
    ...input.changeHistory.map((event) => ({
      id: `change-${event.id}`,
      date: event.date,
      kind: "change" as const,
      label: changeEventTitle(event),
      details: changeEventDetails(event),
    })),
    ...input.cycles.flatMap((cycle) => [
      { id: `cycle-start-${cycle.id}`, date: cycle.startDate, kind: "cycle-start" as const, label: `Started ${cycle.name}`, details: [] },
      ...(cycle.endedOn ? [{ id: `cycle-end-${cycle.id}`, date: cycle.endedOn, kind: "cycle-end" as const, label: `Ended ${cycle.name}`, details: [] }] : []),
    ]),
    ...input.checkIns
      .map((checkIn) => ({ id: `check-in-${checkIn.id}`, date: checkIn.date, kind: "check-in" as const, label: "Check-in", details: checkInDetails(checkIn) }))
      .filter((event) => event.details.length > 0),
  ]
    .filter((event) => inWindow(event.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: input.markerId,
    label: labelFor(input.markerId, history),
    unit: latest.unit,
    points,
    otherUnit,
    range: latest.range ? { low: latest.range.low, high: latest.range.high, text: latest.range.text } : latest.rangeText ? { text: latest.rangeText } : undefined,
    changeFromPrevious,
    events,
    findings: input.labBrief.findings.filter((finding) => finding.id === input.markerId),
  };
}
