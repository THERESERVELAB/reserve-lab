import { localDateKey } from "@/lib/dates/local-day";
import type { ProgramRevision } from "@/lib/horizon/types";
import type { ReserveDecisionRecord } from "@/lib/training/session-execution";

import type { ResponseEvent } from "./types";

export const OPTIMIZATION_EMPTY_TITLE = "NO DECISIONS RECORDED YET";
export const OPTIMIZATION_EMPTY_BODY = "Reserve decisions and athlete-approved changes will appear here.";

export type OptimizationHistoryResolution = {
  decisions: ReserveDecisionRecord[];
  events: ResponseEvent[];
  revisions: ProgramRevision[];
  counts: {
    decisions: number;
    events: number;
    revisions: number;
  };
  hasHistory: boolean;
};

/** The member Decision Log accepts canonical records only. Synthetic
    development fixtures have no parameter and therefore no route into it. */
export function resolveOptimizationHistory(input: {
  decisions: ReserveDecisionRecord[];
  events: ResponseEvent[];
  revisions: ProgramRevision[];
}): OptimizationHistoryResolution {
  const decisions = [...input.decisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const events = [...input.events].sort((a, b) => a.at.localeCompare(b.at));
  const revisions = [...input.revisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counts = {
    decisions: decisions.length,
    events: events.length,
    revisions: revisions.length,
  };
  return {
    decisions,
    events,
    revisions,
    counts,
    hasHistory: Object.values(counts).some((count) => count > 0),
  };
}

/* ─── Evidence status ─────────────────────────────────────────────────────
   The Decision Log is a record, so it states what the record contains
   and over what span BEFORE it lists a single entry (Bible §12 rule 3).
   Every count is a real stored record; nothing here is projected. */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "12 decision records, 4 response events and 2 program revisions · 2026-06-01 to 2026-09-15."
 * With nothing recorded it says so rather than printing a row of zeroes.
 */
export function optimizationEvidenceLine(history: OptimizationHistoryResolution): string {
  if (!history.hasHistory) return "Evidence needed · no decision has been recorded yet.";

  const parts: string[] = [];
  if (history.counts.decisions > 0) parts.push(plural(history.counts.decisions, "decision record"));
  if (history.counts.events > 0) parts.push(plural(history.counts.events, "response event"));
  if (history.counts.revisions > 0) parts.push(plural(history.counts.revisions, "program revision"));

  const dates = [
    ...history.decisions.map((record) => record.createdAt),
    ...history.events.map((event) => event.at),
    ...history.revisions.map((revision) => revision.createdAt),
  ]
    /* A stored instant names the member's local day, not the UTC one (#47). A bare day key is already local. */
    .map((value) => {
      if (typeof value !== "string") return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const instant = new Date(value);
      return Number.isNaN(instant.getTime()) ? "" : localDateKey(instant);
    })
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();

  const counted =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  if (dates.length === 0) return `${counted}.`;

  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? `${counted} · ${first}.` : `${counted} · ${first} to ${last}.`;
}
