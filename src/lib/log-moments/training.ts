import type { SessionExecutionRecord } from "@/lib/training/session-execution";
import { joinDetail, type LogMilestone, type LogMomentContent } from "@/lib/ui/log-moment";

import { COUNT_MARKS, inLastSevenDays, reachedMark } from "./streaks";

/* ════════════════════════════════════════════════════════════════════════
   TRAINING LOG MOMENTS — closing out a session.

   The words state what the member recorded: the session, the sets they
   logged, how many sessions they have closed in the last seven days. The
   milestone is a count of sessions on the record (10, 25, 50, 100, 250),
   never a verdict on the session itself.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type TrainingCloseState = {
  sessionMode: string;
  executionHistory: readonly Pick<SessionExecutionRecord, "id" | "calendarDate" | "status" | "completedAt">[];
};

const CLOSED_STATUSES = new Set(["completed", "partial"]);

const closedRecords = (state: TrainingCloseState) =>
  state.executionHistory.filter((r) => Boolean(r.completedAt) || CLOSED_STATUSES.has(String(r.status)));

export function resolveCloseOutMoment(input: {
  before: TrainingCloseState;
  after: TrainingCloseState;
  today: string;
  /** Sets the member logged in the session they just closed. */
  setsLogged: number;
}): LogMomentContent | null {
  const { before, after, today } = input;
  if (after.sessionMode !== "closed" || before.sessionMode === "closed") return null;

  const was = closedRecords(before).length;
  const now = Math.max(closedRecords(after).length, was + 1);
  const week = closedRecords(after).filter((r) => inLastSevenDays(r.calendarDate, today)).length;
  const mark = reachedMark(was, now, COUNT_MARKS);
  const milestone: LogMilestone | null = mark ? { key: `sessions-${mark}`, headline: `${mark} sessions logged.`, intensity: 1.4 } : null;
  const sets = Math.max(0, Math.round(input.setsLogged));

  return {
    kind: "training",
    tier: "full",
    tone: "log",
    lead: "Session saved",
    detail: joinDetail(sets > 0 ? `${sets} ${sets === 1 ? "set" : "sets"}` : null, week > 0 ? `${week} in the last 7 days` : null),
    milestone,
  };
}
