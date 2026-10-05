/* ════════════════════════════════════════════════════════════════════════
   REFERENCE RANGES — read from the member's report, never supplied by Reserve.

   Ranges differ by lab, method, age and sex, so the only honest range is the
   one printed beside the result. This module parses the forms labs print:

     "38.5-50.0"   "250 - 1100"   "<200"   "< OR = 99"   "> OR = 40"   "≤5.6"

   and places a value relative to it. Anything it cannot read confidently is
   "unknown" — never guessed into "within".
   ════════════════════════════════════════════════════════════════════════ */

const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+`;

function toNumber(text: string): number | undefined {
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

export type ParsedRange = {
  low?: number;
  high?: number;
  lowInclusive: boolean;
  highInclusive: boolean;
  text: string;
};

export function parseReferenceRange(raw: string | undefined | null): ParsedRange | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const compact = text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\bor\s*=\s*/gi, "=")
    .replace(/\s+/g, "");

  const between = compact.match(new RegExp(`^(${NUMBER})-(${NUMBER})`));
  if (between) {
    const low = toNumber(between[1]);
    const high = toNumber(between[2]);
    if (low === undefined || high === undefined || low > high) return null;
    return { low, high, lowInclusive: true, highInclusive: true, text };
  }
  const upper = compact.match(new RegExp(`^(<=|=<|<)(${NUMBER})`));
  if (upper) {
    const high = toNumber(upper[2]);
    if (high === undefined) return null;
    return { high, highInclusive: upper[1] !== "<", lowInclusive: true, text };
  }
  const lower = compact.match(new RegExp(`^(>=|=>|>)(${NUMBER})`));
  if (lower) {
    const low = toNumber(lower[2]);
    if (low === undefined) return null;
    return { low, lowInclusive: lower[1] !== ">", highInclusive: true, text };
  }
  return null;
}

export type ValueComparator = "<" | "<=" | ">" | ">=";

export type ParsedValue = {
  value: number;
  comparator?: ValueComparator;
  text: string;
};

export function parseLabValue(raw: string | undefined | null): ParsedValue | null {
  if (!raw) return null;
  const text = raw.trim();
  const compact = text.replace(/\s+/g, "");
  const match = compact.match(new RegExp(`^(<=|>=|<|>)?(${NUMBER})$`));
  if (!match) return null;
  const value = toNumber(match[2]);
  if (value === undefined) return null;
  return { value, comparator: match[1] as ValueComparator | undefined, text };
}

export type RangePosition = "below" | "within" | "above" | "unknown";

export function positionInRange(value: ParsedValue | null, range: ParsedRange | null): RangePosition {
  if (!value || !range) return "unknown";
  const { value: v, comparator } = value;

  if (range.high !== undefined && (!comparator || comparator === ">" || comparator === ">=")) {
    const over = range.highInclusive ? v > range.high : v >= range.high;
    if (over) return "above";
  }
  if (range.low !== undefined && (!comparator || comparator === "<" || comparator === "<=")) {
    const under = range.lowInclusive ? v < range.low : v <= range.low;
    if (under) return "below";
  }
  // "<0.5" against "0.2-4.0" could be either side of 0.2 — do not guess.
  if ((comparator === "<" || comparator === "<=") && range.low !== undefined) return "unknown";
  if ((comparator === ">" || comparator === ">=") && range.high !== undefined) return "unknown";
  return "within";
}

/**
 * Which limit a within-range value sits close to — within 10% of the range's
 * width, or of the single bound's value when the range is one-sided.
 */
export function nearLimit(value: ParsedValue | null, range: ParsedRange | null): "high" | "low" | null {
  if (!value || !range || value.comparator) return null;
  const v = value.value;
  if (range.low !== undefined && range.high !== undefined) {
    const margin = (range.high - range.low) * 0.1;
    if (margin <= 0) return null;
    if (v <= range.high && v >= range.high - margin) return "high";
    if (v >= range.low && v <= range.low + margin) return "low";
    return null;
  }
  if (range.high !== undefined && v <= range.high && v >= range.high * 0.9) return "high";
  if (range.low !== undefined && v >= range.low && v <= range.low * 1.1) return "low";
  return null;
}
