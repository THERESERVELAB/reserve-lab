/* ════════════════════════════════════════════════════════════════════════
   PHYSIQUE RECORD SUMMARY — what the record and physique screens say.

   These screens are evidence surfaces (DESIGN_BIBLE §02): they show the
   member's own dated entries and the change between them, and nothing else.
   There is no score, no projection, no estimate of body composition, and no
   reading of a photograph. Where there is no entry, the statement says so
   and names the log that would fill it.

   Every value returned here traces to a member-entered field. Nothing is
   interpolated, and no direction carries a verdict — "waist down 1.1 in"
   is a fact; "good progress" is an opinion about a body, which §02 forbids.

   Pure: no React, no store, no clock of its own — `now` is passed in so the
   caller controls hydration.
   ════════════════════════════════════════════════════════════════════════ */

import type { PhotoCheckIn, PhysiqueCommandState, PhysiqueEntry } from "./types";
import { MEASUREMENT_SITES } from "./types";

/* ─── Dates ───────────────────────────────────────────────────────────────
   Entry dates are local calendar days ("YYYY-MM-DD"). `new Date(iso)` reads
   them as UTC midnight, which lands on the previous day west of Greenwich —
   a one-day error on every "days ago" in the product. Parse them as local. */

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function daysApart(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso).getTime() - parseDay(fromIso).getTime()) / 86_400_000);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Sep 12" — the shipped short form, used everywhere a date sits beside a value. */
export function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Sep 12, 2026" — for a headline date that must not be ambiguous across years. */
export function formatDayFull(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "today" / "yesterday" / "4 days ago". Null `now` means the clock has not mounted yet. */
export function agoLabel(iso: string, now: Date | null): string | null {
  if (!now) return null;
  const days = daysApart(iso, dayKey(now));
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function sortedByDate(entries: readonly PhysiqueEntry[]): PhysiqueEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Measurements ───────────────────────────────────────────────────────── */

export type SiteRead = {
  site: string;
  label: string;
  latestIn: number;
  latestDate: string;
  /** The previous dated check-in that recorded this same site, if any. */
  previousIn: number | null;
  previousDate: string | null;
  deltaIn: number | null;
};

export type MeasurementRecord = {
  entryCount: number;
  newest: PhysiqueEntry | null;
  previous: PhysiqueEntry | null;
  oldest: PhysiqueEntry | null;
  /** Days between the first and the newest entry. Null with fewer than two. */
  spanDays: number | null;
  /** Sites recorded on the newest entry, with the change since the last check-in that had them. */
  sites: SiteRead[];
  weightDeltaLb: number | null;
  /** The one plain-language line the screen is designed around. */
  statement: string;
  /** Newest-first, for the dated list. */
  history: PhysiqueEntry[];
};

export function measurementRecord(state: Pick<PhysiqueCommandState, "entries">): MeasurementRecord {
  const ascending = sortedByDate(state.entries);
  const newest = ascending[ascending.length - 1] ?? null;
  const previous = ascending[ascending.length - 2] ?? null;
  const oldest = ascending[0] ?? null;

  const sites: SiteRead[] = newest
    ? MEASUREMENT_SITES.flatMap(({ id, label }) => {
        const latestIn = newest.measurements[id];
        if (typeof latestIn !== "number") return [];
        /* The previous reading is the most recent EARLIER check-in that measured
           this same site — not simply the entry before, which may have skipped it. */
        const earlier = ascending
          .slice(0, -1)
          .reverse()
          .find((entry) => typeof entry.measurements[id] === "number");
        const previousIn = earlier ? (earlier.measurements[id] as number) : null;
        return [{
          site: id,
          label,
          latestIn,
          latestDate: newest.date,
          previousIn,
          previousDate: earlier?.date ?? null,
          deltaIn: previousIn === null ? null : Number((latestIn - previousIn).toFixed(1)),
        }];
      })
    : [];

  const weightDeltaLb =
    newest && previous ? Number((newest.bodyWeightLb - previous.bodyWeightLb).toFixed(1)) : null;

  return {
    entryCount: ascending.length,
    newest,
    previous,
    oldest,
    spanDays: newest && oldest && newest.id !== oldest.id ? daysApart(oldest.date, newest.date) : null,
    sites,
    weightDeltaLb,
    statement: newest
      ? `Last measured ${formatDay(newest.date)}`
      : "No measurements logged yet",
    history: [...ascending].reverse(),
  };
}

/* ─── Photo check-ins ─────────────────────────────────────────────────────
   A photo check-in is a dated record of what the member captured. Reserve
   stores the pose labels and the conditions the member ticked — never an
   assessment of the image (§02). */

export type PhotoRecord = {
  checkInCount: number;
  newest: PhotoCheckIn | null;
  oldest: PhotoCheckIn | null;
  spanDays: number | null;
  statement: string;
  history: PhotoCheckIn[];
};

export function photoRecord(state: Pick<PhysiqueCommandState, "photoCheckIns">): PhotoRecord {
  const ascending = [...state.photoCheckIns].sort((a, b) => a.date.localeCompare(b.date));
  const newest = ascending[ascending.length - 1] ?? null;
  const oldest = ascending[0] ?? null;
  return {
    checkInCount: ascending.length,
    newest,
    oldest,
    spanDays: newest && oldest && newest.id !== oldest.id ? daysApart(oldest.date, newest.date) : null,
    statement: newest ? `Last check-in ${formatDay(newest.date)}` : "No photo check-ins yet",
    history: [...ascending].reverse(),
  };
}

/**
 * How many of the conditions the member ticked when they saved the set.
 * Stored as a percentage; shown as the count it came from, because a
 * percentage beside a photo reads as a grade on the photo.
 */
export function conditionsMatched(consistencyScore: number, total: number): { matched: number; total: number } {
  const clamped = Math.max(0, Math.min(100, consistencyScore));
  return { matched: Math.round((clamped / 100) * total), total };
}

/* ─── Evidence status ─────────────────────────────────────────────────────
   Every intelligence screen opens with this line, before any finding: how
   many entries there are and over what span. With too little to compare, it
   says "Evidence needed" and the screen shows no trend at all. */

export type Evidence = {
  enough: boolean;
  entryCount: number;
  spanDays: number | null;
  /** e.g. "4 check-ins over 63 days · Jul 11 → Sep 12" */
  line: string;
};

export function evidenceLine(input: {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  noun: string;
  /** How many entries a trend needs. Two by default — one entry is a point, not a trend. */
  minimum?: number;
}): Evidence {
  const { count, firstDate, lastDate, noun } = input;
  const minimum = input.minimum ?? 2;
  const spanDays = firstDate && lastDate && firstDate !== lastDate ? daysApart(firstDate, lastDate) : null;
  const plural = count === 1 ? noun : `${noun}s`;

  if (count === 0) {
    return { enough: false, entryCount: 0, spanDays: null, line: `Evidence needed · no ${noun}s logged yet` };
  }
  if (count < minimum) {
    return {
      enough: false,
      entryCount: count,
      spanDays,
      line: `Evidence needed · ${count} ${plural} logged${lastDate ? ` · ${formatDay(lastDate)}` : ""} · ${minimum} needed for a trend`,
    };
  }
  return {
    enough: true,
    entryCount: count,
    spanDays,
    line:
      spanDays !== null && firstDate && lastDate
        ? `${count} ${plural} over ${spanDays} days · ${formatDay(firstDate)} → ${formatDay(lastDate)}`
        : `${count} ${plural} logged`,
  };
}

export function physiqueEvidence(state: Pick<PhysiqueCommandState, "entries">): Evidence {
  const ascending = sortedByDate(state.entries);
  return evidenceLine({
    count: ascending.length,
    firstDate: ascending[0]?.date ?? null,
    lastDate: ascending[ascending.length - 1]?.date ?? null,
    noun: "check-in",
  });
}

/* ─── Series ──────────────────────────────────────────────────────────────
   Points the member logged, in order. No projected point is ever appended:
   a dashed line into the future is a forecast of body change, and Reserve
   does not make one. */

export type SeriesPoint = { date: string; label: string; bodyWeightLb: number; waistIn: number | null };

export function loggedWeightSeries(state: Pick<PhysiqueCommandState, "entries">): SeriesPoint[] {
  return sortedByDate(state.entries).map((entry) => ({
    date: entry.date,
    label: formatDay(entry.date),
    bodyWeightLb: entry.bodyWeightLb,
    waistIn: typeof entry.measurements.waist === "number" ? entry.measurements.waist : null,
  }));
}

/** Direction of the member's own data. Never a judgement of it. */
export type Direction = "rising" | "falling" | "steady";

export function directionOf(delta: number, threshold = 0.3): Direction {
  if (Math.abs(delta) < threshold) return "steady";
  return delta > 0 ? "rising" : "falling";
}

/** "+1.2 in" / "−0.4 lb" — signed, with a real minus sign, never a hyphen. */
export function signed(value: number, unit: string): string {
  const rounded = Number(value.toFixed(1));
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} ${unit}`;
}
