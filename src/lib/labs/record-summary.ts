/* ════════════════════════════════════════════════════════════════════════
   LAB RECORD SUMMARY — what the Bloodwork and Biomarker screens say.

   THE HARD WALL (CLAUDE.md compliance · constitution clinical-data.md):
   this module organizes the member's own lab records and nothing more.

     · A result is compared ONLY with the reference range printed on that
       member's own report, and it carries the flag the LAB printed. Reserve
       supplies no range of its own and renders no verdict.
     · A change between two of the member's draws is described as direction
       and timing ("rose 4.1 since Jun 26"), never as a cause, never as a
       condition, and never as something to do about it.
     · Nothing here names a condition, interprets a value, clears a member,
       or suggests starting, stopping or changing anything.

   Every string this module can produce ends up on a clinical surface, so it
   uses only the approved vocabulary: logged · outside the range on your
   report · the lab flagged · review with your clinician · evidence needed.

   Pure: no React, no store. Inputs are structural so this stays out of the
   store's module graph (the same reason `labs/types.ts` is dependency-free).
   ════════════════════════════════════════════════════════════════════════ */

import { formatDay, daysApart, evidenceLine, type Direction, type Evidence } from "@/lib/physique/record-summary";

import { matchMarker, markerDef, isMarkerKey, MARKER_SYSTEM_LABEL, type MarkerKey } from "./markers";
import { parseLabValue, parseReferenceRange, positionInRange } from "./reference-range";
import { LAB_FLAG_LABEL, type LabFlag } from "./types";

/** The shape of a stored marker row. Structural, so the store need not be imported. */
export type MarkerRow = {
  name: string;
  value: string;
  unit?: string;
  /** Exactly as printed on the member's report. */
  referenceRange?: string;
  /** The flag the LAB printed. Reserve never invents one. */
  labFlag?: LabFlag;
  markerKey?: string;
};

export type LabRecord = {
  id: string;
  /** YYYY-MM-DD */
  testDate: string;
  labName?: string;
  notes?: string;
  markers?: MarkerRow[];
};

/* ─── Flagging ────────────────────────────────────────────────────────────
   One definition, shared by every lab surface: a row is worth raising when
   the member's own lab flagged it, or when it sits outside the range that
   report printed. Reserve adds no third reason of its own. */

export function isOutsideOwnRange(row: MarkerRow): boolean {
  const position = positionInRange(parseLabValue(row.value), parseReferenceRange(row.referenceRange));
  return position === "above" || position === "below";
}

export function isFlaggedRow(row: MarkerRow): boolean {
  return Boolean(row.labFlag) || isOutsideOwnRange(row);
}

/** Why this row is raised, in the report's own terms. Never Reserve's judgement. */
export function flagReason(row: MarkerRow): string | null {
  if (row.labFlag) return `Your lab flagged this ${LAB_FLAG_LABEL[row.labFlag]}`;
  if (isOutsideOwnRange(row)) {
    return row.referenceRange
      ? `Outside the range printed on your report (${row.referenceRange})`
      : "Outside the range printed on your report";
  }
  return null;
}

export function markerKeyOf(row: MarkerRow): MarkerKey | undefined {
  if (isMarkerKey(row.markerKey)) return row.markerKey;
  return matchMarker(row.name)?.key;
}

export function panelLabel(key: MarkerKey | undefined): string {
  return key ? MARKER_SYSTEM_LABEL[markerDef(key).system] : "Not recognized";
}

/* ─── Record summary ─────────────────────────────────────────────────────── */

export type LabSummary = {
  recordCount: number;
  newest: LabRecord | null;
  oldest: LabRecord | null;
  /** Results on the newest record. */
  newestResultCount: number;
  /** Results on the newest record that carry the lab's flag or sit outside its printed range. */
  newestFlaggedCount: number;
  /** Every result the member has logged, across records. */
  totalResultCount: number;
  spanDays: number | null;
  /** The one plain-language line the screen is designed around. */
  statement: string;
  /** Newest-first. */
  history: LabRecord[];
};

export function labSummary(records: readonly LabRecord[]): LabSummary {
  const ascending = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
  const newest = ascending[ascending.length - 1] ?? null;
  const oldest = ascending[0] ?? null;
  const newestRows = newest?.markers ?? [];

  return {
    recordCount: ascending.length,
    newest,
    oldest,
    newestResultCount: newestRows.length,
    newestFlaggedCount: newestRows.filter(isFlaggedRow).length,
    totalResultCount: ascending.reduce((sum, record) => sum + (record.markers?.length ?? 0), 0),
    spanDays: newest && oldest && newest.id !== oldest.id ? daysApart(oldest.testDate, newest.testDate) : null,
    statement: newest
      ? `Last lab record ${formatDay(newest.testDate)}${newest.labName ? ` · ${newest.labName}` : ""}`
      : "No lab records yet",
    history: [...ascending].reverse(),
  };
}

export function labEvidence(records: readonly LabRecord[]): Evidence {
  const ascending = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));
  return evidenceLine({
    count: ascending.length,
    firstDate: ascending[0]?.testDate ?? null,
    lastDate: ascending[ascending.length - 1]?.testDate ?? null,
    noun: "lab record",
  });
}

/* ─── Marker trends ───────────────────────────────────────────────────────
   A marker the member has logged on two or more dated draws. The trend is
   the direction between their own numbers and the days between them. It is
   not a rate, not a projection, and it is never called good or bad. */

export type MarkerTrend = {
  key: MarkerKey | null;
  /** The name as the member's report wrote it. */
  label: string;
  panel: string;
  latest: { value: string; unit?: string; date: string; referenceRange?: string; labFlag?: LabFlag };
  previous: { value: string; unit?: string; date: string } | null;
  /** Only when both draws parsed to a number. */
  delta: number | null;
  direction: Direction | null;
  daysBetween: number | null;
  flagged: boolean;
  reason: string | null;
};

/**
 * One trend per marker, newest draw first. Records are grouped by the
 * canonical marker key where the name was recognized, and by the name the
 * member typed where it was not — so an unrecognized test still trends
 * against itself rather than being dropped.
 */
export function markerTrends(records: readonly LabRecord[]): MarkerTrend[] {
  const ascending = [...records].sort((a, b) => a.testDate.localeCompare(b.testDate));

  type Reading = { row: MarkerRow; date: string };
  const byMarker = new Map<string, Reading[]>();
  const keyOrder: string[] = [];

  for (const record of ascending) {
    for (const row of record.markers ?? []) {
      if (!row.name.trim() || !row.value.trim()) continue;
      const canonical = markerKeyOf(row);
      const groupKey = canonical ?? `name:${row.name.trim().toLowerCase()}`;
      if (!byMarker.has(groupKey)) {
        byMarker.set(groupKey, []);
        keyOrder.push(groupKey);
      }
      byMarker.get(groupKey)!.push({ row, date: record.testDate });
    }
  }

  const trends: MarkerTrend[] = keyOrder.map((groupKey) => {
    const readings = byMarker.get(groupKey)!;
    const latest = readings[readings.length - 1];
    const previous = readings.length > 1 ? readings[readings.length - 2] : null;
    const canonical = markerKeyOf(latest.row) ?? null;

    const latestNumber = parseLabValue(latest.row.value)?.value ?? null;
    const previousNumber = previous ? (parseLabValue(previous.row.value)?.value ?? null) : null;
    const delta =
      latestNumber !== null && previousNumber !== null ? Number((latestNumber - previousNumber).toFixed(2)) : null;

    return {
      key: canonical,
      label: canonical ? markerDef(canonical).label : latest.row.name.trim(),
      panel: panelLabel(canonical ?? undefined),
      latest: {
        value: latest.row.value,
        unit: latest.row.unit,
        date: latest.date,
        referenceRange: latest.row.referenceRange,
        labFlag: latest.row.labFlag,
      },
      previous: previous ? { value: previous.row.value, unit: previous.row.unit, date: previous.date } : null,
      delta,
      direction: delta === null ? null : delta > 0 ? "rising" : delta < 0 ? "falling" : "steady",
      daysBetween: previous ? daysApart(previous.date, latest.date) : null,
      flagged: isFlaggedRow(latest.row),
      reason: flagReason(latest.row),
    };
  });

  /* Flagged first — the member's own lab already said these are worth a
     conversation — then the rest, each alphabetical inside its group. */
  return trends.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/** Trends grouped by the panel a marker belongs to, panels in marker order. */
export function trendsByPanel(trends: readonly MarkerTrend[]): Array<{ panel: string; trends: MarkerTrend[] }> {
  const order = [...new Set(Object.values(MARKER_SYSTEM_LABEL)), "Not recognized"];
  const grouped = new Map<string, MarkerTrend[]>();
  for (const trend of trends) {
    grouped.set(trend.panel, [...(grouped.get(trend.panel) ?? []), trend]);
  }
  return order.filter((panel) => grouped.has(panel)).map((panel) => ({ panel, trends: grouped.get(panel)! }));
}

/**
 * How the member's own number moved between their own draws. Timing only —
 * "during the same period" is as close to a cause as Reserve ever gets, and
 * that sentence belongs to the cycle surfaces, not here.
 */
export function trendSentence(trend: MarkerTrend): string | null {
  if (!trend.previous || trend.delta === null || trend.direction === null || trend.direction === "steady") return null;
  const moved = trend.direction === "rising" ? "Up" : "Down";
  return `${moved} ${Math.abs(trend.delta)} from ${trend.previous.value} on ${formatDay(trend.previous.date)}`;
}
