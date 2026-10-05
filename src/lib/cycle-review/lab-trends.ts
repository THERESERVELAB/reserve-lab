/* ════════════════════════════════════════════════════════════════════════
   LAB TRENDS AGAINST THE CYCLE — baseline, current and the path between,
   laid over the member's own timeline.

   For each marker Reserve follows during a cycle it shows:
     baseline  the latest draw before the cycle started
     current   the most recent draw
     trend     every draw in order, beside cycle start, compound additions and
               pauses, and the end

   A change is described as happening "during the same period" as the cycle.
   Reserve never says a compound caused it. Ranges and flags always come from
   the member's own report (see lab-safety.ts).
   ════════════════════════════════════════════════════════════════════════ */

import { BURDENS, type BurdenKey } from "@/lib/compound-intelligence/burdens";
import { addDays, daysBetween, isDateKey, type CyclePeriod } from "@/lib/cycle/cycle-period";
import type { LabSafetyBrief, MarkerReading } from "@/lib/labs/lab-safety";
import { isMarkerKey, markerDef, type MarkerKey } from "@/lib/labs/markers";

/** The markers the cycle review follows, in reading order. */
export const REVIEW_MARKERS: MarkerKey[] = [
  "hematocrit", "hemoglobin", "rbc", "platelets",
  "apob", "ldl", "hdl", "triglycerides", "total-cholesterol",
  "alt", "ast", "bilirubin",
  "creatinine", "egfr",
  "glucose", "hba1c", "insulin",
  "total-testosterone", "free-testosterone", "estradiol", "shbg", "prolactin", "lh", "fsh",
  "psa",
];

/**
 * The direction of change these markers are commonly watched for. "both"
 * means any sizeable move is worth noting. Used only to separate "changed"
 * from "trend worth reviewing" — never shown as a verdict.
 */
const WATCHED_DIRECTION: Partial<Record<MarkerKey, "up" | "down" | "both">> = {
  hematocrit: "up", hemoglobin: "up", rbc: "up", platelets: "both",
  apob: "up", ldl: "up", hdl: "down", triglycerides: "up", "total-cholesterol": "up",
  alt: "up", ast: "up", bilirubin: "up",
  creatinine: "up", egfr: "down",
  glucose: "up", hba1c: "up", insulin: "up",
  "total-testosterone": "both", "free-testosterone": "both", estradiol: "both", shbg: "both", prolactin: "up", lh: "both", fsh: "both",
  psa: "up",
};

/** A move this large, in either direction, counts as a change. */
export const CHANGE_PCT = 10;
/** A draw up to this long before the cycle started counts as its baseline. */
export const BASELINE_LOOKBACK_DAYS = 180;

export type MarkerTrendStatus = "no-data" | "inside-range" | "at-baseline" | "changed" | "trend" | "outside-range" | "clinician-review";

export const MARKER_TREND_STATUS_LABEL: Record<MarkerTrendStatus, string> = {
  "no-data": "Evidence needed",
  "inside-range": "Inside your lab's range",
  "at-baseline": "Near your baseline",
  changed: "Changed",
  trend: "Trend worth reviewing",
  "outside-range": "Outside your lab's range",
  "clinician-review": "Get this reviewed",
};

export type TrendPoint = {
  date: string;
  value: number | null;
  valueText: string;
  unit?: string;
  rangeText?: string;
  position: MarkerReading["position"];
  labFlag?: MarkerReading["labFlag"];
};

export type MarkerTrend = {
  key: MarkerKey;
  label: string;
  unit?: string;
  /** Oldest first. Only draws in the latest unit, so values are comparable. */
  points: TrendPoint[];
  baseline?: TrendPoint;
  current?: TrendPoint;
  changeFromBaselinePct?: number;
  status: MarkerTrendStatus;
  reason: string;
  /** Logged compounds this marker is commonly watched for. */
  linkedCompounds: string[];
  burdens: BurdenKey[];
};

export type TimelineEventKind = "cycle-start" | "compound-added" | "compound-paused" | "planned-end" | "cycle-ended";

export type TimelineEvent = { date: string; kind: TimelineEventKind; label: string };

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sameUnit(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function toPoint(reading: MarkerReading): TrendPoint {
  return {
    date: reading.date,
    value: reading.value && !reading.value.comparator ? reading.value.value : null,
    valueText: reading.valueText,
    unit: reading.unit,
    rangeText: reading.rangeText,
    position: reading.position,
    labFlag: reading.labFlag,
  };
}

function pctChange(from?: TrendPoint, to?: TrendPoint): number | undefined {
  if (from?.value == null || to?.value == null || from.value === 0) return undefined;
  return ((to.value - from.value) / Math.abs(from.value)) * 100;
}

function inWatchedDirection(key: MarkerKey, pct: number): boolean {
  const direction = WATCHED_DIRECTION[key] ?? "both";
  return direction === "both" || (direction === "up" ? pct > 0 : pct < 0);
}

export function formatLabValue(valueText: string, unit?: string): string {
  if (!unit) return valueText;
  return unit.trim() === "%" ? `${valueText}%` : `${valueText} ${unit}`;
}

function withUnit(point: TrendPoint): string {
  return formatLabValue(point.valueText, point.unit);
}

/** Three or more comparable draws, each moving the same way. */
function steadyRun(points: TrendPoint[]): { direction: "up" | "down"; pct: number } | null {
  const tail = points.filter((p) => p.value != null).slice(-3);
  if (tail.length < 3) return null;
  const up = tail.every((p, i) => i === 0 || p.value! > tail[i - 1].value!);
  const down = tail.every((p, i) => i === 0 || p.value! < tail[i - 1].value!);
  if (!up && !down) return null;
  const pct = pctChange(tail[0], tail[2]);
  return pct === undefined ? null : { direction: up ? "up" : "down", pct };
}

const MARKER_BURDENS: Partial<Record<MarkerKey, BurdenKey[]>> = {};
for (const def of Object.values(BURDENS)) {
  for (const marker of def.markers) (MARKER_BURDENS[marker] ??= []).push(def.key);
}

/**
 * The markers a review follows when no list is given: the ones the cycle
 * review always reports on, every marker a compound burden is watched by,
 * and every marker the member has actually logged. Without the last two, a
 * result the member logged outside REVIEW_MARKERS would have no trend, and
 * the support options that name it could never explain themselves.
 */
export function defaultTrendMarkers(labBrief: LabSafetyBrief): MarkerKey[] {
  const logged = Object.keys(labBrief.history).filter((id): id is MarkerKey => isMarkerKey(id));
  return [...new Set<MarkerKey>([...REVIEW_MARKERS, ...(Object.keys(MARKER_BURDENS) as MarkerKey[]), ...logged])];
}

export function buildMarkerTrends(input: {
  labBrief: LabSafetyBrief;
  cycle: Pick<CyclePeriod, "startDate"> | null;
  markerLinks: Partial<Record<MarkerKey, string[]>>;
  markers?: MarkerKey[];
}): MarkerTrend[] {
  const { labBrief, cycle, markerLinks } = input;
  const findings = new Map(labBrief.findings.map((finding) => [finding.id, finding]));
  const start = cycle && isDateKey(cycle.startDate) ? cycle.startDate : null;

  return (input.markers ?? defaultTrendMarkers(labBrief)).map((key): MarkerTrend => {
    const label = markerDef(key).label;
    const linkedCompounds = markerLinks[key] ?? [];
    const burdens = MARKER_BURDENS[key] ?? [];
    const history = labBrief.history[key] ?? [];
    if (history.length === 0) {
      return { key, label, points: [], status: "no-data", reason: "No result logged yet.", linkedCompounds, burdens };
    }

    const latestUnit = history[0].unit;
    const points = history.filter((r) => sameUnit(r.unit, latestUnit)).map(toPoint).reverse();
    const current = points.at(-1)!;
    const baseline = start
      ? [...points].reverse().find((p) => p.date <= start && daysBetween(p.date, start) <= BASELINE_LOOKBACK_DAYS)
      : undefined;
    const changeFromBaselinePct = baseline && baseline !== current ? pctChange(baseline, current) : undefined;
    const base = { key, label, unit: latestUnit, points, baseline, current, changeFromBaselinePct, linkedCompounds, burdens };
    const duringCycle = start !== null && current.date >= start;
    const period = duringCycle ? " This change occurred during the same period as your cycle." : "";
    const hasBaselineMove = Boolean(baseline && changeFromBaselinePct !== undefined && baseline !== current);
    const baselineMove = hasBaselineMove
      ? `${changeFromBaselinePct! > 0 ? "Up" : "Down"} ${Math.round(Math.abs(changeFromBaselinePct!))}% from your baseline on ${formatDate(baseline!.date)} (${withUnit(baseline!)} → ${withUnit(current)}).`
      : "";

    const finding = findings.get(key);
    if (finding?.tier === "urgent") {
      return { ...base, status: "clinician-review", reason: finding.reasons[0] ?? "The lab marked this result critical." };
    }
    if (finding?.tier === "discuss") {
      return { ...base, status: "outside-range", reason: finding.reasons[0] ?? "Outside the range on your report." };
    }
    if (finding?.tier === "watch") {
      /* Read from the pre-cycle baseline when there is one, so the reason and the "from" value agree. */
      const limit = finding.reasons[0]?.match(/near the (top|bottom) of your lab's range/)?.[1];
      const reason = hasBaselineMove
        ? `${baselineMove}${limit ? ` Now near the ${limit} of your lab's range.` : ""}${period}`
        : `${finding.reasons[0] ?? "Moving toward the edge of your lab's range."}${period}`;
      return { ...base, status: "trend", reason };
    }

    if (hasBaselineMove) {
      const size = Math.abs(changeFromBaselinePct!);
      if (size >= CHANGE_PCT) {
        const move = baselineMove;
        const watched = inWatchedDirection(key, changeFromBaselinePct!) && (linkedCompounds.length > 0 || points.length >= 3);
        return { ...base, status: watched ? "trend" : "changed", reason: `${move}${period}` };
      }
      return { ...base, status: "at-baseline", reason: `Within ${CHANGE_PCT}% of your baseline on ${formatDate(baseline!.date)}.` };
    }

    const run = steadyRun(points);
    if (run && Math.abs(run.pct) >= CHANGE_PCT && inWatchedDirection(key, run.pct)) {
      return {
        ...base,
        status: "trend",
        reason: `${run.direction === "up" ? "Rose" : "Fell"} across your last three draws, ${Math.round(Math.abs(run.pct))}% in total.${period}`,
      };
    }
    if (current.position === "within") {
      return { ...base, status: "inside-range", reason: `Inside the range on your ${formatDate(current.date)} report.` };
    }
    return { ...base, status: "inside-range", reason: `Logged ${formatDate(current.date)}. No printed range to compare against.` };
  });
}

export type TimelineCompound = { id: string; name: string; startDate?: string; pausedAt?: string };

/** Cycle start, compound additions and pauses, and the end — oldest first. */
export function buildCycleTimeline(cycle: CyclePeriod, compounds: TimelineCompound[]): TimelineEvent[] {
  const events: TimelineEvent[] = [{ date: cycle.startDate, kind: "cycle-start", label: `${cycle.name} started` }];
  const linked = compounds.filter((c) => cycle.compoundIds.includes(c.id));
  for (const compound of linked) {
    if (compound.startDate && isDateKey(compound.startDate) && compound.startDate > cycle.startDate) {
      events.push({ date: compound.startDate, kind: "compound-added", label: `${compound.name} added` });
    }
    const paused = compound.pausedAt?.slice(0, 10);
    if (paused && isDateKey(paused) && paused >= cycle.startDate) {
      events.push({ date: paused, kind: "compound-paused", label: `${compound.name} paused` });
    }
  }
  events.push({ date: addDays(cycle.startDate, cycle.plannedWeeks * 7 - 1), kind: "planned-end", label: "Planned end" });
  if (cycle.endedOn) events.push({ date: cycle.endedOn, kind: "cycle-ended", label: "Cycle ended" });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
