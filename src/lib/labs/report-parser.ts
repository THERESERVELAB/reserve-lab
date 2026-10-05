/* ════════════════════════════════════════════════════════════════════════
   LAB REPORT PARSER — text from a Quest or Labcorp PDF → marker rows.

   Runs entirely on the member's device. The PDF is never uploaded, and only
   the marker rows the member confirms are saved — never patient name, date
   of birth, account numbers or the raw report text.

   Result lines look like:

     Quest     HEMATOCRIT              52.1  H   38.5-50.0     %      01
               EGFR                    95        > OR = 60     mL/min/1.73m2
     Labcorp   Hematocrit          01  52.1  High 37.5-51.0    %

   The parser prefers a split whose name matches a known marker (so "IGF 1,
   LC/MS 180" is read as IGF-1 = 180, not "IGF" = 1). An unknown test is kept
   only when the line also carries a reference range — the strongest signal
   that it is a result row rather than a header, address or page number.

   Every row goes to a review screen before saving. The parser is a
   convenience, not an authority.
   ════════════════════════════════════════════════════════════════════════ */

import { matchMarker, normalizeMarkerName, type MarkerKey } from "./markers";
import type { LabFlag } from "./types";

export type ParsedLabMarker = {
  /** Name exactly as printed. */
  name: string;
  markerKey?: MarkerKey;
  value: string;
  unit?: string;
  referenceRange?: string;
  labFlag?: LabFlag;
  /** A character in the value was repaired from a likely OCR misread (O→0, l→1). */
  repaired?: boolean;
};

export type ParsedLabReport = {
  labName?: string;
  /** YYYY-MM-DD */
  collectedDate?: string;
  markers: ParsedLabMarker[];
  /** Lines that looked like results but could not be read. */
  unreadLineCount: number;
};

const VALUE_RE = /^(?:<=|>=|<|>)?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/;
const LAB_CODE_RE = /^\d{2}$/;
const FLAG_RE = /^(HH|LL|H\*|L\*|A\*|\(H\)|\(L\)|\(A\)|H|L|A|High|Low|Abnormal|Critical|CRIT|Panic|\*|!)(?=\s|$)/i;
/** Qualitative results, as labs print them. Two-word forms are matched before one-word forms. */
const TEXT_RESULTS = ["not detected", "none seen", "non reactive", "non-reactive", "nonreactive", "negative", "positive", "reactive", "detected", "trace", "normal", "abnormal", "clear", "yellow"];
const RANGE_RE = /^(?:\d[\d,]*(?:\.\d+)?\s*-\s*\d[\d,]*(?:\.\d+)?|(?:<|>|≤|≥)\s*(?:or\s*=\s*|=\s*)?\d[\d,]*(?:\.\d+)?)/i;
const UNIT_RE = /^(?:%|[a-zµμ][\w%µμ/.^*·-]*|x?10\^?E?\d+\/[a-zµμ]+\w*)$/i;
const LAB_CODE_TOKEN_RE = /^[A-Z0-9]{2,3}$/;
const NOISE_RE = /\b(page|patient|dob|birth|phone|fax|account|specimen|collected|received|reported|client|npi|physician|provider|age|sex|gender|date|time|result|reference|range|units|flag|comment|note|status|address|report)\b/i;

const FLAG_MAP: Record<string, LabFlag> = {
  h: "H",
  high: "H",
  l: "L",
  low: "L",
  hh: "HH",
  ll: "LL",
  a: "A",
  abnormal: "A",
  critical: "critical",
  crit: "critical",
  panic: "critical",
  "*": "A",
  "!": "A",
};

function flagFor(raw: string): LabFlag | undefined {
  const token = raw.toLowerCase();
  if (token === "*" || token === "!") return FLAG_MAP[token];
  return FLAG_MAP[token.replace(/[()*]/g, "")];
}

/**
 * OCR reads "10.2" as "1O.2" or "l3.5". Repair letters only inside a token
 * that is otherwise a number, and say so, so the row is checked.
 */
function repairDigits(token: string): { token: string; repaired: boolean } {
  if (!/\d/.test(token) || !/^[<>≤≥]?[\dOoIl.,]+$/.test(token) || !/[OoIl]/.test(token)) return { token, repaired: false };
  return { token: token.replace(/[Oo]/g, "0").replace(/[Il]/g, "1"), repaired: true };
}

/** "mg / dL" → "mg/dL"; "x10E3 / uL" → "x10E3/uL". */
function joinSplitUnits(line: string): string {
  return line.replace(/(\b(?:mg|g|ng|pg|µg|μg|ug|mcg|mmol|umol|µmol|pmol|nmol|miu|uiu|µiu|iu|u|meq|ml|x10e\d+|x10\^\d+))\s*\/\s*((?:dl|l|ml|ul|µl|μl|min|hr|g)\b)/gi, "$1/$2");
}

/** "< OR = 99" → "≤ 99", "> OR = 40" → "≥ 40"; otherwise tidy spacing. */
function tidyRange(raw: string): string {
  return raw
    .replace(/<\s*(?:or\s*)?=\s*/i, "≤ ")
    .replace(/>\s*(?:or\s*)?=\s*/i, "≥ ")
    .replace(/\s*-\s*/, "-")
    .replace(/\s+/g, " ")
    .trim();
}

type ValueRead = { value: string; next: number };

/** A value token, allowing a comparator split from its number: "<" "0.5". */
function readValue(tokens: string[], index: number): ValueRead | null {
  const token = tokens[index];
  if (!token) return null;
  if (VALUE_RE.test(token)) return { value: token, next: index + 1 };
  if (/^(?:<=|>=|<|>)$/.test(token) && tokens[index + 1] && VALUE_RE.test(tokens[index + 1])) {
    return { value: `${token}${tokens[index + 1]}`, next: index + 2 };
  }
  return null;
}

type Candidate = { nameEnd: number; value: string; next: number };

function candidatesFor(tokens: string[]): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 1; i < tokens.length && i <= 10; i++) {
    let valueAt = i;
    // Labcorp prints a two-digit lab code between the name and the value.
    if (LAB_CODE_RE.test(tokens[i]) && readValue(tokens, i + 1)) valueAt = i + 1;
    const read = readValue(tokens, valueAt);
    if (read) out.push({ nameEnd: i, value: read.value, next: read.next });
  }
  return out;
}

function isUnitToken(token: string | undefined): token is string {
  return Boolean(token && UNIT_RE.test(token) && !LAB_CODE_TOKEN_RE.test(token));
}

/** A token that can START a range — a bare number with a hyphen, or a comparator. */
const RANGE_START_RE = /^(?:\d[\d,]*(?:\.\d+)?-\d|[<>≤≥])/;

function readRest(tokens: string[], next: number): Pick<ParsedLabMarker, "labFlag" | "referenceRange" | "unit"> {
  let rest = tokens.slice(next).join(" ");
  let labFlag: LabFlag | undefined;
  const flag = rest.match(FLAG_RE);
  if (flag) {
    labFlag = flagFor(flag[1]);
    rest = rest.slice(flag[0].length).trim();
  }

  // Quest: range, then unit.
  const range = rest.match(RANGE_RE);
  if (range) {
    const after = rest.slice(range[0].length).trim().split(" ")[0];
    return { labFlag, referenceRange: tidyRange(range[0]), unit: isUnitToken(after) ? after : undefined };
  }

  // Labcorp: a previous result and its date can sit between the value and
  // the units / reference interval — look further along the line.
  const restTokens = rest ? rest.split(" ") : [];
  for (let i = 0; i < restTokens.length; i++) {
    if (!RANGE_START_RE.test(restTokens[i])) continue;
    const later = restTokens.slice(i).join(" ").match(RANGE_RE);
    if (!later) continue;
    const before = restTokens[i - 1];
    const afterTokens = restTokens.slice(i).join(" ").slice(later[0].length).trim().split(" ");
    const unit = isUnitToken(before) ? before : isUnitToken(afterTokens[0]) ? afterTokens[0] : undefined;
    return { labFlag, referenceRange: tidyRange(later[0]), unit };
  }

  const unitToken = restTokens.find((token) => isUnitToken(token));
  return { labFlag, unit: unitToken };
}

/** A qualitative result starting at `index`: "Negative", "Not Detected". */
function readTextResult(tokens: string[], index: number): ValueRead | null {
  for (const phrase of TEXT_RESULTS) {
    const words = phrase.split(" ");
    const slice = tokens.slice(index, index + words.length);
    if (slice.length === words.length && slice.join(" ").toLowerCase() === phrase) {
      return { value: slice.join(" "), next: index + words.length };
    }
  }
  return null;
}

/** Rows with a qualitative result, e.g. "HIV 1/2 AG/AB NON-REACTIVE NON-REACTIVE". */
function parseTextResultLine(tokens: string[]): ParsedLabMarker | null {
  for (let i = 1; i < tokens.length && i <= 10; i++) {
    const read = readTextResult(tokens, i);
    if (!read) continue;
    const name = tokens.slice(0, i).join(" ").replace(/[\s,:]+$/, "");
    if ((name.match(/[a-z]/gi) ?? []).length < 3 || NOISE_RE.test(name)) return null;
    let next = read.next;
    let labFlag: LabFlag | undefined;
    const flag = tokens[next]?.match(FLAG_RE);
    if (flag && !readTextResult(tokens, next)) {
      labFlag = flagFor(flag[1]);
      next += 1;
    }
    const range = readTextResult(tokens, next);
    const def = matchMarker(name);
    if (!def && !range) return null;
    return { name, markerKey: def?.key, value: read.value, labFlag, referenceRange: range?.value };
  }
  return null;
}

export function parseLabLine(rawLine: string): ParsedLabMarker | null {
  const line = joinSplitUnits(rawLine.replace(/\s+/g, " ").trim());
  if (line.length < 3 || !/[a-z]/i.test(line)) return null;
  let repaired = false;
  const tokens = line.split(" ").map((token, index) => {
    if (index === 0) return token;
    const fixed = repairDigits(token);
    if (fixed.repaired) repaired = true;
    return fixed.token;
  });

  if (!/\d/.test(tokens.join(" "))) return parseTextResultLine(tokens);

  const candidates = candidatesFor(tokens);
  if (candidates.length === 0) return parseTextResultLine(tokens);
  const mark = (marker: ParsedLabMarker): ParsedLabMarker => (repaired ? { ...marker, repaired: true } : marker);

  // Prefer the split whose name is a known test.
  for (const candidate of candidates) {
    const name = tokens.slice(0, candidate.nameEnd).join(" ").replace(/[\s,:]+$/, "");
    const def = matchMarker(name);
    if (def) {
      return mark({ name, markerKey: def.key, value: candidate.value, ...readRest(tokens, candidate.next) });
    }
  }

  // Unknown test: accept only a clean result row that also prints a range.
  const first = candidates[0];
  const name = tokens.slice(0, first.nameEnd).join(" ").replace(/[\s,:]+$/, "");
  if ((name.match(/[a-z]/gi) ?? []).length < 3 || NOISE_RE.test(name)) return parseTextResultLine(tokens);
  const rest = readRest(tokens, first.next);
  if (!rest.referenceRange) return parseTextResultLine(tokens);
  return mark({ name, value: first.value, ...rest });
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthIndex = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
const MONTH_NAME = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_LABEL = "(?:date\\s+collected|collection\\s+date|collected(?:\\s+date)?|specimen\\s+collected|date\\s+of\\s+service)\\s*:?\\s*";

/** The collection date, in the formats labs and portals print. */
export function findCollectedDate(text: string): string | undefined {
  const us = text.match(new RegExp(`${DATE_LABEL}(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})`, "i"));
  if (us) return isoDate(us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]), Number(us[1]), Number(us[2]));
  const iso = text.match(new RegExp(`${DATE_LABEL}(\\d{4})-(\\d{2})-(\\d{2})`, "i"));
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const monthFirst = text.match(new RegExp(`${DATE_LABEL}${MONTH_NAME}\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (monthFirst) return isoDate(Number(monthFirst[3]), monthIndex(monthFirst[1]), Number(monthFirst[2]));
  const dayFirst = text.match(new RegExp(`${DATE_LABEL}(\\d{1,2})[-\\s]${MONTH_NAME}\\.?[-\\s](\\d{4})`, "i"));
  if (dayFirst) return isoDate(Number(dayFirst[3]), monthIndex(dayFirst[2]), Number(dayFirst[1]));
  return undefined;
}

const LAB_NAMES: Array<[RegExp, string]> = [
  [/quest\s+diagnostics/i, "Quest Diagnostics"],
  [/labcorp|laboratory corporation of america/i, "Labcorp"],
  [/bio-?reference/i, "BioReference"],
  [/sonic\s+healthcare/i, "Sonic Healthcare"],
  [/\barup\b/i, "ARUP Laboratories"],
  [/mayo\s+clinic\s+laboratories/i, "Mayo Clinic Laboratories"],
  [/ulta\s+lab\s+tests/i, "Ulta Lab Tests"],
];

export function parseLabReportText(text: string): ParsedLabReport {
  const labName = LAB_NAMES.find(([pattern]) => pattern.test(text))?.[1];
  const collectedDate = findCollectedDate(text);

  const markers: ParsedLabMarker[] = [];
  const seen = new Set<string>();
  let unreadLineCount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const parsed = parseLabLine(rawLine);
    if (!parsed) {
      // Count lines that plausibly were results: a known test name leads them.
      const lead = rawLine.trim().split(/\s{2,}|\s(?=\d)/)[0] ?? "";
      if (matchMarker(lead) && /\d/.test(rawLine)) unreadLineCount += 1;
      continue;
    }
    // A report repeats some tests (eGFR by two equations) — keep the first.
    const key = parsed.markerKey ?? `name:${normalizeMarkerName(parsed.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    markers.push(parsed);
  }

  return { labName, collectedDate, markers, unreadLineCount };
}
