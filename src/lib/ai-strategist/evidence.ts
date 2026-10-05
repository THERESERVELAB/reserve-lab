/* ════════════════════════════════════════════════════════════════════════
   STRATEGIST EVIDENCE — how much the member has actually logged, and over
   what span.

   Bible §12 rule 3: honest provenance. An intelligence screen states what it
   is built from BEFORE it states a finding, so the member can weigh the read
   instead of taking it on faith.

   This replaces the "coverage %" gauge the Strategist used to show. That
   number counted how many SYSTEMS had any data at all and rendered the
   result as an earned score out of 100 — a member with one sleep log and one
   photo read as "40%". Entries and a date span are the things the member
   actually did.

   Takes plain ISO date strings so it stays free of every store shape.
   Pure: no React, no store, no clock.
   ════════════════════════════════════════════════════════════════════════ */

export type StrategistEvidenceInput = {
  /** `YYYY-MM-DD` for each logged sleep night. */
  sleepDates: string[];
  /** `YYYY-MM-DD` for each hydration log. */
  hydrationDates: string[];
  /** `YYYY-MM-DD` for each recovery check-in. */
  checkInDates: string[];
  /** `YYYY-MM-DD` for each physique entry. */
  physiqueDates: string[];
};

export type StrategistEvidence = {
  /** Total logged entries across every source. */
  entries: number;
  /** Earliest and latest logged dates, or null when nothing is logged. */
  firstDate: string | null;
  lastDate: string | null;
  /** Inclusive day count from first to last. 0 when nothing is logged. */
  spanDays: number;
  /** The one sentence the screen prints above any finding. */
  line: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** UTC so a date string can never drift a day across time zones. */
function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function buildStrategistEvidence(input: StrategistEvidenceInput): StrategistEvidence {
  const dates = [
    ...input.sleepDates,
    ...input.hydrationDates,
    ...input.checkInDates,
    ...input.physiqueDates,
  ]
    .map((date) => date?.slice(0, 10) ?? "")
    .filter((date) => ISO_DATE.test(date) && Number.isFinite(toUtc(date)))
    .sort();

  if (dates.length === 0) {
    return {
      entries: 0,
      firstDate: null,
      lastDate: null,
      spanDays: 0,
      line: "Evidence needed · nothing has been logged yet.",
    };
  }

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const spanDays = Math.round((toUtc(lastDate) - toUtc(firstDate)) / 86_400_000) + 1;
  const entries = dates.length;
  const entryLabel = `${entries} logged ${entries === 1 ? "entry" : "entries"}`;

  const line =
    spanDays === 1
      ? `Built from ${entryLabel} on ${firstDate}.`
      : `Built from ${entryLabel} over ${spanDays} days · ${firstDate} to ${lastDate}.`;

  return { entries, firstDate, lastDate, spanDays, line };
}
