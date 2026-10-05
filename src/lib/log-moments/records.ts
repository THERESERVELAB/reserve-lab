/* ════════════════════════════════════════════════════════════════════════
   RECORD MOMENTS — a lab panel filed, a cycle day checked in.

   These are the member's clinical-adjacent records, so they are always the
   quiet mark: the row presses, the check draws, one line says what was
   filed. Never the full tier, never a milestone, never a streak — a panel
   is not an achievement and a symptom is not a score.

   The line counts what was recorded and stops there. It never names a
   marker, never reads a value, never says whether anything is good, high or
   low. That is the member's clinician's to say (CLAUDE.md compliance).

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

import { calendarDateLabel } from "@/lib/dates/local-day";
import { joinDetail, type LogMomentContent } from "@/lib/ui/log-moment";

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A lab panel filed: how much was recorded, and the date on the report. */
export function labPanelMoment(input: { markerCount: number; fileCount: number; testDate: string | null }): LogMomentContent {
  const parts: string[] = [];
  if (input.markerCount > 0) parts.push(count(input.markerCount, "marker"));
  if (input.fileCount > 0) parts.push(count(input.fileCount, "file"));
  const date = calendarDateLabel(input.testDate);
  if (date) parts.push(date);
  return {
    kind: "journal",
    tier: "mark",
    tone: "log",
    lead: "Panel logged",
    detail: joinDetail(parts.length ? parts.join(" · ") : "Notes only"),
    milestone: null,
  };
}

/** A cycle check-in: the day is recorded, and the count of what the member reported. */
export function cycleCheckInMoment(input: { symptomCount: number }): LogMomentContent {
  return {
    kind: "check-in",
    tier: "mark",
    tone: "log",
    lead: "Check-in logged",
    detail: joinDetail(
      input.symptomCount > 0 ? `${count(input.symptomCount, "symptom")} recorded` : "No symptoms recorded",
    ),
    milestone: null,
  };
}
