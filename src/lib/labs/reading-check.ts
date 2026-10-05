/* ════════════════════════════════════════════════════════════════════════
   READING CHECK — does an imported row agree with its own report?

   Photos and scans can drop or swap a digit ("41" read as "4") without the
   OCR engine reporting low confidence. The only honest cross-check Reserve
   has is the report itself: the range printed beside the result and the flag
   the lab printed. A row is marked for checking when those disagree with
   the value that was read.

   This checks the READING, never the member's health. It never says a value
   is wrong, what it means, or what caused it — only "check this row against
   your report".
   ════════════════════════════════════════════════════════════════════════ */

import { parseLabValue, parseReferenceRange, positionInRange } from "./reference-range";
import type { LabFlag } from "./types";

/** A result this many times beyond a limit is more often a misread digit than a real value. */
export const FAR_FROM_RANGE_FACTOR = 10;

export type ReadingCheck = "unclear" | "far-from-range" | "flag-mismatch" | "missing-flag";

export const READING_CHECK_MESSAGE: Record<ReadingCheck, string> = {
  unclear: "Check this row against your report — the reading was unclear.",
  "far-from-range": "Check this row against your report — the result is far from the printed range, which can happen when a digit is misread.",
  "flag-mismatch": "Check this row against your report — the result and the lab flag don't agree.",
  "missing-flag": "Check this row against your report — the result reads outside the printed range, but no lab flag was read beside it.",
};

export type ReadingRow = {
  value: string;
  referenceRange?: string;
  labFlag?: LabFlag;
  /** The parser repaired a character (O→0, l→1). */
  repaired?: boolean;
  /** The OCR engine reported low confidence on this line. */
  unclear?: boolean;
};

export type ReadingContext = {
  /** Read by OCR from a photo or a scanned PDF. */
  fromImage: boolean;
  /** At least one row on this report carries a lab flag, so the lab prints flags. */
  reportUsesFlags: boolean;
};

export function readingCheck(row: ReadingRow, context: ReadingContext): ReadingCheck | null {
  if (row.repaired || row.unclear) return "unclear";

  const value = parseLabValue(row.value);
  const range = parseReferenceRange(row.referenceRange);
  if (!value || !range) return null;
  const position = positionInRange(value, range);

  if (context.fromImage && !value.comparator) {
    const v = value.value;
    const farAbove = range.high !== undefined && range.high > 0 && v >= range.high * FAR_FROM_RANGE_FACTOR;
    const farBelow = range.low !== undefined && range.low > 0 && v <= range.low / FAR_FROM_RANGE_FACTOR;
    if (farAbove || farBelow) return "far-from-range";
  }

  if (position !== "unknown") {
    const saysHigh = row.labFlag === "H" || row.labFlag === "HH";
    const saysLow = row.labFlag === "L" || row.labFlag === "LL";
    if ((saysHigh && position !== "above") || (saysLow && position !== "below")) return "flag-mismatch";
  }

  if (context.fromImage && context.reportUsesFlags && !row.labFlag && (position === "above" || position === "below")) {
    return "missing-flag";
  }
  return null;
}
